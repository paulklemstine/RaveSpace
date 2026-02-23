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
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 300;
    pointer-events: none;
  `;

  const codeEl = document.createElement("div");
  codeEl.textContent = code;
  codeEl.style.cssText = `
    font-family: system-ui, -apple-system, monospace;
    font-size: clamp(4rem, 12vw, 10rem);
    font-weight: 900;
    color: white;
    letter-spacing: 0.3em;
    text-shadow: 0 0 40px rgba(168, 85, 247, 0.6);
  `;

  const hint = document.createElement("div");
  hint.textContent = "Enter this code at /control";
  hint.style.cssText = `
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 1.2rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 1rem;
  `;

  overlay.appendChild(codeEl);
  overlay.appendChild(hint);
  document.body.appendChild(overlay);

  return {
    hide: () => {
      // Shrink to corner instead of removing entirely
      overlay.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 300;
        pointer-events: none;
        transition: all 0.5s ease;
      `;
      codeEl.style.cssText = `
        font-family: system-ui, -apple-system, monospace;
        font-size: 1.5rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.4);
        letter-spacing: 0.2em;
      `;
      hint.style.display = "none";
    },
  };
}
