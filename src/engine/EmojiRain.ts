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
  mass: number;
  scale: number;
  rotation: number;
  rotSpeed: number;
  opacity: number;
  age: number;
  lifetime: number;
  dancePhase: number;
  beatBounce: number;
}

const MAX_PARTICLES = 4;
const BASE_SPAWN_RATE = 0.15; // per second at silence
const MAX_SPAWN_RATE = 1.5; // per second at max energy
const BEAT_BURST_COUNT = 1;

// ─── 3-Body Physics Constants ───────────────────────────────
const G = 800; // gravitational constant (tuned for % coordinates)
const SOFTENING = 8; // prevents singularity at close range
const CENTER_PULL = 0.3; // gentle attraction toward screen center
const DRAG = 0.997; // per-frame velocity decay

// ─── Dance Constants ────────────────────────────────────────
const DANCE_SWAY_AMP = 6; // pixels of bass sway
const BEAT_BOUNCE_MAX = 0.4; // scale boost on beat
const KICK_HOP = 3; // vy impulse on kick
const TREBLE_SPIN = 80; // rotation boost from treble
const MID_WOBBLE = 8; // max skewY degrees from mid

/**
 * Ambient emoji overlay with 3-body gravitational physics.
 * Emojis orbit each other in chaotic paths and dance to the music —
 * bouncing on beats, swaying with bass, shimmering on treble.
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

  private spawn(energy: number): void {
    if (this.particles.length >= MAX_PARTICLES) {
      const oldest = this.particles.shift()!;
      oldest.el.remove();
    }

    const emoji = this.pickEmoji(energy);
    const el = document.createElement("span");
    el.textContent = emoji;

    const mass = 0.5 + Math.random() * 1.5;
    const baseScale = 0.6 + mass * 0.4;
    el.style.cssText = `
      position: absolute;
      font-size: ${baseScale * 2}rem;
      pointer-events: none;
      will-change: transform, opacity;
      filter: drop-shadow(0 0 8px rgba(255,255,255,0.25));
    `;
    this.el.appendChild(el);

    // Spawn in center region with small random orbital velocity
    const x = 30 + Math.random() * 40;
    const y = 30 + Math.random() * 40;
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 6;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    this.particles.push({
      el,
      x, y, vx, vy,
      mass,
      scale: baseScale,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 60,
      opacity: 0,
      age: 0,
      lifetime: 8 + Math.random() * 7,
      dancePhase: Math.random() * Math.PI * 2,
      beatBounce: 1,
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
    const kick = features.kick;
    const treble = features.treble;
    const mid = features.mid;
    const beatIntensity = features.beatIntensity;

    // Only spawn new particles when enabled
    if (this.enabled) {
      if (beat && !this.lastBeat) {
        const count = Math.ceil(BEAT_BURST_COUNT * (0.5 + energy * 0.5));
        for (let i = 0; i < count; i++) {
          this.spawn(energy);
        }
      }

      const rate = BASE_SPAWN_RATE + energy * (MAX_SPAWN_RATE - BASE_SPAWN_RATE);
      this.spawnAccumulator += rate * dt;
      while (this.spawnAccumulator >= 1) {
        this.spawnAccumulator -= 1;
        this.spawn(energy);
      }
    }
    this.lastBeat = beat;

    // ─── N-body gravitational forces ────────────────────────
    const ps = this.particles;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i]!;
      // Central attractor — gentle pull toward screen center
      const dxc = 50 - a.x;
      const dyc = 50 - a.y;
      a.vx += dxc * CENTER_PULL * dt;
      a.vy += dyc * CENTER_PULL * dt;

      // Pairwise gravitational attraction
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy + SOFTENING * SOFTENING;
        const dist = Math.sqrt(distSq);
        const force = G * a.mass * b.mass / distSq;
        const fx = force * dx / dist;
        const fy = force * dy / dist;

        // Newton's 3rd law: equal and opposite
        a.vx += fx * dt / a.mass;
        a.vy += fy * dt / a.mass;
        b.vx -= fx * dt / b.mass;
        b.vy -= fy * dt / b.mass;
      }
    }

    // ─── Beat bounce trigger ────────────────────────────────
    if (beat && !this.lastBeat) {
      for (const p of ps) {
        p.beatBounce = 1 + BEAT_BOUNCE_MAX * beatIntensity;
      }
    }

    // ─── Kick hop ───────────────────────────────────────────
    if (kick > 0.5) {
      for (const p of ps) {
        p.vy -= kick * KICK_HOP * dt;
      }
    }

    // ─── Update all particles ───────────────────────────────
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]!;
      p.age += dt;

      if (p.age >= p.lifetime) {
        p.el.remove();
        ps.splice(i, 1);
        continue;
      }

      // Apply velocity with drag
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= DRAG;
      p.vy *= DRAG;

      // Soft boundary — bounce off edges to keep orbits on screen
      if (p.x < 5) { p.vx += (5 - p.x) * 0.5; }
      if (p.x > 95) { p.vx -= (p.x - 95) * 0.5; }
      if (p.y < 5) { p.vy += (5 - p.y) * 0.5; }
      if (p.y > 95) { p.vy -= (p.y - 95) * 0.5; }

      // Treble-reactive rotation
      p.rotation += (p.rotSpeed + treble * TREBLE_SPIN) * dt;

      // Decay beat bounce toward 1
      p.beatBounce += (1 - p.beatBounce) * 6 * dt;

      // Fade envelope
      const fadeIn = Math.min(1, p.age / 0.6);
      const fadeOut = Math.max(0, 1 - (p.age - p.lifetime + 1.2) / 1.2);
      p.opacity = fadeIn * fadeOut * 0.75;

      // ─── Dance transforms ─────────────────────────────────
      // Bass sway — sinusoidal horizontal offset
      const swayX = Math.sin(p.dancePhase + now * 4) * bass * DANCE_SWAY_AMP;
      // Mid wobble — tilt/lean
      const skewY = mid * MID_WOBBLE * Math.sin(p.dancePhase + now * 3);

      p.el.style.left = `${p.x}%`;
      p.el.style.top = `${p.y}%`;
      p.el.style.transform =
        `translate(calc(-50% + ${swayX}px), -50%) ` +
        `scale(${p.scale * p.beatBounce}) ` +
        `rotate(${p.rotation}deg) ` +
        `skewY(${skewY}deg)`;
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
