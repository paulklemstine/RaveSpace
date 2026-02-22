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
import fragmentShader from "../shaders/plasma.frag";

interface PlasmaUniforms extends Record<string, IUniform> {
  uTime: IUniform<number>;
  uEnergy: IUniform<number>;
  uBass: IUniform<number>;
  uMid: IUniform<number>;
  uTreble: IUniform<number>;
  uKick: IUniform<number>;
  uBeatIntensity: IUniform<number>;
  uSpectralFlux: IUniform<number>;
  uResolution: IUniform<Vector2>;
  uSpeed: IUniform<number>;
  uTunnelIntensity: IUniform<number>;
  uColorShift: IUniform<number>;
  uAudioReactivity: IUniform<number>;
  uVignette: IUniform<number>;
}

const METADATA = SCENE_REGISTRY.find((s) => s.id === "plasma")!;

export class PlasmaShader implements ParameterizedScene {
  readonly params: readonly ParamDescriptor[] = METADATA.params;

  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private threeScene = new ThreeScene();
  private material: ShaderMaterial;
  private uniforms: PlasmaUniforms;
  private mesh: Mesh;
  private renderer: WebGLRenderer | null = null;

  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uKick: { value: 0 },
      uBeatIntensity: { value: 0 },
      uSpectralFlux: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
      uSpeed: { value: 1.0 },
      uTunnelIntensity: { value: 1.0 },
      uColorShift: { value: 0.0 },
      uAudioReactivity: { value: 1.0 },
      uVignette: { value: 1.0 },
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
    this.uniforms.uKick.value = audio.kick;
    this.uniforms.uBeatIntensity.value = audio.beatIntensity;
    this.uniforms.uSpectralFlux.value = audio.spectralFlux;
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
    if (values.tunnelIntensity !== undefined) this.uniforms.uTunnelIntensity.value = values.tunnelIntensity as number;
    if (values.colorShift !== undefined) this.uniforms.uColorShift.value = values.colorShift as number;
    if (values.audioReactivity !== undefined) this.uniforms.uAudioReactivity.value = values.audioReactivity as number;
    if (values.vignette !== undefined) this.uniforms.uVignette.value = (values.vignette as boolean) ? 1.0 : 0.0;
  }

  getParams(): ParamValues {
    return {
      speed: this.uniforms.uSpeed.value,
      tunnelIntensity: this.uniforms.uTunnelIntensity.value,
      colorShift: this.uniforms.uColorShift.value,
      audioReactivity: this.uniforms.uAudioReactivity.value,
      vignette: this.uniforms.uVignette.value > 0.5,
    };
  }
}
