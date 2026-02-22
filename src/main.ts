import "./index.css";
import { showStartScreen } from "./ui/StartScreen";
import { Renderer } from "./engine/Renderer";
import { PlasmaShader } from "./scenes/PlasmaShader";

async function boot() {
  await showStartScreen();

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const renderer = new Renderer(canvas);
  const plasma = new PlasmaShader();

  renderer.setScene(plasma);
  renderer.start();
}

boot();
