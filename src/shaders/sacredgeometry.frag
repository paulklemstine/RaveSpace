precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;
uniform float uSpeed;
uniform float uComplexity;
uniform float uSymmetry;
uniform float uAudioReactivity;
uniform float uColorShift;

#define PI 3.14159265359
#define TAU 6.28318530718

// Cosine palette
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

// Rotation matrix
mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// SDF circle
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

// SDF line segment
float sdLine(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Flower of life pattern
float flowerOfLife(vec2 p, float r, float time) {
  float d = 1e5;
  // Center circle
  d = min(d, abs(sdCircle(p, r)));

  // 6 surrounding circles
  for (int i = 0; i < 6; i++) {
    float angle = float(i) * TAU / 6.0 + time * 0.1;
    vec2 offset = vec2(cos(angle), sin(angle)) * r;
    d = min(d, abs(sdCircle(p - offset, r)));
  }

  // Second ring of 12
  for (int i = 0; i < 12; i++) {
    float angle = float(i) * TAU / 12.0 + time * 0.05;
    vec2 offset = vec2(cos(angle), sin(angle)) * r * 1.732;
    d = min(d, abs(sdCircle(p - offset, r)));
  }

  return d;
}

// Mandala ring pattern
float mandalaRing(vec2 p, float radius, float width, float segments, float time) {
  float angle = atan(p.y, p.x);
  float r = length(p);

  // Angular segments
  float seg = abs(fract(angle / TAU * segments + 0.5) - 0.5) * 2.0;
  seg = smoothstep(0.3, 0.7, seg);

  // Radial ring
  float ring = abs(r - radius) - width * 0.5;
  ring = smoothstep(width, 0.0, abs(r - radius));

  return ring * seg;
}

// Sacred triangle (Sri Yantra inspired)
float sacredTriangle(vec2 p, float size, float rotation) {
  p = rot(rotation) * p;
  // Equilateral triangle SDF
  const float k = sqrt(3.0);
  p.x = abs(p.x) - size;
  p.y = p.y + size / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * size, 0.0);
  return -length(p) * sign(p.y);
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
  float symmetry = uSymmetry;

  // Breathing zoom
  float zoom = 1.0 + sin(time * 0.3) * 0.1 + bass * 0.2;
  uv /= zoom;

  // Slow rotation of entire field
  uv = rot(time * 0.05 + energy * 0.1) * uv;

  vec3 col = vec3(0.0);
  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  // === Layer 1: Flower of Life ===
  float flowerRadius = 0.3 + bass * 0.1;
  float flower = flowerOfLife(uv, flowerRadius, time);
  float flowerGlow = 0.008 / (flower + 0.008);
  vec3 flowerCol = palette(
    r * 2.0 + time * 0.1 + uColorShift,
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.5),
    vec3(1.0, 1.0, 1.0),
    vec3(0.0 + uColorShift, 0.33, 0.67)
  );
  col += flowerGlow * flowerCol * (0.5 + energy * 0.5);

  // === Layer 2: Mandala Rings ===
  float numRings = 3.0 + uComplexity * 4.0;
  for (float i = 1.0; i <= 7.0; i++) {
    if (i > numRings) break;
    float ringRadius = i * 0.15 + bass * 0.05 * sin(i * 1.5);
    float segments = floor(symmetry + i * 2.0);
    float ringTime = time * (0.2 + i * 0.05) * (mod(i, 2.0) == 0.0 ? 1.0 : -1.0);

    float ring = mandalaRing(uv, ringRadius, 0.02 + treble * 0.01, segments, ringTime);

    vec3 ringCol = palette(
      i * 0.15 + time * 0.05 + uColorShift,
      vec3(0.5, 0.5, 0.5),
      vec3(0.5, 0.5, 0.5),
      vec3(1.0, 0.7, 0.4),
      vec3(0.0, 0.15 + uColorShift, 0.2)
    );

    col += ring * ringCol * (0.3 + mid * 0.4);
  }

  // === Layer 3: Sacred Triangles ===
  float complexity = uComplexity;
  if (complexity > 0.3) {
    for (float i = 0.0; i < 4.0; i++) {
      float triSize = 0.4 + i * 0.15 - bass * 0.05;
      float triRot = time * 0.1 * (mod(i, 2.0) == 0.0 ? 1.0 : -1.0) + i * PI / 3.0;

      // Upward triangle
      float tri1 = sacredTriangle(uv, triSize, triRot);
      float triGlow1 = 0.005 / (abs(tri1) + 0.005);

      // Downward triangle (Star of David)
      float tri2 = sacredTriangle(uv, triSize, triRot + PI);
      float triGlow2 = 0.005 / (abs(tri2) + 0.005);

      vec3 triCol = palette(
        i * 0.25 + time * 0.08 + uColorShift + 0.5,
        vec3(0.5, 0.5, 0.5),
        vec3(0.5, 0.5, 0.5),
        vec3(2.0, 1.0, 0.5),
        vec3(0.5, 0.2 + uColorShift, 0.25)
      );

      col += (triGlow1 + triGlow2) * triCol * 0.3 * (0.5 + treble * 0.5);
    }
  }

  // === Layer 4: Radiating lines ===
  float lineSegments = symmetry * 2.0;
  float lineAngle = mod(angle + PI, TAU / lineSegments);
  lineAngle = abs(lineAngle - TAU / lineSegments * 0.5);
  float line = smoothstep(0.02, 0.0, lineAngle * r);
  float linePulse = sin(r * 20.0 - time * 2.0 + bass * 5.0) * 0.5 + 0.5;
  col += line * linePulse * vec3(0.4, 0.2, 0.6) * 0.3;

  // === Layer 5: Center eye ===
  float eye = smoothstep(0.08, 0.0, r) * (0.5 + energy);
  vec3 eyeCol = palette(
    time * 0.2 + uColorShift,
    vec3(0.8, 0.8, 0.8),
    vec3(0.2, 0.2, 0.2),
    vec3(1.0, 1.0, 1.0),
    vec3(0.0, 0.1, 0.2)
  );
  col += eye * eyeCol * 2.0;

  // Beat flash
  float beatFlash = smoothstep(0.9, 1.0, energy) * 0.3;
  col += beatFlash;

  // Vignette
  float vig = 1.0 - r * 0.4;
  col *= clamp(vig, 0.0, 1.0);

  // Gamma
  col = pow(col, vec3(0.9));

  gl_FragColor = vec4(col, 1.0);
}
