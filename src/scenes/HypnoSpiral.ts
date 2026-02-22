import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash / Noise helpers ---
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

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Color palettes
vec3 getSpiralColor(int scheme, float t, float layer) {
  if (scheme == 1) { // mono - black and white with slight blue
    float v = sin(t * 6.28) * 0.5 + 0.5;
    return vec3(v * 0.9, v * 0.9, v);
  }
  if (scheme == 2) { // candy
    vec3 c1 = vec3(1.0, 0.4, 0.7);  // pink
    vec3 c2 = vec3(0.4, 0.8, 1.0);  // baby blue
    vec3 c3 = vec3(1.0, 0.9, 0.4);  // yellow
    vec3 c4 = vec3(0.6, 1.0, 0.6);  // mint
    float h = fract(t);
    if (h < 0.25) return mix(c1, c2, h * 4.0);
    if (h < 0.5) return mix(c2, c3, (h - 0.25) * 4.0);
    if (h < 0.75) return mix(c3, c4, (h - 0.5) * 4.0);
    return mix(c4, c1, (h - 0.75) * 4.0);
  }
  if (scheme == 3) { // toxic
    vec3 c1 = vec3(0.0, 1.0, 0.0);  // neon green
    vec3 c2 = vec3(0.5, 0.0, 1.0);  // purple
    vec3 c3 = vec3(0.0, 0.0, 0.0);  // black
    float h = fract(t);
    if (h < 0.5) return mix(c1, c2, h * 2.0);
    return mix(c2, c3, (h - 0.5) * 2.0);
  }
  // psychedelic (default) - full rainbow cycling
  return hsv2rgb(vec3(fract(t + layer * 0.3), 1.0, 0.9));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed;
  float react = uAudioReactivity;

  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  // Energy drives rotation speed
  float energySpeed = 1.0 + uEnergy * react * 2.0;

  // Number of spiral arms - mid bands modulate
  float midBands = (uBands[4] + uBands[5] + uBands[6] + uBands[7]) * 0.25;
  float armCount = uArms + midBands * react * 3.0;

  // Bass drives depth pulsation
  float bassPulse = uBass * react;
  float depthVal = uDepth + bassPulse * 1.5;

  // Main spiral
  float spiral = 0.0;
  float spiralAngle = angle + r * depthVal * 3.0 - time * energySpeed;
  spiral = sin(spiralAngle * armCount) * 0.5 + 0.5;

  // Layered spirals for depth
  float spiral2Angle = angle - r * depthVal * 2.0 + time * energySpeed * 0.7;
  float spiral2 = sin(spiral2Angle * (armCount * 0.5)) * 0.5 + 0.5;

  float spiral3Angle = angle + r * depthVal * 4.0 - time * energySpeed * 1.3;
  float spiral3 = sin(spiral3Angle * (armCount * 1.5)) * 0.5 + 0.5;

  // Tunnel / zoom effect
  float tunnel = fract(r * depthVal - time * 0.5);
  float tunnelRing = smoothstep(0.0, 0.1, tunnel) * smoothstep(0.3, 0.2, tunnel);

  // Combine spiral patterns
  float pattern = spiral * 0.5 + spiral2 * 0.3 + spiral3 * 0.2;
  pattern = pow(pattern, 1.5); // Increase contrast

  // Beat intensity pulsation
  float beatPulse = uBeatIntensity * react;
  pattern *= 1.0 + beatPulse * 0.5;

  // Hypnotic concentric rings
  float rings = sin(r * 20.0 * depthVal - time * 3.0) * 0.5 + 0.5;
  rings *= exp(-r * 0.5);

  // EQ-driven radial brightness bands
  float eqRadial = 0.0;
  for (int i = 0; i < 16; i++) {
    float bandAngle = float(i) * 6.28 / 16.0;
    float angleDist = abs(mod(angle - bandAngle + 3.14, 6.28) - 3.14);
    float bandWidth = 0.3;
    float band = exp(-angleDist * angleDist / (bandWidth * bandWidth));
    eqRadial += band * uBands[i] * react;
  }

  // Color computation
  float colorPhase = angle / 6.28 + r * 0.3 + time * 0.1;
  float layerPhase = spiral * 0.5;

  vec3 color1 = getSpiralColor(uColorScheme, colorPhase + pattern * 0.5, layerPhase);
  vec3 color2 = getSpiralColor(uColorScheme, colorPhase + 0.5, layerPhase + 0.5);

  vec3 color = mix(color1, color2, pattern);

  // Add tunnel rings
  vec3 ringColor = getSpiralColor(uColorScheme, colorPhase + 0.3, 0.7);
  color += ringColor * tunnelRing * 0.3;

  // Add concentric ring accent
  color += color * rings * 0.2;

  // EQ radial glow
  vec3 eqColor = getSpiralColor(uColorScheme, angle / 6.28, 0.5);
  color += eqColor * eqRadial * 0.3;

  // Center glow
  float centerGlow = 0.1 / (r + 0.1);
  vec3 centerColor = getSpiralColor(uColorScheme, time * 0.1, 0.0);
  color += centerColor * centerGlow * 0.3 * (1.0 + beatPulse);

  // Kick flash - bright center pulse
  float kickFlash = uKick * react;
  color += centerColor * exp(-r * 3.0) * kickFlash * 2.0;

  // Pitch-reactive hue shift
  float pitchHue = uPitch * 0.001 * uPitchConfidence * react;
  float cosH = cos(pitchHue * 0.5);
  float sinH = sin(pitchHue * 0.5);
  mat3 hueRot = mat3(
    0.299 + 0.701 * cosH + 0.168 * sinH,
    0.587 - 0.587 * cosH + 0.330 * sinH,
    0.114 - 0.114 * cosH - 0.497 * sinH,
    0.299 - 0.299 * cosH - 0.328 * sinH,
    0.587 + 0.413 * cosH + 0.035 * sinH,
    0.114 - 0.114 * cosH + 0.292 * sinH,
    0.299 - 0.299 * cosH + 1.250 * sinH,
    0.587 - 0.587 * cosH - 1.050 * sinH,
    0.114 + 0.886 * cosH - 0.203 * sinH
  );
  color = hueRot * color;

  // Spectral flux distortion
  float flux = uSpectralFlux * react;
  float distort = noise(vec2(angle * 3.0, r * 5.0 + time)) * flux;
  color *= 1.0 + distort * 0.3;

  // Distance fade (subtle)
  color *= exp(-r * r * 0.1);

  // Vignette
  vec2 vc = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(vc, vc) * 0.2;
  color *= vig;

  // Treble shimmer
  float shimmer = noise(vec2(angle * 10.0, r * 15.0 + time * 3.0));
  color += color * shimmer * uTreble * react * 0.15;

  gl_FragColor = vec4(color, 1.0);
}
`;

export class HypnoSpiral extends ShaderSceneBase {
  constructor() {
    super("hypnoSpiral", FRAG);
  }
}
