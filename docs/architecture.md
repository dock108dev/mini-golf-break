# Architecture

## Overview

Mini Golf Break is a client-side 3D game with no backend. The `Game` class (`src/scenes/Game.js`) coordinates all subsystems. Managers communicate through a central `EventManager` using pub/sub events. The `GameLoopManager` drives the per-frame update cycle.

## Game Loop

`GameLoopManager` runs via `requestAnimationFrame` and updates subsystems in this order:

1. **Physics** — `PhysicsManager` steps the Cannon-es world
2. **Ball** — `BallManager` syncs ball mesh to physics body, checks hazards
3. **Hazards** — `HazardManager` checks ball against out-of-bounds
4. **Camera** — `CameraController` follows ball with intelligent positioning
5. **Visual Effects** — `VisualEffectsManager` animates active particle systems
6. **Render** — Three.js renders the scene
7. **Debug** — `DebugManager` updates overlay (when enabled)

## Game States

Defined in `src/states/GameState.js`:

| State | Description |
|-------|-------------|
| `INITIALIZING` | Game is loading managers and course |
| `PLAYING` | Game is actively running |
| `AIMING` | Player can aim and shoot |
| `HOLE_COMPLETED` | Ball entered the hole, transitioning |
| `GAME_COMPLETED` | All 9 holes finished, scorecard shown |

State transitions are managed by `StateManager` and broadcast via `STATE_CHANGED` events.

## Event System

`EventManager` (`src/managers/EventManager.js`) provides publish/subscribe messaging. Events are defined in `src/events/EventTypes.js`:

**Ball events:** `BALL_CREATED`, `BALL_HIT`, `BALL_MOVED`, `BALL_STOPPED`, `BALL_RESET`, `BALL_IN_HOLE`

**Game events:** `HOLE_COMPLETED`, `HOLE_STARTED`, `GAME_COMPLETED`, `GAME_STARTED`, `GAME_INITIALIZED`, `STATE_CHANGED`

**Other:** `HAZARD_DETECTED`, `UI_REQUEST_RESTART_GAME`, `ERROR_OCCURRED`

## Manager Responsibilities

| Manager | Role |
|---------|------|
| `Game` | Top-level coordinator. Creates scene, renderer, lights, and all managers |
| `GameLoopManager` | Drives the render loop and update sequence |
| `StateManager` | Tracks game state, hole number, ball motion. Publishes `HOLE_STARTED` |
| `EventManager` | Pub/sub event bus with subscription tracking |
| `PhysicsManager` | Owns the Cannon-es world. Provides materials and world access |
| `BallManager` | Creates/destroys ball instances. Handles hit impulse and position reset |
| `CameraController` | Follows ball, positions for holes, supports OrbitControls for manual look |
| `InputController` | Mouse/touch drag-to-aim. Calculates direction and power from drag distance |
| `UIManager` | Creates DOM overlays (score, messages, power bar). Delegates to `UIScoreOverlay` |
| `HoleCompletionManager` | Handles `BALL_IN_HOLE` event: score, effects, transition trigger |
| `HoleTransitionManager` | Cleans old hole, loads next, resets physics world, creates ball |
| `HazardManager` | Detects out-of-bounds. Water/sand detection is in `Ball.js` directly |
| `ScoringSystem` | Tracks strokes per hole and total. `completeHole()` saves per-hole scores |
| `VisualEffectsManager` | Particle bursts on hole rejection (speed too high) |
| `AudioManager` | Sound effects (bump, success, splash) via Three.js Audio |
| `DebugManager` | Toggle with 'd' key. Shows axes, grid, physics wireframes |
| `PerformanceManager` | Tracks FPS, frame times, component update durations |

## Course System

Two course implementations extend `CoursesManager`:

- **`NineHoleCourse`** — 9 space-themed holes. Configs loaded from `src/config/nineHoleConfigs.js`
- **`BasicCourse`** — 3-hole test course for development

Each hole is represented by a `HoleEntity` which creates:
- Green surface (CSG-cut for hole and hazards) via `GreenSurfaceBuilder`
- Boundary walls with physics bodies
- Hole rim, interior visual, and trigger body
- Sand traps and water hazards via `HazardFactory`
- Bumper obstacles

## Physics

Uses Cannon-es with these key properties:

- **Gravity:** -9.81 m/s²
- **Ball:** mass 0.45, linear damping 0.85, sleep speed 0.03
- **Materials:** ground (high friction 0.8), bumper (low friction 0.1, high restitution 0.8), ball
- **Hole entry:** Ball must overlap 55% of hole diameter at speed < 4.06 m/s
- **Sand traps:** Increase linear damping to 0.98
- **Water hazards:** Reset ball to last hit position, add 1 stroke penalty

## Ball Lifecycle

1. `BallManager.createBall(position)` — creates `Ball` instance with mesh + physics body
2. Player drags to aim → `InputController` calculates direction/power
3. `BallManager.hitBall(direction, power)` → `Ball.applyImpulse()` → publishes `BALL_HIT`
4. `Ball.update()` syncs mesh to physics, checks hole entry, hazards, out-of-bounds
5. `Ball.isStopped()` detects rest → `BallManager` publishes `BALL_STOPPED`
6. On hole entry → `Ball` publishes `BALL_IN_HOLE` → `HoleCompletionManager` handles transition
