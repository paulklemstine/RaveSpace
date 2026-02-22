precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uGlow;
uniform float uAudioReactivity;
uniform float uColorShift;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// Hash for Voronoi
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Animated Voronoi — returns vec3(nearest dist, 2nd nearest dist, cell id)
vec3 voronoi(vec2 p, float time) {
  vec2 ip = floor(p);
  vec2 fp = fract(p);

  float d1 = 1e10;
  float d2 = 1e10;
  float cellId = 0.0;

  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 offset = vec2(float(i), float(j));
      vec2 cell = ip + offset;
      vec2 h = hash2(cell);

      // Animate cell centers
      vec2 cellPos = offset + 0.5 + 0.4 * sin(time * 0.5 + h * TAU) - fp;

      float dist = length(cellPos);

      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        cellId = dot(cell, vec2(7.0, 113.0));
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }

  return vec3(d1, d2, cellId);
}

// FBM noise for internal cell patterns
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot(0.5) * p * 2.0 + 0.5;
    a *= 0.5;
  }
  return v;
}

vec3 palette(float t, float shift) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.30 + shift, 0.20, 0.20);
  return a + b * cos(TAU * (c * t + d));
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

  // Scale and slow rotation
  float scale = uScale;
  uv = rot(time * 0.02) * uv;

  // Breathing
  uv *= 1.0 + sin(time * 0.3) * 0.05 + bass * 0.1;

  vec3 col = vec3(0.0);

  // === Multi-layer Voronoi web ===
  for (float layer = 0.0; layer < 3.0; layer++) {
    float layerScale = scale * (1.0 + layer * 0.8);
    vec2 p = uv * layerScale + vec2(layer * 10.0);
    p += vec2(sin(time * 0.1 + layer), cos(time * 0.13 + layer)) * 0.5;

    vec3 vor = voronoi(p, time + layer * 2.0);
    float d1 = vor.x;
    float d2 = vor.y;
    float id = vor.z;

    // Edge distance (web filaments)
    float edge = d2 - d1;

    // Web glow
    float webGlow = uGlow * 0.02 / (edge + 0.02);

    // Cell membrane
    float membrane = smoothstep(0.05, 0.0, abs(edge - 0.15));

    // Internal cell pattern (DMT-like nested geometry)
    float cellAngle = atan(fract(p.y) - 0.5, fract(p.x) - 0.5);
    float cellR = d1;
    float innerPattern = sin(cellAngle * 6.0 + id * 10.0 + time) *
                         sin(cellR * 20.0 - time * 2.0);
    innerPattern = smoothstep(0.0, 0.5, innerPattern);

    // Cell color based on ID
    float colorId = fract(id * 0.1 + time * 0.05);
    vec3 cellCol = palette(colorId + uColorShift, uColorShift);

    // Web color (slightly different hue)
    vec3 webCol = palette(colorId + 0.3 + uColorShift, uColorShift + 0.1);

    // Layer opacity decreases
    float layerAlpha = 1.0 / (1.0 + layer * 0.5);

    // Audio-reactive cell pulsing
    float pulse = sin(id * 3.0 + time * 2.0) * 0.5 + 0.5;
    pulse = mix(pulse, 1.0, energy * 0.5);

    // Combine
    vec3 layerCol = vec3(0.0);
    layerCol += webGlow * webCol; // Web filaments
    layerCol += membrane * webCol * 0.5; // Cell membrane
    layerCol += innerPattern * cellCol * 0.2 * pulse; // Inner patterns
    layerCol += exp(-d1 * 3.0) * cellCol * 0.1 * (0.5 + bass); // Cell center glow

    col += layerCol * layerAlpha;
  }

  // === Neural connections (long-range links) ===
  float r = length(uv);
  float angle = atan(uv.y, uv.x);

  // Radial filaments
  float filaments = sin(angle * 12.0 + time * 0.5) * sin(r * 10.0 - time);
  filaments = smoothstep(0.3, 0.8, filaments);
  col += filaments * vec3(0.3, 0.1, 0.5) * 0.15 * (0.5 + treble);

  // === Background nebula ===
  float nebula = fbm(uv * 1.5 + time * 0.05);
  vec3 nebulaCol = palette(nebula + time * 0.02 + uColorShift, uColorShift);
  col += nebulaCol * 0.08;

  // === Stars ===
  for (float i = 0.0; i < 2.0; i++) {
    vec2 starUv = uv * (20.0 + i * 15.0);
    vec2 starId = floor(starUv);
    vec2 starF = fract(starUv) - 0.5;
    float starHash = hash(starId + i * 100.0);

    if (starHash > 0.97) {
      float starDist = length(starF);
      float star = 0.003 / (starDist * starDist + 0.003);
      float twinkle = sin(time * 3.0 + starHash * 100.0) * 0.5 + 0.5;
      col += star * twinkle * vec3(0.8, 0.85, 1.0) * 0.2;
    }
  }

  // Beat flash on web
  col *= 1.0 + energy * energy * 0.4;

  // Vignette
  float vig = 1.0 - r * 0.35;
  col *= clamp(vig, 0.0, 1.0);

  // Tone mapping
  col = col / (col + 0.8);
  col = pow(col, vec3(0.9));

  gl_FragColor = vec4(col, 1.0);
}
