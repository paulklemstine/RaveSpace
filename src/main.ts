import "./index.css";
import { showStartScreen } from "./ui/StartScreen";
import { Renderer } from "./engine/Renderer";
import { PlasmaShader } from "./scenes/PlasmaShader";
import { AudioAnalyzer } from "./audio/AudioAnalyzer";

async function boot() {
  // User click on start screen satisfies AudioContext gesture requirement
  await showStartScreen();

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const renderer = new Renderer(canvas);
  const plasma = new PlasmaShader();

  const audio = new AudioAnalyzer();
  await audio.start();
  renderer.setAudioAnalyzer(audio);

  renderer.setScene(plasma);
  renderer.start();
}

boot();
