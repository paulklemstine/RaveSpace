import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash / Noise helpers ---
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
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

float fbm(vec2 p) {
  float f = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    f += amp * noise(p);
    p = rot * p * 2.0;
    amp *= 0.5;
  }
  return f;
}

// Supernova color palettes
vec3 getSupernovaColor(int scheme, float t) {
  t = clamp(t, 0.0, 1.0);
  if (scheme == 1) { // plasma
    vec3 a = vec3(0.2, 0.0, 0.3);
    vec3 b = vec3(0.8, 0.0, 0.6);
    vec3 c = vec3(1.0, 0.3, 0.8);
    vec3 d = vec3(1.0, 0.8, 1.0);
    if (t < 0.33) return mix(a, b, t * 3.0);
    if (t < 0.66) return mix(b, c, (t - 0.33) * 3.0);
    return mix(c, d, (t - 0.66) * 3.0);
  }
  if (scheme == 2) { // quantum
    vec3 a = vec3(0.0, 0.1, 0.2);
    vec3 b = vec3(0.0, 0.5, 0.8);
    vec3 c = vec3(0.3, 0.8, 1.0);
    vec3 d = vec3(1.0, 1.0, 1.0);
    if (t < 0.33) return mix(a, b, t * 3.0);
    if (t < 0.66) return mix(b, c, (t - 0.33) * 3.0);
    return mix(c, d, (t - 0.66) * 3.0);
  }
  if (scheme == 3) { // void
    vec3 a = vec3(0.05, 0.0, 0.05);
    vec3 b = vec3(0.2, 0.0, 0.3);
    vec3 c = vec3(0.5, 0.1, 0.5);
    vec3 d = vec3(0.8, 0.5, 0.9);
    if (t < 0.33) return mix(a, b, t * 3.0);
    if (t < 0.66) return mix(b, c, (t - 0.33) * 3.0);
    return mix(c, d, (t - 0.66) * 3.0);
  }
  // stellar (default)
  vec3 a = vec3(0.1, 0.0, 0.0);
  vec3 b = vec3(0.8, 0.3, 0.0);
  vec3 c = vec3(1.0, 0.7, 0.2);
  vec3 d = vec3(1.0, 1.0, 0.9);
  if (t < 0.33) return mix(a, b, t * 3.0);
  if (t < 0.66) return mix(b, c, (t - 0.33) * 3.0);
  return mix(c, d, (t - 0.66) * 3.0);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed;
  float react = uAudioReactivity;

  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  // Kick-driven explosion pulse
  float kickPulse = uKick * react * 1.5;
  float beatPulse = uBeatIntensity * react;

  // Core - bright hot center
  float core = 0.05 / (r + 0.02);
  core *= uIntensity;
  core *= 1.0 + kickPulse * 2.0;

  // Core glow
  float coreGlow = exp(-r * r * 3.0) * uIntensity;
  coreGlow *= 1.0 + beatPulse;

  // Expanding rings - bass drives expansion
  float bassExpand = uBass * react;
  float rings = 0.0;
  int numRings = int(uRingCount);
  for (int i = 0; i < 5; i++) {
    if (i >= numRings) break;
    float fi = float(i);
    float ringRadius = 0.2 + fi * 0.3 + bassExpand * 0.5;

    // Ring expands over time with pulsing
    float expandTime = fract(time * 0.3 + fi * 0.2);
    ringRadius += expandTime * 1.5;

    float ringWidth = 0.02 + fi * 0.01;
    float ring = exp(-(r - ringRadius) * (r - ringRadius) / (ringWidth * ringWidth));

    // Ring fades as it expands
    ring *= exp(-expandTime * 2.0);

    // Angular variation
    float angularVar = sin(angle * (4.0 + fi * 2.0) + time + fi) * 0.3;
    ring *= 1.0 + angularVar;

    rings += ring;
  }

  // Particle ejection / debris field
  float particles = 0.0;
  float fluxDensity = uSpectralFlux * react;
  for (float i = 0.0; i < 20.0; i++) {
    float seed = i * 7.31;
    float particleAngle = hash11(seed) * 6.28;
    float particleSpeed = 0.3 + hash11(seed + 1.0) * 1.5;
    float particleTime = fract(time * particleSpeed * 0.2 + hash11(seed + 2.0));

    float particleR = particleTime * 2.0;
    vec2 particlePos = vec2(cos(particleAngle), sin(particleAngle)) * particleR;

    // Add some wobble
    particlePos += vec2(sin(time * 2.0 + seed), cos(time * 2.0 + seed)) * 0.05;

    float d = length(uv - particlePos);
    float particleSize = 0.005 + hash11(seed + 3.0) * 0.01;
    particleSize *= 1.0 + fluxDensity * 2.0; // spectral flux drives density

    float particle = particleSize / (d * d + 0.001);
    particle *= exp(-particleTime * 3.0); // fade out

    particles += particle * 0.01;
  }

  // Shockwave - expanding distortion ring
  float shockwaveTime = fract(time * 0.15 + kickPulse * 0.5);
  float shockwaveR = shockwaveTime * 3.0;
  float shockwave = exp(-(r - shockwaveR) * (r - shockwaveR) * 50.0);
  shockwave *= exp(-shockwaveTime * 2.0);

  // Nebula remnant - swirling gas (cylindrical coords to avoid seam at ±π)
  float nebAngle = angle + time * 0.1;
  float nebula = fbm(vec2(cos(nebAngle) * 3.0 + r * 2.0, sin(nebAngle) * 3.0 + time * 0.2));
  nebula *= exp(-r * 0.5);
  nebula *= 0.5 + beatPulse * 0.5;

  // EQ band-driven radial rays
  float rays = 0.0;
  for (int i = 0; i < 16; i++) {
    float rayAngle = float(i) * 6.28 / 16.0;
    float angleDiff = abs(mod(angle - rayAngle + 3.14, 6.28) - 3.14);
    float ray = exp(-angleDiff * angleDiff * 80.0);
    ray *= uBands[i] * react;
    ray *= exp(-r * 1.5);
    rays += ray;
  }

  // Color mapping
  float coreIntensity = clamp(core * 0.1 + coreGlow, 0.0, 1.0);
  vec3 coreColor = getSupernovaColor(uColorScheme, 0.9) * core * 0.1;
  coreColor += getSupernovaColor(uColorScheme, 0.7) * coreGlow;

  vec3 ringColor = getSupernovaColor(uColorScheme, 0.5) * rings;
  vec3 particleColor = getSupernovaColor(uColorScheme, 0.8) * particles;
  vec3 shockwaveColor = getSupernovaColor(uColorScheme, 1.0) * shockwave * 1.5;
  vec3 nebulaColor = getSupernovaColor(uColorScheme, 0.3) * nebula * 0.6;
  vec3 rayColor = getSupernovaColor(uColorScheme, 0.6) * rays;

  // Pitch-reactive hue shift on nebula
  float pitchHue = uPitch * 0.001 * uPitchConfidence * react;
  nebulaColor.r *= 1.0 + sin(pitchHue) * 0.3;
  nebulaColor.b *= 1.0 + cos(pitchHue) * 0.3;

  // Combine all layers
  vec3 color = vec3(0.0);
  color += nebulaColor;
  color += rayColor;
  color += ringColor;
  color += particleColor;
  color += shockwaveColor;
  color += coreColor;

  // Energy brightness
  color *= 0.6 + uEnergy * react * 0.6;

  // Star background
  float starField = 0.0;
  vec2 starUv = uv * 60.0;
  vec2 starId = floor(starUv);
  vec2 starF = fract(starUv) - 0.5;
  float starH = hash21(starId);
  if (starH > 0.97) {
    starField = (starH - 0.97) * 33.0 * exp(-dot(starF, starF) * 80.0);
    starField *= 0.5 + 0.5 * sin(time * 2.0 + starH * 20.0);
  }
  color += vec3(starField * 0.15);

  // Vignette
  vec2 vc = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(vc, vc) * 0.2;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;

export class SuperNova extends ShaderSceneBase {
  constructor() {
    super("superNova", FRAG);
  }
}
