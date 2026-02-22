import "./index.css";
import { showStartScreen } from "./ui/StartScreen";
import { Renderer } from "./engine/Renderer";
import { SceneManager } from "./engine/SceneManager";
import { PlasmaShader } from "./scenes/PlasmaShader";
import { TunnelScene } from "./scenes/TunnelScene";
import { ParticleField } from "./scenes/ParticleField";
import { AudioAnalyzer } from "./audio/AudioAnalyzer";
import { SCENE_REGISTRY } from "./scenes/registry";
import { TelemetryPublisher } from "./firebase/TelemetryPublisher";
import { ControlListener } from "./firebase/ControlListener";

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
}

boot();
