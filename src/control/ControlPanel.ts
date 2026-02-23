import { SCENE_REGISTRY } from "../scenes/registry";
import type { ControlMessage, DisplayMessage } from "../comms/messages";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { ScenePicker } from "./components/ScenePicker";
import { AudioMeters } from "./components/AudioMeters";
import { BpmDisplay } from "./components/BpmDisplay";
import { ParamSliders } from "./components/ParamSliders";
import { GlobalControls } from "./components/GlobalControls";
import { TransitionPicker } from "./components/TransitionPicker";
import { EffectsControls } from "./components/EffectsControls";
import { AIControls } from "./components/AIControls";
import { CalloutPanel } from "./components/CalloutPanel";

export class ControlPanel {
  private root: HTMLElement;
  private send: (msg: ControlMessage) => void;
  private connectionStatus!: ConnectionStatus;
  private scenePicker!: ScenePicker;
  private audioMeters!: AudioMeters;
  private bpmDisplay!: BpmDisplay;
  private paramSliders!: ParamSliders;
  private globalControls!: GlobalControls;
  private transitionPicker!: TransitionPicker;
  private effectsControls!: EffectsControls;
  private aiControls!: AIControls;
  private calloutPanel!: CalloutPanel;
  private activeScene = "plasma";

  constructor(root: HTMLElement, send: (msg: ControlMessage) => void) {
    this.root = root;
    this.send = send;
  }

  init(): void {
    this.buildLayout();
  }

  handleDisplayMessage(msg: DisplayMessage): void {
    switch (msg.type) {
      case "telemetry":
        this.audioMeters.update({
          bass: msg.audio.bass,
          mid: msg.audio.mid,
          treble: msg.audio.treble,
          energy: msg.audio.energy,
        });
        this.bpmDisplay.update(msg.audio.bpm, msg.audio.beat);
        this.connectionStatus.update(true);
        break;

      case "stateSync":
        this.activeScene = msg.state.activeScene;
        this.scenePicker.update(msg.state.activeScene);
        this.globalControls.update(msg.state.globalParams);
        this.transitionPicker.update(msg.state.transition);
        this.effectsControls.update(msg.state.effects);
        this.aiControls.update({ enabled: msg.state.aiEnabled });
        this.connectionStatus.update(true);
        {
          const meta = SCENE_REGISTRY.find((s) => s.id === msg.state.activeScene);
          if (meta) {
            this.paramSliders.setScene(meta.displayName, meta.params);
          }
        }
        break;

      case "aiAction":
        this.aiControls.update({ lastAction: msg.action });
        break;
    }
  }

  private buildLayout(): void {
    this.root.className = "max-w-5xl mx-auto p-4";

    // Header
    const header = document.createElement("div");
    header.className = "flex items-center justify-between mb-6";

    const title = document.createElement("h1");
    title.textContent = "RAVESPACE VJ CONTROL";
    title.className = "text-xl font-bold tracking-widest text-white";

    this.connectionStatus = new ConnectionStatus(header);
    header.prepend(title);
    this.root.appendChild(header);

    // Main grid: sidebar (scenes + audio) | content (global + params)
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-[220px_1fr] gap-6";

    // Left sidebar
    const sidebar = document.createElement("div");
    sidebar.className = "space-y-6";

    this.scenePicker = new ScenePicker(sidebar, SCENE_REGISTRY, (sceneId) => {
      this.activeScene = sceneId;
      this.send({ type: "setScene", scene: sceneId });
      const meta = SCENE_REGISTRY.find((s) => s.id === sceneId);
      if (meta) {
        this.paramSliders.setScene(meta.displayName, meta.params);
      }
    });

    this.audioMeters = new AudioMeters(sidebar);
    this.bpmDisplay = new BpmDisplay(sidebar);

    grid.appendChild(sidebar);

    // Right content
    const content = document.createElement("div");
    content.className = "space-y-6";

    this.globalControls = new GlobalControls(content, (values) => {
      this.send({ type: "setGlobalParams", params: values });
    });

    const transitionContainer = document.createElement("div");
    transitionContainer.className = "border-t border-gray-800 pt-6";
    this.transitionPicker = new TransitionPicker(transitionContainer, (settings) => {
      this.send({ type: "setTransition", effect: settings.effect, duration: settings.duration });
    });
    content.appendChild(transitionContainer);

    const effectsContainer = document.createElement("div");
    effectsContainer.className = "border-t border-gray-800 pt-6";
    this.effectsControls = new EffectsControls(effectsContainer, (values) => {
      this.send({ type: "setEffects", settings: values });
    });
    content.appendChild(effectsContainer);

    const aiContainer = document.createElement("div");
    aiContainer.className = "border-t border-gray-800 pt-6";
    this.aiControls = new AIControls(aiContainer, (values) => {
      this.send({ type: "setAiMode", enabled: values.enabled });
    });
    content.appendChild(aiContainer);

    const calloutContainer = document.createElement("div");
    calloutContainer.className = "border-t border-gray-800 pt-6";
    this.calloutPanel = new CalloutPanel(calloutContainer, (name, dur) => {
      this.send({ type: "callout", name, duration: dur });
    });
    content.appendChild(calloutContainer);

    const paramContainer = document.createElement("div");
    paramContainer.className = "border-t border-gray-800 pt-6";
    this.paramSliders = new ParamSliders(
      paramContainer,
      (values) => {
        this.send({ type: "setSceneParams", scene: this.activeScene, params: values });
      },
      () => {
        // Reset: build default values and send
        const meta = SCENE_REGISTRY.find((s) => s.id === this.activeScene);
        if (!meta) return;
        const defaults: Record<string, number | boolean | string> = {};
        for (const p of meta.params) {
          defaults[p.key] = p.default;
        }
        this.send({ type: "setSceneParams", scene: this.activeScene, params: defaults });
      },
    );
    content.appendChild(paramContainer);

    grid.appendChild(content);
    this.root.appendChild(grid);

    // Set initial scene in sliders
    const initialMeta = SCENE_REGISTRY.find((s) => s.id === this.activeScene);
    if (initialMeta) {
      this.paramSliders.setScene(initialMeta.displayName, initialMeta.params);
    }
  }

  dispose(): void {
    this.calloutPanel.dispose();
    this.root.innerHTML = "";
  }
}
