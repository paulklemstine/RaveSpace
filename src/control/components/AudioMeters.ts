interface AudioData {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
}

export class AudioMeters {
  private bars: { bar: HTMLDivElement; label: string }[] = [];

  constructor(parent: HTMLElement) {
    const section = document.createElement("div");
    section.className = "space-y-2";

    const heading = document.createElement("h2");
    heading.textContent = "AUDIO";
    heading.className = "text-xs font-bold text-gray-500 tracking-widest mb-3";
    section.appendChild(heading);

    const metersContainer = document.createElement("div");
    metersContainer.className = "flex gap-2 items-end h-24";

    const bands = [
      { label: "B", color: "bg-red-500" },
      { label: "M", color: "bg-yellow-500" },
      { label: "T", color: "bg-blue-500" },
      { label: "E", color: "bg-white" },
    ];

    for (const band of bands) {
      const col = document.createElement("div");
      col.className = "flex flex-col items-center gap-1 flex-1";

      const barContainer = document.createElement("div");
      barContainer.className = "w-full h-20 bg-gray-800 rounded overflow-hidden flex items-end";

      const bar = document.createElement("div");
      bar.className = `w-full ${band.color} transition-all duration-75 rounded-t`;
      bar.style.height = "0%";

      barContainer.appendChild(bar);

      const label = document.createElement("span");
      label.className = "text-xs text-gray-500";
      label.textContent = band.label;

      col.appendChild(barContainer);
      col.appendChild(label);
      metersContainer.appendChild(col);

      this.bars.push({ bar, label: band.label });
    }

    section.appendChild(metersContainer);
    parent.appendChild(section);
  }

  update(data: AudioData): void {
    const values = [data.bass, data.mid, data.treble, data.energy];
    for (let i = 0; i < this.bars.length; i++) {
      const pct = Math.min(100, (values[i] ?? 0) * 100);
      this.bars[i]!.bar.style.height = `${pct}%`;
    }
  }

  dispose(): void {
    // Cleaned up with parent
  }
}
