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
uniform float uColorShift;
uniform float uComplexity;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// Simplex-like noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// FBM (Fractal Brownian Motion)
float fbm(vec2 p, float time) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 6; i++) {
    value += amplitude * noise(p * frequency + time * 0.1 * float(i + 1));
    p = rot(0.5) * p;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Domain warping
vec2 warp(vec2 p, float time, float intensity) {
  float n1 = fbm(p + vec2(1.7, 9.2) + time * 0.15, time);
  float n2 = fbm(p + vec2(8.3, 2.8) + time * 0.12, time);
  return p + vec2(n1, n2) * intensity;
}

// Psychedelic pattern generator
float psychPattern(vec2 p, float time) {
  float d = 0.0;

  // Layered sine waves
  d += sin(p.x * 3.0 + time) * 0.5;
  d += sin(p.y * 4.0 - time * 0.7) * 0.3;
  d += sin((p.x + p.y) * 5.0 + time * 1.3) * 0.2;
  d += sin(length(p) * 8.0 - time * 2.0) * 0.4;

  // Add noise detail
  d += fbm(p * 2.0, time) * 0.5;

  return d;
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

  // Convert to polar
  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  // Kaleidoscope folding
  float segments = floor(uSegments);
  float segAngle = TAU / segments;

  // Fold angle into segment
  angle = mod(angle, segAngle);
  // Mirror fold
  angle = abs(angle - segAngle * 0.5);

  // Audio-reactive rotation
  float rotation = time * 0.2 + bass * 0.5;
  angle += rotation;

  // Back to cartesian with zoom
  float zoom = uZoom * (1.0 + bass * 0.2);
  vec2 p = vec2(cos(angle), sin(angle)) * r / zoom;

  // Add slow drift
  p += vec2(sin(time * 0.13), cos(time * 0.17)) * 0.5;

  // Domain warp for psychedelic distortion
  float warpIntensity = 0.3 + mid * 0.3 + uComplexity * 0.5;
  p = warp(p, time, warpIntensity);

  // Generate pattern
  float pattern = psychPattern(p, time);

  // Second layer with different scale
  float pattern2 = psychPattern(p * 2.0 + 3.0, time * 0.7);

  // Coloring
  vec3 col1 = vec3(
    sin(pattern * 3.0 + time * 0.5 + uColorShift * TAU) * 0.5 + 0.5,
    sin(pattern * 3.0 + time * 0.5 + uColorShift * TAU + TAU / 3.0) * 0.5 + 0.5,
    sin(pattern * 3.0 + time * 0.5 + uColorShift * TAU + 2.0 * TAU / 3.0) * 0.5 + 0.5
  );

  vec3 col2 = vec3(
    sin(pattern2 * 4.0 + time * 0.3 + 1.0) * 0.5 + 0.5,
    sin(pattern2 * 4.0 + time * 0.3 + 2.0) * 0.5 + 0.5,
    sin(pattern2 * 4.0 + time * 0.3 + 3.0) * 0.5 + 0.5
  );

  vec3 col = mix(col1, col2, 0.5 + sin(r * 5.0 + time) * 0.3);

  // Edge highlighting
  float edgeDetail = abs(fract(pattern * 3.0) - 0.5) * 2.0;
  edgeDetail = smoothstep(0.4, 0.5, edgeDetail);
  col = mix(col, col * 1.5 + 0.1, edgeDetail * treble);

  // Center glow
  float centerGlow = exp(-r * 2.0) * energy;
  col += centerGlow * vec3(0.6, 0.3, 0.9);

  // Radial color bands
  float bands = sin(r * 15.0 - time * 3.0 + bass * 10.0) * 0.5 + 0.5;
  col = mix(col, col * vec3(1.2, 0.8, 1.3), bands * 0.2);

  // Segment edge glow (thin lines at fold boundaries)
  float origAngle = atan(uv.y, uv.x);
  float segEdge = abs(fract(origAngle / segAngle + 0.5) - 0.5) * 2.0;
  segEdge = 1.0 - smoothstep(0.0, 0.05, segEdge * r);
  col += segEdge * vec3(0.5, 0.3, 0.8) * 0.4 * (0.5 + treble);

  // Beat pulse
  col *= 1.0 + energy * energy * 0.5;

  // Vignette
  float vig = 1.0 - r * 0.3;
  col *= clamp(vig, 0.0, 1.0);

  // Saturation boost
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, 1.3);

  gl_FragColor = vec4(col, 1.0);
}
