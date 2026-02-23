import type { GlobalParams } from "../engine/Renderer";
import type { EffectsSettings } from "../engine/EffectsLayer";
import type { ParamValues } from "../types/params";
import type { BandMapping } from "../types/bands";
import type { AnimationStyleName } from "../engine/callout-animations";

// ─── Controller → Display ────────────────────────────────────

export type ControlMessage =
  | { type: "setScene"; scene: string }
  | { type: "setGlobalParams"; params: Partial<GlobalParams> }
  | { type: "setTransition"; effect: string; duration: number }
  | { type: "setEffects"; settings: Partial<EffectsSettings> }
  | { type: "setAiMode"; enabled: boolean }
  | { type: "setSceneParams"; scene: string; params: ParamValues }
  | { type: "callout"; name: string; duration: number; animationStyle?: AnimationStyleName }
  | { type: "setOverlay"; scene: string | null; blendMode?: string; opacity?: number }
  | { type: "setBandMappings"; mappings: BandMapping[] }
  | { type: "setCalloutSettings"; autoShow: boolean; interval: number; aiPhrasesEnabled: boolean; aiPhraseInterval: number }
  | { type: "setEmojiRain"; enabled: boolean }
  | { type: "showNextCallout" }
  | { type: "clearCalloutQueue" }
  | { type: "removeFromQueue"; id: string };

// ─── Display → Controller ────────────────────────────────────

export interface AudioTelemetry {
  energy: number;
  bass: number;
  mid: number;
  treble: number;
  spectralCentroid: number;
  beat: boolean;
  bpm: number;
  kick: number;
  beatIntensity: number;
  spectralFlux: number;
}

export interface DisplayTelemetry {
  connected: boolean;
  scene: string;
  fps: number;
}

export interface CalloutQueueItem {
  id: string;
  name: string;
  timestamp: number;
}

export interface FullState {
  activeScene: string;
  globalParams: GlobalParams;
  transition: { effect: string; duration: number };
  effects: EffectsSettings;
  aiMode: { enabled: boolean; lastAction: string };
  overlay: { scene: string; blendMode: string; opacity: number } | null;
  bandMappings: BandMapping[];
  calloutSettings: { autoShow: boolean; interval: number; aiPhrasesEnabled: boolean; aiPhraseInterval: number };
  calloutQueue: CalloutQueueItem[];
  emojiRain: { enabled: boolean };
  sceneParams: Record<string, ParamValues>;
}

export type DisplayMessage =
  | { type: "telemetry"; audio: AudioTelemetry; display: DisplayTelemetry }
  | { type: "stateSync"; state: FullState }
  | { type: "aiAction"; action: string }
  | { type: "calloutQueueUpdate"; queue: CalloutQueueItem[] }
  | { type: "crowdUpdate"; energy: number; connectedCount: number; dominantHue: number };

// ─── Audience → Display ──────────────────────────────────────

export type AudienceMessage =
  | { type: "tapRate"; rate: number }
  | { type: "reaction"; emoji: string; size: number }
  | { type: "color"; hue: number }
  | { type: "shoutout"; name: string };

// ─── Display → Audience ──────────────────────────────────────

export type AudienceResponse =
  | { type: "telemetry"; audio: AudioTelemetry; crowdEnergy: number; connectedCount: number; bpm: number }
  | { type: "shoutoutAck"; status: "queued" | "rateLimited" };

// ─── Handshake ───────────────────────────────────────────────

export interface HelloMessage {
  type: "hello";
  role: "controller" | "audience";
  deviceId?: string;
}
