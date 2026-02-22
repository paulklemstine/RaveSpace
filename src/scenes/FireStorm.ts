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

float fbm(vec2 p, float turb) {
  float f = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 6; i++) {
    f += amp * noise(p * freq);
    p = rot * p;
    freq *= 2.0 + turb * 0.1;
    amp *= 0.5;
  }
  return f;
}

// Fire color palettes
vec3 getFireColor(int scheme, float t) {
  t = clamp(t, 0.0, 1.0);
  if (scheme == 1) { // blue fire
    vec3 a = vec3(0.0, 0.0, 0.1);
    vec3 b = vec3(0.0, 0.2, 0.8);
    vec3 c = vec3(0.3, 0.6, 1.0);
    vec3 d = vec3(0.8, 0.9, 1.0);
    if (t < 0.33) return mix(a, b, t * 3.0);
    if (t < 0.66) return mix(b, c, (t - 0.33) * 3.0);
    return mix(c, d, (t - 0.66) * 3.0);
  }
  if (scheme == 2) { // green fire
    vec3 a = vec3(0.0, 0.05, 0.0);
    vec3 b = vec3(0.0, 0.5, 0.0);
    vec3 c = vec3(0.3, 0.9, 0.1);
    vec3 d = vec3(0.9, 1.0, 0.5);
    if (t < 0.33) return mix(a, b, t * 3.0);
    if (t < 0.66) return mix(b, c, (t - 0.33) * 3.0);
    return mix(c, d, (t - 0.66) * 3.0);
  }
  if (scheme == 3) { // purple fire
    vec3 a = vec3(0.05, 0.0, 0.1);
    vec3 b = vec3(0.4, 0.0, 0.6);
    vec3 c = vec3(0.7, 0.2, 1.0);
    vec3 d = vec3(1.0, 0.7, 1.0);
    if (t < 0.33) return mix(a, b, t * 3.0);
    if (t < 0.66) return mix(b, c, (t - 0.33) * 3.0);
    return mix(c, d, (t - 0.66) * 3.0);
  }
  // inferno (default)
  vec3 a = vec3(0.1, 0.0, 0.0);
  vec3 b = vec3(0.8, 0.1, 0.0);
  vec3 c = vec3(1.0, 0.5, 0.0);
  vec3 d = vec3(1.0, 1.0, 0.5);
  if (t < 0.33) return mix(a, b, t * 3.0);
  if (t < 0.66) return mix(b, c, (t - 0.33) * 3.0);
  return mix(c, d, (t - 0.66) * 3.0);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;

  // Center and scale
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;

  float time = uTime * uSpeed;
  float react = uAudioReactivity;

  // Bass drives flame height
  float bassHeight = uBass * react * 0.8;
  float flameH = uFlameHeight + bassHeight;

  // Spectral flux drives turbulence
  float turb = uTurbulence + uSpectralFlux * react * 2.0;

  // Fire base coordinates - flames rise upward
  vec2 fireUv = p;
  fireUv.y += 1.0; // Shift origin to bottom
  fireUv.y /= flameH; // Scale by flame height

  // Warp coordinates for fire motion
  float warp1 = fbm(vec2(fireUv.x * 3.0, fireUv.y * 2.0 - time * 2.0), turb);
  float warp2 = fbm(vec2(fireUv.x * 2.0 + 50.0, fireUv.y * 3.0 - time * 1.5), turb);

  // Multiple fire layers
  vec2 distorted = fireUv;
  distorted.x += (warp1 - 0.5) * 0.8 * turb * 0.5;
  distorted.y += (warp2 - 0.5) * 0.3;

  // Main fire shape
  float fire = fbm(vec2(distorted.x * 4.0, distorted.y * 3.0 - time * 3.0), turb);

  // Shape the fire - brighter at bottom, fading at top
  float shape = 1.0 - smoothstep(0.0, 1.5, fireUv.y);
  shape *= smoothstep(-0.1, 0.2, fireUv.y);

  // Narrow at top
  float narrowing = 1.0 - fireUv.y * 0.5;
  float edgeFade = 1.0 - smoothstep(narrowing * 0.5, narrowing, abs(fireUv.x));

  fire *= shape * edgeFade;

  // Add detail layers
  float detail = fbm(vec2(p.x * 8.0, p.y * 6.0 - time * 5.0), turb * 1.5) * 0.3;
  fire += detail * shape * edgeFade;

  // Beat pulse - brightness surge
  float beatPulse = uBeatIntensity * react * 0.5;
  fire *= (1.0 + beatPulse);

  // EQ band influence on different fire heights
  float lowBands = (uBands[0] + uBands[1] + uBands[2] + uBands[3]) * 0.25;
  float midBands = (uBands[4] + uBands[5] + uBands[6] + uBands[7]) * 0.25;
  float hiBands = (uBands[8] + uBands[9] + uBands[10] + uBands[11]) * 0.25;

  // Low bands boost base, mid boost middle, high boost tips
  float eqBoost = lowBands * react * max(0.0, 1.0 - fireUv.y * 2.0) +
                  midBands * react * max(0.0, 1.0 - abs(fireUv.y - 0.5) * 3.0) +
                  hiBands * react * max(0.0, fireUv.y - 0.3);
  fire += eqBoost * 0.5;

  // Ember particles
  float embers = 0.0;
  for (float i = 0.0; i < 8.0; i++) {
    vec2 ep = p;
    float seed = i * 17.31;
    float ex = sin(seed) * 0.8;
    float ey = mod(time * (0.3 + hash21(vec2(seed)) * 0.5) + hash21(vec2(seed, 1.0)), 2.5) - 0.5;
    ep -= vec2(ex + sin(time + seed) * 0.2, ey);
    float emberSize = 0.01 + hash21(vec2(seed, 2.0)) * 0.02;
    float ember = emberSize / (dot(ep, ep) + 0.001);
    ember *= smoothstep(2.5, 0.5, ey);
    embers += ember * 0.015;
  }

  // Kick-driven flame burst
  float kickBurst = uKick * react * 0.8;
  fire += kickBurst * shape * 0.5;

  // Color mapping
  float intensity = clamp(fire, 0.0, 1.0);
  vec3 color = getFireColor(uColorScheme, intensity);

  // Add ember glow
  vec3 emberColor = getFireColor(uColorScheme, 0.9);
  color += emberColor * embers;

  // Energy overall brightness
  color *= 0.6 + uEnergy * react * 0.6;

  // Pitch hue shift for variety
  float pitchShift = uPitch * 0.0005 * uPitchConfidence * react;
  color.r *= 1.0 + sin(pitchShift) * 0.1;
  color.b *= 1.0 + cos(pitchShift) * 0.1;

  // Heat haze at top
  float haze = fbm(vec2(p.x * 10.0, p.y * 5.0 - time), turb) * 0.1;
  color += getFireColor(uColorScheme, 0.3) * haze * shape * 0.3;

  // Vignette
  vec2 vc = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(vc, vc) * 0.2;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;

export class FireStorm extends ShaderSceneBase {
  constructor() {
    super("fireStorm", FRAG);
  }
}
