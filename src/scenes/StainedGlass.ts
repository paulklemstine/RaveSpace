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

// Voronoi for stained glass tiles
vec3 voronoi(vec2 uv, float cellScale) {
  vec2 cell = floor(uv * cellScale);
  vec2 f = fract(uv * cellScale);

  float minDist = 10.0;
  float secondDist = 10.0;
  vec2 minCell = vec2(0.0);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cellId = cell + neighbor;
      // Random point within the cell
      vec2 point = vec2(hash2(cellId), hash2(cellId + 100.0));
      // Slight animation
      point = 0.5 + 0.4 * sin(point * 6.283 + uTime * 0.2);
      vec2 diff = neighbor + point - f;
      float dist = length(diff);
      if (dist < minDist) {
        secondDist = minDist;
        minDist = dist;
        minCell = cellId;
      } else if (dist < secondDist) {
        secondDist = dist;
      }
    }
  }

  // Return: x = min distance, y = edge (second - first), z = cell hash
  float edge = secondDist - minDist;
  return vec3(minDist, edge, hash2(minCell));
}

vec3 tileColor(float cellHash, float phase, int scheme) {
  // Each tile gets a unique color based on its cell hash
  float h = fract(cellHash + phase);

  if (scheme == 0) {
    // cathedral: rich reds, blues, golds, purples
    vec3 colors[6];
    colors[0] = vec3(0.7, 0.1, 0.1);   // deep red
    colors[1] = vec3(0.1, 0.2, 0.7);   // blue
    colors[2] = vec3(0.8, 0.6, 0.1);   // gold
    colors[3] = vec3(0.4, 0.1, 0.5);   // purple
    colors[4] = vec3(0.1, 0.5, 0.2);   // emerald
    colors[5] = vec3(0.7, 0.3, 0.1);   // amber
    int idx = int(h * 6.0);
    if (idx == 0) return colors[0];
    if (idx == 1) return colors[1];
    if (idx == 2) return colors[2];
    if (idx == 3) return colors[3];
    if (idx == 4) return colors[4];
    return colors[5];
  } else if (scheme == 1) {
    // modern: pastels and neons
    return 0.5 + 0.5 * cos(6.283 * (h + vec3(0.0, 0.33, 0.67)));
  } else if (scheme == 2) {
    // dark: deep saturated on black
    vec3 c = 0.5 + 0.5 * cos(6.283 * (h * 2.0 + vec3(0.0, 0.1, 0.2)));
    return c * 0.5;
  }
  // 3 = vivid: maximum saturation
  float hue = h;
  vec3 c = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  // Tile scale
  float cellScale = 3.0 + uTileSize * 2.0;

  // Slight UV distortion from bass
  vec2 distortedUV = uv;
  float bassDistort = uBass * ar * 0.02;
  distortedUV += bassDistort * vec2(sin(uv.y * 10.0 + t), cos(uv.x * 10.0 + t));

  // Get voronoi tile data
  vec3 vor = voronoi(distortedUV, cellScale);
  float tileDist = vor.x;
  float edgeDist = vor.y;
  float cellHash = vor.z;

  // Lead line width
  float leadW = uLeadWidth * 0.08;

  // Edge detection for lead lines
  float lead = 1.0 - smoothstep(leadW - 0.01, leadW + 0.01, edgeDist);

  // Lead line glow on beat
  float leadGlow = lead * (0.3 + uBeatIntensity * ar * 1.5);

  // Determine which EQ band affects this tile
  int bandIdx = int(cellHash * 16.0);
  float bandVal = 0.0;
  // Manually index since GLSL ES doesn't support dynamic array indexing easily
  if (bandIdx == 0) bandVal = uBands[0];
  else if (bandIdx == 1) bandVal = uBands[1];
  else if (bandIdx == 2) bandVal = uBands[2];
  else if (bandIdx == 3) bandVal = uBands[3];
  else if (bandIdx == 4) bandVal = uBands[4];
  else if (bandIdx == 5) bandVal = uBands[5];
  else if (bandIdx == 6) bandVal = uBands[6];
  else if (bandIdx == 7) bandVal = uBands[7];
  else if (bandIdx == 8) bandVal = uBands[8];
  else if (bandIdx == 9) bandVal = uBands[9];
  else if (bandIdx == 10) bandVal = uBands[10];
  else if (bandIdx == 11) bandVal = uBands[11];
  else if (bandIdx == 12) bandVal = uBands[12];
  else if (bandIdx == 13) bandVal = uBands[13];
  else if (bandIdx == 14) bandVal = uBands[14];
  else bandVal = uBands[15];

  // Tile brightness driven by its EQ band
  float tileBrightness = 0.4 + 0.6 * bandVal * ar;

  // Pitch-reactive color phase shift
  float pitchPhase = uPitch * 0.001 * uPitchConfidence * ar;
  float colorPhase = t * 0.05 + pitchPhase;

  // Get tile color
  vec3 glass = tileColor(cellHash, colorPhase, uColorScheme);

  // Simulate light passing through stained glass
  // Radial light source from above-center
  vec2 lightPos = vec2(0.0, 0.5 + 0.2 * sin(t * 0.3));
  float lightDist = length(uv - lightPos);
  float lightFalloff = 1.0 / (1.0 + lightDist * 0.5);

  // Light intensity modulated by energy
  float lightIntensity = lightFalloff * (0.8 + 0.5 * uEnergy * ar);

  // Glass color with light transmission
  vec3 color = glass * tileBrightness * lightIntensity;

  // Inner glow: brighter at tile center, dimmer at edges
  float innerGlow = smoothstep(0.0, 0.5, tileDist);
  color *= (0.6 + 0.4 * innerGlow);

  // Subtle texture within tiles
  float tileNoise = noise(distortedUV * cellScale * 3.0 + cellHash * 100.0) * 0.15;
  color *= (0.9 + tileNoise);

  // Lead lines: dark with metallic glow
  vec3 leadColor = vec3(0.15, 0.12, 0.1); // dark lead
  vec3 leadGlowColor = vec3(0.4, 0.35, 0.3); // warm metallic glow
  // Beat makes lead lines glow
  leadColor = mix(leadColor, leadGlowColor, uBeatIntensity * ar * 0.5);
  // Add the glow around lead lines
  float leadHalo = (1.0 - smoothstep(leadW, leadW + 0.05, edgeDist)) * 0.3;
  leadHalo *= (1.0 + uBeatIntensity * ar * 2.0);

  // Combine glass and lead
  color = mix(color, leadColor, lead);
  // Add lead halo glow
  color += leadGlowColor * leadHalo * leadGlow;

  // Spectral flux: occasional bright flicker in random tiles
  float flickerChance = step(0.85, cellHash) * uSpectralFlux * ar * 2.0;
  float flicker = sin(t * 10.0 + cellHash * 50.0) * 0.5 + 0.5;
  color += glass * flickerChance * flicker;

  // Kick: burst of light from center through all tiles
  float kickBurst = uKick * ar;
  float kickLight = kickBurst * exp(-lightDist * 2.0);
  color += glass * kickLight * 0.5;

  // Rose window effect: circular mandala pattern overlay
  float angle = atan(uv.y, uv.x);
  float dist = length(uv);
  float rosePetals = sin(angle * 8.0 + t * 0.5) * 0.5 + 0.5;
  float roseRing = smoothstep(0.03, 0.0, abs(dist - 0.8)) * rosePetals * 0.2;
  color += glass * roseRing * (0.5 + uMid * ar);

  // Second light source: colored by dominant audio
  vec2 light2Pos = vec2(sin(t * 0.2) * 0.8, -0.3);
  float light2Dist = length(uv - light2Pos);
  float light2 = exp(-light2Dist * 2.0) * 0.15;
  vec3 light2Color = tileColor(0.7, colorPhase + 0.5, uColorScheme);
  color += light2Color * light2 * (0.5 + uTreble * ar);

  // Vignette: subtle darkening at edges
  float vig = 1.0 - 0.4 * dot(uv * 0.4, uv * 0.4);
  color *= vig;

  // Warm tone mapping
  color = pow(color, vec3(0.9));
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class StainedGlass extends ShaderSceneBase {
  constructor() {
    super("stainedGlass", FRAG);
  }
}
