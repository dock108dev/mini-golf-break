# ARCHITECTURE.md — mini-golf-break

## Overview

mini-golf-break is a browser-based 3D mini golf game using a **manager-based singleton architecture**. The `Game` class (the orchestrator) owns all managers, controllers, and game objects. Managers communicate through a central **event bus** (`EventManager`). Holes are **data-driven**: each hole is a config object interpreted at runtime by `HoleEntity`, which delegates obstacle creation to a **mechanic registry**.

```
┌──────────────────────────────────────────────────┐
│                     App (main.js)                │
│  ┌────────────────────────────────────────────┐  │
│  │              Game (orchestrator)            │  │
│  │                                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ State    │  │ Physics  │  │ Event    │ │  │
│  │  │ Manager  │  │ Manager  │  │ Manager  │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ Ball     │  │ Hole     │  │ UI       │ │  │
│  │  │ Manager  │  │ State Mgr│  │ Manager  │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ Hazard   │  │ Audio    │  │ Visual FX│ │  │
│  │  │ Manager  │  │ Manager  │  │ Manager  │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ HoleTrans│  │ HoleComp │  │ StuckBall│ │  │
│  │  │ ition Mgr│  │ letion   │  │ Manager  │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ Debug    │  │ Perf     │  │ WebGL Ctx│ │  │
│  │  │ Manager  │  │ Manager  │  │ Manager  │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ GameLoop │  │ Camera   │  │ Input    │ │  │
│  │  │ Manager  │  │ Ctrl     │  │ Ctrl     │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐               │  │
│  │  │ Scoring  │  │ Course   │               │  │
│  │  │ System   │  │ (object) │               │  │
│  │  └──────────┘  └──────────┘               │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## Boot Sequence

The app initializes in two phases:

1. **Visual init** (`App.initVisuals` → `Game.initVisuals`): renderer, scene, lights, starfield, space decorations, camera orbit, game loop. Runs on page load so the menu has a space backdrop.
2. **Gameplay init** (`App.startCourse` → `Game.startGame`): physics world, course construction, ball creation, input controller, scoring. Runs when the player clicks Play.

```
window.load
  └─ App()
       ├─ initVisuals()
       │    ├─ WebGLRenderer setup
       │    ├─ DebugManager.init()
       │    ├─ EventManager.init()
       │    ├─ PerformanceManager.init()
       │    ├─ StateManager.resetState()
       │    ├─ UIManager.init() + attachRenderer
       │    ├─ CameraController.init()
       │    ├─ setupLights()
       │    ├─ SpaceDecorations.init()
       │    └─ GameLoopManager.init() + startLoop()
       │
       └─ startCourse() [on Play click]
            ├─ PhysicsManager.init()
            ├─ AudioManager.init()
            ├─ HoleCompletionManager.init()
            ├─ HazardManager.init()
            ├─ VisualEffectsManager.init()
            ├─ createCourse() → OrbitalDriftCourse.create()
            │    └─ for each hole config → HoleEntity.init()
            ├─ BallManager.init() + createBall()
            ├─ StuckBallManager.init()
            ├─ InputController.init()
            ├─ UIManager update (hole info, score, strokes)
            └─ StateManager → PLAYING
```

## Key Components

### Game (scenes/Game.js)

The central orchestrator. Owns all managers and game objects. Handles initialization order, cleanup order, pause/resume, and the render/physics loop delegation. Does not contain gameplay logic directly — delegates to managers.

### Managers (managers/)

Each manager is a singleton owned by `Game`. Managers receive a `game` reference in their constructor and access other managers through `this.game.<managerName>`.

| Manager | Responsibility |
|---------|---------------|
| **StateManager** | Game state machine (INITIALIZING → PLAYING → AIMING → HOLE_COMPLETED → GAME_COMPLETED → PAUSED). Tracks ball motion, hole completion, current hole number. Publishes state change events. |
| **PhysicsManager** | Creates and owns the Cannon-es `World`. Defines contact materials (ball, green, wall, bumper). Steps the physics simulation each frame. |
| **EventManager** | Pub/sub event bus. All cross-manager communication goes through events (see Event Types below). Wraps subscriber calls in try-catch. |
| **BallManager** | Creates the `Ball` instance, manages ball positioning for new holes, handles ball reset on out-of-bounds or hazard contact. |
| **HoleStateManager** | Tracks per-hole state: current hole entity reference, start/hole positions, active mechanics. |
| **HoleTransitionManager** | Handles the sequence between holes: destroy old hole entity, construct next hole, reposition ball and camera, publish HOLE_STARTED. |
| **HoleCompletionManager** | Listens for BALL_IN_HOLE events, triggers completion animation/UI, advances to next hole or ends game. |
| **HazardManager** | Detects ball overlap with hazard trigger bodies (sand bunkers, water). Publishes HAZARD_DETECTED events. |
| **UIManager** | Manages DOM overlays: score display, hole info, messages, pause screen, scorecard. Attaches the WebGL renderer to the DOM. |
| **AudioManager** | Plays sound effects (hit, bump, splash, success, outOfBounds) via Web Audio API. |
| **VisualEffectsManager** | Particle effects and material transitions: hole completion celebration, ball rejection flash, ball visual reset. |
| **GameLoopManager** | Owns the `requestAnimationFrame` loop. Each frame: clamp dt, step physics, update ball, update mechanics, update camera, render. Handles pause/resume of the loop. |
| **PerformanceManager** | Tracks FPS, frame times, dt spikes. Provides performance data to debug overlays. |
| **DebugManager** | Debug mode toggle, debug overlays (physics wireframes, state readouts). Wraps `CannonDebugRenderer`. |
| **StuckBallManager** | Detects when the ball is stuck (velocity near zero but not at rest on a valid surface). Triggers automatic reset after a timeout. |
| **WebGLContextManager** | Handles WebGL context loss/restore events to prevent hard crashes on mobile. |

### Controllers (controls/)

| Controller | Responsibility |
|------------|---------------|
| **InputController** | Mouse/touch drag for aim direction and power. Keyboard fallback. Publishes BALL_HIT with direction + power. |
| **CameraController** | Per-hole camera positioning. Menu orbit mode. Follow-ball mode during play. Smooth transitions between positions. |

### Course System (objects/, config/)

**OrbitalDriftCourse** (`objects/OrbitalDriftCourse.js`): The current course class. Loads hole configs from `createOrbitalDriftConfigs()`, creates a Three.js Group per hole, and manages which hole is active.

**HoleEntity** (`objects/HoleEntity.js`): Extends `BaseElement`. Constructed from a hole config object. Creates all hole geometry at init time:
- Green surface + physics body (via `GreenSurfaceBuilder`)
- Boundary walls (from `boundaryShape` polygon)
- Hole rim, hole interior visual, hole trigger body
- Tee marker at start position
- Hazards (via `HazardFactory`)
- Bumpers (static box colliders)
- Mechanics (via `MechanicRegistry`)
- Hero props (via `HeroPropFactory`)

**Hole Config Shape** (defined in `config/orbitalDriftConfigs.js`):
```js
{
  index: number,           // 0-based hole index
  description: string,     // Display name ("1. Launch Bay")
  par: number,
  theme: object,           // Theme override (merged with defaultTheme)
  boundaryShape: Vector2[],// Closed polygon defining green boundary
  startPosition: Vector3,  // Ball spawn (world coords)
  holePosition: Vector3,   // Cup position (world coords)
  hazards: HazardConfig[],
  bumpers: BumperConfig[],
  mechanics: MechanicConfig[],
  heroProps: HeroPropConfig[]
}
```

### Mechanic System (mechanics/)

The mechanic system is a **factory + self-registration pattern**. Each mechanic file registers itself with `MechanicRegistry` on import. `HoleEntity.createMechanics()` calls `createMechanic(type, ...)` to instantiate mechanics from config.

**Base class**: `MechanicBase` — provides lifecycle (constructor, update, onDtSpike, destroy), resource tracking (meshes[], bodies[]), and utility methods (isBallInZone, setMeshVisibility).

**Registered mechanic types** (14 total):

| Type | Class | Gameplay Effect |
|------|-------|----------------|
| `bank_wall` | BankWall | Angled wall segments with configurable restitution for intentional banking |
| `boost_strip` | BoostStrip | Directional force zone that accelerates the ball |
| `bowl_contour` | BowlContour | Radial gravity pull toward center — funnel/crater effect |
| `elevated_green` | ElevatedGreen | Raised platform with ramp access |
| `low_gravity_zone` | LowGravityZone | Reduces gravity multiplier in a radius |
| `moving_sweeper` | MovingSweeper | Rotating arm obstacle — KINEMATIC body |
| `portal_gate` | PortalGate | Teleports ball from entry to exit position |
| `ricochet_bumpers` | RicochetBumpers | Array of cylindrical/spherical bumpers for pinball-style bouncing |
| `split_route` | SplitRoute | Dividing wall creating two path options |
| `suction_zone` | SuctionZone | Pulls ball toward center (black hole effect) |
| `timed_gate` | TimedGate | Gate that opens/closes on a timer |
| `timed_hazard` | TimedHazard | Hazard zone that activates/deactivates on a cycle |
| `boost_strip` | BoostStrip | Directional speed boost zone |
| `elevated_green` | ElevatedGreen | Raised green with ramp |

### Ball (objects/Ball.js)

The ball owns its Three.js mesh (sphere with dimple bump map) and Cannon-es body (dynamic sphere, mass 1). Key behaviors:
- **Hole detection**: Per-frame distance check against `currentHolePosition`. If within overlap threshold and under max speed → success. If too fast → lip-out hop impulse.
- **Hazards**: Checks bunker/water trigger overlap each frame. Bunker increases damping. Water resets to last hit position + penalty stroke.
- **Out of bounds**: y < -50 triggers reset to start position.
- **Stopped detection**: Velocity + angular velocity threshold check with hysteresis.

### Scoring (game/ScoringSystem.js, game/HighScoreManager.js)

`ScoringSystem` tracks strokes per hole and total. `HighScoreManager` persists best scores to `localStorage` keyed by course name.

### Themes (themes/)

Theme objects define material properties (color, roughness, metalness, emissive) for every visual element: green surface, walls, rim, hole interior, tee, bumpers, hazards. `defaultTheme` provides base values; `spaceTheme` overrides with sci-fi aesthetics (dark metals, neon emissives). Themes are merged at `HoleEntity` construction time.

## Data Flow

### Frame Update Cycle

```
requestAnimationFrame
  └─ GameLoopManager.loop()
       ├─ dt = clock.getDelta(), clamp to max
       ├─ PhysicsManager.step(dt) — Cannon-es world.step()
       ├─ Ball.update(dt) — sync mesh ↔ body, check hole/hazards/OOB
       ├─ HoleEntity.update(dt, ballBody) — update all mechanics
       ├─ CameraController.update(dt)
       ├─ PerformanceManager.update(dt)
       └─ Renderer.render(scene, camera)
```

### Ball Hit → Hole Complete Event Chain

```
InputController.onPointerUp()
  → Ball.applyImpulse(direction, power)
  → EventManager.publish(BALL_HIT)
  → [physics simulation runs over multiple frames]
  → Ball.update() detects overlap + speed check
  → Ball.handleHoleSuccess()
  → EventManager.publish(BALL_IN_HOLE)
  → HoleCompletionManager listens → triggers UI, effects
  → StateManager.setHoleCompleted(true)
  → EventManager.publish(HOLE_COMPLETED)
  → HoleTransitionManager listens → advances hole or ends game
```

### Hole Construction Pipeline

```
OrbitalDriftCourse.create()
  → createOrbitalDriftConfigs() — returns config array
  → for each config:
       → new THREE.Group(`Hole_N_Group`)
       → new HoleEntity(world, config, group)
       → HoleEntity.init()
            ├─ buildGreenSurface() — CSG mesh + Cannon trimesh
            ├─ createWalls() — boundary polygon → box colliders
            ├─ createHoleRim/Visual/Trigger — cup geometry + trigger body
            ├─ createStartPosition() — tee marker mesh
            ├─ createHazards() → HazardFactory
            ├─ createBumpers() — static box colliders
            ├─ createMechanics() → MechanicRegistry.createMechanic()
            └─ createHeroProps() → HeroPropFactory
```

## State Machine

```
INITIALIZING → PLAYING → AIMING ⇄ PLAYING
                  │                  │
                  ├── PAUSED ────────┘ (Escape key)
                  │
                  └── HOLE_COMPLETED → [next hole] → AIMING
                                     → [last hole] → GAME_COMPLETED
```

States are defined in `states/GameState.js`:
- **INITIALIZING**: Boot sequence in progress
- **PLAYING**: Ball in motion after a hit
- **AIMING**: Ball at rest, player aiming next shot
- **HOLE_COMPLETED**: Ball sunk, completion animation playing
- **GAME_COMPLETED**: All holes finished, scorecard displayed
- **PAUSED**: Game loop suspended, pause overlay visible

## Event Types

All events use `domain:action` naming (defined in `events/EventTypes.js`):

| Event | Payload | Published By |
|-------|---------|-------------|
| `ball:created` | — | BallManager |
| `ball:hit` | `{ power }` | Ball |
| `ball:moved` | position data | Ball |
| `ball:stopped` | — | BallManager |
| `ball:reset` | — | BallManager |
| `ball:in_hole` | `{ ballBody, holeIndex }` | Ball |
| `ball:stuck` | — | StuckBallManager |
| `hole:started` | `{ holeNumber }` | StateManager |
| `hole:completed` | — | StateManager |
| `game:started` | `{ timestamp }` | Game |
| `game:initialized` | `{ timestamp }` | Game |
| `game:completed` | `{ timestamp }` | StateManager |
| `game:paused` | `{ timestamp }` | Game |
| `game:resumed` | `{ timestamp }` | Game |
| `hazard:detected` | hazard data | HazardManager |
| `state:changed` | `{ oldState, newState }` | StateManager |
| `system:error` | error data | DebugManager |
| `ui:request_restart_game` | — | UIManager |

## Physics Architecture

**Engine**: Cannon-es (rigid body physics)

**World configuration** (via PhysicsManager):
- Gravity: (0, -9.82, 0)
- Solver iterations: configured for stability
- Contact materials define friction/restitution between: ball↔green, ball↔wall, ball↔bumper

**Body types used**:
- `DYNAMIC` — Ball only (mass 1, sphere shape, CCD enabled)
- `STATIC` — Green surface (trimesh), walls (boxes), bumpers (boxes), hazard triggers
- `KINEMATIC` — Moving obstacles (MovingSweeper arm). Position updated in mechanic.update(), physics engine handles collisions.
- `isTrigger: true` — Hole cup trigger (cylinder), hazard zone triggers. No collision response, only overlap detection.

**Physics/render sync**: Ball mesh position copies from Cannon body each frame (`Ball.update`). Kinematic mechanic meshes copy position from their Cannon bodies after manual position updates.

## Directory Structure

```
src/
├── main.js                    # App entry, menu logic, game lifecycle
├── config/
│   ├── debugConfig.js         # Debug flag defaults
│   └── orbitalDriftConfigs.js # 9-hole course configs (data-driven)
├── controls/
│   ├── CameraController.js    # Camera positioning, orbit, follow
│   └── InputController.js     # Mouse/touch/keyboard aim + hit
├── events/
│   ├── EventTypes.js          # Event name constants
│   └── GameEvent.js           # Event wrapper class
├── game/
│   ├── HighScoreManager.js    # localStorage persistence
│   └── ScoringSystem.js       # Stroke counting, par tracking
├── managers/
│   ├── AudioManager.js
│   ├── BallManager.js
│   ├── CoursesManager.js
│   ├── DebugManager.js
│   ├── EventManager.js
│   ├── GameLoopManager.js
│   ├── HazardManager.js
│   ├── HoleCompletionManager.js
│   ├── HoleStateManager.js
│   ├── HoleTransitionManager.js
│   ├── PerformanceManager.js
│   ├── PhysicsManager.js
│   ├── StateManager.js
│   ├── StuckBallManager.js
│   ├── UIManager.js
│   ├── VisualEffectsManager.js
│   ├── WebGLContextManager.js
│   ├── debug/                 # Debug UI overlay components
│   └── ui/                    # Score/debug overlay components
├── mechanics/
│   ├── MechanicBase.js        # Abstract base class
│   ├── MechanicRegistry.js    # Factory + type registry
│   ├── index.js               # Barrel import (triggers self-registration)
│   ├── BankWall.js
│   ├── BoostStrip.js
│   ├── BowlContour.js
│   ├── ElevatedGreen.js
│   ├── LowGravityZone.js
│   ├── MovingSweeper.js
│   ├── PortalGate.js
│   ├── RicochetBumpers.js
│   ├── SplitRoute.js
│   ├── SuctionZone.js
│   ├── TimedGate.js
│   └── TimedHazard.js
├── objects/
│   ├── Ball.js                # Ball mesh + physics + hole detection
│   ├── BallPhysicsHelper.js   # Velocity reset, hazard overlap checks
│   ├── BaseElement.js         # Base class for course elements
│   ├── GreenSurfaceBuilder.js # CSG green mesh + physics body
│   ├── HeroPropFactory.js     # Decorative prop creation
│   ├── HoleEntity.js          # Full hole construction from config
│   ├── OrbitalDriftCourse.js  # Course class (loads configs, manages holes)
│   ├── SpaceDecorations.js    # Background space objects
│   └── hazards/               # Hazard types + HazardFactory
├── physics/
│   └── PhysicsWorld.js        # Cannon-es world setup helpers
├── scenes/
│   └── Game.js                # Main orchestrator
├── states/
│   └── GameState.js           # State enum
├── themes/
│   ├── defaultTheme.js        # Base material properties
│   └── spaceTheme.js          # Space theme overrides
├── utils/
│   ├── CannonDebugRenderer.js # Physics wireframe visualization
│   ├── debug.js               # Debug logging utility
│   ├── holeValidator.js       # Config validation
│   └── webglDetect.js         # WebGL availability check
└── tests/
    ├── setup.js
    ├── jest.setup.js
    ├── unit/                  # Unit tests (mirrors src/)
    └── integration/           # Integration tests
```
