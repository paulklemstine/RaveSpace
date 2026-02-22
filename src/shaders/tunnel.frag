precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uResolution;

// Param uniforms
uniform float uSpeed;
uniform float uRadius;
uniform float uTwist;
uniform float uGlowIntensity;
uniform float uAudioReactivity;
uniform int uColorScheme;

// Color palettes
vec3 fireColor(float t) {
  return vec3(
    smoothstep(0.0, 0.5, t),
    smoothstep(0.3, 0.8, t) * 0.6,
    smoothstep(0.7, 1.0, t) * 0.3
  );
}

vec3 iceColor(float t) {
  return vec3(
    smoothstep(0.5, 1.0, t) * 0.4,
    smoothstep(0.2, 0.8, t) * 0.7,
    smoothstep(0.0, 0.5, t)
  );
}

vec3 toxicColor(float t) {
  return vec3(
    smoothstep(0.5, 1.0, t) * 0.3,
    smoothstep(0.0, 0.5, t),
    smoothstep(0.3, 0.8, t) * 0.4
  );
}

vec3 rainbowColor(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

vec3 getColor(float t) {
  if (uColorScheme == 0) return fireColor(t);
  if (uColorScheme == 1) return iceColor(t);
  if (uColorScheme == 2) return toxicColor(t);
  return rainbowColor(t);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float time = uTime * uSpeed;

  // Polar coordinates
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // Tunnel mapping: inverse distance for depth
  float depth = uRadius / (dist + 0.01);

  // Audio-reactive radius pulse
  float radiusPulse = 1.0 + uBass * 0.3 * uAudioReactivity;
  depth *= radiusPulse;

  // Forward motion with beat burst
  float speed = time * 2.0;
  float beatBurst = uEnergy * 3.0 * uAudioReactivity;
  float z = depth + speed + beatBurst;

  // Twist along depth
  float twistAngle = angle + depth * uTwist * 0.5 + time * 0.3;

  // Repeating pattern
  float pattern = sin(twistAngle * 4.0 + z * 0.5) *
                  sin(z * 0.8 - twistAngle * 2.0);

  // Mid-frequency texture modulation
  pattern += sin(twistAngle * 8.0 + z * 1.5) * 0.3 * (1.0 + uMid * uAudioReactivity);

  // Rings
  float rings = sin(z * 3.0) * 0.5 + 0.5;

  // Combine
  float v = pattern * 0.5 + rings * 0.5;
  v = v * 0.5 + 0.5; // remap to 0-1

  // Color from palette
  vec3 color = getColor(v + time * 0.05);

  // Edge glow driven by treble
  float edgeGlow = smoothstep(0.8, 0.0, dist) * uGlowIntensity;
  float trebleGlow = uTreble * uAudioReactivity * 1.5;
  color += edgeGlow * (0.3 + trebleGlow) * getColor(v + 0.3);

  // Depth fade (darker at center = far away)
  float depthFade = smoothstep(0.0, 2.0, dist);
  color *= 0.3 + depthFade * 0.7;

  // Overall energy brightness
  color *= 0.7 + uEnergy * 0.5 * uAudioReactivity;

  gl_FragColor = vec4(color, 1.0);
}
