import { ref, onValue, query, orderByChild, limitToLast, type Unsubscribe } from "firebase/database";
import { db } from "../firebase/config";
import {
  ANIMATIONS,
  pickRandomAnimation,
  type CalloutAnimation,
} from "./callout-animations";

interface QueueEntry {
  key: string;
  name: string;
  timestamp: number;
}

type CalloutState = "idle" | "entering" | "holding" | "exiting";

const ENTRANCE_DURATION = 0.8;
const EXIT_DURATION = 1.0;
const GAP_BETWEEN_CALLOUTS_MS = 3_000;
const MAX_QUEUE_SIZE = 200;
const HOLD_DURATION = 5;

/**
 * Psychedelic animated text overlay for audience shoutouts, VJ callouts, and AI phrases.
 * Keeps all audience submissions and cycles through them endlessly with random animations.
 */
export class CalloutOverlay {
  private el: HTMLDivElement;
  private textContainer: HTMLDivElement;
  private glowLayer: HTMLDivElement;
  private charSpans: HTMLSpanElement[] = [];
  private glowSpans: HTMLSpanElement[] = [];
  private unsubscribers: Unsubscribe[] = [];
  private rafId = 0;
  private showStartTime = 0;
  private showDuration = HOLD_DURATION;
  private isShowing = false;

  // Animation state machine
  private state: CalloutState = "idle";
  private stateStartTime = 0;
  private currentAnimation: CalloutAnimation = ANIMATIONS.wave;

  // Cycling queue — keep all entries, round-robin through them
  private queue: QueueEntry[] = [];
  private cycleIndex = 0;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;

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
    // Listen for queue changes — keep all entries in memory, cycle through them
    const queueRef = query(
      ref(db, "ravespace/callouts/queue"),
      orderByChild("timestamp"),
      limitToLast(MAX_QUEUE_SIZE),
    );
    const unsub = onValue(queueRef, (snapshot) => {
      const entries: QueueEntry[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        if (val?.name) {
          entries.push({
            key: child.key!,
            name: val.name,
            timestamp: val.timestamp ?? 0,
          });
        }
      });
      // Sort by timestamp ascending
      entries.sort((a, b) => a.timestamp - b.timestamp);
      this.queue = entries;

      // If we just got our first entry and nothing is showing, kick off the cycle
      if (entries.length > 0 && this.state === "idle" && !this.gapTimer) {
        this.showNext();
      }
    });
    this.unsubscribers.push(unsub);
  }

  // ─── Cycling Queue ────────────────────────────────────────────

  private showNext(): void {
    if (this.queue.length === 0) return;

    // Wrap index
    if (this.cycleIndex >= this.queue.length) {
      this.cycleIndex = 0;
    }

    const entry = this.queue[this.cycleIndex]!;
    this.cycleIndex++;
    this.show(entry.name, HOLD_DURATION);
  }

  private scheduleNext(): void {
    if (this.gapTimer) clearTimeout(this.gapTimer);
    this.gapTimer = setTimeout(() => {
      this.gapTimer = null;
      this.showNext();
    }, GAP_BETWEEN_CALLOUTS_MS);
  }

  // ─── Show / Animation ─────────────────────────────────────────

  private show(name: string, duration: number): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);

    this.showDuration = duration;
    this.charSpans = [];
    this.glowSpans = [];
    this.textContainer.innerHTML = "";
    this.glowLayer.innerHTML = "";

    // Pick a random animation style each time
    this.currentAnimation = ANIMATIONS[pickRandomAnimation()];

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
    this.state = "entering";
    this.stateStartTime = performance.now();

    this.textContainer.style.opacity = "1";
    this.glowLayer.style.opacity = "0.7";

    this.animate();
  }

  private animate = (): void => {
    const now = performance.now();
    const t = (now - this.showStartTime) / 1000;
    const stateElapsed = (now - this.stateStartTime) / 1000;

    switch (this.state) {
      case "entering": {
        const progress = Math.min(1, stateElapsed / ENTRANCE_DURATION);
        this.currentAnimation.entrance(this.charSpans, this.glowSpans, t, progress);
        if (progress >= 1) {
          this.state = "holding";
          this.stateStartTime = now;
        }
        break;
      }

      case "holding": {
        this.currentAnimation.hold(this.charSpans, this.glowSpans, t);
        if (stateElapsed >= this.showDuration) {
          this.state = "exiting";
          this.stateStartTime = now;
          this.isShowing = false;
        }
        break;
      }

      case "exiting": {
        const progress = Math.min(1, stateElapsed / EXIT_DURATION);
        this.currentAnimation.exit(this.charSpans, this.glowSpans, t, progress);
        if (progress >= 1) {
          this.state = "idle";
          this.textContainer.style.opacity = "0";
          this.glowLayer.style.opacity = "0";
          // Schedule next callout in the cycle
          this.scheduleNext();
          return; // Stop animation loop
        }
        break;
      }

      case "idle":
        return;
    }

    this.rafId = requestAnimationFrame(this.animate);
  };

  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    if (this.gapTimer) clearTimeout(this.gapTimer);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.el.remove();
  }
}
