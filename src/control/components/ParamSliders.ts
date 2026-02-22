import type { ParamDescriptor, ParamValues } from "../../types/params";

export class ParamSliders {
  private container: HTMLDivElement;
  private inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();
  private currentParams: readonly ParamDescriptor[] = [];
  private onChange: (values: ParamValues) => void;
  private onReset: () => void;

  constructor(parent: HTMLElement, onChange: (values: ParamValues) => void, onReset: () => void) {
    this.onChange = onChange;
    this.onReset = onReset;

    this.container = document.createElement("div");
    this.container.className = "space-y-3";
    parent.appendChild(this.container);
  }

  setScene(sceneName: string, params: readonly ParamDescriptor[]): void {
    this.currentParams = params;
    this.inputs.clear();
    this.container.innerHTML = "";

    const heading = document.createElement("h2");
    heading.className = "text-xs font-bold text-gray-500 tracking-widest mb-3";
    heading.textContent = `SCENE PARAMETERS: ${sceneName}`;
    this.container.appendChild(heading);

    for (const param of params) {
      const row = document.createElement("div");
      row.className = "flex items-center gap-3";

      const label = document.createElement("label");
      label.className = "text-sm text-gray-300 w-28 shrink-0";
      label.textContent = param.label;

      row.appendChild(label);

      if (param.type === "number") {
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(param.min);
        input.max = String(param.max);
        input.step = String(param.step);
        input.value = String(param.default);
        input.className = "flex-1 accent-purple-500";

        const valueDisplay = document.createElement("span");
        valueDisplay.className = "text-sm text-gray-400 w-12 text-right tabular-nums";
        valueDisplay.textContent = String(param.default);

        input.addEventListener("input", () => {
          valueDisplay.textContent = input.value;
          this.emitChange();
        });

        row.appendChild(input);
        row.appendChild(valueDisplay);
        this.inputs.set(param.key, input);
      } else if (param.type === "boolean") {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = param.default;
        input.className = "w-5 h-5 accent-purple-500 cursor-pointer";

        input.addEventListener("change", () => {
          this.emitChange();
        });

        row.appendChild(input);
        this.inputs.set(param.key, input);
      } else if (param.type === "select") {
        const select = document.createElement("select");
        select.className = "flex-1 bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm";

        for (const opt of param.options) {
          const option = document.createElement("option");
          option.value = opt;
          option.textContent = opt;
          if (opt === param.default) option.selected = true;
          select.appendChild(option);
        }

        select.addEventListener("change", () => {
          this.emitChange();
        });

        row.appendChild(select);
        this.inputs.set(param.key, select);
      }

      this.container.appendChild(row);
    }

    // Reset button
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset to Defaults";
    resetBtn.className =
      "mt-4 px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded hover:bg-gray-700 transition-colors cursor-pointer";
    resetBtn.addEventListener("click", () => {
      this.resetToDefaults();
      this.onReset();
    });
    this.container.appendChild(resetBtn);
  }

  updateValues(values: ParamValues): void {
    for (const param of this.currentParams) {
      const input = this.inputs.get(param.key);
      if (!input || values[param.key] === undefined) continue;

      if (param.type === "boolean") {
        (input as HTMLInputElement).checked = values[param.key] as boolean;
      } else if (param.type === "number") {
        (input as HTMLInputElement).value = String(values[param.key]);
        const valueDisplay = input.parentElement?.querySelector("span.tabular-nums");
        if (valueDisplay) valueDisplay.textContent = String(values[param.key]);
      } else if (param.type === "select") {
        (input as HTMLSelectElement).value = values[param.key] as string;
      }
    }
  }

  private emitChange(): void {
    const values: ParamValues = {};
    for (const param of this.currentParams) {
      const input = this.inputs.get(param.key);
      if (!input) continue;

      if (param.type === "boolean") {
        values[param.key] = (input as HTMLInputElement).checked;
      } else if (param.type === "number") {
        values[param.key] = parseFloat((input as HTMLInputElement).value);
      } else if (param.type === "select") {
        values[param.key] = (input as HTMLSelectElement).value;
      }
    }
    this.onChange(values);
  }

  private resetToDefaults(): void {
    for (const param of this.currentParams) {
      const input = this.inputs.get(param.key);
      if (!input) continue;

      if (param.type === "boolean") {
        (input as HTMLInputElement).checked = param.default;
      } else if (param.type === "number") {
        (input as HTMLInputElement).value = String(param.default);
        const valueDisplay = input.parentElement?.querySelector("span.tabular-nums");
        if (valueDisplay) valueDisplay.textContent = String(param.default);
      } else if (param.type === "select") {
        (input as HTMLSelectElement).value = param.default;
      }
    }
    this.emitChange();
  }

  dispose(): void {
    this.container.innerHTML = "";
  }
}
