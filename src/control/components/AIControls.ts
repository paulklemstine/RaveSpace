export interface AIControlValues {
  enabled: boolean;
}

export class AIControls {
  private toggleBtn: HTMLButtonElement;
  private statusEl: HTMLDivElement;
  private lastActionEl: HTMLDivElement;
  private enabled = false;
  private onChange: (values: AIControlValues) => void;

  constructor(parent: HTMLElement, onChange: (values: AIControlValues) => void) {
    this.onChange = onChange;

    const section = document.createElement("div");
    section.className = "space-y-3";

    const heading = document.createElement("h2");
    heading.className = "text-xs font-bold text-gray-500 tracking-widest mb-3";
    heading.textContent = "AI VJ";
    section.appendChild(heading);

    // Toggle button
    const btnRow = document.createElement("div");
    btnRow.className = "flex items-center gap-3";

    this.toggleBtn = document.createElement("button");
    this.toggleBtn.textContent = "AUTO VJ: OFF";
    this.toggleBtn.className =
      "px-4 py-2 text-sm font-bold rounded border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer";
    this.toggleBtn.addEventListener("click", () => {
      this.enabled = !this.enabled;
      this.updateUI();
      this.onChange({ enabled: this.enabled });
    });
    btnRow.appendChild(this.toggleBtn);

    // Status indicator
    this.statusEl = document.createElement("div");
    this.statusEl.className = "text-sm text-gray-500";
    this.statusEl.textContent = "Idle";
    btnRow.appendChild(this.statusEl);

    section.appendChild(btnRow);

    // Last action display
    this.lastActionEl = document.createElement("div");
    this.lastActionEl.className = "text-xs text-gray-500 italic min-h-[1.5em]";
    this.lastActionEl.textContent = "";
    section.appendChild(this.lastActionEl);

    parent.appendChild(section);
  }

  update(data: { enabled?: boolean; lastAction?: string }): void {
    if (data.enabled !== undefined && data.enabled !== this.enabled) {
      this.enabled = data.enabled;
      this.updateUI();
    }
    if (data.lastAction !== undefined) {
      this.lastActionEl.textContent = data.lastAction;
    }
  }

  private updateUI(): void {
    if (this.enabled) {
      this.toggleBtn.textContent = "AUTO VJ: ON";
      this.toggleBtn.className =
        "px-4 py-2 text-sm font-bold rounded border border-green-500 bg-green-500/30 text-green-300 transition-colors cursor-pointer";
      this.statusEl.textContent = "Running";
      this.statusEl.className = "text-sm text-green-400";
    } else {
      this.toggleBtn.textContent = "AUTO VJ: OFF";
      this.toggleBtn.className =
        "px-4 py-2 text-sm font-bold rounded border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer";
      this.statusEl.textContent = "Idle";
      this.statusEl.className = "text-sm text-gray-500";
    }
  }
}
