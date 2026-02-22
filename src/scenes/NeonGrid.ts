import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash & Noise helpers ---
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 gridPalette(float t, int scheme) {
  if (scheme == 1) {
    // cyber: cyan and magenta
    return mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 0.0, 1.0), t);
  } else if (scheme == 2) {
    // vapor: pink and teal pastels
    return mix(vec3(1.0, 0.5, 0.8), vec3(0.3, 0.8, 0.9), t);
  } else if (scheme == 3) {
    // sunset: orange, magenta, purple
    return mix(vec3(1.0, 0.4, 0.1), vec3(0.6, 0.0, 0.8), t);
  }
  // retro: hot pink and electric blue
  return mix(vec3(1.0, 0.1, 0.5), vec3(0.1, 0.4, 1.0), t);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed * 0.5;
  float ar = uAudioReactivity;

  // Perspective transform: map to ground plane
  float horizon = 0.3;
  float skyMask = step(horizon, uv.y);

  // Ground plane perspective
  float py = max(horizon - uv.y, 0.001);
  float depth = 1.0 / py;
  float px = uv.x * depth;

  // Scrolling grid
  float scroll = t * 3.0;
  float gs = uGridSize;
  float gx = px * gs;
  float gy = (depth + scroll) * gs * 0.5;

  // Grid lines with EQ band reactivity
  // Horizontal lines driven by bass bands
  float hLineWidth = 0.03 + uBands[0] * ar * 0.04;
  float hLine = smoothstep(hLineWidth, 0.0, abs(fract(gy) - 0.5) * 2.0 - (1.0 - hLineWidth * 4.0));

  // Vertical lines driven by mid bands
  float vLineWidth = 0.03 + uBands[6] * ar * 0.04;
  float vLine = smoothstep(vLineWidth, 0.0, abs(fract(gx) - 0.5) * 2.0 - (1.0 - vLineWidth * 4.0));

  float grid = max(hLine, vLine);

  // Grid glow color with depth fade
  float depthFade = exp(-py * 3.0);
  float gridGlow = grid * depthFade;

  // Mountains on the horizon
  float mtnX = uv.x * 2.0;
  float mtn = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float freq = 1.0 + fi * 1.5;
    float bandVal = uBands[i] * ar;
    mtn += sin(mtnX * freq + fi * 1.3 + t * 0.2) * (0.08 + bandVal * 0.06) * uMountainHeight;
  }
  float mtnLine = horizon + mtn;
  float mtnMask = smoothstep(0.01, 0.0, uv.y - mtnLine);
  float mtnEdge = smoothstep(0.02, 0.0, abs(uv.y - mtnLine));

  // Retrowave sun on horizon
  float sunCenter = vec2(0.0, horizon + 0.25).y;
  float sunDist = length(vec2(uv.x, uv.y - sunCenter));
  float sunRadius = 0.2 + uEnergy * ar * 0.05;
  float sun = smoothstep(sunRadius + 0.01, sunRadius - 0.01, sunDist);

  // Sun horizontal stripes (retrowave style)
  float stripes = step(0.5, fract(uv.y * 20.0 - t * 2.0));
  float sunStripes = sun * mix(0.6, 1.0, stripes);

  // Sun color gradient
  vec3 sunCol = mix(vec3(1.0, 0.8, 0.0), vec3(1.0, 0.1, 0.3), smoothstep(sunCenter - sunRadius, sunCenter + sunRadius * 0.5, uv.y));
  sunCol *= 1.0 + uBeatIntensity * ar * 0.5;

  // Sky gradient
  float skyGrad = smoothstep(horizon, 1.0, uv.y);
  vec3 skyCol = mix(vec3(0.05, 0.0, 0.15), vec3(0.0, 0.0, 0.05), skyGrad);

  // Treble-reactive star points in sky
  float stars = 0.0;
  vec2 starUv = uv * 30.0;
  vec2 starId = floor(starUv);
  vec2 starF = fract(starUv) - 0.5;
  float starBright = step(0.95, hash(starId));
  float twinkle = sin(t * 3.0 + hash(starId) * 6.28) * 0.5 + 0.5;
  stars = starBright * exp(-dot(starF, starF) * 80.0) * twinkle * (1.0 + uTreble * ar);

  // Grid line colors cycling per EQ
  float colorCycle = fract(gy * 0.1 + gx * 0.05 + t * 0.1);
  colorCycle += uPitch * uPitchConfidence * ar * 0.0005;
  vec3 lineCol = gridPalette(colorCycle, uColorScheme);

  // Grid brightness pulses per band
  float bandPulse = 0.0;
  for (int i = 0; i < 4; i++) {
    bandPulse += uBands[4 + i] * 0.25;
  }
  lineCol *= 1.0 + bandPulse * ar * 0.5;

  // Compose: sky layer
  vec3 col = skyCol;

  // Sun
  col = mix(col, sunCol, sunStripes * skyMask);

  // Stars in sky
  col += vec3(0.8, 0.85, 1.0) * stars * skyMask;

  // Mountain silhouette
  col = mix(col, vec3(0.02, 0.0, 0.08), mtnMask * skyMask);

  // Mountain edge glow
  vec3 mtnGlowCol = gridPalette(0.5 + uMid * ar * 0.2, uColorScheme);
  col += mtnGlowCol * mtnEdge * 0.8;

  // Ground: dark base with grid
  vec3 groundCol = vec3(0.01, 0.0, 0.03);
  groundCol += lineCol * gridGlow;

  // Beat flash on grid
  groundCol += lineCol * 0.3 * uBeatIntensity * ar * grid * depthFade;

  // Below horizon = ground
  col = mix(groundCol, col, skyMask);

  // Subtle scanlines
  float scan = sin(vUv.y * uResolution.y * 1.0) * 0.03 + 0.97;
  col *= scan;

  // Spectral flux adds overall energy glow
  col += gridPalette(0.3, uColorScheme) * uSpectralFlux * ar * 0.05;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class NeonGrid extends ShaderSceneBase {
  constructor() {
    super("neonGrid", FRAG);
  }
}
