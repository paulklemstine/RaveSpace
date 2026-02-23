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
 *
 * Data is pushed in via public methods (from PeerHost or any other source)
 * rather than subscribing to Firebase directly.
 */
export class CrowdOverlay {
  private el: HTMLDivElement;
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
    this.animate();
  }

  // --- Public data push methods (replace Firebase listeners) ---

  /** Spawn a flying emoji reaction on screen */
  handleReaction(emoji: string, size?: number): void {
    this.spawnEmoji(emoji, size ?? 1);
  }

  /** Update crowd energy from tap data array. Filters stale entries (>5s) and normalizes to 40 taps/sec = 1.0 */
  handleTapData(entries: Array<{ rate: number; ts: number }>): void {
    if (entries.length === 0) {
      this.crowdEnergy = 0;
      return;
    }
    const now = Date.now();
    let total = 0;
    for (const entry of entries) {
      if (now - entry.ts < STALE_THRESHOLD_MS) {
        total += entry.rate;
      }
    }
    // Normalize: 40 taps/sec aggregate = 1.0
    this.crowdEnergy = Math.min(1, total / 40);
  }

  /** Update dominant hue from color vote data. Bins into 12 buckets (30 deg each), weighted by recency within 30s */
  handleColorData(entries: Array<{ hue: number; ts: number }>): void {
    if (entries.length === 0) {
      this.dominantHue = -1;
      return;
    }
    const now = Date.now();
    // Bin hues into 12 buckets (30° each), weighted by recency
    const bins = new Float32Array(12);
    for (const entry of entries) {
      if (now - entry.ts < 30_000) {
        const bin = Math.floor(entry.hue / 30) % 12;
        const recency = 1 - (now - entry.ts) / 30_000;
        bins[bin]! += recency;
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
  }

  /** Set the connected audience count directly */
  setConnectedCount(count: number): void {
    this.connectedCount = count;
  }

  // --- Getters ---

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

  // --- Rendering (unchanged) ---

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
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.el.remove();
  }
}
