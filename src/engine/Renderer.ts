import { WebGLRenderer } from "three";
import type { Scene } from "../types/scene";
import { isParameterizedScene } from "../types/scene";
import { SILENT_AUDIO } from "../types/audio";
import type { AudioFeatures } from "../types/audio";
import type { AudioAnalyzer } from "../audio/AudioAnalyzer";
import type { SceneManager } from "./SceneManager";
import type { ParamValues } from "../types/params";
import { TransitionEngine } from "./TransitionEngine";
import { EffectsLayer } from "./EffectsLayer";
import type { EffectsSettings } from "./EffectsLayer";

export interface DiagnosticInfo {
  fps: number;
  sceneName: string | null;
  transitioning: boolean;
  blackout: boolean;
  strobe: boolean;
}

export interface GlobalParams {
  masterIntensity: number;
  speedMultiplier: number;
  blackout: boolean;
  strobe: boolean;
}

const DEFAULT_GLOBAL_PARAMS: GlobalParams = {
  masterIntensity: 1.0,
  speedMultiplier: 1.0,
  blackout: false,
  strobe: false,
};

export class Renderer {
  private renderer: WebGLRenderer;
  private scene: Scene | null = null;
  private activeSceneName: string | null = null;
  private animationId = 0;
  private startTime = 0;
  private audioAnalyzer: AudioAnalyzer | null = null;
  private globalParams: GlobalParams = { ...DEFAULT_GLOBAL_PARAMS };
  private strobeFrame = 0;
  private transitionEngine: TransitionEngine;
  private effectsLayer: EffectsLayer;
  private sceneManager: SceneManager | null = null;
  private frameCount = 0;
  private lastFpsTime = 0;
  private fps = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.transitionEngine = new TransitionEngine(this.renderer);
    this.effectsLayer = new EffectsLayer(canvas);
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  setScene(scene: Scene): void {
    this.scene?.dispose();
    this.scene = scene;
    scene.init(this.renderer);
    scene.resize(window.innerWidth, window.innerHeight);
  }

  setSceneByName(name: string, sceneManager: SceneManager): void {
    this.sceneManager = sceneManager;

    // If no scene is active yet (first load), do instant switch
    if (!this.scene) {
      const scene = sceneManager.create(name);
      this.activeSceneName = name;
      this.setScene(scene);
      return;
    }

    // If same scene, ignore
    if (name === this.activeSceneName) return;

    // If already transitioning, skip (let current transition finish)
    if (this.transitionEngine.isTransitioning) return;

    // Smooth transition via TransitionEngine
    const newScene = sceneManager.create(name);
    const oldScene = this.scene;
    this.activeSceneName = name;

    this.transitionEngine.start(oldScene, newScene, () => {
      // Transition complete — new scene is now active
      this.scene = newScene;
    });

    // Clear reference so loop delegates to transitionEngine
    this.scene = null;
  }

  getActiveSceneName(): string | null {
    return this.activeSceneName;
  }

  getActiveScene(): Scene | null {
    return this.scene;
  }

  setAudioAnalyzer(analyzer: AudioAnalyzer): void {
    this.audioAnalyzer = analyzer;
  }

  setGlobalParams(params: Partial<GlobalParams>): void {
    Object.assign(this.globalParams, params);
  }

  getGlobalParams(): GlobalParams {
    return { ...this.globalParams };
  }

  setSceneParams(values: ParamValues): void {
    if (this.scene && isParameterizedScene(this.scene)) {
      this.scene.setParams(values);
    }
  }

  setTransition(effect: string, duration: number): void {
    this.transitionEngine.setTransition(effect, duration);
  }

  getTransitionSettings(): { effect: string; duration: number } {
    return this.transitionEngine.getSettings();
  }

  getEffectsLayer(): EffectsLayer {
    return this.effectsLayer;
  }

  setEffectsSettings(settings: Partial<EffectsSettings>): void {
    this.effectsLayer.setSettings(settings);
  }

  start(): void {
    this.startTime = performance.now() / 1000;
    this.loop();
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.resize);
    this.scene?.dispose();
    this.transitionEngine.dispose();
    this.effectsLayer.dispose();
    this.renderer.dispose();
  }

  getDiagnostics(): DiagnosticInfo {
    return {
      fps: this.fps,
      sceneName: this.activeSceneName,
      transitioning: this.transitionEngine.isTransitioning,
      blackout: this.globalParams.blackout,
      strobe: this.globalParams.strobe,
    };
  }

  private loop = (): void => {
    this.animationId = requestAnimationFrame(this.loop);

    // FPS tracking
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    // Blackout: clear to black, skip scene render
    if (this.globalParams.blackout) {
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      return;
    }

    // Strobe: alternate black/render (BPM-synced or ~15Hz)
    if (this.globalParams.strobe) {
      this.strobeFrame++;
      const rawAudioForStrobe = this.audioAnalyzer?.getFeatures() ?? SILENT_AUDIO;
      const strobeInterval = this.effectsLayer.getStrobeInterval(rawAudioForStrobe.bpm);
      if (this.strobeFrame % strobeInterval < strobeInterval / 2) {
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.clear();
        this.effectsLayer.update();
        return;
      }
    }

    // Apply speed multiplier to time
    const rawTime = performance.now() / 1000 - this.startTime;
    const time = rawTime * this.globalParams.speedMultiplier;

    // Get audio and apply master intensity
    const rawAudio = this.audioAnalyzer?.getFeatures() ?? SILENT_AUDIO;
    const intensity = this.globalParams.masterIntensity;
    const audio: AudioFeatures = {
      energy: rawAudio.energy * intensity,
      bass: rawAudio.bass * intensity,
      mid: rawAudio.mid * intensity,
      treble: rawAudio.treble * intensity,
      spectralCentroid: rawAudio.spectralCentroid,
      beat: rawAudio.beat && intensity > 0.1,
      bpm: rawAudio.bpm,
    };

    // During transition, delegate to transitionEngine
    if (this.transitionEngine.isTransitioning) {
      this.transitionEngine.update(time, audio);
      this.effectsLayer.update();
      return;
    }

    this.scene?.update(time, audio);
    this.effectsLayer.update();
  };

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.scene?.resize(w, h);
    this.transitionEngine.resize(w, h);
  };
}
