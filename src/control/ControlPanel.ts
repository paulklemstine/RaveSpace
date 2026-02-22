import { ref, set, onValue, type Unsubscribe } from "firebase/database";
import { db } from "../firebase/config";
import { SCENE_REGISTRY } from "../scenes/registry";
import type { ParamValues } from "../types/params";
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
  private unsubscribers: Unsubscribe[] = [];
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

  constructor(root: HTMLElement) {
    this.root = root;
  }

  init(): void {
    this.buildLayout();
    this.wireListeners();
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
      void set(ref(db, "ravespace/control/activeScene"), sceneId);
    });

    this.audioMeters = new AudioMeters(sidebar);
    this.bpmDisplay = new BpmDisplay(sidebar);

    grid.appendChild(sidebar);

    // Right content
    const content = document.createElement("div");
    content.className = "space-y-6";

    this.globalControls = new GlobalControls(content, (values) => {
      void set(ref(db, "ravespace/control/globalParams"), values);
    });

    const transitionContainer = document.createElement("div");
    transitionContainer.className = "border-t border-gray-800 pt-6";
    this.transitionPicker = new TransitionPicker(transitionContainer, (settings) => {
      void set(ref(db, "ravespace/control/transition"), settings);
    });
    content.appendChild(transitionContainer);

    const effectsContainer = document.createElement("div");
    effectsContainer.className = "border-t border-gray-800 pt-6";
    this.effectsControls = new EffectsControls(effectsContainer, (values) => {
      void set(ref(db, "ravespace/control/effects"), values);
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
      if (!scene) {
        void set(ref(db, "ravespace/control/overlay"), null);
      } else {
        void set(ref(db, "ravespace/control/overlay"), {
          scene,
          blendMode: blendSelect.value,
          opacity: parseInt(opacitySlider.value, 10) / 100,
        });
      }
    };
    overlaySelect.addEventListener("change", writeOverlay);
    blendSelect.addEventListener("change", writeOverlay);
    opacitySlider.addEventListener("input", writeOverlay);

    const aiContainer = document.createElement("div");
    aiContainer.className = "border-t border-gray-800 pt-6";
    this.aiControls = new AIControls(aiContainer, (values) => {
      void set(ref(db, "ravespace/control/aiMode"), values);
    });
    content.appendChild(aiContainer);

    const calloutContainer = document.createElement("div");
    calloutContainer.className = "border-t border-gray-800 pt-6";
    this.calloutPanel = new CalloutPanel(calloutContainer);
    content.appendChild(calloutContainer);

    const paramContainer = document.createElement("div");
    paramContainer.className = "border-t border-gray-800 pt-6";
    this.paramSliders = new ParamSliders(
      paramContainer,
      (values) => {
        void set(ref(db, `ravespace/control/sceneParams/${this.activeScene}`), values);
      },
      () => {
        // Reset: build default values and write
        const meta = SCENE_REGISTRY.find((s) => s.id === this.activeScene);
        if (!meta) return;
        const defaults: ParamValues = {};
        for (const p of meta.params) {
          defaults[p.key] = p.default;
        }
        void set(ref(db, `ravespace/control/sceneParams/${this.activeScene}`), defaults);
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

  private wireListeners(): void {
    // Listen to telemetry/audio
    const audioRef = ref(db, "ravespace/telemetry/audio");
    this.unsubscribers.push(
      onValue(audioRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          this.audioMeters.update({
            bass: data.bass ?? 0,
            mid: data.mid ?? 0,
            treble: data.treble ?? 0,
            energy: data.energy ?? 0,
          });
          this.bpmDisplay.update(data.bpm ?? 0, data.beat ?? false);
        }
      }),
    );

    // Listen to telemetry/display for connection status
    const displayRef = ref(db, "ravespace/telemetry/display");
    this.unsubscribers.push(
      onValue(displayRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const stale = Date.now() - (data.timestamp ?? 0) > 5000;
          this.connectionStatus.update(data.connected === true && !stale);
        } else {
          this.connectionStatus.update(false);
        }
      }),
    );

    // Listen to control/activeScene to keep UI in sync
    const sceneRef = ref(db, "ravespace/control/activeScene");
    this.unsubscribers.push(
      onValue(sceneRef, (snapshot) => {
        const sceneName = snapshot.val() as string | null;
        if (sceneName && sceneName !== this.activeScene) {
          this.activeScene = sceneName;
          this.scenePicker.update(sceneName);

          const meta = SCENE_REGISTRY.find((s) => s.id === sceneName);
          if (meta) {
            this.paramSliders.setScene(meta.displayName, meta.params);
          }
        }
      }),
    );

    // Listen to control/globalParams to keep UI in sync
    const globalRef = ref(db, "ravespace/control/globalParams");
    this.unsubscribers.push(
      onValue(globalRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          this.globalControls.update(data);
        }
      }),
    );

    // Listen to control/transition to keep UI in sync
    const transitionRef = ref(db, "ravespace/control/transition");
    this.unsubscribers.push(
      onValue(transitionRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          this.transitionPicker.update(data);
        }
      }),
    );

    // Listen to control/effects to keep UI in sync
    const effectsRef = ref(db, "ravespace/control/effects");
    this.unsubscribers.push(
      onValue(effectsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          this.effectsControls.update(data);
        }
      }),
    );

    // Listen to control/aiMode to keep UI in sync
    const aiRef = ref(db, "ravespace/control/aiMode");
    this.unsubscribers.push(
      onValue(aiRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          this.aiControls.update(data);
        }
      }),
    );

    // Listen to control/sceneParams for each scene
    for (const scene of SCENE_REGISTRY) {
      const paramRef = ref(db, `ravespace/control/sceneParams/${scene.id}`);
      this.unsubscribers.push(
        onValue(paramRef, (snapshot) => {
          const values = snapshot.val() as ParamValues | null;
          if (values && scene.id === this.activeScene) {
            this.paramSliders.updateValues(values);
          }
        }),
      );
    }
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.root.innerHTML = "";
  }
}
