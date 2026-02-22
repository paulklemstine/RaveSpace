import type { AudioFeatures } from "../types/audio";
import type { PitchInfo } from "../types/bands";
import { NUM_BANDS } from "../types/bands";
import type { MeydaFeaturesObject } from "meyda";
import Meyda from "meyda";
import { createRealtimeBpmAnalyzer, type BpmAnalyzer } from "realtime-bpm-analyzer";
import { BandAnalyzer } from "./BandAnalyzer";

// --- Tuning constants ---
const MEYDA_FFT_SIZE = 1024;
const SAMPLE_RATE = 44100;
const HZ_PER_BIN_MEYDA = SAMPLE_RATE / MEYDA_FFT_SIZE; // ~43Hz per bin

// Meyda band boundaries
const BASS_END = Math.round(300 / HZ_PER_BIN_MEYDA);
const MID_END = Math.round(4000 / HZ_PER_BIN_MEYDA);
const TOTAL_BINS_MEYDA = MEYDA_FFT_SIZE / 2;

// Native AnalyserNode config
const NATIVE_FFT_SIZE = 2048; // 1024 bins, ~21.5 Hz/bin
const NATIVE_BINS = NATIVE_FFT_SIZE / 2;
const HZ_PER_BIN_NATIVE = SAMPLE_RATE / NATIVE_FFT_SIZE;

// Kick band: 60-150Hz
const KICK_BIN_START = Math.round(60 / HZ_PER_BIN_NATIVE);
const KICK_BIN_END = Math.round(150 / HZ_PER_BIN_NATIVE);

// Asymmetric smoothing
const ATTACK = 0.6;  // rises to 90% in ~3 frames (50ms)
const RELEASE = 0.08; // decays to 10% over ~28 frames (470ms)

// Spectral flux
const FLUX_SENSITIVITY = 8.0;
const FLUX_BEAT_THRESHOLD = 0.4;

// Beat intensity
const BEAT_INTENSITY_SCALE = 3.0;
const BEAT_INTENSITY_DECAY = 0.85;

// dB normalization
const MIN_DB = -100;
const MAX_DB = -30;
const DB_RANGE = MAX_DB - MIN_DB;

const BEAT_THRESHOLD = 1.4;
const ROLLING_WINDOW = 30;

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

/** Asymmetric smoothing: fast attack, slow release */
function smoothAsymmetric(current: number, target: number): number {
  const factor = target > current ? ATTACK : RELEASE;
  return current + (target - current) * factor;
}

/** Convert dB value to linear 0-1 */
function dbToLinear(db: number): number {
  return clamp01((db - MIN_DB) / DB_RANGE);
}

export class AudioAnalyzer {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private meydaAnalyzer: ReturnType<typeof Meyda.createMeydaAnalyzer> | null = null;
  private bpmAnalyzer: BpmAnalyzer | null = null;

  // Native AnalyserNode for per-frame data
  private nativeAnalyser: AnalyserNode | null = null;
  private nativeFreqData: Float32Array = new Float32Array(NATIVE_BINS);
  private prevSpectrum: Float32Array = new Float32Array(NATIVE_BINS);
  private hasNativePrev = false;

  // Smoothed features
  private energy = 0;
  private bass = 0;
  private mid = 0;
  private treble = 0;
  private spectralCentroid = 0;
  private beat = false;
  private bpm = 0;
  private kick = 0;
  private beatIntensity = 0;
  private spectralFlux = 0;

  // 16-band EQ + pitch
  private bandAnalyzer = new BandAnalyzer(SAMPLE_RATE, NATIVE_FFT_SIZE);
  private bands: Float32Array = new Float32Array(NUM_BANDS);
  private pitch: PitchInfo = { frequency: 0, midiNote: 0, noteName: "", confidence: 0 };

  // Beat detection state
  private energyHistory: number[] = [];
  private rollingAvg = 0;

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.warn("[AudioAnalyzer] Mic unavailable — running silent:", e);
      // Create a silent audio context so the rest of the pipeline works
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      return;
    }
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.source = this.ctx.createMediaStreamSource(this.stream);

    // Native AnalyserNode — gives us fresh FFT data every frame
    this.nativeAnalyser = this.ctx.createAnalyser();
    this.nativeAnalyser.fftSize = NATIVE_FFT_SIZE;
    this.nativeAnalyser.smoothingTimeConstant = 0; // we do our own smoothing
    this.source.connect(this.nativeAnalyser);

    // Meyda for spectral centroid only (changes slowly, ~43Hz is fine)
    this.meydaAnalyzer = Meyda.createMeydaAnalyzer({
      audioContext: this.ctx,
      source: this.source,
      bufferSize: MEYDA_FFT_SIZE,
      featureExtractors: ["rms", "spectralCentroid", "amplitudeSpectrum"],
      callback: (features: Partial<MeydaFeaturesObject>) => {
        this.onMeydaFeatures(features);
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
      console.warn("BPM analyzer unavailable:", e);
    }
  }

  /** Called every render frame — returns FRESH audio data */
  getFeatures(): AudioFeatures {
    // Pull fresh frequency data from native AnalyserNode
    if (this.nativeAnalyser) {
      this.nativeAnalyser.getFloatFrequencyData(this.nativeFreqData);
      this.processNativeFFT();
    }

    return {
      energy: this.energy,
      bass: this.bass,
      mid: this.mid,
      treble: this.treble,
      spectralCentroid: this.spectralCentroid,
      beat: this.beat,
      bpm: this.bpm,
      kick: this.kick,
      beatIntensity: this.beatIntensity,
      spectralFlux: this.spectralFlux,
      bands: this.bands,
      pitch: this.pitch,
    };
  }

  dispose(): void {
    this.meydaAnalyzer?.stop();
    this.bpmAnalyzer?.stop();
    this.bpmAnalyzer?.disconnect();
    this.nativeAnalyser?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();

    this.meydaAnalyzer = null;
    this.bpmAnalyzer = null;
    this.nativeAnalyser = null;
    this.source = null;
    this.stream = null;
    this.ctx = null;
  }

  /** Process native AnalyserNode FFT data — called every render frame */
  private processNativeFFT(): void {
    const freq = this.nativeFreqData;

    // Convert dB to linear spectrum
    const linear = new Float32Array(NATIVE_BINS);
    for (let i = 0; i < NATIVE_BINS; i++) {
      linear[i] = dbToLinear(freq[i]!);
    }

    // Band energies from native analyser (higher resolution)
    const nativeBassEnd = Math.round(300 / HZ_PER_BIN_NATIVE);
    const nativeMidEnd = Math.round(4000 / HZ_PER_BIN_NATIVE);

    const rawBass = clamp01(bandEnergy(linear, 0, nativeBassEnd));
    const rawMid = clamp01(bandEnergy(linear, nativeBassEnd, nativeMidEnd));
    const rawTreble = clamp01(bandEnergy(linear, nativeMidEnd, NATIVE_BINS));
    const rawEnergy = clamp01((rawBass + rawMid + rawTreble) / 3);

    // Kick band: 60-150Hz (isolated kick drum energy)
    const rawKick = clamp01(bandEnergy(linear, KICK_BIN_START, KICK_BIN_END) * 2.0);

    // Asymmetric smoothing — fast attack, slow release
    this.bass = smoothAsymmetric(this.bass, rawBass);
    this.mid = smoothAsymmetric(this.mid, rawMid);
    this.treble = smoothAsymmetric(this.treble, rawTreble);
    this.energy = smoothAsymmetric(this.energy, rawEnergy);
    this.kick = smoothAsymmetric(this.kick, rawKick);

    // --- Spectral flux (onset detection) ---
    let flux = 0;
    if (this.hasNativePrev) {
      for (let i = 0; i < NATIVE_BINS; i++) {
        const diff = linear[i]! - this.prevSpectrum[i]!;
        if (diff > 0) flux += diff; // half-wave rectified
      }
    }
    const rawFlux = clamp01(flux * FLUX_SENSITIVITY / NATIVE_BINS);
    this.spectralFlux = smoothAsymmetric(this.spectralFlux, rawFlux);

    // 16-band EQ + pitch detection
    this.bands = this.bandAnalyzer.analyze(linear);
    this.pitch = this.bandAnalyzer.detectPitch(linear);

    // Store current spectrum for next frame
    this.prevSpectrum.set(linear);
    this.hasNativePrev = true;

    // --- Beat detection: energy spike OR spectral flux spike ---
    this.energyHistory.push(rawEnergy);
    if (this.energyHistory.length > ROLLING_WINDOW) {
      this.energyHistory.shift();
    }
    const sum = this.energyHistory.reduce((a, b) => a + b, 0);
    this.rollingAvg = sum / this.energyHistory.length;

    const energyBeat = rawEnergy > this.rollingAvg * BEAT_THRESHOLD;
    const fluxBeat = rawFlux > FLUX_BEAT_THRESHOLD;
    this.beat = energyBeat || fluxBeat;

    // --- Beat intensity: proportional strength ---
    if (this.beat) {
      const energyExceedance = energyBeat
        ? (rawEnergy - this.rollingAvg * BEAT_THRESHOLD) / (this.rollingAvg + 0.001)
        : 0;
      const fluxExceedance = fluxBeat
        ? (rawFlux - FLUX_BEAT_THRESHOLD) / FLUX_BEAT_THRESHOLD
        : 0;
      const rawIntensity = clamp01(Math.max(energyExceedance, fluxExceedance) * BEAT_INTENSITY_SCALE);
      this.beatIntensity = Math.max(this.beatIntensity, rawIntensity);
    }
    this.beatIntensity *= BEAT_INTENSITY_DECAY;
  }

  /** Meyda callback — used only for spectral centroid now */
  private onMeydaFeatures(features: Partial<MeydaFeaturesObject>): void {
    // Spectral centroid changes slowly, ~43Hz update rate is fine
    const rawCentroid = clamp01(
      (features.spectralCentroid ?? 0) / (SAMPLE_RATE / 2),
    );
    this.spectralCentroid = smoothAsymmetric(this.spectralCentroid, rawCentroid);
  }
}
