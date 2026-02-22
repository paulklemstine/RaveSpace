import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash & Noise helpers ---
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 cosmicPalette(float t, int scheme) {
  if (scheme == 1) {
    // void: deep purples and blacks
    return vec3(0.1, 0.0, 0.15) + vec3(0.3, 0.0, 0.5) * sin(vec3(1.0, 0.5, 2.0) * t * 6.28 + vec3(0.0, 1.0, 0.5));
  } else if (scheme == 2) {
    // plasma: hot pinks and cyans
    return vec3(0.5, 0.1, 0.3) + vec3(0.5, 0.4, 0.5) * sin(vec3(3.0, 1.0, 2.0) * t * 6.28 + vec3(0.5, 2.0, 1.0));
  } else if (scheme == 3) {
    // singularity: white core to dark edges
    float w = smoothstep(0.0, 0.3, t);
    return mix(vec3(1.0, 0.95, 0.8), vec3(0.02, 0.0, 0.05), w);
  }
  // cosmic: blues, purples, golds
  return vec3(0.2, 0.1, 0.4) + vec3(0.5, 0.3, 0.4) * sin(vec3(2.0, 1.5, 1.0) * t * 6.28 + vec3(0.0, 0.7, 1.5));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed * 0.3;
  float ar = uAudioReactivity;

  // Distance from center
  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  // Audio-reactive event horizon size
  float bassExpand = uBass * ar * 0.4 + uBands[0] * ar * 0.3 + uBands[1] * ar * 0.2;
  float horizonRadius = uEventHorizon * 0.3 * (1.0 + bassExpand);

  // Gravitational lensing distortion
  float distortAmount = uDistortion * (1.0 + uEnergy * ar * 0.5);
  float bendFactor = horizonRadius / max(r, 0.001);
  float bend = bendFactor * bendFactor * distortAmount * 0.5;

  // Kick causes gravitational wave ripple
  float gWave = sin(r * 15.0 - t * 8.0) * uKick * ar * 0.15;
  bend += gWave;

  // Lensed UV coordinates
  vec2 lensedUv = uv * (1.0 + bend);
  float lensedAngle = atan(lensedUv.y, lensedUv.x);
  float lensedR = length(lensedUv);

  // Swirling accretion disk
  float diskAngle = lensedAngle + t * 2.0 + bend * 3.0;
  diskAngle += uMid * ar * 0.5;
  float diskR = lensedR;

  // Accretion disk layers driven by EQ bands
  float disk = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float bandVal = uBands[i * 4] * ar;
    float ringR = 0.4 + fi * 0.15 + bandVal * 0.1;
    float ringWidth = 0.06 + bandVal * 0.04;
    float ring = smoothstep(ringWidth, 0.0, abs(diskR - ringR));
    float spiral = sin(diskAngle * (3.0 + fi * 2.0) + diskR * 10.0 - t * (4.0 + fi)) * 0.5 + 0.5;
    disk += ring * spiral * (0.5 + bandVal * 0.5);
  }

  // Event horizon - dark center
  float horizon = smoothstep(horizonRadius, horizonRadius * 0.5, r);

  // Photon sphere glow
  float photonSphere = exp(-abs(r - horizonRadius * 1.3) * 8.0);
  photonSphere *= 1.0 + uBeatIntensity * ar * 2.0;

  // Background space distortion with fbm
  vec2 bgUv = lensedUv * 1.5;
  float bg = fbm(bgUv + vec2(t * 0.1, t * 0.05));
  bg += fbm(bgUv * 2.0 - vec2(t * 0.15)) * 0.5;

  // Stars
  float stars = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 starUv = lensedUv * (5.0 + float(i) * 10.0);
    vec2 starId = floor(starUv);
    vec2 starF = fract(starUv) - 0.5;
    float starBright = step(0.98, hash(starId + float(i) * 100.0));
    stars += starBright * exp(-dot(starF, starF) * 50.0);
  }

  // Pitch-reactive hue shift
  float hueShift = uPitch * uPitchConfidence * ar * 0.001;

  // Color composition
  float colorT = disk * 0.5 + photonSphere * 0.3 + bg * 0.1 + hueShift;
  vec3 col = cosmicPalette(colorT, uColorScheme);

  // Accretion disk emission
  col += cosmicPalette(disk + t * 0.1, uColorScheme) * disk * 1.5;

  // Photon sphere bright glow
  col += vec3(1.0, 0.8, 0.5) * photonSphere * 0.8;

  // Stars
  col += vec3(0.8, 0.85, 1.0) * stars * (1.0 - horizon);

  // Beat flash on event horizon edge
  float beatFlash = uBeatIntensity * ar * smoothstep(horizonRadius * 1.5, horizonRadius, r);
  col += vec3(0.6, 0.3, 1.0) * beatFlash * 0.5;

  // Spectral flux adds energy shimmer
  col *= 1.0 + uSpectralFlux * ar * 0.3;

  // Black hole center
  col *= 1.0 - horizon * 0.95;

  // Vignette
  float vig = 1.0 - dot(uv / aspect, uv / aspect) * 0.3;
  col *= vig;

  // Tone mapping
  col = col / (col + 1.0);
  col = pow(col, vec3(0.9));

  gl_FragColor = vec4(col, 1.0);
}
`;

export class VoidWarp extends ShaderSceneBase {
  constructor() {
    super("voidWarp", FRAG);
  }
}
