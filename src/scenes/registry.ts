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
    displayName: "Neon Tunnel",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "radius", label: "Radius", min: 0.2, max: 2.0, step: 0.1, default: 0.8 },
      { type: "number", key: "twist", label: "Twist", min: 0.0, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "glowIntensity", label: "Glow", min: 0.0, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Color Scheme", options: ["cyber", "dmt", "void", "acid"], default: "cyber" },
    ],
  },
  {
    id: "sacredGeometry",
    displayName: "Sacred Geometry",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "layers", label: "Layers", min: 2, max: 6, step: 1, default: 4 },
      { type: "number", key: "symmetry", label: "Symmetry", min: 3, max: 12, step: 1, default: 6 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["neon", "ethereal", "golden", "rainbow"], default: "neon" },
    ],
  },
  {
    id: "fractalDive",
    displayName: "Fractal Dive",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "iterations", label: "Detail", min: 20, max: 100, step: 5, default: 64 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["electric", "cosmic", "inferno", "psychedelic"], default: "electric" },
    ],
  },
  {
    id: "kaleidoscope",
    displayName: "Kaleidoscope",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "segments", label: "Segments", min: 3, max: 16, step: 1, default: 8 },
      { type: "number", key: "zoom", label: "Zoom", min: 0.5, max: 5.0, step: 0.1, default: 2.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["neon", "crystal", "fire", "spectrum"], default: "neon" },
    ],
  },
  {
    id: "godRays",
    displayName: "God Rays",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "rayIntensity", label: "Ray Intensity", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "density", label: "Cloud Density", min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["divine", "infernal", "aurora", "prismatic"], default: "divine" },
    ],
  },
  {
    id: "liquidDream",
    displayName: "Liquid Dream",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "complexity", label: "Complexity", min: 2, max: 8, step: 1, default: 5 },
      { type: "number", key: "warpIntensity", label: "Warp", min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["alien", "lava", "dream", "oilSlick"], default: "alien" },
    ],
  },
] as const;
