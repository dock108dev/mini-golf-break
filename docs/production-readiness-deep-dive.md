# Production Readiness Deep-Dive Audit

This document turns the current "it works when everything is perfect" state into a concrete engineering backlog.

## How to Use This

- Treat each section as a focused deep-dive stream.
- Start with **P0/P1** items (correctness and reliability), then harden performance and maintainability.
- Convert each bullet into a tracked GitHub issue with owner + acceptance criteria.

---

## 1) Camera System Deep Dive

### P0 — Correctness / Stability

1. **Duplicate resize listeners in game layer**
   - **Files:** `/src/scenes/Game.js` (`init`, `setupEventListeners`, `cleanup`)
   - `init()` registers `this.boundHandleResize`, but `setupEventListeners()` also registers `this.handleResize.bind(this)`.
   - The second listener cannot be removed during cleanup (different function reference).
   - **Risk:** duplicate callbacks, leaks, hard-to-debug camera/renderer behavior after restart.

2. **Conflicting resize responsibilities**
   - **Files:** `/src/scenes/Game.js`, `/src/controls/CameraController.js`
   - Game resizes renderer, CameraController resizes camera projection through its own listener.
   - Two independent listeners for one concern increases drift and race conditions.
   - **Risk:** intermittent aspect/projection mismatch.

### P1 — Gameplay Quality

3. **Camera follow method complexity is too high**
   - **File:** `/src/controls/CameraController.js` (`updateCameraFollowBall`)
   - ESLint already flags high complexity/max-statements.
   - **Risk:** brittle camera behavior and regression risk when tuning follow behavior.

4. **Camera defaults are hard-coded and not config-driven**
   - **File:** `/src/controls/CameraController.js`
   - FOV, follow distance, damping, ad-focus blending, etc. are embedded constants.
   - **Risk:** slow iteration and inconsistent behavior across devices/holes.

---

## 2) Screen Scaling & Responsiveness Deep Dive

### P0 — Functional Bugs

1. **Input raycast normalization uses full window, not canvas rect**
   - **File:** `/src/controls/InputController.js` (`onMouseDown`, `onMouseMove`, `onMouseUp`)
   - Pointer normalization uses `window.innerWidth/innerHeight` instead of canvas bounds.
   - **Risk:** aim/shot inaccuracies when canvas is offset, embedded, or CSS-scaled.

### P1 — Performance / Device Adaptation

2. **Renderer does not set pixel ratio**
   - **File:** `/src/scenes/Game.js` (`init`)
   - Missing `renderer.setPixelRatio(...)` strategy (and cap).
   - **Risk:** blurry visuals on high-DPI displays or unnecessary GPU load.

3. **No explicit mobile/rotation policy**
   - **Files:** `/src/scenes/Game.js`, `/public/style.css`, `/src/utils/styles.css`
   - No clear orientation/viewport adaptation contract for gameplay camera + touch input.
   - **Risk:** inconsistent gameplay framing on tablets/phones.

---

## 3) Object Lifecycle / Cleanup Deep Dive

### P0 — Memory & Event Leaks

1. **Subscription list overwritten (not appended)**
   - **File:** `/src/controls/InputController.js` (`setupGameEventListeners`)
   - `this.eventSubscriptions` is initialized then replaced with a new array.
   - **Risk:** if this is called again in future refactors/reinit paths, old unsubscribers can be lost.

2. **Dynamic UI rebuild does aggressive cleanup in creation path**
   - **File:** `/src/managers/UIManager.js` (`createMainContainer`)
   - `createMainContainer()` begins by calling `cleanup()`.
   - **Risk:** lifecycle coupling and accidental state loss when UI creation is triggered outside full init.

### P1 — Resource Discipline

3. **Large number of console logs in runtime paths**
   - **Files:** `/src/controls/CameraController.js`, `/src/controls/InputController.js`, `/src/main.js`, others
   - Verbose logging in hot paths and init paths without a strict environment gate.
   - **Risk:** noisy telemetry, lower runtime performance, harder production debugging.

4. **Mixed debug/TEMP code paths in production managers**
   - **File:** `/src/managers/UIManager.js`
   - Contains `TEMP DISABLE` behaviors and warnings in live event handlers.
   - **Risk:** non-deterministic UX and unclear production behavior.

---

## 4) Game Object / Course Architecture Deep Dive

### P1 — Data Model & Contract Clarity

1. **Course manager API has partially implemented/placeholder behavior**
   - **File:** `/src/managers/CoursesManager.js`
   - Base methods (`createHazard`, `getCurrentHoleConfig`) return placeholder behavior.
   - **Risk:** subclass contract ambiguity and silent no-op paths.

2. **Course transition/object disposal should be validated hole-by-hole**
   - **Files:** `/src/managers/HoleTransitionManager.js`, `/src/objects/NineHoleCourse.js`, `/src/managers/CoursesManager.js`
   - Need explicit verification that all meshes/bodies/materials are consistently disposed and dereferenced.
   - **Risk:** long-session memory growth, stale physics bodies, visual artifacts.

---

## 5) Engineering Standards & Test Coverage Deep Dive

### P1 — Conventions / Maintainability

1. **Lint baseline has many warnings in source and tests**
   - **Command output:** `npm run lint` currently reports broad warnings (complexity, unused vars, style issues).
   - **Risk:** signal-to-noise drop; real regressions get buried.

2. **Jest config warning at runtime**
   - **Command output:** `npm run test:unit` reports unknown `coverageReporters` option warning.
   - **Risk:** test config drift and reduced trust in CI quality gates.

### P2 — Production Hardening

3. **Bundle size warnings in production build**
   - **Command output:** `npm run build` entrypoint/asset size warnings.
   - **Risk:** startup latency on mobile networks/devices.

---

## Suggested Backlog Order (First 3 Sprints)

### Sprint 1 (Stability)
- [ ] Unify resize ownership (single listener owner + deterministic cleanup).
- [ ] Fix input coordinate normalization to use canvas rect for raycasting.
- [ ] Add lifecycle tests for init/cleanup/reinit of `Game`, `CameraController`, `InputController`.

### Sprint 2 (Device Quality)
- [ ] Add renderer pixel-ratio strategy with cap and device profile defaults.
- [ ] Add responsive camera/input acceptance tests for desktop + mobile viewport sizes.
- [ ] Move camera tuning constants to a single config object with per-device overrides.

### Sprint 3 (Maintainability)
- [ ] Refactor camera follow logic into smaller pure helpers.
- [ ] Remove TEMP/debug-only behavior from production managers.
- [ ] Reduce lint warning baseline and make key warning categories fail CI.

---

## Definition of Done for "Production Grade" Milestone

- No duplicate global event listeners after init/cleanup/restart cycles.
- Camera framing, aiming, and shot direction remain consistent across common viewport sizes.
- Stable frame pacing and no memory growth over extended multi-hole sessions.
- Lint/test/build pipelines run cleanly with intentional, low-noise diagnostics.
- Clear ownership boundaries (camera, input, UI, course transitions) and deterministic cleanup contracts.
