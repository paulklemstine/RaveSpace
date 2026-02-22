precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uKick;
uniform float uBeatIntensity;
uniform float uSpectralFlux;
uniform vec2 uResolution;

// Param uniforms
uniform float uSpeed;
uniform float uTunnelIntensity;
uniform float uColorShift;
uniform float uAudioReactivity;
uniform float uVignette;

// Cosine palette: attempt by iq
vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.263, 0.416, 0.557) + uColorShift;
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float speed = uTime * 0.5 * uSpeed;

  // Layered plasma
  float v = 0.0;
  v += sin(uv.x * 3.0 + speed);
  v += sin(uv.y * 3.0 + speed * 0.7);
  v += sin((uv.x + uv.y) * 2.0 + speed * 1.3);
  v += sin(length(uv) * 4.0 - speed * 2.0);

  // Audio-reactive modulation scaled by reactivity param
  float audioMod = 1.0 + uEnergy * 2.0 * uAudioReactivity;
  v *= audioMod;

  // Tunnel warp: kick for sharp punch + bass for sustain
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);
  float tunnel = sin(dist * 6.0 - speed * 3.0 + angle * 2.0);
  float tunnelDrive = 0.5 + uKick * 1.5 * uAudioReactivity + uBass * 0.3 * uAudioReactivity;
  v += tunnel * tunnelDrive * uTunnelIntensity;

  // Color
  float t = v * 0.25 + speed * 0.1;
  vec3 color = palette(t);

  // Beat flash — proportional brightness on beats
  color += uBeatIntensity * uAudioReactivity * 0.4;

  // Treble sparkle
  color += uTreble * uAudioReactivity * 0.3 * sin(uv.x * 20.0 + speed * 5.0) * sin(uv.y * 20.0 + speed * 4.0);

  // Flux sparkle — higher-frequency detail driven by spectral flux
  float fluxDetail = sin(uv.x * 40.0 + speed * 8.0) * sin(uv.y * 40.0 + speed * 7.0);
  color += uSpectralFlux * uAudioReactivity * 0.25 * fluxDetail;

  // Vignette (controlled by param, 0.0 = off, 1.0 = on)
  float vignette = mix(1.0, 1.0 - dist * 0.4, uVignette);
  color *= vignette;

  gl_FragColor = vec4(color, 1.0);
}
