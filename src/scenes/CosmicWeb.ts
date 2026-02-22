import {
  Scene as ThreeScene,
  OrthographicCamera,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  type WebGLRenderer,
} from "three";
import type { ParameterizedScene } from "../types/scene";
import type { AudioFeatures } from "../types/audio";
import type { ParamDescriptor, ParamValues } from "../types/params";
import { SCENE_REGISTRY } from "./registry";
import vertexShader from "../shaders/fullscreen.vert";
import fragmentShader from "../shaders/cosmicweb.frag";

const METADATA = SCENE_REGISTRY.find((s) => s.id === "cosmicweb")!;

export class CosmicWeb implements ParameterizedScene {
  readonly params: readonly ParamDescriptor[] = METADATA.params;

  private threeScene = new ThreeScene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private renderer: WebGLRenderer | null = null;
  private mesh: Mesh;
  private material: ShaderMaterial;
  private uniforms: Record<string, { value: unknown }>;

  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
      uSpeed: { value: 1.0 },
      uScale: { value: 3.0 },
      uGlow: { value: 1.0 },
      uAudioReactivity: { value: 1.0 },
      uColorShift: { value: 0.0 },
    };
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
    });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.threeScene.add(this.mesh);
  }

  init(renderer: WebGLRenderer): void {
    this.renderer = renderer;
    const size = renderer.getSize(new Vector2());
    this.uniforms.uResolution.value = size;
  }

  update(time: number, audio: AudioFeatures): void {
    this.uniforms.uTime.value = time;
    this.uniforms.uEnergy.value = audio.energy;
    this.uniforms.uBass.value = audio.bass;
    this.uniforms.uMid.value = audio.mid;
    this.uniforms.uTreble.value = audio.treble;
    this.renderer!.render(this.threeScene, this.camera);
  }

  resize(width: number, height: number): void {
    this.uniforms.uResolution.value = new Vector2(width, height);
  }

  setParams(values: ParamValues): void {
    if (values.speed !== undefined) this.uniforms.uSpeed.value = values.speed as number;
    if (values.scale !== undefined) this.uniforms.uScale.value = values.scale as number;
    if (values.glow !== undefined) this.uniforms.uGlow.value = values.glow as number;
    if (values.audioReactivity !== undefined) this.uniforms.uAudioReactivity.value = values.audioReactivity as number;
    if (values.colorShift !== undefined) this.uniforms.uColorShift.value = values.colorShift as number;
  }

  getParams(): ParamValues {
    return {
      speed: this.uniforms.uSpeed.value as number,
      scale: this.uniforms.uScale.value as number,
      glow: this.uniforms.uGlow.value as number,
      audioReactivity: this.uniforms.uAudioReactivity.value as number,
      colorShift: this.uniforms.uColorShift.value as number,
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
