import type { EnergyLevel } from "./AgentPersonality";

const FALLBACK_PHRASES: Record<EnergyLevel, string[]> = {
  low: [
    // Deep / ambient / sub territory
    "DEEP IN THE SUB",
    "SUBTERRANEAN",
    "ENTER THE VOID",
    "LOW END THEORY",
    "BASS MEDITATION",
    "SUBBASS THERAPY",
    "INFINITE SPACE",
    "DREAM STATE",
    "LOST IN REVERB",
    "FLOATING",
    "ETHEREAL DRIFT",
    "SLOW MOTION",
    "DISSOLVE",
    "BREATHE",
    "SUBAQUATIC",
    "DEEP FREEZE",
    "ZERO GRAVITY",
    "BASS COCOON",
    "DOWNTEMPO DRIP",
    "SUBSONIC LULLABY",
    "AMBIENT WARFARE",
    "REESE WHISPER",
    "DREAD BASS",
    "MURKY DEPTHS",
    "FOG MACHINE",
    "DARK MATTER",
    "MIDNIGHT BASS",
    "BASS WEIGHT",
    "HEAVY MANNERS",
    "PRESSURE DROP",
  ],
  medium: [
    // Building energy / groove locked
    "LOCKED IN",
    "FEEL THE PULSE",
    "RISING UP",
    "MOMENTUM",
    "BUILDING",
    "ENERGY RISING",
    "DIALED IN",
    "WOBBLE FACTOR",
    "BASS FACE",
    "NECK BREAKER",
    "GRIMY",
    "STANK FACE",
    "GET WOBBLY",
    "RIDDIM LOCKED",
    "HALF TIME FILTH",
    "REESE UP",
    "GROWL MODE",
    "SKANK PIT",
    "BASS CANNON",
    "MODULATE",
    "LFO WORSHIP",
    "WUBWUBWUB",
    "STEP CORRECT",
    "DUTTY BASS",
    "RIDDIM SECTION",
    "TWO STEP MADNESS",
    "BASS BIN SHAKER",
    "SPEAKER MELTER",
    "SKANKING",
    "HEADNOD MODE",
    "FORWARD MOTION",
    "SELECTOR",
    "REWIIIND",
    "BIG UP MASSIVE",
    "BASS CULTURE",
    "SOUND SYSTEM",
    "DANCEFLOOR KILLA",
    "HEAVYWEIGHT",
    "PROPER NASTY",
    "CHOOOONE",
  ],
  high: [
    // Intense / aggressive / peak energy
    "MAXIMUM OVERDRIVE",
    "FULL POWER",
    "WARP SPEED",
    "UNLEASHED",
    "OVERLOAD",
    "HYPERDRIVE",
    "UNSTOPPABLE",
    "FILTHY DROP",
    "ABSOLUTE STINKER",
    "FACE MELTER",
    "SPEAKER BLOWER",
    "DISGUSTING BASS",
    "WICKED SICK",
    "BRAIN SPLITTER",
    "SKULL CRUSHER",
    "NASTY NASTY",
    "TEAR OUT",
    "SAVAGE MODE",
    "MURDEROUS BASS",
    "HEAVY ARTILLERY",
    "WALL OF BASS",
    "WEAPON",
    "CERTIFIED BANGER",
    "LETHAL DOSE",
    "DOUBLE DROP",
    "NO MERCY",
    "ABSOLUTE UNIT",
    "GUTTER BASS",
    "SEWER SOUNDS",
    "SWAMP MONSTER",
    "GREASE FIRE",
    "TURBO WOBBLE",
    "BASS TSUNAMI",
    "SONIC ASSAULT",
    "HEADBANGER",
    "MOSH PIT FUEL",
    "PIT STARTER",
    "CROWD KILLA",
    "ROWDY",
    "RINSED OUT",
  ],
  peak: [
    // Maximum chaos / transcendence
    "SEND IT",
    "FILTHIEST DROP",
    "PURE CARNAGE",
    "SUPERNOVA",
    "GO NUCLEAR",
    "PURE ENERGY",
    "TOTAL ANNIHILATION",
    "BASS NUKE",
    "APOCALYPSE BASS",
    "EARTH SHAKER",
    "GOD TIER FILTH",
    "EXTINCTION LEVEL",
    "VAPORIZE",
    "ATOMIC DROP",
    "DESTROY",
    "OBLITERATE",
    "THERMONUCLEAR",
    "BASS QUAKE",
    "SEISMIC EVENT",
    "CATACLYSMIC DROP",
    "RAGNAROK",
    "ARMAGEDDON BASS",
    "ABSOLUTE CHAOS",
    "FULL SEND",
    "NO SURVIVORS",
    "CRITICAL MASS",
    "DETONATE",
    "IMPACT ZONE",
    "BASS ERUPTION",
    "VOLCANIC DROP",
    "DISINTEGRATE",
    "INTERSTELLAR FILTH",
    "DIMENSION RIPPER",
    "REALITY SHATTER",
    "WORMHOLE",
    "TRANSCEND",
    "APEX PREDATOR",
    "FINAL FORM",
    "ULTRA INSTINCT",
    "ASCEND",
  ],
};

interface PhraseCache {
  phrases: string[];
  timestamp: number;
}

// ─── AI Horde (Kobold) Config ────────────────────────────────────
const HORDE_BASE = "https://aihorde.net/api/v2";
const HORDE_ANON_KEY = "0000000000";
const HORDE_CLIENT_AGENT = "RaveSpace:1.0:ravespace.web.app";
const HORDE_POLL_INTERVAL_MS = 2_000;
const HORDE_TIMEOUT_MS = 25_000;

// Models prioritized for speed & availability (low/no queue)
const HORDE_FAST_MODELS = [
  "koboldcpp/TinyLlama-1.1b-chat-v1.0",
  "koboldcpp/Llama-3.2-3B-Instruct-Q4_K_M",
  "koboldcpp/Qwen3-0.6B",
  "TheDrummer/Cydonia-24B-v4.3",
  "koboldcpp/NeonMaid-12B-v2",
  "koboldcpp/mini-magnum-12b-v1.1",
];

// ─── Shared Config ───────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_CACHE_SIZE = 3;
const BATCH_SIZE = 8;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;

type LLMBackend = "horde" | "gemini";

/**
 * AI phrase generator with dual backend support:
 *   1. **AI Horde (Kobold)** — free, crowdsourced, no API key needed
 *   2. **Gemini** — Google's API, requires VITE_GEMINI_API_KEY
 *
 * Falls back to the massive hardcoded dubstep slang list when both fail.
 */
export class GeminiPhraseGen {
  private geminiKey: string;
  private hordeKey: string;
  private cache = new Map<EnergyLevel, PhraseCache>();
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private prefetching = new Set<EnergyLevel>();
  private backend: LLMBackend;

  constructor(geminiKey: string, hordeKey?: string) {
    this.geminiKey = geminiKey;
    this.hordeKey = hordeKey ?? HORDE_ANON_KEY;
    // Prefer Horde (free!) — fall back to Gemini if available
    this.backend = "horde";
    console.log(`[PhraseGen] Backend: AI Horde${geminiKey ? " (Gemini fallback available)" : ""}`);
  }

  async getPhrase(
    energy: EnergyLevel,
    context?: { bpm?: number; scene?: string; vjState?: string },
  ): Promise<string> {
    // Try cached phrases first
    const cached = this.cache.get(energy);
    if (cached && cached.phrases.length > 0 && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const phrase = cached.phrases.shift()!;
      if (cached.phrases.length < MIN_CACHE_SIZE) {
        void this.prefetch(energy, context);
      }
      return phrase;
    }

    // Try fetching new batch from current backend
    if (!this.isCircuitOpen()) {
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
          // If Horde fails, try switching to Gemini
          if (this.backend === "horde" && this.geminiKey) {
            console.warn("[PhraseGen] Horde circuit open, switching to Gemini");
            this.backend = "gemini";
            this.consecutiveFailures = 0;
            this.circuitOpenUntil = 0;
          }
        }
      }
    }

    return this.getFallback(energy);
  }

  async prefetch(
    energy: EnergyLevel,
    context?: { bpm?: number; scene?: string; vjState?: string },
  ): Promise<void> {
    if (this.prefetching.has(energy) || this.isCircuitOpen()) return;
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

  // ─── Backend Router ────────────────────────────────────────────

  private async fetchBatch(
    energy: EnergyLevel,
    context?: { bpm?: number; scene?: string; vjState?: string },
  ): Promise<string[]> {
    if (this.backend === "horde") {
      return this.fetchBatchHorde(energy, context);
    }
    return this.fetchBatchGemini(energy, context);
  }

  // ─── AI Horde (Kobold) Backend ─────────────────────────────────

  private async fetchBatchHorde(
    energy: EnergyLevel,
    context?: { bpm?: number; scene?: string; vjState?: string },
  ): Promise<string[]> {
    const bpm = context?.bpm ?? 0;
    const energyDesc: Record<EnergyLevel, string> = {
      low: "dreamy, ethereal, deep",
      medium: "building, groovy, locked in",
      high: "intense, aggressive, filthy",
      peak: "explosive, chaotic, maximum energy",
    };

    // Few-shot prompt — works great with small models
    const prompt =
      `Short 2-6 word rave/dubstep hype phrases for a live visual show. ` +
      `Energy: ${energy} (${energyDesc[energy]}, ${bpm} BPM). ALL CAPS. Max 25 chars.\n` +
      `1. ${this.getFallback(energy)}\n` +
      `2. ${this.getFallback(energy)}\n` +
      `3. ${this.getFallback(energy)}\n` +
      `4.`;

    // Step 1: Submit async generation
    const submitRes = await fetch(`${HORDE_BASE}/generate/text/async`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.hordeKey,
        "Client-Agent": HORDE_CLIENT_AGENT,
      },
      body: JSON.stringify({
        prompt,
        params: {
          max_length: 80,
          max_context_length: 256,
          temperature: 1.1,
          top_p: 0.9,
          top_k: 40,
          rep_pen: 1.3,
          min_p: 0.05,
          stop_sequence: ["\n\n"],
        },
        models: HORDE_FAST_MODELS,
      }),
    });

    if (!submitRes.ok) {
      throw new Error(`Horde submit failed: ${submitRes.status}`);
    }

    const { id } = (await submitRes.json()) as { id: string };

    // Step 2: Poll for result
    const startTime = Date.now();
    while (Date.now() - startTime < HORDE_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, HORDE_POLL_INTERVAL_MS));

      const pollRes = await fetch(`${HORDE_BASE}/generate/text/status/${id}`, {
        headers: { "Client-Agent": HORDE_CLIENT_AGENT },
      });

      if (!pollRes.ok) continue;

      const status = await pollRes.json();

      if (status.faulted || !status.is_possible) {
        throw new Error("Horde request faulted or impossible");
      }

      if (status.done && status.generations?.length > 0) {
        const rawText: string = status.generations[0].text ?? "";
        return this.parseHordeOutput(rawText);
      }
    }

    throw new Error("Horde polling timed out");
  }

  private parseHordeOutput(raw: string): string[] {
    return raw
      .split("\n")
      .map((line: string) =>
        line
          .replace(/^\d+\.\s*/, "")       // Remove "5. " numbering
          .replace(/["""'']/g, "")         // Remove quotes
          .replace(/\(.*?\)/g, "")         // Remove parentheticals
          .replace(/[-–—].*$/, "")         // Remove attribution " - Artist"
          .trim()
          .toUpperCase(),
      )
      .filter((line: string) => line.length >= 3 && line.length <= 25)
      .slice(0, BATCH_SIZE);
  }

  // ─── Gemini Backend ────────────────────────────────────────────

  private async fetchBatchGemini(
    energy: EnergyLevel,
    context?: { bpm?: number; scene?: string; vjState?: string },
  ): Promise<string[]> {
    if (!this.geminiKey) throw new Error("No Gemini API key");

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`,
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

  // ─── Fallback ──────────────────────────────────────────────────

  private getFallback(energy: EnergyLevel): string {
    const pool = FALLBACK_PHRASES[energy];
    return pool[Math.floor(Math.random() * pool.length)]!;
  }
}
