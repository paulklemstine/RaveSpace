import type { AudioFeatures } from "../types/audio";
import type { Renderer } from "../engine/Renderer";
import type { SceneManager } from "../engine/SceneManager";
import {
  classifyEnergy,
  MOOD_PROFILES,
  MIN_SCENE_DURATION,
  MIN_TRANSITION_INTERVAL,
  pickRandom,
  randomInRange,
  type EnergyLevel,
} from "./AgentPersonality";

type AutoVJState = "idle" | "building" | "dropping" | "chilling" | "shifting";

export class AutoVJ {
  private renderer: Renderer;
  private sceneManager: SceneManager;
  private enabled = false;
  private state: AutoVJState = "idle";
  private currentEnergy: EnergyLevel = "low";
  private lastSceneSwitch = 0;
  private lastTransitionChange = 0;
  private currentScene = "plasma";
  private frameCount = 0;
  private lastAction = "";

  // Smoothed energy for trend detection
  private energySmoothed = 0;
  private prevEnergyLevel: EnergyLevel = "low";

  constructor(renderer: Renderer, sceneManager: SceneManager) {
    this.renderer = renderer;
    this.sceneManager = sceneManager;
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

    const nowSec = this.frameCount / 60;

    // Detect energy level change
    if (this.currentEnergy !== this.prevEnergyLevel) {
      this.onEnergyShift(nowSec);
      this.prevEnergyLevel = this.currentEnergy;
    }

    // State machine
    switch (this.state) {
      case "idle":
        // Check if it's time for a scene switch based on energy
        if (nowSec - this.lastSceneSwitch > MIN_SCENE_DURATION) {
          this.considerSceneSwitch(nowSec);
        }
        break;

      case "building":
        // Wait for drop or energy to stabilize
        if (this.currentEnergy === "peak" || this.currentEnergy === "high") {
          this.state = "dropping";
          this.triggerDrop(nowSec);
        }
        if (this.energySmoothed < 0.2) {
          this.state = "chilling";
        }
        break;

      case "dropping":
        // After drop, transition to idle
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
        // Brief state after energy shift
        this.state = "idle";
        break;
    }
  }

  /** Handle beat drop event from DropDetector */
  onDrop(intensity: number): void {
    if (!this.enabled) return;
    if (intensity > 0.7 && this.currentEnergy === "peak") {
      this.state = "dropping";
      // Dramatic transition on big drops
      const profile = MOOD_PROFILES.peak;
      const transition = pickRandom(profile.transitions);
      this.renderer.setTransition(transition, 0.5 + intensity);
      this.lastAction = `Drop! ${transition} transition`;
    }
  }

  /** Handle build event from DropDetector */
  onBuild(intensity: number): void {
    if (!this.enabled) return;
    if (intensity > 0.5) {
      this.state = "building";
      // Increase speed during build
      const speed = 1.0 + intensity * 1.5;
      this.renderer.setGlobalParams({ speedMultiplier: speed });
      this.lastAction = `Building... speed ${speed.toFixed(1)}x`;
    }
  }

  private onEnergyShift(nowSec: number): void {
    this.state = "shifting";

    const profile = MOOD_PROFILES[this.currentEnergy];

    // Adjust global params for new energy level
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

    this.lastAction = `Energy: ${this.currentEnergy} → intensity ${intensity.toFixed(1)}, speed ${speed.toFixed(1)}`;
  }

  private considerSceneSwitch(nowSec: number): void {
    const profile = MOOD_PROFILES[this.currentEnergy];
    const candidates = profile.scenes.filter((s) => s !== this.currentScene);
    if (candidates.length === 0) return;

    const newScene = pickRandom(candidates);
    this.currentScene = newScene;
    this.lastSceneSwitch = nowSec;

    this.renderer.setSceneByName(newScene, this.sceneManager);
    this.lastAction = `Switched to ${newScene}`;
  }

  private triggerDrop(nowSec: number): void {
    const profile = MOOD_PROFILES[this.currentEnergy];
    const candidates = profile.scenes.filter((s) => s !== this.currentScene);
    if (candidates.length > 0) {
      const newScene = pickRandom(candidates);
      this.currentScene = newScene;
      this.lastSceneSwitch = nowSec;
      this.renderer.setSceneByName(newScene, this.sceneManager);
    }

    this.lastAction = `DROP → ${this.currentScene}`;
  }

  private applyChillScene(nowSec: number): void {
    const profile = MOOD_PROFILES.low;
    const newScene = pickRandom(profile.scenes);
    if (newScene !== this.currentScene) {
      this.currentScene = newScene;
      this.lastSceneSwitch = nowSec;
      this.renderer.setSceneByName(newScene, this.sceneManager);
      this.renderer.setTransition(pickRandom(profile.transitions), 5);
      this.lastAction = `Chilling → ${newScene}`;
    }
  }
}
