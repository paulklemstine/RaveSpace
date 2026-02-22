import type { SceneMetadata } from "../../scenes/registry";

export class ScenePicker {
  private cards = new Map<string, HTMLButtonElement>();
  private activeScene: string | null = null;
  private onChange: (sceneId: string) => void;

  constructor(parent: HTMLElement, scenes: readonly SceneMetadata[], onChange: (sceneId: string) => void) {
    this.onChange = onChange;

    const section = document.createElement("div");
    section.className = "space-y-2";

    const heading = document.createElement("h2");
    heading.textContent = "SCENES";
    heading.className = "text-xs font-bold text-gray-500 tracking-widest mb-3";
    section.appendChild(heading);

    for (const scene of scenes) {
      const btn = document.createElement("button");
      btn.className =
        "w-full px-4 py-3 text-left rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-700/50 transition-colors cursor-pointer";

      const name = document.createElement("div");
      name.className = "font-semibold text-sm";
      name.textContent = scene.displayName;

      const badge = document.createElement("span");
      badge.className = "text-xs text-green-400 font-bold ml-2 hidden";
      badge.textContent = "LIVE";

      name.appendChild(badge);
      btn.appendChild(name);

      btn.addEventListener("click", () => {
        this.onChange(scene.id);
      });

      this.cards.set(scene.id, btn);
      section.appendChild(btn);
    }

    parent.appendChild(section);
  }

  update(activeScene: string): void {
    if (activeScene === this.activeScene) return;
    this.activeScene = activeScene;

    for (const [id, btn] of this.cards) {
      const badge = btn.querySelector("span")!;
      if (id === activeScene) {
        btn.className =
          "w-full px-4 py-3 text-left rounded-lg border border-purple-500 bg-purple-500/20 transition-colors cursor-pointer";
        badge.classList.remove("hidden");
      } else {
        btn.className =
          "w-full px-4 py-3 text-left rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-700/50 transition-colors cursor-pointer";
        badge.classList.add("hidden");
      }
    }
  }

  dispose(): void {
    // Buttons removed with parent
  }
}
