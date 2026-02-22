import type { EnergyLevel } from "./AgentPersonality";

const FALLBACK_PHRASES: Record<EnergyLevel, string[]> = {
  low: [
    "DREAM STATE",
    "ENTER THE VOID",
    "INFINITE SPACE",
    "BREATHE",
    "DEEP INSIDE",
    "LOST IN TIME",
    "FLOATING",
    "ETHEREAL",
    "SLOW MOTION",
    "DISSOLVE",
  ],
  medium: [
    "FEEL THE PULSE",
    "RISING UP",
    "LOCKED IN",
    "MOMENTUM",
    "BUILDING",
    "LET IT FLOW",
    "CONNECT",
    "ENERGY RISING",
    "DIALED IN",
    "MOVING",
  ],
  high: [
    "MAXIMUM OVERDRIVE",
    "NO LIMITS",
    "FULL POWER",
    "WARP SPEED",
    "UNLEASHED",
    "OVERLOAD",
    "HYPERDRIVE",
    "UNSTOPPABLE",
    "IGNITION",
    "ALL SYSTEMS GO",
  ],
  peak: [
    "SEND IT",
    "ABSOLUTE PEAK",
    "TRANSCEND",
    "EUPHORIA",
    "SUPERNOVA",
    "LIFT OFF",
    "MAXIMUM",
    "APEX",
    "GO NUCLEAR",
    "PURE ENERGY",
  ],
};

interface PhraseCache {
  phrases: string[];
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_CACHE_SIZE = 3;
const BATCH_SIZE = 8;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export class GeminiPhraseGen {
  private apiKey: string;
  private cache = new Map<EnergyLevel, PhraseCache>();
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private prefetching = new Set<EnergyLevel>();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getPhrase(
    energy: EnergyLevel,
    context?: { bpm?: number; scene?: string; vjState?: string },
  ): Promise<string> {
    // Try cached Gemini phrases first
    const cached = this.cache.get(energy);
    if (cached && cached.phrases.length > 0 && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const phrase = cached.phrases.shift()!;
      // Auto-refill if running low
      if (cached.phrases.length < MIN_CACHE_SIZE) {
        void this.prefetch(energy, context);
      }
      return phrase;
    }

    // Try fetching new batch
    if (this.apiKey && !this.isCircuitOpen()) {
      try {
        const phrases = await this.fetchBatch(energy, context);
        if (phrases.length > 0) {
          const first = phrases.shift()!;
          this.cache.set(energy, { phrases, timestamp: Date.now() });
          this.consecutiveFailures = 0;
          return first;
        }
      } catch {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          this.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        }
      }
    }

    // Fallback to hardcoded phrases
    return this.getFallback(energy);
  }

  /** Prefetch phrases for an energy level in the background */
  async prefetch(
    energy: EnergyLevel,
    context?: { bpm?: number; scene?: string; vjState?: string },
  ): Promise<void> {
    if (this.prefetching.has(energy) || !this.apiKey || this.isCircuitOpen()) return;
    this.prefetching.add(energy);
    try {
      const phrases = await this.fetchBatch(energy, context);
      if (phrases.length > 0) {
        const existing = this.cache.get(energy);
        const merged = existing && Date.now() - existing.timestamp < CACHE_TTL_MS
          ? [...existing.phrases, ...phrases]
          : phrases;
        this.cache.set(energy, { phrases: merged, timestamp: Date.now() });
        this.consecutiveFailures = 0;
      }
    } catch {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      }
    } finally {
      this.prefetching.delete(energy);
    }
  }

  private isCircuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  private async fetchBatch(
    energy: EnergyLevel,
    context?: { bpm?: number; scene?: string; vjState?: string },
  ): Promise<string[]> {
    const bpm = context?.bpm ?? 0;
    const scene = context?.scene ?? "unknown";
    const vjState = context?.vjState ?? "idle";

    const systemPrompt =
      "You are the AI hype voice for a live rave visual performance. " +
      "Generate short, punchy phrases (2-6 words) for giant text overlays. " +
      "Style: raw, visceral, rave culture. Never profanity. Max 25 characters.";

    const userPrompt =
      `Generate ${BATCH_SIZE} phrases for:\n` +
      `- Energy: ${energy} (${bpm} BPM)\n` +
      `- Visual: ${scene}\n` +
      `- State: ${vjState}\n` +
      `Rules: low=dreamy/ethereal, medium=building, high=intense, peak=explosive\n` +
      `Return ONLY phrases, one per line.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 200,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return text
      .split("\n")
      .map((line: string) => line.trim().toUpperCase())
      .filter((line: string) => line.length > 0 && line.length <= 25)
      .slice(0, BATCH_SIZE);
  }

  private getFallback(energy: EnergyLevel): string {
    const pool = FALLBACK_PHRASES[energy];
    return pool[Math.floor(Math.random() * pool.length)]!;
  }
}
