import "./index.css";
import { showStartScreen, showPairingCode } from "./ui/StartScreen";
import { Renderer } from "./engine/Renderer";
import { SceneManager } from "./engine/SceneManager";
import { PlasmaShader } from "./scenes/PlasmaShader";
import { TunnelScene } from "./scenes/TunnelScene";
import { ParticleField } from "./scenes/ParticleField";
import { SacredGeometry } from "./scenes/SacredGeometry";
import { FractalDreams } from "./scenes/FractalDreams";
import { Kaleidoscope } from "./scenes/Kaleidoscope";
import { CosmicWeb } from "./scenes/CosmicWeb";
import { AcidWarp } from "./scenes/AcidWarp";
import { AudioAnalyzer } from "./audio/AudioAnalyzer";
import { SCENE_REGISTRY } from "./scenes/registry";
import { DiagnosticOverlay } from "./ui/DiagnosticOverlay";
import { DropDetector } from "./audio/DropDetector";
import { AutoVJ } from "./agent/AutoVJ";
import { CalloutOverlay } from "./engine/CalloutOverlay";
import { PeerHost } from "./comms/PeerHost";
import { VersionPoller } from "./comms/VersionPoller";
import type { ControlMessage, FullState } from "./comms/messages";
import type { DataConnection } from "peerjs";

const TELEMETRY_INTERVAL_MS = 200; // 5Hz

function safe(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

async function boot() {
  // User click on start screen satisfies AudioContext gesture requirement
  await showStartScreen();

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const renderer = new Renderer(canvas);

  // Register all scenes
  const sceneManager = new SceneManager();
  sceneManager.register(SCENE_REGISTRY[0]!, () => new PlasmaShader());
  sceneManager.register(SCENE_REGISTRY[1]!, () => new ParticleField());
  sceneManager.register(SCENE_REGISTRY[2]!, () => new TunnelScene());
  sceneManager.register(SCENE_REGISTRY[3]!, () => new SacredGeometry());
  sceneManager.register(SCENE_REGISTRY[4]!, () => new FractalDreams());
  sceneManager.register(SCENE_REGISTRY[5]!, () => new Kaleidoscope());
  sceneManager.register(SCENE_REGISTRY[6]!, () => new CosmicWeb());
  sceneManager.register(SCENE_REGISTRY[7]!, () => new AcidWarp());

  // Start audio
  const audio = new AudioAnalyzer();
  await audio.start();
  renderer.setAudioAnalyzer(audio);

  // Default scene
  renderer.setSceneByName("plasma", sceneManager);
  renderer.start();

  // AutoVJ agent: AI-driven scene/param control (now takes direct refs)
  const autoVJ = new AutoVJ(renderer, sceneManager);

  // Callout overlay: audience shoutouts on screen
  const calloutOverlay = new CalloutOverlay();

  // Audience rate limiting: DataConnection → last callout timestamp
  const audienceCooldowns = new Map<DataConnection, number>();
  const AUDIENCE_COOLDOWN_MS = 60_000;

  // Track last AI action for change detection
  let lastSentAiAction = "";

  // Build full state snapshot for controller sync
  function buildFullState(): FullState {
    return {
      activeScene: renderer.getActiveSceneName() ?? "plasma",
      globalParams: renderer.getGlobalParams(),
      transition: renderer.getTransitionSettings(),
      effects: renderer.getEffectsLayer().getSettings(),
      aiEnabled: autoVJ.isEnabled(),
    };
  }

  // Handle control messages from controller
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
      case "setSceneParams":
        renderer.setSceneParams(msg.params);
        break;
      case "callout":
        calloutOverlay.trigger(msg.name, msg.duration);
        break;
    }
  }

  // Create PeerHost
  let pairingOverlay: { hide: () => void } | null = null;

  const host = new PeerHost({
    onControlMessage: handleControlMessage,
    onAudienceCallout: (conn, name) => {
      const now = Date.now();
      const lastTime = audienceCooldowns.get(conn) ?? 0;
      if (now - lastTime < AUDIENCE_COOLDOWN_MS) {
        return { type: "rateLimited" };
      }
      audienceCooldowns.set(conn, now);
      calloutOverlay.trigger(name, 5);
      return { type: "calloutQueued" };
    },
    onControllerConnected: () => {
      // Minimize pairing code when controller connects
      pairingOverlay?.hide();
      return buildFullState();
    },
    onControllerDisconnected: () => {
      // Could re-show pairing code here if desired
    },
    onCodeReady: (code) => {
      pairingOverlay = showPairingCode(code);
    },
  });

  host.start();

  // Telemetry: send audio features + display info to controller at 5Hz
  setInterval(() => {
    if (!host.hasController) return;

    const features = audio.getFeatures();
    host.sendToController({
      type: "telemetry",
      audio: {
        energy: safe(Math.round(features.energy * 1000) / 1000),
        bass: safe(Math.round(features.bass * 1000) / 1000),
        mid: safe(Math.round(features.mid * 1000) / 1000),
        treble: safe(Math.round(features.treble * 1000) / 1000),
        spectralCentroid: safe(Math.round(features.spectralCentroid * 1000) / 1000),
        beat: features.beat,
        bpm: safe(Math.round(features.bpm)),
      },
      display: {
        scene: renderer.getActiveSceneName() ?? "unknown",
        fps: renderer.getDiagnostics().fps,
      },
    });

    // Send AI action updates when changed
    const currentAction = autoVJ.getLastAction();
    if (currentAction && currentAction !== lastSentAiAction) {
      lastSentAiAction = currentAction;
      host.sendToController({ type: "aiAction", action: currentAction });
    }
  }, TELEMETRY_INTERVAL_MS);

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

  // Version poller: auto-reload on deploy
  const versionPoller = new VersionPoller();
  versionPoller.start((version) => {
    console.log(`New version detected: ${version}, reloading...`);
    setTimeout(() => window.location.reload(), 500);
  });
}

boot();
