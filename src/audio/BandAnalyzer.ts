import { BAND_EDGES, NUM_BANDS } from "../types/bands";
import type { PitchInfo } from "../types/bands";

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

/** Per-band AGC: running max decays slowly so output stays in [0,1] */
const AGC_DECAY = 0.9995; // per-frame at 60fps ≈ 0.97/sec
const AGC_MIN_MAX = 0.001; // floor to avoid divide-by-zero

/** Asymmetric smoothing (matches AudioAnalyzer) */
const ATTACK = 0.6;
const RELEASE = 0.08;

export class BandAnalyzer {
  /** AGC running max per band */
  private agcMax: Float32Array;
  /** Smoothed output per band */
  private smoothed: Float32Array;

  private sampleRate: number;
  private fftSize: number;

  constructor(sampleRate: number, fftSize: number) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.agcMax = new Float32Array(NUM_BANDS).fill(AGC_MIN_MAX);
    this.smoothed = new Float32Array(NUM_BANDS);
  }

  /**
   * Compute 16-band EQ from linear spectrum.
   * @param linear Linear-scale spectrum (fftSize/2 bins)
   * @returns AGC-normalized, smoothed band levels [0,1]
   */
  analyze(linear: Float32Array): Float32Array {
    const numBins = this.fftSize / 2;
    const hzPerBin = this.sampleRate / this.fftSize;

    for (let b = 0; b < NUM_BANDS; b++) {
      let raw: number;
      if (b < NUM_BANDS - 1) {
        // Bands 0-14: frequency sub-band
        const loHz = BAND_EDGES[b]!;
        const hiHz = BAND_EDGES[b + 1]!;
        const loBin = Math.max(0, Math.round(loHz / hzPerBin));
        const hiBin = Math.min(numBins, Math.round(hiHz / hzPerBin));
        raw = bandEnergy(linear, loBin, hiBin);
      } else {
        // Band 15: full-range energy
        raw = bandEnergy(linear, 0, numBins);
      }

      // AGC: track running max with slow decay
      this.agcMax[b]! *= AGC_DECAY;
      if (raw > this.agcMax[b]!) {
        this.agcMax[b] = raw;
      }
      // Clamp agcMax floor
      if (this.agcMax[b]! < AGC_MIN_MAX) {
        this.agcMax[b] = AGC_MIN_MAX;
      }

      // Normalize by running max → [0,1]
      const normalized = clamp01(raw / this.agcMax[b]!);

      // Asymmetric smoothing
      const prev = this.smoothed[b]!;
      const factor = normalized > prev ? ATTACK : RELEASE;
      this.smoothed[b] = prev + (normalized - prev) * factor;
    }

    return this.smoothed;
  }

  /**
   * Detect pitch via parabolic interpolation on FFT peak.
   * @param linear Linear-scale spectrum
   */
  detectPitch(linear: Float32Array): PitchInfo {
    const numBins = this.fftSize / 2;
    const hzPerBin = this.sampleRate / this.fftSize;

    // Find peak bin (skip bin 0 = DC)
    let peakBin = 1;
    let peakVal = linear[1]!;
    let sum = linear[0]! + linear[1]!;
    for (let i = 2; i < numBins; i++) {
      sum += linear[i]!;
      if (linear[i]! > peakVal) {
        peakVal = linear[i]!;
        peakBin = i;
      }
    }

    const mean = sum / numBins;
    const confidence = mean > 0 ? clamp01(peakVal / (mean * 10)) : 0;

    // Parabolic interpolation for sub-bin precision
    let refinedBin = peakBin;
    if (peakBin > 0 && peakBin < numBins - 1) {
      const alpha = linear[peakBin - 1]!;
      const beta = linear[peakBin]!;
      const gamma = linear[peakBin + 1]!;
      const denom = alpha - 2 * beta + gamma;
      if (Math.abs(denom) > 1e-10) {
        refinedBin = peakBin + 0.5 * (alpha - gamma) / denom;
      }
    }

    const frequency = refinedBin * hzPerBin;
    const midiNote = frequency > 0 ? Math.round(69 + 12 * Math.log2(frequency / 440)) : 0;
    const noteIndex = ((midiNote % 12) + 12) % 12;
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = frequency > 0 ? `${NOTE_NAMES[noteIndex]}${octave}` : "";

    return { frequency, midiNote, noteName, confidence };
  }
}

function bandEnergy(spectrum: Float32Array, from: number, to: number): number {
  let sum = 0;
  const count = to - from;
  if (count <= 0) return 0;
  for (let i = from; i < to; i++) {
    sum += spectrum[i]!;
  }
  return sum / count;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
