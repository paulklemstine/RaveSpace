import type { ParamDescriptor } from "../types/params";

export interface SceneMetadata {
  id: string;
  displayName: string;
  params: readonly ParamDescriptor[];
}

export const SCENE_REGISTRY: readonly SceneMetadata[] = [
  {
    id: "plasma",
    displayName: "Plasma Shader",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "tunnelIntensity", label: "Tunnel Depth", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "colorShift", label: "Color Shift", min: 0.0, max: 1.0, step: 0.01, default: 0.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "boolean", key: "vignette", label: "Vignette", default: true },
    ],
  },
  {
    id: "particles",
    displayName: "Particle Field",
    params: [
      { type: "number", key: "count", label: "Count (K)", min: 1, max: 50, step: 1, default: 10 },
      { type: "number", key: "size", label: "Size", min: 0.5, max: 5.0, step: 0.1, default: 2.0 },
      { type: "number", key: "orbitSpeed", label: "Orbit Speed", min: 0.0, max: 3.0, step: 0.1, default: 0.5 },
      { type: "number", key: "spread", label: "Spread", min: 1.0, max: 20.0, step: 0.5, default: 8.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorPalette", label: "Color Palette", options: ["neon", "sunset", "ocean", "monochrome"], default: "neon" },
    ],
  },
  {
    id: "tunnel",
    displayName: "Tunnel",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "radius", label: "Radius", min: 0.2, max: 2.0, step: 0.1, default: 0.8 },
      { type: "number", key: "twist", label: "Twist", min: 0.0, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "glowIntensity", label: "Glow", min: 0.0, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Color Scheme", options: ["fire", "ice", "toxic", "rainbow"], default: "fire" },
    ],
  },
  {
    id: "sacredgeometry",
    displayName: "Sacred Geometry",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "complexity", label: "Complexity", min: 0.0, max: 1.0, step: 0.1, default: 0.7 },
      { type: "number", key: "symmetry", label: "Symmetry", min: 3.0, max: 12.0, step: 1.0, default: 6.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "colorShift", label: "Color Shift", min: 0.0, max: 1.0, step: 0.01, default: 0.0 },
    ],
  },
  {
    id: "fractal",
    displayName: "Fractal Dreams",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "zoom", label: "Zoom", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "iterations", label: "Detail", min: 0.1, max: 1.0, step: 0.05, default: 0.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "colorShift", label: "Color Shift", min: 0.0, max: 1.0, step: 0.01, default: 0.0 },
      { type: "select", key: "fractalType", label: "Fractal Type", options: ["julia", "mandelbrot"], default: "julia" },
    ],
  },
  {
    id: "kaleidoscope",
    displayName: "Kaleidoscope",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "segments", label: "Segments", min: 3.0, max: 16.0, step: 1.0, default: 8.0 },
      { type: "number", key: "zoom", label: "Zoom", min: 0.2, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "complexity", label: "Complexity", min: 0.0, max: 1.0, step: 0.1, default: 0.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "colorShift", label: "Color Shift", min: 0.0, max: 1.0, step: 0.01, default: 0.0 },
    ],
  },
  {
    id: "cosmicweb",
    displayName: "Cosmic Web",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "scale", label: "Scale", min: 1.0, max: 8.0, step: 0.5, default: 3.0 },
      { type: "number", key: "glow", label: "Glow", min: 0.0, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "colorShift", label: "Color Shift", min: 0.0, max: 1.0, step: 0.01, default: 0.0 },
    ],
  },
  {
    id: "acidwarp",
    displayName: "Acid Warp",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "warpIntensity", label: "Warp Intensity", min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "colorDensity", label: "Color Density", min: 1.0, max: 8.0, step: 0.5, default: 3.0 },
      { type: "number", key: "flowSpeed", label: "Flow Speed", min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "colorShift", label: "Color Shift", min: 0.0, max: 1.0, step: 0.01, default: 0.0 },
    ],
  },
] as const;
