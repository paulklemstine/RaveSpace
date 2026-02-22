import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
vec3 waveformPalette(float t, int scheme) {
  if (scheme == 1) {
    // fire: red, orange, yellow
    return vec3(1.0, 0.3, 0.0) + vec3(0.2, 0.4, 0.1) * sin(vec3(1.0, 2.0, 3.0) * t * 6.28 + vec3(0.0, 0.5, 1.0));
  } else if (scheme == 2) {
    // ice: blue, cyan, white
    return vec3(0.2, 0.5, 1.0) + vec3(0.3, 0.3, 0.2) * sin(vec3(2.0, 1.5, 1.0) * t * 6.28 + vec3(0.5, 0.0, 1.0));
  } else if (scheme == 3) {
    // spectrum: full rainbow based on position
    return 0.5 + 0.5 * cos(6.28 * (t + vec3(0.0, 0.33, 0.67)));
  }
  // neon: pink, cyan, green
  vec3 a = vec3(1.0, 0.1, 0.6);
  vec3 b = vec3(0.0, 1.0, 1.0);
  vec3 c = vec3(0.2, 1.0, 0.3);
  float p = fract(t);
  if (p < 0.333) return mix(a, b, p * 3.0);
  else if (p < 0.667) return mix(b, c, (p - 0.333) * 3.0);
  else return mix(c, a, (p - 0.667) * 3.0);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed * 0.3;
  float ar = uAudioReactivity;
  float glow = uGlowIntensity;
  float bw = uBarWidth;

  vec3 col = vec3(0.0);

  // 16 bars layout
  float totalBars = 16.0;
  float barSpacing = aspect * 2.0 / totalBars;
  float barW = barSpacing * 0.6 * bw;
  float gap = barSpacing * 0.4 / bw;

  // Center the bars
  float startX = -aspect + barSpacing * 0.5;

  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float barCenterX = startX + fi * barSpacing;

    // Get band value
    float bandVal = uBands[i] * ar;

    // Bar height with smoothing
    float barH = bandVal * 0.8;

    // Horizontal distance to bar center
    float dx = abs(uv.x - barCenterX);
    float halfWidth = barW * 0.5;

    // Inside bar horizontally?
    float inBarX = smoothstep(halfWidth + 0.005, halfWidth - 0.005, dx);

    // Bar top position
    float barTop = barH;
    float barBottom = 0.0;

    // Bar body (above center line)
    float inBarY = smoothstep(barBottom - 0.005, barBottom + 0.005, uv.y) *
                   smoothstep(barTop + 0.005, barTop - 0.005, uv.y);

    // === Main bar ===
    float bar = inBarX * inBarY;

    // Color gradient along bar height
    float barGradient = (uv.y - barBottom) / max(barTop - barBottom, 0.001);
    barGradient = clamp(barGradient, 0.0, 1.0);

    // Each bar gets a hue based on its index
    float hue = fi / totalBars;
    vec3 barCol = waveformPalette(hue, uColorScheme);

    // Brighter at the top
    barCol *= 0.5 + barGradient * 0.8;

    // Beat pulse glow
    float beatGlow = uBeatIntensity * ar;
    barCol *= 1.0 + beatGlow * 0.5;

    col += barCol * bar;

    // === Bar glow (soft aura around the bar) ===
    float glowDist = max(dx - halfWidth, 0.0);
    float glowY = 0.0;
    if (uv.y > barTop) glowY = uv.y - barTop;
    else if (uv.y < barBottom) glowY = barBottom - uv.y;
    float glowR = sqrt(glowDist * glowDist + glowY * glowY);
    float barGlow = exp(-glowR * glowR * (20.0 / (glow * glow)));
    barGlow *= bandVal; // glow proportional to band level

    col += barCol * barGlow * glow * 0.3;

    // === Tip glow: bright cap on top of bar ===
    float tipDist = length(vec2(dx, uv.y - barTop));
    float tipGlow = exp(-tipDist * tipDist * 100.0) * bandVal;
    col += vec3(1.0, 1.0, 0.9) * tipGlow * 0.8;

    // === Reflection below (mirror) ===
    float reflY = -uv.y; // mirror position
    float reflBarTop = barH;
    float reflInY = smoothstep(-0.005, 0.005, reflY) *
                    smoothstep(reflBarTop + 0.005, reflBarTop - 0.005, reflY);
    float reflBar = inBarX * reflInY;

    float reflGradient = clamp(reflY / max(reflBarTop, 0.001), 0.0, 1.0);
    vec3 reflCol = barCol * 0.3 * (1.0 - reflGradient * 0.7); // fades with distance

    col += reflCol * reflBar;

    // Reflection glow
    float reflGlowY = max(reflY - reflBarTop, 0.0);
    float reflGlowR = sqrt(glowDist * glowDist + reflGlowY * reflGlowY);
    float reflGlow = exp(-reflGlowR * reflGlowR * (30.0 / (glow * glow)));
    col += reflCol * reflGlow * glow * 0.15;
  }

  // === Center line ===
  float centerLine = exp(-uv.y * uv.y * 500.0) * 0.3;
  col += vec3(0.5, 0.5, 0.6) * centerLine;

  // === Background grid subtle ===
  float gridX = smoothstep(0.98, 1.0, abs(sin(uv.x * 20.0)));
  float gridY = smoothstep(0.98, 1.0, abs(sin(uv.y * 20.0)));
  col += vec3(0.03) * max(gridX, gridY);

  // Spectral flux overall energy
  col *= 1.0 + uSpectralFlux * ar * 0.3;

  // Pitch-reactive subtle hue rotation
  float pitchShift = uPitch * uPitchConfidence * ar * 0.0003;
  col = mix(col, col.brg, pitchShift);

  // Energy-reactive background ambience
  float bgGlow = uEnergy * ar * 0.02;
  col += waveformPalette(t * 0.1, uColorScheme) * bgGlow;

  // Beat flash overlay
  col += vec3(1.0) * uBeatIntensity * ar * 0.03;

  // Vignette
  vec2 vigUv = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(vigUv, vigUv) * 0.2;
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class WaveformViz extends ShaderSceneBase {
  constructor() {
    super("waveformViz", FRAG);
  }
}
