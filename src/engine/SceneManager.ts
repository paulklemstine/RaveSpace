import type { Scene } from "../types/scene";
import type { SceneMetadata } from "../scenes/registry";

type SceneFactory = () => Scene;

interface SceneEntry {
  metadata: SceneMetadata;
  factory: SceneFactory;
}

export class SceneManager {
  private entries = new Map<string, SceneEntry>();
  private activeSceneName: string | null = null;

  register(metadata: SceneMetadata, factory: SceneFactory): void {
    this.entries.set(metadata.id, { metadata, factory });
  }

  create(name: string): Scene {
    const entry = this.entries.get(name);
    if (!entry) {
      throw new Error(`Scene not found: ${name}`);
    }
    this.activeSceneName = name;
    return entry.factory();
  }

  getMetadata(name: string): SceneMetadata | undefined {
    return this.entries.get(name)?.metadata;
  }

  listMetadata(): SceneMetadata[] {
    return Array.from(this.entries.values()).map((e) => e.metadata);
  }

  getActiveSceneName(): string | null {
    return this.activeSceneName;
  }

  list(): string[] {
    return Array.from(this.entries.keys());
  }
}
