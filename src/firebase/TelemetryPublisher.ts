import { ref, set } from "firebase/database";
import { db } from "./config";
import type { AudioAnalyzer } from "../audio/AudioAnalyzer";
import type { Renderer } from "../engine/Renderer";

const PUBLISH_INTERVAL_MS = 200; // 5Hz

function safe(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

export class TelemetryPublisher {
  private audioAnalyzer: AudioAnalyzer;
  private renderer: Renderer;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private audioRef = ref(db, "ravespace/telemetry/audio");
  private displayRef = ref(db, "ravespace/telemetry/display");

  constructor(audioAnalyzer: AudioAnalyzer, renderer: Renderer) {
    this.audioAnalyzer = audioAnalyzer;
    this.renderer = renderer;
  }

  start(): void {
    // Publish initial connected status
    void set(this.displayRef, {
      connected: true,
      scene: this.renderer.getActiveSceneName() ?? "unknown",
      fps: 60,
      timestamp: Date.now(),
    });

    this.intervalId = setInterval(() => {
      this.publish();
    }, PUBLISH_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    void set(this.displayRef, {
      connected: false,
      scene: "",
      fps: 0,
      timestamp: Date.now(),
    });
  }

  private publish(): void {
    const features = this.audioAnalyzer.getFeatures();
    void set(this.audioRef, {
      energy: safe(Math.round(features.energy * 1000) / 1000),
      bass: safe(Math.round(features.bass * 1000) / 1000),
      mid: safe(Math.round(features.mid * 1000) / 1000),
      treble: safe(Math.round(features.treble * 1000) / 1000),
      spectralCentroid: safe(Math.round(features.spectralCentroid * 1000) / 1000),
      beat: features.beat,
      bpm: safe(Math.round(features.bpm)),
      kick: safe(Math.round(features.kick * 1000) / 1000),
      beatIntensity: safe(Math.round(features.beatIntensity * 1000) / 1000),
      spectralFlux: safe(Math.round(features.spectralFlux * 1000) / 1000),
      timestamp: Date.now(),
    });

    void set(this.displayRef, {
      connected: true,
      scene: this.renderer.getActiveSceneName() ?? "unknown",
      fps: 60,
      timestamp: Date.now(),
    });
  }
}
