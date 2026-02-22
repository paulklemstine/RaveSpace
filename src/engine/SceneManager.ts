import type { Scene } from "../types/scene";

type SceneFactory = () => Scene;

export class SceneManager {
  private factories = new Map<string, SceneFactory>();

  register(name: string, factory: SceneFactory): void {
    this.factories.set(name, factory);
  }

  create(name: string): Scene {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Scene not found: ${name}`);
    }
    return factory();
  }

  list(): string[] {
    return Array.from(this.factories.keys());
  }
}
