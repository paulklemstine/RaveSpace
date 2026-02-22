import { WebGLRenderer } from "three";
import type { Scene } from "../types/scene";
import { isParameterizedScene } from "../types/scene";
import { SILENT_AUDIO } from "../types/audio";
import type { AudioFeatures } from "../types/audio";
import type { AudioAnalyzer } from "../audio/AudioAnalyzer";
import type { SceneManager } from "./SceneManager";
import type { ParamValues } from "../types/params";

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

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
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
    const scene = sceneManager.create(name);
    this.activeSceneName = name;
    this.setScene(scene);
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
    this.renderer.dispose();
  }

  private loop = (): void => {
    this.animationId = requestAnimationFrame(this.loop);

    // Blackout: clear to black, skip scene render
    if (this.globalParams.blackout) {
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      return;
    }

    // Strobe: alternate black/render at ~15Hz
    if (this.globalParams.strobe) {
      this.strobeFrame++;
      if (this.strobeFrame % 4 < 2) {
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.clear();
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

    this.scene?.update(time, audio);
  };

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.scene?.resize(w, h);
  };
}
