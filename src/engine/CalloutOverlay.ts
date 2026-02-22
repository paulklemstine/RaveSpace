import { ref, onValue, remove, get, query, orderByChild, limitToFirst, type Unsubscribe } from "firebase/database";
import { db } from "../firebase/config";
import {
  ANIMATIONS,
  pickRandomAnimation,
  type AnimationStyleName,
  type CalloutAnimation,
} from "./callout-animations";

interface ActiveCallout {
  name: string;
  startTime: number;
  duration: number;
  source?: "audience" | "vj" | "ai";
  animationStyle?: AnimationStyleName;
}

type CalloutState = "idle" | "entering" | "holding" | "exiting";

const ENTRANCE_DURATION = 0.8;
const EXIT_DURATION = 1.0;
const DEFAULT_QUEUE_INTERVAL = 15;

/**
 * Psychedelic animated text overlay for audience shoutouts, VJ callouts, and AI phrases.
 * Supports multiple animation styles with entrance/hold/exit state machine.
 * Auto-processes audience queue when no active callout is showing.
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
  private showDuration = 5;
  private isShowing = false;

  // Animation state machine
  private state: CalloutState = "idle";
  private stateStartTime = 0;
  private currentAnimation: CalloutAnimation = ANIMATIONS.wave;

  // Queue auto-processing
  private queueCheckTimer: ReturnType<typeof setInterval> | null = null;
  private queueInterval = DEFAULT_QUEUE_INTERVAL;

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
    // Listen for active callout
    const activeRef = ref(db, "ravespace/callouts/active");
    const unsub = onValue(activeRef, (snapshot) => {
      const data = snapshot.val() as ActiveCallout | null;
      if (data?.name) {
        this.show(data.name, data.duration ?? 5, data.animationStyle);
      }
    });
    this.unsubscribers.push(unsub);

    // Listen for settings changes (queue interval)
    const settingsRef = ref(db, "ravespace/callouts/settings");
    const settingsUnsub = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.interval) {
        this.queueInterval = data.interval;
      }
      this.setupQueueProcessing();
    });
    this.unsubscribers.push(settingsUnsub);

    // Start queue auto-processing
    this.setupQueueProcessing();
  }

  // ─── Queue Auto-Processing ────────────────────────────────────

  private setupQueueProcessing(): void {
    if (this.queueCheckTimer) {
      clearInterval(this.queueCheckTimer);
    }
    this.queueCheckTimer = setInterval(
      () => void this.processQueue(),
      this.queueInterval * 1000,
    );
  }

  private async processQueue(): Promise<void> {
    // Don't pop if currently showing something
    if (this.isShowing || this.state !== "idle") return;

    try {
      const queueRef = query(
        ref(db, "ravespace/callouts/queue"),
        orderByChild("timestamp"),
        limitToFirst(1),
      );
      const snapshot = await get(queueRef);
      if (!snapshot.exists()) return;

      let oldest: { key: string; name: string } | null = null;
      snapshot.forEach((child) => {
        if (!oldest) {
          oldest = { key: child.key!, name: child.val().name };
        }
      });

      if (oldest) {
        const { key, name } = oldest;
        // Write to active with audience source
        const { set } = await import("firebase/database");
        await set(ref(db, "ravespace/callouts/active"), {
          name,
          startTime: Date.now(),
          duration: 5,
          source: "audience" as const,
          animationStyle: pickRandomAnimation(),
        });
        // Remove from queue
        await remove(ref(db, `ravespace/callouts/queue/${key}`));
      }
    } catch {
      // Queue read failed — will retry next interval
    }
  }

  // ─── Show / Animation ─────────────────────────────────────────

  private show(name: string, duration: number, animationStyle?: AnimationStyleName): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);

    this.showDuration = duration;
    this.charSpans = [];
    this.glowSpans = [];
    this.textContainer.innerHTML = "";
    this.glowLayer.innerHTML = "";

    // Pick animation
    const styleName = animationStyle && ANIMATIONS[animationStyle]
      ? animationStyle
      : pickRandomAnimation();
    this.currentAnimation = ANIMATIONS[styleName];

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
          // Clear active so queue can pop next
          void remove(ref(db, "ravespace/callouts/active"));
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
    if (this.queueCheckTimer) clearInterval(this.queueCheckTimer);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.el.remove();
  }
}
