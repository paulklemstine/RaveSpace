import {
  PerspectiveCamera,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  Scene as ThreeScene,
  Color,
  Vector3,
} from "three";
import type { WebGLRenderer } from "three";
import type { ParameterizedScene } from "../types/scene";
import type { AudioFeatures } from "../types/audio";
import type { ParamDescriptor, ParamValues } from "../types/params";
import { SCENE_REGISTRY } from "./registry";

const PALETTES: Record<string, [Color, Color, Color]> = {
  neon: [new Color(1, 0, 0.5), new Color(0, 1, 0.8), new Color(0.2, 0.3, 1)],
  sunset: [new Color(1, 0.3, 0), new Color(1, 0.6, 0), new Color(0.8, 0, 0.4)],
  ocean: [new Color(0, 0.3, 1), new Color(0, 0.8, 0.8), new Color(0.1, 0.1, 0.6)],
  monochrome: [new Color(1, 1, 1), new Color(0.6, 0.6, 0.6), new Color(0.3, 0.3, 0.3)],
};

const VERTEX_SHADER = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute vec3 aOrigPos;

  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uBeat;
  uniform float uKick;
  uniform float uBeatIntensity;
  uniform float uSpectralFlux;
  uniform float uAudioReactivity;
  uniform float uSpread;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    // Radial pulse: kick for sharp punch + bass for sustain
    vec3 pos = aOrigPos;
    float dist = length(pos);
    float kickPulse = 1.0 + uKick * 0.6 * uAudioReactivity + uBass * 0.2 * uAudioReactivity;
    pos *= kickPulse;

    // Beat explosion burst — proportional to beat intensity
    float burst = uBeat * (1.0 + uBeatIntensity * 2.0) * uAudioReactivity;
    pos += normalize(pos) * burst;

    // Flux jitter: transients displace particles
    pos += normalize(pos) * uSpectralFlux * 0.3 * uAudioReactivity;

    // Mid-frequency color shift is handled in fragment
    // Treble size oscillation
    float sizeOsc = 1.0 + uTreble * sin(uTime * 8.0 + dist * 2.0) * 0.5 * uAudioReactivity;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * sizeOsc * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // Fade with distance
    vAlpha = smoothstep(uSpread * 2.0, 0.0, dist) * (0.5 + uEnergy * 0.5 * uAudioReactivity);
  }
`;

const FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Circular point shape
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;

    float alpha = vAlpha * (1.0 - d * d);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const METADATA = SCENE_REGISTRY.find((s) => s.id === "particles")!;

export class ParticleField implements ParameterizedScene {
  readonly params: readonly ParamDescriptor[] = METADATA.params;

  private camera: PerspectiveCamera;
  private threeScene = new ThreeScene();
  private points: Points | null = null;
  private geometry: BufferGeometry | null = null;
  private material: ShaderMaterial | null = null;
  private renderer: WebGLRenderer | null = null;
  private orbitAngle = 0;

  // Current param values
  private particleCount = 10000;
  private particleSize = 2.0;
  private orbitSpeed = 0.5;
  private spread = 8.0;
  private audioReactivity = 1.0;
  private colorPalette = "neon";
  private beatDecay = 0;

  constructor() {
    this.camera = new PerspectiveCamera(60, 1, 0.1, 100);
    this.camera.position.set(0, 0, 15);
  }

  init(renderer: WebGLRenderer): void {
    this.renderer = renderer;
    this.buildParticles();
  }

  update(time: number, audio: AudioFeatures): void {
    if (!this.material || !this.points) return;

    // Beat decay — proportional to beat intensity
    this.beatDecay = Math.max(this.beatDecay, audio.beatIntensity);
    this.beatDecay *= 0.92;

    // Update uniforms
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uBass!.value = audio.bass;
    this.material.uniforms.uMid!.value = audio.mid;
    this.material.uniforms.uTreble!.value = audio.treble;
    this.material.uniforms.uEnergy!.value = audio.energy;
    this.material.uniforms.uBeat!.value = this.beatDecay;
    this.material.uniforms.uKick!.value = audio.kick;
    this.material.uniforms.uBeatIntensity!.value = audio.beatIntensity;
    this.material.uniforms.uSpectralFlux!.value = audio.spectralFlux;
    this.material.uniforms.uAudioReactivity!.value = this.audioReactivity;
    this.material.uniforms.uSpread!.value = this.spread;

    // Camera orbit — kick adds burst to orbit speed
    this.orbitAngle += this.orbitSpeed * 0.005 * (1.0 + audio.energy * this.audioReactivity + audio.kick * 0.5);
    const r = 15;
    this.camera.position.set(
      Math.cos(this.orbitAngle) * r,
      Math.sin(this.orbitAngle * 0.3) * 3,
      Math.sin(this.orbitAngle) * r,
    );
    this.camera.lookAt(0, 0, 0);

    this.renderer!.render(this.threeScene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.geometry?.dispose();
    this.material?.dispose();
    if (this.points) this.threeScene.remove(this.points);
  }

  setParams(values: ParamValues): void {
    let needsRebuild = false;

    if (values.count !== undefined) {
      const newCount = (values.count as number) * 1000;
      if (newCount !== this.particleCount) {
        this.particleCount = newCount;
        needsRebuild = true;
      }
    }
    if (values.size !== undefined) {
      this.particleSize = values.size as number;
      needsRebuild = true;
    }
    if (values.orbitSpeed !== undefined) this.orbitSpeed = values.orbitSpeed as number;
    if (values.spread !== undefined) {
      this.spread = values.spread as number;
      needsRebuild = true;
    }
    if (values.audioReactivity !== undefined) this.audioReactivity = values.audioReactivity as number;
    if (values.colorPalette !== undefined) {
      this.colorPalette = values.colorPalette as string;
      needsRebuild = true;
    }

    if (needsRebuild && this.renderer) {
      this.buildParticles();
    }
  }

  getParams(): ParamValues {
    return {
      count: this.particleCount / 1000,
      size: this.particleSize,
      orbitSpeed: this.orbitSpeed,
      spread: this.spread,
      audioReactivity: this.audioReactivity,
      colorPalette: this.colorPalette,
    };
  }

  private buildParticles(): void {
    // Clean up old
    if (this.points) {
      this.threeScene.remove(this.points);
      this.geometry?.dispose();
      this.material?.dispose();
    }

    const count = this.particleCount;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const origPositions = new Float32Array(count * 3);

    const palette = PALETTES[this.colorPalette] ?? PALETTES.neon!;
    const tmpColor = new Color();
    const tmpVec = new Vector3();

    for (let i = 0; i < count; i++) {
      // Spherical distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.pow(Math.random(), 0.5) * this.spread;

      tmpVec.setFromSphericalCoords(r, phi, theta);
      positions[i * 3] = tmpVec.x;
      positions[i * 3 + 1] = tmpVec.y;
      positions[i * 3 + 2] = tmpVec.z;
      origPositions[i * 3] = tmpVec.x;
      origPositions[i * 3 + 1] = tmpVec.y;
      origPositions[i * 3 + 2] = tmpVec.z;

      // Random color from palette
      const ci = Math.floor(Math.random() * 3);
      const paletteColor = palette[ci]!;
      tmpColor.copy(paletteColor);
      // Slight variation
      tmpColor.r += (Math.random() - 0.5) * 0.2;
      tmpColor.g += (Math.random() - 0.5) * 0.2;
      tmpColor.b += (Math.random() - 0.5) * 0.2;
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;

      sizes[i] = this.particleSize * (0.5 + Math.random());
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute("aColor", new Float32BufferAttribute(colors, 3));
    this.geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
    this.geometry.setAttribute("aOrigPos", new Float32BufferAttribute(origPositions, 3));

    this.material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uEnergy: { value: 0 },
        uBeat: { value: 0 },
        uKick: { value: 0 },
        uBeatIntensity: { value: 0 },
        uSpectralFlux: { value: 0 },
        uAudioReactivity: { value: this.audioReactivity },
        uSpread: { value: this.spread },
      },
    });

    this.points = new Points(this.geometry, this.material);
    this.threeScene.add(this.points);
  }
}
