import "./index.css";
import { showStartScreen } from "./ui/StartScreen";
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
import { TelemetryPublisher } from "./firebase/TelemetryPublisher";
import { ControlListener } from "./firebase/ControlListener";
import { VersionWatcher } from "./firebase/VersionWatcher";
import { DiagnosticOverlay } from "./ui/DiagnosticOverlay";
import { DropDetector } from "./audio/DropDetector";
import { AutoVJ } from "./agent/AutoVJ";
import { CalloutOverlay } from "./engine/CalloutOverlay";
import { ref, onValue } from "firebase/database";
import { db } from "./firebase/config";

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

  // Telemetry: publish audio features to RTDB at 5Hz
  const telemetry = new TelemetryPublisher(audio, renderer);
  telemetry.start();

  // Control listener: receive scene switches, param changes from RTDB
  const control = new ControlListener(renderer, sceneManager);
  control.start();

  // AutoVJ agent: AI-driven scene/param control
  const autoVJ = new AutoVJ();

  // Listen for AI mode toggle from control panel
  onValue(ref(db, "ravespace/control/aiMode"), (snapshot) => {
    const data = snapshot.val() as { enabled?: boolean } | null;
    autoVJ.setEnabled(data?.enabled === true);
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

  // Diagnostic overlay: toggle with D key
  new DiagnosticOverlay(renderer, audio);

  // Version watcher: auto-reload on deploy
  const versionWatcher = new VersionWatcher();
  versionWatcher.start((version) => {
    console.log(`New version detected: ${version}, reloading...`);
    setTimeout(() => window.location.reload(), 500);
  });
}

boot();
