import "./index.css";
import { showStartScreen } from "./ui/StartScreen";
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
import { TelemetryPublisher } from "./firebase/TelemetryPublisher";
import { ControlListener } from "./firebase/ControlListener";
import { VersionWatcher } from "./firebase/VersionWatcher";
import { DiagnosticOverlay } from "./ui/DiagnosticOverlay";
import { DropDetector } from "./audio/DropDetector";
import { AutoVJ } from "./agent/AutoVJ";
import { GeminiPhraseGen } from "./agent/GeminiPhraseGen";
import { CalloutOverlay } from "./engine/CalloutOverlay";
import { CrowdOverlay } from "./engine/CrowdOverlay";
import { ref, onValue } from "firebase/database";
import { db } from "./firebase/config";

const STORAGE_FROZEN_FRAME = "ravespace_frozen_frame";
const STORAGE_AUTO_UPDATE = "ravespace_auto_update";

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

  // Telemetry: publish audio features to RTDB at 5Hz
  const telemetry = new TelemetryPublisher(audio, renderer);
  telemetry.start();

  // Control listener: receive scene switches, param changes from RTDB
  const control = new ControlListener(renderer, sceneManager);
  control.start();

  // AutoVJ agent: AI-driven scene/param control
  const autoVJ = new AutoVJ();

  // Gemini phrase generation for AI callouts
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (geminiKey) {
    const phraseGen = new GeminiPhraseGen(geminiKey);
    autoVJ.setPhraseGen(phraseGen);
  }

  // Listen for AI mode toggle from control panel
  onValue(ref(db, "ravespace/control/aiMode"), (snapshot) => {
    const data = snapshot.val() as { enabled?: boolean } | null;
    autoVJ.setEnabled(data?.enabled === true);
  });

  // Listen for callout settings (AI phrases toggle + interval)
  onValue(ref(db, "ravespace/callouts/settings"), (snapshot) => {
    const data = snapshot.val();
    if (data) {
      autoVJ.setPhrasesEnabled(data.aiPhrasesEnabled === true);
      if (data.aiPhraseInterval) {
        autoVJ.setPhraseInterval(data.aiPhraseInterval);
      }
    }
  });

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

  // Callout overlay: audience shoutouts on screen
  const calloutOverlay = new CalloutOverlay();
  calloutOverlay.start();

  // Crowd overlay: emoji reactions + crowd energy/color aggregation
  const crowdOverlay = new CrowdOverlay();
  crowdOverlay.start();

  // Diagnostic overlay: toggle with D key
  new DiagnosticOverlay(renderer, audio);

  // Version watcher: capture frame + seamless reload on deploy
  const versionWatcher = new VersionWatcher();
  versionWatcher.start((version) => {
    console.log(`New version detected: ${version}, capturing frame and reloading...`);
    captureAndReload();
  });
}

boot();
