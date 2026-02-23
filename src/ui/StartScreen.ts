export function showStartScreen(): Promise<void> {
  return new Promise((resolve) => {
    const root = document.getElementById("ui-root")!;

    const overlay = document.createElement("div");
    overlay.className =
      "flex flex-col items-center justify-center w-full h-full bg-black";

    const title = document.createElement("h1");
    title.textContent = "RAVESPACE";
    title.className =
      "text-6xl font-bold text-white tracking-[0.3em] mb-12 select-none";

    const button = document.createElement("button");
    button.textContent = "Start Show";
    button.className =
      "px-8 py-4 text-lg font-semibold text-black bg-white rounded-full hover:bg-gray-200 transition-colors cursor-pointer";

    button.addEventListener("click", async () => {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Fullscreen denied — continue anyway
      }
      root.removeChild(overlay);
      resolve();
    });

    overlay.appendChild(title);
    overlay.appendChild(button);
    root.appendChild(overlay);
  });
}

export function showPairingCode(code: string): { hide: () => void } {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:500;background:rgba(0,0,0,0.85);pointer-events:none;transition:opacity 0.5s ease;";

  const label = document.createElement("div");
  label.textContent = "ENTER THIS CODE AT /control";
  label.style.cssText =
    "color:rgba(255,255,255,0.5);font-size:1rem;letter-spacing:0.2em;margin-bottom:1rem;font-family:system-ui,sans-serif;";
  overlay.appendChild(label);

  const codeEl = document.createElement("div");
  codeEl.textContent = code;
  codeEl.style.cssText =
    "color:#fff;font-size:6rem;font-weight:900;letter-spacing:0.4em;font-family:'Impact','Arial Black',system-ui,sans-serif;text-shadow:0 0 30px rgba(0,255,255,0.5),0 0 60px rgba(255,0,255,0.3);";
  overlay.appendChild(codeEl);

  const hint = document.createElement("div");
  hint.textContent = "Waiting for controller...";
  hint.style.cssText =
    "color:rgba(255,255,255,0.3);font-size:0.875rem;margin-top:1.5rem;font-family:system-ui,sans-serif;";
  overlay.appendChild(hint);

  document.body.appendChild(overlay);

  return {
    hide() {
      overlay.style.opacity = "0";
      overlay.addEventListener("transitionend", () => overlay.remove());
    },
  };
}
