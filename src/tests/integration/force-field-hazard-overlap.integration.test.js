/**
 * Integration tests for force field and hazard overlap behavior
 * ISSUE-082
 *
 * Tests that force field mechanics (BoostStrip, SuctionZone, LowGravityZone)
 * work correctly when overlapping with traditional hazards (sand traps, water).
 * Ball behavior should be predictable when affected by both systems simultaneously.
 *
 * Architecture note:
 *   - Force fields apply forces via mechanic.update(dt, ballBody) called from
 *     HoleEntity.update() → CoursesManager.update()
 *   - Hazards (sand/water) modify ball state in Ball.update() called from
 *     BallManager.update() in the GameLoopManager
 *   - In the game loop: Physics → Ball (hazard checks) → Hazards → then
 *     CoursesManager.update (mechanics). Force fields and hazard checks are
 *     independent systems that both read/write ball state each frame.
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { SuctionZone } from '../../mechanics/SuctionZone';
import { LowGravityZone } from '../../mechanics/LowGravityZone';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    scale: s => ({ x: x * s, y: y * s, z: z * s }),
  }));

  CANNON.Body.mockImplementation(() => ({
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }),
    },
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn(), setFromAxisAngle: jest.fn() },
    addShape: jest.fn(),
    userData: {},
  }));

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, roughness: 0.3, metalness: 0.2, dispose: jest.fn() };
    if (opts) Object.assign(mat, opts);
    return mat;
  });

  THREE.CircleGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
  THREE.PlaneGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    step: jest.fn(),
  };
}

function makeMockGroup() {
  const children = [];
  return {
    add: jest.fn(child => children.push(child)),
    remove: jest.fn(child => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
    }),
    children,
  };
}

/**
 * Create a mock ball body that also simulates sand trap damping behavior.
 * In the real game, Ball.checkAndUpdateBunkerState() increases linearDamping
 * when the ball overlaps a bunker zone.
 */
function makeMockBall(x = 0, z = 0, mass = 0.45) {
  return {
    position: { x, y: 0.2, z },
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    mass,
    sleepState: 0, // AWAKE
    linearDamping: 0.85, // default ball damping
    applyForce: jest.fn(),
    wakeUp: jest.fn(),
  };
}

const SURFACE_HEIGHT = 0.2;
const DT = 0.016; // ~60fps

// ---------------------------------------------------------------------------
// SuctionZone + Sand Trap overlap
// ---------------------------------------------------------------------------

describe('SuctionZone and sand trap overlap', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('ball in overlapping SuctionZone and sand trap receives suction force AND increased damping', () => {
    // Set up a suction zone centered at origin
    const suctionConfig = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      force: 8,
    };
    const suction = new SuctionZone(world, group, suctionConfig, SURFACE_HEIGHT);

    // Ball positioned inside the suction zone
    const ball = makeMockBall(2, 0);

    // Simulate sand trap effect: in the real game, Ball.checkAndUpdateBunkerState()
    // sets linearDamping to 0.98 when the ball is in a bunker zone
    ball.linearDamping = 0.98; // Sand trap damping applied

    // Run suction zone update — should still apply force despite sand damping
    suction.update(DT, ball);

    // Ball should receive suction force even while in sand trap
    expect(ball.applyForce).toHaveBeenCalledTimes(1);

    // Force should pull toward center (negative x since ball is at x=2)
    const force = ball.applyForce.mock.calls[0][0];
    expect(force.x).toBeLessThan(0);
    expect(force.z).toBeCloseTo(0);

    // Sand trap damping is still in effect (not overridden by suction)
    expect(ball.linearDamping).toBe(0.98);
  });

  it('suction force magnitude is unaffected by sand trap damping state', () => {
    const suctionConfig = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      force: 10,
    };
    const suction = new SuctionZone(world, group, suctionConfig, SURFACE_HEIGHT);

    // Ball without sand trap
    const ballNormal = makeMockBall(3, 0);
    ballNormal.linearDamping = 0.85; // normal damping
    suction.update(DT, ballNormal);

    // Ball with sand trap damping at same position
    const ballInSand = makeMockBall(3, 0);
    ballInSand.linearDamping = 0.98; // sand trap damping
    suction.update(DT, ballInSand);

    // Both should receive identical suction force
    const forceNormal = ballNormal.applyForce.mock.calls[0][0];
    const forceInSand = ballInSand.applyForce.mock.calls[0][0];

    expect(forceInSand.x).toBeCloseTo(forceNormal.x);
    expect(forceInSand.z).toBeCloseTo(forceNormal.z);
  });
});

// ---------------------------------------------------------------------------
// BoostStrip + Water Hazard overlap
// ---------------------------------------------------------------------------

describe('BoostStrip and water hazard overlap', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('boost force is applied to ball before water hazard resets position (hazard takes priority)', () => {
    // Set up a boost strip that pushes in the +x direction
    const boostConfig = {
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(1, 0, 0),
      force: 15,
      size: { width: 4, length: 4 },
    };
    const boost = new BoostStrip(world, group, boostConfig, SURFACE_HEIGHT);

    // Ball starts in the boost strip zone
    const ball = makeMockBall(
      boost.triggerBody.position.x,
      boost.triggerBody.position.z
    );

    // Frame 1: Boost applies force to the ball
    boost.update(DT, ball);
    expect(ball.applyForce).toHaveBeenCalledTimes(1);

    // In the real game, water hazard detection happens in Ball.update(),
    // which runs BEFORE CoursesManager.update() (mechanics).
    // If water triggers, it resets ball position to lastHitPosition.
    //
    // Simulating water reset: ball position is moved back to last hit position
    const lastHitPosition = { x: -5, y: 0.2, z: 0 };
    ball.position.x = lastHitPosition.x;
    ball.position.y = lastHitPosition.y;
    ball.position.z = lastHitPosition.z;
    ball.velocity.x = 0;
    ball.velocity.y = 0;
    ball.velocity.z = 0;

    // Frame 2: After water reset, ball is no longer in boost zone
    ball.applyForce.mockClear();
    boost.update(DT, ball);

    // Ball should NOT receive boost force because it's been reset outside the zone
    expect(ball.applyForce).not.toHaveBeenCalled();
  });

  it('boost strip still applies force while ball is in the overlap zone (before water triggers)', () => {
    const boostConfig = {
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
      force: 12,
      size: { width: 6, length: 6 },
    };
    const boost = new BoostStrip(world, group, boostConfig, SURFACE_HEIGHT);

    // Ball inside both boost strip and hypothetical water zone
    const ball = makeMockBall(
      boost.triggerBody.position.x,
      boost.triggerBody.position.z
    );

    // The boost strip mechanic doesn't check for water — it only checks zone overlap
    boost.update(DT, ball);

    // Force is applied regardless — the water hazard system handles its own logic
    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];
    expect(force.z).toBeCloseTo(-12); // force in -z direction
  });
});

// ---------------------------------------------------------------------------
// LowGravityZone + Sand Trap overlap
// ---------------------------------------------------------------------------

describe('LowGravityZone and sand trap overlap', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('LowGravityZone does not prevent sand trap damping from applying', () => {
    const lowGravConfig = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      gravityMultiplier: 0.3,
    };
    const lowGrav = new LowGravityZone(world, group, lowGravConfig, SURFACE_HEIGHT);

    // Ball in overlapping low gravity zone and sand trap
    const ball = makeMockBall(1, 0);

    // Sand trap damping is applied by Ball.checkAndUpdateBunkerState()
    ball.linearDamping = 0.98;

    // Low gravity zone update
    lowGrav.update(DT, ball);

    // Counter-gravity force should still be applied
    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];
    expect(force.y).toBeGreaterThan(0); // upward counter-gravity

    // Sand trap damping must NOT be overridden by low gravity
    expect(ball.linearDamping).toBe(0.98);
  });

  it('low gravity counter-force is identical with or without sand trap damping', () => {
    const lowGravConfig = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      gravityMultiplier: 0.5,
    };

    const lowGrav = new LowGravityZone(world, group, lowGravConfig, SURFACE_HEIGHT);

    // Ball without sand trap
    const ballNormal = makeMockBall(2, 0);
    ballNormal.linearDamping = 0.85;
    lowGrav.update(DT, ballNormal);

    // Ball with sand trap
    const ballInSand = makeMockBall(2, 0);
    ballInSand.linearDamping = 0.98;
    lowGrav.update(DT, ballInSand);

    // Both should receive identical upward counter-gravity force
    const forceNormal = ballNormal.applyForce.mock.calls[0][0];
    const forceInSand = ballInSand.applyForce.mock.calls[0][0];
    expect(forceInSand.y).toBeCloseTo(forceNormal.y);
  });

  it('ball with high sand damping still receives low gravity force across multiple frames', () => {
    const lowGravConfig = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      gravityMultiplier: 0.3,
    };
    const lowGrav = new LowGravityZone(world, group, lowGravConfig, SURFACE_HEIGHT);

    const ball = makeMockBall(1, 0);
    ball.linearDamping = 0.98; // sand trap

    // Multiple frames of overlapping low gravity + sand trap
    for (let i = 0; i < 5; i++) {
      lowGrav.update(DT, ball);
    }

    // Force should be applied every frame
    expect(ball.applyForce).toHaveBeenCalledTimes(5);

    // Each frame's force should be identical (counter-gravity is constant)
    const forces = ball.applyForce.mock.calls.map(call => call[0].y);
    for (let i = 1; i < forces.length; i++) {
      expect(forces[i]).toBeCloseTo(forces[0]);
    }

    // Sand damping still in effect
    expect(ball.linearDamping).toBe(0.98);
  });
});

// ---------------------------------------------------------------------------
// Update order: force field force applied before/independently of hazard check
// ---------------------------------------------------------------------------

describe('Force field and hazard update order', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('force field force is applied independently of hazard detection (both systems operate on ball body)', () => {
    // This test documents that force fields and hazards are independent systems:
    // - Force fields: read ball position → apply force (via applyForce)
    // - Sand traps: read ball position → modify linearDamping
    // - Water hazards: read ball position → reset position + add stroke
    //
    // They don't interfere because they modify different properties.

    const boostConfig = {
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(1, 0, 0),
      force: 10,
      size: { width: 6, length: 6 },
    };
    const suctionConfig = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      force: 8,
    };
    const lowGravConfig = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      gravityMultiplier: 0.3,
    };

    const boost = new BoostStrip(world, group, boostConfig, SURFACE_HEIGHT);
    const suction = new SuctionZone(world, group, suctionConfig, SURFACE_HEIGHT);
    const lowGrav = new LowGravityZone(world, group, lowGravConfig, SURFACE_HEIGHT);

    // Ball in all zones with sand trap damping active
    const ball = makeMockBall(
      boost.triggerBody.position.x + 1, // offset slightly so suction has direction
      boost.triggerBody.position.z
    );
    ball.linearDamping = 0.98; // sand trap active

    // Simulate the update order: mechanics update
    boost.update(DT, ball);
    suction.update(DT, ball);
    lowGrav.update(DT, ball);

    // All three force fields should have applied their forces
    expect(ball.applyForce).toHaveBeenCalledTimes(3);

    // Boost: directional force in +x
    expect(ball.applyForce.mock.calls[0][0].x).toBeCloseTo(10);

    // Suction: pull toward center (ball at x=1, center at x=0 → negative x)
    expect(ball.applyForce.mock.calls[1][0].x).toBeLessThan(0);

    // LowGrav: upward counter-gravity
    expect(ball.applyForce.mock.calls[2][0].y).toBeGreaterThan(0);

    // Sand damping was not modified by any force field
    expect(ball.linearDamping).toBe(0.98);
  });

  it('multiple force fields can coexist with hazard zones without mutual interference', () => {
    // Simulates a scenario where the ball passes through overlapping zones
    // over multiple frames with hazard state changes

    const boostConfig = {
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(1, 0, 0),
      force: 10,
      size: { width: 8, length: 8 },
    };
    const boost = new BoostStrip(world, group, boostConfig, SURFACE_HEIGHT);

    const ball = makeMockBall(
      boost.triggerBody.position.x,
      boost.triggerBody.position.z
    );

    // Frame 1: Ball on normal ground in boost zone
    ball.linearDamping = 0.85;
    boost.update(DT, ball);
    expect(ball.applyForce).toHaveBeenCalledTimes(1);

    // Frame 2: Ball enters sand trap (damping increases) but still in boost zone
    ball.linearDamping = 0.98;
    boost.update(DT, ball);
    expect(ball.applyForce).toHaveBeenCalledTimes(2);

    // Frame 3: Ball still in sand trap + boost zone
    boost.update(DT, ball);
    expect(ball.applyForce).toHaveBeenCalledTimes(3);

    // Frame 4: Ball exits sand trap but remains in boost zone
    ball.linearDamping = 0.85;
    boost.update(DT, ball);
    expect(ball.applyForce).toHaveBeenCalledTimes(4);

    // All four frames applied identical boost force regardless of damping state
    for (let i = 0; i < 4; i++) {
      expect(ball.applyForce.mock.calls[i][0].x).toBeCloseTo(10);
    }
  });
});
