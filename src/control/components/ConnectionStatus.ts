export class ConnectionStatus {
  private dot: HTMLSpanElement;
  private label: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    const container = document.createElement("div");
    container.className = "flex items-center gap-2";

    this.dot = document.createElement("span");
    this.dot.className = "w-3 h-3 rounded-full bg-red-500";

    this.label = document.createElement("span");
    this.label.className = "text-sm text-gray-400";
    this.label.textContent = "Disconnected";

    container.appendChild(this.label);
    container.appendChild(this.dot);
    parent.appendChild(container);
  }

  update(connected: boolean): void {
    this.dot.className = connected
      ? "w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
      : "w-3 h-3 rounded-full bg-red-500";
    this.label.textContent = connected ? "Connected" : "Disconnected";
  }

  dispose(): void {
    // No listeners to clean up
  }
}
