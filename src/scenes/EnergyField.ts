import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash / Noise helpers ---
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = dot(i, vec3(1.0, 57.0, 113.0));
  return mix(mix(mix(hash(n), hash(n + 1.0), f.x),
                 mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
             mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                 mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = p * 2.01 + 0.5;
    a *= 0.5;
  }
  return v;
}

// Electric arc / discharge function
float electricArc(vec2 uv, vec2 from, vec2 to, float time, float seed) {
  vec2 dir = to - from;
  float len = length(dir);
  dir /= len;
  vec2 perp = vec2(-dir.y, dir.x);

  vec2 rel = uv - from;
  float along = dot(rel, dir);
  float across = dot(rel, perp);

  if (along < 0.0 || along > len) return 0.0;

  float t = along / len;
  // Jagged displacement
  float displacement = 0.0;
  float freq = 8.0;
  float amp = 0.08;
  for (int i = 0; i < 4; i++) {
    displacement += amp * sin(t * freq + time * (3.0 + float(i)) + seed * 13.7);
    freq *= 2.3;
    amp *= 0.5;
  }
  displacement += 0.03 * noise(vec2(t * 20.0, time * 5.0 + seed));

  float dist = abs(across - displacement);
  float core = exp(-dist * 80.0);
  float glow = exp(-dist * 15.0) * 0.5;
  return core + glow;
}

vec3 getSchemeColor(float intensity, float hue, int scheme) {
  if (scheme == 1) {
    // electric: blue-white lightning
    return mix(vec3(0.1, 0.2, 0.8), vec3(0.7, 0.85, 1.0), intensity) * (0.8 + 0.4 * sin(hue * 6.283));
  } else if (scheme == 2) {
    // force: green force field
    return mix(vec3(0.0, 0.3, 0.1), vec3(0.2, 1.0, 0.4), intensity) * (0.8 + 0.3 * cos(hue * 6.283));
  } else if (scheme == 3) {
    // dark: deep purple / black
    return mix(vec3(0.05, 0.0, 0.1), vec3(0.4, 0.1, 0.6), intensity) * (0.6 + 0.4 * sin(hue * 3.14));
  }
  // 0 = plasma: hot pinks and oranges
  vec3 hot = vec3(1.0, 0.3, 0.1);
  vec3 cool = vec3(0.8, 0.1, 0.5);
  return mix(cool, hot, intensity) * (0.8 + 0.4 * sin(hue * 6.283 + 1.0));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // Energy sphere / force field
  float fieldRadius = 0.5 + 0.1 * sin(t * 0.7);
  float fieldEdge = fieldRadius + 0.05 * uFieldStrength;

  // Field pulsation driven by bass
  float bassInfluence = uBass * ar;
  fieldRadius += 0.1 * bassInfluence;
  fieldEdge = fieldRadius + 0.05 * uFieldStrength + 0.03 * uBeatIntensity * ar;

  // Field shell
  float shell = smoothstep(fieldEdge + 0.1, fieldEdge, dist) *
                smoothstep(fieldRadius - 0.1, fieldRadius, dist);

  // Surface noise on the field (cylindrical coords to avoid seam at ±π)
  float surfNoise = fbm(vec2(cos(angle) * 3.0 + sin(angle) * 2.0, dist * 5.0 - t * 2.0)) * 0.5 +
                    fbm(vec2(cos(angle) * 5.0 + t, sin(angle) * 5.0 + dist * 8.0)) * 0.3;
  shell *= (0.5 + surfNoise);

  // Inner energy
  float innerGlow = smoothstep(fieldRadius, 0.0, dist);
  float innerEnergy = fbm(uv * 3.0 + t * 0.5) * innerGlow;
  innerEnergy += noise(uv * 8.0 - t * 1.5) * innerGlow * 0.5;
  innerEnergy *= (0.5 + 0.5 * uEnergy * ar);

  // Particle density from spectral flux
  float particles = 0.0;
  float pDensity = uParticleDensity + uSpectralFlux * 3.0 * ar;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float pAngle = fi * 0.524 + t * (0.3 + fi * 0.05);
    float pRadius = 0.3 + 0.4 * hash(fi * 7.3);
    pRadius += 0.15 * sin(t * (1.0 + fi * 0.2));
    vec2 pPos = vec2(cos(pAngle), sin(pAngle)) * pRadius;
    float pDist = length(uv - pPos);
    float pSize = 0.02 + 0.01 * hash(fi * 3.1);
    pSize *= pDensity / 3.0;
    particles += smoothstep(pSize, pSize * 0.2, pDist) * (0.5 + 0.5 * hash(fi));
  }

  // Electric discharges on beat/kick
  float dischargeIntensity = 0.0;
  float kickTrigger = uKick * ar;
  float beatTrigger = uBeat * ar;
  float dischargeStrength = max(kickTrigger, beatTrigger * 0.7);

  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float seed = fi * 3.7;
    float arcAngle = fi * 1.047 + t * 0.5 + hash(fi) * 6.283;
    vec2 arcStart = vec2(cos(arcAngle), sin(arcAngle)) * fieldRadius;
    float arcLen = 0.3 + 0.3 * hash(fi * 2.1 + floor(t * 2.0));
    vec2 arcEnd = vec2(cos(arcAngle + 0.2), sin(arcAngle + 0.2)) * (fieldRadius + arcLen);

    float arc = electricArc(uv, arcStart, arcEnd, t * 3.0, seed);
    dischargeIntensity += arc * dischargeStrength;

    // EQ band-driven arcs
    int bandIdx = int(mod(fi, 4.0));
    float bandVal = 0.0;
    if (bandIdx == 0) bandVal = uBands[0];
    else if (bandIdx == 1) bandVal = uBands[4];
    else if (bandIdx == 2) bandVal = uBands[8];
    else bandVal = uBands[12];
    dischargeIntensity += arc * bandVal * ar * 0.5;
  }

  // Color assembly
  float hue = angle / 6.283 + t * 0.1 + uPitch * 0.001 * uPitchConfidence * ar;
  float fieldIntensity = shell + innerEnergy * 0.5;

  vec3 color = vec3(0.0);

  // Background: dark with faint radial gradient
  color += vec3(0.02, 0.01, 0.03) * (1.0 - dist * 0.3);

  // Field shell color
  vec3 fieldColor = getSchemeColor(fieldIntensity, hue, uColorScheme);
  color += fieldColor * shell * uFieldStrength;

  // Inner energy glow
  vec3 innerColor = getSchemeColor(innerEnergy, hue + 0.3, uColorScheme);
  color += innerColor * innerEnergy * 0.8;

  // Particles
  vec3 particleColor = getSchemeColor(1.0, hue + 0.5, uColorScheme);
  color += particleColor * particles * 0.7;

  // Discharges: bright white-tinted
  vec3 arcColor = getSchemeColor(1.0, hue, uColorScheme) * 0.5 + vec3(0.5, 0.5, 0.6);
  color += arcColor * dischargeIntensity;

  // Beat intensity pulse on the whole field
  float pulse = uBeatIntensity * ar * 0.3;
  color += getSchemeColor(0.5, hue, uColorScheme) * pulse * exp(-dist * 2.0);

  // Outer glow
  float outerGlow = exp(-(dist - fieldRadius) * 3.0) * smoothstep(fieldRadius, fieldRadius + 0.5, dist) * 0.3;
  color += getSchemeColor(0.3, hue, uColorScheme) * outerGlow * uFieldStrength;

  // Vignette
  float vig = 1.0 - 0.3 * dot(uv * 0.4, uv * 0.4);
  color *= vig;

  // HDR tone mapping
  color = 1.0 - exp(-color * 1.5);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class EnergyField extends ShaderSceneBase {
  constructor() {
    super("energyField", FRAG);
  }
}
