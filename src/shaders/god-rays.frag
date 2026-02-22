precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;

uniform float uSpeed;
uniform float uRayIntensity;
uniform float uDensity;
uniform float uAudioReactivity;
uniform int uColorScheme;

#define PI 3.14159265
#define TAU 6.28318530
#define NUM_STEPS 24

// --- Cosine palettes ---
vec3 getColor(float t) {
  if (uColorScheme == 0) // divine
    return 0.5 + 0.5 * cos(TAU * (t * 0.7 + vec3(0.05, 0.15, 0.30)));
  if (uColorScheme == 1) // infernal
    return 0.5 + 0.5 * cos(TAU * (t * 0.5 + vec3(0.0, 0.08, 0.18)));
  if (uColorScheme == 2) // aurora
    return 0.5 + 0.5 * cos(TAU * (t * 0.8 + vec3(0.15, 0.25, 0.10)));
  // prismatic
  return 0.5 + 0.5 * cos(TAU * (t * 2.5 + vec3(0.0, 0.33, 0.67)));
}

// --- Noise ---
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
  float f = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    f += amp * noise(p);
    p = p * 2.1 + vec2(1.7, 1.2);
    amp *= 0.5;
  }
  return f;
}

// Organic density field: creates cloud-like shapes for light to pass through
float densityField(vec2 p, float time) {
  // Multiple layers of warped noise
  vec2 warp = vec2(
    fbm(p * 1.5 + time * 0.1),
    fbm(p * 1.5 + vec2(5.2, 1.3) + time * 0.12)
  );

  float d = fbm(p * uDensity + warp * 2.0);

  // Create holes (gaps for light to pass through)
  d = smoothstep(0.3, 0.7, d);

  return d;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed * 0.4;

  // Audio reactivity
  float bassR = uBass * uAudioReactivity;
  float midR = uMid * uAudioReactivity;
  float trebleR = uTreble * uAudioReactivity;
  float energyR = uEnergy * uAudioReactivity;

  // Light source positions (orbiting)
  vec2 light1 = vec2(
    sin(time * 0.5) * 0.8,
    cos(time * 0.3) * 0.6
  );
  vec2 light2 = vec2(
    sin(time * 0.4 + 2.0) * 0.7,
    cos(time * 0.6 + 1.5) * 0.5
  );
  vec2 light3 = vec2(
    sin(time * 0.7 + 4.0) * 0.5,
    cos(time * 0.35 + 3.0) * 0.7
  );

  // Audio makes lights move more erratically
  light1 += vec2(bassR * 0.3 * sin(time * 2.0), bassR * 0.3 * cos(time * 2.5));
  light2 += vec2(midR * 0.2 * sin(time * 3.0), midR * 0.2 * cos(time * 2.0));

  vec3 totalLight = vec3(0.0);

  // --- Ray march from pixel toward each light source ---

  // Light 1
  {
    vec2 dir = light1 - uv;
    float dist = length(dir);
    dir /= dist;
    float stepSize = dist / float(NUM_STEPS);

    float accumLight = 0.0;
    for (int i = 0; i < NUM_STEPS; i++) {
      vec2 samplePos = uv + dir * stepSize * float(i);
      float density = densityField(samplePos, time);
      // Light attenuates through dense regions, accumulates in clear regions
      accumLight += (1.0 - density) * stepSize;
    }

    float rayBrightness = accumLight * uRayIntensity;
    // Falloff with distance
    rayBrightness *= exp(-dist * 0.5);
    // Point light glow at source
    float pointGlow = exp(-dist * 3.0) * 2.0;

    float colorT = time * 0.1;
    totalLight += getColor(colorT) * (rayBrightness + pointGlow) * (1.0 + bassR * 0.5);
  }

  // Light 2
  {
    vec2 dir = light2 - uv;
    float dist = length(dir);
    dir /= dist;
    float stepSize = dist / float(NUM_STEPS);

    float accumLight = 0.0;
    for (int i = 0; i < NUM_STEPS; i++) {
      vec2 samplePos = uv + dir * stepSize * float(i);
      float density = densityField(samplePos, time);
      accumLight += (1.0 - density) * stepSize;
    }

    float rayBrightness = accumLight * uRayIntensity;
    rayBrightness *= exp(-dist * 0.5);
    float pointGlow = exp(-dist * 3.0) * 2.0;

    float colorT = time * 0.1 + 0.33;
    totalLight += getColor(colorT) * (rayBrightness + pointGlow) * (1.0 + midR * 0.5);
  }

  // Light 3
  {
    vec2 dir = light3 - uv;
    float dist = length(dir);
    dir /= dist;
    float stepSize = dist / float(NUM_STEPS);

    float accumLight = 0.0;
    for (int i = 0; i < NUM_STEPS; i++) {
      vec2 samplePos = uv + dir * stepSize * float(i);
      float density = densityField(samplePos, time);
      accumLight += (1.0 - density) * stepSize;
    }

    float rayBrightness = accumLight * uRayIntensity;
    rayBrightness *= exp(-dist * 0.5);
    float pointGlow = exp(-dist * 3.0) * 2.0;

    float colorT = time * 0.1 + 0.67;
    totalLight += getColor(colorT) * (rayBrightness + pointGlow) * (1.0 + trebleR * 0.5);
  }

  // --- Background organic pattern ---
  float bgNoise = fbm(uv * 2.0 + time * 0.05);
  vec3 bgColor = getColor(bgNoise + time * 0.02) * 0.05;

  // --- Atmospheric scattering (fog/haze) ---
  float density = densityField(uv, time);
  vec3 fogColor = getColor(density + time * 0.03) * density * 0.15;

  // --- Combine ---
  vec3 color = totalLight + bgColor + fogColor;

  // Energy boost
  color *= 0.7 + energyR * 0.5;

  // Treble shimmer
  float shimmer = noise(uv * 15.0 + time * 4.0);
  shimmer = pow(shimmer, 10.0) * trebleR * 2.0;
  color += vec3(shimmer);

  // Vignette
  float dist = length(vUv * 2.0 - 1.0);
  color *= 1.0 - dist * 0.3;

  gl_FragColor = vec4(color, 1.0);
}
