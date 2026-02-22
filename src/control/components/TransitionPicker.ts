import { CURATED_TRANSITIONS } from "../../engine/transitions";

export interface TransitionSettings {
  effect: string;
  duration: number;
}

export class TransitionPicker {
  private effectSelect: HTMLSelectElement;
  private durationInput: HTMLInputElement;
  private durationValue: HTMLSpanElement;
  private onChange: (settings: TransitionSettings) => void;

  constructor(parent: HTMLElement, onChange: (settings: TransitionSettings) => void) {
    this.onChange = onChange;

    const section = document.createElement("div");
    section.className = "space-y-3";

    const heading = document.createElement("h2");
    heading.className = "text-xs font-bold text-gray-500 tracking-widest mb-3";
    heading.textContent = "TRANSITION";
    section.appendChild(heading);

    // Effect dropdown
    const effectRow = document.createElement("div");
    effectRow.className = "flex items-center gap-3";
    const effectLabel = document.createElement("label");
    effectLabel.className = "text-sm text-gray-300 w-36 shrink-0";
    effectLabel.textContent = "Effect";
    this.effectSelect = document.createElement("select");
    this.effectSelect.className =
      "flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 cursor-pointer";
    for (const name of CURATED_TRANSITIONS) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      this.effectSelect.appendChild(opt);
    }
    this.effectSelect.value = "fade";
    this.effectSelect.addEventListener("change", () => this.emitChange());
    effectRow.append(effectLabel, this.effectSelect);
    section.appendChild(effectRow);

    // Duration slider
    const durationRow = document.createElement("div");
    durationRow.className = "flex items-center gap-3";
    const durationLabel = document.createElement("label");
    durationLabel.className = "text-sm text-gray-300 w-36 shrink-0";
    durationLabel.textContent = "Duration (s)";
    this.durationInput = document.createElement("input");
    this.durationInput.type = "range";
    this.durationInput.min = "0.5";
    this.durationInput.max = "10";
    this.durationInput.step = "0.5";
    this.durationInput.value = "3";
    this.durationInput.className = "flex-1 accent-purple-500";
    this.durationValue = document.createElement("span");
    this.durationValue.className = "text-sm text-gray-400 w-12 text-right tabular-nums";
    this.durationValue.textContent = "3.0";
    this.durationInput.addEventListener("input", () => {
      this.durationValue.textContent = parseFloat(this.durationInput.value).toFixed(1);
      this.emitChange();
    });
    durationRow.append(durationLabel, this.durationInput, this.durationValue);
    section.appendChild(durationRow);

    parent.appendChild(section);
  }

  update(settings: Partial<TransitionSettings>): void {
    if (settings.effect !== undefined) {
      this.effectSelect.value = settings.effect;
    }
    if (settings.duration !== undefined) {
      this.durationInput.value = String(settings.duration);
      this.durationValue.textContent = settings.duration.toFixed(1);
    }
  }

  private emitChange(): void {
    this.onChange({
      effect: this.effectSelect.value,
      duration: parseFloat(this.durationInput.value),
    });
  }
}
