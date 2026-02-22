precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;

uniform float uSpeed;
uniform float uSegments;
uniform float uZoom;
uniform float uAudioReactivity;
uniform int uColorScheme;

#define PI 3.14159265
#define TAU 6.28318530

// --- Cosine palettes ---
vec3 getColor(float t) {
  if (uColorScheme == 0) // neon
    return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.1, 0.2)));
  if (uColorScheme == 1) // crystal
    return 0.5 + 0.5 * cos(TAU * (t * 0.7 + vec3(0.1, 0.2, 0.35)));
  if (uColorScheme == 2) // fire
    return 0.5 + 0.5 * cos(TAU * (t * 0.5 + vec3(0.0, 0.1, 0.25)));
  // spectrum
  return 0.5 + 0.5 * cos(TAU * (t * 2.0 + vec3(0.0, 0.33, 0.67)));
}

// --- Noise functions ---
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float f = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    f += amp * noise(p);
    p *= 2.1;
    amp *= 0.5;
  }
  return f;
}

// Kaleidoscope fold
vec2 kaleidoscope(vec2 p, float segments) {
  float angle = atan(p.y, p.x);
  float r = length(p);

  // Fold angle into sector
  float sector = TAU / segments;
  angle = mod(angle, sector);
  // Mirror within sector
  angle = abs(angle - sector * 0.5);

  return vec2(cos(angle), sin(angle)) * r;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed * 0.5;

  // Audio reactivity
  float bassR = uBass * uAudioReactivity;
  float midR = uMid * uAudioReactivity;
  float trebleR = uTreble * uAudioReactivity;
  float energyR = uEnergy * uAudioReactivity;

  // Slowly rotate the whole thing
  float globalRot = time * 0.1 + bassR * 0.2;
  float c = cos(globalRot);
  float s = sin(globalRot);
  uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);

  // Apply kaleidoscope fold
  float segs = floor(uSegments);
  vec2 kp = kaleidoscope(uv, segs);

  // Zoom and pan the base pattern
  float z = uZoom * (1.0 + sin(time * 0.3) * 0.2 + bassR * 0.3);
  vec2 patternUV = kp * z;

  // Flowing offset
  patternUV += vec2(time * 0.3, time * 0.2);

  // --- Base pattern: domain-warped noise ---
  // First warp layer
  vec2 warp1 = vec2(
    fbm(patternUV + vec2(time * 0.1, 0.0)),
    fbm(patternUV + vec2(0.0, time * 0.12))
  );

  // Second warp layer (more psychedelic)
  vec2 warp2 = vec2(
    fbm(patternUV + warp1 * 2.0 + vec2(time * 0.05, 1.7)),
    fbm(patternUV + warp1 * 2.0 + vec2(3.2, time * 0.07))
  );

  // Audio drives warp intensity
  float warpAmount = 1.5 + energyR * 1.0;
  vec2 finalUV = patternUV + warp2 * warpAmount;

  // Get noise value
  float n = fbm(finalUV);

  // Additional detail layer
  float detail = fbm(finalUV * 3.0 + time * 0.2);
  n = n * 0.7 + detail * 0.3;

  // --- Color mapping ---
  float colorT = n * 2.0 + time * 0.08;
  // Add angular variation for more kaleidoscopic feel
  float angle = atan(uv.y, uv.x);
  colorT += angle / TAU * 0.5;
  // Mid frequencies shift the color
  colorT += midR * 0.3;

  vec3 color = getColor(colorT);

  // Brightness modulation from the pattern
  float brightness = 0.4 + n * 0.8;

  // Edge detection in the pattern for glowing lines
  float nx = fbm(finalUV + vec2(0.01, 0.0));
  float ny = fbm(finalUV + vec2(0.0, 0.01));
  float edge = length(vec2(nx - n, ny - n)) * 30.0;
  edge = smoothstep(0.0, 1.0, edge);

  // Glow on edges
  color += getColor(colorT + 0.3) * edge * 0.8;

  // Treble sparkle: high-frequency shimmer
  float sparkle = noise(finalUV * 20.0 + time * 3.0);
  sparkle = pow(sparkle, 8.0) * trebleR * 3.0;
  color += vec3(1.0, 0.95, 0.9) * sparkle;

  // Apply brightness
  color *= brightness;

  // Energy global brightness
  color *= 0.6 + energyR * 0.6;

  // Radial fade (softer towards edges)
  float dist = length(vUv * 2.0 - 1.0);
  color *= 1.0 - dist * 0.2;

  gl_FragColor = vec4(color, 1.0);
}
