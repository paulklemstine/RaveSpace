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

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// Lightning bolt function using fractal displacement
float lightningBolt(vec2 uv, vec2 start, vec2 end, float time, float seed, float thickness, int branches) {
  vec2 dir = end - start;
  float len = length(dir);
  if (len < 0.001) return 0.0;
  dir /= len;
  vec2 perp = vec2(-dir.y, dir.x);

  vec2 rel = uv - start;
  float along = dot(rel, dir);
  float across = dot(rel, perp);

  // Clamp to segment
  float t = clamp(along / len, 0.0, 1.0);

  // Jagged displacement with multiple frequencies
  float displacement = 0.0;
  float freq = 3.0;
  float amp = 0.12;
  for (int i = 0; i < 5; i++) {
    // Use floor-based noise for sharp zigzag appearance
    float segT = floor(t * freq + 0.5) / freq;
    displacement += amp * (hash(segT * 73.156 + seed + float(i) * 17.3 + floor(time * 8.0) * 0.1) * 2.0 - 1.0);
    freq *= 2.5;
    amp *= 0.45;
  }

  // High-frequency jitter that changes rapidly
  displacement += 0.02 * (hash(floor(t * 30.0 + time * 15.0) + seed) * 2.0 - 1.0);

  float dist = abs(across - displacement);

  // Core (bright center)
  float core = exp(-dist * dist / (thickness * thickness * 0.001));

  // Glow (wider, dimmer)
  float glow = exp(-dist * dist / (thickness * thickness * 0.02)) * 0.4;

  // Fade out at endpoints
  float fade = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.95, t);

  float bolt = (core + glow) * fade;

  // Add branches
  if (branches > 0) {
    for (int b = 0; b < 4; b++) {
      if (b >= branches) break;
      float fb = float(b);
      float branchT = hash(seed + fb * 7.1) * 0.7 + 0.15; // branch point along main bolt
      vec2 branchStart = start + dir * len * branchT + perp * displacement;

      // Branch goes off at an angle
      float branchAngle = (hash(seed + fb * 13.3) - 0.5) * 1.5;
      float branchLen = len * (0.2 + 0.3 * hash(seed + fb * 5.7));
      vec2 branchDir = vec2(dir.x * cos(branchAngle) - dir.y * sin(branchAngle),
                            dir.x * sin(branchAngle) + dir.y * cos(branchAngle));
      vec2 branchEnd = branchStart + branchDir * branchLen;

      // Recursive-like branch (without actual recursion)
      vec2 bRel = uv - branchStart;
      vec2 bDir = branchEnd - branchStart;
      float bLen = length(bDir);
      if (bLen > 0.01) {
        bDir /= bLen;
        vec2 bPerp = vec2(-bDir.y, bDir.x);
        float bAlong = dot(bRel, bDir);
        float bAcross = dot(bRel, bPerp);
        float bt = clamp(bAlong / bLen, 0.0, 1.0);

        float bDisp = 0.0;
        float bFreq = 5.0;
        float bAmp = 0.06;
        for (int j = 0; j < 3; j++) {
          bDisp += bAmp * (hash(floor(bt * bFreq) + seed + fb * 31.0 + float(j) * 11.0 + floor(time * 8.0) * 0.2) * 2.0 - 1.0);
          bFreq *= 2.0;
          bAmp *= 0.5;
        }

        float bDist = abs(bAcross - bDisp);
        float bCore = exp(-bDist * bDist / (thickness * thickness * 0.0005));
        float bGlow = exp(-bDist * bDist / (thickness * thickness * 0.008)) * 0.3;
        float bFade = smoothstep(0.0, 0.1, bt) * smoothstep(1.0, 0.7, bt);

        bolt += (bCore + bGlow) * bFade * 0.6;
      }
    }
  }

  return bolt;
}

// Storm clouds / dark sky
float stormClouds(vec2 uv, float time) {
  float clouds = fbm(uv * 2.0 + time * 0.1);
  clouds += fbm(uv * 4.0 - time * 0.15) * 0.5;
  clouds = pow(clouds, 1.5);
  return clouds;
}

vec3 getSchemeColor(float intensity, int scheme) {
  if (scheme == 0) {
    // lightning: classic white-blue lightning
    vec3 core = vec3(0.8, 0.85, 1.0);
    vec3 glow = vec3(0.3, 0.4, 0.9);
    return mix(glow, core, intensity);
  } else if (scheme == 1) {
    // tesla: purple-violet arcs
    vec3 core = vec3(0.9, 0.7, 1.0);
    vec3 glow = vec3(0.4, 0.1, 0.7);
    return mix(glow, core, intensity);
  } else if (scheme == 2) {
    // plasma: hot pink-orange
    vec3 core = vec3(1.0, 0.9, 0.8);
    vec3 glow = vec3(0.9, 0.2, 0.3);
    return mix(glow, core, intensity);
  }
  // 3 = storm: green-tinged storm
  vec3 core = vec3(0.7, 1.0, 0.8);
  vec3 glow = vec3(0.1, 0.5, 0.3);
  return mix(glow, core, intensity);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed;
  float ar = uAudioReactivity;

  // Storm sky background
  float clouds = stormClouds(uv, t);
  vec3 skyDark = vec3(0.02, 0.02, 0.05);
  vec3 skyLight = vec3(0.08, 0.06, 0.12);
  vec3 color = mix(skyDark, skyLight, clouds * 0.5);

  // Cloud illumination from lightning
  float cloudLight = 0.0;

  // Beat/kick triggers lightning
  float beatTrigger = uBeat * ar;
  float kickTrigger = uKick * ar;
  float triggerIntensity = max(beatTrigger, kickTrigger * 1.2);

  // Energy-based ambient lightning activity
  float ambientActivity = uEnergy * ar * 0.3;
  float totalActivity = max(triggerIntensity, ambientActivity);

  // Branch depth from spectral flux
  int branchCount = int(uBranchDepth + uSpectralFlux * ar * 3.0);
  branchCount = min(branchCount, 4);

  // Generate multiple bolts
  float totalBolts = 0.0;
  int numBolts = int(uBoltCount);

  for (int i = 0; i < 8; i++) {
    if (i >= numBolts) break;
    float fi = float(i);

    // Bolt timing: each bolt has its own trigger cycle
    float boltSeed = fi * 7.13 + floor(t * 2.0) * 0.5;
    float boltChance = hash(boltSeed);

    // Bolt fires if triggered OR random chance with energy
    float boltActive = step(1.0 - totalActivity, boltChance);
    if (boltActive < 0.5) continue;

    // Bolt start: top of screen, random X
    float startX = (hash(boltSeed + 1.0) * 2.0 - 1.0) * aspect * 0.8;
    float startY = 1.0 + hash(boltSeed + 2.0) * 0.2;
    vec2 boltStart = vec2(startX, startY);

    // Bolt end: lower portion
    float endX = startX + (hash(boltSeed + 3.0) - 0.5) * 1.0;
    float endY = -0.5 - hash(boltSeed + 4.0) * 0.5;
    vec2 boltEnd = vec2(endX, endY);

    // Bolt thickness modulated by energy
    float boltThickness = 1.0 + uEnergy * ar * 0.5;

    float bolt = lightningBolt(uv, boltStart, boltEnd, t, boltSeed, boltThickness, branchCount);

    // Brightness from energy
    float brightness = 0.5 + uEnergy * ar;
    bolt *= brightness;

    totalBolts += bolt;

    // Cloud illumination from this bolt
    float boltCenter = (boltStart.x + boltEnd.x) * 0.5;
    float boltLight = bolt * 0.3;
    cloudLight += exp(-pow(uv.x - boltCenter, 2.0) * 2.0) * boltLight;
  }

  // Apply bolt coloring
  vec3 boltColor = getSchemeColor(clamp(totalBolts, 0.0, 1.0), uColorScheme);
  color += boltColor * totalBolts;

  // Cloud illumination: light up clouds near bolts
  vec3 cloudLightColor = getSchemeColor(0.3, uColorScheme);
  color += cloudLightColor * cloudLight * clouds * 0.5;

  // Ambient sheet lightning: broad flashes in clouds
  float sheetFlash = triggerIntensity * 0.4;
  float sheetPattern = fbm(uv * 1.5 + t * 0.5) * 0.5 + 0.5;
  color += cloudLightColor * sheetFlash * sheetPattern * clouds;

  // EQ-reactive ambient glow regions
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    // Each quadrant of bands creates a glow region
    float bandAvg = 0.0;
    if (i == 0) bandAvg = (uBands[0] + uBands[1] + uBands[2] + uBands[3]) * 0.25;
    else if (i == 1) bandAvg = (uBands[4] + uBands[5] + uBands[6] + uBands[7]) * 0.25;
    else if (i == 2) bandAvg = (uBands[8] + uBands[9] + uBands[10] + uBands[11]) * 0.25;
    else bandAvg = (uBands[12] + uBands[13] + uBands[14] + uBands[15]) * 0.25;

    vec2 glowPos = vec2(sin(fi * 1.57 + t * 0.2) * 0.6, cos(fi * 1.57 + t * 0.3) * 0.4);
    float glowDist = length(uv - glowPos);
    float glow = exp(-glowDist * 2.0) * bandAvg * ar * 0.3;
    color += getSchemeColor(0.2 + fi * 0.2, uColorScheme) * glow;
  }

  // Rain effect: subtle vertical streaks
  float rain = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float rainX = (hash(fi * 3.7) * 2.0 - 1.0) * aspect;
    float rainSpeed = 3.0 + hash(fi * 5.1) * 4.0;
    float rainY = mod(fi * 0.37 - t * rainSpeed, 3.0) - 1.5;
    float rainLen = 0.1 + hash(fi * 7.3) * 0.15;
    float rainDist = abs(uv.x - rainX);
    float rainStreak = smoothstep(0.003, 0.0, rainDist) *
                       smoothstep(0.0, rainLen, uv.y - rainY) *
                       smoothstep(rainLen + 0.02, rainLen, uv.y - rainY);
    rain += rainStreak * 0.3;
  }
  color += vec3(0.4, 0.45, 0.5) * rain;

  // Beat intensity: overall flash
  color *= 1.0 + uBeatIntensity * ar * 0.5;

  // Pitch: subtle hue shift
  float pitchShift = uPitch * 0.0005 * uPitchConfidence * ar;
  color = mix(color, color.brg, clamp(pitchShift, 0.0, 0.2));

  // Vignette
  float vig = 1.0 - 0.5 * dot(uv * 0.35, uv * 0.35);
  color *= vig;

  // Tone mapping
  color = 1.0 - exp(-color * 1.5);
  color = pow(color, vec3(0.95));

  gl_FragColor = vec4(color, 1.0);
}
`;

export class ElectricStorm extends ShaderSceneBase {
  constructor() {
    super("electricStorm", FRAG);
  }
}
