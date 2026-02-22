/**
 * Post-processing effects overlay that composites on top of scene output.
 * Supports multiple simultaneous effects: flash, zoom, screen shake.
 * Rendered as an HTML overlay + CSS transforms on the canvas.
 */
export interface EffectsSettings {
  dropFlash: boolean;
  dropZoom: boolean;
  screenShake: boolean;
  sensitivity: number;
  strobeBpmSync: boolean;
}

const DEFAULT_SETTINGS: EffectsSettings = {
  dropFlash: true,
  dropZoom: true,
  screenShake: true,
  sensitivity: 1.0,
  strobeBpmSync: false,
};

interface ActiveEffect {
  type: "flash" | "zoom" | "shake";
  startTime: number;
  duration: number;
  intensity: number;
}

export class EffectsLayer {
  private canvas: HTMLCanvasElement;
  private flashOverlay: HTMLDivElement;
  private settings: EffectsSettings = { ...DEFAULT_SETTINGS };
  private effects: ActiveEffect[] = [];
  private originalTransform = "";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.originalTransform = canvas.style.transform;

    // Create flash overlay
    this.flashOverlay = document.createElement("div");
    this.flashOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
      background: white;
      opacity: 0;
    `;
    document.body.appendChild(this.flashOverlay);
  }

  setSettings(settings: Partial<EffectsSettings>): void {
    Object.assign(this.settings, settings);
  }

  getSettings(): EffectsSettings {
    return { ...this.settings };
  }

  /** Trigger a drop flash effect */
  triggerFlash(intensity: number): void {
    if (!this.settings.dropFlash) return;
    this.effects.push({
      type: "flash",
      startTime: performance.now(),
      duration: 200,
      intensity: intensity * this.settings.sensitivity,
    });
  }

  /** Trigger a zoom pulse effect */
  triggerZoom(intensity: number): void {
    if (!this.settings.dropZoom) return;
    this.effects.push({
      type: "zoom",
      startTime: performance.now(),
      duration: 300,
      intensity: intensity * this.settings.sensitivity,
    });
  }

  /** Trigger a screen shake effect */
  triggerShake(intensity: number): void {
    if (!this.settings.screenShake) return;
    this.effects.push({
      type: "shake",
      startTime: performance.now(),
      duration: 400,
      intensity: intensity * this.settings.sensitivity,
    });
  }

  /** Trigger all drop effects at once */
  triggerDrop(intensity: number): void {
    this.triggerFlash(intensity);
    this.triggerZoom(intensity);
    this.triggerShake(intensity);
  }

  /** Call every frame to update active effects */
  update(): void {
    const now = performance.now();
    let flashOpacity = 0;
    let zoomScale = 1;
    let shakeX = 0;
    let shakeY = 0;

    // Process active effects
    this.effects = this.effects.filter((effect) => {
      const elapsed = now - effect.startTime;
      if (elapsed > effect.duration) return false;

      const t = elapsed / effect.duration;
      // Exponential decay
      const decay = 1 - t * t;

      switch (effect.type) {
        case "flash":
          flashOpacity = Math.max(flashOpacity, decay * effect.intensity * 0.8);
          break;
        case "zoom":
          zoomScale = Math.max(zoomScale, 1 + decay * effect.intensity * 0.08);
          break;
        case "shake": {
          const shakeAmount = decay * effect.intensity * 6;
          shakeX += (Math.random() - 0.5) * shakeAmount;
          shakeY += (Math.random() - 0.5) * shakeAmount;
          break;
        }
      }
      return true;
    });

    // Apply flash
    this.flashOverlay.style.opacity = String(flashOpacity);

    // Apply zoom + shake to canvas
    if (zoomScale !== 1 || shakeX !== 0 || shakeY !== 0) {
      this.canvas.style.transform = `scale(${zoomScale}) translate(${shakeX}px, ${shakeY}px)`;
    } else {
      this.canvas.style.transform = this.originalTransform;
    }
  }

  /** Get BPM-synced strobe interval in frames (for Renderer) */
  getStrobeInterval(bpm: number): number {
    if (!this.settings.strobeBpmSync || bpm <= 0) return 4; // default ~15Hz
    // Strobe on every eighth note
    const beatsPerSecond = bpm / 60;
    const eighthNotesPerSecond = beatsPerSecond * 2;
    const framesPerEighth = 60 / eighthNotesPerSecond;
    return Math.max(2, Math.round(framesPerEighth));
  }

  dispose(): void {
    this.flashOverlay.remove();
    this.canvas.style.transform = this.originalTransform;
  }
}
