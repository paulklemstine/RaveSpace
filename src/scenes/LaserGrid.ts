import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash helper ---
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 laserPalette(float t, int scheme) {
  if (scheme == 1) {
    // rgb: red, green, blue cycling
    float phase = fract(t * 3.0);
    if (phase < 0.333) return mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), phase * 3.0);
    else if (phase < 0.667) return mix(vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, 1.0), (phase - 0.333) * 3.0);
    else return mix(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), (phase - 0.667) * 3.0);
  } else if (scheme == 2) {
    // uv: deep purple / ultraviolet
    return vec3(0.4, 0.0, 1.0) + vec3(0.3, 0.1, 0.0) * sin(t * 6.28);
  } else if (scheme == 3) {
    // white: pure white with slight blue tinge
    return vec3(0.9, 0.95, 1.0);
  }
  // club: alternating hot colors
  vec3 a = vec3(1.0, 0.0, 0.5);
  vec3 b = vec3(0.0, 1.0, 1.0);
  vec3 c = vec3(1.0, 1.0, 0.0);
  float p = fract(t);
  if (p < 0.333) return mix(a, b, p * 3.0);
  else if (p < 0.667) return mix(b, c, (p - 0.333) * 3.0);
  else return mix(c, a, (p - 0.667) * 3.0);
}

// Single laser beam with glow
float laserBeam(vec2 uv, vec2 origin, vec2 direction, float width) {
  vec2 d = uv - origin;
  float proj = dot(d, direction);
  vec2 closest = origin + direction * proj;
  float dist = length(uv - closest);

  // Only render in the forward direction
  float fwd = smoothstep(-0.1, 0.1, proj);

  // Core + glow
  float core = exp(-dist * dist / (width * width * 0.001));
  float glow = exp(-dist * dist / (width * width * 0.01));

  return (core * 0.7 + glow * 0.3) * fwd;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed * 0.5;
  float ar = uAudioReactivity;
  int count = int(uBeamCount);
  float bw = uBeamWidth * 0.5;

  vec3 col = vec3(0.0);

  // === Horizontal scanning beams ===
  for (int i = 0; i < 12; i++) {
    if (i >= count) break;
    float fi = float(i);
    float fcount = float(count);

    // Each beam driven by a different EQ band
    int bandIdx = int(mod(fi, 16.0));
    float bandVal = 0.0;
    for (int b = 0; b < 16; b++) {
      if (b == bandIdx) bandVal = uBands[b];
    }

    // Beam position: scanning pattern
    float baseY = (fi / fcount) * 2.0 - 1.0;
    float scanOffset = sin(t * (1.0 + fi * 0.3) + fi * 1.7) * 0.5;
    // Mid frequency shifts beam positions
    scanOffset += uMid * ar * sin(t * 2.0 + fi * 0.9) * 0.3;
    float beamY = baseY + scanOffset;

    // Horizontal beam
    float dist = abs(uv.y - beamY);
    float beamWidth = bw * 0.02 * (1.0 + bandVal * ar * 2.0);
    float core = exp(-dist * dist / (beamWidth * beamWidth));
    float glow = exp(-dist * dist / (beamWidth * beamWidth * 8.0));

    float beam = core * 0.6 + glow * 0.4;
    beam *= 0.7 + bandVal * ar * 1.0;

    // Color per beam
    float hue = fi / fcount + t * 0.1;
    vec3 beamCol = laserPalette(hue, uColorScheme);

    col += beamCol * beam * 0.5;
  }

  // === Vertical scanning beams ===
  for (int i = 0; i < 12; i++) {
    if (i >= count) break;
    float fi = float(i);
    float fcount = float(count);

    int bandIdx = int(mod(fi + 8.0, 16.0));
    float bandVal = 0.0;
    for (int b = 0; b < 16; b++) {
      if (b == bandIdx) bandVal = uBands[b];
    }

    float baseX = (fi / fcount) * 2.0 * aspect - aspect;
    float scanOffset = cos(t * (0.8 + fi * 0.25) + fi * 2.3) * 0.6;
    scanOffset += uMid * ar * cos(t * 1.5 + fi * 1.1) * 0.3;
    float beamX = baseX + scanOffset;

    float dist = abs(uv.x - beamX);
    float beamWidth = bw * 0.02 * (1.0 + bandVal * ar * 2.0);
    float core = exp(-dist * dist / (beamWidth * beamWidth));
    float glow = exp(-dist * dist / (beamWidth * beamWidth * 8.0));

    float beam = core * 0.6 + glow * 0.4;
    beam *= 0.7 + bandVal * ar * 1.0;

    float hue = fi / fcount + t * 0.1 + 0.5;
    vec3 beamCol = laserPalette(hue, uColorScheme);

    col += beamCol * beam * 0.5;
  }

  // === Diagonal sweeping beams (fewer, accent) ===
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float angle = fi * 0.785 + t * 0.5 + uBands[12 + i] * ar * 1.0;
    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 origin = dir * -2.0;

    float bandVal = uBands[12 + i] * ar;
    float beam = laserBeam(uv, origin, dir, bw * (1.0 + bandVal * 2.0));

    float hue = fi * 0.25 + t * 0.15 + 0.25;
    vec3 beamCol = laserPalette(hue, uColorScheme);

    col += beamCol * beam * 0.3 * (0.5 + bandVal);
  }

  // === Beat flash ===
  float beatFlash = uBeatIntensity * ar;
  col += vec3(1.0) * beatFlash * 0.15 * exp(-dot(uv, uv) * 0.5);

  // === Intersection glow: where beams cross, extra bright ===
  float totalIntensity = dot(col, vec3(0.333));
  float intersectionBoost = smoothstep(0.5, 1.5, totalIntensity);
  col += col * intersectionBoost * 0.5;

  // Spectral flux energy
  col *= 1.0 + uSpectralFlux * ar * 0.4;

  // Atmospheric fog / haze
  float fog = exp(-dot(uv, uv) * 0.15) * 0.03;
  col += laserPalette(t * 0.05, uColorScheme) * fog;

  // Pitch-reactive overall hue shift (subtle)
  float pitchShift = uPitch * uPitchConfidence * ar * 0.0003;
  col = mix(col, col.gbr, pitchShift);

  // Tone mapping
  col = 1.0 - exp(-col * 1.5);

  gl_FragColor = vec4(col, 1.0);
}
`;

export class LaserGrid extends ShaderSceneBase {
  constructor() {
    super("laserGrid", FRAG);
  }
}
