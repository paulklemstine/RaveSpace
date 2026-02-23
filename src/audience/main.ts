import "../index.css";
import { PeerClient } from "../comms/PeerClient";
import type { AudienceMessage, AudienceResponse } from "../comms/messages";
import { VersionPoller } from "../comms/VersionPoller";

// ─── Constants ──────────────────────────────────────────────

const SHOUTOUT_COOLDOWN_MS = 60_000;
const TAP_INTERVAL_MS = 80;
const TAP_REPORT_MS = 400;
const REACTION_COOLDOWN_MS = 400;
const DEVICE_ID = getOrCreateDeviceId();

const EMOJIS = ["🔥", "⚡", "💀", "👽", "❤️‍🔥", "✨", "💥", "🎵"] as const;

// ─── Audio Telemetry (received from display) ────────────────

interface ReceivedTelemetry {
  energy: number;
  bass: number;
  mid: number;
  treble: number;
  beat: boolean;
  bpm: number;
  kick: number;
  beatIntensity: number;
  crowdEnergy: number;
  connectedCount: number;
}

let audioTelemetry: ReceivedTelemetry | null = null;
let lastBeatState = false;

// Emoji combo tracking
let comboEmoji = "";
let comboCount = 0;
let comboTimer: ReturnType<typeof setTimeout> | null = null;
const COMBO_WINDOW_MS = 1500;

const NEON_COLORS = [
  { label: "Pink", hex: "#ff00ff", hue: 300 },
  { label: "Cyan", hex: "#00ffff", hue: 180 },
  { label: "Lime", hex: "#00ff88", hue: 150 },
  { label: "Purple", hex: "#8800ff", hue: 270 },
  { label: "Orange", hex: "#ff6600", hue: 25 },
  { label: "Blue", hex: "#0066ff", hue: 220 },
  { label: "Red", hex: "#ff0044", hue: 350 },
  { label: "Yellow", hex: "#ffff00", hue: 60 },
] as const;

type TabId = "energy" | "react" | "colors" | "shoutout";

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: "energy", icon: "⚡", label: "ENERGY" },
  { id: "react", icon: "✨", label: "REACT" },
  { id: "colors", icon: "🎨", label: "COLORS" },
  { id: "shoutout", icon: "📣", label: "SHOUT" },
];

// ─── PeerClient reference ────────────────────────────────────

let client: PeerClient<AudienceMessage, AudienceResponse> | null = null;

function sendMsg(msg: AudienceMessage): void {
  client?.send(msg);
}

// ─── Utilities ──────────────────────────────────────────────

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem("ravespace_device_id");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("ravespace_device_id", id);
  }
  return id;
}

function haptic(ms = 25): void {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

// ─── Custom CSS ─────────────────────────────────────────────

function injectStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 25px var(--glow-color, rgba(0,255,255,0.3)); }
      50% { box-shadow: 0 0 50px var(--glow-color, rgba(0,255,255,0.6)), 0 0 80px var(--glow-color, rgba(0,255,255,0.2)); }
    }
    @keyframes tap-ripple {
      0% { transform: scale(0.5); opacity: 0.7; }
      100% { transform: scale(3); opacity: 0; }
    }
    @keyframes btn-press {
      0% { transform: scale(1); }
      50% { transform: scale(0.88); }
      100% { transform: scale(1); }
    }
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes counter-pop {
      0% { transform: scale(1); }
      50% { transform: scale(1.3); }
      100% { transform: scale(1); }
    }
    @keyframes gradient-shift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes energy-bar-glow {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.4); }
    }
    .tab-panel { display: none; animation: slide-up 0.25s ease-out; }
    .tab-panel.active { display: flex; }
    .nav-btn { transition: all 0.15s ease; }
    .nav-btn.active { color: #00ffff; }
    .nav-btn.active::after {
      content: '';
      display: block;
      width: 100%;
      height: 2px;
      background: #00ffff;
      border-radius: 1px;
      margin-top: 2px;
      box-shadow: 0 0 8px rgba(0,255,255,0.6);
    }
    .energy-btn {
      animation: pulse-glow 2s ease-in-out infinite;
      --glow-color: rgba(0,255,255,0.4);
      transition: transform 0.08s ease;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      touch-action: manipulation;
    }
    .energy-btn:active { transform: scale(0.92); }
    .emoji-btn {
      transition: transform 0.1s ease;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      touch-action: manipulation;
    }
    .emoji-btn:active { animation: btn-press 0.15s ease; }
    .color-swatch {
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .color-swatch.selected {
      transform: scale(1.15);
      box-shadow: 0 0 0 3px #fff, 0 0 20px var(--swatch-color);
    }
    .crowd-bar-fill {
      transition: width 0.5s ease-out;
      animation: energy-bar-glow 1.5s ease-in-out infinite;
    }
    .counter-pop { animation: counter-pop 0.2s ease; }
    .gradient-bg {
      background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2a 50%, #0a1a2a 100%);
      background-size: 200% 200%;
      animation: gradient-shift 8s ease infinite;
    }
    @keyframes beat-flash {
      0% { background-color: rgba(255,0,255,0.15); }
      100% { background-color: transparent; }
    }
    @keyframes perfect-timing {
      0% { transform: scale(0.5) translateY(0); opacity: 1; }
      100% { transform: scale(1.5) translateY(-40px); opacity: 0; }
    }
    @keyframes combo-pop {
      0% { transform: scale(0.5); opacity: 0; }
      50% { transform: scale(1.4); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    .beat-flash { animation: beat-flash 0.15s ease-out; }
    .spectrum-bar {
      transition: width 0.18s ease-out;
      border-radius: 2px;
    }
    .bpm-badge {
      font-variant-numeric: tabular-nums;
      animation: pulse-glow 2s ease-in-out infinite;
      --glow-color: rgba(255,0,255,0.3);
    }
    .kick-pulse { transition: transform 0.08s ease; }
  `;
  document.head.appendChild(style);
}

// ─── Join Screen ────────────────────────────────────────────

function buildJoinScreen(root: HTMLElement, onJoin: (code: string) => void): void {
  const container = h("div", "flex flex-col items-center justify-center min-h-screen p-6 gradient-bg");

  const title = h("h1", "text-4xl font-black tracking-[0.25em] mb-2");
  title.style.cssText = `
    background: linear-gradient(90deg, #ff00ff, #00ffff, #ff00ff);
    background-size: 200% 100%;
    animation: gradient-shift 3s ease infinite;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  `;
  title.textContent = "RAVESPACE";
  container.appendChild(title);

  const sub = h("p", "text-gray-400 text-sm mb-8 tracking-wider", "LIVE VISUAL EXPERIENCE");
  container.appendChild(sub);

  // Code entry
  const codeLabel = h("p", "text-gray-400 text-sm mb-2 tracking-wider", "ENTER DISPLAY CODE");
  container.appendChild(codeLabel);

  const codeInput = document.createElement("input");
  codeInput.type = "text";
  codeInput.maxLength = 4;
  codeInput.pattern = "[0-9]{4}";
  codeInput.inputMode = "numeric";
  codeInput.placeholder = "0000";
  codeInput.className = "text-center text-3xl font-bold tracking-[0.5em] bg-transparent rounded-xl px-6 py-3 text-white w-40 focus:outline-none mb-4";
  codeInput.style.cssText += "border: 2px solid rgba(0,255,255,0.3);";
  container.appendChild(codeInput);

  const btn = h("button", "px-12 py-5 rounded-full text-xl font-bold cursor-pointer");
  btn.style.cssText = `
    background: linear-gradient(135deg, #ff00ff, #00ffff);
    color: #000;
    border: none;
    animation: pulse-glow 2s ease-in-out infinite;
    --glow-color: rgba(0,255,255,0.5);
    letter-spacing: 0.1em;
    -webkit-tap-highlight-color: transparent;
  `;
  btn.textContent = "JOIN THE SHOW";

  const errorEl = h("p", "text-red-400 text-sm min-h-[1.5em] mt-2");
  container.appendChild(errorEl);

  const doJoin = () => {
    const code = codeInput.value.trim();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      errorEl.textContent = "Enter a 4-digit code";
      return;
    }
    haptic(50);
    // Request motion permission on iOS
    const dme = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (dme.requestPermission) {
      void dme.requestPermission().then(() => onJoin(code)).catch(() => onJoin(code));
    } else {
      onJoin(code);
    }
  };

  btn.addEventListener("click", doJoin);
  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doJoin();
  });
  container.appendChild(btn);

  const hint = h("p", "text-gray-600 text-xs mt-8", "Enter the code shown on the display");
  container.appendChild(hint);

  root.appendChild(container);
}

// ─── Energy Tab ─────────────────────────────────────────────

function buildEnergyTab(): {
  panel: HTMLElement;
  startTapTracking: () => void;
  audioBars: { bass: HTMLElement; mid: HTMLElement; treble: HTMLElement };
  tapBtn: HTMLElement;
  crowdBarInner: HTMLElement;
  crowdBarLabel: HTMLElement;
} {
  const panel = h("div", "tab-panel flex-col items-center justify-center gap-6 px-4 py-6");

  const label = h("p", "text-gray-400 text-sm tracking-widest uppercase", "Pump up the visuals");
  panel.appendChild(label);

  // Big tap button
  const btnWrap = h("div", "relative flex items-center justify-center");
  const btn = h("div", "energy-btn flex flex-col items-center justify-center rounded-full cursor-pointer");
  btn.style.cssText += `
    width: 180px; height: 180px;
    border: 3px solid rgba(0,255,255,0.6);
    background: radial-gradient(circle, rgba(0,255,255,0.08) 0%, transparent 70%);
  `;
  const btnEmoji = h("span", "text-5xl select-none", "⚡");
  btn.appendChild(btnEmoji);
  const btnText = h("span", "text-cyan-300 text-sm font-bold mt-1 tracking-widest", "TAP!");
  btn.appendChild(btnText);
  btnWrap.appendChild(btn);

  // Ripple container
  const rippleContainer = h("div", "absolute inset-0 pointer-events-none flex items-center justify-center");
  btnWrap.insertBefore(rippleContainer, btn);
  panel.appendChild(btnWrap);

  // Your tap counter
  const counterRow = h("div", "flex items-center gap-2");
  const counterLabel = h("span", "text-gray-500 text-sm", "YOUR TAPS");
  const counterVal = h("span", "text-cyan-300 text-2xl font-black tabular-nums", "0");
  counterRow.appendChild(counterLabel);
  counterRow.appendChild(counterVal);
  panel.appendChild(counterRow);

  // Crowd energy bar
  const barWrap = h("div", "w-full max-w-xs");
  const barLabel = h("div", "flex justify-between text-xs text-gray-500 mb-1");
  const barLabelL = h("span", "", "CROWD ENERGY");
  const barLabelR = h("span", "text-cyan-400 font-bold", "0%");
  barLabel.appendChild(barLabelL);
  barLabel.appendChild(barLabelR);
  barWrap.appendChild(barLabel);

  const barOuter = h("div", "w-full h-3 rounded-full overflow-hidden");
  barOuter.style.background = "rgba(0,255,255,0.1)";
  const barInner = h("div", "crowd-bar-fill h-full rounded-full");
  barInner.style.cssText = "width: 0%; background: linear-gradient(90deg, #00ffff, #ff00ff);";
  barOuter.appendChild(barInner);
  barWrap.appendChild(barOuter);
  panel.appendChild(barWrap);

  // Audio spectrum bars
  const spectrumWrap = h("div", "w-full max-w-xs mt-4");
  const spectrumLabel = h("p", "text-xs text-gray-500 mb-2 tracking-widest", "AUDIO SPECTRUM");
  spectrumWrap.appendChild(spectrumLabel);

  const makeSpectrumBar = (label: string, color: string): HTMLElement => {
    const row = h("div", "flex items-center gap-2 mb-1");
    const lbl = h("span", "text-[10px] text-gray-500 w-12 text-right", label);
    const outer = h("div", "flex-1 h-2 rounded-full overflow-hidden");
    outer.style.background = "rgba(255,255,255,0.05)";
    const inner = h("div", "spectrum-bar h-full");
    inner.style.cssText = `width: 0%; background: ${color};`;
    outer.appendChild(inner);
    row.appendChild(lbl);
    row.appendChild(outer);
    spectrumWrap.appendChild(row);
    return inner;
  };

  const bassBar = makeSpectrumBar("BASS", "#ff00ff");
  const midBar = makeSpectrumBar("MID", "#00ffff");
  const trebleBar = makeSpectrumBar("TREBLE", "#ffff00");
  panel.appendChild(spectrumWrap);

  // Shake hint
  const shakeHint = h("p", "text-gray-600 text-xs mt-2", "or SHAKE your phone!");
  panel.appendChild(shakeHint);

  // ─── Tap tracking logic ───
  let localTaps = 0;
  let tapCount = 0;
  let tapping = false;
  let tapTimer: ReturnType<typeof setInterval> | null = null;

  function doTap(): void {
    localTaps++;
    tapCount++;
    haptic(15);

    counterVal.textContent = String(tapCount);
    counterVal.classList.remove("counter-pop");
    void counterVal.offsetWidth;
    counterVal.classList.add("counter-pop");

    const ripple = h("div", "absolute rounded-full pointer-events-none");
    ripple.style.cssText = `
      width: 180px; height: 180px;
      border: 2px solid rgba(0,255,255,0.5);
      animation: tap-ripple 0.5s ease-out forwards;
    `;
    rippleContainer.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  }

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    tapping = true;
    doTap();
    tapTimer = setInterval(() => {
      if (tapping) doTap();
    }, TAP_INTERVAL_MS);
  });

  const stopTap = () => {
    tapping = false;
    if (tapTimer) { clearInterval(tapTimer); tapTimer = null; }
  };
  btn.addEventListener("pointerup", stopTap);
  btn.addEventListener("pointerleave", stopTap);
  btn.addEventListener("pointercancel", stopTap);

  function startTapTracking(): void {
    let lastLocalTaps = 0;
    setInterval(() => {
      const delta = localTaps - lastLocalTaps;
      lastLocalTaps = localTaps;
      const rate = delta / (TAP_REPORT_MS / 1000);
      sendMsg({ type: "tapRate", rate });
    }, TAP_REPORT_MS);

    // Shake detection
    window.addEventListener("devicemotion", (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      if (mag > 25) doTap();
    });
  }

  return { panel, startTapTracking, audioBars: { bass: bassBar, mid: midBar, treble: trebleBar }, tapBtn: btn, crowdBarInner: barInner, crowdBarLabel: barLabelR };
}

// ─── React Tab ──────────────────────────────────────────────

function buildReactTab(): HTMLElement {
  const panel = h("div", "tab-panel flex-col items-center gap-5 px-4 py-6");

  const label = h("p", "text-gray-400 text-sm tracking-widest uppercase", "Send reactions to the big screen");
  panel.appendChild(label);

  const grid = h("div", "grid grid-cols-4 gap-3 w-full max-w-xs");

  let lastReaction = 0;

  for (const emoji of EMOJIS) {
    const btn = h("button", "emoji-btn flex items-center justify-center text-4xl rounded-2xl aspect-square cursor-pointer");
    btn.style.cssText = `
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      position: relative;
      overflow: visible;
    `;
    btn.textContent = emoji;

    let holdStart = 0;

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      holdStart = Date.now();
    });

    const doSend = () => {
      const now = Date.now();
      if (now - lastReaction < REACTION_COOLDOWN_MS) return;
      lastReaction = now;

      const duration = now - holdStart;
      const size = duration >= 500 ? 3 : duration >= 200 ? 2 : 1;

      haptic(10 + size * 10);

      // Combo tracking
      if (emoji === comboEmoji && comboTimer) {
        comboCount++;
      } else {
        comboEmoji = emoji;
        comboCount = 1;
      }
      if (comboTimer) clearTimeout(comboTimer);
      comboTimer = setTimeout(() => {
        comboCount = 0;
        comboEmoji = "";
        comboTimer = null;
      }, COMBO_WINDOW_MS);

      sendMsg({ type: "reaction", emoji, size });

      btn.style.animation = "none";
      void btn.offsetWidth;
      btn.style.animation = "btn-press 0.15s ease";

      let feedbackText = size > 1 ? `SENT x${size}!` : "SENT!";
      if (comboCount > 1) feedbackText = `x${comboCount} COMBO!`;

      const flash = h("span", "absolute text-xs font-bold pointer-events-none");
      flash.style.cssText = `animation: slide-up 0.4s ease forwards; opacity: 0; top: -4px; left: 50%; transform: translateX(-50%); white-space: nowrap;`;
      flash.style.color = comboCount > 1 ? "#ff00ff" : "#00ffff";
      flash.textContent = feedbackText;
      btn.appendChild(flash);
      setTimeout(() => flash.remove(), 400);

      if (audioTelemetry?.beat) {
        const perfect = h("span", "absolute text-[10px] font-bold pointer-events-none", "⚡ PERFECT TIMING");
        perfect.style.cssText = `animation: perfect-timing 0.6s ease forwards; color: #ffff00; white-space: nowrap; top: -18px; left: 50%; transform: translateX(-50%);`;
        btn.appendChild(perfect);
        setTimeout(() => perfect.remove(), 600);
      }
    };

    btn.addEventListener("pointerup", doSend);
    btn.addEventListener("click", (e) => e.preventDefault());
    grid.appendChild(btn);
  }

  panel.appendChild(grid);

  const hint = h("p", "text-gray-600 text-xs mt-2", "Tap to send • Hold for bigger emoji • Rapid tap for combos!");
  panel.appendChild(hint);

  return panel;
}

// ─── Colors Tab ─────────────────────────────────────────────

function buildColorsTab(): HTMLElement {
  const panel = h("div", "tab-panel flex-col items-center gap-5 px-4 py-6");

  const label = h("p", "text-gray-400 text-sm tracking-widest uppercase", "Paint the room");
  panel.appendChild(label);

  const grid = h("div", "grid grid-cols-4 gap-4 w-full max-w-xs");

  let selectedSwatch: HTMLElement | null = null;

  for (const color of NEON_COLORS) {
    const swatch = h("button", "color-swatch rounded-full aspect-square cursor-pointer");
    swatch.style.cssText = `
      background: ${color.hex};
      border: 2px solid rgba(255,255,255,0.15);
      box-shadow: 0 0 15px ${color.hex}44;
      --swatch-color: ${color.hex};
      -webkit-tap-highlight-color: transparent;
    `;
    swatch.title = color.label;
    swatch.addEventListener("click", () => {
      haptic(15);
      selectedSwatch?.classList.remove("selected");
      swatch.classList.add("selected");
      selectedSwatch = swatch;
      sendMsg({ type: "color", hue: color.hue });
    });
    grid.appendChild(swatch);
  }

  panel.appendChild(grid);

  const hint = h("p", "text-gray-600 text-xs mt-2", "Your choice shifts the visuals for everyone!");
  panel.appendChild(hint);

  return panel;
}

// ─── Shoutout Tab ───────────────────────────────────────────

function buildShoutoutTab(): HTMLElement {
  const panel = h("div", "tab-panel flex-col items-center gap-5 px-4 py-6");

  const label = h("p", "text-gray-400 text-sm tracking-widest uppercase", "Get on the big screen");
  panel.appendChild(label);

  const card = h("div", "w-full max-w-xs rounded-2xl p-6 space-y-4");
  card.style.cssText = `
    background: rgba(20,20,40,0.8);
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(10px);
  `;

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Your name or message";
  input.maxLength = 30;
  input.className = "w-full bg-transparent rounded-xl px-4 py-3 text-lg text-white placeholder-gray-600 focus:outline-none";
  input.style.cssText = `
    border: 2px solid rgba(255,0,255,0.3);
    transition: border-color 0.2s;
  `;
  input.addEventListener("focus", () => { input.style.borderColor = "rgba(255,0,255,0.7)"; });
  input.addEventListener("blur", () => { input.style.borderColor = "rgba(255,0,255,0.3)"; });
  card.appendChild(input);

  const btn = h("button", "w-full py-3 rounded-xl text-lg font-bold cursor-pointer tracking-wider");
  btn.style.cssText = `
    background: linear-gradient(135deg, #ff00ff, #8800ff);
    color: #fff;
    border: none;
    transition: opacity 0.2s;
    -webkit-tap-highlight-color: transparent;
  `;
  btn.textContent = "SEND IT 🚀";
  card.appendChild(btn);

  const status = h("p", "text-sm text-center min-h-[1.5em]");
  status.style.color = "rgba(255,255,255,0.3)";
  card.appendChild(status);

  const COOLDOWN_KEY = "ravespace_callout_last";

  btn.addEventListener("click", () => {
    const name = input.value.trim();
    if (!name) {
      status.textContent = "Type something first!";
      status.style.color = "#ffaa00";
      return;
    }

    const lastSubmit = parseInt(localStorage.getItem(COOLDOWN_KEY) ?? "0", 10);
    const elapsed = Date.now() - lastSubmit;
    if (elapsed < SHOUTOUT_COOLDOWN_MS) {
      const remaining = Math.ceil((SHOUTOUT_COOLDOWN_MS - elapsed) / 1000);
      status.textContent = `Wait ${remaining}s...`;
      status.style.color = "#ffaa00";
      return;
    }

    haptic(30);
    sendMsg({ type: "shoutout", name });
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    input.value = "";
    status.textContent = "Sent! Watch the screen! ✨";
    status.style.color = "#00ff88";

    btn.style.opacity = "0.5";
    btn.style.pointerEvents = "none";
    let countdown = Math.ceil(SHOUTOUT_COOLDOWN_MS / 1000);
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
        btn.textContent = "SEND IT 🚀";
        status.textContent = "";
        status.style.color = "rgba(255,255,255,0.3)";
      } else {
        btn.textContent = `WAIT ${countdown}s`;
      }
    }, 1000);
  });

  panel.appendChild(card);
  return panel;
}

// ─── Tab Navigation ─────────────────────────────────────────

function buildNav(panels: Map<TabId, HTMLElement>, container: HTMLElement): void {
  const nav = h("nav", "fixed bottom-0 left-0 right-0 flex justify-around py-2 pb-[env(safe-area-inset-bottom)]");
  nav.style.cssText += `
    background: rgba(5,5,15,0.95);
    border-top: 1px solid rgba(255,255,255,0.06);
    backdrop-filter: blur(10px);
    z-index: 100;
  `;

  const buttons: HTMLElement[] = [];
  let activeTab: TabId = "energy";

  function switchTab(id: TabId): void {
    activeTab = id;
    for (const [tabId, panel] of panels) {
      if (tabId === id) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    }
    buttons.forEach((b, i) => {
      if (TABS[i]!.id === id) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });
  }

  for (const tab of TABS) {
    const btn = h("button", "nav-btn flex flex-col items-center gap-0.5 px-3 py-1 cursor-pointer bg-transparent border-none");
    btn.style.cssText += "color: rgba(255,255,255,0.4); font-size: 11px; -webkit-tap-highlight-color: transparent;";
    const icon = h("span", "text-xl", tab.icon);
    const label = h("span", "text-[10px] tracking-wider", tab.label);
    btn.appendChild(icon);
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      haptic(10);
      switchTab(tab.id);
    });
    nav.appendChild(btn);
    buttons.push(btn);
  }

  container.appendChild(nav);
  switchTab(activeTab);
}

// ─── Main App ───────────────────────────────────────────────

function buildMainUI(root: HTMLElement): void {
  root.innerHTML = "";
  root.className = "flex flex-col min-h-[100dvh] gradient-bg";

  // Header
  const header = h("div", "flex items-center justify-between px-4 py-3");
  const logo = h("span", "text-sm font-black tracking-[0.2em]");
  logo.style.cssText = `
    background: linear-gradient(90deg, #ff00ff, #00ffff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  `;
  logo.textContent = "RAVESPACE";
  header.appendChild(logo);

  const crowdCount = h("span", "text-xs text-gray-600", "");
  header.appendChild(crowdCount);

  const bpmBadge = h("span", "bpm-badge text-xs font-bold px-2 py-0.5 rounded-full");
  bpmBadge.style.cssText += `
    background: rgba(255,0,255,0.15);
    color: #ff88ff;
    border: 1px solid rgba(255,0,255,0.3);
    display: none;
  `;
  header.appendChild(bpmBadge);
  root.appendChild(header);

  // Main content area
  const main = h("div", "flex-1 flex flex-col items-center justify-center overflow-y-auto");
  main.style.paddingBottom = "72px";

  // Build tabs
  const { panel: energyPanel, startTapTracking, audioBars, tapBtn, crowdBarInner, crowdBarLabel } = buildEnergyTab();
  const reactPanel = buildReactTab();
  const colorsPanel = buildColorsTab();
  const shoutoutPanel = buildShoutoutTab();

  const panels = new Map<TabId, HTMLElement>([
    ["energy", energyPanel],
    ["react", reactPanel],
    ["colors", colorsPanel],
    ["shoutout", shoutoutPanel],
  ]);

  for (const panel of panels.values()) {
    main.appendChild(panel);
  }
  root.appendChild(main);

  // Navigation
  buildNav(panels, root);

  // Start systems
  startTapTracking();

  // Beat haptic toggle
  let beatHapticEnabled = false;

  // Handle incoming messages from display
  const handleMessage = (msg: AudienceResponse) => {
    if (msg.type === "telemetry") {
      audioTelemetry = {
        energy: msg.audio.energy,
        bass: msg.audio.bass,
        mid: msg.audio.mid,
        treble: msg.audio.treble,
        beat: msg.audio.beat,
        bpm: msg.audio.bpm,
        kick: msg.audio.kick,
        beatIntensity: msg.audio.beatIntensity,
        crowdEnergy: msg.crowdEnergy,
        connectedCount: msg.connectedCount,
      };

      // BPM badge
      if (msg.bpm > 0) {
        bpmBadge.textContent = `💓 ${msg.bpm} BPM`;
        bpmBadge.style.display = "";
      } else {
        bpmBadge.style.display = "none";
      }

      // Audio spectrum bars
      audioBars.bass.style.width = `${Math.min(100, msg.audio.bass * 100)}%`;
      audioBars.mid.style.width = `${Math.min(100, msg.audio.mid * 100)}%`;
      audioBars.treble.style.width = `${Math.min(100, msg.audio.treble * 100)}%`;

      // Crowd energy bar
      const pct = Math.min(100, Math.round(msg.crowdEnergy * 100));
      crowdBarLabel.textContent = `${pct}%`;
      crowdBarInner.style.width = `${pct}%`;

      // Connected count
      crowdCount.textContent = msg.connectedCount > 0 ? `👥 ${msg.connectedCount}` : "";

      // Beat flash
      if (msg.audio.beat && !lastBeatState) {
        root.classList.remove("beat-flash");
        void root.offsetWidth;
        root.classList.add("beat-flash");
        if (beatHapticEnabled) haptic(10);
      }
      lastBeatState = msg.audio.beat;

      // Kick pulse on tap button
      if (msg.audio.kick > 0.5) {
        tapBtn.style.transform = `scale(${1 + msg.audio.kick * 0.08})`;
      } else {
        tapBtn.style.transform = "";
      }
    } else if (msg.type === "shoutoutAck") {
      // Feedback is handled by the shoutout tab's local UI
    }
  };

  // Store handler for use by PeerClient callback
  (window as unknown as Record<string, unknown>).__ravespace_audience_handler = handleMessage;

  // Beat haptic toggle
  const hapticToggle = h("button", "text-[10px] text-gray-600 px-1.5 py-0.5 rounded cursor-pointer bg-transparent border-none");
  hapticToggle.textContent = "🔇 haptic";
  hapticToggle.style.cssText += "border: 1px solid rgba(255,255,255,0.1); -webkit-tap-highlight-color: transparent;";
  hapticToggle.addEventListener("click", () => {
    beatHapticEnabled = !beatHapticEnabled;
    hapticToggle.textContent = beatHapticEnabled ? "📳 haptic" : "🔇 haptic";
    hapticToggle.style.borderColor = beatHapticEnabled ? "rgba(0,255,255,0.4)" : "rgba(255,255,255,0.1)";
    if (beatHapticEnabled) haptic(30);
  });
  header.appendChild(hapticToggle);
}

// ─── Boot ───────────────────────────────────────────────────

const STORAGE_AUTO_UPDATE = "ravespace_audience_update";

function applyFadeIn(): void {
  if (sessionStorage.getItem(STORAGE_AUTO_UPDATE) === "true") {
    sessionStorage.removeItem(STORAGE_AUTO_UPDATE);
    document.body.style.opacity = "0";
    document.body.style.transition = "opacity 300ms ease-in";
    requestAnimationFrame(() => { document.body.style.opacity = "1"; });
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

function boot(): void {
  injectStyles();
  applyFadeIn();

  const root = document.getElementById("audience-root")!;

  buildJoinScreen(root, (code) => {
    // Clear join screen
    root.innerHTML = "";

    // Show connecting status
    const connecting = h("div", "flex items-center justify-center min-h-screen gradient-bg");
    const connectText = h("p", "text-gray-400 text-sm tracking-wider", "Connecting...");
    connecting.appendChild(connectText);
    root.appendChild(connecting);

    client = new PeerClient<AudienceMessage, AudienceResponse>("audience", {
      onConnected() {
        root.innerHTML = "";
        buildMainUI(root);
      },
      onMessage(msg) {
        const handler = (window as unknown as Record<string, unknown>).__ravespace_audience_handler as
          ((msg: AudienceResponse) => void) | undefined;
        handler?.(msg);
      },
      onDisconnected() {
        // Show disconnect banner
        const banner = document.createElement("div");
        banner.className = "fixed top-0 left-0 right-0 py-2 text-center text-sm font-bold bg-red-900/80 text-red-200 z-50";
        banner.textContent = "Disconnected from display";
        document.body.appendChild(banner);
      },
      onError(err) {
        connectText.textContent = err.type === "peer-unavailable"
          ? "Code not found — is the display running?"
          : `Error: ${err.message}`;
        connectText.style.color = "#ff4444";
      },
    }, DEVICE_ID);

    client.connect(code);
  });

  // Version poller for seamless updates
  const versionPoller = new VersionPoller();
  versionPoller.start((version) => {
    console.log(`New version detected: ${version}, reloading audience page...`);
    fadeOutAndReload();
  });
}

boot();
