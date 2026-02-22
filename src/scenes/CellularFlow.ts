import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash & Voronoi helpers ---
vec2 hash2(vec2 p) {
  return fract(sin(vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  )) * 43758.5453);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Voronoi with F1 and F2 distances + cell ID
vec4 voronoi(vec2 p, float t, float evolution) {
  vec2 n = floor(p);
  vec2 f = fract(p);

  float f1 = 8.0;
  float f2 = 8.0;
  vec2 cellId = vec2(0.0);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      // Animate cell points
      o = 0.5 + 0.5 * sin(t * evolution + o * 6.28);
      vec2 diff = g + o - f;
      float d = dot(diff, diff);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        cellId = n + g;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }

  return vec4(sqrt(f1), sqrt(f2), cellId);
}

vec3 cellPalette(float t, int scheme) {
  if (scheme == 1) {
    // toxic: greens, yellows, black
    return vec3(0.1, 0.5, 0.0) + vec3(0.4, 0.5, 0.1) * sin(vec3(2.0, 1.5, 0.5) * t * 6.28 + vec3(0.0, 1.0, 2.0));
  } else if (scheme == 2) {
    // crystal: blues, whites, silvers
    return vec3(0.5, 0.6, 0.8) + vec3(0.3, 0.3, 0.2) * sin(vec3(1.5, 2.0, 1.0) * t * 6.28 + vec3(0.0, 0.5, 1.0));
  } else if (scheme == 3) {
    // lava: reds, oranges, blacks
    return vec3(0.6, 0.1, 0.0) + vec3(0.4, 0.3, 0.1) * sin(vec3(1.0, 2.0, 3.0) * t * 6.28 + vec3(0.5, 0.0, 0.0));
  }
  // bio: teals, greens, purples
  return vec3(0.0, 0.3, 0.3) + vec3(0.3, 0.4, 0.3) * sin(vec3(2.0, 1.0, 1.5) * t * 6.28 + vec3(0.0, 0.5, 1.5));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed * 0.3;
  float ar = uAudioReactivity;

  // Evolution speed driven by energy
  float evoSpeed = uEvolution * (1.0 + uEnergy * ar * 1.5);

  // Cell scale
  float scale = uCellScale;

  // Flow distortion driven by audio
  vec2 flow = vec2(
    sin(t * 0.5 + uv.y * 0.5) * (0.3 + uBands[4] * ar * 0.5),
    cos(t * 0.3 + uv.x * 0.7) * (0.3 + uBands[5] * ar * 0.5)
  );

  vec2 p = uv * scale + flow;

  // Primary voronoi
  vec4 v1 = voronoi(p, t, evoSpeed);
  float f1 = v1.x;
  float f2 = v1.y;
  vec2 cellId = v1.zw;

  // Secondary voronoi at different scale for detail
  vec4 v2 = voronoi(p * 2.0 + vec2(t * 0.2, -t * 0.15), t * 1.3, evoSpeed * 1.5);

  // Cell boundary - sharp edge between cells
  float edge = f2 - f1;
  float boundary = smoothstep(0.0, 0.08, edge);
  float boundaryLine = 1.0 - smoothstep(0.0, 0.05, edge);

  // Bass pulses the boundaries
  float bassPulse = uBass * ar + (uBands[0] + uBands[1]) * ar * 0.5;
  boundaryLine *= 1.0 + bassPulse * 2.0;

  // Cell interior coloring
  float cellHue = hash(cellId);
  // Pitch shifts cell colors
  cellHue += uPitch * uPitchConfidence * ar * 0.001;

  // Sub-bass band drives cell brightness pulsing
  float cellPulse = 0.0;
  int cellBand = int(mod(hash(cellId * 7.3) * 16.0, 16.0));
  for (int i = 0; i < 16; i++) {
    if (i == cellBand) cellPulse = uBands[i] * ar;
  }

  // Cell interior pattern
  float interior = f1 * 2.0; // distance gradient from cell center
  interior += v2.x * 0.3; // secondary detail

  // Color composition
  vec3 cellCol = cellPalette(cellHue + t * 0.05, uColorScheme);
  cellCol *= 0.5 + interior * 0.5;
  cellCol *= 1.0 + cellPulse * 1.0;

  // Boundary glow color
  vec3 edgeCol = cellPalette(cellHue + 0.3 + t * 0.1, uColorScheme) * 2.0;
  edgeCol *= 1.0 + bassPulse * 1.5;

  // Beat flash on boundaries
  float beatFlash = uBeatIntensity * ar;
  edgeCol += vec3(1.0) * beatFlash * 0.5;

  // Compose
  vec3 col = mix(edgeCol, cellCol, boundary);

  // Add secondary voronoi detail as overlay
  float detail = 1.0 - smoothstep(0.0, 0.04, v2.y - v2.x);
  vec3 detailCol = cellPalette(hash(v2.zw) + t * 0.1, uColorScheme) * 0.3;
  col += detailCol * detail * 0.3;

  // Mid-high frequencies add internal cell shimmering
  float midHigh = (uBands[8] + uBands[9] + uBands[10] + uBands[11]) * 0.25;
  col *= 1.0 + midHigh * ar * sin(f1 * 20.0 + t * 3.0) * 0.2;

  // Spectral flux organic breathing
  col *= 1.0 + uSpectralFlux * ar * 0.3;

  // Treble sparkle on cell centers
  float centerSpark = exp(-f1 * f1 * 50.0) * uTreble * ar;
  col += vec3(1.0, 0.9, 0.8) * centerSpark * 0.4;

  // Vignette
  vec2 vigUv = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(vigUv, vigUv) * 0.25;
  col *= vig;

  // Tone mapping
  col = col / (col + 0.8) * 1.3;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class CellularFlow extends ShaderSceneBase {
  constructor() {
    super("cellularFlow", FRAG);
  }
}
