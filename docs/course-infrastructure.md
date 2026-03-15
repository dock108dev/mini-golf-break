# Course Infrastructure: Audit, Architecture & Implementation Plan

## 1. Executive Summary

Mini Golf Break has a working 9-hole course system built on config-driven `HoleEntity` objects composed from boundary shapes, hazards, and bumpers. The foundation is solid but limited to flat, static geometry. The Orbital Drift course requires 12 new mechanic types (moving obstacles, force fields, portals, elevation, timed hazards) that don't exist yet.

**Strategy:** Extend the existing config-driven architecture with a `MechanicRegistry` pattern. Each mechanic type is a self-contained class that creates its own meshes and physics bodies, updates per frame, and cleans up on destroy. Hole configs gain a `mechanics[]` array. This preserves backward compatibility — existing holes work unchanged because their `mechanics` array is empty.

**Risk level:** Low for foundation (Stages 1-2). Medium for force fields and portals (Stages 3-4). High for elevation (Stage 7) due to Cannon-es Trimesh limitations.

---

## 2. Current State Audit

### What Works Well (Keep)
| System | Status | Notes |
|--------|--------|-------|
| HoleEntity config → geometry pipeline | Solid | Boundary shapes, CSG cutouts, walls, hazards |
| HazardFactory (sand/water) | Good | Circle, rectangle, compound shapes all work |
| Ball physics (bunker, water, hole entry) | Good | Speed/overlap checks, damping zones, penalty resets |
| ScoringSystem | Good | Per-hole tracking, completeHole(), getHoleScores() |
| Event system | Good | Pub/sub with EventTypes, clean flow |
| Debug tools | Useful | Hole jumping (1-9), course type toggle, performance overlay |
| CoursesManager base class | Adequate | Clean interface for course implementations |

### What's Missing (Build)
| Need | Impact | Holes Affected |
|------|--------|---------------|
| Moving obstacles | Critical | H1, H3, H6, H8, H9 |
| Force fields (boost, suction, low-G) | Critical | H7, H8, H9 |
| Portal/teleporter | Critical | H5 |
| Timed hazards & gates | Critical | H6, H8 |
| Elevation/ramps | High | H4, H6, H9 |
| Split routes | High | H3, H9 |
| Bowl/contour surfaces | Medium | H2 |
| Hero props | Medium | All holes (visual) |
| Theme/skin separation | Medium | Future courses |
| Camera hints per hole | Low | All holes |
| Par display in scorecard | Low | UI polish |

### Technical Debt
- Colors hardcoded in 4 files (HoleEntity, GreenSurfaceBuilder, HazardFactory, bumper creation)
- Bumpers limited to BoxGeometry — no cylinders or spheres
- No animation/update tick in HoleEntity (update() exists but is empty)
- CourseElementFactory exists but is orphaned (only used by tests)
- AudioManager has only 2 procedural sounds, no audio file pipeline
- SpaceDecorations are static (planets rotate but debris/stars are fixed)

---

## 3. Target Architecture

### Core Design Principle
**Holes = Config + Shared Primitives + Mechanics**

```
Course Config (orbitalDriftConfigs.js)
  └→ Hole Config
       ├→ boundaryShape, positions (existing)
       ├→ hazards[] (existing)
       ├→ bumpers[] (existing, extended with geometry types)
       ├→ mechanics[] (NEW - array of mechanic descriptors)
       ├→ theme (NEW - per-hole visual overrides)
       ├→ elevation (NEW - surface Y height)
       └→ cameraHint (NEW - camera positioning override)

HoleEntity.init()
  ├→ buildGreenSurface() (existing)
  ├→ createWalls() (existing)
  ├→ createHoleRim/Visual/Trigger() (existing)
  ├→ createHazards() (existing)
  ├→ createBumpers() (existing, extended)
  └→ createMechanics() (NEW)
       └→ for each config.mechanics[]:
            MechanicRegistry.create(type, world, group, config, surfaceHeight)

HoleEntity.update(dt, ballBody)
  └→ for each mechanic:
       mechanic.update(dt, ballBody)

HoleEntity.destroy()
  └→ for each mechanic:
       mechanic.destroy()
```

### MechanicSystem Pattern

Every mechanic follows this interface:

```js
class MechanicBase {
  constructor(world, group, config, surfaceHeight)
  update(dt, ballBody)  // Move obstacles, apply forces, check triggers
  destroy()             // Clean up meshes and physics bodies
  getMeshes()           // THREE.Mesh[] for resource tracking
  getBodies()           // CANNON.Body[] for resource tracking
}
```

Mechanics self-register with a central registry:

```js
// MechanicRegistry.js
registerMechanic('moving_sweeper', (world, group, config, sh) => new MovingSweeper(world, group, config, sh));
```

HoleEntity calls `createMechanic(type, ...)` which looks up the factory and instantiates.

---

## 4. Content/Data Schema

### Extended Hole Config

```js
{
  // === EXISTING (unchanged) ===
  index: 0,
  description: '1. Launch Bay',
  par: 2,
  boundaryShape: [Vector2(...)],
  startPosition: Vector3(...),
  holePosition: Vector3(...),
  hazards: [{ type, shape, position, size, depth }],
  bumpers: [{ position, size, rotation }],

  // === NEW FIELDS ===
  elevation: 0.2,                    // Surface Y height (default 0.2)
  cameraHint: {                      // Optional camera positioning
    offset: Vector3(0, 15, 12),
    lookAt: Vector3(0, 0, -2)
  },
  theme: {                           // Optional per-hole visual overrides
    greenColor: 0x1a3a2a,
    wallColor: 0x4a4a6a
  },
  mechanics: [                       // Array of mechanic descriptors
    {
      type: 'moving_sweeper',        // Registry lookup key
      // ... type-specific config
    }
  ],
  heroProps: [                       // Decorative objects (no physics)
    {
      type: 'rocket_stand',
      position: Vector3(...),
      scale: 1.5,
      rotation: Euler(...)
    }
  ]
}
```

### Mechanic Config Schemas

| Type | Required Fields |
|------|----------------|
| `moving_sweeper` | pivot, armLength, speed, size, phase? |
| `timed_hazard` | position, size, onDuration, offDuration, hazardType |
| `timed_gate` | position, size, openDuration, closedDuration, phase? |
| `boost_strip` | position, direction, force, size |
| `suction_zone` | position, radius, force |
| `low_gravity_zone` | position, radius, gravityMultiplier |
| `bowl_contour` | position, radius, force |
| `portal_gate` | entryPosition, exitPosition, radius |
| `bank_wall` | segments: [{start, end}], height, restitution? |
| `split_route` | walls: [{start, end}], height |
| `elevated_green` | region: [Vector2], elevation, rampStart, rampEnd |
| `ricochet_bumpers` | bumpers: [{position, radius\|size, geometry, restitution}] |

### Theme Definition

```js
{
  name: 'Orbital Drift',
  green: { color, roughness, metalness, emissive },
  wall: { color, roughness, metalness, emissive },
  bumper: { color, roughness, metalness },
  sand: { color },
  water: { color, opacity },
  tee: { color },
  rim: { color },
  background: 0x000000,
}
```

---

## 5. Reusable Systems to Build

### Priority Order (by dependency and hole coverage)

| # | System | Holes Using It | Complexity |
|---|--------|---------------|------------|
| 1 | MechanicRegistry + Base | All | Low |
| 2 | MovingSweeper | H1, H3, H9 | Medium |
| 3 | BoostStrip | H9 | Low |
| 4 | SuctionZone | H8 | Low |
| 5 | LowGravityZone | H7 | Low |
| 6 | BowlContour | H2 | Low |
| 7 | PortalGate | H5 | Medium |
| 8 | TimedHazard | H6 | Medium |
| 9 | TimedGate | H8 | Medium |
| 10 | BankWall | H4, H7 | Low |
| 11 | SplitRoute | H3, H9 | Low |
| 12 | RicochetBumpers | H4 | Low |
| 13 | ElevatedGreen | H4, H6, H9 | High |

### Force-Field Pattern (shared by BoostStrip, SuctionZone, LowGravityZone, BowlContour)

All force fields follow the same pattern:
1. Create a trigger zone (CANNON body, isTrigger=true)
2. Each frame, check if ball overlaps trigger zone
3. If overlapping, apply a force vector to ballBody
4. Visual: semi-transparent mesh showing the affected area

Differences are only in force direction calculation:
- **BoostStrip**: constant direction vector × force
- **SuctionZone**: (zoneCenter - ballPos).normalize() × force
- **LowGravityZone**: Vector3(0, counterGravity, 0) to reduce effective gravity
- **BowlContour**: (zoneCenter - ballPos).normalize() × force × distanceFromCenter

---

## 6. Theme & Asset Pipeline

### Current State
- No texture files (all procedural materials)
- No 3D models (all runtime geometry)
- 2 procedural sounds (hit, success)
- 1 image (logo.png)

### Approach for Orbital Drift
Keep procedural geometry for MVP. Add theme color system. Plan for texture/model support later.

**Phase 1 (Now):** Extract hardcoded colors into theme objects. Thread theme through builders.
**Phase 2 (Future):** Add texture loading for green surfaces, wall materials. Add glTF model loading for hero props.
**Phase 3 (Future):** Add sound files via AudioManager.loadSound(). Add particle effect presets.

### Hero Props (Visual Only, No Physics)

Hero props are decorative Three.js objects placed at specified positions. They don't interact with gameplay. For MVP, build them from basic geometry (cylinders, spheres, boxes). Later replace with loaded models.

```js
// Hole config
heroProps: [
  { type: 'rocket_stand', position: Vector3(-5, 0, 8), scale: 2 }
]
```

A `HeroPropFactory` creates the mesh from type + config and adds to the hole group.

---

## 7. Orbital Drift Hole-by-Hole Mapping

| Hole | New Mechanics Needed | Existing Systems Used | Hero Prop |
|------|---------------------|----------------------|-----------|
| H1 Launch Bay | moving_sweeper | walls, bumpers | Rocket on stand |
| H2 Crater Rim | bowl_contour | hazards (sand) | Moon rover |
| H3 Satellite Slingshot | split_route, moving_sweeper | walls | Satellite dish |
| H4 Asteroid Belt Bounce | ricochet_bumpers, elevated_green | bumpers | Asteroid cluster |
| H5 Wormhole Transfer | portal_gate | walls | Wormhole ring effect |
| H6 Solar Flare Run | timed_hazard | walls, hazards | Energy collector array |
| H7 Zero G Lab | low_gravity_zone, bank_wall | walls, bumpers | Lab equipment |
| H8 Event Horizon | suction_zone, timed_gate | walls | Black hole core |
| H9 Station Core | split_route, boost_strip, moving_sweeper, elevated_green | walls, bumpers | Station reactor |

---

## 8. File/Folder Plan

```
src/
  config/
    nineHoleConfigs.js            # Existing space course (backward compat)
    orbitalDriftConfigs.js        # NEW: Orbital Drift 9-hole configs
    debugConfig.js                # Existing
  mechanics/
    MechanicRegistry.js           # NEW: type→factory map
    MechanicBase.js               # NEW: base class with documented interface
    MovingSweeper.js              # NEW
    BoostStrip.js                 # NEW
    SuctionZone.js                # NEW
    LowGravityZone.js             # NEW
    BowlContour.js                # NEW
    PortalGate.js                 # NEW
    TimedHazard.js                # NEW
    TimedGate.js                  # NEW
    BankWall.js                   # NEW
    SplitRoute.js                 # NEW
    RicochetBumpers.js            # NEW
    ElevatedGreen.js              # NEW
    index.js                      # NEW: imports all mechanics to trigger registration
  themes/
    defaultTheme.js               # NEW: current hardcoded colors extracted
    spaceTheme.js                 # NEW: Orbital Drift visual language
  objects/
    HoleEntity.js                 # MODIFIED
    OrbitalDriftCourse.js         # NEW
    GreenSurfaceBuilder.js        # MODIFIED (theme colors)
    HeroPropFactory.js            # NEW (future)
    hazards/
      HazardFactory.js            # MODIFIED (theme colors)
```

---

## 9. Validation & Debug Tooling

### Hole Validator (implement in Stage 2)
Checks each hole config for:
- startPosition inside boundaryShape
- holePosition inside boundaryShape
- All hazard positions inside boundaryShape
- All bumper positions inside boundaryShape
- par > 0
- At least 3 boundary points forming a closed shape
- No overlapping hazards with hole position

### Mechanic Validator
- All mechanic types registered in MechanicRegistry
- Portal entry and exit positions inside boundary
- Force field positions inside boundary
- Moving obstacle pivot points inside boundary

### Debug Visualizations
- Force field zones shown as semi-transparent colored meshes (toggle with 'd')
- Portal connections shown as lines between entry/exit
- Moving obstacle paths shown as arcs/lines
- Trigger volumes outlined in wireframe

---

## 10. Staged Implementation Roadmap

### Stage 1: Foundation (implement now)
- [ ] Create `src/mechanics/MechanicBase.js`
- [ ] Create `src/mechanics/MechanicRegistry.js`
- [ ] Create `src/mechanics/index.js` (barrel import)
- [ ] Modify `HoleEntity.js`: add `createMechanics()`, `update(dt, ballBody)`, mechanic cleanup
- [ ] Modify `NineHoleCourse.js`: pass ballBody to `currentHoleEntity.update()`
- [ ] Extend bumper creation to support `geometry: 'cylinder'|'sphere'`
- [ ] Verify existing 9-hole course still works

### Stage 2: First Mechanic (MovingSweeper)
- [ ] Implement `MovingSweeper.js` with kinematic body
- [ ] Add sweeper to test hole config
- [ ] Verify ball-sweeper collision works
- [ ] Add hole config validator

### Stage 3: Force Fields
- [ ] Implement `BoostStrip.js`
- [ ] Implement `SuctionZone.js`
- [ ] Implement `LowGravityZone.js`
- [ ] Implement `BowlContour.js`
- [ ] Add debug visualization for force field zones

### Stage 4: Portal
- [ ] Implement `PortalGate.js` with teleport + cooldown
- [ ] Visual: emissive ring meshes
- [ ] Validate entry/exit positions

### Stage 5: Timed Mechanics
- [ ] Implement `TimedHazard.js`
- [ ] Implement `TimedGate.js`
- [ ] Add timing preview in debug mode

### Stage 6: Structural Mechanics
- [ ] Implement `BankWall.js`
- [ ] Implement `SplitRoute.js`
- [ ] Implement `RicochetBumpers.js`

### Stage 7: Elevation
- [ ] Implement `ElevatedGreen.js` (ramp + raised platform)
- [ ] Modify GreenSurfaceBuilder for multi-level support

### Stage 8: Theme System
- [ ] Extract colors to `defaultTheme.js`
- [ ] Create `spaceTheme.js`
- [ ] Thread theme through all builders

### Stage 9: Orbital Drift Course
- [ ] Author all 9 hole configs in `orbitalDriftConfigs.js`
- [ ] Create `OrbitalDriftCourse.js`
- [ ] Playtest and tune each hole
- [ ] Add hero prop placeholders

---

## 11. Remaining Gaps / Risks

| Gap | Impact | Mitigation |
|-----|--------|------------|
| Elevation is hard in Cannon-es | H4, H6, H9 may need simplified ramps | Use tilted Trimesh planes, avoid arbitrary terrain |
| No audio file pipeline | All sounds are procedural | Acceptable for MVP, add file loading later |
| No model loading | Hero props will be basic geometry | glTF loader is a future addition |
| CSG is expensive | Each hole load takes ~100ms | Acceptable, cache only if needed |
| Bowl contour is approximated | H2 won't have true concave geometry | Radial force field simulates bowl feel |
| Portal physics edge cases | Ball velocity preservation on teleport | Add cooldown timer, test thoroughly |
| No CI/CD | Manual testing only | Pre-commit hook runs build |

---

## 12. Assumptions

- Cannon-es kinematic bodies handle moving obstacle collisions correctly (verified in Cannon-es docs)
- Force application via `applyForce()` each frame is performant for 3-4 simultaneous force fields
- Portal teleport is instant (no animation) for MVP
- Bowl contour uses force field, not actual concave geometry (true concave meshes are problematic in Cannon-es)
- Elevation is limited to one-step platforms with ramps, not arbitrary terrain
- Hero props are visual only, no collision
