# DESIGN.md — mini-golf-break

## Design Principles

### 1. Data-Driven Authoring

Holes are defined as configuration objects, not imperative code. A hole config declares *what* exists (boundary shape, start/hole positions, mechanics, hazards, hero props) and `HoleEntity` + the mechanic registry build it at runtime. Adding a new hole means adding a config object, not writing new scene construction logic.

### 2. Composable Mechanics

Gameplay obstacles are reusable components registered in `MechanicRegistry`. Each mechanic is a self-contained unit that creates its own meshes and physics bodies, updates per frame, and cleans up on destroy. A hole composes behavior by listing mechanic configs — `{ type: 'timed_gate', ... }`, `{ type: 'split_route', ... }` — not by mixing obstacle logic into hole code.

### 3. Readability First

The player should always be able to tell:
- What is playable surface vs. wall vs. hazard vs. decoration
- What moves and what is static
- What the intended shot path looks like from the tee
- What happens on success vs. failure

Visual clarity takes priority over visual complexity. One strong idea per hole beats five stacked weak ideas.

### 4. Resource Lifecycle Discipline

Every mesh and physics body created must be tracked and destroyed. `BaseElement` and `MechanicBase` enforce this by maintaining `meshes[]` and `bodies[]` arrays. `destroy()` walks both arrays, removing bodies from the physics world and disposing Three.js geometries and materials. Leaking resources causes frame rate degradation on mobile.

### 5. Fair Difficulty Escalation

Early holes teach core mechanics with forgiveness. Late holes combine mechanics and tighten execution demands. No hole should feel random or unfair. The player's reaction to failure should be "I messed that up" not "the game screwed me."

### 6. Gameplay First, Theme Second

The space theme enhances readability and novelty. It does not override physics consistency, introduce random behavior, or create visual clutter that obscures the shot path.

---

## Patterns

### Mechanic Registry (Factory + Self-Registration)

Each mechanic file self-registers on import:

```js
// In MovingSweeper.js
import { registerMechanic } from './MechanicRegistry';
import { MechanicBase } from './MechanicBase';

class MovingSweeper extends MechanicBase { /* ... */ }

registerMechanic('moving_sweeper', (world, group, config, sh, theme) =>
  new MovingSweeper(world, group, config, sh, theme)
);
```

The barrel import `mechanics/index.js` triggers all registrations. `HoleEntity` calls `createMechanic(type, ...)` without knowing concrete classes.

**Why this pattern**: Decouples hole configs from mechanic implementations. Adding a new mechanic requires one file with a `registerMechanic` call and an import in `index.js` — no changes to `HoleEntity` or config parsing.

### Data-Driven Hole Configs

Hole definitions live in `config/orbitalDriftConfigs.js` as an array of plain objects. Each config declares everything needed to construct the hole:

```js
{
  index: 0,
  description: '1. Launch Bay',
  par: 2,
  theme: spaceTheme,
  boundaryShape: [Vector2, ...],   // Closed polygon
  startPosition: Vector3,          // World coords
  holePosition: Vector3,           // World coords
  hazards: [{ type, position, size, ... }],
  bumpers: [{ position, size, rotation }],
  mechanics: [{ type: 'moving_sweeper', pivot, armLength, speed, size }],
  heroProps: [{ type: 'rocket_stand', position, scale }]
}
```

**Rule**: No gameplay logic in config files. Configs are data. Behavior lives in mechanic classes, `HoleEntity`, and `HazardFactory`.

### BaseElement Lifecycle

`BaseElement` is the base class for all course elements (extended by `HoleEntity`). It provides:

1. **Constructor**: Receives `world`, `config`, `scene`. Creates a `THREE.Group` at the config position and adds it to the scene. Initializes empty `meshes[]` and `bodies[]`.
2. **init()** (called after construction): Subclasses create all geometry, physics bodies, and child objects here. Wrapped in try-catch — failure triggers `destroy()` to prevent partial state.
3. **update(dt)**: Per-frame hook for animations and state changes.
4. **destroy()**: Removes all meshes from parent, disposes geometries and materials, removes all bodies from physics world, removes group from scene, nulls references.

**Rule**: Always push new meshes to `this.meshes` and new bodies to `this.bodies`. If a resource is not tracked, it will leak.

### Event Bus Communication

Managers communicate through `EventManager.publish()` and `EventManager.subscribe()`. Events use `domain:action` naming defined in `EventTypes.js`.

```js
// Publishing
this.game.eventManager.publish(EventTypes.BALL_HIT, { power }, this);

// Subscribing
this.game.eventManager.subscribe(EventTypes.BALL_IN_HOLE, (data) => {
  this.handleHoleCompletion(data);
});
```

**Rule**: Never call methods on other managers directly for state-changing operations. Publish an event and let the responsible manager handle it. Direct reads (e.g., `this.game.stateManager.getGameState()`) are fine.

### Physics Body Patterns

- **STATIC** (mass 0): Green surfaces, walls, bumpers, hazard trigger zones. Never moves. Placed once at construction.
- **DYNAMIC** (mass > 0): Ball only. Affected by gravity, impulses, collisions. CCD enabled (`ccdSpeedThreshold: 1.0`) to prevent tunneling through thin walls.
- **KINEMATIC** (`type: CANNON.Body.KINEMATIC`): Moving obstacles (sweeper arms, sliding gates). Position/rotation updated manually in `mechanic.update()`. Physics engine resolves collisions against dynamic bodies but does not apply forces to the kinematic body.
- **Trigger** (`isTrigger: true`): Hole cup, hazard zones. No collision response — overlap detected via distance checks in `Ball.update()` or `MechanicBase.isBallInZone()`.

### Config Validation

`holeValidator.js` validates hole configs at course creation time (dev mode only):

- Every mechanic type in configs must be registered in `MechanicRegistry`
- Start position and hole position must exist
- Boundary shape must have at least 3 points
- Validates against registered mechanic types from `getRegisteredTypes()`

### Theme Merging

Themes are plain objects with nested keys for each visual element (green, wall, rim, tee, bumper, etc.). At `HoleEntity` construction, `defaultTheme` is deep-merged with the config's theme override:

```js
this.resolvedTheme = { ...defaultTheme, ...(config.theme || {}) };
for (const key of Object.keys(defaultTheme)) {
  if (typeof defaultTheme[key] === 'object') {
    this.resolvedTheme[key] = { ...defaultTheme[key], ...(config.theme?.[key] || {}) };
  }
}
```

This allows per-hole theme variants while maintaining a consistent base.

---

## Anti-Patterns

### Hardcoded Hole Logic

**Don't**: Put obstacle creation or layout logic inline in a hole-specific file or scene code.
**Do**: Define the hole as a config object. Use the mechanic registry for obstacles.

### Untracked Resources

**Don't**: Create a Three.js mesh or Cannon-es body without pushing it to `this.meshes` or `this.bodies`.
**Do**: Always track resources so `destroy()` cleans them up. Leaks kill mobile frame rate.

### Decorative Obstacles

**Don't**: Place obstacles that look impressive but sit outside the player's shot line.
**Do**: Every obstacle must realistically influence the intended shot path, threaten a punishment, or create a routing decision. If it doesn't affect gameplay, it is a hero prop (decorative), not an obstacle.

### Magic Numbers

**Don't**: Hardcode physics values, sizes, speeds, or positions without explanation.
**Do**: Use named constants or config fields with clear units. Mechanic configs should be self-documenting.

### Stacking Weak Ideas

**Don't**: Add five different mechanics to a single hole hoping one sticks.
**Do**: Each hole has one strong idea. Additional mechanics should support the primary concept, not compete with it.

### Direct Manager Cross-References for Mutations

**Don't**: `this.game.stateManager.state.currentHoleNumber = 5` from inside `HoleTransitionManager`.
**Do**: Publish an event. Let `StateManager` handle its own state mutations.

### Skipping Test Cleanup

**Don't**: Create physics worlds, renderers, or DOM elements in tests without cleaning them up.
**Do**: Use `afterEach` to destroy created objects. The test setup files (`tests/setup.js`, `tests/jest.setup.js`) provide mocking for Three.js and Cannon-es globals.

### Console.log in Source Code

**Don't**: Use `console.log` for development logging.
**Do**: Import `debug` from `src/utils/debug.js`. Use `debug.log()`. Production builds strip all console output via Terser.

---

## Naming Conventions

### Files

| Category | Convention | Examples |
|----------|-----------|---------|
| Classes/Components | PascalCase | `BallManager.js`, `HoleEntity.js`, `ScoringSystem.js` |
| Utilities/Configs | camelCase | `debug.js`, `debugConfig.js`, `holeValidator.js` |
| Directories | lowercase | `managers/`, `mechanics/`, `objects/`, `utils/` |
| Test files | Source name + `.test.js` | `Ball.test.js`, `PhysicsManager.test.js` |

### Classes

| Suffix | Purpose | Examples |
|--------|---------|---------|
| `*Manager` | Singleton system owned by Game | `StateManager`, `PhysicsManager`, `AudioManager` |
| `*Factory` | Creates instances from config | `HazardFactory`, `HeroPropFactory` |
| `*Builder` | Constructs complex objects step-by-step | `GreenSurfaceBuilder` |
| `*Entity` | Game world object with lifecycle | `HoleEntity` |
| `*Controller` | Handles user input or camera | `InputController`, `CameraController` |
| `*System` | Cross-cutting gameplay logic | `ScoringSystem` |

### Methods

| Prefix/Pattern | Usage |
|---------------|-------|
| `init()` | One-time setup after construction |
| `update(dt)` | Per-frame logic |
| `destroy()` / `cleanup()` | Resource teardown |
| `create*()` | Factory methods that return new objects |
| `get*()` | Accessor — no side effects |
| `set*()` | Mutator |
| `is*()` / `has*()` | Boolean query |
| `_privateMethod()` | Underscore prefix for internal methods |
| `on*()` | Event handler |
| `handle*()` | Response to an event or user action |

### Constants

UPPER_SNAKE_CASE for true constants:
```js
const HOLE_ENTRY_MAX_SPEED = 4.06;
const HOLE_EDGE_RADIUS = 0.4;
```

### Events

`domain:action` format:
```js
'ball:hit', 'ball:in_hole', 'hole:started', 'game:completed', 'state:changed'
```

---

## Error Handling

### Init Guards (Fail-Fast)

Critical systems throw on missing dependencies at init time rather than silently degrading:

```js
if (!this.scene) {
  throw new Error('BaseElement requires a valid scene');
}
```

`HoleEntity.init()` wraps all construction in try-catch. If any step fails, `this.destroy()` is called to clean up partial state, and the error is re-thrown.

### Dev-Only Config Validation

`validateCourse()` runs only when `process.env.NODE_ENV !== 'production'`. It checks mechanic types against the registry and logs warnings for misconfigurations. This catches typos in config files without adding runtime cost in production.

### Event Subscriber Try-Catch

`EventManager` wraps every subscriber callback in try-catch. A failing subscriber does not crash the event bus or prevent other subscribers from executing.

### Dt Clamping + Spike Recovery

`GameLoopManager` clamps `dt` to a maximum (prevents physics explosion after tab refocus). When a spike is detected, `HoleEntity.update()` calls `mechanic.onDtSpike()` on every mechanic, allowing them to reset internal timers and cooldowns.

### Stuck Ball Detection

`StuckBallManager` monitors ball velocity over time. If the ball is near-stationary but not at a valid rest position (e.g., wedged in geometry), it triggers an automatic reset after a timeout.

### WebGL Context Loss

`WebGLContextManager` listens for `webglcontextlost` and `webglcontextrestored` events on the canvas. On loss, it pauses the game loop to prevent rendering errors. On restore, it re-initializes the renderer.

### Mechanic Failure Isolation

If a mechanic's `update()` throws, `HoleEntity` catches the error, marks the mechanic as `_failed`, logs the error, and shows a red wireframe sphere indicator (debug only). The failed mechanic is skipped on subsequent frames. The rest of the hole continues to function.

---

## Testing Strategy

### Framework

- **Jest** with jsdom environment
- Two test projects: `unit` and `integration` (configured in jest.config.js)
- **Playwright** for browser UAT tests

### Test Organization

```
src/tests/
├── setup.js          # Global mocks (Three.js, Cannon-es, DOM)
├── jest.setup.js     # Jest environment config
├── unit/             # Mirrors src/ structure
│   ├── Ball.test.js
│   ├── PhysicsManager.test.js
│   └── ...
└── integration/      # Cross-system tests
    └── ...

tests/uat/            # Playwright browser tests
├── playwright.config.js
└── *.spec.js
```

### Coverage

60% minimum threshold for functions, lines, and statements. Enforced in CI via `npm run test:coverage`.

### What to Test

- **Mechanic lifecycle**: Construction from config → update behavior → destroy cleanup. Verify meshes and bodies are created and properly cleaned up.
- **Validator output**: Feed valid and invalid configs to `holeValidator.js`. Assert correct warnings/errors.
- **State transitions**: Verify `StateManager` transitions and event publishing for each state change path.
- **Ball physics helpers**: Test velocity reset, bunker/water overlap detection with known body positions.
- **Scoring**: Stroke counting, hole completion, par tracking, high score persistence.

### Mocking

- **Three.js**: Module-level mock providing stub constructors for `Vector3`, `Mesh`, `Group`, `Scene`, etc.
- **Cannon-es**: Module-level mock providing stub `Body`, `World`, `Vec3`, etc.
- **CSS**: `identity-obj-proxy` for CSS module imports
- **DOM**: jsdom provides `document`, `window`, `localStorage`

### Pre-Commit Gate

Unit tests run in the pre-commit hook (Husky + lint-staged). They must pass before any commit. Integration tests and UAT run in CI or manually.
