import type { GlobalParams } from "../engine/Renderer";
import type { EffectsSettings } from "../engine/EffectsLayer";
import type { ParamValues } from "../types/params";

// --- Control → Display ---

export type ControlMessage =
  | { type: "setScene"; scene: string }
  | { type: "setGlobalParams"; params: Partial<GlobalParams> }
  | { type: "setTransition"; effect: string; duration: number }
  | { type: "setEffects"; settings: Partial<EffectsSettings> }
  | { type: "setAiMode"; enabled: boolean }
  | { type: "setSceneParams"; scene: string; params: ParamValues }
  | { type: "callout"; name: string; duration: number };

// --- Display → Controller ---

export interface AudioTelemetry {
  energy: number;
  bass: number;
  mid: number;
  treble: number;
  spectralCentroid: number;
  beat: boolean;
  bpm: number;
}

export interface DisplayTelemetry {
  scene: string;
  fps: number;
}

export interface FullState {
  activeScene: string;
  globalParams: GlobalParams;
  transition: { effect: string; duration: number };
  effects: EffectsSettings;
  aiEnabled: boolean;
}

export type DisplayMessage =
  | { type: "telemetry"; audio: AudioTelemetry; display: DisplayTelemetry }
  | { type: "stateSync"; state: FullState }
  | { type: "aiAction"; action: string };

// --- Audience → Display ---

export type AudienceMessage = { type: "calloutRequest"; name: string };

// --- Display → Audience ---

export type AudienceResponse =
  | { type: "calloutQueued" }
  | { type: "rateLimited" };

// --- Shared handshake ---

export interface HelloMessage {
  type: "hello";
  role: "controller" | "audience";
}
