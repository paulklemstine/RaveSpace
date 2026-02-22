import {
  ref,
  onValue,
  onChildAdded,
  query,
  orderByChild,
  startAt,
  type Unsubscribe,
} from "firebase/database";
import { db } from "../firebase/config";

interface TapEntry {
  rate: number;
  ts: number;
}

interface ColorEntry {
  hue: number;
  ts: number;
}

interface ReactionEntry {
  emoji: string;
  size?: number;
  ts: number;
}

interface FlyingEmoji {
  emoji: string;
  el: HTMLSpanElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  scale: number;
  rotation: number;
  rotSpeed: number;
  age: number;
  lifetime: number;
}

const MAX_FLYING = 30;
const EMOJI_LIFETIME = 3.0; // seconds
const STALE_THRESHOLD_MS = 5_000;

/**
 * Display-side overlay that renders crowd interactions:
 * - Flying emoji reactions across the screen
 * - Aggregated crowd energy from tap data
 * - Dominant hue from crowd color votes
 */
export class CrowdOverlay {
  private el: HTMLDivElement;
  private unsubscribers: Unsubscribe[] = [];
  private rafId = 0;
  private lastTime = 0;
  private flying: FlyingEmoji[] = [];

  // Aggregated crowd data
  private crowdEnergy = 0;
  private dominantHue = -1; // -1 = no votes
  private connectedCount = 0;

  constructor() {
    this.el = document.createElement("div");
    this.el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 150;
      overflow: hidden;
    `;
    document.body.appendChild(this.el);
  }

  start(): void {
    this.lastTime = performance.now() / 1000;

    // Listen for new reactions (only recent ones)
    const reactionsRef = query(
      ref(db, "ravespace/crowd/reactions"),
      orderByChild("ts"),
      startAt(Date.now() - 2000),
    );
    const reactUnsub = onChildAdded(reactionsRef, (snap) => {
      const data = snap.val() as ReactionEntry | null;
      if (data?.emoji) {
        this.spawnEmoji(data.emoji, data.size ?? 1);
      }
    });
    this.unsubscribers.push(reactUnsub);

    // Listen for tap data → crowd energy
    const tapsUnsub = onValue(ref(db, "ravespace/crowd/taps"), (snap) => {
      const data = snap.val() as Record<string, TapEntry> | null;
      if (!data) {
        this.crowdEnergy = 0;
        return;
      }
      const now = Date.now();
      let total = 0;
      let count = 0;
      for (const entry of Object.values(data)) {
        if (now - entry.ts < STALE_THRESHOLD_MS) {
          total += entry.rate;
          count++;
        }
      }
      // Normalize: 40 taps/sec aggregate = 1.0
      this.crowdEnergy = Math.min(1, total / 40);
    });
    this.unsubscribers.push(tapsUnsub);

    // Listen for color votes → dominant hue
    const colorsUnsub = onValue(ref(db, "ravespace/crowd/colors"), (snap) => {
      const data = snap.val() as Record<string, ColorEntry> | null;
      if (!data) {
        this.dominantHue = -1;
        return;
      }
      const now = Date.now();
      // Bin hues into 12 buckets (30° each), weighted by recency
      const bins = new Float32Array(12);
      for (const entry of Object.values(data)) {
        if (now - entry.ts < 30_000) {
          const bin = Math.floor(entry.hue / 30) % 12;
          const recency = 1 - (now - entry.ts) / 30_000;
          bins[bin] += recency;
        }
      }
      let maxBin = 0;
      let maxVal = 0;
      for (let i = 0; i < 12; i++) {
        if (bins[i]! > maxVal) {
          maxVal = bins[i]!;
          maxBin = i;
        }
      }
      this.dominantHue = maxVal > 0 ? maxBin * 30 + 15 : -1;
    });
    this.unsubscribers.push(colorsUnsub);

    // Listen for connected count
    const connectedUnsub = onValue(
      ref(db, "ravespace/crowd/connected"),
      (snap) => {
        const data = snap.val() as Record<string, unknown> | null;
        this.connectedCount = data ? Object.keys(data).length : 0;
      },
    );
    this.unsubscribers.push(connectedUnsub);

    this.animate();
  }

  /** Get crowd energy [0..1] aggregated from all tapping audience members */
  getEnergy(): number {
    return this.crowdEnergy;
  }

  /** Get dominant hue [0..360] from crowd color votes, or -1 if no votes */
  getDominantHue(): number {
    return this.dominantHue;
  }

  /** Get number of connected audience members */
  getConnectedCount(): number {
    return this.connectedCount;
  }

  private spawnEmoji(emoji: string, size: number = 1): void {
    if (this.flying.length >= MAX_FLYING) {
      // Remove oldest
      const oldest = this.flying.shift()!;
      oldest.el.remove();
    }

    const el = document.createElement("span");
    el.textContent = emoji;
    el.style.cssText = `
      position: absolute;
      font-size: clamp(2rem, 5vw, 4rem);
      pointer-events: none;
      will-change: transform, opacity;
      filter: drop-shadow(0 0 8px rgba(255,255,255,0.3));
    `;
    this.el.appendChild(el);

    const side = Math.random();
    let x: number, y: number, vx: number, vy: number;

    if (side < 0.3) {
      // From bottom
      x = Math.random() * 100;
      y = 105;
      vx = (Math.random() - 0.5) * 20;
      vy = -(15 + Math.random() * 25);
    } else if (side < 0.6) {
      // From left
      x = -5;
      y = 20 + Math.random() * 60;
      vx = 15 + Math.random() * 20;
      vy = (Math.random() - 0.5) * 15;
    } else {
      // From right
      x = 105;
      y = 20 + Math.random() * 60;
      vx = -(15 + Math.random() * 20);
      vy = (Math.random() - 0.5) * 15;
    }

    this.flying.push({
      emoji,
      el,
      x,
      y,
      vx,
      vy,
      opacity: 1,
      scale: (0.5 + Math.random() * 0.8) * size,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 180,
      age: 0,
      lifetime: EMOJI_LIFETIME + Math.random() * 1.5,
    });
  }

  private animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate);

    const now = performance.now() / 1000;
    const dt = Math.min(0.1, now - this.lastTime);
    this.lastTime = now;

    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i]!;
      f.age += dt;

      if (f.age >= f.lifetime) {
        f.el.remove();
        this.flying.splice(i, 1);
        continue;
      }

      // Physics
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy -= 3 * dt; // slight upward drift
      f.rotation += f.rotSpeed * dt;

      // Fade in/out
      const fadeIn = Math.min(1, f.age / 0.3);
      const fadeOut = Math.max(0, 1 - (f.age - f.lifetime + 0.5) / 0.5);
      f.opacity = fadeIn * fadeOut;

      // Scale pop
      const scalePop = f.age < 0.2 ? 0.5 + f.age / 0.2 * 0.5 : 1;

      f.el.style.left = `${f.x}%`;
      f.el.style.top = `${f.y}%`;
      f.el.style.transform = `translate(-50%, -50%) scale(${f.scale * scalePop}) rotate(${f.rotation}deg)`;
      f.el.style.opacity = String(f.opacity);
    }
  };

  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.el.remove();
  }
}
