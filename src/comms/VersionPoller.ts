const POLL_INTERVAL_MS = 30_000;

export class VersionPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private baseline: string | null = null;

  start(onNewVersion: (version: string) => void): void {
    const poll = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        const version = data.version;
        if (!version) return;

        if (this.baseline === null) {
          this.baseline = version;
        } else if (version !== this.baseline) {
          onNewVersion(version);
        }
      } catch {
        // Network error — skip
      }
    };

    void poll();
    this.timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
