import type { Renderer } from "../engine/Renderer";
import type { SceneManager } from "../engine/SceneManager";
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
import type { EmojiRain } from "../engine/EmojiRain";

type AutoVJState = "idle" | "building" | "dropping" | "chilling" | "shifting";

/** Lookup table: sceneId → registry entry */
const REGISTRY_MAP = Object.fromEntries(
  SCENE_REGISTRY.map((s) => [s.id, s]),
);

interface OverlaySlot {
  scene: string;
  blendMode: string;
  opacity: number;
}

export class AutoVJ {
  private renderer: Renderer;
  private sceneManager: SceneManager;

  private enabled = true;
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
  private calloutQueueSize = 0;

  // Callout callback
  private onShowCallout: ((name: string, duration: number, animationStyle: string) => void) | null = null;

  // Last action tracking (replaces Firebase aiMode/lastAction)
  private lastAction = "";

  // Emoji rain
  private emojiRain: EmojiRain | null = null;
  private lastEmojiPick = 0;
  private lastBpm = 0;

  constructor(
    renderer: Renderer,
    sceneManager: SceneManager,
    onShowCallout?: (name: string, duration: number, animationStyle: string) => void,
  ) {
    this.renderer = renderer;
    this.sceneManager = sceneManager;
    this.onShowCallout = onShowCallout ?? null;
  }

  setPhraseGen(gen: GeminiPhraseGen): void {
    this.phraseGen = gen;
  }

  setCalloutActive(active: boolean): void {
    this.calloutActive = active;
  }

  setCalloutQueueSize(size: number): void {
    this.calloutQueueSize = size;
  }

  private static readonly EMOJI_BY_ENERGY: Record<EnergyLevel, string[]> = {
    low: ["✨", "🌙", "🦋", "🌸", "💫", "🪷", "🌌", "💎"],
    medium: ["💜", "🎵", "🎶", "🩵", "💖", "⭐", "🌟", "🔮"],
    high: ["🔥", "⚡", "💥", "🪩", "❤️‍🔥", "🎆", "☀️", "🌋"],
    peak: ["💀", "👾", "🧨", "🎇", "🐉", "🎭", "👽", "🎪"],
  };

  setEmojiRain(rain: EmojiRain): void {
    this.emojiRain = rain;
    this.pickEmojiForRain();
  }

  private pickEmojiForRain(): void {
    if (!this.emojiRain) return;
    const pool = AutoVJ.EMOJI_BY_ENERGY[this.currentEnergy];
    const emoji = pool[Math.floor(Math.random() * pool.length)]!;
    this.emojiRain.setEmoji(emoji);
    this.lastEmojiPick = performance.now() / 1000;
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
      this.lastAction = "AI VJ activated";
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getState(): AutoVJState {
    return this.state;
  }

  getLastAction(): string {
    return this.lastAction;
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

    // Periodic emoji refresh (~30s)
    if (nowSec - this.lastEmojiPick > 30) {
      this.pickEmojiForRain();
    }

    // Periodic overlay check (every 8 seconds)
    if (nowSec - this.lastOverlayCheck > 8) {
      this.manageOverlayLayers(nowSec);
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
      this.renderer.setTransition(transition, 0.5 + intensity);

      // Spike intensity params on drop
      this.spikeParams();

      this.lastAction = `Drop! ${transition} + param spike`;
    }
  }

  /** Handle build event from DropDetector */
  onBuild(intensity: number): void {
    if (!this.enabled) return;
    if (intensity > 0.5) {
      this.state = "building";
      const speed = 1.0 + intensity * 1.5;
      this.renderer.setGlobalParams({ speedMultiplier: speed });

      // Gradually raise intensity params during build
      this.nudgeIntensityParams(0.6 + intensity * 0.4);

      this.lastAction = `Building... speed ${speed.toFixed(1)}x`;
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
    this.renderer.setGlobalParams({
      masterIntensity: intensity,
      speedMultiplier: speed,
      blackout: false,
      strobe: false,
    });

    // Change transition style
    if (nowSec - this.lastTransitionChange > MIN_TRANSITION_INTERVAL) {
      const transition = pickRandom(profile.transitions);
      this.renderer.setTransition(
        transition,
        this.currentEnergy === "peak" ? 1.5 : 3,
      );
      this.lastTransitionChange = nowSec;
    }

    // Adjust effects settings based on energy
    this.adjustEffects();

    // Reconfigure overlay layers for new energy level
    this.manageOverlayLayers(nowSec);

    // Pick a fresh emoji for the rain overlay
    this.pickEmojiForRain();

    this.lastAction =
      `Energy: ${this.currentEnergy} → intensity ${intensity.toFixed(1)}, speed ${speed.toFixed(1)}`;
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
    this.lastAction = `DROP → ${this.currentScene}`;
  }

  private applyChillScene(nowSec: number): void {
    const profile = MOOD_PROFILES.low;
    const newScene = pickRandom(profile.scenes);
    if (newScene !== this.currentScene) {
      this.switchToScene(newScene, nowSec);
      this.renderer.setTransition(pickRandom(profile.transitions), 5);
      this.lastAction = `Chilling → ${newScene}`;
    }
  }

  /**
   * Switches to a new scene AND generates a full set of randomized
   * per-scene params based on the current energy profile.
   */
  private switchToScene(sceneId: string, nowSec: number): void {
    this.currentScene = sceneId;
    this.lastSceneSwitch = nowSec;

    this.renderer.setSceneByName(sceneId, this.sceneManager);
    void this.maybeShowPhrase(nowSec, "sceneSwitch");

    // Generate and push params for this scene
    const params = this.generateSceneParams(sceneId);
    if (params) {
      this.renderer.setSceneParams(params);
    }

    // Generate and push band→param mappings
    const mappings = this.generateBandMappings(sceneId);
    if (mappings.length > 0) {
      this.renderer.setBandMappings(mappings);
    }
  }

  // ─── Per-scene Param Generation ─────────────────────────────

  /**
   * Generates randomized params for a scene, biased by current energy level.
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
            const base = randomInRange(np.min, np.max);
            params[np.key] = np.min + (np.max - np.min) * (base / np.max * (1 - bias) + bias);
          } else {
            params[np.key] = randomInRange(np.min, np.max);
          }
          params[np.key] = Math.round((params[np.key] as number) / np.step) * np.step;
          break;
        }
        case "select": {
          const sp = desc as SelectParam;
          params[sp.key] = pickRandom(sp.options);
          break;
        }
        case "boolean": {
          params[desc.key] = Math.random() < 0.5 + bias * 0.5;
          break;
        }
        case "color": {
          const hue = Math.floor(Math.random() * 360);
          params[desc.key] = hslToHex(hue, 100, 50);
          break;
        }
      }
    }

    return params;
  }

  /**
   * Generate random band→param mappings for a scene.
   * Picks 1-3 number params, assigns random bands, amounts, and modes.
   */
  private generateBandMappings(sceneId: string): BandMapping[] {
    const meta = REGISTRY_MAP[sceneId];
    if (!meta) return [];

    const numberParams = meta.params.filter(
      (p): p is NumberParam => p.type === "number",
    );
    if (numberParams.length === 0) return [];

    const count = Math.min(
      numberParams.length,
      1 + Math.floor(Math.random() * 3),
    );

    const shuffled = [...numberParams].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    const mappings: BandMapping[] = [];
    for (const param of selected) {
      const isIntensity = INTENSITY_PARAM_KEYS.test(param.key);
      const bandIndex = isIntensity
        ? Math.floor(Math.random() * 4) // bands 0-3 (sub-bass to bass)
        : 4 + Math.floor(Math.random() * 11); // bands 4-14

      mappings.push({
        paramKey: param.key,
        bandIndex,
        amount: 0.2 + Math.random() * 0.6,
        mode: Math.random() < 0.6 ? "add" : "multiply",
      });
    }

    return mappings;
  }

  // ─── Periodic Param Tweaking ────────────────────────────────

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
      const drift = (Math.random() - 0.5) * range * 0.2;
      const isIntensity = INTENSITY_PARAM_KEYS.test(np.key);
      const biasedDrift = isIntensity ? drift + range * profile.paramEnergyBias * 0.1 : drift;

      const defaultVal = np.default;
      const newVal = Math.max(np.min, Math.min(np.max, defaultVal + biasedDrift));
      updates[np.key] = Math.round(newVal / np.step) * np.step;
    }

    this.renderer.setSceneParams({ ...updates });

    const paramNames = toTweak.map((p) => p.key).join(", ");
    this.lastAction = `Tweaked ${paramNames}`;
  }

  // ─── Spike Params on Drop ───────────────────────────────────

  private spikeParams(): void {
    const meta = REGISTRY_MAP[this.currentScene];
    if (!meta) return;

    const updates: Record<string, number> = {};
    for (const desc of meta.params) {
      if (desc.type === "number") {
        const np = desc as NumberParam;
        if (INTENSITY_PARAM_KEYS.test(np.key)) {
          updates[np.key] = Math.round(randomInRange(np.max * 0.8, np.max) / np.step) * np.step;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      this.renderer.setSceneParams({ ...updates });
    }
  }

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
      this.renderer.setSceneParams({ ...updates });
    }
  }

  // ─── Phrase Generation ──────────────────────────────────────

  private async maybeShowPhrase(nowSec: number, _reason: string): Promise<void> {
    if (!this.phrasesEnabled || !this.phraseGen) return;
    if (nowSec - this.lastPhraseTime < this.phraseInterval) return;
    if (this.calloutActive) return;

    // Check queue size (set externally via setCalloutQueueSize)
    if (this.calloutQueueSize > 3) return;

    this.lastPhraseTime = nowSec;

    try {
      const phrase = await this.phraseGen.getPhrase(this.currentEnergy, {
        bpm: this.lastBpm,
        scene: this.currentScene,
        vjState: this.state,
      });

      const animationStyle = pickRandomAnimation();
      const duration = 4;

      // Notify caller via callback
      this.onShowCallout?.(phrase, duration, animationStyle);

      this.lastAction = `Phrase: "${phrase}"`;
    } catch {
      // Phrase generation failed — skip silently
    }
  }

  dispose(): void {
    // No-op: no external subscriptions to clean up
  }

  // ─── Multi-Layer Overlay Management ────────────────────────

  /**
   * Manages up to 3 overlay layers based on current energy level.
   * Higher energy = more layers, more aggressive blending.
   */
  private manageOverlayLayers(nowSec: number): void {
    this.lastOverlayCheck = nowSec;

    const profile = MOOD_PROFILES[this.currentEnergy];
    const maxLayers = profile.maxOverlayLayers;

    // Determine how many overlay layers to have active
    let targetLayerCount = 0;
    for (let i = 0; i < maxLayers; i++) {
      // Each additional layer is less likely
      const chance = profile.overlayChance * Math.pow(0.6, i);
      if (Math.random() < chance) {
        targetLayerCount = i + 1;
      } else {
        break;
      }
    }

    // Build the overlays array
    const overlays: (OverlaySlot | null)[] = [null, null, null];
    const usedScenes = new Set<string>([this.currentScene]);

    for (let i = 0; i < targetLayerCount; i++) {
      const candidates = profile.scenes.filter((s) => !usedScenes.has(s));
      if (candidates.length === 0) break;

      const overlayScene = pickRandom(candidates);
      usedScenes.add(overlayScene);

      const blendMode = pickRandom(profile.overlayBlendModes);
      // Decrease opacity for each successive layer
      const baseOpacity = randomInRange(...profile.overlayOpacityRange);
      const opacity = baseOpacity * Math.pow(0.7, i);

      overlays[i] = {
        scene: overlayScene,
        blendMode,
        opacity: Math.round(opacity * 100) / 100,
      };
    }

    // Apply overlay layers directly to the Renderer
    for (let i = 0; i < 3; i++) {
      const slot = overlays[i];
      if (slot) {
        this.renderer.setOverlayLayer(i, slot.scene, this.sceneManager, slot.blendMode, slot.opacity);
      } else {
        this.renderer.clearOverlayLayer(i);
      }
    }


    const activeNames = overlays
      .filter((o) => o !== null)
      .map((o) => `${o!.scene}(${o!.blendMode}@${(o!.opacity * 100).toFixed(0)}%)`);

    if (activeNames.length > 0) {
      this.lastAction = `Layers: ${activeNames.join(" + ")}`;
    }
  }

  // ─── Effects Settings ───────────────────────────────────────

  private adjustEffects(): void {
    const profile = MOOD_PROFILES[this.currentEnergy];
    const sensitivity = randomInRange(...profile.effectsSensitivityRange);

    const isHighEnergy = this.currentEnergy === "high" || this.currentEnergy === "peak";
    const isMedium = this.currentEnergy === "medium";

    this.renderer.setEffectsSettings({
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
