import {
  WebGLRenderer,
  WebGLRenderTarget,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Scene as ThreeScene,
  LinearFilter,
} from "three";
import type { Scene } from "../types/scene";
import { isParameterizedScene } from "../types/scene";
import { SILENT_AUDIO } from "../types/audio";
import type { AudioFeatures } from "../types/audio";
import type { AudioAnalyzer } from "../audio/AudioAnalyzer";
import type { SceneManager } from "./SceneManager";
import type { ParamValues } from "../types/params";
import type { BandMapping } from "../types/bands";
import { TransitionEngine } from "./TransitionEngine";
import { EffectsLayer } from "./EffectsLayer";
import type { EffectsSettings } from "./EffectsLayer";
import { BandMapper } from "../audio/BandMapper";

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

export const BLEND_MODES: Record<string, number> = {
  additive: 0,
  screen: 1,
  multiply: 2,
  overlay: 3,
  difference: 4,
};

const COMPOSITE_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const COMPOSITE_FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tBase;
uniform sampler2D tOverlay;
uniform float uOpacity;
uniform int uBlendMode;

vec3 blendAdditive(vec3 base, vec3 blend) { return base + blend; }
vec3 blendScreen(vec3 base, vec3 blend) { return 1.0 - (1.0 - base) * (1.0 - blend); }
vec3 blendMultiply(vec3 base, vec3 blend) { return base * blend; }
vec3 blendOverlay(vec3 base, vec3 blend) {
  return vec3(
    base.r < 0.5 ? 2.0*base.r*blend.r : 1.0-2.0*(1.0-base.r)*(1.0-blend.r),
    base.g < 0.5 ? 2.0*base.g*blend.g : 1.0-2.0*(1.0-base.g)*(1.0-blend.g),
    base.b < 0.5 ? 2.0*base.b*blend.b : 1.0-2.0*(1.0-base.b)*(1.0-blend.b)
  );
}
vec3 blendDifference(vec3 base, vec3 blend) { return abs(base - blend); }

void main() {
  vec3 base = texture2D(tBase, vUv).rgb;
  vec3 over = texture2D(tOverlay, vUv).rgb;
  vec3 blended;
  if (uBlendMode == 0) blended = blendAdditive(base, over);
  else if (uBlendMode == 1) blended = blendScreen(base, over);
  else if (uBlendMode == 2) blended = blendMultiply(base, over);
  else if (uBlendMode == 3) blended = blendOverlay(base, over);
  else blended = blendDifference(base, over);
  gl_FragColor = vec4(mix(base, blended, uOpacity), 1.0);
}
`;

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

  // Band→param modulation
  private bandMapper = new BandMapper();
  private baseParams: ParamValues = {};

  // Compositing: overlay scene blended on top of primary
  private overlayScene: Scene | null = null;
  private overlaySceneName: string | null = null;
  private overlayOpacity = 0.5;
  private overlayBlendMode = 0; // index into BLEND_MODES
  private primaryRT: WebGLRenderTarget | null = null;
  private overlayRT: WebGLRenderTarget | null = null;
  private compositeScene: ThreeScene | null = null;
  private compositeCamera: OrthographicCamera | null = null;
  private compositeMaterial: ShaderMaterial | null = null;

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
    this.baseParams = { ...values };
    if (this.scene && isParameterizedScene(this.scene)) {
      this.scene.setParams(values);
    }
  }

  setBandMappings(mappings: BandMapping[]): void {
    this.bandMapper.setMappings(mappings);
  }

  setTransition(effect: string, duration: number): void {
    this.transitionEngine.setTransition(effect, duration);
  }

  getEffectsLayer(): EffectsLayer {
    return this.effectsLayer;
  }

  setEffectsSettings(settings: Partial<EffectsSettings>): void {
    this.effectsLayer.setSettings(settings);
  }

  // --- Compositing: overlay a second scene ---

  private ensureCompositeResources(): void {
    if (this.primaryRT) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const opts = { minFilter: LinearFilter, magFilter: LinearFilter };
    this.primaryRT = new WebGLRenderTarget(w, h, opts);
    this.overlayRT = new WebGLRenderTarget(w, h, opts);

    this.compositeMaterial = new ShaderMaterial({
      vertexShader: COMPOSITE_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      uniforms: {
        tBase: { value: null },
        tOverlay: { value: null },
        uOpacity: { value: 0.5 },
        uBlendMode: { value: 0 },
      },
    });

    const mesh = new Mesh(new PlaneGeometry(2, 2), this.compositeMaterial);
    this.compositeScene = new ThreeScene();
    this.compositeScene.add(mesh);
    this.compositeCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setOverlayScene(name: string, sceneManager: SceneManager): void {
    // Clear existing overlay
    this.clearOverlayScene();

    this.ensureCompositeResources();

    const scene = sceneManager.create(name);
    scene.init(this.renderer);
    scene.resize(window.innerWidth, window.innerHeight);
    this.overlayScene = scene;
    this.overlaySceneName = name;
  }

  clearOverlayScene(): void {
    this.overlayScene?.dispose();
    this.overlayScene = null;
    this.overlaySceneName = null;
  }

  setOverlayOpacity(opacity: number): void {
    this.overlayOpacity = Math.max(0, Math.min(1, opacity));
  }

  setBlendMode(mode: string): void {
    const index = BLEND_MODES[mode];
    if (index !== undefined) this.overlayBlendMode = index;
  }

  getOverlaySceneName(): string | null {
    return this.overlaySceneName;
  }

  setOverlayParams(values: ParamValues): void {
    if (this.overlayScene && isParameterizedScene(this.overlayScene)) {
      this.overlayScene.setParams(values);
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
    this.overlayScene?.dispose();
    this.transitionEngine.dispose();
    this.effectsLayer.dispose();
    this.primaryRT?.dispose();
    this.overlayRT?.dispose();
    this.compositeMaterial?.dispose();
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
      kick: rawAudio.kick * intensity,
      beatIntensity: rawAudio.beatIntensity * intensity,
      spectralFlux: rawAudio.spectralFlux * intensity,
      bands: rawAudio.bands,
      pitch: rawAudio.pitch,
    };

    // Apply band→param modulation to active scene
    if (this.scene && isParameterizedScene(this.scene) && Object.keys(this.baseParams).length > 0) {
      const modulated = this.bandMapper.apply(this.baseParams, audio.bands, this.scene.params);
      this.scene.setParams(modulated);
    }

    const hasOverlay = this.overlayScene !== null && this.primaryRT && this.overlayRT;

    if (hasOverlay) {
      // --- Compositing path: render primary + overlay to RTs, then blend ---

      // Render primary scene (or transition) to primaryRT
      if (this.transitionEngine.isTransitioning) {
        this.transitionEngine.update(time, audio, this.primaryRT);
      } else {
        this.renderer.setRenderTarget(this.primaryRT);
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.clear();
        this.scene?.update(time, audio);
      }

      // Render overlay to overlayRT
      this.renderer.setRenderTarget(this.overlayRT);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      this.overlayScene!.update(time, audio);

      // Composite both to screen
      this.renderer.setRenderTarget(null);
      this.compositeMaterial!.uniforms.tBase!.value = this.primaryRT!.texture;
      this.compositeMaterial!.uniforms.tOverlay!.value = this.overlayRT!.texture;
      this.compositeMaterial!.uniforms.uOpacity!.value = this.overlayOpacity;
      this.compositeMaterial!.uniforms.uBlendMode!.value = this.overlayBlendMode;
      this.renderer.render(this.compositeScene!, this.compositeCamera!);
    } else {
      // --- Normal path (no overlay) ---
      if (this.transitionEngine.isTransitioning) {
        this.transitionEngine.update(time, audio);
      } else {
        this.scene?.update(time, audio);
      }
    }

    this.effectsLayer.update();
  };

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.scene?.resize(w, h);
    this.overlayScene?.resize(w, h);
    this.transitionEngine.resize(w, h);
    this.primaryRT?.setSize(w, h);
    this.overlayRT?.setSize(w, h);
  };
}
