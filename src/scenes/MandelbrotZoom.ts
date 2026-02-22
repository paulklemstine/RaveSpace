import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Palette helper ---
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

vec3 getSchemeColor(float t, float phase, int scheme) {
  t = fract(t + phase);
  if (scheme == 0) {
    // electric: cyan, blue, white, purple
    return palette(t, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                   vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
  } else if (scheme == 1) {
    // cosmic: deep purples, blues, golds
    return palette(t, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                   vec3(0.8, 0.8, 0.5), vec3(0.0, 0.2, 0.5));
  } else if (scheme == 2) {
    // fire: reds, oranges, yellows, black
    vec3 c1 = vec3(0.0, 0.0, 0.0);
    vec3 c2 = vec3(0.5, 0.0, 0.0);
    vec3 c3 = vec3(1.0, 0.5, 0.0);
    vec3 c4 = vec3(1.0, 1.0, 0.3);
    if (t < 0.33) return mix(c1, c2, t / 0.33);
    if (t < 0.66) return mix(c2, c3, (t - 0.33) / 0.33);
    return mix(c3, c4, (t - 0.66) / 0.34);
  }
  // 3 = ice: whites, light blues, teals
  vec3 c1 = vec3(0.0, 0.05, 0.1);
  vec3 c2 = vec3(0.1, 0.4, 0.6);
  vec3 c3 = vec3(0.4, 0.8, 0.9);
  vec3 c4 = vec3(0.9, 0.95, 1.0);
  if (t < 0.33) return mix(c1, c2, t / 0.33);
  if (t < 0.66) return mix(c2, c3, (t - 0.33) / 0.33);
  return mix(c3, c4, (t - 0.66) / 0.34);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed * 0.3;
  float ar = uAudioReactivity;

  // Zoom: exponential zoom driven by time and energy
  float zoomBase = uZoom;
  float energyZoom = uEnergy * ar * 0.5;
  float zoomLevel = exp(t * (0.5 + energyZoom) * zoomBase);

  // Zoom target: a deep interesting point in the Mandelbrot set
  // Cycle between several interesting coordinates
  float targetPhase = mod(t * 0.05, 4.0);
  vec2 target;
  if (targetPhase < 1.0) {
    // Seahorse valley
    target = vec2(-0.7463, 0.1102);
  } else if (targetPhase < 2.0) {
    // Elephant valley
    target = vec2(0.2826, 0.0100);
  } else if (targetPhase < 3.0) {
    // Double spiral
    target = vec2(-0.1011, 0.9563);
  } else {
    // Antenna area
    target = vec2(-1.7497, 0.0);
  }
  // Smooth transition between targets
  float tt = fract(targetPhase);
  float blend = smoothstep(0.8, 1.0, tt) + smoothstep(0.0, 0.2, tt);

  // Map screen coords to complex plane
  vec2 c = target + uv / zoomLevel;

  // Iteration count modulated by treble
  float trebleAvg = (uBands[12] + uBands[13] + uBands[14] + uBands[15]) * 0.25;
  int maxIter = int(uIterations + trebleAvg * ar * 30.0);
  maxIter = min(maxIter, 128);

  // Mandelbrot iteration with smooth coloring
  vec2 z = vec2(0.0);
  float smoothIter = 0.0;
  bool escaped = false;

  for (int i = 0; i < 128; i++) {
    if (i >= maxIter) break;

    // z = z^2 + c
    float zx = z.x * z.x - z.y * z.y + c.x;
    float zy = 2.0 * z.x * z.y + c.y;
    z = vec2(zx, zy);

    float mag2 = dot(z, z);
    if (mag2 > 256.0) {
      // Smooth iteration count (normalized)
      smoothIter = float(i) - log2(log2(mag2)) + 4.0;
      escaped = true;
      break;
    }
  }

  vec3 color;

  if (!escaped) {
    // Inside the set: dark with subtle glow
    float internalAngle = atan(z.y, z.x) / 6.283 + 0.5;
    float mag = length(z);
    color = getSchemeColor(internalAngle, 0.0, uColorScheme) * 0.1;
    // Beat pulse inside
    color += getSchemeColor(0.5, 0.0, uColorScheme) * uBeatIntensity * ar * 0.2;
  } else {
    // Color based on smooth iteration count
    float normalizedIter = smoothIter / float(maxIter);

    // Pitch-reactive color cycling
    float pitchPhase = uPitch * 0.001 * uPitchConfidence * ar;

    // Time-based color cycling
    float colorPhase = t * 0.2 + pitchPhase;

    // Use smooth iteration for coloring
    float colorVal = fract(smoothIter * 0.02 + colorPhase);
    color = getSchemeColor(colorVal, colorPhase * 0.1, uColorScheme);

    // Brightness based on iteration proximity to escape
    float brightness = 1.0 - normalizedIter * 0.5;
    color *= brightness;

    // EQ band modulation: different frequency bands affect different iteration ranges
    float iterFrac = normalizedIter * 4.0;
    if (iterFrac < 1.0) {
      float bandVal = (uBands[0] + uBands[1] + uBands[2] + uBands[3]) * 0.25;
      color *= 1.0 + bandVal * ar * 0.8;
    } else if (iterFrac < 2.0) {
      float bandVal = (uBands[4] + uBands[5] + uBands[6] + uBands[7]) * 0.25;
      color *= 1.0 + bandVal * ar * 0.8;
    } else if (iterFrac < 3.0) {
      float bandVal = (uBands[8] + uBands[9] + uBands[10] + uBands[11]) * 0.25;
      color *= 1.0 + bandVal * ar * 0.8;
    } else {
      float bandVal = (uBands[12] + uBands[13] + uBands[14] + uBands[15]) * 0.25;
      color *= 1.0 + bandVal * ar * 0.8;
    }

    // Edge detection: highlight the boundary
    float edgeGlow = exp(-smoothIter * 0.1) * 2.0;
    color += getSchemeColor(colorVal + 0.5, colorPhase * 0.1, uColorScheme) * edgeGlow * 0.3;
  }

  // Beat intensity: overall luminance pulse
  color *= 1.0 + uBeatIntensity * ar * 0.3;

  // Kick: bright flash from set center
  float kickFlash = uKick * ar;
  float kickDist = length(uv);
  color += vec3(1.0, 0.95, 0.9) * kickFlash * exp(-kickDist * 3.0) * 0.5;

  // Spectral flux: add subtle color noise
  float flux = uSpectralFlux * ar;
  float noiseVal = fract(sin(dot(uv * zoomLevel * 0.001, vec2(12.9898, 78.233))) * 43758.5453);
  color += getSchemeColor(noiseVal, 0.0, uColorScheme) * flux * 0.1;

  // Vignette
  float vig = 1.0 - 0.35 * dot(uv * 0.4, uv * 0.4);
  color *= vig;

  // Tone map
  color = pow(color, vec3(0.9));
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class MandelbrotZoom extends ShaderSceneBase {
  constructor() {
    super("mandelbrotZoom", FRAG);
  }
}
