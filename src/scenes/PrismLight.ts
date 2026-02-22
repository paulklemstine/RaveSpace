import { ShaderSceneBase } from "./ShaderSceneBase";

const FRAG = `
// --- Hash / Noise helpers ---
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// Spectral wavelength to RGB (attempt at physical dispersion look)
vec3 wavelengthToRGB(float w) {
  // w in [0,1] maps across visible spectrum
  vec3 c;
  if (w < 0.17) {
    c = mix(vec3(0.5, 0.0, 1.0), vec3(0.0, 0.0, 1.0), w / 0.17);
  } else if (w < 0.33) {
    c = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), (w - 0.17) / 0.16);
  } else if (w < 0.5) {
    c = mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (w - 0.33) / 0.17);
  } else if (w < 0.67) {
    c = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (w - 0.5) / 0.17);
  } else if (w < 0.83) {
    c = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.5, 0.0), (w - 0.67) / 0.16);
  } else {
    c = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.0, 0.0), (w - 0.83) / 0.17);
  }
  return c;
}

vec3 getSchemeColor(float w, int scheme) {
  if (scheme == 1) {
    // diamond: whites and brilliant spectral flashes
    vec3 base = vec3(0.9, 0.95, 1.0);
    vec3 spectral = wavelengthToRGB(w);
    return mix(base, spectral, 0.4 + 0.6 * pow(sin(w * 12.566), 2.0));
  } else if (scheme == 2) {
    // aurora: greens, blues, purples
    float h = 0.45 + w * 0.35;
    float s = 0.7 + 0.3 * sin(w * 6.283);
    float v = 0.8 + 0.2 * cos(w * 9.42);
    // HSV to RGB
    vec3 c = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return v * mix(vec3(1.0), c, s);
  } else if (scheme == 3) {
    // spectrum: enhanced rainbow with glow
    vec3 c = wavelengthToRGB(w);
    return c * (1.0 + 0.5 * sin(w * 31.416));
  }
  // 0 = rainbow (default)
  return wavelengthToRGB(w);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed * 0.5;
  float ar = uAudioReactivity;

  // Prism geometry: triangle in center
  float prismAngle = 0.6 + 0.3 * uMid * ar;
  vec2 prismCenter = vec2(-0.1 + 0.05 * sin(t * 0.3), 0.0);

  // Light beam entering from left
  float beamY = uv.y - prismCenter.y;
  float beamWidth = 0.06 + 0.02 * uBeatIntensity * ar;
  float beam = smoothstep(beamWidth, 0.0, abs(beamY)) * smoothstep(-0.8, -0.3, -uv.x);

  // Prism triangle shape
  float px = uv.x - prismCenter.x;
  float py = uv.y - prismCenter.y;
  float triSize = 0.35 + 0.05 * uEnergy * ar;
  float tri = max(abs(py) - triSize * 0.866 + px * 0.5, -px - triSize * 0.5);
  tri = max(tri, px - triSize * 0.5);
  float prismMask = 1.0 - smoothstep(-0.01, 0.01, tri);

  // Dispersion: fan of rainbow bands from prism exit
  float dispAmt = uDispersion * (1.0 + 0.8 * uEnergy * ar);
  float refractAmt = uRefraction;

  vec3 color = vec3(0.0);

  // Background: dark with subtle noise
  float bgNoise = fbm(uv * 3.0 + t * 0.1) * 0.05;
  color += vec3(0.02, 0.01, 0.03) + bgNoise;

  // Incoming white beam
  vec3 beamColor = vec3(0.95, 0.93, 1.0) * beam * 2.0;
  // Add slight glow
  float beamGlow = smoothstep(beamWidth * 3.0, 0.0, abs(beamY)) * smoothstep(-0.8, -0.3, -uv.x) * 0.3;
  beamColor += vec3(0.5, 0.5, 0.7) * beamGlow;
  color += beamColor * (1.0 - prismMask);

  // Dispersed rainbow bands on the right side of prism
  float exitX = prismCenter.x + triSize * 0.5;
  if (uv.x > exitX - 0.05) {
    float dx = uv.x - exitX;
    float spread = dx * dispAmt * refractAmt;

    // Number of visible bands
    int numBands = 16;
    for (int i = 0; i < 16; i++) {
      float fi = float(i) / 15.0;
      // Each wavelength exits at a slightly different angle
      float bandAngle = (fi - 0.5) * spread * 1.5;
      float bandY = bandAngle + prismCenter.y;
      float bandWidth = 0.015 + 0.01 * dx * dispAmt;

      // EQ band reactivity
      float bandEnergy = uBands[i] * ar;
      bandWidth += bandEnergy * 0.02;

      float bandIntensity = smoothstep(bandWidth, bandWidth * 0.2, abs(uv.y - bandY));
      bandIntensity *= smoothstep(0.0, 0.15, dx); // fade in from prism edge

      // Brightness pulse with beat
      bandIntensity *= 1.0 + 0.5 * bandEnergy + 0.3 * uBeatIntensity * ar;

      vec3 bandColor = getSchemeColor(fi, uColorScheme);
      // Pitch-reactive hue shift
      float pitchShift = uPitch * 0.001 * uPitchConfidence * ar;
      float hueRot = pitchShift;
      float cs = cos(hueRot), sn = sin(hueRot);
      bandColor.rgb = vec3(
        bandColor.r * cs - bandColor.g * sn,
        bandColor.r * sn + bandColor.g * cs,
        bandColor.b
      );
      bandColor = max(bandColor, 0.0);

      color += bandColor * bandIntensity * 1.5;
    }

    // Glow around dispersed light
    float glowSpread = spread * 0.8;
    float dispersedGlow = smoothstep(glowSpread + 0.3, 0.0, abs(uv.y - prismCenter.y)) * smoothstep(0.0, 0.3, dx) * 0.15;
    color += vec3(0.3, 0.2, 0.4) * dispersedGlow;
  }

  // Prism: render as translucent glass
  vec3 prismColor = vec3(0.15, 0.18, 0.25) + 0.1 * vec3(fbm(uv * 8.0 + t));
  // Internal refraction caustics
  float caustics = pow(noise(uv * 15.0 + t * 2.0), 3.0) * 0.5;
  prismColor += caustics * vec3(0.3, 0.5, 0.8);
  color = mix(color, prismColor, prismMask * 0.7);

  // Prism edge highlight
  float edge = smoothstep(0.02, 0.0, abs(tri)) * (1.0 - smoothstep(0.0, 0.01, tri));
  color += vec3(0.6, 0.7, 0.9) * edge * (1.0 + uBeatIntensity * ar);

  // Beat flash: bright center pulse
  float flash = uKick * ar * 0.3;
  float flashDist = length(uv - prismCenter);
  color += vec3(0.8, 0.85, 1.0) * flash * exp(-flashDist * 3.0);

  // Vignette
  float vig = 1.0 - 0.4 * dot(uv * 0.5, uv * 0.5);
  color *= vig;

  // Tone map
  color = color / (color + 0.8);
  color = pow(color, vec3(0.9));

  gl_FragColor = vec4(color, 1.0);
}
`;

export class PrismLight extends ShaderSceneBase {
  constructor() {
    super("prismLight", FRAG);
  }
}
