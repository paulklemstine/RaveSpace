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
import type { Scene } from "../types/scene";
import type { AudioFeatures } from "../types/audio";
import vertexShader from "../shaders/fullscreen.vert";
import fragmentShader from "../shaders/plasma.frag";

interface PlasmaUniforms extends Record<string, IUniform> {
  uTime: IUniform<number>;
  uEnergy: IUniform<number>;
  uBass: IUniform<number>;
  uMid: IUniform<number>;
  uTreble: IUniform<number>;
  uResolution: IUniform<Vector2>;
}

export class PlasmaShader implements Scene {
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
      uResolution: { value: new Vector2(1, 1) },
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
}
