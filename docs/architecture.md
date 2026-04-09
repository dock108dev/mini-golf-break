# Architecture

## Overview

Mini Golf Break is a client-side 3D browser game with no backend. Built with Three.js (rendering) and Cannon-es (physics). The `App` class (`src/main.js`) manages the start screen and game lifecycle. The `Game` class (`src/scenes/Game.js`) coordinates all subsystems. Managers communicate through a central `EventManager` using pub/sub events. The `GameLoopManager` drives the per-frame update cycle.

## Startup Flow

1. `window.load` fires in `main.js`
2. WebGL availability is checked -- if unavailable, a fallback message is shown
3. `App` is created, which creates a `Game` instance
4. `App.initVisuals()` initializes the renderer, scene, lights, and space decorations (starfield, planets)
5. The loading screen is dismissed and the menu/welcome screen is shown
6. When the player clicks **Play**, `App.startCourse()` calls `Game.startGame()` which initializes the course, physics, ball, and starts the game loop

## Game Loop

`GameLoopManager` runs via `requestAnimationFrame` and updates subsystems in this order:

1. **Physics** -- `PhysicsManager` steps the Cannon-es world
2. **Ball** -- `BallManager` syncs ball mesh to physics body, checks hazards
3. **Hazards** -- `HazardManager` checks ball against out-of-bounds
4. **Stuck Ball** -- `StuckBallManager` detects balls in prolonged motion
5. **Camera** -- `CameraController` follows ball with intelligent positioning
6. **Visual Effects** -- `VisualEffectsManager` animates active particle systems
7. **Cannon Debug** -- Debug physics wireframes (when debug mode enabled)
8. **Space Decorations** -- Planet rotation, shooting stars
9. **Render** -- Three.js renders the scene
10. **Debug** -- `DebugManager` updates overlay (when enabled)

Delta time is clamped to a maximum of 1/30s (~33ms) to prevent physics explosions after tab switches. The `dtWasClamped` flag is passed through to mechanics so timed systems can handle spikes gracefully.

The game loop pauses automatically on `visibilitychange` (tab hidden) and resumes when the tab becomes visible.

## Game States

Defined in `src/states/GameState.js`:

| State | Description |
|-------|-------------|
| `INITIALIZING` | Game is loading managers and course |
| `PLAYING` | Game is actively running |
| `AIMING` | Player can aim and shoot |
| `HOLE_COMPLETED` | Ball entered the hole, transitioning |
| `GAME_COMPLETED` | All 9 holes finished, scorecard shown |
| `PAUSED` | Game loop stopped, pause overlay shown |

State transitions are managed by `StateManager` and broadcast via `STATE_CHANGED` events.

## Event System

`EventManager` provides publish/subscribe messaging. Events are defined in `src/events/EventTypes.js`:

**Ball events:** `BALL_CREATED`, `BALL_HIT`, `BALL_MOVED`, `BALL_STOPPED`, `BALL_RESET`, `BALL_IN_HOLE`

**Game events:** `HOLE_COMPLETED`, `HOLE_STARTED`, `GAME_COMPLETED`, `GAME_STARTED`, `GAME_INITIALIZED`, `STATE_CHANGED`

**Pause events:** `GAME_PAUSED`, `GAME_RESUMED`

**Other:** `HAZARD_DETECTED`, `BALL_STUCK`, `UI_REQUEST_RESTART_GAME`, `ERROR_OCCURRED`

Each subscriber callback is wrapped in try-catch with rich context logging. A single broken subscriber does not crash the event bus.

## Manager Responsibilities

| Manager | Role |
|---------|------|
| `Game` | Top-level coordinator. Creates scene, renderer, lights, and all managers |
| `GameLoopManager` | Drives the render loop and update sequence. Handles pause/resume and dt clamping |
| `StateManager` | Tracks game state, hole number, ball motion. Publishes state change events |
| `EventManager` | Pub/sub event bus with per-subscriber error isolation |
| `PhysicsManager` | Owns the Cannon-es world. Provides materials and world access |
| `BallManager` | Creates/destroys ball instances. Handles hit impulse and position reset |
| `CameraController` | Follows ball, positions for holes, supports OrbitControls for manual look |
| `InputController` | Mouse/touch drag-to-aim. Calculates direction and power from drag distance |
| `UIManager` | Creates DOM overlays (score, messages, power bar). Delegates to `UIScoreOverlay` and `UIDebugOverlay` |
| `HoleCompletionManager` | Handles `BALL_IN_HOLE` event: score, effects, transition trigger |
| `HoleTransitionManager` | Cleans old hole, loads next, resets physics world, creates ball |
| `HoleStateManager` | Tracks per-hole state (current hole index, completion) |
| `HazardManager` | Detects out-of-bounds. Water/sand detection is in `Ball.js` directly |
| `ScoringSystem` | Tracks strokes per hole and total. `completeHole()` saves per-hole scores |
| `HighScoreManager` | Persists best scores to localStorage per course name |
| `StuckBallManager` | Detects balls in prolonged motion without progress, offers reset UI |
| `VisualEffectsManager` | Particle bursts on hole events |
| `AudioManager` | Sound effects via Web Audio API. Supports mute toggle persisted to localStorage |
| `DebugManager` | Toggle with `d` key (dev mode only). Shows axes, grid, physics wireframes |
| `PerformanceManager` | Tracks FPS, frame times, component update durations |
| `WebGLContextManager` | Handles WebGL context loss/restore with user-facing retry overlay |

## Course System

The game ships with a single course: **Orbital Drift** (9 holes, par 24).

`OrbitalDriftCourse` extends `CoursesManager` and loads hole configs from `src/config/orbitalDriftConfigs.js`. `Game.js` accepts a `courseClass` constructor option for future extensibility.

Each hole is represented by a `HoleEntity` which creates:
- Green surface (CSG-cut for hole and hazards) via `GreenSurfaceBuilder`
- Boundary walls with physics bodies
- Hole rim, interior visual, and trigger body
- Sand traps and water hazards via `HazardFactory`
- Bumper obstacles
- Mechanics via `MechanicRegistry` (see below)
- Decorative hero props via `HeroPropFactory`

`CoursesManager.update(dt)` retrieves `ballBody` from `game.ballManager.ball?.body` and passes it to `currentHoleEntity.update(dt, ballBody, { dtWasClamped })`.

## Mechanics System

12 mechanic types extend `MechanicBase` and self-register with `MechanicRegistry` via the barrel import at `src/mechanics/index.js`.

### MechanicBase Interface

```js
constructor(world, group, config, surfaceHeight, theme)
update(dt, ballBody)    // Move obstacles, apply forces, check triggers
destroy()               // Clean up meshes and physics bodies
getMeshes()             // THREE.Mesh[] for resource tracking
getBodies()             // CANNON.Body[] for resource tracking
isBallInZone(ballBody)  // Helper for trigger zone detection
```

### Mechanic Types

| Type | Description | Holes |
|------|-------------|-------|
| `moving_sweeper` | Kinematic body rotating around a pivot, deflects ball | H1, H3, H9 |
| `bowl_contour` | Radial force toward center, scales with distance | H2 |
| `split_route` | Walls dividing the green into multiple paths | H3, H9 |
| `ricochet_bumpers` | Bumpers with configurable geometry and high restitution | H4 |
| `elevated_green` | Raised platform with ramp connection | H4, H9 |
| `portal_gate` | Teleports ball from entry to exit, preserves velocity, cooldown | H5 |
| `timed_hazard` | Hazard cycling active/inactive on a timer | H6 |
| `low_gravity_zone` | Reduces effective gravity in zone | H7 |
| `bank_wall` | Angled wall segments for bank shots | H7 |
| `suction_zone` | Radial pull toward zone center | H8 |
| `timed_gate` | Wall that opens/closes on a timer | H8 |
| `boost_strip` | Constant directional force in trigger zone | H9 |

### Force Field Pattern

BoostStrip, SuctionZone, LowGravityZone, and BowlContour share a common pattern:
1. Create a CANNON trigger body (`isTrigger=true`)
2. Each frame, check if ball overlaps the trigger zone
3. If overlapping, apply a force vector to `ballBody`
4. Visual: semi-transparent mesh showing the affected area

### Error Handling

Each mechanic's `update()` call is wrapped in try-catch within `HoleEntity`. A failed mechanic is flagged `_failed` and skipped on subsequent frames. Other mechanics on the same hole continue to function.

## Theme System

Two themes exist in `src/themes/`:

- **`defaultTheme`** -- matches original hardcoded colors (backward compatible)
- **`spaceTheme`** -- Orbital Drift's darker, emissive aesthetic

Themes provide colors for: green, wall, bumper, sand, water, tee, rim, holeInterior, background, and mechanic-specific overrides. Threaded through `HoleEntity` to `GreenSurfaceBuilder`, `HazardFactory`, and mechanic constructors.

## Physics

Uses Cannon-es with these key properties:

- **Gravity:** -9.81 m/s2
- **Ball:** mass 0.45, linear damping 0.85, sleep speed 0.03
- **Materials:** ground (high friction 0.8), bumper (low friction 0.1, high restitution 0.8), ball
- **Hole entry:** Ball must overlap 55% of hole diameter at speed < 4.06 m/s
- **Sand traps:** Increase linear damping to 0.98
- **Water hazards:** Reset ball to last hit position, add 1 stroke penalty
- **Physics error recovery:** Circuit breaker pattern -- full body reset only after 3 consecutive errors

## Ball Lifecycle

1. `BallManager.createBall(position)` -- creates `Ball` instance with mesh + physics body
2. Player drags to aim -> `InputController` calculates direction/power
3. `BallManager.hitBall(direction, power)` -> `Ball.applyImpulse()` -> publishes `BALL_HIT`
4. `Ball.update()` syncs mesh to physics, checks hole entry, hazards, out-of-bounds
5. `Ball.isStopped()` detects rest -> `BallManager` publishes `BALL_STOPPED`
6. On hole entry -> `Ball` publishes `BALL_IN_HOLE` -> `HoleCompletionManager` handles transition
