import { WebGLRenderer } from "three";
import type { Scene } from "../types/scene";
import { SILENT_AUDIO } from "../types/audio";

export class Renderer {
  private renderer: WebGLRenderer;
  private scene: Scene | null = null;
  private animationId = 0;
  private startTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  setScene(scene: Scene): void {
    this.scene?.dispose();
    this.scene = scene;
    scene.init(this.renderer);
    scene.resize(window.innerWidth, window.innerHeight);
  }

  start(): void {
    this.startTime = performance.now() / 1000;
    this.loop();
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.resize);
    this.scene?.dispose();
    this.renderer.dispose();
  }

  private loop = (): void => {
    this.animationId = requestAnimationFrame(this.loop);
    const time = performance.now() / 1000 - this.startTime;
    this.scene?.update(time, SILENT_AUDIO);
  };

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.scene?.resize(w, h);
  };
}
