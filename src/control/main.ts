import "../index.css";
import { ControlPanel } from "./ControlPanel";
import { VersionWatcher } from "../firebase/VersionWatcher";

const STORAGE_AUTO_UPDATE = "ravespace_control_update";

function applyFadeIn(): void {
  if (sessionStorage.getItem(STORAGE_AUTO_UPDATE) === "true") {
    sessionStorage.removeItem(STORAGE_AUTO_UPDATE);
    document.body.style.opacity = "0";
    document.body.style.transition = "opacity 300ms ease-in";
    requestAnimationFrame(() => {
      document.body.style.opacity = "1";
    });
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

applyFadeIn();

const root = document.getElementById("control-root")!;
const panel = new ControlPanel(root);
panel.init();

const versionWatcher = new VersionWatcher();
versionWatcher.start((version) => {
  console.log(`New version detected: ${version}, reloading control panel...`);
  fadeOutAndReload();
});
