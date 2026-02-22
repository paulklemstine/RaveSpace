export type AnimationStyleName =
  | "wave"
  | "glitch"
  | "spiralIn"
  | "bounceDrop"
  | "zoomBlast"
  | "typewriter";

export const ANIMATION_STYLES: AnimationStyleName[] = [
  "wave",
  "glitch",
  "spiralIn",
  "bounceDrop",
  "zoomBlast",
  "typewriter",
];

export interface CalloutAnimation {
  entrance(
    spans: HTMLSpanElement[],
    glowSpans: HTMLSpanElement[],
    t: number,
    progress: number,
  ): void;
  hold(
    spans: HTMLSpanElement[],
    glowSpans: HTMLSpanElement[],
    t: number,
  ): void;
  exit(
    spans: HTMLSpanElement[],
    glowSpans: HTMLSpanElement[],
    t: number,
    progress: number,
  ): void;
}

// ─── Easing Utilities ──────────────────────────────────────────

function easeOutElastic(x: number): number {
  if (x === 0 || x === 1) return x;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

function easeOutBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function easeInCubic(x: number): number {
  return x * x * x;
}

function rainbowHue(t: number, offset: number): string {
  const hue = (t * 60 + offset * 30) % 360;
  return `hsl(${hue}, 100%, 60%)`;
}

function rainbowBgPos(t: number, charIdx: number): string {
  const x = (t * 30 + charIdx * 20) % 600;
  const y = (t * 15 + charIdx * 10) % 600;
  return `${x}% ${y}%`;
}

function applyTransform(
  span: HTMLSpanElement,
  glowSpan: HTMLSpanElement,
  tx: number,
  ty: number,
  rot: number,
  scale: number,
  opacity = 1,
): void {
  const transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${scale})`;
  span.style.transform = transform;
  span.style.opacity = String(opacity);
  glowSpan.style.transform = `${transform} scale(1.05)`;
  glowSpan.style.opacity = String(opacity * 0.7);
}

// ─── Wave ──────────────────────────────────────────────────────

const wave: CalloutAnimation = {
  entrance(spans, glowSpans, t, progress) {
    for (let i = 0; i < spans.length; i++) {
      const stagger = Math.min(1, Math.max(0, progress * spans.length * 0.8 - i * 0.3));
      const ease = easeOutElastic(stagger);
      const y = (1 - ease) * 80;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(spans[i]!, glowSpans[i]!, 0, y, 0, ease, ease);
    }
  },
  hold(spans, glowSpans, t) {
    for (let i = 0; i < spans.length; i++) {
      const phase = i * 0.4;
      const waveY = Math.sin(t * 3.0 + phase) * 15;
      const rot = Math.sin(t * 2.0 + phase * 0.7) * 8;
      const scale = 1.0 + Math.sin(t * 4.0 + phase * 0.5) * 0.08;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(spans[i]!, glowSpans[i]!, 0, waveY, rot, scale);
    }
  },
  exit(spans, glowSpans, t, progress) {
    for (let i = 0; i < spans.length; i++) {
      const stagger = Math.min(1, Math.max(0, progress * spans.length * 0.8 - (spans.length - 1 - i) * 0.3));
      const y = stagger * 120;
      const opacity = 1 - stagger;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(spans[i]!, glowSpans[i]!, 0, y, stagger * 15, 1 - stagger * 0.3, opacity);
    }
  },
};

// ─── Glitch ────────────────────────────────────────────────────

const glitch: CalloutAnimation = {
  entrance(spans, glowSpans, t, progress) {
    // Chars appear in pseudo-random order with flash
    const order = getShuffledIndices(spans.length);
    const revealCount = Math.floor(progress * spans.length * 1.3);
    for (let i = 0; i < spans.length; i++) {
      const revealed = order[i]! < revealCount;
      const flash = revealed && Math.random() > 0.7 ? 1.5 : 1;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(
        spans[i]!, glowSpans[i]!,
        revealed ? 0 : (Math.random() - 0.5) * 40,
        revealed ? 0 : (Math.random() - 0.5) * 40,
        revealed ? 0 : (Math.random() - 0.5) * 30,
        revealed ? flash : 0,
        revealed ? 1 : 0,
      );
    }
  },
  hold(spans, glowSpans, t) {
    const burst = Math.sin(t * 7) > 0.85;
    for (let i = 0; i < spans.length; i++) {
      const jitterX = (Math.random() - 0.5) * (burst ? 20 : 3);
      const jitterY = (Math.random() - 0.5) * (burst ? 15 : 2);
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      // Chromatic split on burst
      if (burst) {
        spans[i]!.style.textShadow = `${-3}px 0 #ff0000, 3px 0 #00ffff`;
      } else {
        spans[i]!.style.textShadow = "none";
      }
      applyTransform(spans[i]!, glowSpans[i]!, jitterX, jitterY, 0, 1);
    }
  },
  exit(spans, glowSpans, t, progress) {
    const order = getShuffledIndices(spans.length);
    const hideCount = Math.floor(progress * spans.length * 1.3);
    for (let i = 0; i < spans.length; i++) {
      const hidden = order[i]! < hideCount;
      const jitter = progress * 15;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      spans[i]!.style.textShadow = "none";
      applyTransform(
        spans[i]!, glowSpans[i]!,
        hidden ? 0 : (Math.random() - 0.5) * jitter,
        hidden ? 0 : (Math.random() - 0.5) * jitter,
        0,
        hidden ? 0 : 1,
        hidden ? 0 : 1,
      );
    }
  },
};

// Stable shuffle for a given length (seeded by length to avoid per-frame reshuffling)
function getShuffledIndices(len: number): number[] {
  const arr = Array.from({ length: len }, (_, i) => i);
  // Simple deterministic shuffle seeded by length
  let seed = len * 31;
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ─── Spiral In ─────────────────────────────────────────────────

const spiralIn: CalloutAnimation = {
  entrance(spans, glowSpans, t, progress) {
    const goldenAngle = 137.508 * (Math.PI / 180);
    for (let i = 0; i < spans.length; i++) {
      const angle = i * goldenAngle;
      const ease = easeOutCubic(Math.min(1, Math.max(0, progress * 2 - i / spans.length)));
      const radius = (1 - ease) * 300;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const rot = (1 - ease) * 360;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(spans[i]!, glowSpans[i]!, x, y, rot, ease, ease);
    }
  },
  hold(spans, glowSpans, t) {
    for (let i = 0; i < spans.length; i++) {
      const breathe = 1.0 + Math.sin(t * 2.0 + i * 0.3) * 0.05;
      const hue = (t * 80 + i * (360 / spans.length)) % 360;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = `hsl(${hue}, 100%, 60%)`;
      applyTransform(spans[i]!, glowSpans[i]!, 0, 0, 0, breathe);
    }
  },
  exit(spans, glowSpans, t, progress) {
    const goldenAngle = 137.508 * (Math.PI / 180);
    for (let i = 0; i < spans.length; i++) {
      const angle = i * goldenAngle + Math.PI;
      const ease = easeOutCubic(Math.min(1, Math.max(0, progress * 2 - i / spans.length)));
      const radius = ease * 400;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(spans[i]!, glowSpans[i]!, x, y, ease * 360, 1 - ease, 1 - ease);
    }
  },
};

// ─── Bounce Drop ───────────────────────────────────────────────

const bounceDrop: CalloutAnimation = {
  entrance(spans, glowSpans, t, progress) {
    for (let i = 0; i < spans.length; i++) {
      const staggerDelay = i * 0.08;
      const localProgress = Math.min(1, Math.max(0, (progress - staggerDelay) / (1 - staggerDelay * spans.length * 0.3)));
      const bounce = easeOutBounce(localProgress);
      const y = (1 - bounce) * -200;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(spans[i]!, glowSpans[i]!, 0, y, 0, localProgress > 0 ? 1 : 0, localProgress > 0 ? 1 : 0);
    }
  },
  hold(spans, glowSpans, t) {
    for (let i = 0; i < spans.length; i++) {
      const idleBounce = Math.abs(Math.sin(t * 1.5 + i * 0.5)) * 5;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(spans[i]!, glowSpans[i]!, 0, -idleBounce, 0, 1);
    }
  },
  exit(spans, glowSpans, t, progress) {
    for (let i = 0; i < spans.length; i++) {
      const ease = easeInCubic(Math.min(1, Math.max(0, progress * 1.5 - i * 0.05)));
      const y = ease * 300;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(spans[i]!, glowSpans[i]!, 0, y, ease * -10, 1, 1 - ease);
    }
  },
};

// ─── Zoom Blast ────────────────────────────────────────────────

const zoomBlast: CalloutAnimation = {
  entrance(spans, glowSpans, t, progress) {
    const ease = easeOutElastic(progress);
    const containerScale = 5 - 4 * ease;
    const blur = (1 - progress) * 20;
    for (let i = 0; i < spans.length; i++) {
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      spans[i]!.style.filter = `drop-shadow(0 0 8px currentColor) blur(${blur}px)`;
      applyTransform(spans[i]!, glowSpans[i]!, 0, 0, 0, containerScale, progress);
    }
  },
  hold(spans, glowSpans, t) {
    const pulse = 1.0 + Math.sin(t * 3) * 0.03;
    for (let i = 0; i < spans.length; i++) {
      const hue = (t * 80 + i * (360 / spans.length)) % 360;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = `hsl(${hue}, 100%, 60%)`;
      spans[i]!.style.filter = "drop-shadow(0 0 8px currentColor)";
      applyTransform(spans[i]!, glowSpans[i]!, 0, 0, 0, pulse);
    }
  },
  exit(spans, glowSpans, t, progress) {
    const ease = easeInCubic(progress);
    const containerScale = 1 + ease * 4;
    const blur = ease * 20;
    for (let i = 0; i < spans.length; i++) {
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      spans[i]!.style.filter = `drop-shadow(0 0 8px currentColor) blur(${blur}px)`;
      applyTransform(spans[i]!, glowSpans[i]!, 0, 0, 0, containerScale, 1 - ease);
    }
  },
};

// ─── Typewriter ────────────────────────────────────────────────

const typewriter: CalloutAnimation = {
  entrance(spans, glowSpans, t, progress) {
    const revealCount = Math.floor(progress * spans.length * 1.25);
    for (let i = 0; i < spans.length; i++) {
      const revealed = i < revealCount;
      const justRevealed = i === revealCount - 1;
      const pop = justRevealed ? 1.2 : 1;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(spans[i]!, glowSpans[i]!, 0, 0, 0, revealed ? pop : 0, revealed ? 1 : 0);
      // Cursor effect on latest character
      if (justRevealed) {
        spans[i]!.style.borderRight = "3px solid #fff";
      } else {
        spans[i]!.style.borderRight = "none";
      }
    }
  },
  hold(spans, glowSpans, t) {
    const cursorVisible = Math.sin(t * 6) > 0;
    for (let i = 0; i < spans.length; i++) {
      const glowPulse = 1.0 + Math.sin(t * 2 + i * 0.2) * 0.04;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      applyTransform(spans[i]!, glowSpans[i]!, 0, 0, 0, glowPulse);
      spans[i]!.style.borderRight = "none";
    }
    // Blinking cursor on last char
    if (spans.length > 0) {
      spans[spans.length - 1]!.style.borderRight = cursorVisible ? "3px solid #fff" : "3px solid transparent";
    }
  },
  exit(spans, glowSpans, t, progress) {
    // Erase right to left
    const eraseCount = Math.floor(progress * spans.length * 1.3);
    for (let i = 0; i < spans.length; i++) {
      const reverseIdx = spans.length - 1 - i;
      const erased = reverseIdx < eraseCount;
      spans[i]!.style.backgroundPosition = rainbowBgPos(t, i);
      glowSpans[i]!.style.color = rainbowHue(t, i);
      spans[i]!.style.borderRight = "none";
      applyTransform(spans[i]!, glowSpans[i]!, 0, 0, 0, erased ? 0 : 1, erased ? 0 : 1);
    }
  },
};

// ─── Registry ──────────────────────────────────────────────────

export const ANIMATIONS: Record<AnimationStyleName, CalloutAnimation> = {
  wave,
  glitch,
  spiralIn,
  bounceDrop,
  zoomBlast,
  typewriter,
};

export function pickRandomAnimation(): AnimationStyleName {
  return ANIMATION_STYLES[Math.floor(Math.random() * ANIMATION_STYLES.length)]!;
}
