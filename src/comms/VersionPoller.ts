const POLL_INTERVAL_MS = 30_000;

interface VersionData {
  version: string;
  timestamp: number;
}

export class VersionPoller {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private baseline: string | null = null;

  start(onNewVersion: (version: string) => void): void {
    const poll = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = (await res.json()) as VersionData;
        if (!data?.version) return;

        if (this.baseline === null) {
          this.baseline = data.version;
        } else if (data.version !== this.baseline) {
          onNewVersion(data.version);
        }
      } catch {
        // Network error — skip this poll
      }
    };

    void poll();
    this.intervalId = setInterval(() => void poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
