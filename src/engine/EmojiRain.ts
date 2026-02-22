import type { AudioAnalyzer } from "../audio/AudioAnalyzer";

// ─── Emoji Palettes ─────────────────────────────────────────
// Curated by energy level — low = dreamy, high = chaotic

const PALETTE_COSMIC = ["✨", "💫", "⭐", "🌟", "🌠", "☄️", "🪐", "🌌"];
const PALETTE_NATURE = ["🦋", "🌸", "🌺", "🪷", "🌊", "🌀", "🍄", "🌙"];
const PALETTE_MYSTICAL = ["🔮", "🪬", "💎", "🧿", "🌙", "🔷", "💠"];
const PALETTE_HEARTS = ["💜", "💙", "💚", "💛", "🧡", "🩷", "🩵", "💖"];
const PALETTE_MUSIC = ["🎵", "🎶", "🎸", "🎹", "🎧", "🪩", "🎤", "🎷"];
const PALETTE_FIRE = ["🔥", "💥", "⚡", "🌋", "❤️‍🔥", "🌅", "☀️"];
const PALETTE_CREATURES = ["🦚", "🐉", "🦄", "👽", "👾", "💀", "🤖"];
const PALETTE_CHAOS = ["🎆", "🎇", "🧨", "🪅", "🎪", "🏮", "🎭", "🫧"];

const POOL_LOW = [...PALETTE_COSMIC, ...PALETTE_NATURE, ...PALETTE_MYSTICAL];
const POOL_MID = [...PALETTE_HEARTS, ...PALETTE_MUSIC, ...PALETTE_COSMIC];
const POOL_HIGH = [...PALETTE_FIRE, ...PALETTE_CREATURES, ...PALETTE_MUSIC, ...PALETTE_CHAOS];

interface Particle {
  el: HTMLSpanElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  rotation: number;
  rotSpeed: number;
  opacity: number;
  age: number;
  lifetime: number;
  pulsePhase: number;
}

const MAX_PARTICLES = 4;
const BASE_SPAWN_RATE = 0.15; // per second at silence
const MAX_SPAWN_RATE = 1.5; // per second at max energy
const BEAT_BURST_COUNT = 1;

/**
 * Ambient emoji rain overlay — pure art, synced to music.
 * Spawns emojis that float, spin, and pulse with the beat.
 * Low energy = gentle cosmic drift. High energy = chaotic burst.
 */
export class EmojiRain {
  private el: HTMLDivElement;
  private audio: AudioAnalyzer;
  private particles: Particle[] = [];
  private rafId = 0;
  private lastTime = 0;
  private spawnAccumulator = 0;
  private lastBeat = false;
  private enabled = true;
  private lockedEmoji: string | null = null;

  constructor(audio: AudioAnalyzer) {
    this.audio = audio;
    this.el = document.createElement("div");
    this.el.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 50;
      overflow: hidden;
    `;
    document.body.appendChild(this.el);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEmoji(emoji: string): void {
    this.lockedEmoji = emoji;
  }

  start(): void {
    this.lastTime = performance.now() / 1000;
    this.animate();
  }

  private pickEmoji(energy: number): string {
    if (this.lockedEmoji) return this.lockedEmoji;
    const pool = energy < 0.3 ? POOL_LOW : energy < 0.6 ? POOL_MID : POOL_HIGH;
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  private spawn(energy: number, burst = false): void {
    if (this.particles.length >= MAX_PARTICLES) {
      const oldest = this.particles.shift()!;
      oldest.el.remove();
    }

    const emoji = this.pickEmoji(energy);
    const el = document.createElement("span");
    el.textContent = emoji;

    const baseScale = burst ? 1.2 + Math.random() * 1.8 : 0.5 + Math.random() * 1.0;
    el.style.cssText = `
      position: absolute;
      font-size: ${baseScale * 2}rem;
      pointer-events: none;
      will-change: transform, opacity;
      filter: drop-shadow(0 0 8px rgba(255,255,255,0.25));
    `;
    this.el.appendChild(el);

    let x: number, y: number, vx: number, vy: number;

    if (burst) {
      // Explode from center
      const angle = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 35;
      x = 40 + Math.random() * 20;
      y = 40 + Math.random() * 20;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
    } else {
      // Float in from edges
      const side = Math.random();
      if (side < 0.4) {
        x = Math.random() * 100;
        y = 105;
        vx = (Math.random() - 0.5) * 8;
        vy = -(4 + Math.random() * 10);
      } else if (side < 0.7) {
        x = -5;
        y = Math.random() * 100;
        vx = 3 + Math.random() * 7;
        vy = (Math.random() - 0.5) * 5;
      } else {
        x = 105;
        y = Math.random() * 100;
        vx = -(3 + Math.random() * 7);
        vy = (Math.random() - 0.5) * 5;
      }
    }

    this.particles.push({
      el,
      x, y, vx, vy,
      scale: baseScale,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 120,
      opacity: 0,
      age: 0,
      lifetime: burst ? 1.8 + Math.random() * 1.5 : 4 + Math.random() * 5,
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  private animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate);

    const now = performance.now() / 1000;
    const dt = Math.min(0.1, now - this.lastTime);
    this.lastTime = now;

    const features = this.audio.getFeatures();
    const energy = features.energy;
    const beat = features.beat;
    const bass = features.bass;

    // Only spawn new particles when enabled
    if (this.enabled) {
      // Beat burst — explode emojis from center on each beat
      if (beat && !this.lastBeat) {
        const count = Math.ceil(BEAT_BURST_COUNT * (0.5 + energy * 0.5));
        for (let i = 0; i < count; i++) {
          this.spawn(energy, true);
        }
      }

      // Continuous ambient drift
      const rate = BASE_SPAWN_RATE + energy * (MAX_SPAWN_RATE - BASE_SPAWN_RATE);
      this.spawnAccumulator += rate * dt;
      while (this.spawnAccumulator >= 1) {
        this.spawnAccumulator -= 1;
        this.spawn(energy);
      }
    }
    this.lastBeat = beat;

    // Update all particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.age += dt;

      if (p.age >= p.lifetime) {
        p.el.remove();
        this.particles.splice(i, 1);
        continue;
      }

      // Physics — gentle upward drift + air resistance
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 1.5 * dt;
      p.vx *= 0.998;
      p.rotation += p.rotSpeed * dt;

      // Fade envelope
      const fadeIn = Math.min(1, p.age / 0.4);
      const fadeOut = Math.max(0, 1 - (p.age - p.lifetime + 0.8) / 0.8);
      p.opacity = fadeIn * fadeOut * 0.65;

      // Bass-reactive pulse
      const bassPulse = 1 + bass * 0.2 * Math.sin(p.pulsePhase + now * 4);

      p.el.style.left = `${p.x}%`;
      p.el.style.top = `${p.y}%`;
      p.el.style.transform = `translate(-50%, -50%) scale(${p.scale * bassPulse}) rotate(${p.rotation}deg)`;
      p.el.style.opacity = String(p.opacity);
    }
  };

  dispose(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    for (const p of this.particles) p.el.remove();
    this.particles = [];
    this.el.remove();
  }
}
