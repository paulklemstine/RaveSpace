precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;

uniform float uSpeed;
uniform float uIterations;
uniform float uAudioReactivity;
uniform int uColorScheme;

#define PI 3.14159265
#define TAU 6.28318530

// --- Cosine palettes ---
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

vec3 getColor(float t) {
  if (uColorScheme == 0) // electric
    return cosPalette(t, vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.1, 0.2));
  if (uColorScheme == 1) // cosmic
    return cosPalette(t, vec3(0.5), vec3(0.5), vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
  if (uColorScheme == 2) // inferno
    return cosPalette(t, vec3(0.5, 0.3, 0.2), vec3(0.5, 0.4, 0.3), vec3(1.0, 0.5, 0.3), vec3(0.0, 0.1, 0.15));
  // psychedelic
  return 0.5 + 0.5 * cos(TAU * (t * 3.0 + vec3(0.0, 0.33, 0.67)));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed * 0.3;

  // Audio reactivity
  float bassR = uBass * uAudioReactivity;
  float midR = uMid * uAudioReactivity;
  float trebleR = uTreble * uAudioReactivity;
  float energyR = uEnergy * uAudioReactivity;

  // Continuous zoom: scale decreases exponentially over time
  float zoom = pow(1.5, time);
  // Zoom center orbits slowly for visual variety
  vec2 center = vec2(
    sin(time * 0.11) * 0.2,
    cos(time * 0.13) * 0.2
  );
  vec2 c0 = uv / zoom + center;

  // Julia set C parameter: orbits in parameter space
  // Audio modulates the orbit
  float cAngle = time * 0.4 + bassR * 0.5;
  float cRadius = 0.7885 + sin(time * 0.17) * 0.05 + midR * 0.05;
  vec2 c = vec2(cRadius * cos(cAngle), cRadius * sin(cAngle));

  // Iterate z = z^2 + c
  vec2 z = c0;
  int maxIter = int(uIterations);
  float smoothIter = 0.0;
  bool escaped = false;

  for (int i = 0; i < 100; i++) {
    if (i >= maxIter) break;

    // z = z^2 + c
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;

    float len2 = dot(z, z);
    if (len2 > 256.0) {
      // Smooth iteration count for smooth coloring
      smoothIter = float(i) + 1.0 - log2(log2(len2)) + 4.0;
      escaped = true;
      break;
    }
  }

  vec3 color;

  if (escaped) {
    // Normalize iteration count
    float t = smoothIter / float(maxIter);

    // Orbit trap coloring: distance to axes/circles gives extra detail
    float trap = length(z);
    t += trap * 0.02;

    // Time-varying color shift
    t += time * 0.05;

    // Audio modulation on color
    t += trebleR * 0.1;

    color = getColor(t);

    // Brightness based on how quickly it escaped
    float brightness = 1.0 - smoothIter / float(maxIter);
    brightness = pow(brightness, 0.5);
    color *= brightness * 1.5;

    // Edge glow: points that barely escaped are brightest
    float edgeFactor = smoothIter / float(maxIter);
    if (edgeFactor > 0.8) {
      color += getColor(t + 0.3) * (edgeFactor - 0.8) * 5.0;
    }
  } else {
    // Interior: use final z position for coloring
    float interiorT = atan(z.y, z.x) / TAU + 0.5;
    interiorT += length(z) * 0.1 + time * 0.03;
    color = getColor(interiorT) * 0.3;

    // Inner glow
    float innerGlow = exp(-length(z) * 0.5) * 0.3;
    color += getColor(interiorT + 0.2) * innerGlow;
  }

  // Beat pulse: flash on energy spikes
  color *= 1.0 + energyR * 0.5;

  // Bass breathing: subtle overall brightness pulse
  color *= 1.0 + sin(time * 2.0) * bassR * 0.2;

  // Vignette
  float dist = length(vUv * 2.0 - 1.0);
  color *= 1.0 - dist * 0.3;

  gl_FragColor = vec4(color, 1.0);
}
