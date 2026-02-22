import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Noise helpers ---
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

float fbm(vec2 p, int octaves) {
  float f = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    f += amp * noise(p);
    p = rot * p * 2.0;
    amp *= 0.5;
  }
  return f;
}

// Aurora color palettes
vec3 getAuroraColor(int scheme, float t, float layer) {
  t = clamp(t, 0.0, 1.0);
  if (scheme == 1) { // tropical
    vec3 c1 = vec3(1.0, 0.2, 0.5);  // hot pink
    vec3 c2 = vec3(1.0, 0.6, 0.0);  // orange
    vec3 c3 = vec3(0.0, 0.8, 0.6);  // teal
    return mix(mix(c1, c2, t), c3, layer);
  }
  if (scheme == 2) { // alien
    vec3 c1 = vec3(0.0, 1.0, 0.2);  // neon green
    vec3 c2 = vec3(0.5, 0.0, 1.0);  // violet
    vec3 c3 = vec3(0.0, 0.5, 1.0);  // electric blue
    return mix(mix(c1, c2, t), c3, layer);
  }
  if (scheme == 3) { // solar
    vec3 c1 = vec3(1.0, 0.8, 0.0);  // gold
    vec3 c2 = vec3(1.0, 0.3, 0.0);  // fire orange
    vec3 c3 = vec3(1.0, 1.0, 0.5);  // pale yellow
    return mix(mix(c1, c2, t), c3, layer);
  }
  // arctic (default)
  vec3 c1 = vec3(0.0, 1.0, 0.5);  // green
  vec3 c2 = vec3(0.0, 0.5, 1.0);  // blue
  vec3 c3 = vec3(0.5, 0.0, 1.0);  // purple
  return mix(mix(c1, c2, t), c3, layer);
}

// Single aurora curtain
float auroraCurtain(vec2 uv, float waveNum, float time, float phase, float bandVal) {
  // Curtain wave
  float wave = 0.0;
  float baseY = 0.3 + phase * 0.3;

  // Multiple sine waves create curtain folds
  float fold = sin(uv.x * waveNum + time * 0.7 + phase * 3.0) * 0.15;
  fold += sin(uv.x * waveNum * 1.7 + time * 0.5 - phase * 2.0) * 0.08;
  fold += sin(uv.x * waveNum * 0.5 + time * 1.1) * 0.1;

  // Audio band modulates the curtain position
  fold += bandVal * 0.15;

  float curtainY = baseY + fold;
  float dist = abs(uv.y - curtainY);

  // Curtain shape - thin bright line with soft glow
  float curtain = exp(-dist * dist * 60.0);
  curtain += exp(-dist * dist * 8.0) * 0.4; // soft glow

  // Vertical rays hanging down from curtain
  float rayNoise = noise(vec2(uv.x * 15.0 + phase * 10.0, time * 0.3));
  float rays = exp(-max(0.0, uv.y - curtainY) * 4.0) * rayNoise;
  rays *= smoothstep(0.2, 0.0, abs(uv.y - curtainY - 0.1));

  return curtain + rays * 0.5;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed;
  float react = uAudioReactivity;

  int numWaves = int(uWaveCount);

  // Sky gradient background
  vec3 skyDark = vec3(0.0, 0.0, 0.02);
  vec3 skyMid = vec3(0.0, 0.02, 0.06);
  float skyGrad = smoothstep(0.0, 1.0, uv.y);
  vec3 bg = mix(skyDark, skyMid, skyGrad);

  // Stars
  float stars = 0.0;
  for (float i = 0.0; i < 3.0; i++) {
    vec2 starUv = uv * (80.0 + i * 40.0);
    vec2 starId = floor(starUv);
    vec2 starF = fract(starUv) - 0.5;
    float starHash = hash21(starId + i * 100.0);
    if (starHash > 0.95) {
      float starBright = (starHash - 0.95) * 20.0;
      float twinkle = sin(time * (1.0 + starHash * 3.0) + starHash * 6.28) * 0.5 + 0.5;
      stars += starBright * twinkle * exp(-dot(starF, starF) * 100.0);
    }
  }
  bg += stars * 0.3;

  // Treble-driven shimmer
  float shimmer = noise(vec2(uv.x * 30.0, uv.y * 20.0 + time * 2.0));
  shimmer *= uTreble * react * 0.1;

  // Aurora layers
  vec3 auroraColor = vec3(0.0);
  float totalAurora = 0.0;

  for (int i = 0; i < 8; i++) {
    if (i >= numWaves) break;
    float fi = float(i);
    float phase = fi / float(numWaves);

    // Each curtain driven by different EQ band
    int bandIdx = int(mod(fi * 2.0, 16.0));
    float bandVal = 0.0;
    for (int b = 0; b < 16; b++) {
      if (b == bandIdx) bandVal = uBands[b];
    }

    float waveNum = 2.0 + fi * 0.5;
    float curtain = auroraCurtain(uv, waveNum, time + fi * 0.5, phase, bandVal * react);

    // Color varies per layer
    float colorT = fract(phase + time * 0.05);
    vec3 layerColor = getAuroraColor(uColorScheme, colorT, phase);

    auroraColor += layerColor * curtain * (0.4 + 0.6 / float(numWaves));
    totalAurora += curtain;
  }

  // Brightness from energy
  float energyBright = 0.7 + uEnergy * react * 0.5;
  auroraColor *= uBrightness * energyBright;

  // Beat intensity pulse
  float beatPulse = 1.0 + uBeatIntensity * react * 0.3;
  auroraColor *= beatPulse;

  // Add shimmer from treble
  auroraColor += auroraColor * shimmer;

  // Pitch-reactive color shift
  float pitchHue = uPitch * 0.001 * uPitchConfidence * react;
  auroraColor.r *= 1.0 + sin(pitchHue) * 0.15;
  auroraColor.g *= 1.0 + sin(pitchHue * 1.3 + 1.0) * 0.1;
  auroraColor.b *= 1.0 + sin(pitchHue * 0.7 + 2.0) * 0.15;

  // Spectral centroid shifts overall hue
  float centroidShift = uSpectralCentroid * 0.0002 * react;
  auroraColor = mix(auroraColor, auroraColor.gbr, centroidShift * 0.3);

  // Combine
  vec3 color = bg + auroraColor;

  // Ground silhouette
  float groundNoise = fbm(vec2(uv.x * 3.0, 0.0), 4);
  float ground = smoothstep(0.08 + groundNoise * 0.06, 0.05 + groundNoise * 0.06, uv.y);
  color = mix(color, vec3(0.0, 0.0, 0.01), ground);

  // Subtle reflection on ground
  if (uv.y < 0.1) {
    float reflY = 0.2 - uv.y;
    vec2 reflUv = vec2(uv.x, reflY);
    float refl = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float phase = fi / 4.0;
      int bandIdx = int(mod(fi * 2.0, 16.0));
      float bandVal = 0.0;
      for (int b = 0; b < 16; b++) {
        if (b == bandIdx) bandVal = uBands[b];
      }
      refl += auroraCurtain(reflUv, 2.0 + fi * 0.5, time + fi * 0.5, phase, bandVal * react);
    }
    vec3 reflColor = getAuroraColor(uColorScheme, 0.5, 0.3) * refl * 0.15;
    color += reflColor * (1.0 - ground) * smoothstep(0.1, 0.0, uv.y);
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

export class AuroraBorealis extends ShaderSceneBase {
  constructor() {
    super("auroraBorealis", FRAG);
  }
}
