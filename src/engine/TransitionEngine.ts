import {
  WebGLRenderTarget,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Scene as ThreeScene,
  LinearFilter,
} from "three";
import type { WebGLRenderer } from "three";
import type { Scene } from "../types/scene";
import type { AudioFeatures } from "../types/audio";
import { getTransition, buildTransitionFragmentShader } from "./transitions";

const COMPOSITE_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const DEFAULT_TRANSITION = "fade";

type TransitionState = "idle" | "transitioning";

export class TransitionEngine {
  private renderer: WebGLRenderer;
  private targetA: WebGLRenderTarget;
  private targetB: WebGLRenderTarget;
  private compositeScene: ThreeScene;
  private compositeCamera: OrthographicCamera;
  private compositeMesh: Mesh;
  private compositeMaterial: ShaderMaterial;

  private state: TransitionState = "idle";
  private oldScene: Scene | null = null;
  private newScene: Scene | null = null;
  private progress = 0;
  private duration = 3; // seconds
  private startTime = 0;
  private onComplete: (() => void) | null = null;

  private currentTransitionName = DEFAULT_TRANSITION;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    const w = window.innerWidth;
    const h = window.innerHeight;

    const targetOpts = { minFilter: LinearFilter, magFilter: LinearFilter };
    this.targetA = new WebGLRenderTarget(w, h, targetOpts);
    this.targetB = new WebGLRenderTarget(w, h, targetOpts);

    // Build default composite shader
    const def = getTransition(DEFAULT_TRANSITION);
    const fragShader = buildTransitionFragmentShader(def?.glsl ?? "vec4 transition(vec2 uv) { return mix(getFromColor(uv), getToColor(uv), progress); }");

    this.compositeMaterial = new ShaderMaterial({
      vertexShader: COMPOSITE_VERTEX,
      fragmentShader: fragShader,
      uniforms: {
        tFrom: { value: this.targetA.texture },
        tTo: { value: this.targetB.texture },
        progress: { value: 0 },
        ratio: { value: w / h },
      },
    });

    this.compositeMesh = new Mesh(new PlaneGeometry(2, 2), this.compositeMaterial);
    this.compositeScene = new ThreeScene();
    this.compositeScene.add(this.compositeMesh);
    this.compositeCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  get isTransitioning(): boolean {
    return this.state === "transitioning";
  }

  setTransition(name: string, duration: number): void {
    this.currentTransitionName = name;
    this.duration = duration;

    const def = getTransition(name);
    if (!def) {
      console.warn(`Transition "${name}" not found, keeping current`);
      return;
    }

    const fragShader = buildTransitionFragmentShader(def.glsl);
    this.compositeMaterial.fragmentShader = fragShader;
    this.compositeMaterial.needsUpdate = true;
  }

  start(
    oldScene: Scene,
    newScene: Scene,
    onComplete: () => void,
  ): void {
    this.oldScene = oldScene;
    this.newScene = newScene;
    this.onComplete = onComplete;
    this.progress = 0;
    this.startTime = -1; // will be set on first update
    this.state = "transitioning";

    // Init the new scene with the renderer
    newScene.init(this.renderer);
    newScene.resize(this.targetB.width, this.targetB.height);
  }

  update(time: number, audio: AudioFeatures): void {
    if (this.state !== "transitioning" || !this.oldScene || !this.newScene) return;

    // Set start time on first frame
    if (this.startTime < 0) this.startTime = time;

    const elapsed = time - this.startTime;
    const t = Math.min(elapsed / this.duration, 1);
    // Smoothstep easing
    this.progress = t * t * (3 - 2 * t);

    // Render old scene to targetA
    this.renderer.setRenderTarget(this.targetA);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear();
    this.oldScene.update(time, audio);

    // Render new scene to targetB
    this.renderer.setRenderTarget(this.targetB);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear();
    this.newScene.update(time, audio);

    // Composite to screen
    this.renderer.setRenderTarget(null);
    this.compositeMaterial.uniforms.tFrom!.value = this.targetA.texture;
    this.compositeMaterial.uniforms.tTo!.value = this.targetB.texture;
    this.compositeMaterial.uniforms.progress!.value = this.progress;
    this.renderer.render(this.compositeScene, this.compositeCamera);

    // Complete transition
    if (t >= 1) {
      this.state = "idle";
      this.oldScene.dispose();
      this.oldScene = null;
      const complete = this.onComplete;
      this.onComplete = null;
      complete?.();
    }
  }

  resize(width: number, height: number): void {
    this.targetA.setSize(width, height);
    this.targetB.setSize(width, height);
    this.compositeMaterial.uniforms.ratio!.value = width / height;

    if (this.oldScene) this.oldScene.resize(width, height);
    if (this.newScene) this.newScene.resize(width, height);
  }

  dispose(): void {
    this.targetA.dispose();
    this.targetB.dispose();
    this.compositeMaterial.dispose();
    this.compositeMesh.geometry.dispose();
    this.oldScene?.dispose();
    this.oldScene = null;
    this.newScene = null;
  }
}
