# ROADMAP.md — mini-golf-break

## Vision

Take the current 9-hole prototype from "space mini golf POC" to a polished 18-hole course with intentional hole design, meaningful obstacles, fair difficulty escalation, and a reusable framework for future course creation.

**The course should feel like a real shipped first course, not a tech demo.**

---

## Phase 1: Repo Audit & Stabilization

**Goal**: Understand what works, what is broken, and what must be fixed before expanding content.

- [ ] Audit all 9 existing holes for collision issues, cup placement validity, and spawn positioning
- [ ] Document which holes are playable-as-is, which need revision, and which should be scrapped
- [ ] Verify cup trigger detection works consistently (overlap threshold + max speed check)
- [ ] Test wall bounce consistency across all boundary shapes
- [ ] Verify ball reset logic: out-of-bounds (y < -50), water hazard reset-to-last-hit, stuck ball timeout
- [ ] Audit friction/damping values — ball should feel consistent across all surfaces
- [ ] Verify all 14 mechanic types construct, update, and destroy without errors or resource leaks
- [ ] Run `holeValidator.js` against all 9 configs and fix any reported issues
- [ ] Check mobile/iOS performance: measure FPS on target device, identify any frame drops from existing holes
- [ ] Document findings in `docs/audit-report.md`

**Exit criteria**: All 9 holes load without errors. Cup detection is reliable. No physics body or mesh leaks across hole transitions. Audit doc completed.

---

## Phase 2: Data-Driven Authoring Framework

**Goal**: Establish the hole authoring system so all future holes are data-driven and validated.

- [ ] Migrate hole configs from JS (with `new THREE.Vector2/3`) to JSON-serializable format with a hydration layer that converts plain objects to Three.js types at load time
- [ ] Define JSON Schema for hole configs (boundaryShape, positions, mechanics, hazards, bumpers, heroProps)
- [ ] Add schema validation to `holeValidator.js` — validate configs against schema in dev mode
- [ ] Define obstacle taxonomy document: for each of the 14 mechanic types, document gameplay purpose, config shape, placement rules, safe parameter ranges
- [ ] Create a hole config template file with all fields documented and example values
- [ ] Add per-hole camera preset support to hole configs (camera distance, angle, follow offset)
- [ ] Ensure `validateCourse()` checks: reachable cup from spawn, no boundary gaps, obstacle overlap with intended path

**Exit criteria**: New holes can be created by adding a JSON config. Schema validation catches common mistakes. Obstacle taxonomy documented.

---

## Phase 3: Rebuild Existing 9 Holes (Front Nine)

**Goal**: Redesign the front nine under the new authoring framework with intentional design.

Each hole must answer: What is the idea? What does the player try first? What happens on over/underhit? Is the obstacle in play? Is the cup fair?

| # | Name | Par | Primary Mechanic | Design Intent |
|---|------|-----|-----------------|---------------|
| 1 | Docking Lane | 2 | `moving_sweeper` | Teach ball speed and bounce feel. Clean lane with side bumpers and a sweeper to dodge. |
| 2 | Crater Rim | 2 | `bowl_contour` | Introduce surface shaping. Shallow funnel helps well-paced balls, punishes overhit. |
| 3 | Satellite Slingshot | 3 | `split_route` + `moving_sweeper` | Introduce route choice. Safe long path vs. tight direct with timing obstacle. |
| 4 | Asteroid Belt Bounce | 3 | `ricochet_bumpers` + `elevated_green` | Pinball-style bumper field with raised cup platform. Reward reading the geometry. |
| 5 | Wormhole Transfer | 2 | `portal_gate` | Introduce teleport mechanic. Clean portal-to-portal shot with guarded exit. |
| 6 | Solar Flare Run | 3 | `timed_hazard` (×3) | Long narrow lane with staggered timed hazard zones. Threading and timing. |
| 7 | Zero G Lab | 2 | `low_gravity_zone` + `bank_wall` | Reduced gravity zone changes ball arc. Bank walls for intentional rebounds. |
| 8 | Event Horizon | 3 | `suction_zone` + `timed_gate` | Central gravity well can curve ball into cup area or pull it off line. Timed gate guards cup. |
| 9 | Station Core Finale | 4 | `split_route` + `moving_sweeper` + `boost_strip` + `elevated_green` | Multi-stage front-nine closer. Route decision, timing, boost to elevated cup. |

- [ ] Redesign Hole 1 (Docking Lane) — clear introductory hole, establish visual language
- [ ] Redesign Hole 2 (Crater Rim) — teach speed control via bowl contour
- [ ] Redesign Hole 3 (Satellite Slingshot) — first route choice + timing
- [ ] Redesign Hole 4 (Asteroid Belt Bounce) — ricochet field + elevation
- [ ] Redesign Hole 5 (Wormhole Transfer) — clean portal mechanic introduction
- [ ] Redesign Hole 6 (Solar Flare Run) — timed hazard gauntlet
- [ ] Redesign Hole 7 (Zero G Lab) — low gravity zone + banking
- [ ] Redesign Hole 8 (Event Horizon) — gravity well + timed gate
- [ ] Redesign Hole 9 (Station Core Finale) — multi-mechanic closer
- [ ] Playtest all 9 holes in sequence — verify pacing, par values, and difficulty ramp
- [ ] Update `orbitalDriftConfigs.js` (or new JSON format) with final configs

**Exit criteria**: All 9 front-nine holes playable with intentional design. Each hole has a clear identity and the obstacle is in the line of play. Par total: 24.

---

## Phase 4: Build Holes 10–18 (Back Nine)

**Goal**: Complete the 18-hole course with 4 new mechanic types and stronger set pieces.

### New Mechanics Required

- [ ] **Laser Grid** (`laser_grid`): Alternating visual barrier lines. Touching a laser resets ball to last position + penalty stroke. Extends `MechanicBase`, uses timed activation/deactivation.
- [ ] **Disappearing Platform** (`disappearing_platform`): Platform section that fades in/out on a timer. Ball falls to recovery lane if platform disappears. KINEMATIC body toggled on/off.
- [ ] **Gravity Funnel** (`gravity_funnel`): Conical surface that curves ball trajectory toward or away from center based on entry angle and speed. Variant of `bowl_contour` with directional bias.
- [ ] **Multi-Level Ramp** (`multi_ramp`): Series of elevation changes requiring deliberate progression. Chain of `elevated_green` segments with intermediate platforms.

### Back Nine Holes

| # | Name | Par | Primary Mechanic | Design Intent |
|---|------|-----|-----------------|---------------|
| 10 | Laser Grid | 3 | `laser_grid` | Precise shot threading through alternating barriers. Clean sci-fi identity. |
| 11 | Blackout Corridor | 3 | `disappearing_platform` + `bank_wall` | Tight lane, high contrast. Disappearing sections create timing pressure. |
| 12 | Gravity Well | 4 | `gravity_funnel` | Signature terrain hole. Large funnel that rewards skillful curve shots. Safer side route available. |
| 13 | Debris Field | 4 | `ricochet_bumpers` (dense) + `timed_hazard` | Controlled chaos. Dense bumper field with timed danger zones. Reward reading entry angles. |
| 14 | Reactor Bypass | 3 | `timed_hazard` + `boost_strip` | Glowing reactor core hazard zone. Bank around danger or boost through a narrow gap. |
| 15 | Wormhole Relay | 4 | `portal_gate` (×2) + `timed_gate` | Multi-portal chain. Ball teleports twice. Timed gate between portals adds execution. |
| 16 | Eclipse Steps | 4 | `multi_ramp` + `timed_gate` | Tiered platforms with narrow ramps. No lucky skip — must progress step by step. |
| 17 | Comet Run | 3 | `boost_strip` + `moving_sweeper` (fast) | Speed hole. Long lane with boost strips and fast sweepers. One clean line if timed well. |
| 18 | Starforge Finale | 5 | `split_route` + `boost_strip` + `gravity_funnel` + `elevated_green` | Epic closer. Launch decision, gravity section, elevated finish. Combines everything learned. |

- [ ] Implement `laser_grid` mechanic + register in MechanicRegistry
- [ ] Implement `disappearing_platform` mechanic + register
- [ ] Implement `gravity_funnel` mechanic + register
- [ ] Implement `multi_ramp` mechanic + register
- [ ] Build Hole 10 (Laser Grid)
- [ ] Build Hole 11 (Blackout Corridor)
- [ ] Build Hole 12 (Gravity Well)
- [ ] Build Hole 13 (Debris Field)
- [ ] Build Hole 14 (Reactor Bypass)
- [ ] Build Hole 15 (Wormhole Relay)
- [ ] Build Hole 16 (Eclipse Steps)
- [ ] Build Hole 17 (Comet Run)
- [ ] Build Hole 18 (Starforge Finale)
- [ ] Playtest back nine in sequence — verify pacing and escalation
- [ ] Playtest full 18 holes end-to-end

**Exit criteria**: 18 holes playable. 4 new mechanics registered and stable. Back nine par total: 33. Full course par: 57. No duplicate hole identities.

---

## Phase 5: Visual Cohesion & Theme Polish

**Goal**: Make the full course feel like one coherent place, not 18 random space props.

- [ ] Establish consistent material palette: glossy dark metals, neon edge trim for readability, lunar textures for non-play surfaces
- [ ] Ensure every hole's playable surface, walls, and hazards use the same visual language
- [ ] Add sub-theme shift at Hole 10 (back nine) — subtle lighting/color temperature change to mark progression
- [ ] Audit hero props: each hole gets 1–2 landmark props max, not clutter
- [ ] Add per-hole identity prop that makes each hole memorable from a screenshot
- [ ] Readability pass: confirm players can distinguish playable surface / wall / hazard / decoration at a glance
- [ ] Background dressing audit: planets, nebula, satellite silhouettes should be clearly non-interactive
- [ ] Emissive glow pass: ensure moving obstacles and hazards telegraph clearly (research: `docs/research/threejs-emissive-glow-effects.md`)
- [ ] Skybox/starfield polish (research: `docs/research/threejs-skybox-space-environment.md`)
- [ ] Confirm all visual changes maintain mobile FPS targets

**Exit criteria**: Course has a cohesive visual identity. Every hole is readable. Hero props add atmosphere without clutter.

---

## Phase 6: Gameplay Polish & Balancing

**Goal**: Tune physics, balance difficulty, and ensure the course is enjoyable for first-time players.

- [ ] Physics tuning pass: ball speed, bounce feel, damping, cup entry threshold values (research: `docs/research/golf-ball-physics-tuning.md`)
- [ ] Par balancing: play each hole 10+ times, adjust par values based on average completion strokes
- [ ] Difficulty ramp verification: Holes 1–3 should be easy, 4–9 introduce complexity, 10–15 demand precision, 16–18 are challenging but fair
- [ ] Camera preset tuning per hole: player should see the main shot idea from the tee (research: `docs/research/threejs-camera-systems-for-golf.md`)
- [ ] Hole intro camera sweep: brief camera movement showing the hole layout before play starts
- [ ] Blind shot audit: no hole should require knowledge the player doesn't have on first attempt
- [ ] Recovery path audit: every hole must have a recovery route after a bad shot (no soft-locks, no infinite bounce traps)
- [ ] Timing mechanic audit: all moving obstacles must telegraph clearly and have reasonable safe windows
- [ ] Blind playtesting: have someone who has never seen the game play all 18 holes, note confusion points
- [ ] Score persistence: verify `HighScoreManager` correctly saves/loads best scores per course

**Exit criteria**: Par values reflect actual play difficulty. No blind shots. No soft-lock zones. Physics feels consistent and fair.

---

## Phase 7: Validation Tooling & Debug

**Goal**: Prevent broken holes from sneaking into the codebase.

- [ ] Extend `holeValidator.js` to check:
  - Cup is above/flush with green surface (not embedded or floating)
  - No unreachable spawn positions (path exists from start to cup)
  - No walls with collision gaps (boundary polygon is closed)
  - No decorative meshes accidentally colliding with ball
  - Obstacle overlaps with intended shot line (obstacle relevance check)
  - All mechanic configs have required fields for their type
- [ ] Add debug visualization mode:
  - Physics wireframe overlay (existing CannonDebugRenderer)
  - Intended shot line visualization from tee to cup
  - Mechanic activation zones highlighted
  - Cup detection radius visualized
- [ ] Add hole test harness: load any single hole by index, skip to it, reset it, modify config hot
- [ ] Write unit tests for all 4 new mechanic types (Phase 4)
- [ ] Write integration tests for hole transition flow (destroy → construct → reposition → play)
- [ ] Update coverage to maintain 60% threshold with new code
- [ ] Add Playwright UAT test: play through all 18 holes automated

**Exit criteria**: Validators catch common config mistakes. Debug tools support fast iteration. Test coverage maintained.

---

## Phase 8: Expansion Framework

**Goal**: Make creating Course 2 a content task, not an architecture task.

- [ ] Extract course config format into a documented schema (course manifest: name, theme, hole count, hole configs)
- [ ] Create course template: a starter config with 3 example holes and all required fields
- [ ] Support multiple courses in `CoursesManager`: course selection screen, per-course high scores
- [ ] Document the obstacle extension workflow: how to add a new mechanic type (file, register, config shape, test)
- [ ] Document the course creation workflow: how to build a new course from template to playable
- [ ] Define future course concepts (names and themes only — not full designs):
  - Moonbase Classic — traditional mini golf on a lunar base
  - Alien Greenhouse — organic/plant-themed obstacles in a biodome
  - Retro Arcade Station — neon pixel-art inspired course
  - Black Hole Lab — extreme gravity mechanics, experimental feel
  - Mars Industrial Yard — industrial machinery obstacles, red desert theme
- [ ] Ensure theme system supports per-course theme objects (not just per-hole overrides)
- [ ] Add course completion stats: total strokes, holes-in-one, best hole, worst hole

**Exit criteria**: A new developer can create a new course by following the docs and template without modifying core engine code. Multi-course selection works.

---

## Summary

| Phase | Focus | Key Deliverable |
|-------|-------|----------------|
| 1 | Audit & Stabilize | Audit report, bug fixes |
| 2 | Authoring Framework | JSON configs, schema validation, obstacle taxonomy |
| 3 | Front Nine | 9 redesigned holes with intentional design |
| 4 | Back Nine | 4 new mechanics, 9 new holes, full 18-hole course |
| 5 | Visual Polish | Cohesive theme, readability, hero props |
| 6 | Gameplay Balance | Physics tuning, par balancing, playtesting |
| 7 | Tooling & Testing | Validators, debug tools, test coverage |
| 8 | Expansion | Course template, multi-course support, docs |
