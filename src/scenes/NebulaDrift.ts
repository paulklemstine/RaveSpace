import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash / Noise helpers ---
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 7; i++) {
    v += a * noise(p);
    p = rot * p * 2.0 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}

float fbmTurbulent(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    v += a * abs(noise(p) * 2.0 - 1.0);
    p = rot * p * 2.0 + vec2(50.0);
    a *= 0.5;
  }
  return v;
}

// Star function: bright point sources
float stars(vec2 uv, float density) {
  vec2 cell = floor(uv * density);
  vec2 offset = fract(uv * density);
  float star = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 neighbor = vec2(float(dx), float(dy));
      vec2 cellPos = cell + neighbor;
      float rnd = hash2(cellPos);
      if (rnd > 0.92) {
        vec2 starPos = vec2(hash2(cellPos + 0.1), hash2(cellPos + 0.2));
        float dist = length(offset - neighbor - starPos);
        float brightness = hash2(cellPos + 0.3);
        float size = 0.01 + 0.02 * brightness;
        star += smoothstep(size, 0.0, dist) * brightness;
      }
    }
  }
  return star;
}

vec3 nebulaColor(float val, float hueShift, int scheme) {
  float h = hueShift;
  if (scheme == 0) {
    // deep: dark blues, purples, deep reds
    vec3 c1 = vec3(0.05, 0.02, 0.15);
    vec3 c2 = vec3(0.2, 0.05, 0.3);
    vec3 c3 = vec3(0.4, 0.1, 0.15);
    vec3 c4 = vec3(0.8, 0.3, 0.1);
    if (val < 0.33) return mix(c1, c2, val / 0.33);
    if (val < 0.66) return mix(c2, c3, (val - 0.33) / 0.33);
    return mix(c3, c4, (val - 0.66) / 0.34);
  } else if (scheme == 1) {
    // emission: bright greens, pinks, hot blues (like emission nebulae)
    vec3 c1 = vec3(0.0, 0.1, 0.05);
    vec3 c2 = vec3(0.1, 0.5, 0.2);
    vec3 c3 = vec3(0.6, 0.2, 0.4);
    vec3 c4 = vec3(1.0, 0.4, 0.6);
    if (val < 0.33) return mix(c1, c2, val / 0.33);
    if (val < 0.66) return mix(c2, c3, (val - 0.33) / 0.33);
    return mix(c3, c4, (val - 0.66) / 0.34);
  } else if (scheme == 2) {
    // reflection: blues and whites
    vec3 c1 = vec3(0.02, 0.03, 0.08);
    vec3 c2 = vec3(0.1, 0.2, 0.5);
    vec3 c3 = vec3(0.3, 0.5, 0.8);
    vec3 c4 = vec3(0.8, 0.85, 1.0);
    if (val < 0.33) return mix(c1, c2, val / 0.33);
    if (val < 0.66) return mix(c2, c3, (val - 0.33) / 0.33);
    return mix(c3, c4, (val - 0.66) / 0.34);
  }
  // 3 = dark: very dark purples and blacks
  vec3 c1 = vec3(0.01, 0.005, 0.02);
  vec3 c2 = vec3(0.08, 0.02, 0.1);
  vec3 c3 = vec3(0.15, 0.05, 0.2);
  vec3 c4 = vec3(0.3, 0.1, 0.25);
  if (val < 0.33) return mix(c1, c2, val / 0.33);
  if (val < 0.66) return mix(c2, c3, (val - 0.33) / 0.33);
  return mix(c3, c4, (val - 0.66) / 0.34);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed * 0.15;
  float ar = uAudioReactivity;

  // Slow drift / pan through nebula
  vec2 drift = vec2(t * 0.5, t * 0.3);

  // Bass-driven dust swirling
  float bassSwirl = uBass * ar * 0.3;
  float swirlAngle = bassSwirl * sin(t * 2.0);
  mat2 swirlMat = mat2(cos(swirlAngle), -sin(swirlAngle), sin(swirlAngle), cos(swirlAngle));
  vec2 swirlUV = swirlMat * uv;

  // Multi-layer nebula dust
  float dust1 = fbm(swirlUV * 1.5 * uDustDensity + drift);
  float dust2 = fbm(swirlUV * 2.5 * uDustDensity + drift * 1.3 + 100.0);
  float dust3 = fbmTurbulent(swirlUV * 3.0 * uDustDensity + drift * 0.7 + 200.0);

  // Bass makes dust swirl more intensely
  dust1 += bassSwirl * 0.2 * noise(swirlUV * 4.0 + t * 3.0);

  // Combine dust layers
  float dust = dust1 * 0.5 + dust2 * 0.3 + dust3 * 0.2;
  dust = pow(dust, 1.2);

  // Pitch-reactive hue shift
  float pitchHue = uPitch * 0.002 * uPitchConfidence * ar;

  // Nebula coloring with pitch shift
  vec3 color = nebulaColor(dust, pitchHue, uColorScheme);

  // EQ-reactive brightness layers
  // Low bands (bass) boost deep background
  float lowBoost = (uBands[0] + uBands[1] + uBands[2] + uBands[3]) * 0.25 * ar;
  color *= 1.0 + lowBoost * 0.5;

  // Mid bands add warm emission
  float midBoost = (uBands[4] + uBands[5] + uBands[6] + uBands[7]) * 0.25 * ar;
  vec3 emissionColor = nebulaColor(0.8, pitchHue + 0.3, uColorScheme);
  color += emissionColor * midBoost * 0.3 * dust2;

  // High bands add bright filaments
  float highBoost = (uBands[8] + uBands[9] + uBands[10] + uBands[11]) * 0.25 * ar;
  float filament = pow(fbmTurbulent(swirlUV * 6.0 + drift * 2.0), 2.0);
  color += vec3(0.6, 0.5, 0.7) * filament * highBoost * 0.4;

  // Stars layer
  float starField = stars(uv + drift * 0.2, 30.0 + 10.0 * uDustDensity);
  starField += stars(uv * 1.5 + drift * 0.1 + 50.0, 50.0);

  // Treble bands make stars twinkle
  float trebleAvg = (uBands[12] + uBands[13] + uBands[14] + uBands[15]) * 0.25;
  float twinkle = 1.0 + trebleAvg * ar * 2.0 * sin(uTime * 8.0 + uv.x * 10.0 + uv.y * 10.0);
  starField *= twinkle;

  // Star brightness param
  starField *= uStarBrightness;

  // Stars dim behind dense nebula
  float starDim = 1.0 - dust * 0.6;
  vec3 starColor = vec3(0.9, 0.92, 1.0) * starField * max(starDim, 0.0);
  color += starColor;

  // Bright nebula cores
  float core1 = exp(-length(swirlUV - vec2(0.3, 0.2)) * 3.0) * dust1;
  float core2 = exp(-length(swirlUV + vec2(0.4, 0.1)) * 2.5) * dust2;
  vec3 coreColor = nebulaColor(0.9, pitchHue + 0.5, uColorScheme);
  color += coreColor * (core1 + core2) * 0.5 * (1.0 + uEnergy * ar);

  // Beat intensity creates a cosmic pulse
  float beatPulse = uBeatIntensity * ar;
  float pulseWave = sin(length(uv) * 8.0 - uTime * 4.0) * 0.5 + 0.5;
  color += nebulaColor(0.7, pitchHue, uColorScheme) * beatPulse * pulseWave * 0.15;

  // Spectral centroid affects overall warmth
  float warmth = uSpectralCentroid * 0.001 * ar;
  color = mix(color, color * vec3(1.1, 0.95, 0.85), clamp(warmth, 0.0, 0.3));

  // Vignette for depth
  float vig = 1.0 - 0.5 * dot(uv * 0.4, uv * 0.4);
  color *= vig;

  // Subtle tone mapping
  color = pow(color, vec3(0.95));
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class NebulaDrift extends ShaderSceneBase {
  constructor() {
    super("nebulaDrift", FRAG);
  }
}
