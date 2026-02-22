import { ref, onValue, type Unsubscribe } from "firebase/database";
import { db } from "./config";

export class VersionWatcher {
  private unsubscribe: Unsubscribe | null = null;
  private currentVersion: string | null = null;

  start(onNewVersion: (version: string) => void): void {
    const versionRef = ref(db, "ravespace/version");
    this.unsubscribe = onValue(versionRef, (snapshot) => {
      const version = snapshot.val() as string | null;
      if (version && version !== this.currentVersion) {
        if (this.currentVersion !== null) {
          onNewVersion(version);
        }
        this.currentVersion = version;
      }
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
