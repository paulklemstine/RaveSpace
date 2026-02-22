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

/** Max overlay layers on top of the primary scene (4 total layers) */
const MAX_OVERLAYS = 3;

interface OverlayLayer {
  scene: Scene;
  sceneName: string;
  opacity: number;
  blendMode: number;
}

const COMPOSITE_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** 4-layer composite shader: base + up to 3 overlays */
const COMPOSITE_FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tBase;
uniform sampler2D tOverlay0;
uniform sampler2D tOverlay1;
uniform sampler2D tOverlay2;
uniform float uOpacity0;
uniform float uOpacity1;
uniform float uOpacity2;
uniform int uBlendMode0;
uniform int uBlendMode1;
uniform int uBlendMode2;
uniform int uLayerCount;

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

vec3 applyBlend(vec3 base, vec3 over, int mode) {
  if (mode == 0) return blendAdditive(base, over);
  else if (mode == 1) return blendScreen(base, over);
  else if (mode == 2) return blendMultiply(base, over);
  else if (mode == 3) return blendOverlay(base, over);
  else return blendDifference(base, over);
}

void main() {
  vec3 color = texture2D(tBase, vUv).rgb;

  if (uLayerCount > 0) {
    vec3 o0 = texture2D(tOverlay0, vUv).rgb;
    vec3 b0 = applyBlend(color, o0, uBlendMode0);
    color = mix(color, b0, uOpacity0);
  }
  if (uLayerCount > 1) {
    vec3 o1 = texture2D(tOverlay1, vUv).rgb;
    vec3 b1 = applyBlend(color, o1, uBlendMode1);
    color = mix(color, b1, uOpacity1);
  }
  if (uLayerCount > 2) {
    vec3 o2 = texture2D(tOverlay2, vUv).rgb;
    vec3 b2 = applyBlend(color, o2, uBlendMode2);
    color = mix(color, b2, uOpacity2);
  }

  gl_FragColor = vec4(color, 1.0);
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

  // 4-layer compositing: primary + up to 3 overlays
  private overlayLayers: OverlayLayer[] = [];
  private primaryRT: WebGLRenderTarget | null = null;
  private overlayRTs: WebGLRenderTarget[] = [];
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

  // --- 4-layer compositing ---

  private ensureCompositeResources(): void {
    if (this.primaryRT) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const opts = { minFilter: LinearFilter, magFilter: LinearFilter };
    this.primaryRT = new WebGLRenderTarget(w, h, opts);

    for (let i = 0; i < MAX_OVERLAYS; i++) {
      this.overlayRTs.push(new WebGLRenderTarget(w, h, opts));
    }

    this.compositeMaterial = new ShaderMaterial({
      vertexShader: COMPOSITE_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      uniforms: {
        tBase: { value: null },
        tOverlay0: { value: null },
        tOverlay1: { value: null },
        tOverlay2: { value: null },
        uOpacity0: { value: 0 },
        uOpacity1: { value: 0 },
        uOpacity2: { value: 0 },
        uBlendMode0: { value: 0 },
        uBlendMode1: { value: 0 },
        uBlendMode2: { value: 0 },
        uLayerCount: { value: 0 },
      },
    });

    const mesh = new Mesh(new PlaneGeometry(2, 2), this.compositeMaterial);
    this.compositeScene = new ThreeScene();
    this.compositeScene.add(mesh);
    this.compositeCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** Set an overlay layer (index 0-2). Up to 3 overlays on top of the primary scene. */
  setOverlayLayer(
    index: number,
    name: string,
    sceneManager: SceneManager,
    blendMode = "screen",
    opacity = 0.3,
  ): void {
    if (index < 0 || index >= MAX_OVERLAYS) return;

    this.ensureCompositeResources();

    // Dispose existing layer at this index
    this.clearOverlayLayer(index);

    const scene = sceneManager.create(name);
    scene.init(this.renderer);
    scene.resize(window.innerWidth, window.innerHeight);

    const layer: OverlayLayer = {
      scene,
      sceneName: name,
      opacity: Math.max(0, Math.min(1, opacity)),
      blendMode: BLEND_MODES[blendMode] ?? 0,
    };

    // Ensure array is long enough
    while (this.overlayLayers.length <= index) {
      this.overlayLayers.push(undefined as unknown as OverlayLayer);
    }
    this.overlayLayers[index] = layer;
  }

  /** Clear a specific overlay layer */
  clearOverlayLayer(index: number): void {
    if (index < 0 || index >= MAX_OVERLAYS) return;
    const layer = this.overlayLayers[index];
    if (layer) {
      layer.scene.dispose();
      this.overlayLayers[index] = undefined as unknown as OverlayLayer;
    }
  }

  /** Clear all overlay layers */
  clearAllOverlays(): void {
    for (let i = 0; i < MAX_OVERLAYS; i++) {
      this.clearOverlayLayer(i);
    }
    this.overlayLayers = [];
  }

  /** Update opacity for an overlay layer */
  setOverlayLayerOpacity(index: number, opacity: number): void {
    const layer = this.overlayLayers[index];
    if (layer) layer.opacity = Math.max(0, Math.min(1, opacity));
  }

  /** Update blend mode for an overlay layer */
  setOverlayLayerBlendMode(index: number, mode: string): void {
    const layer = this.overlayLayers[index];
    const modeIndex = BLEND_MODES[mode];
    if (layer && modeIndex !== undefined) layer.blendMode = modeIndex;
  }

  /** Get the scene name for an overlay layer */
  getOverlayLayerName(index: number): string | null {
    return this.overlayLayers[index]?.sceneName ?? null;
  }

  /** Get count of active overlay layers */
  getActiveOverlayCount(): number {
    return this.overlayLayers.filter((l) => l != null).length;
  }

  // --- Backward-compatible single-overlay API ---

  setOverlayScene(name: string, sceneManager: SceneManager): void {
    this.setOverlayLayer(0, name, sceneManager);
  }

  clearOverlayScene(): void {
    this.clearAllOverlays();
  }

  setOverlayOpacity(opacity: number): void {
    this.setOverlayLayerOpacity(0, opacity);
  }

  setBlendMode(mode: string): void {
    this.setOverlayLayerBlendMode(0, mode);
  }

  getOverlaySceneName(): string | null {
    return this.getOverlayLayerName(0);
  }

  setOverlayParams(values: ParamValues): void {
    const layer = this.overlayLayers[0];
    if (layer && isParameterizedScene(layer.scene)) {
      layer.scene.setParams(values);
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
    this.clearAllOverlays();
    this.transitionEngine.dispose();
    this.effectsLayer.dispose();
    this.primaryRT?.dispose();
    for (const rt of this.overlayRTs) rt.dispose();
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
      const rawAudioForStrobe =
        this.audioAnalyzer?.getFeatures() ?? SILENT_AUDIO;
      const strobeInterval = this.effectsLayer.getStrobeInterval(
        rawAudioForStrobe.bpm,
      );
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
    if (
      this.scene &&
      isParameterizedScene(this.scene) &&
      Object.keys(this.baseParams).length > 0
    ) {
      const modulated = this.bandMapper.apply(
        this.baseParams,
        audio.bands,
        this.scene.params,
      );
      this.scene.setParams(modulated);
    }

    // Count active overlay layers
    const activeOverlays = this.overlayLayers.filter((l) => l != null);
    const hasOverlays = activeOverlays.length > 0 && this.primaryRT;

    if (hasOverlays) {
      // --- 4-layer compositing path ---

      // Render primary scene (or transition) to primaryRT
      if (this.transitionEngine.isTransitioning) {
        this.transitionEngine.update(time, audio, this.primaryRT);
      } else {
        this.renderer.setRenderTarget(this.primaryRT);
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.clear();
        this.scene?.update(time, audio);
      }

      // Render each active overlay to its RT
      let overlayCount = 0;
      for (let i = 0; i < MAX_OVERLAYS; i++) {
        const layer = this.overlayLayers[i];
        if (!layer) continue;

        const rt = this.overlayRTs[overlayCount];
        if (!rt) break;

        this.renderer.setRenderTarget(rt);
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.clear();
        layer.scene.update(time, audio);

        // Set composite uniforms for this layer
        const u = this.compositeMaterial!.uniforms;
        u[`tOverlay${overlayCount}`]!.value = rt.texture;
        u[`uOpacity${overlayCount}`]!.value = layer.opacity;
        u[`uBlendMode${overlayCount}`]!.value = layer.blendMode;

        overlayCount++;
      }

      // Composite all layers to screen
      this.renderer.setRenderTarget(null);
      const u = this.compositeMaterial!.uniforms;
      u.tBase!.value = this.primaryRT!.texture;
      u.uLayerCount!.value = overlayCount;
      this.renderer.render(this.compositeScene!, this.compositeCamera!);
    } else {
      // --- Normal path (no overlays) ---
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
    for (const layer of this.overlayLayers) {
      layer?.scene.resize(w, h);
    }
    this.transitionEngine.resize(w, h);
    this.primaryRT?.setSize(w, h);
    for (const rt of this.overlayRTs) {
      rt.setSize(w, h);
    }
  };
}
