import { ANIMATION_STYLES, type AnimationStyleName } from "../../engine/callout-animations";
import type { CalloutQueueItem } from "../../comms/messages";

export class CalloutPanel {
  private queue: CalloutQueueItem[] = [];
  private queueListEl: HTMLDivElement;
  private manualInput: HTMLInputElement;
  private autoShowCheck: HTMLInputElement;
  private intervalInput: HTMLInputElement;
  private animStyleSelect: HTMLSelectElement;
  private aiPhrasesCheck: HTMLInputElement;
  private aiIntervalInput: HTMLInputElement;
  private autoShowTimer: ReturnType<typeof setInterval> | null = null;
  private onShowCallout: (name: string, duration: number, animationStyle?: AnimationStyleName) => void;
  private onSettingsChange: (settings: { autoShow: boolean; interval: number; aiPhrasesEnabled: boolean; aiPhraseInterval: number }) => void;
  private onShowNext: () => void;
  private onClearQueue: () => void;
  private onRemoveFromQueue: (id: string) => void;

  constructor(
    parent: HTMLElement,
    callbacks: {
      onShowCallout: (name: string, duration: number, animationStyle?: AnimationStyleName) => void;
      onSettingsChange: (settings: { autoShow: boolean; interval: number; aiPhrasesEnabled: boolean; aiPhraseInterval: number }) => void;
      onShowNext: () => void;
      onClearQueue: () => void;
      onRemoveFromQueue: (id: string) => void;
    },
  ) {
    this.onShowCallout = callbacks.onShowCallout;
    this.onSettingsChange = callbacks.onSettingsChange;
    this.onShowNext = callbacks.onShowNext;
    this.onClearQueue = callbacks.onClearQueue;
    this.onRemoveFromQueue = callbacks.onRemoveFromQueue;

    const section = document.createElement("div");
    section.className = "space-y-3";

    const heading = document.createElement("h2");
    heading.className = "text-xs font-bold text-gray-500 tracking-widest mb-3";
    heading.textContent = "CALLOUTS";
    section.appendChild(heading);

    // Manual text input + animation style row
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

    // Animation style dropdown
    const styleRow = document.createElement("div");
    styleRow.className = "flex items-center gap-2";
    const styleLabel = document.createElement("span");
    styleLabel.className = "text-xs text-gray-500";
    styleLabel.textContent = "Animation:";
    this.animStyleSelect = document.createElement("select");
    this.animStyleSelect.className =
      "bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white cursor-pointer";

    const randomOpt = document.createElement("option");
    randomOpt.value = "random";
    randomOpt.textContent = "Random";
    this.animStyleSelect.appendChild(randomOpt);

    for (const style of ANIMATION_STYLES) {
      const opt = document.createElement("option");
      opt.value = style;
      opt.textContent = style;
      this.animStyleSelect.appendChild(opt);
    }
    styleRow.append(styleLabel, this.animStyleSelect);
    section.appendChild(styleRow);

    // Queue section
    const queueHeader = document.createElement("div");
    queueHeader.className = "flex items-center justify-between";
    const queueTitle = document.createElement("span");
    queueTitle.className = "text-xs text-gray-500";
    queueTitle.textContent = "AUDIENCE QUEUE";

    const queueBtns = document.createElement("div");
    queueBtns.className = "flex gap-2";

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Show Next";
    nextBtn.className =
      "text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors cursor-pointer";
    nextBtn.addEventListener("click", () => this.onShowNext());

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear All";
    clearBtn.className =
      "text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800/50 text-red-400 transition-colors cursor-pointer";
    clearBtn.addEventListener("click", () => this.onClearQueue());

    queueBtns.append(nextBtn, clearBtn);
    queueHeader.append(queueTitle, queueBtns);
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
    this.autoShowCheck.addEventListener("change", () => this.updateSettings());
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
    this.intervalInput.addEventListener("change", () => this.updateSettings());
    const secLabel = document.createElement("span");
    secLabel.className = "text-sm text-gray-400";
    secLabel.textContent = "s";

    autoRow.append(autoLabel, intervalLabel, this.intervalInput, secLabel);
    section.appendChild(autoRow);

    // AI Phrases settings
    const aiRow = document.createElement("div");
    aiRow.className = "flex items-center gap-3 mt-2";

    const aiLabel = document.createElement("label");
    aiLabel.className = "flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer";
    this.aiPhrasesCheck = document.createElement("input");
    this.aiPhrasesCheck.type = "checkbox";
    this.aiPhrasesCheck.className = "accent-cyan-500 cursor-pointer";
    this.aiPhrasesCheck.addEventListener("change", () => this.updateSettings());
    const aiText = document.createElement("span");
    aiText.textContent = "AI Phrases";
    aiLabel.append(this.aiPhrasesCheck, aiText);

    const aiIntervalLabel = document.createElement("label");
    aiIntervalLabel.className = "text-sm text-gray-400";
    aiIntervalLabel.textContent = "every";
    this.aiIntervalInput = document.createElement("input");
    this.aiIntervalInput.type = "number";
    this.aiIntervalInput.min = "15";
    this.aiIntervalInput.max = "300";
    this.aiIntervalInput.value = "45";
    this.aiIntervalInput.className =
      "w-14 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center";
    this.aiIntervalInput.addEventListener("change", () => this.updateSettings());
    const aiSecLabel = document.createElement("span");
    aiSecLabel.className = "text-sm text-gray-400";
    aiSecLabel.textContent = "s";

    aiRow.append(aiLabel, aiIntervalLabel, this.aiIntervalInput, aiSecLabel);
    section.appendChild(aiRow);

    // QR hint
    const qrHint = document.createElement("div");
    qrHint.className = "text-xs text-gray-600 mt-2";
    qrHint.textContent = "Audience submits at /audience";
    section.appendChild(qrHint);

    parent.appendChild(section);
  }

  updateQueue(queue: CalloutQueueItem[]): void {
    this.queue = queue;
    this.renderQueue();
  }

  updateSettings(fromSync?: { autoShow: boolean; interval: number; aiPhrasesEnabled: boolean; aiPhraseInterval: number }): void {
    if (fromSync) {
      this.autoShowCheck.checked = fromSync.autoShow;
      this.intervalInput.value = String(fromSync.interval);
      this.aiPhrasesCheck.checked = fromSync.aiPhrasesEnabled;
      this.aiIntervalInput.value = String(fromSync.aiPhraseInterval);
      this.setupAutoShow();
      return;
    }

    const settings = {
      autoShow: this.autoShowCheck.checked,
      interval: parseInt(this.intervalInput.value, 10) || 30,
      aiPhrasesEnabled: this.aiPhrasesCheck.checked,
      aiPhraseInterval: parseInt(this.aiIntervalInput.value, 10) || 45,
    };
    this.onSettingsChange(settings);
    this.setupAutoShow();
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
      nameSpan.className = "truncate flex-1";
      nameSpan.textContent = item.name;

      const btnGroup = document.createElement("div");
      btnGroup.className = "flex gap-2 ml-2 shrink-0";

      const showBtn = document.createElement("button");
      showBtn.textContent = "Show";
      showBtn.className = "text-xs text-purple-400 hover:text-purple-300 cursor-pointer";
      showBtn.addEventListener("click", () => {
        this.showCallout(item.name);
        this.onRemoveFromQueue(item.id);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "\u2715";
      deleteBtn.className = "text-xs text-red-500 hover:text-red-400 cursor-pointer";
      deleteBtn.title = "Delete";
      deleteBtn.addEventListener("click", () => {
        this.onRemoveFromQueue(item.id);
      });

      btnGroup.append(showBtn, deleteBtn);
      row.append(nameSpan, btnGroup);
      this.queueListEl.appendChild(row);
    }
  }

  private showCallout(name: string): void {
    const selectedStyle = this.animStyleSelect.value;
    const animationStyle = selectedStyle === "random"
      ? undefined
      : selectedStyle as AnimationStyleName;
    this.onShowCallout(name, 5, animationStyle);
  }

  private setupAutoShow(): void {
    if (this.autoShowTimer) {
      clearInterval(this.autoShowTimer);
      this.autoShowTimer = null;
    }
    if (this.autoShowCheck.checked) {
      const interval = (parseInt(this.intervalInput.value, 10) || 30) * 1000;
      this.autoShowTimer = setInterval(() => this.onShowNext(), interval);
    }
  }

  dispose(): void {
    if (this.autoShowTimer) {
      clearInterval(this.autoShowTimer);
    }
  }
}
