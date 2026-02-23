interface QueueItem {
  id: number;
  name: string;
  timestamp: number;
}

export class CalloutPanel {
  private queue: QueueItem[] = [];
  private nextId = 1;
  private queueListEl: HTMLDivElement;
  private manualInput: HTMLInputElement;
  private autoShowCheck: HTMLInputElement;
  private intervalInput: HTMLInputElement;
  private autoShowTimer: ReturnType<typeof setInterval> | null = null;
  private onShowCallout: (name: string, duration: number) => void;

  constructor(
    parent: HTMLElement,
    onShowCallout: (name: string, duration: number) => void,
  ) {
    this.onShowCallout = onShowCallout;

    const section = document.createElement("div");
    section.className = "space-y-3";

    const heading = document.createElement("h2");
    heading.className = "text-xs font-bold text-gray-500 tracking-widest mb-3";
    heading.textContent = "CALLOUTS";
    section.appendChild(heading);

    // Manual text input
    const manualRow = document.createElement("div");
    manualRow.className = "flex gap-2";
    this.manualInput = document.createElement("input");
    this.manualInput.type = "text";
    this.manualInput.placeholder = "Type a shoutout...";
    this.manualInput.maxLength = 30;
    this.manualInput.className =
      "flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none";

    const sendBtn = document.createElement("button");
    sendBtn.textContent = "SHOW";
    sendBtn.className =
      "px-4 py-2 text-sm font-bold rounded bg-purple-600 hover:bg-purple-500 transition-colors cursor-pointer";
    sendBtn.addEventListener("click", () => {
      const name = this.manualInput.value.trim();
      if (name) {
        this.showCallout(name);
        this.manualInput.value = "";
      }
    });
    manualRow.append(this.manualInput, sendBtn);
    section.appendChild(manualRow);

    // Queue section
    const queueHeader = document.createElement("div");
    queueHeader.className = "flex items-center justify-between";
    const queueTitle = document.createElement("span");
    queueTitle.className = "text-xs text-gray-500";
    queueTitle.textContent = "AUDIENCE QUEUE";

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Show Next";
    nextBtn.className =
      "text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors cursor-pointer";
    nextBtn.addEventListener("click", () => this.showNext());

    queueHeader.append(queueTitle, nextBtn);
    section.appendChild(queueHeader);

    this.queueListEl = document.createElement("div");
    this.queueListEl.className = "space-y-1 max-h-32 overflow-y-auto text-sm text-gray-400";
    this.queueListEl.textContent = "No submissions yet";
    section.appendChild(this.queueListEl);

    // Auto-show settings
    const autoRow = document.createElement("div");
    autoRow.className = "flex items-center gap-3 mt-2";

    const autoLabel = document.createElement("label");
    autoLabel.className = "flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer";
    this.autoShowCheck = document.createElement("input");
    this.autoShowCheck.type = "checkbox";
    this.autoShowCheck.className = "accent-purple-500 cursor-pointer";
    this.autoShowCheck.addEventListener("change", () => this.setupAutoShow());
    const autoText = document.createElement("span");
    autoText.textContent = "Auto-show";
    autoLabel.append(this.autoShowCheck, autoText);

    const intervalLabel = document.createElement("label");
    intervalLabel.className = "text-sm text-gray-400";
    intervalLabel.textContent = "every";
    this.intervalInput = document.createElement("input");
    this.intervalInput.type = "number";
    this.intervalInput.min = "10";
    this.intervalInput.max = "120";
    this.intervalInput.value = "30";
    this.intervalInput.className =
      "w-14 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center";
    this.intervalInput.addEventListener("change", () => this.setupAutoShow());
    const secLabel = document.createElement("span");
    secLabel.className = "text-sm text-gray-400";
    secLabel.textContent = "s";

    autoRow.append(autoLabel, intervalLabel, this.intervalInput, secLabel);
    section.appendChild(autoRow);

    // QR hint
    const qrHint = document.createElement("div");
    qrHint.className = "text-xs text-gray-600 mt-2";
    qrHint.textContent = "Audience submits at /audience";
    section.appendChild(qrHint);

    parent.appendChild(section);
  }

  /** Add an audience submission to the queue (called from display relay) */
  addToQueue(name: string): void {
    this.queue.push({
      id: this.nextId++,
      name,
      timestamp: Date.now(),
    });
    this.renderQueue();
  }

  private renderQueue(): void {
    if (this.queue.length === 0) {
      this.queueListEl.textContent = "No submissions yet";
      return;
    }
    this.queueListEl.innerHTML = "";
    for (const item of this.queue.slice(-10)) {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between px-2 py-1 bg-gray-800/50 rounded";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = item.name;
      const showBtn = document.createElement("button");
      showBtn.textContent = "Show";
      showBtn.className = "text-xs text-purple-400 hover:text-purple-300 cursor-pointer";
      showBtn.addEventListener("click", () => {
        this.showCallout(item.name);
        this.removeFromQueue(item.id);
      });
      row.append(nameSpan, showBtn);
      this.queueListEl.appendChild(row);
    }
  }

  private showCallout(name: string): void {
    this.onShowCallout(name, 5);
  }

  private showNext(): void {
    if (this.queue.length === 0) return;
    const next = this.queue.shift()!;
    this.showCallout(next.name);
    this.renderQueue();
  }

  private removeFromQueue(id: number): void {
    this.queue = this.queue.filter((item) => item.id !== id);
    this.renderQueue();
  }

  private setupAutoShow(): void {
    if (this.autoShowTimer) {
      clearInterval(this.autoShowTimer);
      this.autoShowTimer = null;
    }
    if (this.autoShowCheck.checked) {
      const interval = (parseInt(this.intervalInput.value, 10) || 30) * 1000;
      this.autoShowTimer = setInterval(() => this.showNext(), interval);
    }
  }

  dispose(): void {
    if (this.autoShowTimer) {
      clearInterval(this.autoShowTimer);
    }
  }
}
