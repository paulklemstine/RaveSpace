import type { WebGLRenderer } from "three";
import type { AudioFeatures } from "./audio";

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
