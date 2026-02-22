import { ref, onValue, remove, type Unsubscribe } from "firebase/database";
import { db } from "../firebase/config";

interface ActiveCallout {
  name: string;
  startTime: number;
  duration: number;
}

/**
 * Animated text overlay that shows audience shoutouts on the display.
 * Listens to RTDB for active callout and renders animated text.
 */
export class CalloutOverlay {
  private el: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private unsubscribe: Unsubscribe | null = null;
  private animationTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 200;
    `;

    this.nameEl = document.createElement("div");
    this.nameEl.style.cssText = `
      font-family: system-ui, -apple-system, sans-serif;
      font-size: clamp(3rem, 8vw, 8rem);
      font-weight: 900;
      color: white;
      text-shadow: 0 0 40px rgba(168, 85, 247, 0.8), 0 0 80px rgba(168, 85, 247, 0.4);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0;
      transform: scale(0.5);
      transition: opacity 0.4s ease-out, transform 0.4s ease-out;
    `;
    this.el.appendChild(this.nameEl);
    document.body.appendChild(this.el);
  }

  start(): void {
    const activeRef = ref(db, "ravespace/callouts/active");
    this.unsubscribe = onValue(activeRef, (snapshot) => {
      const data = snapshot.val() as ActiveCallout | null;
      if (data?.name) {
        this.show(data.name, data.duration ?? 5);
      }
    });
  }

  private show(name: string, duration: number): void {
    // Clear any pending hide
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }

    this.nameEl.textContent = name;

    // Animate in
    requestAnimationFrame(() => {
      this.nameEl.style.opacity = "1";
      this.nameEl.style.transform = "scale(1)";
    });

    // Animate out after duration
    this.animationTimeout = setTimeout(() => {
      this.nameEl.style.opacity = "0";
      this.nameEl.style.transform = "scale(1.2)";

      // Clear active callout after fade out
      setTimeout(() => {
        void remove(ref(db, "ravespace/callouts/active"));
      }, 500);
    }, duration * 1000);
  }

  dispose(): void {
    this.unsubscribe?.();
    if (this.animationTimeout) clearTimeout(this.animationTimeout);
    this.el.remove();
  }
}
