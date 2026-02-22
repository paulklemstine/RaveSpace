import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash / Noise helpers ---
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
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

// Hexagonal grid functions
// Returns hex center and distance to edge
vec4 hexCoord(vec2 uv) {
  const vec2 s = vec2(1.0, 1.7320508); // 1, sqrt(3)
  const vec2 h = s * 0.5;

  vec2 a = mod(uv, s) - h;
  vec2 b = mod(uv - h, s) - h;

  vec2 gv;
  if (dot(a, a) < dot(b, b)) {
    gv = a;
  } else {
    gv = b;
  }

  // Hex center in original coords
  vec2 center = uv - gv;

  // Hex edge distance
  float edgeDist = 0.5 - max(
    dot(abs(gv), normalize(vec2(1.0, 1.7320508))),
    abs(gv.x)
  );

  return vec4(gv, center);
}

float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
}

// Color palettes
vec3 getHexColor(int scheme, float t, float pulse) {
  t = clamp(t, 0.0, 1.0);
  if (scheme == 1) { // hive - amber/gold organic
    vec3 dark = vec3(0.15, 0.08, 0.0);
    vec3 mid = vec3(0.8, 0.5, 0.0);
    vec3 bright = vec3(1.0, 0.85, 0.3);
    return mix(mix(dark, mid, t), bright, pulse);
  }
  if (scheme == 2) { // crystal - ice blue/white
    vec3 dark = vec3(0.0, 0.05, 0.15);
    vec3 mid = vec3(0.3, 0.6, 0.9);
    vec3 bright = vec3(0.8, 0.95, 1.0);
    return mix(mix(dark, mid, t), bright, pulse);
  }
  if (scheme == 3) { // ember - fire/magma
    vec3 dark = vec3(0.1, 0.0, 0.0);
    vec3 mid = vec3(0.8, 0.2, 0.0);
    vec3 bright = vec3(1.0, 0.6, 0.1);
    return mix(mix(dark, mid, t), bright, pulse);
  }
  // cyber (default) - neon cyan/magenta
  vec3 dark = vec3(0.0, 0.02, 0.05);
  vec3 mid = vec3(0.0, 0.5, 0.8);
  vec3 bright = vec3(0.0, 1.0, 1.0);
  vec3 c = mix(mix(dark, mid, t), bright, pulse);
  // Add magenta highlights
  c += vec3(0.5, 0.0, 0.5) * pulse * 0.3;
  return c;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed;
  float react = uAudioReactivity;

  // Scale by hex size
  float scale = 10.0 / uHexSize;
  vec2 hexUv = uv * scale;

  // Get hex coordinates
  vec4 hex = hexCoord(hexUv);
  vec2 gv = hex.xy; // local coords within hex
  vec2 center = hex.zw; // hex center

  float hexD = hexDist(gv);

  // Hex cell identity
  float cellHash = hash21(center);
  vec2 cellId = center;

  // Row-based EQ band mapping
  // Map hex row to band index
  float row = center.y;
  int bandIdx = int(mod(abs(row) * 2.0, 16.0));
  float bandVal = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i == bandIdx) bandVal = uBands[i];
  }

  // Cell pulsing from its associated band
  float cellPulse = bandVal * react;

  // Traveling pulse wave on beat
  float beatWave = 0.0;
  float waveDist = length(center) / scale;
  float waveSpeed = 3.0;

  // Multiple wave fronts from beats
  for (float w = 0.0; w < 4.0; w++) {
    float waveTime = fract(time * 0.3 + w * 0.25);
    float waveRadius = waveTime * waveSpeed;
    float waveFront = exp(-(waveDist - waveRadius) * (waveDist - waveRadius) / (uPulseWidth * uPulseWidth * 0.1));
    waveFront *= exp(-waveTime * 2.0); // fade over time
    waveFront *= 1.0 + uBeatIntensity * react;
    beatWave += waveFront;
  }

  // Hex edge glow
  float edgeWidth = 0.06;
  float edge = smoothstep(edgeWidth, edgeWidth - 0.03, abs(hexD - 0.5));
  float innerEdge = smoothstep(0.5, 0.45, hexD);

  // Cell fill based on audio and wave
  float cellFill = cellPulse * 0.7 + beatWave * 0.5;
  cellFill = clamp(cellFill, 0.0, 1.0);

  // Inner hex fill with smooth falloff
  float fill = smoothstep(0.5, 0.2, hexD) * cellFill;

  // Energy drives cell glow
  float energyGlow = uEnergy * react * 0.5;
  fill += energyGlow * smoothstep(0.5, 0.3, hexD) * 0.3;

  // Kick flash - all cells briefly light up
  float kickFlash = uKick * react;

  // Color
  float colorT = cellHash + time * 0.05;
  float pulseT = cellFill + beatWave * 0.3 + kickFlash * 0.5;

  vec3 cellColor = getHexColor(uColorScheme, fract(colorT), clamp(pulseT, 0.0, 1.0));
  vec3 edgeColor = getHexColor(uColorScheme, 0.6, 0.3);

  // Background - dark with subtle hex pattern
  vec3 bgColor = getHexColor(uColorScheme, 0.0, 0.0) * 0.3;

  // Compose
  vec3 color = bgColor;

  // Fill cells
  color = mix(color, cellColor, fill);

  // Edge glow
  color += edgeColor * edge * (0.3 + energyGlow + beatWave * 0.5);

  // Inner bright core when pulsing
  float core = smoothstep(0.15, 0.0, hexD) * cellFill;
  vec3 coreColor = getHexColor(uColorScheme, 0.8, 1.0);
  color += coreColor * core * 0.5;

  // Kick flash overlay
  color += cellColor * kickFlash * innerEdge * 0.5;

  // Spectral flux sparkle on edges
  float flux = uSpectralFlux * react;
  float sparkle = hash21(center + floor(time * 15.0)) * flux;
  color += edgeColor * sparkle * edge * 1.5;

  // Pitch-reactive hue shift
  float pitchHue = uPitch * 0.001 * uPitchConfidence * react;
  color.r *= 1.0 + sin(pitchHue) * 0.15;
  color.g *= 1.0 + sin(pitchHue * 1.3 + 1.0) * 0.1;
  color.b *= 1.0 + sin(pitchHue * 0.7 + 2.0) * 0.15;

  // Treble shimmer
  float shimmer = noise(vec2(center.x * 10.0, center.y * 10.0 + time * 3.0));
  color += color * shimmer * uTreble * react * 0.1;

  // Bass throb - subtle scale pulse
  float bassThrob = uBass * react * 0.05;
  color *= 1.0 + bassThrob;

  // Spectral centroid warm/cool shift
  float centroid = uSpectralCentroid * 0.0003 * react;
  color = mix(color, color * vec3(1.1, 0.9, 0.8), centroid);

  // Vignette
  vec2 vc = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(vc, vc) * 0.25;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;

export class HexGrid extends ShaderSceneBase {
  constructor() {
    super("hexGrid", FRAG);
  }
}
