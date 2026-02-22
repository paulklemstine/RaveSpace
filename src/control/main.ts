import "../index.css";
import { ControlPanel } from "./ControlPanel";

const root = document.getElementById("control-root")!;
const panel = new ControlPanel(root);
panel.init();
