import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Moire pattern helpers ---

vec3 moirePalette(float t, int scheme) {
  if (scheme == 1) {
    // rainbow
    return 0.5 + 0.5 * cos(6.28 * (t + vec3(0.0, 0.33, 0.67)));
  } else if (scheme == 2) {
    // duotone: cyan and magenta
    return mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 0.0, 1.0), sin(t * 6.28) * 0.5 + 0.5);
  } else if (scheme == 3) {
    // neon: hot pink, lime, electric blue
    vec3 a = vec3(1.0, 0.1, 0.6);
    vec3 b = vec3(0.2, 1.0, 0.1);
    vec3 c = vec3(0.1, 0.3, 1.0);
    float p = fract(t * 3.0);
    if (p < 0.333) return mix(a, b, p * 3.0);
    else if (p < 0.667) return mix(b, c, (p - 0.333) * 3.0);
    else return mix(c, a, (p - 0.667) * 3.0);
  }
  // mono: black and white
  return vec3(1.0) * (sin(t * 6.28) * 0.5 + 0.5);
}

// Line pattern: parallel lines at given angle
float linePattern(vec2 uv, float angle, float freq) {
  float c = cos(angle);
  float s = sin(angle);
  float d = uv.x * c + uv.y * s;
  return sin(d * freq * 6.28) * 0.5 + 0.5;
}

// Circle pattern: concentric rings from a center
float circlePattern(vec2 uv, vec2 center, float freq) {
  float d = length(uv - center);
  return sin(d * freq * 6.28) * 0.5 + 0.5;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed * 0.4;
  float ar = uAudioReactivity;
  float freq = uLineCount;

  // === Pattern Layer 1: Rotating lines driven by sub-bass (bands 0-3) ===
  float subBass = (uBands[0] + uBands[1] + uBands[2] + uBands[3]) * 0.25;
  float angle1 = uRotation + t * 0.5 + subBass * ar * 1.5;
  float freq1 = freq * (1.0 + subBass * ar * 0.3);
  float p1 = linePattern(uv, angle1, freq1);

  // === Pattern Layer 2: Counter-rotating lines driven by low-mid (bands 4-7) ===
  float lowMid = (uBands[4] + uBands[5] + uBands[6] + uBands[7]) * 0.25;
  float angle2 = -uRotation - t * 0.35 + lowMid * ar * 1.2;
  float freq2 = freq * 1.2 * (1.0 + lowMid * ar * 0.3);
  float p2 = linePattern(uv, angle2, freq2);

  // === Pattern Layer 3: Concentric circles driven by mid-high (bands 8-11) ===
  float midHigh = (uBands[8] + uBands[9] + uBands[10] + uBands[11]) * 0.25;
  vec2 circCenter = vec2(sin(t * 0.3) * 0.2, cos(t * 0.4) * 0.2);
  float freq3 = freq * 0.8 * (1.0 + midHigh * ar * 0.4);
  float p3 = circlePattern(uv, circCenter, freq3);

  // === Pattern Layer 4: Diagonal lines driven by treble/air (bands 12-15) ===
  float trebleAir = (uBands[12] + uBands[13] + uBands[14] + uBands[15]) * 0.25;
  float angle4 = 0.785 + t * 0.7 + trebleAir * ar * 2.0;
  float freq4 = freq * 1.5 * (1.0 + trebleAir * ar * 0.3);
  float p4 = linePattern(uv, angle4, freq4);

  // Mid-frequency drives overall rotation speed
  float rotSpeed = uMid * ar * 2.0;

  // Moire interference: multiply / combine patterns
  float moire1 = p1 * p2; // line-on-line interference
  float moire2 = p2 * p3; // line-on-circle interference
  float moire3 = p3 * p4; // circle-on-line interference
  float moire4 = p1 * p4; // cross interference

  // Beat snaps pattern phase
  float beatSnap = floor(uBeatIntensity * ar * 4.0) * 0.25;

  // Composite moire pattern
  float composite = 0.0;
  composite += moire1 * 0.35;
  composite += moire2 * 0.25;
  composite += moire3 * 0.25;
  composite += moire4 * 0.15;

  // Phase shift on beat
  composite = fract(composite + beatSnap * 0.5);

  // Color mapping
  float hueBase = composite + t * 0.05;
  hueBase += uPitch * uPitchConfidence * ar * 0.0005;
  vec3 col = moirePalette(hueBase, uColorScheme);

  // Intensity modulation
  float intensity = composite;
  intensity *= 1.0 + uEnergy * ar * 0.5;
  intensity *= 1.0 + uBeatIntensity * ar * 0.3;

  col *= intensity;

  // Add bright interference peaks
  float peaks = pow(composite, 4.0);
  col += moirePalette(hueBase + 0.1, uColorScheme) * peaks * 0.5;

  // Spectral flux adds shimmer
  col *= 1.0 + uSpectralFlux * ar * 0.3;

  // Vignette
  vec2 vigUv = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(vigUv, vigUv) * 0.3;
  col *= vig;

  // Boost contrast
  col = pow(col, vec3(0.85));

  gl_FragColor = vec4(col, 1.0);
}
`;

export class MoirePatterns extends ShaderSceneBase {
  constructor() {
    super("moirePatterns", FRAG);
  }
}
