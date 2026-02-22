precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uKick;
uniform float uBeatIntensity;
uniform float uSpectralFlux;
uniform vec2 uResolution;

uniform float uSpeed;
uniform float uRadius;
uniform float uTwist;
uniform float uGlowIntensity;
uniform float uAudioReactivity;
uniform int uColorScheme;

#define PI 3.14159265
#define TAU 6.28318530

// --- Cosine palettes ---
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

vec3 cyberColor(float t) {
  return cosPalette(t,
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.5),
    vec3(1.0, 1.0, 1.0),
    vec3(0.00, 0.10, 0.20)
  );
}

vec3 dmtColor(float t) {
  return cosPalette(t,
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.5),
    vec3(1.0, 1.0, 0.5),
    vec3(0.80, 0.90, 0.30)
  );
}

vec3 voidColor(float t) {
  return cosPalette(t,
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.5),
    vec3(1.0, 0.7, 0.4),
    vec3(0.00, 0.15, 0.20)
  );
}

vec3 acidColor(float t) {
  return 0.5 + 0.5 * cos(TAU * (t * 2.0 + vec3(0.0, 0.33, 0.67)));
}

vec3 getColor(float t) {
  if (uColorScheme == 0) return cyberColor(t);
  if (uColorScheme == 1) return dmtColor(t);
  if (uColorScheme == 2) return voidColor(t);
  return acidColor(t);
}

// --- Noise for texture detail ---
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed;

  // Polar coordinates
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Audio-reactive wall breathing: kick for sharp punch + bass for sustain
  float breathe = 1.0 + sin(time * 0.7) * 0.08 + uKick * 0.5 * uAudioReactivity + uBass * 0.15 * uAudioReactivity;

  // Tunnel depth: inverse radius with breathing walls
  float depth = uRadius / (r * breathe + 0.001);

  // Forward motion: constant + energy bursts + beat intensity lurch
  float forwardSpeed = time * 2.0 + uEnergy * 5.0 * uAudioReactivity + uBeatIntensity * 5.0 * uAudioReactivity;
  float z = depth + forwardSpeed;

  // Twist increases with depth
  float tw = a + depth * uTwist * 0.4 + time * 0.15;

  // ---- Primary grid layer (large hexagonal-ish cells) ----
  // Map tunnel surface to grid coordinates
  float gridU = tw / TAU * 8.0;
  float gridV = z * 0.4;

  // Ring lines (across tunnel) — spectral flux ripples the rings
  float ringLine = abs(fract(gridV + sin(z * 3.0 + uSpectralFlux * 4.0) * 0.05) - 0.5) * 2.0;
  float ring = exp(-ringLine * 12.0) * 1.2;

  // Segment lines (along tunnel)
  float segLine = abs(fract(gridU) - 0.5) * 2.0;
  float seg = exp(-segLine * 12.0) * 1.2;

  // Cross braces (diagonal detail)
  float crossLine = abs(fract(gridU + gridV) - 0.5) * 2.0;
  float cross = exp(-crossLine * 16.0) * 0.6;

  // Combined wireframe with glow
  float wireframe = ring + seg + cross;

  // ---- Secondary layer (finer detail) ----
  float gridU2 = tw / TAU * 24.0;
  float gridV2 = z * 1.2;
  float ring2 = exp(-abs(fract(gridV2) - 0.5) * 2.0 * 20.0) * 0.4;
  float seg2 = exp(-abs(fract(gridU2) - 0.5) * 2.0 * 20.0) * 0.4;
  float fineDetail = ring2 + seg2;

  // ---- Cell interior glow ----
  // Each cell gets a subtle fill based on its position
  vec2 cellId = floor(vec2(gridU, gridV));
  float cellHash = hash(cellId);
  float cellFill = cellHash * 0.15 * (0.5 + uMid * uAudioReactivity);

  // ---- Pulsing rings traveling forward ----
  float pulsePhase = fract(z * 0.15 - time * 0.5);
  float pulse = exp(-pulsePhase * 8.0) * uEnergy * uAudioReactivity * 2.0;

  // ---- Color computation ----
  float colorPhase = z * 0.015 + a * 0.08 + time * 0.05;
  colorPhase += uMid * 0.2 * uAudioReactivity;
  vec3 mainColor = getColor(colorPhase);

  // Secondary color offset for depth
  vec3 accentColor = getColor(colorPhase + 0.3);

  // ---- Treble sparkle on grid intersections ----
  float sparkle = ring * seg; // bright at intersections
  sparkle *= uTreble * uAudioReactivity * 3.0;

  // ---- Depth fog: darker at edges (close to camera), brighter toward center ----
  float fog = smoothstep(0.0, 0.3, r) * exp(-r * 0.8);

  // ---- Center light (tunnel vanishing point glow) + beat intensity edge glow ----
  float centerGlow = exp(-r * 4.0) * (0.3 + uEnergy * 0.7 * uAudioReactivity + uBeatIntensity * 2.0 * uAudioReactivity);
  vec3 centerColor = getColor(time * 0.1) * 1.5;

  // ---- Bass throb: overall brightness pulse on bass hits ----
  float bassThrobFactor = 1.0 + uBass * 0.4 * uAudioReactivity;

  // ---- Final compositing ----
  vec3 result = vec3(0.0);

  // Wireframe glow
  result += mainColor * wireframe * uGlowIntensity * fog;

  // Fine detail layer
  result += accentColor * fineDetail * uGlowIntensity * 0.5 * fog;

  // Cell fill
  result += mainColor * cellFill * fog;

  // Forward-traveling pulse rings
  result += accentColor * pulse * fog;

  // Sparkle at intersections
  result += vec3(1.0, 0.9, 0.95) * sparkle * fog;

  // Center vanishing point
  result += centerColor * centerGlow;

  // Apply bass throb
  result *= bassThrobFactor;

  // Global energy brightness
  result *= 0.5 + uEnergy * 0.7 * uAudioReactivity;

  // Subtle vignette
  result *= smoothstep(2.0, 0.3, r);

  // Clamp to prevent oversaturation
  result = min(result, vec3(2.0));

  gl_FragColor = vec4(result, 1.0);
}
