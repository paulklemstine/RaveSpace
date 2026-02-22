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
import type { ParamDescriptor, ParamValues, SelectParam } from "../types/params";
import { SCENE_REGISTRY } from "./registry";

const FULLSCREEN_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Standard audio + resolution uniforms auto-prepended to every fragment shader */
const AUDIO_UNIFORMS_HEADER = `precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uKick;
uniform float uBeatIntensity;
uniform float uSpectralFlux;
uniform float uSpectralCentroid;
uniform float uBeat;
uniform float uBpm;
uniform vec2 uResolution;
uniform float uBands[16];
uniform float uPitch;
uniform float uPitchConfidence;

`;

function paramKeyToUniformName(key: string): string {
  return "u" + key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Base class for fullscreen-quad shader scenes.
 * Handles all boilerplate: Three.js setup, audio uniform binding,
 * resize, dispose, and automatic param↔uniform mapping.
 *
 * Subclasses just provide: sceneId (matches registry) + GLSL fragment body.
 * The fragment body should NOT include precision, varyings, or audio uniforms —
 * those are auto-prepended. Param uniforms are also auto-declared from the registry.
 */
export class ShaderSceneBase implements ParameterizedScene {
  readonly params: readonly ParamDescriptor[];

  protected camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  protected threeScene = new ThreeScene();
  protected material: ShaderMaterial;
  protected uniforms: Record<string, IUniform>;
  protected mesh: Mesh;
  protected renderer: WebGLRenderer | null = null;

  constructor(sceneId: string, fragmentBody: string) {
    const metadata = SCENE_REGISTRY.find((s) => s.id === sceneId);
    this.params = metadata?.params ?? [];

    // Build uniforms: audio + resolution + EQ bands + pitch
    this.uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uKick: { value: 0 },
      uBeatIntensity: { value: 0 },
      uSpectralFlux: { value: 0 },
      uSpectralCentroid: { value: 0 },
      uBeat: { value: 0 },
      uBpm: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
      uBands: { value: new Float32Array(16) },
      uPitch: { value: 0 },
      uPitchConfidence: { value: 0 },
    };

    // Auto-create uniforms + GLSL declarations from param descriptors
    let paramDeclarations = "";
    for (const param of this.params) {
      const uName = paramKeyToUniformName(param.key);
      switch (param.type) {
        case "number":
          this.uniforms[uName] = { value: param.default };
          paramDeclarations += `uniform float ${uName};\n`;
          break;
        case "boolean":
          this.uniforms[uName] = { value: param.default ? 1.0 : 0.0 };
          paramDeclarations += `uniform float ${uName};\n`;
          break;
        case "select":
          this.uniforms[uName] = { value: param.options.indexOf(param.default) };
          paramDeclarations += `uniform int ${uName};\n`;
          break;
        case "color":
          this.uniforms[uName] = { value: 0.0 };
          paramDeclarations += `uniform float ${uName};\n`;
          break;
      }
    }

    const fragmentShader =
      AUDIO_UNIFORMS_HEADER +
      "// Scene params\n" +
      paramDeclarations +
      "\n" +
      fragmentBody;

    this.material = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
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
    this.uniforms.uSpectralCentroid.value = audio.spectralCentroid;
    this.uniforms.uBeat.value = audio.beat ? 1.0 : 0.0;
    this.uniforms.uBpm.value = audio.bpm;
    (this.uniforms.uBands.value as Float32Array).set(audio.bands);
    this.uniforms.uPitch.value = audio.pitch.frequency;
    this.uniforms.uPitchConfidence.value = audio.pitch.confidence;
    this.renderer!.render(this.threeScene, this.camera);
  }

  resize(width: number, height: number): void {
    (this.uniforms.uResolution.value as Vector2).set(width, height);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  setParams(values: ParamValues): void {
    for (const param of this.params) {
      if (values[param.key] === undefined) continue;
      const uName = paramKeyToUniformName(param.key);
      const u = this.uniforms[uName];
      if (!u) continue;
      switch (param.type) {
        case "number":
          u.value = values[param.key] as number;
          break;
        case "boolean":
          u.value = (values[param.key] as boolean) ? 1.0 : 0.0;
          break;
        case "select":
          u.value = (param as SelectParam).options.indexOf(
            values[param.key] as string,
          );
          break;
      }
    }
  }

  getParams(): ParamValues {
    const result: ParamValues = {};
    for (const param of this.params) {
      const uName = paramKeyToUniformName(param.key);
      const u = this.uniforms[uName];
      if (!u) continue;
      switch (param.type) {
        case "number":
          result[param.key] = u.value;
          break;
        case "boolean":
          result[param.key] = u.value > 0.5;
          break;
        case "select":
          result[param.key] =
            (param as SelectParam).options[u.value] ??
            (param as SelectParam).default;
          break;
      }
    }
    return result;
  }
}
