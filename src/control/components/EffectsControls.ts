export interface EffectsControlValues {
  dropFlash: boolean;
  dropZoom: boolean;
  screenShake: boolean;
  sensitivity: number;
  strobeBpmSync: boolean;
}

export class EffectsControls {
  private flashCheck: HTMLInputElement;
  private zoomCheck: HTMLInputElement;
  private shakeCheck: HTMLInputElement;
  private sensitivityInput: HTMLInputElement;
  private bpmSyncCheck: HTMLInputElement;
  private onChange: (values: EffectsControlValues) => void;

  constructor(parent: HTMLElement, onChange: (values: EffectsControlValues) => void) {
    this.onChange = onChange;

    const section = document.createElement("div");
    section.className = "space-y-3";

    const heading = document.createElement("h2");
    heading.className = "text-xs font-bold text-gray-500 tracking-widest mb-3";
    heading.textContent = "DROP EFFECTS";
    section.appendChild(heading);

    // Sensitivity slider
    const sensRow = document.createElement("div");
    sensRow.className = "flex items-center gap-3";
    const sensLabel = document.createElement("label");
    sensLabel.className = "text-sm text-gray-300 w-36 shrink-0";
    sensLabel.textContent = "Sensitivity";
    this.sensitivityInput = document.createElement("input");
    this.sensitivityInput.type = "range";
    this.sensitivityInput.min = "0.1";
    this.sensitivityInput.max = "2";
    this.sensitivityInput.step = "0.1";
    this.sensitivityInput.value = "1";
    this.sensitivityInput.className = "flex-1 accent-purple-500";
    const sensValue = document.createElement("span");
    sensValue.className = "text-sm text-gray-400 w-12 text-right tabular-nums";
    sensValue.textContent = "1.0";
    this.sensitivityInput.addEventListener("input", () => {
      sensValue.textContent = parseFloat(this.sensitivityInput.value).toFixed(1);
      this.emitChange();
    });
    sensRow.append(sensLabel, this.sensitivityInput, sensValue);
    section.appendChild(sensRow);

    // Checkboxes row
    const checkRow = document.createElement("div");
    checkRow.className = "flex flex-wrap gap-4 mt-1";

    this.flashCheck = this.addCheckbox(checkRow, "Flash", true);
    this.zoomCheck = this.addCheckbox(checkRow, "Zoom", true);
    this.shakeCheck = this.addCheckbox(checkRow, "Shake", true);
    this.bpmSyncCheck = this.addCheckbox(checkRow, "BPM Strobe", false);

    section.appendChild(checkRow);
    parent.appendChild(section);
  }

  update(values: Partial<EffectsControlValues>): void {
    if (values.dropFlash !== undefined) this.flashCheck.checked = values.dropFlash;
    if (values.dropZoom !== undefined) this.zoomCheck.checked = values.dropZoom;
    if (values.screenShake !== undefined) this.shakeCheck.checked = values.screenShake;
    if (values.strobeBpmSync !== undefined) this.bpmSyncCheck.checked = values.strobeBpmSync;
    if (values.sensitivity !== undefined) {
      this.sensitivityInput.value = String(values.sensitivity);
      const display = this.sensitivityInput.parentElement?.querySelector("span.tabular-nums");
      if (display) display.textContent = values.sensitivity.toFixed(1);
    }
  }

  private addCheckbox(parent: HTMLElement, label: string, defaultChecked: boolean): HTMLInputElement {
    const wrapper = document.createElement("label");
    wrapper.className = "flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = defaultChecked;
    input.className = "accent-purple-500 cursor-pointer";
    input.addEventListener("change", () => this.emitChange());

    const text = document.createElement("span");
    text.textContent = label;

    wrapper.append(input, text);
    parent.appendChild(wrapper);
    return input;
  }

  private emitChange(): void {
    this.onChange({
      dropFlash: this.flashCheck.checked,
      dropZoom: this.zoomCheck.checked,
      screenShake: this.shakeCheck.checked,
      sensitivity: parseFloat(this.sensitivityInput.value),
      strobeBpmSync: this.bpmSyncCheck.checked,
    });
  }
}
