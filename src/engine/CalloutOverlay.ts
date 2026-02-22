import { ref, onValue, remove, type Unsubscribe } from "firebase/database";
import { db } from "../firebase/config";

interface ActiveCallout {
  name: string;
  startTime: number;
  duration: number;
}

/**
 * Psychedelic animated text overlay for audience shoutouts.
 * Each character waves, rotates, and cycles through rainbow colors.
 * Multiple glow layers create a neon DMT-style text effect.
 */
export class CalloutOverlay {
  private el: HTMLDivElement;
  private textContainer: HTMLDivElement;
  private glowLayer: HTMLDivElement;
  private charSpans: HTMLSpanElement[] = [];
  private glowSpans: HTMLSpanElement[] = [];
  private unsubscribe: Unsubscribe | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private rafId = 0;
  private showStartTime = 0;
  private isShowing = false;
  private showDuration = 5;

  constructor() {
    this.el = document.createElement("div");
    this.el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 200;
    `;

    // Glow layer (behind text, blurred duplicate for neon glow)
    this.glowLayer = document.createElement("div");
    this.glowLayer.style.cssText = `
      position: absolute;
      display: flex;
      gap: 0.02em;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: clamp(3rem, 8vw, 8rem);
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      filter: blur(12px);
      opacity: 0;
    `;
    this.el.appendChild(this.glowLayer);

    // Main text container
    this.textContainer = document.createElement("div");
    this.textContainer.style.cssText = `
      position: relative;
      display: flex;
      gap: 0.02em;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: clamp(3rem, 8vw, 8rem);
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      opacity: 0;
    `;
    this.el.appendChild(this.textContainer);

    document.body.appendChild(this.el);
  }

  start(): void {
    const activeRef = ref(db, "ravespace/callouts/active");
    this.unsubscribe = onValue(activeRef, (snapshot) => {
      const data = snapshot.val() as ActiveCallout | null;
      if (data?.name) {
        this.show(data.name, data.duration ?? 5);
      }
    });
  }

  private show(name: string, duration: number): void {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    if (this.rafId) cancelAnimationFrame(this.rafId);

    this.showDuration = duration;
    this.charSpans = [];
    this.glowSpans = [];
    this.textContainer.innerHTML = "";
    this.glowLayer.innerHTML = "";

    // Create per-character spans for main text + glow layer
    for (const char of name) {
      const ch = char === " " ? "\u00A0" : char;

      // Main character span
      const span = document.createElement("span");
      span.textContent = ch;
      span.style.cssText = `
        display: inline-block;
        color: transparent;
        background: linear-gradient(90deg, #ff00ff, #00ffff, #ffff00, #ff6600, #ff00ff);
        background-size: 500% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: none;
        filter: drop-shadow(0 0 8px currentColor);
      `;
      this.textContainer.appendChild(span);
      this.charSpans.push(span);

      // Glow duplicate
      const glow = document.createElement("span");
      glow.textContent = ch;
      glow.style.cssText = `
        display: inline-block;
        color: #ff00ff;
      `;
      this.glowLayer.appendChild(glow);
      this.glowSpans.push(glow);
    }

    this.isShowing = true;
    this.showStartTime = performance.now();
    this.animate();

    // Schedule hide
    this.hideTimeout = setTimeout(() => {
      this.isShowing = false;
      // Let animation loop handle fade-out, then clean up
      setTimeout(() => {
        void remove(ref(db, "ravespace/callouts/active"));
      }, 1500);
    }, duration * 1000);
  }

  private animate = (): void => {
    const now = performance.now();
    const elapsed = (now - this.showStartTime) / 1000;

    // Fade envelope: 0.5s in, hold, 1s out
    let envelope: number;
    if (this.isShowing) {
      envelope = Math.min(elapsed / 0.5, 1.0);
    } else {
      // Fade out over 1 second after isShowing goes false
      const fadeOutElapsed = elapsed - this.showDuration;
      envelope = Math.max(0, 1.0 - fadeOutElapsed);
    }

    if (envelope <= 0) {
      this.textContainer.style.opacity = "0";
      this.glowLayer.style.opacity = "0";
      return; // Stop animation
    }

    this.textContainer.style.opacity = String(envelope);
    this.glowLayer.style.opacity = String(envelope * 0.7);

    const t = elapsed;
    const numChars = this.charSpans.length;

    for (let i = 0; i < numChars; i++) {
      const span = this.charSpans[i]!;
      const glowSpan = this.glowSpans[i]!;
      const phase = i * 0.4; // offset per character

      // Wavy vertical motion
      const wave = Math.sin(t * 3.0 + phase) * 15 * envelope;

      // Subtle rotation oscillation
      const rot = Math.sin(t * 2.0 + phase * 0.7) * 8 * envelope;

      // Scale pulse
      const scale = 1.0 + Math.sin(t * 4.0 + phase * 0.5) * 0.08 * envelope;

      // Rainbow gradient position (flowing)
      const bgPos = ((t * 40 + i * 15) % 500);

      // Apply to main text
      span.style.transform = `translateY(${wave}px) rotate(${rot}deg) scale(${scale})`;
      span.style.backgroundPosition = `${bgPos}% 0`;

      // Glow color cycles through hues
      const hue = (t * 60 + i * 30) % 360;
      const glowColor = `hsl(${hue}, 100%, 60%)`;
      glowSpan.style.color = glowColor;
      glowSpan.style.transform = `translateY(${wave}px) rotate(${rot}deg) scale(${scale * 1.05})`;
    }

    this.rafId = requestAnimationFrame(this.animate);
  };

  dispose(): void {
    this.unsubscribe?.();
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.el.remove();
  }
}
