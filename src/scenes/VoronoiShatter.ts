import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash helpers ---
vec2 hash22(vec2 p) {
  vec3 a = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  a += dot(a, a.yzx + 33.33);
  return fract((a.xx + a.yz) * a.zy);
}

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

// Voronoi with distance and cell ID
vec3 voronoi(vec2 uv, float cellCount, float time, float shatter) {
  vec2 n = floor(uv);
  vec2 f = fract(uv);

  float minDist1 = 8.0;
  float minDist2 = 8.0;
  vec2 closestCell = vec2(0.0);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);

      // Animate cell centers - shatter on beat
      vec2 animOffset = sin(time * 0.5 + o * 6.28) * 0.3;
      animOffset += shatter * (o - 0.5) * 1.5; // explode outward

      o = 0.5 + 0.5 * sin(time * 0.5 + o * 6.28);
      o += shatter * (hash22(n + g + 100.0) - 0.5) * 2.0;

      vec2 r = g + o - f;
      float d = dot(r, r);

      if (d < minDist1) {
        minDist2 = minDist1;
        minDist1 = d;
        closestCell = n + g;
      } else if (d < minDist2) {
        minDist2 = d;
      }
    }
  }

  // Return: sqrt(dist1), sqrt(dist2), cell hash
  return vec3(sqrt(minDist1), sqrt(minDist2), hash21(closestCell));
}

// Color palettes
vec3 getVoronoiColor(int scheme, float cellHash, float t, float pitchHue) {
  float hue = cellHash + pitchHue;

  if (scheme == 1) { // neon
    vec3 c1 = vec3(1.0, 0.0, 0.5);
    vec3 c2 = vec3(0.0, 1.0, 0.5);
    vec3 c3 = vec3(0.5, 0.0, 1.0);
    float h = fract(hue);
    if (h < 0.33) return mix(c1, c2, h * 3.0) * (0.5 + t * 0.5);
    if (h < 0.66) return mix(c2, c3, (h - 0.33) * 3.0) * (0.5 + t * 0.5);
    return mix(c3, c1, (h - 0.66) * 3.0) * (0.5 + t * 0.5);
  }
  if (scheme == 2) { // dark
    return vec3(0.05 + t * 0.1) * (1.0 + sin(hue * 6.28) * 0.3);
  }
  if (scheme == 3) { // rainbow
    float h6 = fract(hue) * 6.0;
    vec3 c = clamp(vec3(
      abs(h6 - 3.0) - 1.0,
      2.0 - abs(h6 - 2.0),
      2.0 - abs(h6 - 4.0)
    ), 0.0, 1.0);
    return c * (0.4 + t * 0.6);
  }
  // glass (default) - cool translucent
  vec3 base = vec3(0.2, 0.4, 0.6);
  vec3 highlight = vec3(0.8, 0.9, 1.0);
  return mix(base, highlight, t) * (0.5 + sin(hue * 6.28) * 0.3 + 0.3);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed;
  float react = uAudioReactivity;

  // Scale UV by cell count
  vec2 scaledUv = uv * uCellCount;

  // Beat-driven shatter amount
  float shatter = uBeat * react * 0.8;
  // Smooth decay for shatter
  float shatterDecay = uBeatIntensity * react * 0.5;

  // Compute voronoi
  vec3 vor = voronoi(scaledUv, uCellCount, time, shatterDecay);
  float dist1 = vor.x;
  float dist2 = vor.y;
  float cellHash = vor.z;

  // Edge detection
  float edge = dist2 - dist1;
  float edgeLine = 1.0 - smoothstep(0.0, 0.05 * uSharpness, edge);

  // Second layer for depth
  vec3 vor2 = voronoi(scaledUv * 0.5 + 50.0, uCellCount * 0.5, time * 0.7, shatterDecay * 0.5);
  float edge2 = vor2.y - vor2.x;
  float edgeLine2 = 1.0 - smoothstep(0.0, 0.08 * uSharpness, edge2);

  // Energy drives edge glow
  float edgeGlow = uEnergy * react;

  // Cell color based on hash + pitch-reactive hue shift
  float pitchHue = uPitch * 0.002 * uPitchConfidence * react;
  vec3 cellColor = getVoronoiColor(uColorScheme, cellHash, 1.0 - dist1 * 2.0, pitchHue);

  // EQ bands drive individual cell brightness
  int bandIdx = int(mod(cellHash * 16.0, 16.0));
  float bandVal = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i == bandIdx) bandVal = uBands[i];
  }
  cellColor *= 1.0 + bandVal * react * 1.5;

  // Edge color - brighter than cells
  vec3 edgeColor = getVoronoiColor(uColorScheme, 0.5, 1.0, pitchHue);
  edgeColor *= 1.5 + edgeGlow;

  // Shatter crack effect - bright lines when shattering
  float crackBright = shatterDecay * 2.0;

  // Compose
  vec3 color = cellColor * (1.0 - edgeLine);
  color += edgeColor * edgeLine * (1.0 + crackBright);
  color += edgeColor * edgeLine2 * 0.2;

  // Kick flash on cells
  float kickFlash = uKick * react;
  color += cellColor * kickFlash * 0.5;

  // Spectral flux causes micro-fractures
  float flux = uSpectralFlux * react;
  vec3 vor3 = voronoi(scaledUv * 3.0 + time * 0.5, uCellCount * 2.0, time * 2.0, flux);
  float microEdge = 1.0 - smoothstep(0.0, 0.03, vor3.y - vor3.x);
  color += edgeColor * microEdge * flux * 0.5;

  // Spectral centroid shifts brightness
  color *= 0.8 + uSpectralCentroid * 0.001 * react;

  // Glass refraction effect
  float refract = sin(dist1 * 20.0 + time) * 0.02;
  color += getVoronoiColor(uColorScheme, cellHash + 0.1, 0.5, pitchHue) * abs(refract) * uSharpness;

  // Beat intensity brightness pulse
  color *= 1.0 + uBeatIntensity * react * 0.3;

  // Vignette
  vec2 vc = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(vc, vc) * 0.3;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;

export class VoronoiShatter extends ShaderSceneBase {
  constructor() {
    super("voronoiShatter", FRAG);
  }
}
