import "../index.css";
import { PeerClient } from "../comms/PeerClient";
import type { AudienceMessage, AudienceResponse } from "../comms/messages";

const COOLDOWN_KEY = "ravespace_callout_last";
const COOLDOWN_MS = 60_000; // 1 minute between submissions

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

  // Code entry
  const codeRow = document.createElement("div");
  codeRow.className = "flex gap-2";

  const codeInput = document.createElement("input");
  codeInput.type = "text";
  codeInput.placeholder = "4-digit code";
  codeInput.maxLength = 4;
  codeInput.pattern = "[0-9]*";
  codeInput.inputMode = "numeric";
  codeInput.className =
    "flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-lg text-white text-center tracking-[0.3em] placeholder-gray-500 focus:border-purple-500 focus:outline-none";

  const joinBtn = document.createElement("button");
  joinBtn.textContent = "JOIN";
  joinBtn.className =
    "px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-lg";

  codeRow.append(codeInput, joinBtn);
  card.appendChild(codeRow);

  // Name input (hidden until connected)
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Your name";
  nameInput.maxLength = 30;
  nameInput.className =
    "w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none hidden";
  card.appendChild(nameInput);

  // Submit button (hidden until connected)
  const sendBtn = document.createElement("button");
  sendBtn.textContent = "SEND IT";
  sendBtn.className =
    "w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-lg hidden";
  card.appendChild(sendBtn);

  // Status message
  const status = document.createElement("p");
  status.className = "text-sm text-gray-500 min-h-[1.5em]";
  card.appendChild(status);

  let client: PeerClient<AudienceMessage, AudienceResponse> | null = null;

  joinBtn.addEventListener("click", () => {
    const code = codeInput.value.trim();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      status.textContent = "Enter the 4-digit code from the display";
      status.className = "text-sm text-yellow-400 min-h-[1.5em]";
      return;
    }

    joinBtn.disabled = true;
    joinBtn.textContent = "...";
    status.textContent = "Connecting...";
    status.className = "text-sm text-gray-400 min-h-[1.5em]";

    client = new PeerClient<AudienceMessage, AudienceResponse>("audience", {
      onConnected: () => {
        // Hide code entry, show name input
        codeRow.classList.add("hidden");
        nameInput.classList.remove("hidden");
        sendBtn.classList.remove("hidden");
        status.textContent = "Connected! Enter your name below.";
        status.className = "text-sm text-green-400 min-h-[1.5em]";
      },
      onMessage: (msg) => {
        if (msg.type === "calloutQueued") {
          status.textContent = "Sent! Watch the screen!";
          status.className = "text-sm text-green-400 min-h-[1.5em]";
        } else if (msg.type === "rateLimited") {
          status.textContent = "Please wait before sending again...";
          status.className = "text-sm text-yellow-400 min-h-[1.5em]";
        }
      },
      onError: (err) => {
        if (err.type === "peer-unavailable") {
          status.textContent = "Code not found — is the display running?";
        } else {
          status.textContent = "Connection error — try again";
        }
        status.className = "text-sm text-red-400 min-h-[1.5em]";
        joinBtn.disabled = false;
        joinBtn.textContent = "JOIN";
      },
      onDisconnected: () => {
        status.textContent = "Disconnected from display";
        status.className = "text-sm text-red-400 min-h-[1.5em]";
        sendBtn.classList.add("hidden");
      },
    });

    client.connect(code);
  });

  sendBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      status.textContent = "Enter your name first!";
      status.className = "text-sm text-yellow-400 min-h-[1.5em]";
      return;
    }

    // Local rate limit check (UX hint — actual enforcement is host-side)
    const lastSubmit = parseInt(localStorage.getItem(COOLDOWN_KEY) ?? "0", 10);
    const elapsed = Date.now() - lastSubmit;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      status.textContent = `Wait ${remaining}s before submitting again`;
      status.className = "text-sm text-yellow-400 min-h-[1.5em]";
      return;
    }

    client?.send({ type: "calloutRequest", name });
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    nameInput.value = "";

    // Disable button temporarily
    sendBtn.disabled = true;
    sendBtn.className =
      "w-full py-3 bg-gray-700 text-gray-400 font-bold rounded-lg cursor-not-allowed text-lg";
    setTimeout(() => {
      sendBtn.disabled = false;
      sendBtn.className =
        "w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-lg";
      status.textContent = "";
      status.className = "text-sm text-gray-500 min-h-[1.5em]";
    }, COOLDOWN_MS);
  });

  root.appendChild(card);
}

init();
