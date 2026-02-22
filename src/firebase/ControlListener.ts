import { ref, onValue, type Unsubscribe } from "firebase/database";
import { db } from "./config";
import type { Renderer, GlobalParams } from "../engine/Renderer";
import type { SceneManager } from "../engine/SceneManager";
import type { ParamValues } from "../types/params";
import type { BandMapping } from "../types/bands";
import type { EffectsSettings } from "../engine/EffectsLayer";

export class ControlListener {
  private renderer: Renderer;
  private sceneManager: SceneManager;
  private unsubscribers: Unsubscribe[] = [];

  constructor(renderer: Renderer, sceneManager: SceneManager) {
    this.renderer = renderer;
    this.sceneManager = sceneManager;
  }

  start(): void {
    // Listen for active scene changes
    const sceneRef = ref(db, "ravespace/control/activeScene");
    this.unsubscribers.push(
      onValue(sceneRef, (snapshot) => {
        const sceneName = snapshot.val() as string | null;
        if (sceneName && sceneName !== this.renderer.getActiveSceneName()) {
          try {
            this.renderer.setSceneByName(sceneName, this.sceneManager);
          } catch (e) {
            console.warn("Failed to switch scene:", e);
          }
        }
      }),
    );

    // Listen for global param changes
    const globalRef = ref(db, "ravespace/control/globalParams");
    this.unsubscribers.push(
      onValue(globalRef, (snapshot) => {
        const params = snapshot.val() as Partial<GlobalParams> | null;
        if (params) {
          this.renderer.setGlobalParams(params);
        }
      }),
    );

    // Listen for transition changes
    const transitionRef = ref(db, "ravespace/control/transition");
    this.unsubscribers.push(
      onValue(transitionRef, (snapshot) => {
        const data = snapshot.val() as { effect?: string; duration?: number } | null;
        if (data?.effect) {
          this.renderer.setTransition(data.effect, data.duration ?? 3);
        }
      }),
    );

    // Listen for effects settings changes
    const effectsRef = ref(db, "ravespace/control/effects");
    this.unsubscribers.push(
      onValue(effectsRef, (snapshot) => {
        const data = snapshot.val() as Partial<EffectsSettings> | null;
        if (data) {
          this.renderer.setEffectsSettings(data);
        }
      }),
    );

    // Listen for multi-layer overlay settings (up to 3 overlays = 4 total layers)
    const overlaysRef = ref(db, "ravespace/control/overlays");
    this.unsubscribers.push(
      onValue(overlaysRef, (snapshot) => {
        const data = snapshot.val() as Array<{
          scene?: string;
          blendMode?: string;
          opacity?: number;
        }> | null;
        if (!data || !Array.isArray(data)) {
          this.renderer.clearAllOverlays();
          return;
        }
        for (let i = 0; i < 3; i++) {
          const layerData = data[i];
          if (!layerData?.scene) {
            this.renderer.clearOverlayLayer(i);
            continue;
          }
          if (layerData.scene !== this.renderer.getOverlayLayerName(i)) {
            try {
              this.renderer.setOverlayLayer(
                i,
                layerData.scene,
                this.sceneManager,
                layerData.blendMode ?? "screen",
                layerData.opacity ?? 0.3,
              );
            } catch (e) {
              console.warn(`Failed to set overlay layer ${i}:`, e);
            }
          } else {
            if (layerData.blendMode) {
              this.renderer.setOverlayLayerBlendMode(i, layerData.blendMode);
            }
            if (layerData.opacity !== undefined) {
              this.renderer.setOverlayLayerOpacity(i, layerData.opacity);
            }
          }
        }
      }),
    );

    // Legacy single-overlay listener (backward compat)
    const overlayRef = ref(db, "ravespace/control/overlay");
    this.unsubscribers.push(
      onValue(overlayRef, (snapshot) => {
        const data = snapshot.val() as {
          scene?: string;
          blendMode?: string;
          opacity?: number;
        } | null;
        if (!data || !data.scene) {
          this.renderer.clearOverlayScene();
          return;
        }
        if (data.scene !== this.renderer.getOverlaySceneName()) {
          try {
            this.renderer.setOverlayScene(data.scene, this.sceneManager);
          } catch (e) {
            console.warn("Failed to set overlay scene:", e);
          }
        }
        if (data.blendMode) {
          this.renderer.setBlendMode(data.blendMode);
        }
        if (data.opacity !== undefined) {
          this.renderer.setOverlayOpacity(data.opacity);
        }
      }),
    );

    // Listen for band→param mapping changes
    const bandMappingsRef = ref(db, "ravespace/control/bandMappings");
    this.unsubscribers.push(
      onValue(bandMappingsRef, (snapshot) => {
        const data = snapshot.val() as BandMapping[] | null;
        if (data && Array.isArray(data)) {
          this.renderer.setBandMappings(data);
        } else {
          this.renderer.setBandMappings([]);
        }
      }),
    );

    // Listen for per-scene param changes for each registered scene
    for (const name of this.sceneManager.list()) {
      const paramRef = ref(db, `ravespace/control/sceneParams/${name}`);
      this.unsubscribers.push(
        onValue(paramRef, (snapshot) => {
          const values = snapshot.val() as ParamValues | null;
          if (values && name === this.renderer.getActiveSceneName()) {
            this.renderer.setSceneParams(values);
          }
        }),
      );
    }
  }

  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }
}
