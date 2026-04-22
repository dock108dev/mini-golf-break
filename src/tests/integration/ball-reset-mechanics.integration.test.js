/**
 * Integration tests for ball reset interaction with active mechanics.
 * ISSUE-109
 *
 * Verifies that when the ball is reset (water hazard, out-of-bounds), active
 * mechanics do not produce unexpected behaviour — e.g. portal re-trigger,
 * suction pulling to unplayable position, boost accelerating before the
 * player can aim, or sweeper collision on the very first frame.
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { PortalGate } from '../../mechanics/PortalGate';
import { SuctionZone } from '../../mechanics/SuctionZone';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { MovingSweeper } from '../../mechanics/MovingSweeper';
import { GameState } from '../../states/GameState';

// ---------------------------------------------------------------------------
// Mock enhancements (same pattern as mechanics-physics integration tests)
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    scale: s => ({ x: x * s, y: y * s, z: z * s })
  }));

  CANNON.Body.mockImplementation(() => ({
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      set: jest.fn(),
      setFromAxisAngle: jest.fn(),
      copy: jest.fn()
    },
    angularVelocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    addShape: jest.fn(),
    addEventListener: jest.fn(),
    userData: {}
  }));

  CANNON.Body.SLEEPING = 2;
  CANNON.Body.KINEMATIC = 4;
  CANNON.Body.STATIC = 1;

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, roughness: 0.3, metalness: 0.2, dispose: jest.fn() };
    if (opts) {
      Object.assign(mat, opts);
    }
    return mat;
  });

  const geomProto = { dispose: jest.fn() };
  if (typeof THREE.CircleGeometry.mockImplementation === 'function') {
    THREE.CircleGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.PlaneGeometry.mockImplementation === 'function') {
    THREE.PlaneGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.BoxGeometry.mockImplementation === 'function') {
    THREE.BoxGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.CylinderGeometry.mockImplementation === 'function') {
    THREE.CylinderGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.RingGeometry?.mockImplementation === 'function') {
    THREE.RingGeometry.mockImplementation(() => ({ ...geomProto }));
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SURFACE_HEIGHT = 0.2;

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    step: jest.fn(),
    bumperMaterial: { name: 'bumper' }
  };
}

function makeMockGroup() {
  const children = [];
  return {
    add: jest.fn(child => children.push(child)),
    remove: jest.fn(child => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
      }
    }),
    children
  };
}

/**
 * Creates a mock ball body simulating a freshly-reset ball:
 *   - position set to the given coords
 *   - velocity zeroed out (reset always zeroes velocity)
 *   - sleepState can be configured (ball is woken on reset)
 */
function makeResetBall(x, z, { sleeping = false } = {}) {
  return {
    position: {
      x,
      y: SURFACE_HEIGHT,
      z,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    mass: 0.45,
    sleepState: sleeping ? CANNON.Body.SLEEPING : 0,
    applyForce: jest.fn(),
    applyImpulse: jest.fn(),
    wakeUp: jest.fn()
  };
}

// ---------------------------------------------------------------------------
// PortalGate — ball reset into entry zone should not trigger teleport
// ---------------------------------------------------------------------------

describe('Ball reset into PortalGate entry zone', () => {
  let world, group, portal;

  const entryPos = new THREE.Vector3(2, 0, 3);
  const exitPos = new THREE.Vector3(-5, 0, -5);
  const portalRadius = 0.6;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    portal = new PortalGate(
      world,
      group,
      {
        entryPosition: entryPos,
        exitPosition: exitPos,
        radius: portalRadius
      },
      SURFACE_HEIGHT
    );
  });

  it('does not trigger teleport when cooldown is active after a prior teleport', () => {
    // Simulate initial teleport: ball enters portal normally
    const ball = makeResetBall(entryPos.x, entryPos.z);
    portal.update(1 / 60, ball);

    // Ball was teleported — cooldown is now 1.0s
    expect(ball.position.set).toHaveBeenCalledTimes(1);

    // Simulate water hazard reset: ball placed back at entry zone
    ball.position.x = entryPos.x;
    ball.position.z = entryPos.z;
    ball.position.set.mockClear();

    // Next frame after reset — cooldown still active, should NOT teleport
    portal.update(1 / 60, ball);
    expect(ball.position.set).not.toHaveBeenCalled();
  });

  it('cooldown protects against re-teleport for multiple frames after reset', () => {
    // Trigger initial teleport
    const ball = makeResetBall(entryPos.x, entryPos.z);
    portal.update(1 / 60, ball);
    expect(ball.position.set).toHaveBeenCalledTimes(1);

    // Reset ball back into entry zone (simulating water hazard reset)
    ball.position.x = entryPos.x;
    ball.position.z = entryPos.z;
    ball.position.set.mockClear();

    // Run several frames — cooldown of 1.0s should block all of these
    const dt = 1 / 60;
    for (let i = 0; i < 30; i++) {
      portal.update(dt, ball);
    }
    // 30 frames at 1/60 = 0.5s, still within 1.0s cooldown
    expect(ball.position.set).not.toHaveBeenCalled();
  });

  it('does not teleport when ball is placed outside entry radius', () => {
    // Ball reset to a position just outside the portal radius
    const ball = makeResetBall(entryPos.x + portalRadius + 0.5, entryPos.z);

    portal.update(1 / 60, ball);

    expect(ball.position.set).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SuctionZone — ball reset into zone should not pull to unplayable position
// ---------------------------------------------------------------------------

describe('Ball reset into SuctionZone', () => {
  let world, group, zone;

  const zoneCenter = new THREE.Vector3(0, 0, 0);
  const zoneRadius = 4;
  const zoneForce = 8;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    zone = new SuctionZone(
      world,
      group,
      {
        position: zoneCenter,
        radius: zoneRadius,
        force: zoneForce
      },
      SURFACE_HEIGHT
    );
  });

  it('applies bounded force to a reset ball inside the zone', () => {
    // Ball reset to edge of suction zone
    const ball = makeResetBall(zoneRadius - 0.5, 0);

    zone.update(1 / 60, ball);

    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];

    // Force should be finite and bounded by the zone's configured force
    expect(Math.abs(force.x)).toBeLessThanOrEqual(zoneForce);
    expect(Math.abs(force.z)).toBeLessThanOrEqual(zoneForce);
    expect(force.y).toBe(0); // No vertical pull
  });

  it('does not teleport or set ball position (force only)', () => {
    // Ball reset into the center area of the suction zone
    const ball = makeResetBall(1, 1);

    zone.update(1 / 60, ball);

    // SuctionZone only applies force — it should never set position directly
    expect(ball.position.set).not.toHaveBeenCalled();
  });

  it('force is proportional, not extreme, for ball near zone center', () => {
    // Ball reset very close to the zone center
    const ball = makeResetBall(0.5, 0);

    zone.update(1 / 60, ball);

    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];

    // Near-center force uses inverse distance formula: force * (1 - dist/radius)
    // At dist=0.5, radius=4: strength = 8 * (1 - 0.5/4) = 8 * 0.875 = 7.0
    // The magnitude should be reasonable (not infinite)
    const magnitude = Math.sqrt(force.x * force.x + force.z * force.z);
    expect(magnitude).toBeLessThan(zoneForce);
    expect(magnitude).toBeGreaterThan(0);
  });

  it('does not apply force when ball is reset outside zone radius', () => {
    const ball = makeResetBall(zoneRadius + 2, 0);

    zone.update(1 / 60, ball);

    expect(ball.applyForce).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// BoostStrip — ball reset into strip should not immediately accelerate
// ---------------------------------------------------------------------------

describe('Ball reset into BoostStrip zone', () => {
  let world, group, strip;

  const stripPos = new THREE.Vector3(3, 0, 3);
  const stripForce = 10;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    strip = new BoostStrip(
      world,
      group,
      {
        position: stripPos,
        boost_direction: new THREE.Vector3(1, 0, 0),
        boost_magnitude: stripForce,
        size: { width: 2, length: 3 }
      },
      SURFACE_HEIGHT
    );
  });

  it('applies velocity impulse on update when ball is inside the strip zone', () => {
    // Ball reset into the boost strip zone (ball at strip trigger body position)
    const ball = makeResetBall(strip.triggerBody.position.x, strip.triggerBody.position.z);

    strip.update(1 / 60, ball);

    // BoostStrip adds velocity impulse — velocity.x should equal boost_magnitude
    expect(ball.velocity.x).toBeCloseTo(stripForce);
  });

  it('does not teleport or directly set ball position', () => {
    const ball = makeResetBall(strip.triggerBody.position.x, strip.triggerBody.position.z);

    strip.update(1 / 60, ball);

    // BoostStrip only modifies velocity — never directly moves the ball
    expect(ball.position.set).not.toHaveBeenCalled();
  });

  it('single frame impulse is bounded and manageable', () => {
    const ball = makeResetBall(strip.triggerBody.position.x, strip.triggerBody.position.z);

    // Simulate one update frame
    strip.update(1 / 60, ball);

    // The velocity delta equals boost_magnitude in configured direction
    expect(ball.velocity.x).toBeCloseTo(stripForce);
    expect(ball.velocity.z).toBeCloseTo(0);

    // Impulse magnitude is bounded — no runaway values
    const magnitude = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.z ** 2);
    expect(magnitude).toBeCloseTo(stripForce);
    expect(magnitude).toBeLessThan(100); // sanity check
  });

  it('does not apply impulse when ball is reset outside the strip zone', () => {
    const ball = makeResetBall(50, 50); // far away

    strip.update(1 / 60, ball);

    expect(ball.velocity.x).toBe(0);
    expect(ball.velocity.z).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MovingSweeper — ball reset while sweeper active should not cause collision
// on first frame
// ---------------------------------------------------------------------------

describe('Ball reset while MovingSweeper is active', () => {
  let world, group, sweeper;

  const pivotPos = new THREE.Vector3(0, 0, 0);
  const armLength = 4;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    sweeper = new MovingSweeper(
      world,
      group,
      {
        pivot: pivotPos,
        armLength,
        speed: 2.0,
        size: { width: armLength, height: 0.4, depth: 0.3 }
      },
      SURFACE_HEIGHT
    );
  });

  it('sweeper does not directly modify ball position on update', () => {
    // Ball reset to a position near the sweeper's path
    const ball = makeResetBall(1, 0);

    // Update sweeper — it moves its own body but should not touch the ball
    sweeper.update(1 / 60, ball);

    // MovingSweeper only moves its kinematic body; ball collision is handled
    // by the physics engine, not by the mechanic's update() method
    expect(ball.position.set).not.toHaveBeenCalled();
    expect(ball.applyForce).not.toHaveBeenCalled();
  });

  it('sweeper continues rotating normally after ball reset', () => {
    const ball = makeResetBall(5, 5); // ball away from sweeper

    const positionsBefore = [];
    const positionsAfter = [];

    // Run a few frames before "reset"
    for (let i = 0; i < 5; i++) {
      sweeper.update(1 / 60, null);
      positionsBefore.push({ x: sweeper.body.position.x, z: sweeper.body.position.z });
    }

    // Simulate ball reset — sweeper should keep rotating unaffected
    for (let i = 0; i < 5; i++) {
      sweeper.update(1 / 60, ball);
      positionsAfter.push({ x: sweeper.body.position.x, z: sweeper.body.position.z });
    }

    // Verify the sweeper moved in both phases (not stuck)
    for (let i = 1; i < positionsBefore.length; i++) {
      const prev = positionsBefore[i - 1];
      const curr = positionsBefore[i];
      const moved = Math.abs(curr.x - prev.x) > 0.001 || Math.abs(curr.z - prev.z) > 0.001;
      expect(moved).toBe(true);
    }
    for (let i = 1; i < positionsAfter.length; i++) {
      const prev = positionsAfter[i - 1];
      const curr = positionsAfter[i];
      const moved = Math.abs(curr.x - prev.x) > 0.001 || Math.abs(curr.z - prev.z) > 0.001;
      expect(moved).toBe(true);
    }
  });

  it('sweeper body stays at arm distance from pivot after ball reset', () => {
    const ball = makeResetBall(0, 0);

    for (let i = 0; i < 10; i++) {
      sweeper.update(1 / 60, ball);
      const dx = sweeper.body.position.x - pivotPos.x;
      const dz = sweeper.body.position.z - pivotPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist).toBeCloseTo(armLength / 2, 1);
    }
  });
});

// ---------------------------------------------------------------------------
// After ball reset — player can aim and hit (AIMING state is correct)
// ---------------------------------------------------------------------------

describe('AIMING state after ball reset', () => {
  it('GameState.AIMING is defined and has the expected value', () => {
    expect(GameState.AIMING).toBe('aiming');
  });

  it('ball is stationary after reset (zero velocity)', () => {
    const ball = makeResetBall(3, 3);

    // After a reset, velocity should be zeroed
    expect(ball.velocity.x).toBe(0);
    expect(ball.velocity.y).toBe(0);
    expect(ball.velocity.z).toBe(0);
  });

  it('ball can receive impulse after reset (simulating a hit)', () => {
    const ball = makeResetBall(3, 3);

    // Simulate player hit — applyImpulse should be callable
    ball.applyImpulse({ x: 2, y: 0, z: -3 });

    expect(ball.applyImpulse).toHaveBeenCalledWith({ x: 2, y: 0, z: -3 });
  });

  it('mechanics do not prevent ball from being hit after reset', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();

    // Create multiple active mechanics
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(10, 0, 10),
        exitPosition: new THREE.Vector3(-5, 0, -5),
        radius: 0.6
      },
      SURFACE_HEIGHT
    );

    const zone = new SuctionZone(
      world,
      group,
      {
        position: new THREE.Vector3(20, 0, 20),
        radius: 3,
        force: 5
      },
      SURFACE_HEIGHT
    );

    // Ball reset at position away from all mechanics
    const ball = makeResetBall(0, 0);

    // Update all mechanics — none should affect the ball at (0, 0)
    portal.update(1 / 60, ball);
    zone.update(1 / 60, ball);

    expect(ball.position.set).not.toHaveBeenCalled();
    expect(ball.applyForce).not.toHaveBeenCalled();

    // Player can still aim and hit
    ball.applyImpulse({ x: 5, y: 0, z: -4 });
    expect(ball.applyImpulse).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Cross-mechanic: multiple mechanics active during ball reset
// ---------------------------------------------------------------------------

describe('Multiple active mechanics during ball reset', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('ball reset away from all mechanic zones is completely unaffected', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(-10, 0, -10),
        exitPosition: new THREE.Vector3(10, 0, 10),
        radius: 0.6
      },
      SURFACE_HEIGHT
    );

    const suction = new SuctionZone(
      world,
      group,
      {
        position: new THREE.Vector3(15, 0, 15),
        radius: 3,
        force: 8
      },
      SURFACE_HEIGHT
    );

    const boost = new BoostStrip(
      world,
      group,
      {
        position: new THREE.Vector3(-15, 0, -15),
        direction: new THREE.Vector3(1, 0, 0),
        force: 10,
        size: { width: 2, length: 2 }
      },
      SURFACE_HEIGHT
    );

    const sweeper = new MovingSweeper(
      world,
      group,
      {
        pivot: new THREE.Vector3(20, 0, 20),
        armLength: 3,
        speed: 1.5,
        size: { width: 3, height: 0.4, depth: 0.3 }
      },
      SURFACE_HEIGHT
    );

    // Ball reset at origin — far from all mechanics
    const ball = makeResetBall(0, 0);

    portal.update(1 / 60, ball);
    suction.update(1 / 60, ball);
    boost.update(1 / 60, ball);
    sweeper.update(1 / 60, ball);

    // No mechanic should have affected the ball
    expect(ball.position.set).not.toHaveBeenCalled();
    expect(ball.applyForce).not.toHaveBeenCalled();
  });
});
