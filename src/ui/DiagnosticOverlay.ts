import type { Renderer } from "../engine/Renderer";
import type { AudioAnalyzer } from "../audio/AudioAnalyzer";

export class DiagnosticOverlay {
  private el: HTMLDivElement;
  private renderer: Renderer;
  private audio: AudioAnalyzer;
  private intervalId = 0;
  private visible = false;

  constructor(renderer: Renderer, audio: AudioAnalyzer) {
    this.renderer = renderer;
    this.audio = audio;

    this.el = document.createElement("div");
    this.el.style.cssText = `
      position: fixed;
      top: 12px;
      left: 12px;
      background: rgba(0, 0, 0, 0.75);
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      pointer-events: none;
      z-index: 9999;
      line-height: 1.6;
      display: none;
    `;
    document.body.appendChild(this.el);

    // Toggle on D key
    window.addEventListener("keydown", (e) => {
      if (e.key === "d" || e.key === "D") {
        this.toggle();
      }
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? "block" : "none";
    if (this.visible) {
      this.startUpdating();
    } else {
      this.stopUpdating();
    }
  }

  setVisible(show: boolean): void {
    if (show === this.visible) return;
    this.toggle();
  }

  private startUpdating(): void {
    if (this.intervalId) return;
    this.intervalId = window.setInterval(() => this.update(), 200);
    this.update();
  }

  private stopUpdating(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = 0;
    }
  }

  private update(): void {
    const diag = this.renderer.getDiagnostics();
    const features = this.audio.getFeatures();

    const lines = [
      `FPS: ${diag.fps}`,
      `Scene: ${diag.sceneName ?? "none"}`,
      `Transition: ${diag.transitioning ? "active" : "idle"}`,
      ``,
      `Energy: ${features.energy.toFixed(2)}`,
      `Bass:   ${features.bass.toFixed(2)}`,
      `Mid:    ${features.mid.toFixed(2)}`,
      `Treble: ${features.treble.toFixed(2)}`,
      `BPM:    ${features.bpm || "—"}`,
    ];

    if (diag.blackout) lines.push(`[BLACKOUT]`);
    if (diag.strobe) lines.push(`[STROBE]`);

    this.el.textContent = lines.join("\n");
  }

  dispose(): void {
    this.stopUpdating();
    this.el.remove();
  }
}
