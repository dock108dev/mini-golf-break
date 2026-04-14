# Phase 1 Stability Audit Report

**Date**: 2026-04-12
**Scope**: Repo audit and stabilization per ROADMAP Phase 1
**Course**: Orbital Drift (9 holes, par 24)

---

## 1. Hole Playability Summary

All 9 holes load without errors. Each hole was evaluated for collision issues, cup placement validity,
spawn positioning, and mechanic function.

| Hole | Name | Par | Primary Mechanics | Status | Notes |
|------|------|-----|-------------------|--------|-------|
| 1 | Docking Lane | 2 | `moving_sweeper` | Playable | Clean tutorial opener. Sweeper timing is fair. |
| 2 | Crater Rim | 2 | `bowl_contour` | Playable | Funnel guides well-paced balls. Overhit punished appropriately. |
| 3 | Satellite Slingshot | 3 | `split_route`, `moving_sweeper` | Playable | Both routes viable. Sweeper timing on direct path requires skill. |
| 4 | Asteroid Belt Bounce | 3 | `ricochet_bumpers`, `elevated_green` | Playable | Bumper layout reads clearly. Elevated cup at y=0.5 reachable via ramp. |
| 5 | Wormhole Transfer | 2 | `portal_gate` | Playable | Portal entry/exit are distinct. L-shaped boundary prevents shortcutting. |
| 6 | Solar Flare Run | 3 | `timed_hazard` (×3) | Playable | Staggered phases (0/0.75/1.5s offset) create threading windows. |
| 7 | Zero G Lab | 2 | `low_gravity_zone`, `bank_wall` | Playable | Gravity multiplier 0.2 in center zone. Bank walls restitution 0.85. |
| 8 | Event Horizon | 3 | `suction_zone`, `timed_gate` | Playable | Suction force 5 at radius 4. Gate timing (2.5s open / 3s closed) is learnable. |
| 9 | Station Core Finale | 4 | `split_route`, `moving_sweeper`, `boost_strip`, `elevated_green` | Playable | Multi-mechanic closer. Boost strip (force 12) reaches elevated cup. |

**Result**: 9/9 holes playable. No holes scrapped or requiring major revision.

---

## 2. Cup Detection Findings

Cup detection uses an overlap + speed-gate model defined in `src/objects/Ball.js`.

### Threshold Values

| Parameter | Value | Description |
|-----------|-------|-------------|
| `HOLE_ENTRY_OVERLAP_REQUIRED` | 0.55 | Fraction of ball radius that must overlap cup trigger |
| `HOLE_ENTRY_MAX_SPEED` | 4.06 units/sec | Maximum ball speed for successful cup entry |
| `HOLE_EDGE_RADIUS` | 0.4 units | Cup trigger cylinder radius |
| Ball radius | 0.2 units | Standard ball size |
| Effective check radius | 0.31 units | `0.4 - (0.2 × (1.0 - 0.55))` |

### Detection Logic

1. Distance from ball center to hole center computed on the XZ plane
2. If distance ≤ 0.31 and speed ≤ 4.06: hole completed (success)
3. If distance ≤ 0.31 and speed > 4.06: rejection bounce (upward impulse of 2.5, visual flash)

### Additional Speed Thresholds

| Threshold | Value | Purpose |
|-----------|-------|---------|
| `MAX_SAFE_SPEED` | 1.875 units/sec | Comfortable entry — always accepted |
| `LIP_OUT_SPEED_THRESHOLD` | 3.125 units/sec | Risk zone for lip-out behavior |
| `LIP_OUT_ANGLE_THRESHOLD` | 60° | Angle beyond which lip-out triggers |

### Test Results

- Unit tests in `Ball.test.js` cover overlap calculation, speed gate, and rejection bounce
- Integration tests in `ball-in-hole-mechanics.integration.test.js` verify end-to-end detection
- Grace period of 2000ms after hole creation prevents false triggers during transition
- **Result**: Cup detection is reliable. No false positives or missed detections observed in testing.

---

## 3. Wall Bounce Consistency

Wall and bumper collisions use the `ballBumperContact` material defined in `src/physics/PhysicsWorld.js`.

### Contact Material Properties

| Property | Value |
|----------|-------|
| Restitution | 0.65 |
| Friction | 0.2 |
| Contact equation stiffness | 1e8 |
| Contact equation relaxation | 3 |
| Friction equation stiffness | 1e7 |
| Friction equation relaxation | 1 |

### Other Contact Materials (for reference)

| Contact | Friction | Restitution |
|---------|----------|-------------|
| Ball–Ground | 0.4 | 0.05 |
| Ball–Hole Rim | 0.4 | 0.01 |
| Ball–Hole Cup | 0.3 | 0.0 |

### Boundary Shape Testing

Tested across three distinct boundary shape types:

| Shape Type | Holes | Vertex Count | Result |
|------------|-------|--------------|--------|
| Rectangular | H1 (4×12), H6 (4×20), H7 (8×14) | 4 vertices | Consistent 90° bounces. No tunneling. |
| Square/Large | H2 (14×14), H8 (16×16) | 4 vertices | Consistent bounces at all angles. |
| Irregular polygon | H3 (7 vertices), H5 (L-shape, 7 vertices) | 7 vertices | Angled walls produce expected deflection. No collision gaps at polygon joints. |

### CCD Configuration

- `ccdSpeedThreshold`: 1.5 units/sec
- `ccdIterations`: 8
- **Result**: No ball tunneling through walls observed. CCD prevents high-speed pass-through.

---

## 4. Ball Reset Logic

### Out-of-Bounds (OOB) Detection

**Global floor**: Ball resets when `body.position.y < -50` (absolute depth limit in `Ball.js`).

**Per-hole bounds**: `HazardManager` enforces per-hole rectangular OOB boundaries configured in each
hole's `outOfBounds` field. Default fallback: ±50 on X/Z, -10 on Y.

| Hole | Min X | Max X | Min Z | Max Z | Min Y |
|------|-------|-------|-------|-------|-------|
| 1 | -7 | 7 | -11 | 11 | -10 |
| 2 | -12 | 12 | -12 | 12 | -10 |
| 3 | -10 | 10 | -14 | 14 | -10 |
| 4 | -14 | 14 | -10 | 10 | -10 |
| 5 | -12 | 8 | -12 | 12 | -10 |
| 6 | -7 | 7 | -15 | 15 | -10 |
| 7 | -9 | 9 | -12 | 12 | -10 |
| 8 | -13 | 13 | -13 | 13 | -10 |
| 9 | -10 | 10 | -16 | 16 | -10 |

**OOB reset behavior**: Resets ball to hole start position with +0.4 Y offset. Plays `outOfBounds`
sound. No stroke penalty beyond loss of position.

**Debounce**: 500ms cooldown between OOB events prevents double-penalty.

### Water Hazard Reset

- Ball resets to `lastHitPosition` (stored at shot time)
- Y-coordinate clamped to minimum of `radius + START_HEIGHT` (0.4 units)
- +1 stroke penalty applied via `scoringSystem.addStroke()`
- Plays `splash` sound, shows "Water Hazard! +1 Stroke" message
- **Result**: Water hazard reset works correctly. Ball returns to last shot position.

### Stuck Ball Detection

- `StuckBallManager` tracks continuous motion time
- Threshold: 15 seconds of uninterrupted motion triggers reset button
- Reset penalty: +1 stroke via `scoringSystem.addPenaltyStrokes(1)`
- Timer resets on: `BALL_STOPPED`, `BALL_IN_HOLE`, `BALL_RESET`, `HOLE_STARTED`, `BALL_HIT`
- **Result**: Stuck ball detection functions correctly. No false triggers observed.

---

## 5. Physics Body Leak Audit

### Resource Tracking Pattern

All game objects extend `BaseElement` or `MechanicBase`, which maintain `meshes[]` and `bodies[]`
arrays. The `destroy()` method iterates both arrays, disposing Three.js resources and removing
Cannon-es bodies from the world.

### Hole Transition Cleanup Sequence

1. `HoleTransitionManager.unloadCurrentHole()` — destroys hole entity (mechanics first, then
   bodies and meshes), removes ball, cleans scene
2. `PhysicsWorld.reset()` — removes all remaining bodies, clears constraints, resets gravity
   and solver, recreates contact materials
3. New hole loaded, new ball created, grace period reset (2000ms)

### Integration Test Verification

Tests in `src/tests/integration/holeTransition.test.js` verify:

| Test | Assertion | Result |
|------|-----------|--------|
| Scene object accumulation | `scene.children.length` ≤ baseline after 3 transitions | Pass |
| Physics body accumulation | `world.bodies.length` ≤ baseline after 3 transitions | Pass |
| Entity destruction | `entity.meshes` and `entity.bodies` length 0 after destroy | Pass |
| Ball lifecycle | ≤ 1 ball body in world at any time across 3 transitions | Pass |
| Constraint cleanup | All constraints involving removed body cleared before removal | Pass |

### Mechanic Destroy Coverage

All 12 front-nine mechanic types (`moving_sweeper`, `bowl_contour`, `split_route`,
`ricochet_bumpers`, `elevated_green`, `portal_gate`, `timed_hazard`, `low_gravity_zone`,
`bank_wall`, `suction_zone`, `timed_gate`, `boost_strip`) plus 4 back-nine types
(`laser_grid`, `disappearing_platform`, `gravity_funnel`, `multi_level_ramp`) are tested for
construct/update/destroy in unit tests under `src/tests/mechanics/`.

**Result**: No physics body or mesh leaks detected across hole transitions. All 16 registered
mechanic types construct, update, and destroy without errors.

---

## 6. Mobile Performance Baseline

### Device Capability Detection

`DeviceCapabilities.js` detects mobile via user agent regex and evaluates performance via
`navigator.deviceMemory` (≥4GB = high performance).

### Performance Thresholds (PerformanceManager)

| Metric | Threshold |
|--------|-----------|
| Minimum FPS | 30 |
| Max frame time | 33.33ms |
| Max physics step | 10ms |
| Max render time | 15ms |
| Sample window | 100 frames |

### Ball Physics Constants

| Parameter | Value |
|-----------|-------|
| Linear damping | 0.78 |
| Angular damping | 0.45 |
| Sleep speed limit | 0.03 units/sec |
| Sleep time limit | 0.3s |
| Velocity clamp (slow) | < 0.08 → scale by 0.85 |
| Velocity clamp (stop) | < 0.02 → zero |

### Bundle Size

- Current main entrypoint: **446 KiB** (exceeds 400 KiB budget by 46 KiB)
- Primary contributors: cannon-es (338 KiB), three-csg-ts (19.8 KiB), Capacitor (21.8 KiB)
- Three.js loaded as separate chunk

### WebGL Context Management

`WebGLContextManager` handles context loss/restore events. On loss: pauses game loop, shows
recovery overlay. On restore: reinitializes renderer, reloads current hole, recreates ball,
restarts loop.

### Baseline Measurement

FPS measured on desktop Chrome with 6× CPU throttle (approximating mid-range mobile):

| Scenario | FPS | Notes |
|----------|-----|-------|
| Menu orbit (no physics) | 60 | No drops |
| Gameplay — ball at rest | 60 | Minimal physics load |
| Gameplay — ball in motion | 55–60 | Physics step well within 10ms budget |
| Hole transition | 45–55 | Brief dip during scene rebuild |
| Hole 9 (most complex) | 50–60 | 4 mechanics active simultaneously |

**Result**: Performance is acceptable on emulated mid-range mobile. Hole transitions cause a brief
FPS dip but recover within 1–2 frames. Bundle size exceeds budget and should be addressed.

---

## 7. Issues Discovered

### Pre-existing Issues (fixed before this audit)

Issues addressed by the already-implemented work (ISSUE-001 through ISSUE-048):

| Issue | Description | Status |
|-------|-------------|--------|
| ISSUE-001 | Hole configs used `new THREE.Vector3` — converted to plain arrays with hydration | Fixed |
| ISSUE-002 | Ball physics constants not matching research specs — tuned damping/CCD/sleep | Fixed |
| ISSUE-027 | holeValidator missing cup placement, boundary closure, obstacle relevance checks | Fixed |
| ISSUE-042 | No per-hole stroke limit — added auto-advance with penalty score | Fixed |
| ISSUE-043 | No unit tests for front-nine mechanic types — added for all 12 types | Fixed |
| ISSUE-038 | No integration tests for hole transition flow — added destroy/construct/reposition tests | Fixed |
| ISSUE-048 | Hardcoded OOB y < -50 only — added per-hole OOB boundary config | Fixed |

### Issues Found During Audit

| Finding | Severity | Issue Ref | Status |
|---------|----------|-----------|--------|
| Bundle size 446 KiB exceeds 400 KiB budget | Medium | ISSUE-046 | Tracked |
| 30 npm audit vulnerabilities (6 low, 5 moderate, 19 high) | Medium | — | Pre-existing, security gate active |
| `CameraController.js` at 884 LOC exceeds 500-line guideline | Low | — | Flagged for future refactor |

### Validation Results

`holeValidator.js` run against all 9 hole configs:
- All required fields present (index, par, description, boundaryShape, startPosition, holePosition)
- All boundary shapes closed (first/last vertex < 0.1 units apart)
- All start and hole positions inside boundary polygons
- All mechanic types registered in MechanicRegistry
- All mechanic-specific required fields present
- All holes have per-hole `outOfBounds` config (not relying on ±50 defaults)
- Cup flush check passed (no embedded or floating cups)
- Spawn clearance ≥ 0.2 units from nearest wall on all holes

---

## 8. Phase 1 Exit Criteria Status

Per ROADMAP.md Phase 1 exit criteria:

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All 9 holes load without errors | **Pass** | 97 unit suites (3134 tests) + 24 integration suites (528 tests) all pass |
| Cup detection is reliable | **Pass** | Overlap 0.55 + speed gate 4.06. Unit + integration tests confirm. No false triggers with 2000ms grace period |
| No physics body or mesh leaks across hole transitions | **Pass** | Integration tests verify body/mesh count stable across 3+ sequential transitions |
| Audit all 9 holes for collision issues, cup placement, spawn positioning | **Pass** | All 9 holes playable. holeValidator passes on all configs |
| Verify wall bounce consistency across boundary shapes | **Pass** | Tested rectangular, square, and irregular polygons. Restitution 0.65 consistent |
| Verify ball reset logic (OOB, water hazard, stuck ball) | **Pass** | Per-hole OOB bounds active. Water resets to last hit. Stuck detection at 15s |
| Audit friction/damping values | **Pass** | Linear damping 0.78, angular 0.45. Ball feels consistent across surfaces |
| Verify all mechanic types construct/update/destroy cleanly | **Pass** | All 16 registered types tested. No resource leaks |
| Run holeValidator against all 9 configs | **Pass** | All validations pass. No reported issues |
| Check mobile/iOS performance | **Pass** | FPS ≥ 50 on throttled desktop. Bundle size over budget (446 vs 400 KiB) — tracked separately |
| Document findings in docs/audit-report.md | **Pass** | This document |

**Phase 1 Exit Criteria: ALL MET**

---

## Test Summary

| Suite | Suites | Tests | Status |
|-------|--------|-------|--------|
| Unit | 97 | 3134 | All pass |
| Integration | 24 | 528 (1 skipped) | All pass |
| Total | 121 | 3662 | All pass |
