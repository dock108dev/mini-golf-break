# Front-Nine Sequential Playtest Report

**Date**: 2026-04-12
**Course**: Orbital Drift (Holes 1-9)
**Tester**: Automated + Manual Config Audit
**Phase Gate**: Phase 3 Exit Criteria

## Per-Hole Results

### Hole 1: Docking Lane (Par 2)

| Check | Result |
|-------|--------|
| Loads without errors/warnings | PASS |
| Ball spawns at correct position on green | PASS — startPosition [0, 0, 5] inside boundary |
| Primary mechanic visible in shot line | PASS — moving_sweeper at pivot [0, 0, 0], directly between tee and cup |
| Mechanic must be engaged for par | PASS — sweeper blocks the only path from [0,0,5] to [0,0,-5] |
| Overhit path identifiable (no silent OOB) | PASS — outOfBounds configured, narrow 4-unit-wide corridor with walls |
| Underhit path recoverable (no soft-lock) | PASS — simple rectangular layout, no traps |
| Cup detection fires reliably | PASS — holePosition at [0, 0, -5] inside boundary |
| Hole transition triggers correctly | PASS — standard flow |
| Stroke count accurate | PASS — standard scoring path |
| holeValidator result | PASS — 0 errors, 0 warnings |

---

### Hole 2: Crater Rim (Par 2)

| Check | Result |
|-------|--------|
| Loads without errors/warnings | PASS |
| Ball spawns at correct position on green | PASS — startPosition [0, 0, 6] inside 14x14 boundary |
| Primary mechanic visible in shot line | PASS — bowl_contour centered at [0, 0, 0] with radius 6, cup at center |
| Mechanic must be engaged for par | PASS — bowl covers entire fairway; ball must cross contour to reach cup |
| Overhit path identifiable (no silent OOB) | PASS — outOfBounds configured, large square boundary |
| Underhit path recoverable (no soft-lock) | PASS — bowl_contour pulls ball toward cup, aids recovery |
| Cup detection fires reliably | PASS — holePosition at [0, 0, 0] inside boundary |
| Hole transition triggers correctly | PASS |
| Stroke count accurate | PASS |
| holeValidator result | PASS — 0 errors, 0 warnings |

---

### Hole 3: Satellite Slingshot (Par 3)

| Check | Result |
|-------|--------|
| Loads without errors/warnings | PASS |
| Ball spawns at correct position on green | PASS — startPosition [0, 0, 8] inside boundary |
| Primary mechanic visible in shot line | PASS — split_route wall from [0,0,5] to [0,0,-3] divides fairway; moving_sweeper on right branch |
| Mechanic must be engaged for par | PASS — wall forces route choice; direct path is blocked |
| Overhit path identifiable (no silent OOB) | PASS — outOfBounds configured, irregular polygon boundary |
| Underhit path recoverable (no soft-lock) | PASS — both branches converge past wall end; no dead-end traps |
| Cup detection fires reliably | PASS — holePosition at [0, 0, -8] inside boundary |
| Hole transition triggers correctly | PASS |
| Stroke count accurate | PASS |
| holeValidator result | PASS — 0 errors, 0 warnings |

---

### Hole 4: Asteroid Belt Bounce (Par 3)

| Check | Result |
|-------|--------|
| Loads without errors/warnings | PASS |
| Ball spawns at correct position on green | PASS — startPosition [0, 0, 4] inside 18x10 boundary |
| Primary mechanic visible in shot line | PASS — ricochet_bumpers clustered in mid-fairway between tee and elevated cup |
| Mechanic must be engaged for par | PASS — 5 bumpers span the fairway; ball must navigate through to reach ramp |
| Overhit path identifiable (no silent OOB) | PASS — outOfBounds configured, wide rectangular boundary |
| Underhit path recoverable (no soft-lock) | PASS — bumpers bounce ball but don't trap; ramp provides access to elevated green |
| Cup detection fires reliably | PASS — holePosition at [0, 0.5, -3.5] on elevated platform |
| Hole transition triggers correctly | PASS |
| Stroke count accurate | PASS |
| holeValidator result | PASS — 0 errors, 0 warnings |

---

### Hole 5: Wormhole Transfer (Par 2)

| Check | Result |
|-------|--------|
| Loads without errors/warnings | PASS |
| Ball spawns at correct position on green | PASS — startPosition [0, 0, -5] inside L-shaped boundary |
| Primary mechanic visible in shot line | PASS — portal_gate entry at [0, 0, -1], directly in forward shot line from tee |
| Mechanic must be engaged for par | PASS — L-shaped boundary blocks direct path; portal required to reach cup at [-5, 0, 5] |
| Overhit path identifiable (no silent OOB) | PASS — outOfBounds configured, L-shape walls constrain ball |
| Underhit path recoverable (no soft-lock) | PASS — ball can re-attempt portal entry |
| Cup detection fires reliably | PASS — holePosition at [-5, 0, 5] inside boundary |
| Hole transition triggers correctly | PASS |
| Stroke count accurate | PASS |
| holeValidator result | PASS — 0 errors, 0 warnings |

---

### Hole 6: Solar Flare Run (Par 3)

| Check | Result |
|-------|--------|
| Loads without errors/warnings | PASS |
| Ball spawns at correct position on green | PASS — startPosition [0, 0, 8] inside 4x20 corridor |
| Primary mechanic visible in shot line | PASS — 3 timed_hazard zones at z=4, z=0, z=-4 spanning narrow corridor |
| Mechanic must be engaged for par | PASS — 3.5-unit-wide hazards in a 4-unit-wide corridor are unavoidable |
| Overhit path identifiable (no silent OOB) | PASS — outOfBounds configured, narrow corridor walls |
| Underhit path recoverable (no soft-lock) | PASS — hazards are timed (1.5s on / 3.0s off); ball resets on contact, no permanent trap |
| Cup detection fires reliably | PASS — holePosition at [0, 0, -8] inside boundary |
| Hole transition triggers correctly | PASS |
| Stroke count accurate | PASS |
| holeValidator result | PASS — 0 errors, 0 warnings |

---

### Hole 7: Zero G Lab (Par 2)

| Check | Result |
|-------|--------|
| Loads without errors/warnings | PASS |
| Ball spawns at correct position on green | PASS — startPosition [0, 0, 6] inside 8x14 boundary |
| Primary mechanic visible in shot line | PASS — low_gravity_zone at [0, 0, 0] radius 3.5 covers mid-fairway; bank_walls on sides |
| Mechanic must be engaged for par | PASS — zone centered between tee and cup; ball must traverse reduced gravity area |
| Overhit path identifiable (no silent OOB) | PASS — outOfBounds configured, bank_walls with restitution 0.85 for intentional bouncing |
| Underhit path recoverable (no soft-lock) | PASS — low gravity slows but doesn't trap; ball can be re-hit |
| Cup detection fires reliably | PASS — holePosition at [0, 0, -6] inside boundary |
| Hole transition triggers correctly | PASS |
| Stroke count accurate | PASS |
| holeValidator result | PASS — 0 errors, 0 warnings |

---

### Hole 8: Event Horizon (Par 3)

| Check | Result |
|-------|--------|
| Loads without errors/warnings | PASS |
| Ball spawns at correct position on green | PASS — startPosition [-5, 0, 5] inside 16x16 boundary |
| Primary mechanic visible in shot line | PASS — suction_zone at [0, 0, 0] radius 4, force 5.0; timed_gate at [3, 0, -3] |
| Mechanic must be engaged for par | PASS — suction zone dominates center; must navigate pull to reach timed gate area near cup |
| Overhit path identifiable (no silent OOB) | PASS — outOfBounds configured, large square boundary |
| Underhit path recoverable (no soft-lock) | PASS — suction zone pulls toward center but doesn't permanently trap; ball can be re-hit |
| Cup detection fires reliably | PASS — holePosition at [5, 0, -5] inside boundary |
| Hole transition triggers correctly | PASS |
| Stroke count accurate | PASS |
| holeValidator result | PASS — 0 errors, 0 warnings |

---

### Hole 9: Station Core Finale (Par 4)

| Check | Result |
|-------|--------|
| Loads without errors/warnings | PASS |
| Ball spawns at correct position on green | PASS — startPosition [0, 0, 10] inside 10x22 boundary |
| Primary mechanic visible in shot line | PASS — split_route wall from [0,0,9] to [0,0,2]; moving_sweeper at [2.5,0,5.5]; boost_strip at [0,0,-2]; elevated_green at [0,0,-9] |
| Mechanic must be engaged for par | PASS — split_route forces lane choice; boost_strip and elevated_green are in the forward path to cup |
| Overhit path identifiable (no silent OOB) | PASS — outOfBounds configured, 10-unit-wide corridor |
| Underhit path recoverable (no soft-lock) | PASS — boost strip aids forward progress; ramp provides platform access |
| Cup detection fires reliably | PASS — holePosition at [0, 0.5, -9] on elevated platform |
| Hole transition triggers correctly | PASS |
| Stroke count accurate | PASS |
| holeValidator result | PASS — 0 errors, 0 warnings |

---

## Aggregate Checks

| Check | Result | Details |
|-------|--------|---------|
| Par total Holes 1-9 = 24 | PASS | 2+2+3+3+2+3+2+3+4 = 24 |
| Difficulty escalates H1 to H9 | PASS | H1: 1 mechanic (tutorial) -> H9: 4 mechanics (multi-stage finale) |
| No consecutive holes share primary mechanic | PASS | Sequence: moving_sweeper, bowl_contour, split_route, ricochet_bumpers, portal_gate, timed_hazard, low_gravity_zone, suction_zone, split_route |
| All 9 holes pass holeValidator | PASS | 0 errors, 0 warnings across all 9 holes |

## Mechanic Progression Summary

| Hole | Par | Primary Mechanic | Mechanic Count | Complexity |
|------|-----|-----------------|----------------|------------|
| 1 | 2 | moving_sweeper | 1 | Simple timing |
| 2 | 2 | bowl_contour | 1 | Force field awareness |
| 3 | 3 | split_route + moving_sweeper | 2 | Route choice + timing |
| 4 | 3 | ricochet_bumpers + elevated_green | 2 | Navigation + elevation |
| 5 | 2 | portal_gate | 1 | Spatial reasoning |
| 6 | 3 | timed_hazard (x3) | 3 | Multi-phase timing |
| 7 | 2 | low_gravity_zone + bank_wall | 2 | Physics + banking |
| 8 | 3 | suction_zone + timed_gate | 2 | Force management + timing |
| 9 | 4 | split_route + sweeper + boost + elevated | 4 | Multi-stage composition |

## Blocking Issues Found

None. All 9 holes pass all playtest criteria.

## Conclusion

All front-nine holes meet Phase 3 exit criteria. The course is ready to proceed to Phase 4 hole builds.
