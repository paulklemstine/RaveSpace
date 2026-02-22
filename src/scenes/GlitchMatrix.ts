import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash helpers ---
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
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

// Color palettes for the base image
vec3 getBaseColor(int scheme, vec2 uv, float time) {
  if (scheme == 1) { // digital - clean cyber
    float grid = max(
      smoothstep(0.48, 0.5, fract(uv.x * 20.0)),
      smoothstep(0.48, 0.5, fract(uv.y * 20.0))
    );
    vec3 bg = vec3(0.0, 0.05, 0.1);
    vec3 line = vec3(0.0, 0.5, 1.0);
    return mix(bg, line, grid * 0.5);
  }
  if (scheme == 2) { // analog - warm static
    float n = noise(uv * 50.0 + time * 10.0);
    return vec3(0.15 + n * 0.1, 0.1 + n * 0.05, 0.05);
  }
  if (scheme == 3) { // corrupt - dark glitch
    float bands = sin(uv.y * 100.0 + time * 5.0) * 0.5 + 0.5;
    return vec3(bands * 0.1, 0.0, bands * 0.15);
  }
  // vhs (default) - retro CRT
  float scanline = sin(uv.y * 400.0) * 0.5 + 0.5;
  float n = noise(uv * 30.0 + time * 5.0);
  vec3 bg = vec3(0.05, 0.0, 0.08);
  return bg + vec3(n * 0.05) * scanline;
}

// Glitch effect color shift
vec3 getGlitchAccent(int scheme) {
  if (scheme == 1) return vec3(0.0, 1.0, 1.0);  // digital cyan
  if (scheme == 2) return vec3(1.0, 0.6, 0.2);  // analog amber
  if (scheme == 3) return vec3(1.0, 0.0, 0.3);  // corrupt magenta
  return vec3(0.0, 0.8, 0.4); // vhs green
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;

  float time = uTime * uSpeed;
  float react = uAudioReactivity;

  // Spectral flux drives glitch intensity
  float glitchIntensity = uGlitchRate * (0.5 + uSpectralFlux * react * 3.0);

  // Time-based glitch triggering
  float glitchTime = floor(time * 10.0 * uGlitchRate);
  float glitchRand = hash11(glitchTime);
  bool isGlitching = glitchRand > (1.0 - glitchIntensity * 0.3);

  // Beat-driven block displacement
  float beatDisplace = uBeat * react;

  // Block displacement
  vec2 blockUv = uv;
  float blockScale = uBlockSize * 0.05;

  if (isGlitching) {
    // Horizontal block displacement
    float blockY = floor(uv.y / blockScale) * blockScale;
    float blockHash = hash11(blockY * 100.0 + glitchTime);

    if (blockHash > 0.5) {
      float displacement = (hash11(blockY * 200.0 + glitchTime) - 0.5) * 0.3;
      displacement *= glitchIntensity;
      displacement += beatDisplace * (blockHash - 0.5) * 0.5;
      blockUv.x += displacement;
    }

    // Vertical block shift (rarer)
    if (blockHash > 0.8) {
      float blockX = floor(uv.x / blockScale) * blockScale;
      float vShift = (hash11(blockX * 300.0 + glitchTime) - 0.5) * 0.15;
      blockUv.y += vShift * glitchIntensity;
    }
  }

  // RGB channel splitting - kick drives intensity
  float kickSplit = uKick * react * 0.03;
  float baseSplit = 0.003 * glitchIntensity;
  float splitAmount = baseSplit + kickSplit;

  // Chromatic aberration direction varies with time
  float splitAngle = hash11(glitchTime * 0.5) * 6.28;
  vec2 splitDir = vec2(cos(splitAngle), sin(splitAngle));

  vec2 uvR = blockUv + splitDir * splitAmount;
  vec2 uvG = blockUv;
  vec2 uvB = blockUv - splitDir * splitAmount;

  // Get base image for each channel
  vec3 colorR = getBaseColor(uColorScheme, uvR, time);
  vec3 colorG = getBaseColor(uColorScheme, uvG, time);
  vec3 colorB = getBaseColor(uColorScheme, uvB, time);

  // Combine with channel separation
  vec3 color = vec3(colorR.r, colorG.g, colorB.b);

  // Scan lines
  float scanFreq = 300.0;
  float scanLine = sin(uv.y * scanFreq + time * 2.0) * 0.5 + 0.5;
  scanLine = pow(scanLine, 0.5);
  color *= 0.85 + scanLine * 0.15;

  // Horizontal interference lines
  float interfere = sin(uv.y * 1000.0 + time * 50.0);
  interfere *= sin(uv.y * 50.0 + time * 3.0);
  if (isGlitching) {
    color += vec3(interfere * 0.05 * glitchIntensity);
  }

  // Block glitch overlay - random colored blocks
  if (isGlitching) {
    vec2 blockId = floor(blockUv / blockScale);
    float blockH = hash21(blockId + glitchTime);
    if (blockH > 0.85) {
      vec3 accent = getGlitchAccent(uColorScheme);
      float blockBright = hash21(blockId + glitchTime + 50.0);
      color = mix(color, accent * blockBright, 0.7);
    }
  }

  // EQ band visualizer bars (subtle background)
  float barWidth = 1.0 / 16.0;
  int bandIdx = int(uv.x / barWidth);
  float bandVal = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i == bandIdx) bandVal = uBands[i];
  }
  float barHeight = bandVal * react * 0.3;
  float bar = smoothstep(barHeight, barHeight - 0.02, uv.y * 0.5);
  vec3 barColor = getGlitchAccent(uColorScheme) * 0.2;
  color += barColor * bar * (1.0 - bar);

  // Static noise overlay
  float staticNoise = hash21(uv * 1000.0 + time * 100.0);
  float staticAmount = 0.03 + glitchIntensity * 0.1;
  if (isGlitching) staticAmount *= 3.0;
  color += (staticNoise - 0.5) * staticAmount;

  // VHS tracking error - horizontal bands that shift
  float trackingError = 0.0;
  if (isGlitching) {
    float trackY = sin(time * 0.3) * 0.5 + 0.5;
    float trackDist = abs(uv.y - trackY);
    trackingError = smoothstep(0.1, 0.0, trackDist) * glitchIntensity;
    color.r += trackingError * 0.3;
    color.g -= trackingError * 0.1;
    // Shift horizontally in tracking area
    if (trackDist < 0.05) {
      vec2 trackUv = uv;
      trackUv.x += trackingError * 0.2;
      color = mix(color, getBaseColor(uColorScheme, trackUv, time), trackingError * 0.5);
    }
  }

  // Beat intensity flash
  float beatFlash = uBeatIntensity * react * 0.2;
  color += getGlitchAccent(uColorScheme) * beatFlash * (isGlitching ? 2.0 : 0.3);

  // Pitch-reactive color temperature
  float pitchShift = uPitch * 0.001 * uPitchConfidence * react;
  color.r *= 1.0 + sin(pitchShift) * 0.1;
  color.b *= 1.0 + cos(pitchShift) * 0.1;

  // CRT curvature
  vec2 crtUv = uv * 2.0 - 1.0;
  float crt = dot(crtUv, crtUv) * 0.05;
  color *= 1.0 - crt;

  // CRT phosphor grid (subtle)
  float phosphorR = smoothstep(0.3, 0.0, mod(gl_FragCoord.x, 3.0) - 0.5);
  float phosphorG = smoothstep(0.3, 0.0, mod(gl_FragCoord.x - 1.0, 3.0) - 0.5);
  float phosphorB = smoothstep(0.3, 0.0, mod(gl_FragCoord.x - 2.0, 3.0) - 0.5);
  vec3 phosphor = vec3(phosphorR, phosphorG, phosphorB);
  color = mix(color, color * phosphor * 2.5, 0.15);

  // Energy overall brightness
  color *= 0.7 + uEnergy * react * 0.5;

  // Vignette (CRT style - stronger)
  float vig = 1.0 - dot(crtUv, crtUv) * 0.4;
  color *= vig;

  // Clamp to prevent over-bright
  color = clamp(color, 0.0, 1.5);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class GlitchMatrix extends ShaderSceneBase {
  constructor() {
    super("glitchMatrix", FRAG);
  }
}
