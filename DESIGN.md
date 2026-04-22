# DESIGN.md — mini-golf-break

> "Tight, readable, satisfying mini golf that happens to be in space."

---

## 1. Design Principles

### 1.1 Readability Before Richness
A hole must be understood within three seconds of spawning. Cup visibility, obstacle intent, and first-shot geometry are non-negotiable before any new mechanic ships. If you have to explain the hole, it is not done yet.

### 1.2 Earned Trust in Physics
Every visible surface is a real Cannon-es body. If something looks solid, it collides. If it looks open, it does not. Ghost collisions, invisible walls, and mismatched hitboxes destroy player trust faster than any visual flaw.

### 1.3 One Sentence Per Hole
Every hole has a design identity expressible in a single sentence — "timing gate," "forced bank shot," "split-route risk/reward." Holes that cannot be described this way are not yet designed; they are assembled. Assemble nothing.

### 1.4 Motion Creates Meaning
Static worlds feel dead. A single moving element — a sweeper, a pulsing barrier, an orbiting bumper — transforms a corridor into a timing puzzle. Add motion sparingly, but never ship a hole with zero motion past Hole 2.

### 1.5 Systems Over Props
Every object on the course must **block, redirect, move, punish, reward, or teach**. Decoration belongs off the playfield. Objects that exist only to fill space add noise and erode the readability principle.

---

## 2. Patterns

### 2.1 Event-Driven Communication

All cross-subsystem communication flows through `EventManager`. Managers never hold direct references to other managers.

```javascript
// GOOD — publish and subscribe through the bus
eventManager.emit(EventTypes.BALL_HIT, { direction, power });

// In BallManager
eventManager.on(EventTypes.BALL_HIT, ({ direction, power }) => {
  this.applyImpulse(direction, power);
});
```

```javascript
// BAD — direct manager coupling
game.ballManager.applyImpulse(direction, power);
```

**Rule:** If two systems need to communicate, find the event that describes the *fact* that happened. Name the event for the outcome, not the instruction (`BALL_HIT`, not `HIT_BALL`).

---

### 2.2 Mechanic Plugin Pattern

All gameplay mechanics extend `MechanicBase` and self-register. The orchestrator never imports mechanics by name.

```javascript
// src/mechanics/MyNewMechanic.js
import { MechanicBase } from './MechanicBase.js';

export class MyNewMechanic extends MechanicBase {
  constructor(config, scene, physicsWorld) {
    super(config, scene, physicsWorld);
    this._phase = 0;
    this._build();
  }

  _build() {
    // Create THREE.Mesh + CANNON.Body pair
    // Register body with physicsWorld
  }

  update(dt, ballBody) {
    this._phase = (this._phase + dt * this.config.speed) % (Math.PI * 2);
    const x = Math.cos(this._phase) * this.config.radius;
    // Drive kinematic body via velocity, NOT position
    this._body.velocity.set((x - this._body.position.x) / dt, 0, 0);
    this._mesh.position.copy(this._body.position);
  }

  onDtSpike(dt) {
    // Clamp or skip physics step on large dt to avoid tunneling
  }

  destroy() {
    this._scene.remove(this._mesh);
    this._physicsWorld.removeBody(this._body);
  }
}
```

```javascript
// src/mechanics/index.js — one-line registration
export { MyNewMechanic } from './MyNewMechanic.js';
```

---

### 2.3 Kinematic Bodies for Moving Obstacles

Moving obstacles **must** drive their Cannon-es body through velocity, not direct position assignment. Direct position teleportation bypasses collision detection and causes tunneling.

```javascript
// GOOD — velocity-driven kinematic body
const targetX = Math.sin(this._phase) * this.config.amplitude;
this._body.velocity.x = (targetX - this._body.position.x) / dt;

// BAD — direct position teleport, breaks collision detection
this._body.position.x = Math.sin(this._phase) * this.config.amplitude;
```

---

### 2.4 Data-Driven Hole Configuration

Holes are plain data objects, not procedural code. All Three.js/Cannon-es types are injected at hydration time; the config file itself has no engine dependency.

```javascript
// src/config/orbitalDriftConfigs.js — engine-free data
export const hole3 = {
  id: 'debris-drift',
  name: 'Debris Drift',
  par: 3,
  startPosition: [0, 0.1, 8],
  cupPosition: [0, 0, -10],
  boundaryShape: [[-3,-12],[3,-12],[3,12],[-3,12]],
  mechanics: [
    {
      type: 'MovingSweeper',
      speed: 0.8,
      amplitude: 2.2,
      axis: 'x',
      position: [0, 0.15, 0],
    },
  ],
};
```

```javascript
// src/config/hydrateHoleConfig.js — converts arrays → engine types
import { Vector3, Euler } from 'three';

export function hydrateHoleConfig(raw) {
  return {
    ...raw,
    startPosition: new Vector3(...raw.startPosition),
    cupPosition: new Vector3(...raw.cupPosition),
    mechanics: raw.mechanics.map(hydrateMechanic),
  };
}
```

**Rule:** If a config value contains a `new Vector3(...)` call, move it to `hydrateHoleConfig`. Config files must remain importable in Node.js without a DOM or WebGL context.

---

### 2.5 Three.js ↔ Cannon-es Mesh–Body Sync

Every physics-backed object owns a `{ mesh, body }` pair. Sync runs once per frame, after `physicsWorld.step()`.

```javascript
// Per-frame sync in Game.update()
physicsWorld.step(FIXED_TIMESTEP, dt, MAX_SUBSTEPS);

// Ball sync
ball.mesh.position.copy(ball.body.position);
ball.mesh.quaternion.copy(ball.body.quaternion);
```

Static geometry (walls, green surface) syncs once at construction time and never again. Kinematic geometry (moving obstacles) syncs in its own `mechanic.update(dt)` call.

---

### 2.6 Phase-Accumulator for Periodic Motion

All time-based oscillation and rotation uses a phase accumulator clamped to `[0, 2π)`. This avoids floating-point drift on long sessions and makes period tuning trivial.

```javascript
update(dt, _ballBody) {
  this._phase = (this._phase + dt * this.config.angularSpeed) % (Math.PI * 2);
  const angle = this._phase;
  this._body.angularVelocity.set(0, this.config.angularSpeed, 0);
  this._mesh.quaternion.setFromAxisAngle(UP, angle);
}
```

---

### 2.7 Typed State Mutations

Game state changes through explicit setters on `StateManager`, never through direct property writes. Every setter emits `STATE_CHANGED`.

```javascript
// GOOD
stateManager.setBallInMotion(true);

// BAD — bypasses event emission, leaves UI out of sync
stateManager.state.ballInMotion = true;
```

---

### 2.8 Visual Hierarchy Through Emissive Signaling

Interactable elements use emissive color to broadcast their state. Non-interactable decoration uses zero emissive.

```javascript
// Gate open (safe) → green emissive
material.emissive.setHex(0x00ff88);
material.emissiveIntensity = 0.6;

// Gate closed (danger) → red emissive
material.emissive.setHex(0xff2200);
material.emissiveIntensity = 0.8;

// Lerp between states for readability (100–150 ms)
material.emissiveIntensity = MathUtils.lerp(
  material.emissiveIntensity,
  targetIntensity,
  Math.min(dt / 0.12, 1)
);
```

**Rule:** Hazards are bright/danger colors. Interactives glow. Decoration has no emissive. Cup always has a warm point light above it.

---

## 3. Anti-Patterns

### 3.1 Manager-to-Manager Direct Calls
```javascript
// NEVER — creates hidden coupling that breaks during hole transitions
this.ballManager.reset();          // called from HoleTransitionManager
this.cameraController.reposition(); // called from BallManager
```
Use events. `HOLE_COMPLETED` → each manager reacts independently.

---

### 3.2 Teleporting Kinematic Bodies
```javascript
// NEVER — skips broad-phase, causes ghost collisions and tunneling
sweeper.body.position.set(newX, 0, 0);
```
Always drive via `body.velocity` or `body.angularVelocity`.

---

### 3.3 Engine Types in Config Files
```javascript
// NEVER in orbitalDriftConfigs.js or any config file
import { Vector3 } from 'three';
cupPosition: new Vector3(0, 0, -10),
```
Config files must be plain JSON-compatible data. Hydration happens in `hydrateHoleConfig`.

---

### 3.4 Decoration on the Playfield
Any mesh that does not block, redirect, or signal gameplay state should be off the playfield or behind a `HeroPropFactory` decoration path (no collision body). Adding decorative props inside the green boundary creates visual noise and misleads the player about what matters.

---

### 3.5 Holes Without Identity
Do not ship a hole whose config contains only generic bumpers arranged in a corridor. Every hole needs at least one intentional mechanic from the hole taxonomy before it is considered authored.

---

### 3.6 Hardcoded Magic Numbers in Mechanics
```javascript
// BAD — impossible to tune from config
this._body.velocity.x = Math.sin(phase) * 2.8;

// GOOD — expose via config with sensible defaults
const amplitude = this.config.amplitude ?? 2.5;
this._body.velocity.x = Math.sin(phase) * amplitude;
```

---

### 3.7 Per-Frame `new` Allocations
```javascript
// BAD — allocates garbage every frame, causes GC hitches during shots
ball.body.applyImpulse(new CANNON.Vec3(x, y, z));

// GOOD — reuse a shared scratch vector
_impulse.set(x, y, z);
ball.body.applyImpulse(_impulse);
```

---

## 4. Naming Conventions

### 4.1 Files

| Type | Convention | Example |
|------|------------|---------|
| Manager class | `PascalCase` + `Manager` suffix | `BallManager.js` |
| Mechanic class | `PascalCase` (noun phrase) | `MovingSweeper.js`, `TimedGate.js` |
| Config data | `camelCase` + `Configs` suffix | `orbitalDriftConfigs.js` |
| Utility | `camelCase` verb phrase | `hydrateHoleConfig.js`, `clampDt.js` |
| Test file | mirrors source + `.test.js` | `BallManager.test.js` |
| Integration test | mirrors scenario + `.integration.test.js` | `holeTransition.integration.test.js` |
| Research doc | `kebab-case` topic phrase | `cannon-es-moving-obstacle-patterns.md` |

### 4.2 Classes & Identifiers

```javascript
class HoleTransitionManager { }   // Manager — PascalCase + Manager
class MovingSweeper { }           // Mechanic — PascalCase noun
class MechanicBase { }            // Abstract base — PascalCase + Base

const EventTypes = Object.freeze({ BALL_HIT: 'BALL_HIT' }); // constants — SCREAMING_SNAKE
const FIXED_TIMESTEP = 1 / 60;                              // module constants — SCREAMING_SNAKE

function hydrateHoleConfig(raw) { }   // utility — camelCase verb phrase
```

### 4.3 Private vs Public Members

Prefix private members with `_`. Anything without the prefix is part of the public API.

```javascript
class TimedGate extends MechanicBase {
  // public API
  update(dt, ballBody) { }
  destroy() { }

  // private
  _phase = 0;
  _build() { }
  _syncMesh() { }
}
```

### 4.4 Events

Event names are past-tense facts, `SCREAMING_SNAKE_CASE`, defined in `src/events/EventTypes.js`.

```javascript
BALL_HIT          // not HIT_BALL or APPLY_IMPULSE
BALL_IN_HOLE      // not SINK_BALL
HOLE_COMPLETED    // not COMPLETE_HOLE
HAZARD_DETECTED   // not TRIGGER_HAZARD
STATE_CHANGED     // not UPDATE_STATE
```

### 4.5 Hole Config IDs

Hole IDs are `kebab-case` space-themed nouns matching the course theme.

```
docking-lane
debris-drift
satellite-array
reactor-core
orbital-finale
```

---

## 5. Error Handling

### 5.1 Strategy

The game distinguishes three failure classes:

| Class | Definition | Response |
|-------|------------|----------|
| **Physics stall** | Ball stuck, fell through floor, velocity NaN | Auto-detect + respawn via `StuckBallManager` |
| **Config error** | Invalid hole config, missing required field | Fail loudly at startup / hydration, never silently continue |
| **Runtime exception** | Unexpected JS error during gameplay | Catch, emit `ERROR_OCCURRED`, degrade gracefully, log to debug overlay |

### 5.2 Config Validation at Boot

All hole configs are validated against `holeConfigSchema.json` during hydration. Invalid configs throw immediately — never reach the renderer.

```javascript
import Ajv from 'ajv';
import schema from './holeConfigSchema.json';

const ajv = new Ajv();
const validate = ajv.compile(schema);

export function hydrateHoleConfig(raw) {
  if (!validate(raw)) {
    throw new Error(
      `Invalid hole config "${raw?.id}": ${ajv.errorsText(validate.errors)}`
    );
  }
  // proceed with hydration
}
```

### 5.3 Stuck Ball Recovery

`StuckBallManager` monitors ball velocity each frame. If velocity stays below `STUCK_THRESHOLD` (0.05 m/s) for `STUCK_TIMEOUT_MS` (3000 ms) and the hole is not complete, it emits `BALL_STUCK` and resets ball to last checkpoint.

```javascript
// BallManager reacts — no direct coupling to StuckBallManager
eventManager.on(EventTypes.BALL_STUCK, () => {
  this.respawnAtCheckpoint();
});
```

### 5.4 dt Spike Guards

The game loop clamps `dt` to a maximum of `1/30` s. Mechanics with fast kinematic bodies additionally implement `onDtSpike(dt)` to skip or dampen the frame rather than tunnel through geometry.

```javascript
// GameLoopManager
const dt = Math.min(rawDt, 1 / 30);

// MechanicBase default — subclasses may override
onDtSpike(dt) {
  if (dt > 1 / 20) this._phase += dt * this.config.speed * 0.5; // half-step
}
```

### 5.5 WebGL Context Loss

`WebGLContextManager` listens for `webglcontextlost` / `webglcontextrestored`. On loss it pauses the game loop, releases disposable resources, and emits `ERROR_OCCURRED` with `type: 'CONTEXT_LOST'`. On restore it reinitializes the renderer and resumes.

### 5.6 Never Swallow Errors Silently

```javascript
// BAD
try {
  mechanic.update(dt, ballBody);
} catch (e) {
  // ignore
}

// GOOD
try {
  mechanic.update(dt, ballBody);
} catch (e) {
  eventManager.emit(EventTypes.ERROR_OCCURRED, { source: mechanic.constructor.name, error: e });
  console.error('[MechanicUpdate]', e);
}
```

---

## 6. Testing Strategy

### 6.1 Layers

```
Unit Tests (Jest)
  └─ Pure logic: config hydration, scoring, state transitions, utility fns
  └─ Fast — no DOM, no canvas, no physics world needed

Integration Tests (Jest + jsdom)
  └─ Multi-system flows: shot lifecycle, hole transition, hazard detection
  └─ Use lightweight stubs for Three.js renderer, real EventManager + StateManager

UAT / E2E (Playwright)
  └─ Full game in headless Chromium
  └─ Golden path: menu → start → complete hole → score persists
  └─ Regression: ball-in-hole detection, stuck-ball recovery
```

### 6.2 What to Test at Each Layer

**Unit**
- `hydrateHoleConfig` correctly converts arrays → Vector3/Euler
- `hydrateHoleConfig` throws on schema violations
- `ScoringSystem`: stroke counting, max-stroke enforcement, par calculation
- `EventManager`: subscribe, emit, unsubscribe, history buffer
- `StateManager`: typed setter paths, `STATE_CHANGED` emission
- Mechanic `update(dt)`: phase accumulation, velocity output (no engine needed — mock body)

**Integration**
- Shot lifecycle: `BALL_HIT` → impulse applied → `BALL_STOPPED` emitted when velocity drains
- Hole transition: `BALL_IN_HOLE` → current hole destroyed → next hole spawned → ball reset
- Hazard detection: ball overlapping hazard zone → `HAZARD_DETECTED` → penalty stroke added
- Stuck ball: velocity below threshold for timeout → `BALL_STUCK` → respawn at checkpoint
- `StrokeLimit`: stroke count reaches max → `STROKE_LIMIT_REACHED` → hole auto-advanced

**UAT (Playwright)**
- Game loads and menu is interactive
- Start course → Hole 1 spawns with visible cup
- Simulate shot → ball moves → stops → input re-enables
- Ball in hole → score increments → Hole 2 loads
- Complete all 18 holes → game-complete screen shows total strokes
- Score persists across page reload (`localStorage`)
- Mobile viewport: touch-aim and swipe-power controls function

### 6.3 Mechanic Tests

Every mechanic extending `MechanicBase` must have at minimum:

```javascript
// src/tests/mechanics/MovingSweeper.test.js
import { MovingSweeper } from '../../mechanics/MovingSweeper.js';

describe('MovingSweeper', () => {
  const config = { speed: 1.0, amplitude: 2.0, axis: 'x', position: [0, 0, 0] };

  it('advances phase each update', () => {
    const m = makeMechanic(MovingSweeper, config);
    m.update(0.016, mockBallBody());
    expect(m._phase).toBeGreaterThan(0);
  });

  it('drives body velocity, not position', () => {
    const m = makeMechanic(MovingSweeper, config);
    const before = { ...m._body.position };
    m.update(0.016, mockBallBody());
    // position does NOT change directly — velocity does
    expect(m._body.position).toEqual(before);
    expect(Math.abs(m._body.velocity.x)).toBeGreaterThan(0);
  });

  it('calls destroy without throwing', () => {
    const m = makeMechanic(MovingSweeper, config);
    expect(() => m.destroy()).not.toThrow();
  });
});
```

### 6.4 Coverage Threshold

The project enforces **60% line/statement/function coverage** as a hard CI gate. New mechanics and managers are expected to individually exceed 70%. Config hydration and scoring logic must exceed 90% — these are the highest-trust paths.

### 6.5 Test Isolation Rules

- Unit tests must not instantiate `THREE.WebGLRenderer`, `CANNON.World`, or touch the DOM.
- Integration tests may use `jsdom` but must mock the canvas context.
- Tests must not read from or write to `localStorage` directly — use the `HighScoreManager` interface and reset state in `afterEach`.
- No test should depend on execution order. Each test file is a fully isolated module.

### 6.6 Playwright Fixture Pattern

```javascript
// src/tests/uat/fixtures/gamePage.js
export class GamePage {
  constructor(page) { this.page = page; }

  async goto() {
    await this.page.goto('/');
    await this.page.click('#play-course');
    await this.page.waitForSelector('#game-canvas');
  }

  async aimAndShoot(direction = { x: 0, z: -1 }, power = 0.6) {
    await this.page.evaluate(
      ({ dir, pwr }) => window.__game.inputController.simulateShot(dir, pwr),
      { dir: direction, pwr: power }
    );
  }

  async waitForBallStop(timeout = 5000) {
    await this.page.waitForFunction(
      () => window.__game.stateManager.state.ballInMotion === false,
      { timeout }
    );
  }
}
```

---

## Appendix: Hole Taxonomy Quick Reference

| Type | Core Mechanic | Canonical Hole |
|------|--------------|----------------|
| timing-gate | Sweeper / sliding gate | Docking Lane (H1) |
| bank-shot | Forced wall deflection | Bank Right (H2) |
| moving-obstacle | Drifting asteroids / orbital bumpers | Debris Drift (H3) |
| split-route | Safe path vs risk/reward shortcut | Split Route (H4) |
| ramp-jump | Boost strip or multi-level ramp | Launch Pad (H5) |
| force-field | Low-gravity pad / suction zone | Gravity Funnel (H6) |
| multi-arm | Rotating arms with timing windows | Satellite Array (H7) |
| hazard-carry | Hazard zones requiring precise carry | Reactor Core (H8) |
| multi-stage | Combined mechanics, phased progression | Orbital Finale (H9) |
