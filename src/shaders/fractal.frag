precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;
uniform float uSpeed;
uniform float uZoom;
uniform float uIterations;
uniform float uAudioReactivity;
uniform float uColorShift;
uniform int uFractalType; // 0 = Julia, 1 = Mandelbrot

#define PI 3.14159265359
#define TAU 6.28318530718

vec3 palette(float t) {
  // Psychedelic rainbow palette
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.0, 0.10, 0.20);
  return a + b * cos(TAU * (c * t + d));
}

vec3 palette2(float t) {
  // Deep psychedelic palette
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 0.7, 0.4);
  vec3 d = vec3(0.0, 0.15, 0.20);
  return a + b * cos(TAU * (c * t + d));
}

// Complex multiply
vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uResolution.x / uResolution.y;

  float time = uTime * uSpeed;
  float ar = uAudioReactivity;
  float bass = uBass * ar;
  float mid = uMid * ar;
  float treble = uTreble * ar;
  float energy = uEnergy * ar;

  // Continuous zoom
  float zoomLevel = uZoom * exp(mod(time * 0.3, 8.0) - 4.0);
  zoomLevel = max(zoomLevel, 0.0001);

  // Zoom center slowly drifts
  vec2 center = vec2(
    sin(time * 0.07) * 0.3,
    cos(time * 0.09) * 0.3
  );

  // Apply zoom
  vec2 c_coord;
  vec2 z;

  if (uFractalType == 0) {
    // Julia set: z = pixel, c = audio-driven parameter
    z = uv / zoomLevel + center;

    // Julia c parameter traces a path that creates interesting fractals
    float cAngle = time * 0.15;
    float cRadius = 0.7885 + bass * 0.05;
    c_coord = vec2(
      cos(cAngle) * cRadius,
      sin(cAngle) * cRadius
    );
    // Add mid-frequency wobble
    c_coord += vec2(sin(time * 0.4), cos(time * 0.5)) * mid * 0.03;
  } else {
    // Mandelbrot set: c = pixel, z starts at 0
    c_coord = uv / zoomLevel + center + vec2(-0.5, 0.0);
    z = vec2(0.0);
  }

  // Iteration
  float maxIter = 50.0 + uIterations * 150.0;
  float smoothIter = 0.0;
  float minDist = 1e10; // orbit trap
  vec2 minTrapPos = vec2(0.0);
  float trapped = 0.0;
  bool escaped = false;

  for (float i = 0.0; i < 200.0; i++) {
    if (i >= maxIter) break;

    // z = z^2 + c
    z = cmul(z, z) + c_coord;

    float dist = dot(z, z);

    // Orbit trap: distance to origin and axes
    float trapDist = min(abs(z.x), abs(z.y));
    trapDist = min(trapDist, abs(length(z) - 1.0)); // circle trap
    if (trapDist < minDist) {
      minDist = trapDist;
      minTrapPos = z;
    }

    if (dist > 256.0) {
      // Smooth iteration count
      smoothIter = i - log2(log2(dist)) + 4.0;
      escaped = true;
      break;
    }
    smoothIter = i;
  }

  vec3 col;

  if (escaped) {
    // Exterior coloring: smooth iteration + orbit trap
    float t = smoothIter / maxIter;

    // Multiple coloring layers
    vec3 iterCol = palette(t * 3.0 + time * 0.1 + uColorShift);
    vec3 trapCol = palette2(minDist * 5.0 + time * 0.15 + uColorShift);

    // Mix based on audio
    col = mix(iterCol, trapCol, 0.3 + mid * 0.3);

    // Brightness based on iteration depth
    float brightness = 1.0 - t * 0.5;
    col *= brightness;

    // Audio glow on edges (low iteration = near boundary = more interesting)
    float edgeGlow = exp(-t * 5.0) * energy * 2.0;
    col += edgeGlow * vec3(0.5, 0.2, 0.8);
  } else {
    // Interior coloring: orbit trap based
    float trapT = minDist * 10.0 + time * 0.1;
    col = palette2(trapT + uColorShift) * 0.3;

    // Inner glow
    float innerGlow = exp(-minDist * 20.0);
    col += innerGlow * palette(time * 0.2 + uColorShift) * 0.5;

    // Bass pulse in interior
    col *= 1.0 + bass * 0.5;
  }

  // Treble sparkle on high-detail areas
  float detail = exp(-minDist * 30.0);
  col += detail * treble * vec3(0.8, 0.6, 1.0) * 0.4;

  // Beat flash - brighten entire image
  float beatPulse = energy * energy * 0.3;
  col += beatPulse;

  // Subtle vignette
  float vig = 1.0 - length(vUv - 0.5) * 0.8;
  col *= vig;

  // Gamma correction
  col = pow(max(col, 0.0), vec3(0.85));

  gl_FragColor = vec4(col, 1.0);
}
