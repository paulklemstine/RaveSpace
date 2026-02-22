import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash / Noise helpers ---
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec2 hash22(vec2 p) {
  vec3 a = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  a += dot(a, a.yzx + 33.33);
  return fract((a.xx + a.yz) * a.zy);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Get color palette based on scheme
vec3 getTraceColor(int scheme, float t) {
  if (scheme == 1) return mix(vec3(0.0, 0.3, 1.0), vec3(0.0, 0.8, 1.0), t); // blue
  if (scheme == 2) return mix(vec3(0.8, 0.6, 0.0), vec3(1.0, 0.9, 0.3), t); // gold
  if (scheme == 3) return mix(vec3(0.8, 0.0, 0.1), vec3(1.0, 0.3, 0.2), t); // red
  return mix(vec3(0.0, 0.6, 0.2), vec3(0.0, 1.0, 0.5), t); // green (default)
}

// Circuit grid cell - returns trace pattern
float circuitCell(vec2 uv, vec2 cellId, float time, float complexity) {
  float h = hash21(cellId);
  float dir = floor(h * 4.0); // 0=right, 1=up, 2=left, 3=down

  float trace = 0.0;
  float lineWidth = 0.06 / complexity;

  // Horizontal trace
  if (dir < 1.0 || dir >= 3.0) {
    trace = max(trace, 1.0 - smoothstep(0.0, lineWidth, abs(uv.y - 0.5)));
  }
  // Vertical trace
  if (dir >= 1.0 && dir < 3.0) {
    trace = max(trace, 1.0 - smoothstep(0.0, lineWidth, abs(uv.x - 0.5)));
  }
  // Corner traces
  float h2 = hash21(cellId + 100.0);
  if (h2 > 0.5) {
    trace = max(trace, 1.0 - smoothstep(0.0, lineWidth, abs(uv.x - 0.5)));
    trace = max(trace, 1.0 - smoothstep(0.0, lineWidth, abs(uv.y - 0.5)));
  }

  // T-junctions and crosses
  if (h > 0.7) {
    trace = max(trace, 1.0 - smoothstep(0.0, lineWidth, abs(uv.x - 0.5)));
    trace = max(trace, 1.0 - smoothstep(0.0, lineWidth, abs(uv.y - 0.5)));
  }

  return trace;
}

// Node at intersection
float circuitNode(vec2 uv, float radius) {
  float d = length(uv - 0.5);
  return 1.0 - smoothstep(radius * 0.5, radius, d);
}

// Data pulse traveling through traces
float dataPulse(vec2 uv, vec2 cellId, float time, float speed) {
  float h = hash21(cellId);
  float phase = h * 6.28 + time * speed * (0.5 + h);
  float pulsePos = fract(phase / 6.28);

  float distH = abs(uv.x - pulsePos);
  float distV = abs(uv.y - pulsePos);

  float pulse = exp(-distH * distH * 80.0) + exp(-distV * distV * 80.0);
  return pulse * 0.8;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed;
  float react = uAudioReactivity;

  // Scale grid by complexity
  float gridScale = 4.0 + uComplexity * 3.0;
  vec2 gridUv = uv * gridScale;
  vec2 cellId = floor(gridUv);
  vec2 cellUv = fract(gridUv);

  // Get circuit traces
  float trace = circuitCell(cellUv, cellId, time, uComplexity);

  // Multi-layer traces for depth
  vec2 gridUv2 = uv * gridScale * 0.5 + 50.0;
  vec2 cellId2 = floor(gridUv2);
  vec2 cellUv2 = fract(gridUv2);
  float trace2 = circuitCell(cellUv2, cellId2, time, uComplexity) * 0.3;

  // Nodes at intersections
  float node = 0.0;
  float nodeHash = hash21(cellId * 7.0);
  if (nodeHash > 0.6) {
    node = circuitNode(cellUv, 0.15 * uGlowRadius);
  }

  // Data pulses flowing through traces - synced to beat
  float beatPhase = uBeatIntensity * react;
  float pulse = dataPulse(cellUv, cellId, time + beatPhase * 2.0, uSpeed);
  pulse *= trace; // Only show pulse on traces

  // EQ band-driven trace brightness per row
  int bandIdx = int(mod(cellId.y, 16.0));
  float bandVal = 0.0;
  // Manual band lookup (GLSL ES doesn't support dynamic indexing well)
  for (int i = 0; i < 16; i++) {
    if (i == bandIdx) bandVal = uBands[i];
  }
  float eqBrightness = 1.0 + bandVal * react * 2.0;

  // Kick flash on nodes
  float kickFlash = uKick * react * 3.0;
  node *= (1.0 + kickFlash);

  // Build color
  vec3 baseColor = getTraceColor(uColorScheme, 0.5);
  vec3 brightColor = getTraceColor(uColorScheme, 1.0);
  vec3 darkColor = getTraceColor(uColorScheme, 0.0) * 0.2;

  // Background: very dark with subtle grid
  float bgGrid = max(
    1.0 - smoothstep(0.0, 0.02, abs(cellUv.x)),
    1.0 - smoothstep(0.0, 0.02, abs(cellUv.y))
  ) * 0.05;
  vec3 bg = darkColor * 0.1 + bgGrid * darkColor;

  // Traces with EQ-driven brightness
  vec3 traceColor = baseColor * trace * eqBrightness;
  traceColor += baseColor * trace2 * 0.5;

  // Glow around traces
  float glowAmount = uGlowRadius * 0.01;
  float glow = 0.0;
  for (float dx = -1.0; dx <= 1.0; dx += 1.0) {
    for (float dy = -1.0; dy <= 1.0; dy += 1.0) {
      vec2 offset = vec2(dx, dy) * glowAmount;
      vec2 sampleUv = fract(gridUv + offset);
      vec2 sampleId = floor(gridUv + offset);
      glow += circuitCell(sampleUv, sampleId, time, uComplexity);
    }
  }
  glow /= 9.0;
  vec3 glowColor = brightColor * glow * 0.3 * uGlowRadius;

  // Data pulse color (brighter)
  vec3 pulseColor = brightColor * pulse * 2.0 * (1.0 + beatPhase);

  // Node color with kick flash
  vec3 nodeColor = brightColor * node * 1.5;

  // Pitch-reactive hue shift
  float hueShift = uPitch * 0.001 * uPitchConfidence * react;

  // Combine
  vec3 color = bg + traceColor + glowColor + pulseColor + nodeColor;

  // Apply subtle hue rotation from pitch
  float cosH = cos(hueShift);
  float sinH = sin(hueShift);
  mat3 hueRot = mat3(
    0.299 + 0.701 * cosH + 0.168 * sinH,
    0.587 - 0.587 * cosH + 0.330 * sinH,
    0.114 - 0.114 * cosH - 0.497 * sinH,
    0.299 - 0.299 * cosH - 0.328 * sinH,
    0.587 + 0.413 * cosH + 0.035 * sinH,
    0.114 - 0.114 * cosH + 0.292 * sinH,
    0.299 - 0.299 * cosH + 1.250 * sinH,
    0.587 - 0.587 * cosH - 1.050 * sinH,
    0.114 + 0.886 * cosH - 0.203 * sinH
  );
  color = hueRot * color;

  // Spectral flux sparkle
  float sparkle = hash21(cellId + floor(time * 10.0)) * uSpectralFlux * react;
  color += brightColor * sparkle * trace * 0.5;

  // Energy-driven overall brightness
  color *= 0.7 + uEnergy * react * 0.5;

  // Vignette
  vec2 vc = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(vc, vc) * 0.3;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;

export class CircuitTrace extends ShaderSceneBase {
  constructor() {
    super("circuitTrace", FRAG);
  }
}
