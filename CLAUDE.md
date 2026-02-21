# RaveSpace

Live rave visual performance system. Firebase backend, TypeScript + Three.js/WebGL frontend, audio-reactive visuals with graceful deploy transitions.

## Quick Facts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (Vite) |
| `npx vitest run` | Run unit tests |
| `npx vitest --watch` | Watch mode tests |
| `npx tsc --noEmit` | Type check |
| `firebase deploy --only hosting` | Deploy display app |

## Tech Stack

TypeScript + Vite + Three.js (WebGPU/WebGL) + GLSL shaders + Tailwind CSS. Web Audio API + Meyda.js (audio feature extraction) + realtime-bpm-analyzer (beat detection). Firebase Hosting (CDN delivery), Firebase RTDB (version signaling + live parameters).

## Architecture

- **Display app**: Full-screen visual renderer on the TV computer. Listens to Firebase RTDB for version changes. On new deploy, loads new assets and crossfades using GL Transitions.
- **Scene system**: Each visual is a self-contained scene module with `init()`, `update(time, audioFeatures)`, `dispose()`. Scenes can be GLSL shaders, Three.js 3D, or 2D generative art.
- **Audio pipeline**: Mic/line-in → Web Audio API → AnalyserNode → Meyda.js (feature extraction) + beat detection → shader uniforms / animation params per frame.
- **Graceful transitions**: Old scene renders to texture A, new scene renders to texture B, GL Transition shader crossfades A→B over configurable duration. No page reload, no dropped frames.
- **Version detection**: Post-deploy script writes version hash to Firebase RTDB. Display app listens, triggers transition when version changes.

## File Structure

- `src/scenes/` — Visual scene modules (shaders, 3D, generative)
- `src/engine/` — Core render engine, scene manager, transition system
- `src/audio/` — Audio analysis, beat detection, feature extraction
- `src/firebase/` — Firebase config, RTDB version listener
- `src/types/` — TypeScript interfaces
- `src/shaders/` — GLSL shader files
- `public/` — Static assets
- `docs/` — Project documentation and dev logs

## Code Style

- TypeScript strict mode
- Scenes: PascalCase files (`Kaleidoscope.ts`), exported class implementing `Scene` interface
- Shaders: lowercase with hyphens (`plasma-tunnel.frag`)
- Tailwind CSS for any UI elements — no CSS modules, no styled-components
- Use ES modules (`import`/`export`), never CommonJS (`require`)
- `import type` for type-only imports
- Prefer small, focused modules over large monolithic ones

## Gotchas

- **WSL2 + Firebase**: deploy needs `FUNCTIONS_DISCOVERY_TIMEOUT=60000` due to slow I/O
- **WebGL context**: browsers limit to ~16 active contexts. Always dispose old scenes before creating new ones.
- **Audio autoplay**: browsers block AudioContext until user gesture. Display app needs a "Start Show" button for first interaction.
- **Shader compilation**: can cause frame drops. Compile new scene shaders off-screen before transitioning.
- **RTDB listeners**: always unsubscribe in cleanup to prevent memory leaks

## Git Workflow

**MANDATORY: Use git worktrees** for all feature work. Never switch branches in the main worktree.

```bash
# Create worktree for a feature
git worktree add ../RaveSpace-feature-name -b feature-name
cd ../RaveSpace-feature-name && npm install

# After merge, clean up
git worktree remove ../RaveSpace-feature-name
git branch -d feature-name
```

For the full worktree workflow, see `.claude/skills/git-workflow/SKILL.md`.

## Testing

**TDD is the primary methodology.** Red-Green-Refactor: write failing test first, minimal code to pass, then refactor.

- **Unit/Integration**: Vitest
- **WebGL components**: Vitest + mock WebGL context
- **Audio pipeline**: Vitest + mock AnalyserNode data
- **Co-locate tests**: `SceneManager.ts` → `SceneManager.test.ts`

For detailed TDD rules by component type, see `.claude/skills/testing/SKILL.md`.

### Performance Targets

60 FPS at 1080p, smooth crossfade transitions, <50ms audio-to-visual latency.

## Documentation

Update `docs/AI_DEVELOPMENT_LOG.md` after completing significant work. Create dedicated docs in `docs/` for architecture decisions and system design. See `.claude/skills/documentation/SKILL.md` for the full format.

## Tracking

After significant work, append an entry to `.claude/tracking/key-prompts/YYYY-MM-DD.md`:

```
## [date] — [short title]
**Category**: breakthrough | bug-resolution | architecture | feature
**Context**: What problem was being solved?
**The Prompt**: (exact or close paraphrase)
**Why It Worked**: (what made the phrasing/framing effective)
**Prior Attempts That Failed**: (for bugs: what didn't work; otherwise: N/A)
```

## Context Management

- Use `/clear` between unrelated tasks to prevent context pollution
- Use subagents (Task tool) for heavy investigation — protects main context window
- If Claude ignores instructions after extended sessions, `/clear` and restart with a focused prompt
- When compacting, preserve: list of modified files, current task, and test commands
