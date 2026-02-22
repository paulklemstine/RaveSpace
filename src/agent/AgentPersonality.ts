import type { CuratedTransitionName } from "../engine/transitions";

export type EnergyLevel = "low" | "medium" | "high" | "peak";

export interface MoodProfile {
  scenes: string[];
  transitions: CuratedTransitionName[];
  speedRange: [number, number];
  intensityRange: [number, number];
  /** Probability of enabling overlay composite on scene switch */
  overlayChance: number;
  overlayBlendModes: string[];
  overlayOpacityRange: [number, number];
  /** Range for effects sensitivity at this energy level */
  effectsSensitivityRange: [number, number];
  /** Seconds between per-scene param tweaks */
  paramTweakInterval: number;
  /** How aggressively to bias intensity-like params (0=random, 1=max) */
  paramEnergyBias: number;
}

/**
 * Defines aesthetic preferences for the AI VJ agent.
 * Maps energy levels to appropriate scene/transition choices and param behaviors.
 */
export const MOOD_PROFILES: Record<EnergyLevel, MoodProfile> = {
  low: {
    scenes: ["plasma", "liquidDream", "sacredGeometry", "godRays"],
    transitions: ["fade", "Dreamy", "DreamyZoom", "morph"],
    speedRange: [0.3, 0.8],
    intensityRange: [0.4, 0.7],
    overlayChance: 0.05,
    overlayBlendModes: ["screen", "multiply"],
    overlayOpacityRange: [0.1, 0.25],
    effectsSensitivityRange: [0.5, 0.8],
    paramTweakInterval: 8,
    paramEnergyBias: 0.15,
  },
  medium: {
    scenes: ["plasma", "particles", "tunnel", "kaleidoscope", "sacredGeometry", "liquidDream"],
    transitions: ["crosswarp", "Swirl", "ripple", "Radial"],
    speedRange: [0.8, 1.5],
    intensityRange: [0.7, 1.2],
    overlayChance: 0.2,
    overlayBlendModes: ["screen", "additive", "overlay"],
    overlayOpacityRange: [0.15, 0.4],
    effectsSensitivityRange: [0.8, 1.2],
    paramTweakInterval: 5,
    paramEnergyBias: 0.35,
  },
  high: {
    scenes: ["particles", "tunnel", "fractalDive", "kaleidoscope", "godRays"],
    transitions: ["CrossZoom", "burn", "wind", "pixelize"],
    speedRange: [1.2, 2.5],
    intensityRange: [1.0, 1.8],
    overlayChance: 0.4,
    overlayBlendModes: ["additive", "screen", "difference"],
    overlayOpacityRange: [0.2, 0.55],
    effectsSensitivityRange: [1.0, 1.6],
    paramTweakInterval: 3,
    paramEnergyBias: 0.6,
  },
  peak: {
    scenes: ["particles", "tunnel", "fractalDive", "kaleidoscope", "sacredGeometry"],
    transitions: ["GlitchMemories", "GlitchDisplace", "kaleidoscope", "CrossZoom"],
    speedRange: [2.0, 4.0],
    intensityRange: [1.5, 2.0],
    overlayChance: 0.6,
    overlayBlendModes: ["additive", "difference", "screen", "overlay"],
    overlayOpacityRange: [0.3, 0.7],
    effectsSensitivityRange: [1.4, 2.0],
    paramTweakInterval: 2,
    paramEnergyBias: 0.8,
  },
};

/** Thresholds for classifying energy levels */
export const ENERGY_THRESHOLDS = {
  low: 0.15,
  medium: 0.3,
  high: 0.55,
  peak: 0.75,
};

/** Minimum time (seconds) before allowing auto scene switch */
export const MIN_SCENE_DURATION = 15;

/** Minimum time (seconds) before allowing auto transition change */
export const MIN_TRANSITION_INTERVAL = 30;

/**
 * Param keys that should scale with energy level.
 * Higher energy = biased toward higher values.
 */
export const INTENSITY_PARAM_KEYS = /speed|intensity|glow|warp|reactivity|rayIntensity|glowIntensity|warpIntensity/i;

export function classifyEnergy(energy: number): EnergyLevel {
  if (energy >= ENERGY_THRESHOLDS.peak) return "peak";
  if (energy >= ENERGY_THRESHOLDS.high) return "high";
  if (energy >= ENERGY_THRESHOLDS.medium) return "medium";
  return "low";
}

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
