import {
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Scene as ThreeScene,
  Vector2,
  type IUniform,
} from "three";
import type { WebGLRenderer } from "three";
import type { ParameterizedScene } from "../types/scene";
import type { AudioFeatures } from "../types/audio";
import type { ParamDescriptor, ParamValues } from "../types/params";
import { SCENE_REGISTRY } from "./registry";
import vertexShader from "../shaders/fullscreen.vert";
import fragmentShader from "../shaders/sacred-geometry.frag";

const COLOR_SCHEME_MAP: Record<string, number> = {
  neon: 0,
  ethereal: 1,
  golden: 2,
  rainbow: 3,
};

const COLOR_SCHEME_REVERSE = ["neon", "ethereal", "golden", "rainbow"];

interface SacredGeometryUniforms extends Record<string, IUniform> {
  uTime: IUniform<number>;
  uEnergy: IUniform<number>;
  uBass: IUniform<number>;
  uMid: IUniform<number>;
  uTreble: IUniform<number>;
  uResolution: IUniform<Vector2>;
  uSpeed: IUniform<number>;
  uLayers: IUniform<number>;
  uSymmetry: IUniform<number>;
  uAudioReactivity: IUniform<number>;
  uColorScheme: IUniform<number>;
}

const METADATA = SCENE_REGISTRY.find((s) => s.id === "sacredGeometry")!;

export class SacredGeometry implements ParameterizedScene {
  readonly params: readonly ParamDescriptor[] = METADATA.params;

  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private threeScene = new ThreeScene();
  private material: ShaderMaterial;
  private uniforms: SacredGeometryUniforms;
  private mesh: Mesh;
  private renderer: WebGLRenderer | null = null;

  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
      uSpeed: { value: 1.0 },
      uLayers: { value: 4.0 },
      uSymmetry: { value: 6.0 },
      uAudioReactivity: { value: 1.0 },
      uColorScheme: { value: 0 },
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
    this.uniforms.uResolution.value.set(width, height);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  setParams(values: ParamValues): void {
    if (values.speed !== undefined) this.uniforms.uSpeed.value = values.speed as number;
    if (values.layers !== undefined) this.uniforms.uLayers.value = values.layers as number;
    if (values.symmetry !== undefined) this.uniforms.uSymmetry.value = values.symmetry as number;
    if (values.audioReactivity !== undefined) this.uniforms.uAudioReactivity.value = values.audioReactivity as number;
    if (values.colorScheme !== undefined) {
      this.uniforms.uColorScheme.value = COLOR_SCHEME_MAP[values.colorScheme as string] ?? 0;
    }
  }

  getParams(): ParamValues {
    return {
      speed: this.uniforms.uSpeed.value,
      layers: this.uniforms.uLayers.value,
      symmetry: this.uniforms.uSymmetry.value,
      audioReactivity: this.uniforms.uAudioReactivity.value,
      colorScheme: COLOR_SCHEME_REVERSE[this.uniforms.uColorScheme.value] ?? "neon",
    };
  }
}
