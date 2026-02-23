import "../index.css";
import { PeerClient } from "../comms/PeerClient";
import type { ControlMessage, DisplayMessage } from "../comms/messages";
import { ControlPanel } from "./ControlPanel";
import { VersionPoller } from "../comms/VersionPoller";

const STORAGE_AUTO_UPDATE = "ravespace_control_update";

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

const root = document.getElementById("control-root")!;

// Show connect screen
root.className = "flex flex-col items-center justify-center min-h-screen bg-black";

const title = document.createElement("h1");
title.textContent = "RAVESPACE CONTROL";
title.className = "text-2xl font-bold text-white tracking-[0.2em] mb-8";
root.appendChild(title);

const form = document.createElement("div");
form.className = "flex flex-col items-center gap-4";

const label = document.createElement("label");
label.textContent = "Enter display code:";
label.className = "text-gray-400 text-sm tracking-wider";
form.appendChild(label);

const input = document.createElement("input");
input.type = "text";
input.maxLength = 4;
input.pattern = "[0-9]{4}";
input.inputMode = "numeric";
input.placeholder = "0000";
input.className =
  "text-center text-4xl font-bold tracking-[0.5em] bg-gray-900 border-2 border-gray-700 rounded-lg px-6 py-4 text-white w-48 focus:border-purple-500 focus:outline-none";
form.appendChild(input);

const connectBtn = document.createElement("button");
connectBtn.textContent = "CONNECT";
connectBtn.className =
  "px-8 py-3 text-sm font-bold tracking-widest rounded bg-purple-600 hover:bg-purple-500 transition-colors cursor-pointer text-white";
form.appendChild(connectBtn);

const errorEl = document.createElement("p");
errorEl.className = "text-red-400 text-sm min-h-[1.5em]";
form.appendChild(errorEl);

root.appendChild(form);

let panel: ControlPanel | null = null;

function doConnect(): void {
  const code = input.value.trim();
  if (code.length !== 4 || !/^\d{4}$/.test(code)) {
    errorEl.textContent = "Enter a 4-digit code";
    return;
  }
  errorEl.textContent = "Connecting...";
  connectBtn.style.opacity = "0.5";
  connectBtn.style.pointerEvents = "none";

  const client = new PeerClient<ControlMessage, DisplayMessage>("controller", {
    onConnected() {
      // Clear connect screen, show control panel
      root.innerHTML = "";
      root.className = "max-w-5xl mx-auto p-4";
      panel = new ControlPanel(root, (msg) => client.send(msg));
      panel.init();
    },
    onMessage(msg) {
      panel?.handleDisplayMessage(msg);
    },
    onDisconnected() {
      // Show disconnect banner
      const banner = document.createElement("div");
      banner.className =
        "fixed top-0 left-0 right-0 py-2 text-center text-sm font-bold bg-red-900/80 text-red-200 z-50";
      banner.textContent = "Disconnected from display";
      document.body.appendChild(banner);
    },
    onError(err) {
      if (err.type === "peer-unavailable") {
        errorEl.textContent = "Code not found — is the display running?";
      } else {
        errorEl.textContent = `Connection error: ${err.message}`;
      }
      connectBtn.style.opacity = "1";
      connectBtn.style.pointerEvents = "auto";
    },
  });

  client.connect(code);
}

connectBtn.addEventListener("click", doConnect);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doConnect();
});

// Version poller for auto-reload
const versionPoller = new VersionPoller();
versionPoller.start((version) => {
  console.log(`New version detected: ${version}, reloading control panel...`);
  fadeOutAndReload();
});
