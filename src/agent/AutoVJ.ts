import { ref, set, update, onValue, type Unsubscribe } from "firebase/database";
import { db } from "../firebase/config";
import type { AudioFeatures } from "../types/audio";
import type { NumberParam, SelectParam } from "../types/params";
import type { BandMapping } from "../types/bands";
import { SCENE_REGISTRY } from "../scenes/registry";
import {
  classifyEnergy,
  MOOD_PROFILES,
  INTENSITY_PARAM_KEYS,
  MIN_SCENE_DURATION,
  MIN_TRANSITION_INTERVAL,
  pickRandom,
  randomInRange,
  type EnergyLevel,
} from "./AgentPersonality";
import type { GeminiPhraseGen } from "./GeminiPhraseGen";
import { pickRandomAnimation } from "../engine/callout-animations";

type AutoVJState = "idle" | "building" | "dropping" | "chilling" | "shifting";

/** Lookup table: sceneId → registry entry */
const REGISTRY_MAP = Object.fromEntries(
  SCENE_REGISTRY.map((s) => [s.id, s]),
);

export class AutoVJ {
  private enabled = false;
  private state: AutoVJState = "idle";
  private currentEnergy: EnergyLevel = "low";
  private lastSceneSwitch = 0;
  private lastTransitionChange = 0;
  private lastParamTweak = 0;
  private lastOverlayCheck = 0;
  private currentScene = "plasma";
  private frameCount = 0;

  // Smoothed energy for trend detection
  private energySmoothed = 0;
  private prevEnergyLevel: EnergyLevel = "low";

  // Phrase generation
  private phraseGen: GeminiPhraseGen | null = null;
  private phrasesEnabled = false;
  private phraseInterval = 45; // seconds
  private lastPhraseTime = 0;
  private calloutActive = false;
  private calloutUnsub: Unsubscribe | null = null;
  private lastBpm = 0;

  setPhraseGen(gen: GeminiPhraseGen): void {
    this.phraseGen = gen;
    // Listen to callout active state
    if (!this.calloutUnsub) {
      this.calloutUnsub = onValue(ref(db, "ravespace/callouts/active"), (snapshot) => {
        this.calloutActive = snapshot.exists() && snapshot.val()?.name != null;
      });
    }
  }

  setPhrasesEnabled(enabled: boolean): void {
    this.phrasesEnabled = enabled;
  }

  setPhraseInterval(seconds: number): void {
    this.phraseInterval = seconds;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.state = "idle";
      void set(ref(db, "ravespace/control/aiMode/lastAction"), "AI VJ activated");
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getState(): AutoVJState {
    return this.state;
  }

  /** Called every frame with current audio features */
  update(audio: AudioFeatures): void {
    if (!this.enabled) return;
    this.frameCount++;

    // Smooth energy
    this.energySmoothed = this.energySmoothed * 0.95 + audio.energy * 0.05;
    this.currentEnergy = classifyEnergy(this.energySmoothed);

    this.lastBpm = audio.bpm;
    const nowSec = this.frameCount / 60;
    const profile = MOOD_PROFILES[this.currentEnergy];

    // Detect energy level change
    if (this.currentEnergy !== this.prevEnergyLevel) {
      this.onEnergyShift(nowSec);
      this.prevEnergyLevel = this.currentEnergy;
    }

    // Periodic phrase check (every 60s if nothing else fires)
    if (nowSec - this.lastPhraseTime > 60) {
      void this.maybeShowPhrase(nowSec, "periodic");
    }

    // Periodic param tweaks (every N seconds based on mood profile)
    if (nowSec - this.lastParamTweak > profile.paramTweakInterval) {
      this.tweakParams(nowSec);
    }

    // Periodic overlay check (every 10 seconds)
    if (nowSec - this.lastOverlayCheck > 10) {
      this.maybeToggleOverlay(nowSec);
    }

    // State machine
    switch (this.state) {
      case "idle":
        if (nowSec - this.lastSceneSwitch > MIN_SCENE_DURATION) {
          this.considerSceneSwitch(nowSec);
        }
        break;

      case "building":
        if (this.currentEnergy === "peak" || this.currentEnergy === "high") {
          this.state = "dropping";
          this.triggerDrop(nowSec);
        }
        if (this.energySmoothed < 0.2) {
          this.state = "chilling";
        }
        break;

      case "dropping":
        if (this.frameCount % 120 === 0) {
          this.state = "idle";
        }
        break;

      case "chilling":
        if (this.currentEnergy !== "low") {
          this.state = "idle";
        } else if (nowSec - this.lastSceneSwitch > MIN_SCENE_DURATION * 2) {
          this.applyChillScene(nowSec);
        }
        break;

      case "shifting":
        this.state = "idle";
        break;
    }
  }

  /** Handle beat drop event from DropDetector */
  onDrop(intensity: number): void {
    if (!this.enabled) return;
    if (intensity > 0.7 && this.currentEnergy === "peak") {
      this.state = "dropping";
      const profile = MOOD_PROFILES.peak;
      const transition = pickRandom(profile.transitions);
      void set(ref(db, "ravespace/control/transition"), {
        effect: transition,
        duration: 0.5 + intensity,
      });

      // Spike intensity params on drop
      this.spikeParams();

      void set(ref(db, "ravespace/control/aiMode/lastAction"),
        `Drop! ${transition} + param spike`);
    }
  }

  /** Handle build event from DropDetector */
  onBuild(intensity: number): void {
    if (!this.enabled) return;
    if (intensity > 0.5) {
      this.state = "building";
      const speed = 1.0 + intensity * 1.5;
      void set(ref(db, "ravespace/control/globalParams/speedMultiplier"), speed);

      // Gradually raise intensity params during build
      this.nudgeIntensityParams(0.6 + intensity * 0.4);

      void set(ref(db, "ravespace/control/aiMode/lastAction"),
        `Building... speed ${speed.toFixed(1)}x`);
    }
  }

  // ─── Energy Shift ───────────────────────────────────────────

  private onEnergyShift(nowSec: number): void {
    this.state = "shifting";
    const profile = MOOD_PROFILES[this.currentEnergy];

    // Trigger phrase on energy shift + prefetch for new energy level
    void this.maybeShowPhrase(nowSec, "energyShift");
    this.phraseGen?.prefetch(this.currentEnergy, {
      bpm: this.lastBpm,
      scene: this.currentScene,
      vjState: this.state,
    });

    // Adjust global params
    const intensity = randomInRange(...profile.intensityRange);
    const speed = randomInRange(...profile.speedRange);
    void set(ref(db, "ravespace/control/globalParams"), {
      masterIntensity: intensity,
      speedMultiplier: speed,
      blackout: false,
      strobe: false,
    });

    // Change transition style
    if (nowSec - this.lastTransitionChange > MIN_TRANSITION_INTERVAL) {
      const transition = pickRandom(profile.transitions);
      void set(ref(db, "ravespace/control/transition"), {
        effect: transition,
        duration: this.currentEnergy === "peak" ? 1.5 : 3,
      });
      this.lastTransitionChange = nowSec;
    }

    // Adjust effects settings based on energy
    this.adjustEffects();

    void set(ref(db, "ravespace/control/aiMode/lastAction"),
      `Energy: ${this.currentEnergy} → intensity ${intensity.toFixed(1)}, speed ${speed.toFixed(1)}`);
  }

  // ─── Scene Switching ────────────────────────────────────────

  private considerSceneSwitch(nowSec: number): void {
    const profile = MOOD_PROFILES[this.currentEnergy];
    const candidates = profile.scenes.filter((s) => s !== this.currentScene);
    if (candidates.length === 0) return;

    const newScene = pickRandom(candidates);
    this.switchToScene(newScene, nowSec);
  }

  private triggerDrop(nowSec: number): void {
    const profile = MOOD_PROFILES[this.currentEnergy];
    const candidates = profile.scenes.filter((s) => s !== this.currentScene);
    if (candidates.length > 0) {
      const newScene = pickRandom(candidates);
      this.switchToScene(newScene, nowSec);
    }
    void this.maybeShowPhrase(nowSec, "drop");
    void set(ref(db, "ravespace/control/aiMode/lastAction"),
      `DROP → ${this.currentScene}`);
  }

  private applyChillScene(nowSec: number): void {
    const profile = MOOD_PROFILES.low;
    const newScene = pickRandom(profile.scenes);
    if (newScene !== this.currentScene) {
      this.switchToScene(newScene, nowSec);
      void set(ref(db, "ravespace/control/transition"), {
        effect: pickRandom(profile.transitions),
        duration: 5,
      });
      void set(ref(db, "ravespace/control/aiMode/lastAction"),
        `Chilling → ${newScene}`);
    }
  }

  /**
   * Switches to a new scene AND generates a full set of randomized
   * per-scene params based on the current energy profile.
   */
  private switchToScene(sceneId: string, nowSec: number): void {
    this.currentScene = sceneId;
    this.lastSceneSwitch = nowSec;

    void set(ref(db, "ravespace/control/activeScene"), sceneId);
    void this.maybeShowPhrase(nowSec, "sceneSwitch");

    // Generate and push params for this scene
    const params = this.generateSceneParams(sceneId);
    if (params) {
      void set(ref(db, `ravespace/control/sceneParams/${sceneId}`), params);
    }

    // Generate and push band→param mappings
    const mappings = this.generateBandMappings(sceneId);
    if (mappings.length > 0) {
      void set(ref(db, "ravespace/control/bandMappings"), mappings);
    }
  }

  // ─── Per-scene Param Generation ─────────────────────────────

  /**
   * Generates randomized params for a scene, biased by current energy level.
   * - Number params: random within [min, max], with intensity-like params
   *   biased toward higher values at higher energy levels.
   * - Select params: random option.
   * - Boolean params: weighted by energy (higher energy → more likely true).
   */
  private generateSceneParams(sceneId: string): Record<string, number | boolean | string> | null {
    const meta = REGISTRY_MAP[sceneId];
    if (!meta) return null;

    const profile = MOOD_PROFILES[this.currentEnergy];
    const bias = profile.paramEnergyBias;
    const params: Record<string, number | boolean | string> = {};

    for (const desc of meta.params) {
      switch (desc.type) {
        case "number": {
          const np = desc as NumberParam;
          const isIntensityParam = INTENSITY_PARAM_KEYS.test(np.key);
          if (isIntensityParam) {
            // Bias toward higher end proportional to energy
            const base = randomInRange(np.min, np.max);
            params[np.key] = np.min + (np.max - np.min) * (base / np.max * (1 - bias) + bias);
          } else {
            params[np.key] = randomInRange(np.min, np.max);
          }
          // Snap to step resolution
          params[np.key] = Math.round((params[np.key] as number) / np.step) * np.step;
          break;
        }
        case "select": {
          const sp = desc as SelectParam;
          params[sp.key] = pickRandom(sp.options);
          break;
        }
        case "boolean": {
          // Higher energy → higher chance of true for "on" features
          params[desc.key] = Math.random() < 0.5 + bias * 0.5;
          break;
        }
        case "color": {
          // Random hue as hex
          const hue = Math.floor(Math.random() * 360);
          const rgb = hslToHex(hue, 100, 50);
          params[desc.key] = rgb;
          break;
        }
      }
    }

    return params;
  }

  /**
   * Generate random band→param mappings for a scene.
   * Picks 1-3 number params, assigns random bands, amounts, and modes.
   * Bass bands (0-3) are preferred for intensity-like params.
   */
  private generateBandMappings(sceneId: string): BandMapping[] {
    const meta = REGISTRY_MAP[sceneId];
    if (!meta) return [];

    // Collect number params only
    const numberParams = meta.params.filter(
      (p): p is NumberParam => p.type === "number",
    );
    if (numberParams.length === 0) return [];

    // Pick 1-3 params to modulate
    const count = Math.min(
      numberParams.length,
      1 + Math.floor(Math.random() * 3),
    );

    // Shuffle and take first `count`
    const shuffled = [...numberParams].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    const mappings: BandMapping[] = [];
    for (const param of selected) {
      const isIntensity = INTENSITY_PARAM_KEYS.test(param.key);
      // Bass bands (0-3) for intensity params, mid/treble (4-14) for others
      const bandIndex = isIntensity
        ? Math.floor(Math.random() * 4) // bands 0-3 (sub-bass to bass)
        : 4 + Math.floor(Math.random() * 11); // bands 4-14

      mappings.push({
        paramKey: param.key,
        bandIndex,
        amount: 0.2 + Math.random() * 0.6, // 0.2 - 0.8
        mode: Math.random() < 0.6 ? "add" : "multiply",
      });
    }

    return mappings;
  }

  // ─── Periodic Param Tweaking ────────────────────────────────

  /**
   * Nudges 1-2 random number params on the current scene slightly,
   * creating organic drift without full randomization.
   */
  private tweakParams(nowSec: number): void {
    this.lastParamTweak = nowSec;

    const meta = REGISTRY_MAP[this.currentScene];
    if (!meta) return;

    const numberParams = meta.params.filter((p) => p.type === "number") as NumberParam[];
    if (numberParams.length === 0) return;

    const tweakCount = Math.min(1 + Math.floor(Math.random() * 2), numberParams.length);
    const shuffled = [...numberParams].sort(() => Math.random() - 0.5);
    const toTweak = shuffled.slice(0, tweakCount);

    const profile = MOOD_PROFILES[this.currentEnergy];
    const updates: Record<string, number> = {};

    for (const np of toTweak) {
      const range = np.max - np.min;
      // Drift by ±5-15% of param range
      const drift = (Math.random() - 0.5) * range * 0.2;
      // For intensity params, bias drift upward with energy
      const isIntensity = INTENSITY_PARAM_KEYS.test(np.key);
      const biasedDrift = isIntensity ? drift + range * profile.paramEnergyBias * 0.1 : drift;

      // We don't know current value, so use a reasonable base from defaults + drift
      // Use update() so we read the path directly
      const defaultVal = np.default;
      const newVal = Math.max(np.min, Math.min(np.max, defaultVal + biasedDrift));
      updates[np.key] = Math.round(newVal / np.step) * np.step;
    }

    void update(ref(db, `ravespace/control/sceneParams/${this.currentScene}`), updates);

    const paramNames = toTweak.map((p) => p.key).join(", ");
    void set(ref(db, "ravespace/control/aiMode/lastAction"),
      `Tweaked ${paramNames}`);
  }

  // ─── Spike Params on Drop ───────────────────────────────────

  /**
   * On a drop, maxes out all intensity-like params for the current scene.
   */
  private spikeParams(): void {
    const meta = REGISTRY_MAP[this.currentScene];
    if (!meta) return;

    const updates: Record<string, number> = {};
    for (const desc of meta.params) {
      if (desc.type === "number") {
        const np = desc as NumberParam;
        if (INTENSITY_PARAM_KEYS.test(np.key)) {
          // Push to 80-100% of max
          updates[np.key] = Math.round(randomInRange(np.max * 0.8, np.max) / np.step) * np.step;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      void update(ref(db, `ravespace/control/sceneParams/${this.currentScene}`), updates);
    }
  }

  /**
   * During builds, nudge intensity-like params upward.
   */
  private nudgeIntensityParams(factor: number): void {
    const meta = REGISTRY_MAP[this.currentScene];
    if (!meta) return;

    const updates: Record<string, number> = {};
    for (const desc of meta.params) {
      if (desc.type === "number") {
        const np = desc as NumberParam;
        if (INTENSITY_PARAM_KEYS.test(np.key)) {
          const target = np.min + (np.max - np.min) * factor;
          updates[np.key] = Math.round(target / np.step) * np.step;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      void update(ref(db, `ravespace/control/sceneParams/${this.currentScene}`), updates);
    }
  }

  // ─── Phrase Generation ──────────────────────────────────────

  private async maybeShowPhrase(nowSec: number, _reason: string): Promise<void> {
    if (!this.phrasesEnabled || !this.phraseGen) return;
    if (nowSec - this.lastPhraseTime < this.phraseInterval) return;
    if (this.calloutActive) return;

    // Check if audience queue is backed up (>3 items) — let them through first
    try {
      const { get: fbGet } = await import("firebase/database");
      const queueSnap = await fbGet(ref(db, "ravespace/callouts/queue"));
      if (queueSnap.exists() && Object.keys(queueSnap.val()).length > 3) return;
    } catch {
      // Can't check queue — proceed anyway
    }

    this.lastPhraseTime = nowSec;

    try {
      const phrase = await this.phraseGen.getPhrase(this.currentEnergy, {
        bpm: this.lastBpm,
        scene: this.currentScene,
        vjState: this.state,
      });

      void set(ref(db, "ravespace/callouts/active"), {
        name: phrase,
        startTime: Date.now(),
        duration: 4,
        source: "ai" as const,
        animationStyle: pickRandomAnimation(),
      });

      void set(ref(db, "ravespace/control/aiMode/lastAction"),
        `Phrase: "${phrase}"`);
    } catch {
      // Phrase generation failed — skip silently
    }
  }

  dispose(): void {
    this.calloutUnsub?.();
  }

  // ─── Overlay Compositing ────────────────────────────────────

  /**
   * Probabilistically enables/disables an overlay scene based on the
   * current energy profile's overlayChance.
   */
  private maybeToggleOverlay(nowSec: number): void {
    this.lastOverlayCheck = nowSec;

    const profile = MOOD_PROFILES[this.currentEnergy];

    if (Math.random() < profile.overlayChance) {
      // Enable overlay with random scene (different from primary)
      const candidates = profile.scenes.filter((s) => s !== this.currentScene);
      if (candidates.length === 0) return;

      const overlayScene = pickRandom(candidates);
      const blendMode = pickRandom(profile.overlayBlendModes);
      const opacity = randomInRange(...profile.overlayOpacityRange);

      void set(ref(db, "ravespace/control/overlay"), {
        scene: overlayScene,
        blendMode,
        opacity: Math.round(opacity * 100) / 100,
      });

      void set(ref(db, "ravespace/control/aiMode/lastAction"),
        `Overlay: ${overlayScene} (${blendMode} @ ${(opacity * 100).toFixed(0)}%)`);
    } else {
      // Clear overlay
      void set(ref(db, "ravespace/control/overlay"), { scene: "" });
    }
  }

  // ─── Effects Settings ───────────────────────────────────────

  /**
   * Adjusts the EffectsLayer settings based on current energy.
   * Higher energy → more effects enabled, higher sensitivity.
   */
  private adjustEffects(): void {
    const profile = MOOD_PROFILES[this.currentEnergy];
    const sensitivity = randomInRange(...profile.effectsSensitivityRange);

    const isHighEnergy = this.currentEnergy === "high" || this.currentEnergy === "peak";
    const isMedium = this.currentEnergy === "medium";

    void set(ref(db, "ravespace/control/effects"), {
      dropFlash: isMedium || isHighEnergy,
      dropZoom: isHighEnergy,
      screenShake: isHighEnergy,
      sensitivity: Math.round(sensitivity * 100) / 100,
      strobeBpmSync: this.currentEnergy === "peak",
    });
  }
}

// ─── Utility ──────────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
