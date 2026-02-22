declare module "*.frag" {
  const value: string;
  export default value;
}

declare module "*.vert" {
  const value: string;
  export default value;
}

declare module "*.glsl" {
  const value: string;
  export default value;
}

declare module "gl-transitions" {
  interface GLTransition {
    name: string;
    paramsTypes: Record<string, string>;
    defaultParams: Record<string, number | number[]>;
    glsl: string;
    author: string;
    license: string;
    createdAt: string;
    updatedAt: string;
  }
  const transitions: GLTransition[];
  export default transitions;
}
