import type { ParamDescriptor } from "../types/params";

export interface SceneMetadata {
  id: string;
  displayName: string;
  params: readonly ParamDescriptor[];
}

export const SCENE_REGISTRY: readonly SceneMetadata[] = [
  // ─── Original 8 Scenes ────────────────────────────────────
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

  // ─── New Scenes (9–32) ────────────────────────────────────
  {
    id: "voidWarp",
    displayName: "Void Warp",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "eventHorizon", label: "Event Horizon", min: 0.1, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "distortion", label: "Distortion", min: 0.0, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["cosmic", "void", "plasma", "singularity"], default: "cosmic" },
    ],
  },
  {
    id: "neonGrid",
    displayName: "Neon Grid",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "gridSize", label: "Grid Size", min: 1.0, max: 10.0, step: 0.5, default: 4.0 },
      { type: "number", key: "mountainHeight", label: "Mountains", min: 0.0, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["retro", "cyber", "vapor", "sunset"], default: "retro" },
    ],
  },
  {
    id: "digitalRain",
    displayName: "Digital Rain",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "density", label: "Density", min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "glyphSize", label: "Glyph Size", min: 0.5, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["matrix", "blue", "blood", "gold"], default: "matrix" },
    ],
  },
  {
    id: "starfield",
    displayName: "Starfield Warp",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.5 },
      { type: "number", key: "starDensity", label: "Star Density", min: 0.5, max: 5.0, step: 0.1, default: 2.0 },
      { type: "number", key: "warpFactor", label: "Warp Factor", min: 0.0, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["warp", "nebula", "ice", "fire"], default: "warp" },
    ],
  },
  {
    id: "moirePatterns",
    displayName: "Moire Patterns",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "lineCount", label: "Line Count", min: 3.0, max: 20.0, step: 1.0, default: 8.0 },
      { type: "number", key: "rotation", label: "Rotation", min: 0.0, max: 6.28, step: 0.01, default: 0.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["mono", "rainbow", "duotone", "neon"], default: "mono" },
    ],
  },
  {
    id: "cellularFlow",
    displayName: "Cellular Flow",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "cellScale", label: "Cell Scale", min: 1.0, max: 10.0, step: 0.5, default: 4.0 },
      { type: "number", key: "evolution", label: "Evolution", min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["bio", "toxic", "crystal", "lava"], default: "bio" },
    ],
  },
  {
    id: "laserGrid",
    displayName: "Laser Grid",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "beamWidth", label: "Beam Width", min: 0.5, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "beamCount", label: "Beam Count", min: 2.0, max: 12.0, step: 1.0, default: 6.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["club", "rgb", "uv", "white"], default: "club" },
    ],
  },
  {
    id: "waveformViz",
    displayName: "Waveform Viz",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "barWidth", label: "Bar Width", min: 0.3, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "glowIntensity", label: "Glow", min: 0.0, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["neon", "fire", "ice", "spectrum"], default: "neon" },
    ],
  },
  {
    id: "circuitTrace",
    displayName: "Circuit Trace",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "complexity", label: "Complexity", min: 1.0, max: 5.0, step: 0.5, default: 3.0 },
      { type: "number", key: "glowRadius", label: "Glow Radius", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["green", "blue", "gold", "red"], default: "green" },
    ],
  },
  {
    id: "fireStorm",
    displayName: "Fire Storm",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "turbulence", label: "Turbulence", min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
      { type: "number", key: "flameHeight", label: "Flame Height", min: 0.3, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["inferno", "blue", "green", "purple"], default: "inferno" },
    ],
  },
  {
    id: "auroraBorealis",
    displayName: "Aurora Borealis",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 0.8 },
      { type: "number", key: "waveCount", label: "Wave Count", min: 2.0, max: 8.0, step: 1.0, default: 4.0 },
      { type: "number", key: "brightness", label: "Brightness", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["arctic", "tropical", "alien", "solar"], default: "arctic" },
    ],
  },
  {
    id: "voronoiShatter",
    displayName: "Voronoi Shatter",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "cellCount", label: "Cell Count", min: 3.0, max: 15.0, step: 1.0, default: 8.0 },
      { type: "number", key: "sharpness", label: "Sharpness", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["glass", "neon", "dark", "rainbow"], default: "glass" },
    ],
  },
  {
    id: "superNova",
    displayName: "Supernova",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "intensity", label: "Intensity", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "ringCount", label: "Ring Count", min: 1.0, max: 5.0, step: 1.0, default: 3.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["stellar", "plasma", "quantum", "void"], default: "stellar" },
    ],
  },
  {
    id: "hypnoSpiral",
    displayName: "Hypno Spiral",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "arms", label: "Arms", min: 2.0, max: 12.0, step: 1.0, default: 6.0 },
      { type: "number", key: "depth", label: "Depth", min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["psychedelic", "mono", "candy", "toxic"], default: "psychedelic" },
    ],
  },
  {
    id: "glitchMatrix",
    displayName: "Glitch Matrix",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "glitchRate", label: "Glitch Rate", min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "blockSize", label: "Block Size", min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["vhs", "digital", "analog", "corrupt"], default: "vhs" },
    ],
  },
  {
    id: "hexGrid",
    displayName: "Hex Grid",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "hexSize", label: "Hex Size", min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
      { type: "number", key: "pulseWidth", label: "Pulse Width", min: 0.1, max: 2.0, step: 0.1, default: 0.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["cyber", "hive", "crystal", "ember"], default: "cyber" },
    ],
  },
  {
    id: "prismLight",
    displayName: "Prism Light",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "refraction", label: "Refraction", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "dispersion", label: "Dispersion", min: 0.1, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["rainbow", "diamond", "aurora", "spectrum"], default: "rainbow" },
    ],
  },
  {
    id: "energyField",
    displayName: "Energy Field",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "fieldStrength", label: "Field Strength", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "particleDensity", label: "Density", min: 1.0, max: 5.0, step: 0.5, default: 3.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["plasma", "electric", "force", "dark"], default: "plasma" },
    ],
  },
  {
    id: "nebulaDrift",
    displayName: "Nebula Drift",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 0.5 },
      { type: "number", key: "dustDensity", label: "Dust Density", min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
      { type: "number", key: "starBrightness", label: "Star Brightness", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["deep", "emission", "reflection", "dark"], default: "deep" },
    ],
  },
  {
    id: "cyberPulse",
    displayName: "Cyber Pulse",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "pulseRate", label: "Pulse Rate", min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
      { type: "number", key: "lineThickness", label: "Line Thickness", min: 0.3, max: 2.0, step: 0.1, default: 1.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["neon", "tron", "matrix", "blade"], default: "neon" },
    ],
  },
  {
    id: "fluidDynamics",
    displayName: "Fluid Dynamics",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "viscosity", label: "Viscosity", min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
      { type: "number", key: "vorticity", label: "Vorticity", min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["oil", "water", "lava", "plasma"], default: "oil" },
    ],
  },
  {
    id: "mandelbrotZoom",
    displayName: "Mandelbrot Zoom",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 0.5 },
      { type: "number", key: "iterations", label: "Detail", min: 20.0, max: 100.0, step: 5.0, default: 64.0 },
      { type: "number", key: "zoom", label: "Zoom", min: 0.5, max: 5.0, step: 0.1, default: 2.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["electric", "cosmic", "fire", "ice"], default: "electric" },
    ],
  },
  {
    id: "stainedGlass",
    displayName: "Stained Glass",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 0.8 },
      { type: "number", key: "tileSize", label: "Tile Size", min: 0.5, max: 4.0, step: 0.1, default: 2.0 },
      { type: "number", key: "leadWidth", label: "Lead Width", min: 0.1, max: 1.0, step: 0.05, default: 0.3 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["cathedral", "modern", "dark", "vivid"], default: "cathedral" },
    ],
  },
  {
    id: "electricStorm",
    displayName: "Electric Storm",
    params: [
      { type: "number", key: "speed", label: "Speed", min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { type: "number", key: "boltCount", label: "Bolt Count", min: 1.0, max: 8.0, step: 1.0, default: 4.0 },
      { type: "number", key: "branchDepth", label: "Branch Depth", min: 1.0, max: 5.0, step: 1.0, default: 3.0 },
      { type: "number", key: "audioReactivity", label: "Audio Reactivity", min: 0.0, max: 2.0, step: 0.1, default: 1.0 },
      { type: "select", key: "colorScheme", label: "Colors", options: ["lightning", "tesla", "plasma", "storm"], default: "lightning" },
    ],
  },
] as const;
