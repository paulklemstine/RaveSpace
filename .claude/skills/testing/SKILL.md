---
name: testing
description: TDD patterns and test rules by component type. Use when writing tests, creating new components/hooks/services, or debugging test failures.
---

# Testing — TDD Rules by Component Type

## TDD Workflow (Red-Green-Refactor)

1. **Red:** Write a failing test that defines the expected behavior
2. **Green:** Write the minimal code to make the test pass
3. **Refactor:** Clean up the code while keeping tests green

## Visual Scenes

1. Test scene lifecycle: `init()`, `update()`, `dispose()` methods
2. Test that scenes properly clean up WebGL resources on dispose
3. Mock WebGL context and audio data for unit tests

```typescript
describe('KaleidoscopeScene', () => {
  it('initializes with default parameters', () => { ... })
  it('updates uniforms from audio features', () => { ... })
  it('disposes all WebGL resources', () => { ... })
})
```

## Audio Analysis

1. Test audio feature extraction pipeline
2. Mock AnalyserNode data for deterministic tests
3. Test beat detection callbacks

```typescript
describe('AudioAnalyzer', () => {
  it('extracts frequency bands from FFT data', () => { ... })
  it('fires beat callback on detected beat', () => { ... })
  it('normalizes audio features to 0-1 range', () => { ... })
})
```

## Scene Manager / Transitions

1. Test scene loading and switching
2. Test transition state machine (idle → loading → transitioning → idle)
3. Test graceful fallback when scene fails to load

```typescript
describe('SceneManager', () => {
  it('loads a scene by ID', () => { ... })
  it('crossfades between scenes', () => { ... })
  it('falls back to previous scene on load error', () => { ... })
})
```

## Firebase Integration

1. Test RTDB listener setup/teardown
2. Test version change detection
3. Mock Firebase SDK — never hit real database in unit tests

```typescript
describe('VersionWatcher', () => {
  it('detects new deployment version', () => { ... })
  it('triggers transition on version change', () => { ... })
  it('unsubscribes on cleanup', () => { ... })
})
```

## What NOT to TDD

- GLSL shader code (test visually, not programmatically)
- Tailwind CSS styling
- Firebase config/initialization boilerplate
- Vite/build configuration
- Static type definitions

## Enforcement

- **Never create a new source file without its test file first**
- **Never implement a function/component before its test exists**
- Run `npx vitest --watch` during development for continuous feedback
- All tests must pass before committing
