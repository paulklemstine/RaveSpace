import type { WebGLRenderer } from "three";
import type { AudioFeatures } from "./audio";
import type { ParamDescriptor, ParamValues } from "./params";

export interface Scene {
  /** Initialize the scene. Called once before first render. */
  init(renderer: WebGLRenderer): void;

  /** Update and render one frame. */
  update(time: number, audio: AudioFeatures): void;

  /** Handle window resize. */
  resize(width: number, height: number): void;

  /** Clean up all resources. Called when scene is removed. */
  dispose(): void;
}

export interface ParameterizedScene extends Scene {
  readonly params: readonly ParamDescriptor[];
  setParams(values: ParamValues): void;
  getParams(): ParamValues;
}

export function isParameterizedScene(scene: Scene): scene is ParameterizedScene {
  return "params" in scene && "setParams" in scene && "getParams" in scene;
}
