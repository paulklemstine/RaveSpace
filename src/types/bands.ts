/** 16-band EQ edges in Hz (band i spans BAND_EDGES[i]..BAND_EDGES[i+1]) */
export const BAND_EDGES = [
  30, 60, 120, 250, 500, 1000, 2000, 4000, 6000, 8000, 10000, 12000, 14000,
  16000, 18000, 20000,
] as const;

export const NUM_BANDS = 16;

export interface BandMapping {
  /** Scene param key (e.g. "twist") */
  paramKey: string;
  /** Which of 16 bands (0-15); band 15 = full-range energy */
  bandIndex: number;
  /** Modulation strength 0-1 */
  amount: number;
  /** "add" offsets param, "multiply" scales it */
  mode: "add" | "multiply";
}

export interface PitchInfo {
  /** Detected fundamental frequency in Hz, 0 if none */
  frequency: number;
  /** MIDI note number (69 = A4) */
  midiNote: number;
  /** Note name e.g. "A4", "C#3" */
  noteName: string;
  /** Confidence 0-1 (peak energy / mean energy) */
  confidence: number;
}
