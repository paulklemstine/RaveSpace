import glTransitions from "gl-transitions";

export interface TransitionDef {
  name: string;
  glsl: string;
}

/** Curated VJ-friendly transitions */
export const CURATED_TRANSITIONS = [
  "fade",
  "crosswarp",
  "Dreamy",
  "DreamyZoom",
  "GlitchMemories",
  "GlitchDisplace",
  "CrossZoom",
  "Swirl",
  "burn",
  "Radial",
  "ripple",
  "morph",
  "pixelize",
  "wind",
  "kaleidoscope",
] as const;

export type CuratedTransitionName = (typeof CURATED_TRANSITIONS)[number];

const transitionMap = new Map<string, TransitionDef>();

// Index all gl-transitions by name
for (const t of glTransitions as Array<{ name: string; glsl: string }>) {
  transitionMap.set(t.name, { name: t.name, glsl: t.glsl });
}

export function getTransition(name: string): TransitionDef | undefined {
  return transitionMap.get(name);
}

export function listTransitions(): string[] {
  return Array.from(transitionMap.keys());
}

/**
 * Wraps a gl-transition GLSL snippet into a complete fragment shader.
 * The gl-transitions library provides a `transition(vec2 uv)` function
 * that uses `getFromColor(uv)`, `getToColor(uv)`, and `progress`.
 * We provide those as uniforms/samplers and call `transition()` in main().
 */
export function buildTransitionFragmentShader(transitionGlsl: string): string {
  return `
uniform sampler2D tFrom;
uniform sampler2D tTo;
uniform float progress;
uniform float ratio;

varying vec2 vUv;

vec4 getFromColor(vec2 uv) {
  return texture2D(tFrom, uv);
}

vec4 getToColor(vec2 uv) {
  return texture2D(tTo, uv);
}

${transitionGlsl}

void main() {
  gl_FragColor = transition(vUv);
}
`;
}
