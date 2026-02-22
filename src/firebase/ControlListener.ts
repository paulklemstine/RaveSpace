import { ref, onValue, type Unsubscribe } from "firebase/database";
import { db } from "./config";
import type { Renderer, GlobalParams } from "../engine/Renderer";
import type { SceneManager } from "../engine/SceneManager";
import type { ParamValues } from "../types/params";
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

    // Listen for overlay scene composite settings
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
        // Only set if overlay scene changed
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
