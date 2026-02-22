precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;

uniform float uSpeed;
uniform float uComplexity;
uniform float uWarpIntensity;
uniform float uAudioReactivity;
uniform int uColorScheme;

#define PI 3.14159265
#define TAU 6.28318530

// --- Cosine palettes ---
vec3 getColor(float t) {
  if (uColorScheme == 0) // alien
    return 0.5 + 0.5 * cos(TAU * (t * 0.8 + vec3(0.10, 0.20, 0.30)));
  if (uColorScheme == 1) // lava
    return 0.5 + 0.5 * cos(TAU * (t * 0.5 + vec3(0.00, 0.10, 0.20)));
  if (uColorScheme == 2) // dream
    return 0.5 + 0.5 * cos(TAU * (t * 0.6 + vec3(0.20, 0.10, 0.00)));
  // oil slick
  return 0.5 + 0.5 * cos(TAU * (t * 3.0 + vec3(0.0, 0.33, 0.67)));
}

// --- Noise ---
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic smooth

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractional Brownian Motion with variable octaves
float fbm(vec2 p, int octaves) {
  float f = 0.0;
  float amp = 0.5;
  float totalAmp = 0.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8); // rotation between octaves

  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    f += amp * noise(p);
    totalAmp += amp;
    p = rot * p * 2.1 + vec2(1.7, 9.2);
    amp *= 0.5;
  }

  return f / totalAmp;
}

// Convenience overload with max octaves
float fbm(vec2 p) {
  return fbm(p, int(uComplexity));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed * 0.3;

  // Audio reactivity
  float bassR = uBass * uAudioReactivity;
  float midR = uMid * uAudioReactivity;
  float trebleR = uTreble * uAudioReactivity;
  float energyR = uEnergy * uAudioReactivity;

  int octaves = int(uComplexity);
  float warpStrength = uWarpIntensity * (1.0 + energyR * 0.5);

  // === Triple domain warping: the signature liquid effect ===

  // Layer 1: base warp
  vec2 q = vec2(
    fbm(uv + vec2(0.0, 0.0) + time * 0.1, octaves),
    fbm(uv + vec2(5.2, 1.3) + time * 0.12, octaves)
  );

  // Layer 2: warp the warp (this is where the magic happens)
  vec2 r = vec2(
    fbm(uv + q * warpStrength + vec2(1.7, 9.2) + time * 0.05, octaves),
    fbm(uv + q * warpStrength + vec2(8.3, 2.8) + time * 0.07, octaves)
  );

  // Layer 3: triple warp for maximum organic flow
  vec2 s = vec2(
    fbm(uv + r * warpStrength * 0.8 + vec2(3.1, 7.4) + time * 0.03, octaves),
    fbm(uv + r * warpStrength * 0.8 + vec2(6.5, 4.1) + time * 0.04, octaves)
  );

  // Audio drives additional warp displacement
  vec2 audioWarp = vec2(
    sin(time * 2.0) * bassR * 0.3,
    cos(time * 1.7) * bassR * 0.3
  );

  // Final warped position
  vec2 finalP = uv + s * warpStrength + audioWarp;

  // === Sample the warped noise field ===
  float mainNoise = fbm(finalP * 1.5, octaves);

  // Detail layer at higher frequency
  float detailNoise = fbm(finalP * 4.0 + time * 0.1, min(octaves, 4));

  // Combine with audio-driven mixing
  float n = mainNoise * 0.7 + detailNoise * 0.3;
  n += midR * 0.15;

  // === Color mapping ===
  // Primary color from noise value
  float colorT = n * 2.0 + time * 0.05;
  vec3 color1 = getColor(colorT);

  // Secondary color from warp displacement
  float warpMag = length(s);
  float colorT2 = warpMag * 3.0 + time * 0.08;
  vec3 color2 = getColor(colorT2 + 0.3);

  // Blend based on warp magnitude
  float blend = smoothstep(0.3, 0.7, warpMag);
  vec3 color = mix(color1, color2, blend);

  // Brightness from pattern
  float brightness = 0.5 + n * 0.7;
  color *= brightness;

  // === Flow lines (gradient of noise field for visible flow) ===
  float eps = 0.005;
  float nx = fbm(finalP * 1.5 + vec2(eps, 0.0), min(octaves, 4));
  float ny = fbm(finalP * 1.5 + vec2(0.0, eps), min(octaves, 4));
  vec2 grad = vec2(nx - mainNoise, ny - mainNoise) / eps;
  float flowLine = length(grad);
  flowLine = smoothstep(0.0, 5.0, flowLine);

  // Glow along flow lines
  color += getColor(colorT + 0.5) * flowLine * 0.3;

  // === Treble sparkle: bright spots at high frequencies ===
  float sparkle = noise(finalP * 20.0 + time * 3.0);
  sparkle = pow(sparkle, 12.0) * trebleR * 4.0;
  color += vec3(1.0, 0.95, 0.9) * sparkle;

  // === Bass pulse: deep throb ===
  float bassPulse = sin(length(uv) * 3.0 - time * 2.0) * 0.5 + 0.5;
  bassPulse = pow(bassPulse, 4.0) * bassR * 0.3;
  color += getColor(time * 0.1) * bassPulse;

  // Energy brightness
  color *= 0.5 + energyR * 0.7;

  // Vignette
  float dist = length(vUv * 2.0 - 1.0);
  color *= 1.0 - dist * 0.25;

  gl_FragColor = vec4(color, 1.0);
}
