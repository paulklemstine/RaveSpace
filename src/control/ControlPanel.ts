import { SCENE_REGISTRY } from "../scenes/registry";
import type { ParamValues } from "../types/params";
import type { ControlMessage, DisplayMessage, FullState } from "../comms/messages";
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
    this.connectionStatus.update(true);
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
        this.applyFullState(msg.state);
        break;

      case "aiAction":
        this.aiControls.update({ lastAction: msg.action });
        break;

      case "calloutQueueUpdate":
        this.calloutPanel.updateQueue(msg.queue);
        break;

      case "crowdUpdate":
        // Could display crowd stats in the future
        break;
    }
  }

  private applyFullState(state: FullState): void {
    // Active scene
    if (state.activeScene) {
      this.activeScene = state.activeScene;
      this.scenePicker.update(state.activeScene);
      const meta = SCENE_REGISTRY.find((s) => s.id === state.activeScene);
      if (meta) {
        this.paramSliders.setScene(meta.displayName, meta.params);
      }
    }

    // Global params
    if (state.globalParams) {
      this.globalControls.update(state.globalParams);
    }

    // Transition
    if (state.transition) {
      this.transitionPicker.update(state.transition);
    }

    // Effects
    if (state.effects) {
      this.effectsControls.update(state.effects);
    }

    // AI mode
    if (state.aiMode) {
      this.aiControls.update(state.aiMode);
    }

    // Callout settings
    if (state.calloutSettings) {
      this.calloutPanel.updateSettings(state.calloutSettings);
    }

    // Callout queue
    if (state.calloutQueue) {
      this.calloutPanel.updateQueue(state.calloutQueue);
    }

    // Scene params
    if (state.sceneParams?.[state.activeScene]) {
      this.paramSliders.updateValues(state.sceneParams[state.activeScene]!);
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
      this.send({ type: "setScene", scene: sceneId });
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
      this.send({ type: "setTransition", ...settings });
    });
    content.appendChild(transitionContainer);

    const effectsContainer = document.createElement("div");
    effectsContainer.className = "border-t border-gray-800 pt-6";
    this.effectsControls = new EffectsControls(effectsContainer, (values) => {
      this.send({ type: "setEffects", settings: values });
    });
    content.appendChild(effectsContainer);

    // --- Overlay / Composite controls ---
    const overlayContainer = document.createElement("div");
    overlayContainer.className = "border-t border-gray-800 pt-6";

    const overlayTitle = document.createElement("h2");
    overlayTitle.textContent = "Layer Composite";
    overlayTitle.className = "text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4";
    overlayContainer.appendChild(overlayTitle);

    const overlayGrid = document.createElement("div");
    overlayGrid.className = "grid grid-cols-3 gap-3";

    // Overlay scene select
    const sceneGroup = document.createElement("div");
    const sceneLabel = document.createElement("label");
    sceneLabel.textContent = "Overlay Scene";
    sceneLabel.className = "block text-xs text-gray-500 mb-1";
    sceneGroup.appendChild(sceneLabel);

    const overlaySelect = document.createElement("select");
    overlaySelect.className = "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white";
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "None";
    overlaySelect.appendChild(noneOpt);
    for (const s of SCENE_REGISTRY) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.displayName;
      overlaySelect.appendChild(opt);
    }
    sceneGroup.appendChild(overlaySelect);
    overlayGrid.appendChild(sceneGroup);

    // Blend mode select
    const blendGroup = document.createElement("div");
    const blendLabel = document.createElement("label");
    blendLabel.textContent = "Blend Mode";
    blendLabel.className = "block text-xs text-gray-500 mb-1";
    blendGroup.appendChild(blendLabel);

    const blendSelect = document.createElement("select");
    blendSelect.className = "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white";
    for (const mode of ["additive", "screen", "multiply", "overlay", "difference"]) {
      const opt = document.createElement("option");
      opt.value = mode;
      opt.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
      blendSelect.appendChild(opt);
    }
    blendGroup.appendChild(blendSelect);
    overlayGrid.appendChild(blendGroup);

    // Opacity slider
    const opacityGroup = document.createElement("div");
    const opacityLabel = document.createElement("label");
    opacityLabel.textContent = "Opacity";
    opacityLabel.className = "block text-xs text-gray-500 mb-1";
    opacityGroup.appendChild(opacityLabel);

    const opacitySlider = document.createElement("input");
    opacitySlider.type = "range";
    opacitySlider.min = "0";
    opacitySlider.max = "100";
    opacitySlider.value = "50";
    opacitySlider.className = "w-full accent-purple-500";
    opacityGroup.appendChild(opacitySlider);
    overlayGrid.appendChild(opacityGroup);

    overlayContainer.appendChild(overlayGrid);
    content.appendChild(overlayContainer);

    // Wire overlay controls
    const writeOverlay = () => {
      const scene = overlaySelect.value || null;
      this.send({
        type: "setOverlay",
        scene,
        blendMode: blendSelect.value,
        opacity: parseInt(opacitySlider.value, 10) / 100,
      });
    };
    overlaySelect.addEventListener("change", writeOverlay);
    blendSelect.addEventListener("change", writeOverlay);
    opacitySlider.addEventListener("input", writeOverlay);

    const aiContainer = document.createElement("div");
    aiContainer.className = "border-t border-gray-800 pt-6";
    this.aiControls = new AIControls(aiContainer, (values) => {
      this.send({ type: "setAiMode", enabled: values.enabled });
    });
    content.appendChild(aiContainer);

    const calloutContainer = document.createElement("div");
    calloutContainer.className = "border-t border-gray-800 pt-6";
    this.calloutPanel = new CalloutPanel(calloutContainer, {
      onShowCallout: (name, duration, animationStyle) => {
        this.send({ type: "callout", name, duration, animationStyle });
      },
      onSettingsChange: (settings) => {
        this.send({ type: "setCalloutSettings", ...settings });
      },
      onShowNext: () => {
        this.send({ type: "showNextCallout" });
      },
      onClearQueue: () => {
        this.send({ type: "clearCalloutQueue" });
      },
      onRemoveFromQueue: (id) => {
        this.send({ type: "removeFromQueue", id });
      },
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
        const defaults: ParamValues = {};
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
