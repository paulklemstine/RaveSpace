import "./index.css";
import { showStartScreen, showPairingCode } from "./ui/StartScreen";
import { Renderer } from "./engine/Renderer";
import { SceneManager } from "./engine/SceneManager";
import { PlasmaShader } from "./scenes/PlasmaShader";
import { TunnelScene } from "./scenes/TunnelScene";
import { ParticleField } from "./scenes/ParticleField";
import { SacredGeometry } from "./scenes/SacredGeometry";
import { FractalDive } from "./scenes/FractalDive";
import { Kaleidoscope } from "./scenes/Kaleidoscope";
import { GodRays } from "./scenes/GodRays";
import { LiquidDream } from "./scenes/LiquidDream";
import { VoidWarp } from "./scenes/VoidWarp";
import { NeonGrid } from "./scenes/NeonGrid";
import { DigitalRain } from "./scenes/DigitalRain";
import { Starfield } from "./scenes/Starfield";
import { MoirePatterns } from "./scenes/MoirePatterns";
import { CellularFlow } from "./scenes/CellularFlow";
import { LaserGrid } from "./scenes/LaserGrid";
import { WaveformViz } from "./scenes/WaveformViz";
import { CircuitTrace } from "./scenes/CircuitTrace";
import { FireStorm } from "./scenes/FireStorm";
import { AuroraBorealis } from "./scenes/AuroraBorealis";
import { VoronoiShatter } from "./scenes/VoronoiShatter";
import { SuperNova } from "./scenes/SuperNova";
import { HypnoSpiral } from "./scenes/HypnoSpiral";
import { GlitchMatrix } from "./scenes/GlitchMatrix";
import { HexGrid } from "./scenes/HexGrid";
import { PrismLight } from "./scenes/PrismLight";
import { EnergyField } from "./scenes/EnergyField";
import { NebulaDrift } from "./scenes/NebulaDrift";
import { CyberPulse } from "./scenes/CyberPulse";
import { FluidDynamics } from "./scenes/FluidDynamics";
import { MandelbrotZoom } from "./scenes/MandelbrotZoom";
import { StainedGlass } from "./scenes/StainedGlass";
import { ElectricStorm } from "./scenes/ElectricStorm";
import { AudioAnalyzer } from "./audio/AudioAnalyzer";
import { SCENE_REGISTRY } from "./scenes/registry";
import { DiagnosticOverlay } from "./ui/DiagnosticOverlay";
import { DropDetector } from "./audio/DropDetector";
import { AutoVJ } from "./agent/AutoVJ";
import { GeminiPhraseGen } from "./agent/GeminiPhraseGen";
import { CalloutOverlay } from "./engine/CalloutOverlay";
import { CrowdOverlay } from "./engine/CrowdOverlay";
import { EmojiRain } from "./engine/EmojiRain";
import { PeerHost } from "./comms/PeerHost";
import { VersionPoller } from "./comms/VersionPoller";
import type {
  ControlMessage,
  AudienceMessage,
  FullState,
  AudioTelemetry,
  CalloutQueueItem,
} from "./comms/messages";
import type { DataConnection } from "peerjs";
import type { ParamValues } from "./types/params";

const STORAGE_FROZEN_FRAME = "ravespace_frozen_frame";
const STORAGE_AUTO_UPDATE = "ravespace_auto_update";
const TELEMETRY_INTERVAL_MS = 200; // 5Hz
const SHOUTOUT_COOLDOWN_MS = 60_000;

function isAutoUpdate(): boolean {
  return sessionStorage.getItem(STORAGE_AUTO_UPDATE) === "true";
}

function clearAutoUpdateFlags(): void {
  sessionStorage.removeItem(STORAGE_AUTO_UPDATE);
}

/** Create a fullscreen overlay showing the frozen frame from the previous session */
function showFrozenFrameOverlay(): HTMLDivElement | null {
  const frameData = sessionStorage.getItem(STORAGE_FROZEN_FRAME);
  if (!frameData) return null;

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#000;transition:opacity 1.5s ease-in-out;";

  const img = document.createElement("img");
  img.src = frameData;
  img.style.cssText = "width:100%;height:100%;object-fit:cover;";
  overlay.appendChild(img);

  document.body.appendChild(overlay);
  return overlay;
}

/** Fade out and remove the frozen frame overlay */
function fadeOutOverlay(overlay: HTMLDivElement): void {
  overlay.style.opacity = "0";
  overlay.addEventListener("transitionend", () => {
    overlay.remove();
    sessionStorage.removeItem(STORAGE_FROZEN_FRAME);
  });
}

/** Capture the current canvas frame, store it, and reload */
function captureAndReload(): void {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
  if (canvas) {
    try {
      const frameData = canvas.toDataURL("image/png");
      sessionStorage.setItem(STORAGE_FROZEN_FRAME, frameData);
    } catch {
      // Canvas tainted or too large — reload without frozen frame
    }
  }
  sessionStorage.setItem(STORAGE_AUTO_UPDATE, "true");
  window.location.reload();
}

/** Scene factory map: registry index → factory function */
const SCENE_FACTORIES: (() => InstanceType<typeof PlasmaShader | typeof ParticleField | typeof TunnelScene | typeof SacredGeometry | typeof FractalDive | typeof Kaleidoscope | typeof GodRays | typeof LiquidDream | typeof VoidWarp | typeof NeonGrid | typeof DigitalRain | typeof Starfield | typeof MoirePatterns | typeof CellularFlow | typeof LaserGrid | typeof WaveformViz | typeof CircuitTrace | typeof FireStorm | typeof AuroraBorealis | typeof VoronoiShatter | typeof SuperNova | typeof HypnoSpiral | typeof GlitchMatrix | typeof HexGrid | typeof PrismLight | typeof EnergyField | typeof NebulaDrift | typeof CyberPulse | typeof FluidDynamics | typeof MandelbrotZoom | typeof StainedGlass | typeof ElectricStorm>)[] = [
  // Original 8
  () => new PlasmaShader(),
  () => new ParticleField(),
  () => new TunnelScene(),
  () => new SacredGeometry(),
  () => new FractalDive(),
  () => new Kaleidoscope(),
  () => new GodRays(),
  () => new LiquidDream(),
  // New 24
  () => new VoidWarp(),
  () => new NeonGrid(),
  () => new DigitalRain(),
  () => new Starfield(),
  () => new MoirePatterns(),
  () => new CellularFlow(),
  () => new LaserGrid(),
  () => new WaveformViz(),
  () => new CircuitTrace(),
  () => new FireStorm(),
  () => new AuroraBorealis(),
  () => new VoronoiShatter(),
  () => new SuperNova(),
  () => new HypnoSpiral(),
  () => new GlitchMatrix(),
  () => new HexGrid(),
  () => new PrismLight(),
  () => new EnergyField(),
  () => new NebulaDrift(),
  () => new CyberPulse(),
  () => new FluidDynamics(),
  () => new MandelbrotZoom(),
  () => new StainedGlass(),
  () => new ElectricStorm(),
];

// ─── State tracked for state sync ─────────────────────────────

let calloutSettings = { autoShow: false, interval: 30, aiPhrasesEnabled: false, aiPhraseInterval: 45 };
let sceneParamsStore: Record<string, ParamValues> = {};
let currentOverlay: { scene: string; blendMode: string; opacity: number } | null = null;
// aiEnabled tracked via autoVJ.isEnabled()

// Audience rate limiting: deviceId → last shoutout timestamp
const audienceShoutoutTimestamps = new Map<string, number>();

// Audience crowd data: deviceId → latest data
const audienceTapData = new Map<string, { rate: number; ts: number }>();
const audienceColorData = new Map<string, { hue: number; ts: number }>();

async function boot() {
  const autoUpdate = isAutoUpdate();
  clearAutoUpdateFlags();

  let frozenOverlay: HTMLDivElement | null = null;

  if (autoUpdate) {
    frozenOverlay = showFrozenFrameOverlay();
  } else {
    await showStartScreen();
  }

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const renderer = new Renderer(canvas);

  // Register all 32 scenes
  const sceneManager = new SceneManager();
  for (let i = 0; i < SCENE_REGISTRY.length; i++) {
    sceneManager.register(SCENE_REGISTRY[i]!, SCENE_FACTORIES[i]!);
  }

  // Start audio
  const audio = new AudioAnalyzer();
  await audio.start();
  renderer.setAudioAnalyzer(audio);

  // Default scene
  renderer.setSceneByName("plasma", sceneManager);
  renderer.start();

  // If auto-updating, wait one frame then crossfade from frozen overlay
  if (frozenOverlay) {
    requestAnimationFrame(() => {
      fadeOutOverlay(frozenOverlay!);
    });
  }

  // Callout overlay: audience shoutouts on screen
  const calloutOverlay = new CalloutOverlay();

  // Crowd overlay: emoji reactions + crowd energy/color aggregation
  const crowdOverlay = new CrowdOverlay();
  crowdOverlay.start();

  // Emoji rain: ambient emojis sprinkled across the screen, synced to music
  const emojiRain = new EmojiRain(audio);
  emojiRain.start();

  // AutoVJ agent: AI-driven scene/param control (now with direct renderer calls)
  const autoVJ = new AutoVJ(renderer, sceneManager, (name, duration, _animStyle) => {
    calloutOverlay.trigger(name, duration);
  });
  autoVJ.setEmojiRain(emojiRain);

  // Gemini phrase generation for AI callouts
  const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? "";
  if (!geminiKey) {
    console.warn("[RaveSpace] VITE_GEMINI_API_KEY not set — AI phrases will use fallback mode");
  }
  const phraseGen = new GeminiPhraseGen(geminiKey);
  void phraseGen.prefetchAll();
  autoVJ.setPhraseGen(phraseGen);

  // Drop detector: triggers dopamine effects on beat drops + feeds AutoVJ
  const effects = renderer.getEffectsLayer();
  const dropDetector = new DropDetector({
    onDrop: (intensity) => {
      effects.triggerDrop(intensity);
      autoVJ.onDrop(intensity);
    },
    onBuild: (intensity) => {
      autoVJ.onBuild(intensity);
    },
  });

  // Feed audio to drop detector + AutoVJ every frame via RAF
  const updateAudioDriven = () => {
    const features = audio.getFeatures();
    dropDetector.update(features);
    autoVJ.update(features);
    requestAnimationFrame(updateAudioDriven);
  };
  requestAnimationFrame(updateAudioDriven);

  // Diagnostic overlay: toggle with D key
  new DiagnosticOverlay(renderer, audio);

  // Toggle emoji rain with 'E' key
  window.addEventListener("keydown", (e) => {
    if (e.key === "E" || e.key === "e") {
      emojiRain.setEnabled(!emojiRain.isEnabled());
    }
  });

  // ─── Build full state for controller sync ──────────────────

  function buildFullState(): FullState {
    return {
      activeScene: renderer.getActiveSceneName() ?? "plasma",
      globalParams: renderer.getGlobalParams(),
      transition: renderer.getTransitionSettings(),
      effects: effects.getSettings(),
      aiMode: { enabled: autoVJ.isEnabled(), lastAction: autoVJ.getLastAction() },
      overlay: currentOverlay,
      bandMappings: [],
      calloutSettings,
      calloutQueue: calloutOverlay.getQueue().map((e) => ({
        id: e.id,
        name: e.name,
        timestamp: e.timestamp,
      })),
      emojiRain: { enabled: emojiRain.isEnabled() },
      sceneParams: sceneParamsStore,
    };
  }

  // ─── Handle control messages from VJ controller ────────────

  function handleControlMessage(msg: ControlMessage): void {
    switch (msg.type) {
      case "setScene":
        renderer.setSceneByName(msg.scene, sceneManager);
        break;

      case "setGlobalParams":
        renderer.setGlobalParams(msg.params);
        break;

      case "setTransition":
        renderer.setTransition(msg.effect, msg.duration);
        break;

      case "setEffects":
        renderer.setEffectsSettings(msg.settings);
        break;

      case "setAiMode":
        autoVJ.setEnabled(msg.enabled);
        break;

      case "setSceneParams": {
        sceneParamsStore[msg.scene] = msg.params;
        if (msg.scene === renderer.getActiveSceneName()) {
          renderer.setSceneParams(msg.params);
        }
        break;
      }

      case "callout":
        calloutOverlay.trigger(msg.name, msg.duration);
        break;

      case "setOverlay":
        if (!msg.scene) {
          renderer.clearOverlayScene();
          currentOverlay = null;
        } else {
          renderer.setOverlayScene(msg.scene, sceneManager);
          if (msg.blendMode) renderer.setBlendMode(msg.blendMode);
          if (msg.opacity !== undefined) renderer.setOverlayOpacity(msg.opacity);
          currentOverlay = {
            scene: msg.scene,
            blendMode: msg.blendMode ?? "screen",
            opacity: msg.opacity ?? 0.3,
          };
        }
        break;

      case "setBandMappings":
        renderer.setBandMappings(msg.mappings);
        break;

      case "setCalloutSettings":
        calloutSettings = {
          autoShow: msg.autoShow,
          interval: msg.interval,
          aiPhrasesEnabled: msg.aiPhrasesEnabled,
          aiPhraseInterval: msg.aiPhraseInterval,
        };
        autoVJ.setPhrasesEnabled(msg.aiPhrasesEnabled);
        autoVJ.setPhraseInterval(msg.aiPhraseInterval);
        break;

      case "setEmojiRain":
        emojiRain.setEnabled(msg.enabled);
        break;

      case "showNextCallout": {
        const queue = calloutOverlay.getQueue();
        if (queue.length > 0) {
          const next = queue[0]!;
          calloutOverlay.trigger(next.name, 5);
          calloutOverlay.removeFromQueue(next.id);
          sendQueueUpdate();
        }
        break;
      }

      case "clearCalloutQueue":
        calloutOverlay.clearQueue();
        sendQueueUpdate();
        break;

      case "removeFromQueue":
        calloutOverlay.removeFromQueue(msg.id);
        sendQueueUpdate();
        break;
    }
  }

  // ─── Handle audience messages ──────────────────────────────

  function handleAudienceMessage(conn: DataConnection, msg: AudienceMessage): void {
    // Find device ID from connection metadata or peer
    const deviceId = conn.peer;

    switch (msg.type) {
      case "tapRate":
        audienceTapData.set(deviceId, { rate: msg.rate, ts: Date.now() });
        crowdOverlay.handleTapData([...audienceTapData.values()]);
        break;

      case "reaction":
        crowdOverlay.handleReaction(msg.emoji, msg.size);
        break;

      case "color":
        audienceColorData.set(deviceId, { hue: msg.hue, ts: Date.now() });
        crowdOverlay.handleColorData([...audienceColorData.values()]);
        break;

      case "shoutout": {
        const now = Date.now();
        const lastTime = audienceShoutoutTimestamps.get(deviceId) ?? 0;
        if (now - lastTime < SHOUTOUT_COOLDOWN_MS) {
          host.sendToAudience(conn, { type: "shoutoutAck", status: "rateLimited" });
          return;
        }
        audienceShoutoutTimestamps.set(deviceId, now);

        const id = `${now}-${Math.random().toString(36).slice(2, 6)}`;
        calloutOverlay.addToQueue(id, msg.name, now);
        host.sendToAudience(conn, { type: "shoutoutAck", status: "queued" });
        sendQueueUpdate();
        break;
      }
    }
  }

  function sendQueueUpdate(): void {
    const queue: CalloutQueueItem[] = calloutOverlay.getQueue().map((e) => ({
      id: e.id,
      name: e.name,
      timestamp: e.timestamp,
    }));
    host.sendToController({ type: "calloutQueueUpdate", queue });
    // Update AutoVJ's queue size tracking
    autoVJ.setCalloutQueueSize(queue.length);
  }

  // ─── PeerHost setup ────────────────────────────────────────

  let pairingOverlay: { hide: () => void } | null = null;

  const host = new PeerHost({
    onControlMessage: handleControlMessage,
    onAudienceMessage: handleAudienceMessage,
    onControllerConnected: () => {
      if (pairingOverlay) {
        pairingOverlay.hide();
        pairingOverlay = null;
      }
      return buildFullState();
    },
    onControllerDisconnected: () => {
      // Could show pairing code again, but for now just log
      console.log("[PeerHost] Controller disconnected");
    },
    onCodeReady: (code) => {
      pairingOverlay = showPairingCode(code);
      console.log(`[PeerHost] Pairing code: ${code}`);
    },
  });

  host.start();

  // ─── Telemetry broadcast (5Hz) ─────────────────────────────

  let lastAiAction = "";

  setInterval(() => {
    const features = audio.getFeatures();

    function safe(v: number): number {
      return Number.isFinite(v) ? v : 0;
    }

    const audioTelemetry: AudioTelemetry = {
      energy: safe(Math.round(features.energy * 1000) / 1000),
      bass: safe(Math.round(features.bass * 1000) / 1000),
      mid: safe(Math.round(features.mid * 1000) / 1000),
      treble: safe(Math.round(features.treble * 1000) / 1000),
      spectralCentroid: safe(Math.round(features.spectralCentroid * 1000) / 1000),
      beat: features.beat,
      bpm: safe(Math.round(features.bpm)),
      kick: safe(Math.round(features.kick * 1000) / 1000),
      beatIntensity: safe(Math.round(features.beatIntensity * 1000) / 1000),
      spectralFlux: safe(Math.round(features.spectralFlux * 1000) / 1000),
    };

    // Send telemetry to controller
    host.sendToController({
      type: "telemetry",
      audio: audioTelemetry,
      display: {
        connected: true,
        scene: renderer.getActiveSceneName() ?? "unknown",
        fps: 60,
      },
    });

    // Send telemetry to audience
    host.broadcastToAudience({
      type: "telemetry",
      audio: audioTelemetry,
      crowdEnergy: crowdOverlay.getEnergy(),
      connectedCount: host.getAudienceCount(),
      bpm: audioTelemetry.bpm,
    });

    // Update crowd connected count
    crowdOverlay.setConnectedCount(host.getAudienceCount());

    // Track AI action changes
    const currentAction = autoVJ.getLastAction();
    if (currentAction !== lastAiAction) {
      lastAiAction = currentAction;
      host.sendToController({ type: "aiAction", action: currentAction });
    }

    // Send crowd update to controller
    host.sendToController({
      type: "crowdUpdate",
      energy: crowdOverlay.getEnergy(),
      connectedCount: host.getAudienceCount(),
      dominantHue: crowdOverlay.getDominantHue(),
    });

    // Track callout active state for AutoVJ
    autoVJ.setCalloutActive(calloutOverlay.getQueue().length > 0);
  }, TELEMETRY_INTERVAL_MS);

  // ─── Version polling: capture frame + seamless reload ──────

  const versionPoller = new VersionPoller();
  versionPoller.start((version) => {
    console.log(`New version detected: ${version}, capturing frame and reloading...`);
    captureAndReload();
  });
}

boot();
