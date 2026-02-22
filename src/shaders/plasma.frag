precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;

// Cosine palette: attempt by iq
vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.263, 0.416, 0.557);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float speed = uTime * 0.5;

  // Layered plasma
  float v = 0.0;
  v += sin(uv.x * 3.0 + speed);
  v += sin(uv.y * 3.0 + speed * 0.7);
  v += sin((uv.x + uv.y) * 2.0 + speed * 1.3);
  v += sin(length(uv) * 4.0 - speed * 2.0);

  // Audio-reactive modulation (neutral at 0.0)
  float audioMod = 1.0 + uEnergy * 2.0;
  v *= audioMod;

  // Tunnel warp
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);
  float tunnel = sin(dist * 6.0 - speed * 3.0 + angle * 2.0);
  v += tunnel * (0.5 + uBass);

  // Color
  float t = v * 0.25 + speed * 0.1;
  vec3 color = palette(t);

  // Treble sparkle
  color += uTreble * 0.3 * sin(uv.x * 20.0 + speed * 5.0) * sin(uv.y * 20.0 + speed * 4.0);

  // Vignette
  float vignette = 1.0 - dist * 0.4;
  color *= vignette;

  gl_FragColor = vec4(color, 1.0);
}
