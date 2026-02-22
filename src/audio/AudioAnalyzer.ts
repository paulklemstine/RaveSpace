import type { AudioFeatures } from "../types/audio";
import type { MeydaFeaturesObject } from "meyda";
import Meyda from "meyda";
import { createRealtimeBpmAnalyzer, type BpmAnalyzer } from "realtime-bpm-analyzer";

const FFT_SIZE = 1024; // 512 bins
const SAMPLE_RATE = 44100;
const HZ_PER_BIN = SAMPLE_RATE / FFT_SIZE; // ~43Hz

// Band boundaries in bins
const BASS_END = Math.round(300 / HZ_PER_BIN); // ~7
const MID_END = Math.round(4000 / HZ_PER_BIN); // ~93
const TOTAL_BINS = FFT_SIZE / 2; // 512

const SMOOTHING = 0.3;
const BEAT_THRESHOLD = 1.4;
const ROLLING_WINDOW = 30; // frames for rolling average

function lerp(old: number, next: number, factor: number): number {
  return old + (next - old) * factor;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
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

export class AudioAnalyzer {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private meydaAnalyzer: ReturnType<typeof Meyda.createMeydaAnalyzer> | null = null;
  private bpmAnalyzer: BpmAnalyzer | null = null;

  // Smoothed features
  private energy = 0;
  private bass = 0;
  private mid = 0;
  private treble = 0;
  private spectralCentroid = 0;
  private beat = false;
  private bpm = 0;

  // Beat detection state
  private energyHistory: number[] = [];
  private rollingAvg = 0;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.source = this.ctx.createMediaStreamSource(this.stream);

    // Meyda for spectral features
    this.meydaAnalyzer = Meyda.createMeydaAnalyzer({
      audioContext: this.ctx,
      source: this.source,
      bufferSize: FFT_SIZE,
      featureExtractors: ["rms", "spectralCentroid", "amplitudeSpectrum"],
      callback: (features: Partial<MeydaFeaturesObject>) => {
        this.onFeatures(features);
      },
    });
    this.meydaAnalyzer.start();

    // BPM analyzer via AudioWorklet
    try {
      this.bpmAnalyzer = await createRealtimeBpmAnalyzer(this.ctx, {
        continuousAnalysis: true,
      });
      this.source.connect(this.bpmAnalyzer.node);

      this.bpmAnalyzer.on("bpm", (data) => {
        if (data.bpm.length > 0) {
          this.bpm = data.bpm[0]!.tempo;
        }
      });
    } catch (e) {
      // AudioWorklet may fail in some environments; BPM will stay 0
      console.warn("BPM analyzer unavailable:", e);
    }
  }

  getFeatures(): AudioFeatures {
    return {
      energy: this.energy,
      bass: this.bass,
      mid: this.mid,
      treble: this.treble,
      spectralCentroid: this.spectralCentroid,
      beat: this.beat,
      bpm: this.bpm,
    };
  }

  dispose(): void {
    this.meydaAnalyzer?.stop();
    this.bpmAnalyzer?.stop();
    this.bpmAnalyzer?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();

    this.meydaAnalyzer = null;
    this.bpmAnalyzer = null;
    this.source = null;
    this.stream = null;
    this.ctx = null;
  }

  private onFeatures(features: Partial<MeydaFeaturesObject>): void {
    const spectrum = features.amplitudeSpectrum;
    if (!spectrum) return;

    // Compute raw band energies
    const rawBass = clamp01(bandEnergy(spectrum, 0, BASS_END));
    const rawMid = clamp01(bandEnergy(spectrum, BASS_END, MID_END));
    const rawTreble = clamp01(bandEnergy(spectrum, MID_END, TOTAL_BINS));
    const rawEnergy = features.rms ?? 0;

    // Normalize spectral centroid to 0-1 (max = Nyquist)
    const rawCentroid = clamp01(
      (features.spectralCentroid ?? 0) / (SAMPLE_RATE / 2),
    );

    // Exponential smoothing
    this.bass = lerp(this.bass, rawBass, SMOOTHING);
    this.mid = lerp(this.mid, rawMid, SMOOTHING);
    this.treble = lerp(this.treble, rawTreble, SMOOTHING);
    this.energy = lerp(this.energy, rawEnergy, SMOOTHING);
    this.spectralCentroid = lerp(this.spectralCentroid, rawCentroid, SMOOTHING);

    // Beat detection: energy spike above rolling average
    this.energyHistory.push(rawEnergy);
    if (this.energyHistory.length > ROLLING_WINDOW) {
      this.energyHistory.shift();
    }

    const sum = this.energyHistory.reduce((a, b) => a + b, 0);
    this.rollingAvg = sum / this.energyHistory.length;
    this.beat = rawEnergy > this.rollingAvg * BEAT_THRESHOLD;
  }
}
