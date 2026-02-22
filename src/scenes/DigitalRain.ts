import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash helpers ---
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash1(float p) {
  return fract(sin(p * 127.1) * 43758.5453);
}

// Pseudo-glyph: generates a pattern within a cell that looks like a character
float glyph(vec2 uv, float id, float pitchMod) {
  // Map into 5x5 grid per glyph cell
  vec2 g = floor(uv * 5.0);
  float cellHash = hash(g + id * 17.3 + pitchMod * 3.7);
  // Random pixels create glyph-like patterns
  float on = step(0.4, cellHash);
  // Smooth the edges slightly
  vec2 f = fract(uv * 5.0);
  float shape = on * smoothstep(0.0, 0.15, f.x) * smoothstep(0.0, 0.15, f.y)
              * smoothstep(0.0, 0.15, 1.0 - f.x) * smoothstep(0.0, 0.15, 1.0 - f.y);
  return shape;
}

vec3 rainPalette(float brightness, int scheme) {
  if (scheme == 1) {
    // blue
    return vec3(0.1, 0.4, 1.0) * brightness;
  } else if (scheme == 2) {
    // blood
    return vec3(1.0, 0.1, 0.05) * brightness;
  } else if (scheme == 3) {
    // gold
    return vec3(1.0, 0.8, 0.2) * brightness;
  }
  // matrix green
  return vec3(0.1, 1.0, 0.3) * brightness;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;

  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  // Column setup
  float cols = 20.0 * uDensity;
  float glyphH = uGlyphSize * 0.04;
  float glyphW = glyphH * 0.6;

  // Compute column and row
  float colWidth = 1.0 / cols;
  float col = floor(uv.x / colWidth);
  float colFrac = fract(uv.x / colWidth);

  // Each column has a unique speed driven by different EQ bands
  float colHash = hash(vec2(col, 0.0));
  int bandIdx = int(mod(col, 16.0));

  // Use the band value for this column
  float bandVal = 0.0;
  // Manual band selection since GLSL ES doesn't support dynamic array indexing well
  for (int i = 0; i < 16; i++) {
    if (i == bandIdx) bandVal = uBands[i];
  }

  float colSpeed = (0.5 + colHash * 1.5) * (1.0 + bandVal * ar * 2.0);

  // Vertical position with scrolling
  float scroll = t * colSpeed;
  float rowHeight = glyphH;
  float row = floor((uv.y + scroll) / rowHeight);
  float rowFrac = fract((uv.y + scroll) / rowHeight);

  // Cell identifier
  vec2 cellId = vec2(col, row);
  float cellHash = hash(cellId);

  // Glyph pattern changes based on hash and time
  float glyphChangeRate = 0.5 + colHash * 2.0;
  float glyphFrame = floor(t * glyphChangeRate + cellHash * 10.0);
  float glyphId = hash(vec2(glyphFrame, col * 100.0 + row));

  // Pitch-reactive glyph pattern variation
  float pitchMod = floor(uPitch * uPitchConfidence * ar * 0.01);

  // Render the glyph
  vec2 glyphUv = vec2(colFrac, rowFrac);
  float g = glyph(glyphUv, glyphId, pitchMod);

  // Trail brightness: head of column is brightest, fades behind
  float headPos = fract(scroll / rowHeight + colHash * 50.0);
  float trailPos = fract(uv.y - headPos);
  float trail = exp(-trailPos * 5.0 / (1.0 + uDensity * 0.5));

  // Random column activity
  float colActive = step(0.2, sin(t * 0.3 + colHash * 6.28) * 0.5 + 0.5 + uEnergy * ar * 0.3);

  // Brightness
  float brightness = g * trail * colActive;

  // Head glow (brightest character at the leading edge)
  float headGlow = exp(-abs(trailPos - 0.0) * 20.0);
  brightness += headGlow * 0.5 * colActive;

  // Beat brightness pulse
  brightness *= 1.0 + uBeatIntensity * ar * 0.8;

  // Spectral flux adds shimmer
  float shimmer = sin(col * 3.7 + t * 5.0) * uSpectralFlux * ar * 0.3;
  brightness += shimmer * g * 0.3;

  // Build color
  vec3 col3 = rainPalette(brightness, uColorScheme);

  // Head of trail is white-ish (brighter and desaturated)
  vec3 headCol = vec3(1.0, 1.0, 1.0) * headGlow * 0.8 * colActive;
  col3 += headCol;

  // Scanline effect
  float scanline = sin(vUv.y * uResolution.y * 0.5) * 0.04 + 0.96;
  col3 *= scanline;

  // Subtle CRT curvature vignette
  vec2 crtUv = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(crtUv, crtUv) * 0.15;
  col3 *= vig;

  // Background: very faint glow
  vec3 bgGlow = rainPalette(0.02 + uEnergy * ar * 0.02, uColorScheme);
  col3 += bgGlow;

  gl_FragColor = vec4(col3, 1.0);
}
`;

export class DigitalRain extends ShaderSceneBase {
  constructor() {
    super("digitalRain", FRAG);
  }
}
