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
