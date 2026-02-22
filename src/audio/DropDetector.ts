import type { AudioFeatures } from "../types/audio";

export interface DropDetectorCallbacks {
  onBuild?: (intensity: number) => void;
  onDrop?: (intensity: number) => void;
  onSustainedEnergy?: (seconds: number) => void;
}

type Phase = "idle" | "building" | "dropping" | "sustained";

/**
 * Detects musical build-ups, drops, and sustained energy periods.
 * Uses a sliding window to track energy trends.
 */
export class DropDetector {
  private callbacks: DropDetectorCallbacks;
  private phase: Phase = "idle";
  private sensitivity = 1.0;

  // Sliding window of energy values (at ~60fps)
  private energyWindow: number[] = [];
  private readonly WINDOW_SIZE = 480; // ~8 seconds at 60fps
  private readonly BUILD_FRAMES = 120; // ~2 seconds of rising energy to detect build

  // Sustained energy tracking
  private sustainedStart = 0;
  private sustainedThreshold = 0.3;

  // Drop detection
  private buildPeak = 0;
  private lastDropTime = 0;
  private readonly DROP_COOLDOWN = 180; // ~3 seconds cooldown between drops
  private frameCount = 0;

  constructor(callbacks: DropDetectorCallbacks) {
    this.callbacks = callbacks;
  }

  setSensitivity(value: number): void {
    this.sensitivity = value;
  }

  update(audio: AudioFeatures): void {
    this.frameCount++;
    const energy = audio.energy;

    // Update sliding window
    this.energyWindow.push(energy);
    if (this.energyWindow.length > this.WINDOW_SIZE) {
      this.energyWindow.shift();
    }

    if (this.energyWindow.length < this.BUILD_FRAMES) return;

    const len = this.energyWindow.length;
    const recentAvg = this.avg(len - 60, len); // last ~1 second
    const olderAvg = this.avg(Math.max(0, len - this.BUILD_FRAMES), len - 60); // prior ~1 second
    const overallAvg = this.avg(0, len);

    const threshold = 0.15 / this.sensitivity;

    switch (this.phase) {
      case "idle":
        // Detect build: rising energy trend
        if (recentAvg > olderAvg + threshold && recentAvg > 0.2) {
          this.phase = "building";
          this.buildPeak = recentAvg;
        }
        // Detect sustained energy
        if (recentAvg > this.sustainedThreshold) {
          if (this.sustainedStart === 0) this.sustainedStart = this.frameCount;
          const duration = (this.frameCount - this.sustainedStart) / 60;
          if (duration > 5) {
            this.callbacks.onSustainedEnergy?.(duration);
          }
        } else {
          this.sustainedStart = 0;
        }
        break;

      case "building": {
        const buildIntensity = Math.min((recentAvg - overallAvg) / 0.3, 1);
        this.buildPeak = Math.max(this.buildPeak, recentAvg);
        this.callbacks.onBuild?.(Math.max(0, buildIntensity * this.sensitivity));

        // Detect drop: sudden energy spike after build
        if (
          energy > this.buildPeak * 1.3 &&
          this.frameCount - this.lastDropTime > this.DROP_COOLDOWN
        ) {
          this.phase = "dropping";
          const dropIntensity = Math.min(energy / this.buildPeak, 2) * this.sensitivity;
          this.callbacks.onDrop?.(Math.min(dropIntensity, 1));
          this.lastDropTime = this.frameCount;
        }
        // Build fizzled out
        if (recentAvg < olderAvg - threshold * 0.5) {
          this.phase = "idle";
        }
        break;
      }

      case "dropping":
        // Short drop state, return to idle after a moment
        if (recentAvg < this.buildPeak * 0.8) {
          this.phase = "idle";
          this.buildPeak = 0;
        }
        // Also exit if we've been in drop too long
        if (this.frameCount - this.lastDropTime > 120) {
          this.phase = "idle";
          this.buildPeak = 0;
        }
        break;

      case "sustained":
        if (recentAvg < this.sustainedThreshold) {
          this.phase = "idle";
          this.sustainedStart = 0;
        }
        break;
    }
  }

  private avg(from: number, to: number): number {
    if (to <= from) return 0;
    let sum = 0;
    for (let i = from; i < to; i++) {
      sum += this.energyWindow[i]!;
    }
    return sum / (to - from);
  }
}
