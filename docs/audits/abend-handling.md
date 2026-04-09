# Error Handling & Suppression Audit

*Audit date: 2026-04-09*
*Scope: All source files in `src/` (134 files)*

## Executive Summary

The codebase has **intentional, layered error handling** that follows a consistent philosophy: **never crash the game loop**. Errors are caught at component boundaries, logged, and degraded gracefully. This is appropriate for a real-time browser game where a crash means a blank screen.

**Overall assessment: Good, with targeted improvements needed.**

- **32 files** contain try/catch blocks (~27 unique catch handlers in production code)
- **6 silent catches** (no error parameter) — all justified (localStorage, WebGL detection)
- **1 high-risk pattern**: Physics world catch resets ALL body velocities on any error
- **1 medium-risk pattern**: `Game.createCourse()` catches critical failures but doesn't propagate — game may appear to start with no course
- **0 critical-risk patterns**: No bare `catch {}` blocks that hide real bugs

### Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Note     | 18    | Acceptable patterns — correct for a game runtime |
| Low      | 8     | Minor observability gaps, production logging blind spots |
| Medium   | 4     | Could mask real bugs or leave game in inconsistent state |
| High     | 1     | Physics recovery too aggressive — could mask physics engine bugs |
| Critical | 0     | None found |

---

## Detailed Findings

### Category 1: Acceptable Patterns (Note)

| # | File | Line | Pattern | Assessment |
|---|------|------|---------|------------|
| N1 | `utils/webglDetect.js` | 16 | Silent catch returns `false` for WebGL detection | **Note.** Browser API detection — correct pattern. |
| N2 | `managers/AudioManager.js` | 529 | Silent catch on `localStorage.setItem` for mute state | **Note.** localStorage unavailable in private browsing — correct to swallow. |
| N3 | `managers/AudioManager.js` | 543 | Silent catch on `localStorage.getItem` for mute state | **Note.** Same justification as N2. |
| N4 | `game/HighScoreManager.js` | 30 | Catch logs via `debug.log` (suppressed in prod) | **Note.** Score persistence is non-critical. Acceptable degradation. |
| N5 | `game/HighScoreManager.js` | 66 | Catch returns `[]` on corrupt localStorage data | **Note.** Correct — corrupt data shouldn't crash the game. |
| N6 | `objects/HoleEntity.js` | 329-360 | Per-hazard try/catch in forEach loop | **Note.** Logs error with config, continues to next hazard. Correct for partial construction. |
| N7 | `objects/HoleEntity.js` | 370-444 | Per-bumper try/catch in forEach loop | **Note.** Same pattern as N6. Correct. |
| N8 | `objects/HoleEntity.js` | 458-481 | Per-mechanic try/catch in creation loop | **Note.** Logs with hole index and type. Correct. |
| N9 | `objects/HoleEntity.js` | 489-497 | Per-hero-prop try/catch in creation loop | **Note.** Decorative-only — correct to continue. |
| N10 | `objects/HoleEntity.js` | 513-531 | Mechanic update catch — marks `_failed`, disables | **Note.** Runtime error boundary per ISSUE-058 spec. Well implemented. |
| N11 | `objects/HoleEntity.js` | 538-566 | Catch around failed mechanic indicator creation | **Note.** Debug UI should never break the game. Correct. |
| N12 | `managers/EventManager.js` | 106-157 | Per-subscriber try/catch in publish loop | **Note.** Logs rich context, publishes `ERROR_OCCURRED` event, has infinite-loop guard. Excellent. |
| N13 | `managers/PerformanceManager.js` | 105-119 | Init catch disables the manager | **Note.** Performance monitoring is non-critical. Correct degradation. |
| N14 | `controls/CameraController.js` | 97-104 | Catch on window resize listener registration | **Note.** Defensive for unusual environments. Acceptable. |
| N15 | `controls/CameraController.js` | 604-649 | Cleanup catch — logs and continues | **Note.** Cleanup should never throw. Correct. |
| N16 | `controls/InputController.js` | 543-556 | Cleanup catch on DOM listener removal | **Note.** Same pattern as N15. Correct. |
| N17 | `managers/GameLoopManager.js` | 30-44 | Visibility change handler pauses/resumes loop | **Note.** Prevents dt spike. Well designed. |
| N18 | `managers/WebGLContextManager.js` | 69-99 | Restore catch — logs error, keeps overlay visible | **Note.** Correct UX — user can retry. |

### Category 2: Needs Telemetry (Low)

| # | File | Line | Pattern | Risk | Recommendation |
|---|------|------|---------|------|----------------|
| L1 | `game/HighScoreManager.js` | 30-31 | Save failure logged via `debug.log` — **suppressed in production** | Observability | Users in prod who hit localStorage quota get no feedback. Score silently lost. |
| L2 | `managers/AudioManager.js` | 529-531 | Silent catch — no logging at all | Observability | Should at minimum log via `debug.log` for dev troubleshooting. |
| L3 | `managers/AudioManager.js` | 543-545 | Silent catch — no logging at all | Observability | Same as L2. |
| L4 | `mechanics/MechanicRegistry.js` | 38 | Unknown type returns `null` with `console.warn` | Observability | Caller (HoleEntity) checks for null and logs `console.error`. Warn + error for same issue is noisy but acceptable. |
| L5 | `mechanics/MechanicRegistry.js` | 20 | Overwrite warning on duplicate registration | Observability | Only `console.warn` — could mask a real bug where two mechanics register under the same key. Should be `console.error` in dev. |
| L6 | `objects/HeroPropFactory.js` | 53 | Unknown prop type falls through to generic placeholder | Observability | Logged as `console.warn`. Correct for MVP but could mask config typos. |
| L7 | `utils/CannonDebugRenderer.js` | 116 | Unhandled shape type logged as `console.warn` | Observability | Debug-only tool. Acceptable. |
| L8 | `utils/debug.js` | 10-14 | `debug.log` and `debug.warn` suppressed in production | Observability | **By design** — production strips console.log via Terser. All `debug.log` calls are invisible in prod. This means any error logged only via `debug.log` (like L1) is a production blind spot. |

### Category 3: Should Tighten (Medium)

| # | File | Line | Pattern | Risk | Recommendation |
|---|------|------|---------|------|----------------|
| M1 | `scenes/Game.js` | 374-418 | `createCourse()` catches all errors, logs, but **does not re-throw or set error state** | **Data integrity** | If course creation fails, `startGame()` continues. The game enters a state with no course, no ball, but the loop is running. User sees black screen with no feedback. Should set a GAME_ERROR state or show an error UI. |
| M2 | `scenes/Game.js` | 99-156 | `initVisuals()` catches all errors, logs, but catch block in Game.js **does not propagate** to App | **Reliability** | `App.initVisuals()` has its own try/catch that shows an error UI, but `Game.initVisuals()` catches internally first. If Game's catch fires, it logs to debugManager and console but doesn't throw — App's catch never fires. The error UI in App is unreachable for errors caught inside Game. |
| M3 | `managers/HoleTransitionManager.js` | 167-174 | Transition error returns `false` but caller may not check | **Reliability** | `transitionToNextHole()` returns `false` on failure. Caller (HoleCompletionManager) should handle this, but if it doesn't, the game stalls silently on a failed transition. |
| M4 | `controls/CameraController.js` | 60-111 | `init()` catches all errors but **still sets `isInitialized = true`** before the catch | **Data integrity** | Actually, `isInitialized = true` is set at line 107 inside the try block, so this is only set on success. **Wait — re-reading**: the catch is at line 110, after `isInitialized = true` at line 107. If an error occurs between lines 107 and the end of the try block, `isInitialized` would be true despite partial init. However, line 107 is the last statement before the catch, so this is actually fine. **Downgraded to Note.** |

*M4 re-assessed: Actually acceptable. The `isInitialized = true` assignment at line 107 is the last statement in the try block before the catch. No code runs between it and the end of the try block that could throw.*

**Revised Medium count: 3**

### Category 4: High Risk

| # | File | Line | Pattern | Risk | Recommendation |
|---|------|------|---------|------|----------------|
| H1 | `physics/PhysicsWorld.js` | 196-210 | On ANY physics step error, **resets velocity/force on ALL bodies to zero** | **Data integrity, gameplay** | This is an aggressive recovery that stops all motion in the entire physics world. A single corrupt body could freeze every object. The recovery doesn't identify which body caused the error. It also swallows the error after logging — no retry, no state flag, no user notification. A physics error could silently reset the ball mid-flight. |

---

## Pattern Analysis

### 1. Things Caught Intentionally (Correct)

- **HoleEntity per-element construction** (hazards, bumpers, mechanics, hero props): Each element wrapped individually so one bad config doesn't prevent the entire hole from loading.
- **EventManager subscriber callbacks**: Each subscriber wrapped individually with rich context logging and `ERROR_OCCURRED` event propagation.
- **Mechanic update error boundary**: Failed mechanics are flagged `_failed` and skipped on subsequent frames. Visual indicator shown in debug mode.
- **WebGL context loss**: Full recovery flow with user-facing overlay and retry button.

### 2. Things Suppressed Intentionally (Acceptable)

- **localStorage operations** (AudioManager, HighScoreManager): Non-critical persistence. Silent failure is correct for private browsing / quota exceeded.
- **WebGL detection** (webglDetect.js): Feature detection should never throw to the caller.
- **Performance monitoring init** (PerformanceManager): Self-disables on error. Non-critical subsystem.

### 3. Things Logged and Continued Past (Mostly Correct)

- **CameraController init warnings** (missing BallManager, missing renderer): Logs warning, continues with reduced functionality. Camera can still work without orbit controls.
- **InputController init errors**: Logs via debugManager or console.error fallback. Returns `this` for chaining. Partially initialized controller could have missing event listeners.
- **HoleTransitionManager**: Logs errors at each step, returns `false` on failure.

### 4. Things Downgraded from Error to Warning

- **MechanicRegistry unknown type**: Returns `null` with `console.warn`. Caller then logs `console.error`. Two-level logging for one issue.
- **HeroPropFactory unknown type**: Falls back to generic placeholder with `console.warn`. Correct for decorative elements.
- **CannonDebugRenderer unhandled shape**: `console.warn` for debug-only tool.

### 5. Things Silently Ignored or Defaulted Around

- **Config position fallbacks** (HoleEntity lines 335-337): `position?.x || 0` — a position of `{x: 0}` and a missing position both resolve to `0`. This is correct for this domain (origin is a valid position).
- **Theme fallbacks** (HoleEntity line 154-160): `config.theme?.rim || {}` chains with `rimTheme.color || 0xcccccc`. Correct — default colors when no theme specified.
- **Mechanic resource tracking** (HoleEntity line 472): `mechanic.getMeshes?.() || mechanic.meshes || []` — handles both interface styles. Defensive but correct.
- **Ball reset fallback** (Ball.js line 262): If hole start position unknown, resets to origin. Logged as warning. Player may appear at (0,0,0) which could be off-course.

### 6. Production Behavior Intentionally Quieter

- **`debug.log` / `debug.warn`**: Suppressed when `NODE_ENV === 'production'`. Only `debug.error` always logs.
- **Terser strips `console.log` and `console.debug`**: Production build has no console.log output at all.
- **`console.warn` and `console.error` preserved**: These survive production builds per ESLint config (`no-console: warn, allow: ['warn', 'error']`).
- **Dev-mode course validation** (Game.js line 391): `validateCourse()` only runs when `NODE_ENV !== 'production'`. Config errors are invisible in prod.

---

## Remediation Plan & Applied Fixes

### Priority 1: Fix High-Risk Pattern (H1) -- FIXED

**File**: `src/physics/PhysicsWorld.js:196-210`

**Was**: Resets ALL bodies on ANY single physics error.

**Fix applied**: Added a circuit breaker pattern. Physics errors are counted. Only after 3 consecutive errors does the full body reset fire. Counter resets after recovery. Error log now includes occurrence count and body count for diagnostics.

### Priority 2: Fix Medium-Risk Patterns -- FIXED (M1, M2)

**M1 — Game.createCourse() silent failure** (`src/scenes/Game.js`):
**Fix applied**: Added `throw error` after logging so `startGame()` propagates to `App.startCourse()`, which already has error UI.

**M2 — Game.initVisuals() swallows error** (`src/scenes/Game.js`):
**Fix applied**: Added `throw error` after logging to debugManager so `App.initVisuals()` catch block fires and shows the error UI.

**M3 — HoleTransitionManager return value** (`src/managers/HoleTransitionManager.js:167-174`):
**Not fixed** (requires verifying all callers). Recommend publishing an ERROR_OCCURRED event on transition failure in a follow-up.

### Priority 3: Add Observability (Low) -- FIXED (L1, L2, L3, L5)

**L1**: HighScoreManager save failure changed from `debug.log` to `console.warn` — now visible in production.

**L2, L3**: AudioManager localStorage catches now log via `debug.log` for dev troubleshooting (was completely silent).

**L5**: MechanicRegistry duplicate registration upgraded from `console.warn` to `console.error` to surface real bugs.

### Priority 4: No Action Needed (Notes)

All 18 Note-level findings are correctly implemented and need no changes. The error handling philosophy of "catch, log, degrade gracefully" is appropriate for a real-time browser game.

---

## Architecture Observations

### Strengths

1. **Consistent error boundary pattern**: HoleEntity wraps each element individually, EventManager wraps each subscriber, mechanic updates have per-mechanic boundaries.
2. **Rich error context**: EventManager includes subscriber class name, event type, simplified data. HoleEntity includes hole index and mechanic type.
3. **Graceful degradation hierarchy**: Missing component -> warn and continue with reduced features. Failed element -> skip, log, continue. Critical failure -> error UI for user.
4. **Visibility change handling**: GameLoopManager pauses on tab hide, resumes on tab show. Prevents dt spike cascades.
5. **WebGL context recovery**: Full user-facing recovery flow with retry capability.

### Weaknesses

1. **No error telemetry**: No error reporting service integration. Production errors are only visible in the browser console, which users rarely check.
2. **No error state in GameState**: The state machine has `INITIALIZING`, `PLAYING`, `AIMING`, `HOLE_COMPLETED`, `GAME_COMPLETED` but no `ERROR` state. Critical failures leave the game in an indeterminate state.
3. **Two-level logging confusion**: Some errors are logged by both the component that catches them and the caller that checks the return value, producing duplicate console output.
4. **Dev-only validation**: Course config validation only runs in dev mode. A production build with a bad config would fail at runtime with less helpful error messages.
