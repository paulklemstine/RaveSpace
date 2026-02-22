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

// Circuit-like pattern: grid with random connections
float circuitPattern(vec2 uv, float scale, float time) {
  vec2 cell = floor(uv * scale);
  vec2 f = fract(uv * scale);

  float rnd = hash2(cell);

  // Horizontal and vertical lines based on random seed
  float lineH = smoothstep(0.48, 0.5, f.y) * smoothstep(0.52, 0.5, f.y);
  float lineV = smoothstep(0.48, 0.5, f.x) * smoothstep(0.52, 0.5, f.x);

  // Selective lines per cell
  float h = step(0.3, hash2(cell + 0.1)) * lineH;
  float v = step(0.3, hash2(cell + 0.2)) * lineV;

  // Corner nodes
  float corner = smoothstep(0.12, 0.08, length(f - 0.5));
  float node = step(0.5, rnd) * corner;

  // Animated data pulse along lines
  float pulse = sin((f.x + f.y) * 12.566 - time * 3.0) * 0.5 + 0.5;

  return (h + v) * (0.3 + 0.7 * pulse) + node;
}

vec3 getSchemeColor(float val, int scheme) {
  if (scheme == 0) {
    // neon: cyan and magenta
    vec3 c1 = vec3(0.0, 1.0, 0.9);
    vec3 c2 = vec3(1.0, 0.0, 0.6);
    return mix(c1, c2, val);
  } else if (scheme == 1) {
    // tron: blue-white light lines
    vec3 c1 = vec3(0.0, 0.4, 1.0);
    vec3 c2 = vec3(0.7, 0.9, 1.0);
    return mix(c1, c2, val);
  } else if (scheme == 2) {
    // matrix: green
    vec3 c1 = vec3(0.0, 0.3, 0.0);
    vec3 c2 = vec3(0.2, 1.0, 0.3);
    return mix(c1, c2, val);
  }
  // 3 = blade: orange and dark
  vec3 c1 = vec3(0.8, 0.3, 0.0);
  vec3 c2 = vec3(1.0, 0.7, 0.2);
  return mix(c1, c2, val);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  vec3 color = vec3(0.0);

  // Background: dark with subtle circuit grid
  float bgCircuit = circuitPattern(uv, 8.0, t * 0.3) * 0.08;
  color += getSchemeColor(0.3, uColorScheme) * bgCircuit;

  // Concentric pulse rings radiating from center
  float pulseRate = uPulseRate;
  // Sync pulse rate to beat
  float beatSync = uBeatIntensity * ar;
  pulseRate += beatSync * 2.0;

  float numRings = 8.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float ringTime = t * pulseRate * 0.5;
    float ringDist = mod(fi * 0.3 + ringTime, 3.0);

    float ringWidth = 0.03 * uLineThickness;
    float ring = smoothstep(ringWidth, 0.0, abs(dist - ringDist));

    // Add circuit-like segments to the ring
    float segmented = step(0.3, sin(angle * (6.0 + fi * 2.0) + t * (1.0 + fi * 0.3)));
    ring *= (0.5 + 0.5 * segmented);

    // EQ band drives ring brightness
    int bandIdx = int(mod(fi, 4.0)) * 4;
    float bandVal = 0.0;
    if (bandIdx == 0) bandVal = (uBands[0] + uBands[1]) * 0.5;
    else if (bandIdx == 4) bandVal = (uBands[4] + uBands[5]) * 0.5;
    else if (bandIdx == 8) bandVal = (uBands[8] + uBands[9]) * 0.5;
    else bandVal = (uBands[12] + uBands[13]) * 0.5;

    float brightness = 0.5 + bandVal * ar * 1.5;

    // Color varies per ring
    float hueVar = fi / numRings;
    vec3 ringColor = getSchemeColor(hueVar, uColorScheme);
    color += ringColor * ring * brightness;

    // Ring glow
    float ringGlow = exp(-abs(dist - ringDist) * 10.0 / uLineThickness) * 0.15;
    color += ringColor * ringGlow * brightness * 0.5;
  }

  // Circuit overlay: detailed pattern that overlays everything
  float circuit = circuitPattern(uv, 15.0, t);
  float circuitBrightness = 0.2 + 0.3 * uMid * ar;
  vec3 circuitColor = getSchemeColor(0.5 + 0.5 * sin(t * 0.5), uColorScheme);
  color += circuitColor * circuit * circuitBrightness * (1.0 - smoothstep(0.0, 2.0, dist));

  // Radial scan lines
  float scanAngle = mod(t * 2.0, 6.283);
  float scan = smoothstep(0.1, 0.0, abs(mod(angle - scanAngle, 6.283) - 3.1416));
  scan *= smoothstep(2.0, 0.0, dist);
  color += getSchemeColor(0.8, uColorScheme) * scan * 0.4;

  // Center flash on kick
  float kickFlash = uKick * ar;
  float centerFlash = kickFlash * exp(-dist * 4.0);
  color += vec3(1.0, 0.95, 0.9) * centerFlash * 1.5;

  // Data stream lines: vertical/horizontal pulses
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float streamPos = sin(t * (0.5 + fi * 0.3) + fi * 1.5) * 1.5;
    // Horizontal streams
    float streamH = smoothstep(0.02 * uLineThickness, 0.0, abs(uv.y - streamPos));
    float streamPulse = step(0.5, noise(vec2(uv.x * 5.0 + t * 3.0, fi)));
    color += getSchemeColor(0.7, uColorScheme) * streamH * streamPulse * 0.3;
    // Vertical streams
    float streamV = smoothstep(0.02 * uLineThickness, 0.0, abs(uv.x - streamPos));
    float streamPulseV = step(0.5, noise(vec2(uv.y * 5.0 + t * 3.0, fi + 10.0)));
    color += getSchemeColor(0.3, uColorScheme) * streamV * streamPulseV * 0.3;
  }

  // Pitch-reactive color shift on everything
  float pitchShift = uPitch * 0.0005 * uPitchConfidence * ar;
  color = mix(color, color.gbr, clamp(pitchShift, 0.0, 0.3));

  // Beat intensity global pulse
  color *= 1.0 + uBeatIntensity * ar * 0.3;

  // Spectral flux adds digital noise
  float noiseOverlay = noise(uv * 50.0 + t * 10.0) * uSpectralFlux * ar * 0.15;
  color += getSchemeColor(0.5, uColorScheme) * noiseOverlay;

  // Vignette
  float vig = 1.0 - 0.5 * dot(uv * 0.4, uv * 0.4);
  color *= vig;

  // Tone map
  color = 1.0 - exp(-color * 1.2);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class CyberPulse extends ShaderSceneBase {
  constructor() {
    super("cyberPulse", FRAG);
  }
}
