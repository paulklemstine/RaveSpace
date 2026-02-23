import "../index.css";
import { ControlPanel } from "./ControlPanel";
import { PeerClient } from "../comms/PeerClient";
import type { ControlMessage, DisplayMessage } from "../comms/messages";

const root = document.getElementById("control-root")!;

function showConnectScreen() {
  root.className = "flex items-center justify-center min-h-screen p-4";

  const card = document.createElement("div");
  card.className = "w-full max-w-sm bg-gray-900 rounded-2xl p-8 text-center space-y-6";

  const title = document.createElement("h1");
  title.textContent = "RAVESPACE CONTROL";
  title.className = "text-2xl font-bold tracking-[0.3em] text-purple-400";
  card.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.textContent = "Enter the code shown on the display";
  subtitle.className = "text-gray-400 text-sm";
  card.appendChild(subtitle);

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "4-digit code";
  input.maxLength = 4;
  input.pattern = "[0-9]*";
  input.inputMode = "numeric";
  input.className =
    "w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-2xl text-white text-center tracking-[0.5em] placeholder-gray-500 focus:border-purple-500 focus:outline-none";
  card.appendChild(input);

  const btn = document.createElement("button");
  btn.textContent = "CONNECT";
  btn.className =
    "w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-lg";
  card.appendChild(btn);

  const status = document.createElement("p");
  status.className = "text-sm text-gray-500 min-h-[1.5em]";
  card.appendChild(status);

  root.appendChild(card);

  const connect = () => {
    const code = input.value.trim();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      status.textContent = "Enter a 4-digit code";
      status.className = "text-sm text-yellow-400 min-h-[1.5em]";
      return;
    }

    btn.disabled = true;
    btn.textContent = "CONNECTING...";
    status.textContent = "";

    let panel: ControlPanel | null = null;

    const client = new PeerClient<ControlMessage, DisplayMessage>("controller", {
      onConnected: () => {
        // Clear connect screen, build control panel
        root.innerHTML = "";
        root.className = "";
        panel = new ControlPanel(root, (msg) => client.send(msg));
        panel.init();
      },
      onMessage: (msg) => {
        panel?.handleDisplayMessage(msg);
      },
      onError: (err) => {
        if (err.type === "peer-unavailable") {
          status.textContent = "Code not found — is the display running?";
          status.className = "text-sm text-red-400 min-h-[1.5em]";
          btn.disabled = false;
          btn.textContent = "CONNECT";
        } else {
          console.error("[Control] peer error:", err);
          status.textContent = "Connection error — try again";
          status.className = "text-sm text-red-400 min-h-[1.5em]";
          btn.disabled = false;
          btn.textContent = "CONNECT";
        }
      },
      onDisconnected: () => {
        // Show disconnect banner over existing panel
        const banner = document.createElement("div");
        banner.className =
          "fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 text-sm font-bold z-50";
        banner.textContent = "Disconnected from display";
        document.body.appendChild(banner);
      },
    });

    client.connect(code);
  };

  btn.addEventListener("click", connect);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") connect();
  });
}

showConnectScreen();
