precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;
uniform float uSpeed;
uniform float uWarpIntensity;
uniform float uColorDensity;
uniform float uAudioReactivity;
uniform float uColorShift;
uniform float uFlowSpeed;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += a * noise(p);
    p = rot(0.37) * p * 2.01 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// Domain warping — the heart of acid visuals
vec2 domainWarp(vec2 p, float time, float intensity) {
  // First warp layer
  float n1 = fbm(p + vec2(1.7, 9.2) + time * 0.15, 6);
  float n2 = fbm(p + vec2(8.3, 2.8) + time * 0.12, 6);
  vec2 q = vec2(n1, n2);

  // Second warp layer (warp of warp)
  float n3 = fbm(p + q * 4.0 + vec2(3.2, 1.3) + time * 0.1, 6);
  float n4 = fbm(p + q * 4.0 + vec2(5.1, 7.4) + time * 0.08, 6);
  vec2 r = vec2(n3, n4);

  return p + (q + r) * intensity;
}

// Interference pattern (oil on water)
float interference(vec2 p, float time) {
  float d = 0.0;

  // Multiple wave sources
  d += sin(length(p - vec2(1.5, 0.8)) * 8.0 - time * 2.0);
  d += sin(length(p - vec2(-1.2, -0.5)) * 7.0 - time * 1.7);
  d += sin(length(p - vec2(0.3, 1.3)) * 9.0 - time * 2.3);
  d += sin(length(p - vec2(-0.8, 0.9)) * 6.0 + time * 1.5);

  // Diagonal waves
  d += sin((p.x * 3.0 + p.y * 5.0) + time * 1.2) * 0.7;
  d += sin((p.x * 7.0 - p.y * 3.0) - time * 0.9) * 0.5;

  return d / 6.0;
}

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uResolution.x / uResolution.y;

  float time = uTime * uSpeed;
  float ar = uAudioReactivity;
  float bass = uBass * ar;
  float mid = uMid * ar;
  float treble = uTreble * ar;
  float energy = uEnergy * ar;

  // Breathing zoom
  float zoom = 1.0 + sin(time * 0.2) * 0.1 + bass * 0.15;
  uv /= zoom;

  // Slow rotation
  uv = rot(time * 0.05 * uFlowSpeed + energy * 0.1) * uv;

  // === Domain warping (creates the liquid flow) ===
  float warpAmount = uWarpIntensity * (1.0 + bass * 0.5);
  vec2 warped = domainWarp(uv * 0.8, time * uFlowSpeed, warpAmount);

  // === Interference patterns ===
  float intf = interference(warped, time * uFlowSpeed);

  // === Layered color generation ===
  // Layer 1: Smooth flowing hue based on domain warp
  float hue1 = fbm(warped * 1.0, 6) + time * 0.05 + uColorShift;

  // Layer 2: Sharp color boundaries from interference
  float hue2 = intf * uColorDensity + time * 0.08 + uColorShift;

  // Layer 3: Fine detail noise
  float detail = fbm(warped * 4.0 + time * 0.2, 4);

  // Combine hues
  float finalHue = hue1 * 0.5 + hue2 * 0.3 + detail * 0.2;

  // Saturation varies with pattern
  float sat = 0.7 + sin(intf * PI) * 0.3;
  sat = clamp(sat + treble * 0.2, 0.0, 1.0);

  // Value/brightness
  float val = 0.6 + fbm(warped * 2.0 + time * 0.1, 4) * 0.4;
  val += energy * 0.2;

  // Main color
  vec3 col = hsv2rgb(vec3(fract(finalHue), sat, val));

  // === Liquid light show overlay ===
  // Blob boundaries (creates the classic liquid projector look)
  float blob1 = fbm(warped * 1.5, 6);
  float blob2 = fbm(warped * 1.5 + vec2(5.0, 3.0), 6);

  // Sharp color transitions at blob boundaries
  float edge1 = smoothstep(0.45, 0.55, blob1);
  float edge2 = smoothstep(0.4, 0.6, blob2);

  vec3 blobCol1 = hsv2rgb(vec3(fract(blob1 + time * 0.1 + uColorShift), 0.9, 0.8));
  vec3 blobCol2 = hsv2rgb(vec3(fract(blob2 + time * 0.07 + uColorShift + 0.33), 0.85, 0.7));

  col = mix(col, blobCol1, edge1 * 0.5);
  col = mix(col, blobCol2, edge2 * 0.3);

  // === Oil film iridescence ===
  float r = length(uv);
  float oilThickness = fbm(warped * 3.0 + time * 0.05, 5);
  float iridescence = sin(oilThickness * 20.0 + r * 5.0) * 0.5 + 0.5;
  vec3 oilCol = hsv2rgb(vec3(fract(oilThickness * 2.0 + uColorShift), 0.6, 0.4));
  col += oilCol * iridescence * 0.2 * (0.5 + mid);

  // === Breathing concentric rings ===
  float rings = sin(r * 12.0 - time * 1.5 + bass * 8.0);
  rings = smoothstep(0.0, 0.1, abs(rings));
  col *= 0.8 + rings * 0.2;

  // === Audio-reactive color shift ===
  // Bass shifts warm, treble shifts cool
  col.r += bass * 0.1;
  col.b += treble * 0.1;

  // Mid drives saturation boost
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, 1.0 + mid * 0.4);

  // Beat flash
  col += energy * energy * 0.2;

  // Subtle vignette
  float vig = 1.0 - r * 0.25;
  col *= clamp(vig, 0.0, 1.0);

  // Tone mapping
  col = col / (col + 0.5) * 1.3;

  // Gamma
  col = pow(max(col, 0.0), vec3(0.95));

  gl_FragColor = vec4(col, 1.0);
}
