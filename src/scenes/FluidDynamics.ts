import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash / Noise helpers ---
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Curl noise for fluid-like motion
vec2 curlNoise(vec2 p, float time) {
  float eps = 0.01;
  float n = noise(p + vec2(0.0, 0.0) + time * 0.3);
  float nx = noise(p + vec2(eps, 0.0) + time * 0.3);
  float ny = noise(p + vec2(0.0, eps) + time * 0.3);
  return vec2(-(ny - n) / eps, (nx - n) / eps) * 0.5;
}

// Multi-octave warped FBM for fluid appearance
float fluidFBM(vec2 p, float time, float viscosity) {
  float v = 0.0;
  float a = 0.5;
  float totalAmp = 0.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  float viscFactor = 1.0 / (0.5 + viscosity);

  for (int i = 0; i < 7; i++) {
    // Domain warping: curl noise offsets each octave
    vec2 curl = curlNoise(p * 0.5, time + float(i) * 0.7);
    p += curl * 0.3 * viscFactor;

    v += a * noise(p);
    totalAmp += a;
    p = rot * p * (1.8 + 0.2 * viscFactor);
    a *= 0.52;
  }
  return v / totalAmp;
}

// Vortex function
float vortex(vec2 uv, vec2 center, float strength, float radius, float time) {
  vec2 delta = uv - center;
  float dist = length(delta);
  float angle = atan(delta.y, delta.x);

  float spiral = sin(angle * 4.0 - dist * 10.0 / radius + time * strength * 2.0);
  float mask = exp(-dist * dist / (radius * radius * 2.0));

  return spiral * mask;
}

vec3 getSchemeColor(float val, float phase, int scheme) {
  if (scheme == 0) {
    // oil: dark iridescent rainbow on black
    float h = val * 2.0 + phase;
    vec3 c = 0.5 + 0.5 * cos(6.283 * (h + vec3(0.0, 0.33, 0.67)));
    return c * c * (0.3 + 0.7 * val);
  } else if (scheme == 1) {
    // water: blues and teals
    vec3 deep = vec3(0.0, 0.05, 0.15);
    vec3 mid = vec3(0.0, 0.3, 0.5);
    vec3 light = vec3(0.3, 0.8, 0.9);
    float v = val + 0.1 * sin(phase * 6.283);
    if (v < 0.5) return mix(deep, mid, v * 2.0);
    return mix(mid, light, (v - 0.5) * 2.0);
  } else if (scheme == 2) {
    // lava: reds, oranges, dark crust
    vec3 dark = vec3(0.05, 0.02, 0.0);
    vec3 hot = vec3(1.0, 0.3, 0.0);
    vec3 white = vec3(1.0, 0.8, 0.3);
    float v = pow(val, 1.5) + 0.05 * sin(phase * 6.283);
    if (v < 0.6) return mix(dark, hot, v / 0.6);
    return mix(hot, white, (v - 0.6) / 0.4);
  }
  // 3 = plasma: vibrant pinks, purples, blues
  float h = val * 1.5 + phase * 0.5;
  vec3 c1 = vec3(0.2, 0.0, 0.4);
  vec3 c2 = vec3(0.8, 0.1, 0.5);
  vec3 c3 = vec3(0.3, 0.5, 1.0);
  float v = fract(h);
  if (v < 0.5) return mix(c1, c2, v * 2.0);
  return mix(c2, c3, (v - 0.5) * 2.0);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  // Flow speed modulated by energy
  float flowSpeed = 0.5 + uEnergy * ar * 1.5;

  // Domain warping driven by audio
  vec2 warpedUV = uv;

  // Bass-driven large-scale displacement
  float bassWarp = uBass * ar * 0.3;
  warpedUV += curlNoise(uv * 1.5, t * flowSpeed) * bassWarp;

  // Vortex strength driven by bass
  float vortStr = uVorticity * (1.0 + uBass * ar * 2.0);

  // Multiple vortices
  vec2 v1Pos = vec2(sin(t * 0.3) * 0.5, cos(t * 0.4) * 0.4);
  vec2 v2Pos = vec2(cos(t * 0.25) * 0.6, sin(t * 0.35) * 0.3);
  vec2 v3Pos = vec2(sin(t * 0.5 + 2.0) * 0.3, cos(t * 0.45 + 1.0) * 0.5);

  float v1 = vortex(warpedUV, v1Pos, vortStr, 0.6, t);
  float v2 = vortex(warpedUV, v2Pos, -vortStr * 0.8, 0.5, t * 1.2);
  float v3 = vortex(warpedUV, v3Pos, vortStr * 0.6, 0.4, t * 0.9);

  float vortexField = v1 + v2 + v3;

  // Apply vortex rotation to UV for the fluid simulation
  vec2 fluidUV = warpedUV;
  float vortAngle = vortexField * 0.5;
  float cv = cos(vortAngle), sv = sin(vortAngle);
  fluidUV = vec2(fluidUV.x * cv - fluidUV.y * sv, fluidUV.x * sv + fluidUV.y * cv);

  // Multi-layer fluid
  float fluid1 = fluidFBM(fluidUV * 2.0, t * flowSpeed * 0.5, uViscosity);
  float fluid2 = fluidFBM(fluidUV * 3.0 + 100.0, t * flowSpeed * 0.7 + 50.0, uViscosity * 0.8);
  float fluid3 = fluidFBM(fluidUV * 4.0 + 200.0, t * flowSpeed * 0.3 + 100.0, uViscosity * 1.2);

  // Color injection points driven by EQ bands
  vec3 color = vec3(0.0);

  // Build the fluid color from layers
  float phase = uPitch * 0.001 * uPitchConfidence * ar + t * 0.1;
  vec3 layer1Color = getSchemeColor(fluid1, phase, uColorScheme);
  vec3 layer2Color = getSchemeColor(fluid2, phase + 0.33, uColorScheme);
  vec3 layer3Color = getSchemeColor(fluid3, phase + 0.67, uColorScheme);

  color = layer1Color * 0.5 + layer2Color * 0.3 + layer3Color * 0.2;

  // EQ band color injection: place colored "dye drops" in the fluid
  for (int i = 0; i < 4; i++) {
    float fi = float(i);

    // Sub-bass / bass injection
    float bassVal = uBands[i] * ar;
    vec2 injectPos = vec2(sin(t * 0.3 + fi * 1.57) * 0.6, cos(t * 0.4 + fi * 1.57) * 0.5);
    float injectDist = length(warpedUV - injectPos);
    float inject = exp(-injectDist * 3.0) * bassVal;
    color += getSchemeColor(0.8 + fi * 0.05, phase + fi * 0.1, uColorScheme) * inject * 0.5;

    // Mid injection
    float midVal = uBands[i + 4] * ar;
    vec2 midPos = vec2(cos(t * 0.5 + fi * 1.57 + 0.5) * 0.4, sin(t * 0.6 + fi * 1.57) * 0.3);
    float midDist = length(warpedUV - midPos);
    color += getSchemeColor(0.5 + fi * 0.08, phase + 0.5, uColorScheme) * exp(-midDist * 4.0) * midVal * 0.4;

    // Treble injection: smaller, brighter spots
    float trebVal = uBands[i + 12] * ar;
    vec2 trebPos = vec2(sin(t * 0.8 + fi * 1.57 + 1.0) * 0.7, cos(t * 0.7 + fi * 1.57 + 2.0) * 0.6);
    float trebDist = length(warpedUV - trebPos);
    color += getSchemeColor(0.3 + fi * 0.12, phase + 1.0, uColorScheme) * exp(-trebDist * 6.0) * trebVal * 0.6;
  }

  // Beat intensity: overall brightness surge
  color *= 1.0 + uBeatIntensity * ar * 0.4;

  // Spectral flux: adds turbulent detail
  float fluxNoise = noise(warpedUV * 20.0 + t * 5.0) * uSpectralFlux * ar;
  color += getSchemeColor(fluxNoise, phase, uColorScheme) * fluxNoise * 0.2;

  // Kick: radial shock wave
  float kickWave = uKick * ar;
  float kickDist = length(uv);
  float shockwave = smoothstep(0.05, 0.0, abs(kickDist - mod(t * 3.0, 3.0))) * kickWave;
  color += getSchemeColor(0.9, phase, uColorScheme) * shockwave * 0.5;

  // Vignette
  float vig = 1.0 - 0.4 * dot(uv * 0.35, uv * 0.35);
  color *= vig;

  // Soft HDR tone map
  color = color / (color + 0.6);
  color = pow(color, vec3(0.92));

  gl_FragColor = vec4(color, 1.0);
}
`;

export class FluidDynamics extends ShaderSceneBase {
  constructor() {
    super("fluidDynamics", FRAG);
  }
}
