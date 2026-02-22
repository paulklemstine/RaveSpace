export interface GlobalControlValues {
  masterIntensity: number;
  speedMultiplier: number;
  blackout: boolean;
  strobe: boolean;
}

export class GlobalControls {
  private intensityInput: HTMLInputElement;
  private speedInput: HTMLInputElement;
  private blackoutBtn: HTMLButtonElement;
  private strobeBtn: HTMLButtonElement;
  private onChange: (values: GlobalControlValues) => void;
  private blackout = false;
  private strobe = false;

  constructor(parent: HTMLElement, onChange: (values: GlobalControlValues) => void) {
    this.onChange = onChange;

    const section = document.createElement("div");
    section.className = "space-y-3";

    const heading = document.createElement("h2");
    heading.className = "text-xs font-bold text-gray-500 tracking-widest mb-3";
    heading.textContent = "GLOBAL CONTROLS";
    section.appendChild(heading);

    // Master intensity slider
    const intensityRow = document.createElement("div");
    intensityRow.className = "flex items-center gap-3";
    const intensityLabel = document.createElement("label");
    intensityLabel.className = "text-sm text-gray-300 w-36 shrink-0";
    intensityLabel.textContent = "Master Intensity";
    this.intensityInput = document.createElement("input");
    this.intensityInput.type = "range";
    this.intensityInput.min = "0";
    this.intensityInput.max = "2";
    this.intensityInput.step = "0.05";
    this.intensityInput.value = "1";
    this.intensityInput.className = "flex-1 accent-purple-500";
    const intensityValue = document.createElement("span");
    intensityValue.className = "text-sm text-gray-400 w-12 text-right tabular-nums";
    intensityValue.textContent = "1.0";
    this.intensityInput.addEventListener("input", () => {
      intensityValue.textContent = parseFloat(this.intensityInput.value).toFixed(1);
      this.emitChange();
    });
    intensityRow.append(intensityLabel, this.intensityInput, intensityValue);
    section.appendChild(intensityRow);

    // Speed multiplier slider
    const speedRow = document.createElement("div");
    speedRow.className = "flex items-center gap-3";
    const speedLabel = document.createElement("label");
    speedLabel.className = "text-sm text-gray-300 w-36 shrink-0";
    speedLabel.textContent = "Speed Multiplier";
    this.speedInput = document.createElement("input");
    this.speedInput.type = "range";
    this.speedInput.min = "0.1";
    this.speedInput.max = "5";
    this.speedInput.step = "0.1";
    this.speedInput.value = "1";
    this.speedInput.className = "flex-1 accent-purple-500";
    const speedValue = document.createElement("span");
    speedValue.className = "text-sm text-gray-400 w-12 text-right tabular-nums";
    speedValue.textContent = "1.0";
    this.speedInput.addEventListener("input", () => {
      speedValue.textContent = parseFloat(this.speedInput.value).toFixed(1);
      this.emitChange();
    });
    speedRow.append(speedLabel, this.speedInput, speedValue);
    section.appendChild(speedRow);

    // Blackout + Strobe buttons
    const btnRow = document.createElement("div");
    btnRow.className = "flex gap-3 mt-2";

    this.blackoutBtn = document.createElement("button");
    this.blackoutBtn.textContent = "BLACKOUT";
    this.blackoutBtn.className =
      "flex-1 py-3 text-sm font-bold rounded border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer";
    this.blackoutBtn.addEventListener("click", () => {
      this.blackout = !this.blackout;
      this.updateButtonStates();
      this.emitChange();
    });

    this.strobeBtn = document.createElement("button");
    this.strobeBtn.textContent = "STROBE";
    this.strobeBtn.className =
      "flex-1 py-3 text-sm font-bold rounded border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer";
    this.strobeBtn.addEventListener("click", () => {
      this.strobe = !this.strobe;
      this.updateButtonStates();
      this.emitChange();
    });

    btnRow.append(this.blackoutBtn, this.strobeBtn);
    section.appendChild(btnRow);

    parent.appendChild(section);
  }

  update(values: Partial<GlobalControlValues>): void {
    if (values.masterIntensity !== undefined) {
      this.intensityInput.value = String(values.masterIntensity);
      const display = this.intensityInput.parentElement?.querySelector("span.tabular-nums");
      if (display) display.textContent = values.masterIntensity.toFixed(1);
    }
    if (values.speedMultiplier !== undefined) {
      this.speedInput.value = String(values.speedMultiplier);
      const display = this.speedInput.parentElement?.querySelector("span.tabular-nums");
      if (display) display.textContent = values.speedMultiplier.toFixed(1);
    }
    if (values.blackout !== undefined) this.blackout = values.blackout;
    if (values.strobe !== undefined) this.strobe = values.strobe;
    this.updateButtonStates();
  }

  private updateButtonStates(): void {
    this.blackoutBtn.className = this.blackout
      ? "flex-1 py-3 text-sm font-bold rounded border border-red-500 bg-red-500/30 text-red-300 transition-colors cursor-pointer"
      : "flex-1 py-3 text-sm font-bold rounded border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer";
    this.strobeBtn.className = this.strobe
      ? "flex-1 py-3 text-sm font-bold rounded border border-yellow-500 bg-yellow-500/30 text-yellow-300 transition-colors cursor-pointer"
      : "flex-1 py-3 text-sm font-bold rounded border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer";
  }

  private emitChange(): void {
    this.onChange({
      masterIntensity: parseFloat(this.intensityInput.value),
      speedMultiplier: parseFloat(this.speedInput.value),
      blackout: this.blackout,
      strobe: this.strobe,
    });
  }

  dispose(): void {
    // Cleaned up with parent
  }
}
