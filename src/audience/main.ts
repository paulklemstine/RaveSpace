import "../index.css";
import { ref, push } from "firebase/database";
import { db } from "../firebase/config";
import { VersionWatcher } from "../firebase/VersionWatcher";

const COOLDOWN_KEY = "ravespace_callout_last";
const COOLDOWN_MS = 60_000; // 1 minute between submissions
const STORAGE_AUTO_UPDATE = "ravespace_audience_update";

function applyFadeIn(): void {
  if (sessionStorage.getItem(STORAGE_AUTO_UPDATE) === "true") {
    sessionStorage.removeItem(STORAGE_AUTO_UPDATE);
    document.body.style.opacity = "0";
    document.body.style.transition = "opacity 300ms ease-in";
    requestAnimationFrame(() => {
      document.body.style.opacity = "1";
    });
  }
}

function fadeOutAndReload(): void {
  document.body.style.transition = "opacity 300ms ease-out";
  document.body.style.opacity = "0";
  setTimeout(() => {
    sessionStorage.setItem(STORAGE_AUTO_UPDATE, "true");
    window.location.reload();
  }, 300);
}

applyFadeIn();

function init() {
  const root = document.getElementById("audience-root")!;
  root.className = "flex items-center justify-center min-h-screen p-4";

  const card = document.createElement("div");
  card.className = "w-full max-w-sm bg-gray-900 rounded-2xl p-8 text-center space-y-6";

  // Logo / title
  const title = document.createElement("h1");
  title.textContent = "RAVESPACE";
  title.className = "text-2xl font-bold tracking-[0.3em] text-purple-400";
  card.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.textContent = "Get a shoutout on the big screen!";
  subtitle.className = "text-gray-400 text-sm";
  card.appendChild(subtitle);

  // Name input
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Your name";
  input.maxLength = 30;
  input.className =
    "w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none";
  card.appendChild(input);

  // Submit button
  const btn = document.createElement("button");
  btn.textContent = "SEND IT";
  btn.className =
    "w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-lg";
  card.appendChild(btn);

  // Status message
  const status = document.createElement("p");
  status.className = "text-sm text-gray-500 min-h-[1.5em]";
  card.appendChild(status);

  btn.addEventListener("click", () => {
    const name = input.value.trim();
    if (!name) {
      status.textContent = "Enter your name first!";
      status.className = "text-sm text-yellow-400 min-h-[1.5em]";
      return;
    }

    // Rate limit check
    const lastSubmit = parseInt(localStorage.getItem(COOLDOWN_KEY) ?? "0", 10);
    const elapsed = Date.now() - lastSubmit;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      status.textContent = `Wait ${remaining}s before submitting again`;
      status.className = "text-sm text-yellow-400 min-h-[1.5em]";
      return;
    }

    // Push to queue
    const queueRef = ref(db, "ravespace/callouts/queue");
    void push(queueRef, {
      name,
      timestamp: Date.now(),
    });

    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    input.value = "";
    status.textContent = "Sent! Watch the screen!";
    status.className = "text-sm text-green-400 min-h-[1.5em]";

    // Disable button temporarily
    btn.disabled = true;
    btn.className =
      "w-full py-3 bg-gray-700 text-gray-400 font-bold rounded-lg cursor-not-allowed text-lg";
    setTimeout(() => {
      btn.disabled = false;
      btn.className =
        "w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-lg";
      status.textContent = "";
      status.className = "text-sm text-gray-500 min-h-[1.5em]";
    }, COOLDOWN_MS);
  });

  root.appendChild(card);
}

init();

const versionWatcher = new VersionWatcher();
versionWatcher.start((version) => {
  console.log(`New version detected: ${version}, reloading audience page...`);
  fadeOutAndReload();
});
