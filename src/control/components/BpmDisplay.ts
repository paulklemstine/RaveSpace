export class BpmDisplay {
  private bpmValue: HTMLSpanElement;
  private beatDot: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    const container = document.createElement("div");
    container.className = "flex items-center gap-2 mt-2";

    const label = document.createElement("span");
    label.className = "text-xs text-gray-500";
    label.textContent = "BPM:";

    this.bpmValue = document.createElement("span");
    this.bpmValue.className = "text-lg font-bold text-white tabular-nums";
    this.bpmValue.textContent = "---";

    this.beatDot = document.createElement("span");
    this.beatDot.className = "w-3 h-3 rounded-full bg-gray-700 transition-colors duration-75";

    container.appendChild(label);
    container.appendChild(this.bpmValue);
    container.appendChild(this.beatDot);
    parent.appendChild(container);
  }

  update(bpm: number, beat: boolean): void {
    this.bpmValue.textContent = bpm > 0 ? String(Math.round(bpm)) : "---";
    this.beatDot.className = beat
      ? "w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] transition-colors duration-75"
      : "w-3 h-3 rounded-full bg-gray-700 transition-colors duration-75";
  }

  dispose(): void {
    // Cleaned up with parent
  }
}
