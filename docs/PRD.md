# RaveSpace — Product Requirements Document

## Overview

RaveSpace is a web-based live visual performance system for raves and events. A **display computer** connected to a large TV/projector loads a full-screen webpage from Firebase Hosting that renders audio-reactive visuals. A **development computer** is used to write and deploy new visual code. When a deploy lands, the display transitions gracefully from the current visuals to the new ones — no jarring cuts, no page reloads, no dropped frames.

## Problem Statement

Live VJ software (TouchDesigner, Resolume, VDMX) requires specialized knowledge and expensive licenses. Code-based visual tools (Hydra, p5.js) lack a deployment pipeline that supports graceful live transitions. There is no simple system where a developer can `firebase deploy` and have a remote display smoothly crossfade to the new visuals while music is playing.

## Users

| Role | Description |
|------|-------------|
| **VJ / Developer** | Writes visual code on a laptop, deploys to Firebase. May adjust parameters mid-show. |
| **Display** | A computer (could be a Raspberry Pi, old laptop, or dedicated machine) running Chrome full-screen, connected to a TV/projector at the venue. |

## Core Requirements

### 1. Display App (TV Screen)

**Must have:**
- Full-screen, borderless visual rendering at 60 FPS / 1080p minimum
- Audio-reactive: captures venue audio via microphone/line-in, analyzes in real-time
- Automatic version detection: listens to Firebase RTDB for deploy notifications
- Graceful transitions: crossfades between old and new visuals using GL Transitions (configurable duration and effect)
- Auto-recovery: if new scene fails to load, falls back to previous scene
- "Start Show" button to satisfy browser autoplay policies (AudioContext + fullscreen)
- Runs indefinitely without memory leaks or performance degradation

**Nice to have:**
- Multiple transition effects (dissolve, glitch, wipe, pixelate)
- Configurable transition duration per deploy
- Display diagnostic overlay (FPS, audio level, current scene, connection status) toggled by keypress
- Screensaver mode when no deploys have happened (ambient generative visuals)

### 2. Scene System

**Must have:**
- Scene interface: every visual implements `init(gl, canvas)`, `update(time, dt, audioFeatures)`, `resize(w, h)`, `dispose()`
- Support three scene types:
  - **GLSL Fragment Shaders**: full-screen quad with custom fragment shader. Uniforms for time, resolution, audio bands, beat.
  - **Three.js 3D**: arbitrary Three.js scenes with camera, geometry, materials, post-processing.
  - **2D Generative**: Canvas 2D or p5.js-style procedural art with audio mapping.
- Each scene is a standalone module that can be independently loaded/unloaded
- Scenes receive normalized audio features (0-1 range) per frame:
  - `bass`, `mid`, `treble` (frequency band energies)
  - `rms` (overall loudness)
  - `spectralCentroid` (brightness of sound)
  - `beat` (boolean, true on detected beats)
  - `bpm` (estimated BPM)

**Nice to have:**
- Scene metadata (name, author, preferred transition, thumbnail)
- Scene parameter presets
- Hot-reloadable shader code via RTDB (push shader source as string, compile on display)

### 3. Audio Pipeline

**Must have:**
- Capture audio via `getUserMedia()` (microphone/line-in)
- FFT analysis via Web Audio API `AnalyserNode`
- Feature extraction via Meyda.js:
  - RMS (energy/loudness)
  - Spectral Centroid (brightness)
  - Frequency band splitting (sub-bass, bass, low-mid, mid, upper-mid, treble)
- Beat detection via `realtime-bpm-analyzer`
- Smooth interpolation of audio features (no jitter between frames)
- All features normalized to 0-1 range for easy shader/animation mapping

**Nice to have:**
- Configurable FFT size (512, 1024, 2048, 4096)
- Audio gain control (for noisy venues)
- Visual audio level meter in diagnostic overlay

### 4. Transition Engine

**Must have:**
- Render old scene to WebGL render target (texture A)
- Render new scene to separate render target (texture B)
- Apply GL Transition shader mixing A → B over `progress` (0.0 to 1.0)
- Configurable transition duration (default: 3 seconds)
- At least one transition effect (crossfade/dissolve)
- Old scene disposed after transition completes

**Nice to have:**
- Multiple transition effects from GL Transitions library (~80 effects)
- Transition effect selectable per deploy (via RTDB metadata)
- Easing functions for transition progress (linear, ease-in-out, etc.)

### 5. Version Detection & Deploy Pipeline

**Must have:**
- Post-deploy script (npm script or Firebase post-deploy hook) writes a version identifier to Firebase RTDB at `/ravespace/version`
- Display app listens to RTDB path with `onValue()`
- On version change: fetch new `index.html`, extract new asset URLs, dynamically import new scene module
- Version identifier = content hash or timestamp

**Nice to have:**
- Deploy metadata in RTDB: `{ version, sceneName, transitionType, transitionDuration, timestamp }`
- Deploy history log in RTDB for debugging
- Rollback support: write a previous version to RTDB to revert

### 6. Firebase Infrastructure

**Must have:**
- Firebase Hosting for static asset delivery (Vite build output)
- Firebase RTDB for version signaling
- `firebase.json` configured with:
  - `no-cache` on `index.html`
  - Long cache (`immutable`) on content-hashed JS/CSS
- Single Firebase project (can share with CollabBoard or be separate)

**Nice to have:**
- Firebase RTDB paths for live parameter overrides (intensity, speed, color adjustments without redeploying)
- Firebase Auth for securing the RTDB writes (so random people can't hijack the show)

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│  DEVELOPMENT COMPUTER                                │
│                                                      │
│  Visual Code (scenes/) ──→ Vite Build ──→ firebase   │
│                              deploy                  │
│                                │                     │
│                                ▼                     │
│                    Post-deploy script writes          │
│                    version to Firebase RTDB           │
└─────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   Firebase Services   │
                    │  ┌─────────────────┐  │
                    │  │  Hosting (CDN)  │  │
                    │  │  Static assets  │  │
                    │  └─────────────────┘  │
                    │  ┌─────────────────┐  │
                    │  │   RTDB          │  │
                    │  │   /version      │  │
                    │  │   /params       │  │
                    │  └─────────────────┘  │
                    └───────────┬───────────┘
                                │
┌───────────────────────────────┴─────────────────────┐
│  DISPLAY COMPUTER (Chrome Fullscreen → TV)           │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │  Audio   │──→│ Feature  │──→│  Scene Renderer  │ │
│  │  Input   │   │ Extractor│   │  (WebGL/Three.js)│ │
│  │  (Mic)   │   │ (Meyda)  │   │                  │ │
│  └──────────┘   └──────────┘   └────────┬─────────┘ │
│                                         │            │
│  ┌──────────┐   ┌──────────┐   ┌────────▼─────────┐ │
│  │  RTDB    │──→│ Version  │──→│  Transition      │ │
│  │ Listener │   │ Watcher  │   │  Engine          │ │
│  └──────────┘   └──────────┘   │  (GL Transitions)│ │
│                                └──────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Build | Vite |
| 3D Rendering | Three.js (WebGPU with WebGL fallback) |
| Shaders | GLSL (fragment shaders, ISF-compatible where possible) |
| 2D Generative | Canvas 2D API or p5.js |
| Transitions | GL Transitions (GLSL crossfade library) |
| Audio Analysis | Web Audio API + Meyda.js |
| Beat Detection | realtime-bpm-analyzer |
| Hosting | Firebase Hosting |
| Real-time Signaling | Firebase RTDB |
| Styling (UI elements) | Tailwind CSS |
| Testing | Vitest |

## File Structure

```
RaveSpace/
├── CLAUDE.md
├── firebase.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── .claude/
│   ├── skills/
│   │   ├── documentation/SKILL.md
│   │   ├── git-workflow/SKILL.md
│   │   └── testing/SKILL.md
│   └── tracking/key-prompts/
├── docs/
│   ├── PRD.md                    ← this file
│   ├── ARCHITECTURE.md
│   └── AI_DEVELOPMENT_LOG.md
├── public/
│   └── favicon.ico
├── src/
│   ├── main.ts                   # Entry point — boots display app
│   ├── types/
│   │   ├── scene.ts              # Scene interface
│   │   └── audio.ts              # AudioFeatures interface
│   ├── engine/
│   │   ├── SceneManager.ts       # Loads, switches, disposes scenes
│   │   ├── TransitionEngine.ts   # GL Transition crossfade renderer
│   │   └── Renderer.ts           # Core WebGL setup, render loop
│   ├── audio/
│   │   ├── AudioAnalyzer.ts      # Web Audio API + Meyda pipeline
│   │   ├── BeatDetector.ts       # realtime-bpm-analyzer wrapper
│   │   └── AudioFeatures.ts      # Normalized feature extraction
│   ├── firebase/
│   │   ├── config.ts             # Firebase app init
│   │   └── VersionWatcher.ts     # RTDB listener for deploy versions
│   ├── scenes/
│   │   ├── PlasmaShader.ts       # Example: GLSL plasma effect
│   │   ├── ParticleField.ts      # Example: Three.js particle system
│   │   └── FlowField.ts          # Example: 2D generative flow field
│   ├── shaders/
│   │   ├── plasma.frag           # GLSL fragment shader
│   │   ├── tunnel.frag
│   │   └── transitions/
│   │       ├── crossfade.frag    # Default transition
│   │       └── glitch.frag       # Glitch transition
│   └── ui/
│       └── StartScreen.ts        # "Start Show" button (autoplay policy)
└── scripts/
    └── post-deploy.ts            # Writes version to RTDB after deploy
```

## Scene Interface

```typescript
interface AudioFeatures {
  bass: number;          // 0-1, sub-bass + bass energy
  mid: number;           // 0-1, mid-range energy
  treble: number;        // 0-1, high frequency energy
  rms: number;           // 0-1, overall loudness
  spectralCentroid: number; // 0-1, normalized brightness
  beat: boolean;         // true on detected beat
  bpm: number;           // estimated BPM
  raw: Float32Array;     // raw FFT data for advanced use
}

interface Scene {
  readonly name: string;
  init(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext): Promise<void>;
  update(time: number, dt: number, audio: AudioFeatures): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
```

## Deploy & Transition Flow

```
Developer runs: npm run deploy
  1. Vite builds to dist/
  2. firebase deploy --only hosting
  3. Post-deploy script runs:
     - Computes content hash of dist/
     - Writes { version: hash, timestamp, sceneName } to RTDB /ravespace/version

Display app:
  1. RTDB onValue fires with new version
  2. Fetches new index.html from CDN (no-cache header ensures fresh)
  3. Extracts new JS bundle URL from <script> tag
  4. Dynamically imports new scene module
  5. Calls newScene.init() — renders first frames off-screen to warm up
  6. TransitionEngine crossfades currentScene → newScene over 3 seconds
  7. Calls oldScene.dispose()
  8. newScene becomes currentScene
```

## Non-Goals (v1)

- **No control panel UI** — v1 is deploy-based only. Real-time parameter control is a future enhancement.
- **No multi-display sync** — single display output only.
- **No video input** — no camera feeds or video mixing. Pure generative visuals.
- **No mobile display support** — optimized for desktop Chrome on the TV computer.
- **No audio output** — display app only analyzes audio, doesn't produce it.

## Success Criteria

1. A deployed visual renders full-screen at 60 FPS on the display computer
2. Audio from the venue mic drives visible changes in the visuals (bass hits = visual pulses)
3. Running `npm run deploy` from the dev computer causes the display to transition to the new visual within 10 seconds, with a smooth crossfade and zero dropped frames during the transition
4. At least 3 distinct visual scenes ship with v1 (one shader, one 3D, one 2D generative)
5. The display runs for 4+ hours without memory leaks or crashes

## Implementation Phases

### Phase 1: Foundation
- Project scaffolding (Vite + TypeScript + Tailwind)
- Firebase setup (Hosting + RTDB)
- Core render loop with a single hardcoded shader scene
- "Start Show" button for autoplay policy

### Phase 2: Audio Pipeline
- Mic capture via getUserMedia
- Meyda.js integration for feature extraction
- Beat detection
- Wire audio features into shader uniforms

### Phase 3: Scene System
- Scene interface and SceneManager
- Three.js scene support
- 2D generative scene support
- Scene lazy loading

### Phase 4: Transition Engine
- Dual render targets (old + new scene)
- GL Transition crossfade shader
- Version detection via RTDB
- Dynamic module loading on deploy
- Post-deploy script

### Phase 5: Content & Polish
- 3+ visual scenes (shader, 3D, 2D)
- Multiple transition effects
- Diagnostic overlay
- Performance optimization
- Stress testing (4+ hour runs)
