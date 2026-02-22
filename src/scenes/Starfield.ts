import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash helpers ---
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
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

vec3 starPalette(float t, int scheme) {
  if (scheme == 1) {
    // nebula: purples, blues, pinks
    return vec3(0.4, 0.2, 0.8) + vec3(0.4, 0.3, 0.3) * sin(vec3(2.0, 1.0, 3.0) * t * 6.28 + vec3(0.0, 1.0, 0.5));
  } else if (scheme == 2) {
    // ice: whites, blues, cyans
    return vec3(0.6, 0.8, 1.0) + vec3(0.3, 0.2, 0.1) * sin(vec3(1.5, 2.0, 1.0) * t * 6.28);
  } else if (scheme == 3) {
    // fire: reds, oranges, yellows
    return vec3(1.0, 0.4, 0.1) + vec3(0.3, 0.3, 0.1) * sin(vec3(1.0, 2.0, 3.0) * t * 6.28 + vec3(0.0, 0.5, 1.0));
  }
  // warp: classic white/blue
  return vec3(0.7, 0.8, 1.0) + vec3(0.3, 0.2, 0.1) * sin(vec3(1.0, 2.0, 3.0) * t * 6.28);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed * 0.5;
  float ar = uAudioReactivity;

  // Warp speed driven by energy with beat bursts
  float warpSpeed = 1.0 + uEnergy * ar * 2.0 + uWarpFactor;
  float beatBurst = uBeatIntensity * ar * 3.0;
  warpSpeed += beatBurst;

  // Star trail stretch driven by bass
  float trailStretch = 1.0 + uBass * ar * 2.0 + uBands[0] * ar * 1.5;

  vec3 col = vec3(0.0);

  // Multiple star layers at different depths
  for (int layer = 0; layer < 4; layer++) {
    float fl = float(layer);
    float layerDepth = 1.0 + fl * 2.0;
    float layerDensity = uStarDensity * (3.0 + fl * 2.0);

    // Band reactivity per layer
    float layerBand = 0.0;
    for (int b = 0; b < 4; b++) {
      if (b == layer) {
        layerBand = uBands[b * 4];
      }
    }

    // Tunnel projection: radial zoom
    float z = fract(t * warpSpeed * 0.1 / layerDepth + fl * 0.25);
    float scale = mix(0.5, 30.0, z);

    vec2 starUv = uv * scale;

    // Grid of stars
    vec2 cellId = floor(starUv);
    vec2 cellF = fract(starUv) - 0.5;

    // Visit neighboring cells for smooth rendering
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        vec2 neighbor = vec2(float(dx), float(dy));
        vec2 id = cellId + neighbor;

        float h = hash(id + fl * 100.0);
        if (h > 1.0 / layerDensity) continue;

        // Star position within cell
        vec2 starPos = neighbor + vec2(hash(id * 1.1 + 0.5), hash(id * 2.3 + 1.7)) - cellF;

        // Radial stretch for warp trail
        float distFromCenter = length(starPos * scale) / scale;
        vec2 radialDir = normalize(uv + 0.001);
        float radialAlign = abs(dot(normalize(starPos + 0.001), radialDir));

        // Trail length
        float trailLen = trailStretch * (1.0 + layerBand * ar * 2.0);
        float trailWidth = 0.02 + fl * 0.005;

        // Star shape: stretched along radial direction
        float starDist = length(starPos);
        float starCore = exp(-starDist * starDist * 200.0);

        // Radial trail
        float trail = exp(-starDist * starDist * (50.0 / trailLen)) * radialAlign;

        float starBrightness = (starCore + trail * 0.5) * (1.0 - z);

        // Color per star
        float starHue = hash(id * 3.7) + uPitch * uPitchConfidence * ar * 0.001;
        vec3 starCol = starPalette(starHue, uColorScheme);

        col += starCol * starBrightness * 0.15;
      }
    }
  }

  // Central glow (approaching light / engine)
  float centerGlow = exp(-dot(uv, uv) * 3.0) * (0.1 + uEnergy * ar * 0.2);
  col += starPalette(0.5, uColorScheme) * centerGlow;

  // Beat flash
  col += vec3(0.1) * uBeatIntensity * ar * exp(-dot(uv, uv) * 2.0);

  // Nebula background for nebula color scheme
  float nebula = noise(uv * 1.5 + t * 0.1) * noise(uv * 3.0 - t * 0.05);
  col += starPalette(nebula + t * 0.05, uColorScheme) * nebula * 0.1;

  // Spectral flux sparkle
  col *= 1.0 + uSpectralFlux * ar * 0.4;

  // Vignette
  float vig = 1.0 - dot(uv / (aspect * 1.2), uv / (aspect * 1.2)) * 0.4;
  col *= max(vig, 0.0);

  // Tone mapping
  col = col / (col + 0.5) * 1.2;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Starfield extends ShaderSceneBase {
  constructor() {
    super("starfield", FRAG);
  }
}
