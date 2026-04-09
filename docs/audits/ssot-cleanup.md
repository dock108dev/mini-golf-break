# SSOT Cleanup Audit

**Date**: 2026-04-09
**Scope**: Destructive cleanup pass — remove legacy, deprecated, and unused code paths

## Diff-Driven Deletion Summary

### Files Deleted

| File | Reason |
|------|--------|
| `src/objects/BunkerElement.js` | Orphaned demo class. Extends BaseElement but never imported by any production or test code. Comment says "Demonstrates how to create a specialized course element" — example code, not SSOT. |
| `src/objects/WallElement.js` | Orphaned demo class. Same pattern as BunkerElement — extends BaseElement, never imported in production. Walls are created directly in HoleEntity and BankWall mechanic. |
| `src/tests/objects/WallElement.test.js` | Tests for deleted WallElement. No production code to validate. |

### Code Removed (In-Place Edits)

| File | Change | Reason |
|------|--------|--------|
| `src/controls/InputController.js` | Removed `removeAimLine()` method (backward-compat alias for `removeDirectionLine()`). Updated sole call site at line 256 to use `removeDirectionLine()` directly. | Dead alias — only one internal caller, no external consumers. |
| `src/managers/GameLoopManager.js` | Removed duplicate `isLoopRunning` property. Consolidated to single `isRunning` property. Removed comment "support both property names for backward compatibility". | Two properties always set in lockstep. `isRunning` used in hot path (`animate()`). No external code read `isLoopRunning` that didn't also have access to `isRunning`. |
| `src/managers/GameLoopManager.js` | Removed `startFrame`/`beginFrame` duck-typing shim. Now calls `performanceManager.beginFrame()` directly. | PerformanceManager only defines `beginFrame()`. The `startFrame` branch was dead code — no PerformanceManager implementation ever had `startFrame()`. |
| `src/managers/DebugManager.js` | Removed "Re-export for backward compatibility" comment. Kept the re-export (it's actively used by DebugCourseUI and tests). | Misleading comment — this is a convenience re-export, not a backward-compat shim. |

### Test Updates

| File | Change |
|------|--------|
| `src/tests/GameLoopManager.test.js` | Removed `startFrame` from mock, updated assertion to check `beginFrame` directly instead of duck-typing conditional. Updated `isLoopRunning` references to `isRunning`. |
| `src/tests/dt-clamping-visibility.test.js` | Removed `startFrame` from mock. Updated `isLoopRunning` to `isRunning`. |
| `src/tests/pause-resume.test.js` | Replaced `startFrame` with `beginFrame` in mock. Updated `isLoopRunning` to `isRunning`. |
| `src/tests/mechanics-dt-spike-reset.test.js` | Removed `startFrame` from mock. |

### Documentation Updates

| File | Change |
|------|--------|
| `docs/course-infrastructure.md:45` | Updated "CourseElementFactory exists but is orphaned" to "CourseElementFactory removed (was orphaned)" |
| `docs/course-infrastructure.md:276` | Removed `nineHoleConfigs.js` from file plan (file no longer exists) |
| `docs/course-infrastructure.md:341` | Changed `NineHoleCourse.js` reference to `OrbitalDriftCourse.js` |

## SSOT Verification

### Authoritative Modules by Domain

| Domain | SSOT Module | Notes |
|--------|-------------|-------|
| Course system | `src/objects/OrbitalDriftCourse.js` | Sole course implementation. Extends CoursesManager. |
| Hole configs | `src/config/orbitalDriftConfigs.js` | 9-hole config array. No other config source. |
| Mechanics registry | `src/mechanics/MechanicRegistry.js` | Type-to-factory map. All 12 types registered via `src/mechanics/index.js`. |
| Mechanic base class | `src/mechanics/MechanicBase.js` | Abstract base for all mechanic types. |
| Hole lifecycle | `src/objects/HoleEntity.js` | Creates/updates/destroys mechanics, hazards, walls, green surface. |
| Game coordinator | `src/scenes/Game.js` | Top-level. Creates OrbitalDriftCourse by default. |
| Game loop | `src/managers/GameLoopManager.js` | Single `isRunning` flag. Calls `beginFrame()`/`endFrame()` on PerformanceManager. |
| Debug config | `src/config/debugConfig.js` | Canonical source. Re-exported from DebugManager for convenience. |
| Theme system | `src/themes/defaultTheme.js`, `src/themes/spaceTheme.js` | defaultTheme = original hardcoded colors. spaceTheme = Orbital Drift visuals. |
| Input | `src/controls/InputController.js` | `removeDirectionLine()` is the single method (no alias). |
| Base element | `src/objects/BaseElement.js` | Extended only by HoleEntity (production). BunkerElement/WallElement demos removed. |

## Risk Log

### Intentionally Retained

| Item | Reason |
|------|--------|
| `src/objects/BaseElement.js` | Still extended by HoleEntity. Not orphaned. |
| `DEBUG_CONFIG`/`ERROR_LEVELS` re-export from DebugManager | Actively imported by DebugCourseUI and test files. Convenience re-export, not legacy. |
| `docs/course-infrastructure.md` planning stages | Historical design document. Stale references updated but full rewrite deferred — the document is reference material, not executable. |
| `docs/execution-order.md` issue references | Planning/tracking document with cancelled issue notes. Left as-is — it's a historical record. |
| `src/tests/mechanics-dt-spike-reset.test.js:615` test named "backward compat" | Tests null-safety of options parameter. Name is misleading but test logic is valid. |

### Verified Clean (No Action Needed)

| Check | Result |
|-------|--------|
| `NineHoleCourse` imports in src/ | None found |
| `BasicCourse` imports in src/ | None found |
| `CourseElementFactory` imports in src/ | None found |
| `nineHoleConfigs` imports in src/ | None found |
| `src/objects/courses/` directory | Does not exist |
| `src/config/nineHoleConfigs.js` | Does not exist |
| Feature flags or env-gated dead code | None found (all NODE_ENV checks are legitimate) |
| TODO/FIXME/HACK markers | None found |

## Sanity Check

### Post-Cleanup Verification

```
grep -r "BunkerElement" src/     → No matches
grep -r "WallElement" src/       → No matches (file + test deleted)
grep -r "removeAimLine" src/     → No matches
grep -r "isLoopRunning" src/     → No matches
grep -r "startFrame" src/managers/ → No matches
grep -r "NineHoleCourse" src/    → No matches
grep -r "BasicCourse" src/       → No matches
grep -r "CourseElementFactory" src/ → No matches

npm test → 90 suites passed, 2334 tests passed, 1 skipped
```

All deleted symbols have zero remaining references in source and test code.
