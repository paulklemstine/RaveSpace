precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;

uniform float uSpeed;
uniform float uLayers;
uniform float uSymmetry;
uniform float uAudioReactivity;
uniform int uColorScheme;

#define PI 3.14159265
#define TAU 6.28318530

// --- Cosine palettes ---
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

vec3 getColor(float t) {
  if (uColorScheme == 0) // neon
    return cosPalette(t, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.1, 0.2));
  if (uColorScheme == 1) // ethereal
    return cosPalette(t, vec3(0.5), vec3(0.5), vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
  if (uColorScheme == 2) // golden
    return cosPalette(t, vec3(0.5, 0.4, 0.3), vec3(0.5, 0.4, 0.2), vec3(1.0, 0.8, 0.5), vec3(0.0, 0.05, 0.1));
  // rainbow
  return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67)));
}

// Smooth circle SDF
float circle(vec2 p, float r) {
  return length(p) - r;
}

// Flower of life: 6 circles around a center circle
float flowerOfLife(vec2 p, float r) {
  float d = circle(p, r);
  for (int i = 0; i < 6; i++) {
    float a = float(i) * TAU / 6.0;
    vec2 offset = vec2(cos(a), sin(a)) * r;
    d = min(d, circle(p - offset, r));
  }
  return d;
}

// Seed of life: inner ring of the flower
float seedOfLife(vec2 p, float r) {
  float d = circle(p, r * 0.5);
  for (int i = 0; i < 6; i++) {
    float a = float(i) * TAU / 6.0;
    vec2 offset = vec2(cos(a), sin(a)) * r * 0.5;
    d = min(d, circle(p - offset, r * 0.5));
  }
  return d;
}

// Rotate 2D point
vec2 rot(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Apply N-fold symmetry
vec2 foldSymmetry(vec2 p, float n) {
  float a = atan(p.y, p.x);
  float sector = TAU / n;
  a = mod(a + sector * 0.5, sector) - sector * 0.5;
  return vec2(cos(a), sin(a)) * length(p);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed * 0.5;

  // Audio reactivity multipliers
  float bassR = uBass * uAudioReactivity;
  float midR = uMid * uAudioReactivity;
  float trebleR = uTreble * uAudioReactivity;
  float energyR = uEnergy * uAudioReactivity;

  vec3 totalColor = vec3(0.0);
  float totalGlow = 0.0;

  float numLayers = floor(uLayers);
  float symmetry = floor(uSymmetry);

  for (float i = 0.0; i < 6.0; i++) {
    if (i >= numLayers) break;

    float layerPhase = i / numLayers;

    // Each layer rotates at a different speed, alternating directions
    float rotDir = mod(i, 2.0) == 0.0 ? 1.0 : -1.0;
    float rotSpeed = (0.3 + layerPhase * 0.5) * rotDir;
    rotSpeed += bassR * 0.3 * rotDir; // bass accelerates rotation

    vec2 p = rot(uv, time * rotSpeed + layerPhase * PI);

    // Apply symmetry folding
    p = foldSymmetry(p, symmetry);

    // Scale each layer differently
    float scale = 1.5 + i * 0.8 - energyR * 0.3;
    p *= scale;

    // Audio-reactive radius breathing
    float radius = 0.5 + sin(time * 0.3 + i) * 0.05 + bassR * 0.1;

    // Flower of life pattern
    float flower = flowerOfLife(p, radius);

    // Ring (outline) from SDF
    float ring = abs(flower) - (0.01 + trebleR * 0.01);
    float ringGlow = exp(-max(ring, 0.0) * (40.0 + midR * 20.0));

    // Inner seed pattern for variety
    float seed = seedOfLife(p, radius);
    float seedRing = abs(seed) - 0.008;
    float seedGlow = exp(-max(seedRing, 0.0) * 60.0) * 0.5;

    // Color this layer
    float colorT = layerPhase + time * 0.1 + flower * 0.5;
    vec3 layerColor = getColor(colorT);

    // Accumulate with layer alpha falloff
    float layerAlpha = 1.0 - layerPhase * 0.3;
    totalColor += layerColor * (ringGlow + seedGlow) * layerAlpha;
    totalGlow += (ringGlow + seedGlow) * layerAlpha;
  }

  // Outer ring mandala border
  float outerRing = abs(length(uv) - (1.2 + sin(time * 0.5) * 0.1 + bassR * 0.15));
  float outerGlow = exp(-outerRing * 30.0) * 0.5;
  totalColor += getColor(time * 0.2) * outerGlow;

  // Radiating lines from center
  float a = atan(uv.y, uv.x);
  float rays = abs(sin(a * symmetry + time * 0.5));
  rays = pow(rays, 20.0) * 0.3 * energyR;
  float rayFade = exp(-length(uv) * 1.0);
  totalColor += getColor(a / TAU + time * 0.1) * rays * rayFade;

  // Center glow
  float center = exp(-length(uv) * 3.0) * (0.2 + energyR * 0.5);
  totalColor += getColor(time * 0.15) * center;

  // Treble sparkle dots at intersections
  float sparkle = pow(totalGlow, 3.0) * trebleR * 2.0;
  totalColor += vec3(1.0, 0.95, 0.9) * sparkle;

  // Vignette
  float vignette = 1.0 - length(uv) * 0.35;
  totalColor *= max(vignette, 0.0);

  // Energy brightness
  totalColor *= 0.6 + energyR * 0.6;

  gl_FragColor = vec4(totalColor, 1.0);
}
