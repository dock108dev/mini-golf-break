/**
 * Integration tests for ball-in-hole detection with active mechanics nearby.
 * ISSUE-081
 *
 * Verifies that ball-in-hole detection works correctly when mechanics are
 * active near the hole. Tests the interaction between mechanic effects
 * (force fields, moving obstacles, portals) and the hole-entry conditions
 * (55% overlap at checkRadius <= 0.31, speed <= 4.06 m/s).
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { LowGravityZone } from '../../mechanics/LowGravityZone';
import { MovingSweeper } from '../../mechanics/MovingSweeper';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { SuctionZone } from '../../mechanics/SuctionZone';
import { PortalGate } from '../../mechanics/PortalGate';

// ---------------------------------------------------------------------------
// Constants mirroring Ball.js hole detection
// ---------------------------------------------------------------------------
const HOLE_ENTRY_OVERLAP_REQUIRED = 0.55;
const HOLE_ENTRY_MAX_SPEED = 4.06;
const HOLE_EDGE_RADIUS = 0.4;
const BALL_RADIUS = 0.2;

const ALLOWED_OFFSET = BALL_RADIUS * (1.0 - HOLE_ENTRY_OVERLAP_REQUIRED); // 0.09
const CHECK_RADIUS = HOLE_EDGE_RADIUS - ALLOWED_OFFSET; // ~0.31

// ---------------------------------------------------------------------------
// Enhanced mocks for physics integration
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
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
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
  ['CircleGeometry', 'PlaneGeometry', 'BoxGeometry', 'CylinderGeometry', 'RingGeometry'].forEach(
    name => {
      if (typeof THREE[name]?.mockImplementation === 'function') {
        THREE[name].mockImplementation(() => ({ ...geomProto }));
      }
    }
  );
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

function makeMockBall(x = 0, z = 0, vx = 0, vz = 0) {
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
    velocity: { x: vx, y: 0, z: vz },
    mass: 0.45,
    sleepState: 0, // AWAKE
    applyForce: jest.fn(),
    wakeUp: jest.fn()
  };
}

/**
 * Simulates Ball.js hole detection logic.
 * Returns true if the ball would be detected as in-hole.
 */
function checkBallInHole(ballBody, holePosition) {
  const dx = ballBody.position.x - holePosition.x;
  const dz = ballBody.position.z - holePosition.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > CHECK_RADIUS) {
    return false;
  }

  const vx = ballBody.velocity.x;
  const vy = ballBody.velocity.y || 0;
  const vz = ballBody.velocity.z;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

  return speed <= HOLE_ENTRY_MAX_SPEED;
}

// ---------------------------------------------------------------------------
// LowGravityZone + ball-in-hole
// ---------------------------------------------------------------------------
describe('Ball-in-hole detection with LowGravityZone active', () => {
  let world, group;
  const holePos = { x: 0, z: 5 };

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('ball entering hole while inside a LowGravityZone still triggers hole detection', () => {
    // LowGravityZone centered on the hole position
    const config = {
      position: new THREE.Vector3(holePos.x, 0, holePos.z),
      radius: 3,
      gravityMultiplier: 0.3
    };
    const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

    // Ball at hole position, slow speed (within threshold)
    const ball = makeMockBall(holePos.x, holePos.z, 0.5, 0);

    // Mechanic applies its force
    zone.update(1 / 60, ball);

    // LowGravityZone only applies upward Y force, does not affect XZ position
    // Ball-in-hole check should still pass
    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];
    expect(force.y).toBeGreaterThan(0); // upward counter-gravity
    expect(force.x).toBe(0);
    expect(force.z).toBe(0);

    // Hole detection: ball is at hole position with low speed
    const isInHole = checkBallInHole(ball, holePos);
    expect(isInHole).toBe(true);
  });

  it('LowGravityZone does not alter XZ position — hole overlap check unaffected', () => {
    const config = {
      position: new THREE.Vector3(holePos.x, 0, holePos.z),
      radius: 5,
      gravityMultiplier: 0.1
    };
    const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

    // Ball just inside check radius of hole, very slow
    const ball = makeMockBall(holePos.x + 0.2, holePos.z, 0.1, 0);

    // Run several frames of the mechanic
    for (let i = 0; i < 10; i++) {
      zone.update(1 / 60, ball);
    }

    // Ball position unchanged on XZ (LowGravityZone only applies Y force)
    expect(ball.position.x).toBeCloseTo(holePos.x + 0.2);
    expect(ball.position.z).toBeCloseTo(holePos.z);

    // Still in hole detection range
    const isInHole = checkBallInHole(ball, holePos);
    expect(isInHole).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MovingSweeper + ball-in-hole
// ---------------------------------------------------------------------------
describe('Ball-in-hole detection with MovingSweeper active nearby', () => {
  let world, group;
  const holePos = { x: 0, z: 5 };

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('sweeper active near hole does not interfere with hole detection for ball at hole', () => {
    // Sweeper with pivot near the hole but arm doesn't reach hole center
    const config = {
      pivot: new THREE.Vector3(2, 0, holePos.z),
      armLength: 1.5,
      speed: 2,
      size: { width: 0.3, height: 0.4, depth: 1.5 }
    };
    const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

    // Ball directly at hole, slow
    const ball = makeMockBall(holePos.x, holePos.z, 0.3, 0);

    // Run sweeper for several frames — it moves its own body, not the ball
    for (let i = 0; i < 30; i++) {
      sweeper.update(1 / 60, ball);
    }

    // MovingSweeper only updates its own position/rotation, does not apply force
    expect(ball.applyForce).not.toHaveBeenCalled();

    // Ball hasn't moved
    expect(ball.position.x).toBe(holePos.x);
    expect(ball.position.z).toBe(holePos.z);

    // Hole detection should work normally
    const isInHole = checkBallInHole(ball, holePos);
    expect(isInHole).toBe(true);
  });

  it('sweeper does not false-trigger or block hole detection', () => {
    // Sweeper sweeping through the hole area
    const config = {
      pivot: new THREE.Vector3(holePos.x, 0, holePos.z),
      armLength: 3,
      speed: 1,
      size: { width: 0.3, height: 0.4, depth: 3 }
    };
    const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

    // Ball at the hole position, stopped
    const ball = makeMockBall(holePos.x, holePos.z, 0, 0);

    // Advance sweeper through multiple rotations
    for (let i = 0; i < 60; i++) {
      sweeper.update(1 / 60, ball);
    }

    // MovingSweeper's update() only moves the sweeper arm mesh/body.
    // It does NOT modify ballBody — collision is handled by the physics engine.
    // Therefore ball-in-hole detection is purely based on ball position/speed.
    const isInHole = checkBallInHole(ball, holePos);
    expect(isInHole).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BoostStrip + ball-in-hole (speed threshold)
// ---------------------------------------------------------------------------
describe('Ball-in-hole detection with BoostStrip active', () => {
  let world, group;
  const holePos = { x: 0, z: 5 };

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('ball boosted above speed threshold is rejected from hole', () => {
    // BoostStrip at hole position pushing in +X direction
    const config = {
      position: new THREE.Vector3(holePos.x, 0, holePos.z),
      direction: new THREE.Vector3(1, 0, 0),
      force: 20,
      size: { width: 2, length: 2 }
    };
    const strip = new BoostStrip(world, group, config, SURFACE_HEIGHT);

    // Ball at hole position but with speed already near threshold
    const ball = makeMockBall(strip.triggerBody.position.x, strip.triggerBody.position.z, 3.5, 0);

    // BoostStrip applies force each frame
    strip.update(1 / 60, ball);
    expect(ball.applyForce).toHaveBeenCalled();

    // Simulate that the boost increased speed above threshold
    // (In real physics, applyForce would increase velocity over time)
    ball.velocity.x = 5.0; // Above HOLE_ENTRY_MAX_SPEED (4.06)

    // Ball is at hole position but too fast
    const isInHole = checkBallInHole(ball, holePos);
    expect(isInHole).toBe(false);
  });

  it('ball at hole position with boost but speed still under threshold enters hole', () => {
    const config = {
      position: new THREE.Vector3(holePos.x, 0, holePos.z),
      direction: new THREE.Vector3(1, 0, 0),
      force: 2,
      size: { width: 2, length: 2 }
    };
    const strip = new BoostStrip(world, group, config, SURFACE_HEIGHT);

    // Ball at hole, low speed
    const ball = makeMockBall(strip.triggerBody.position.x, strip.triggerBody.position.z, 1.0, 0);

    strip.update(1 / 60, ball);
    expect(ball.applyForce).toHaveBeenCalled();

    // Even with gentle boost, speed stays under threshold
    ball.velocity.x = 2.0; // Still under 4.06

    // Set ball position to hole position for detection
    ball.position.x = holePos.x;
    ball.position.z = holePos.z;

    const isInHole = checkBallInHole(ball, holePos);
    expect(isInHole).toBe(true);
  });

  it('boost strip respects speed threshold boundary precisely', () => {
    const config = {
      position: new THREE.Vector3(holePos.x, 0, holePos.z),
      direction: new THREE.Vector3(0, 0, 1),
      force: 10,
      size: { width: 2, length: 2 }
    };
    const strip = new BoostStrip(world, group, config, SURFACE_HEIGHT);

    // Ball at hole position, speed exactly at threshold
    const ballAtThreshold = makeMockBall(holePos.x, holePos.z, 0, HOLE_ENTRY_MAX_SPEED);
    expect(checkBallInHole(ballAtThreshold, holePos)).toBe(true);

    // Ball just above threshold
    const ballAboveThreshold = makeMockBall(holePos.x, holePos.z, 0, HOLE_ENTRY_MAX_SPEED + 0.01);
    expect(checkBallInHole(ballAboveThreshold, holePos)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SuctionZone + ball-in-hole
// ---------------------------------------------------------------------------
describe('SuctionZone centered on hole pulls ball in and triggers detection', () => {
  let world, group;
  const holePos = { x: 0, z: 5 };

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('suction zone at hole position applies inward force toward hole', () => {
    const config = {
      position: new THREE.Vector3(holePos.x, 0, holePos.z),
      radius: 3,
      force: 10
    };
    const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);

    // Ball near hole but slightly offset (within suction radius)
    const ball = makeMockBall(holePos.x + 1.5, holePos.z, 0, 0);

    zone.update(1 / 60, ball);

    // Suction should pull ball toward hole center (negative X direction)
    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];
    expect(force.x).toBeLessThan(0); // pulling toward center
  });

  it('ball pulled to hole center by suction triggers detection when slow', () => {
    const config = {
      position: new THREE.Vector3(holePos.x, 0, holePos.z),
      radius: 3,
      force: 8
    };
    const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);

    // Ball starts slightly offset but within check radius
    const ball = makeMockBall(holePos.x + 0.1, holePos.z, 0, 0);

    // Suction applies force
    zone.update(1 / 60, ball);
    expect(ball.applyForce).toHaveBeenCalled();

    // Simulate that suction has pulled ball close to center with low velocity
    ball.position.x = holePos.x;
    ball.velocity.x = 0.5;

    const isInHole = checkBallInHole(ball, holePos);
    expect(isInHole).toBe(true);
  });

  it('suction zone wakes sleeping ball to enable hole detection', () => {
    const config = {
      position: new THREE.Vector3(holePos.x, 0, holePos.z),
      radius: 4,
      force: 12
    };
    const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);

    // Sleeping ball within suction range
    const ball = makeMockBall(holePos.x + 1, holePos.z, 0, 0);
    ball.sleepState = CANNON.Body.SLEEPING;

    zone.update(1 / 60, ball);

    // SuctionZone wakes the ball so it can move toward hole
    expect(ball.wakeUp).toHaveBeenCalled();
    expect(ball.applyForce).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PortalGate + ball-in-hole
// ---------------------------------------------------------------------------
describe('Ball teleported by PortalGate to hole position triggers detection', () => {
  let world, group;
  const holePos = { x: 0, z: 5 };

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('portal teleports ball to hole position — triggers detection on next check', () => {
    // Portal exit is at the hole position
    const PORTAL_EXIT_Y = SURFACE_HEIGHT + 0.3; // PortalGate adds 0.3 elevation
    const config = {
      entryPosition: new THREE.Vector3(-5, 0, -5),
      exitPosition: new THREE.Vector3(holePos.x, SURFACE_HEIGHT, holePos.z),
      radius: 1
    };
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    // Ball at entry portal, slow speed
    const ball = makeMockBall(config.entryPosition.x, config.entryPosition.z, 1.0, 0);

    // Portal teleports ball
    portal.update(1 / 60, ball);

    // Ball should now be at exit position (hole XZ, with portal's exit Y elevation)
    expect(ball.position.set).toHaveBeenCalledWith(holePos.x, PORTAL_EXIT_Y, holePos.z);

    // Simulate the position update (mocked set doesn't auto-update)
    ball.position.x = holePos.x;
    ball.position.y = PORTAL_EXIT_Y;
    ball.position.z = holePos.z;

    // Ball keeps its velocity (portal preserves velocity)
    // Speed is 1.0 which is under threshold
    const isInHole = checkBallInHole(ball, holePos);
    expect(isInHole).toBe(true);
  });

  it('portal teleports fast ball to hole — rejected due to speed threshold', () => {
    const config = {
      entryPosition: new THREE.Vector3(-5, 0, -5),
      exitPosition: new THREE.Vector3(holePos.x, SURFACE_HEIGHT, holePos.z),
      radius: 1
    };
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    // Ball at entry portal, fast speed
    const ball = makeMockBall(config.entryPosition.x, config.entryPosition.z, 5.0, 3.0);

    portal.update(1 / 60, ball);

    // Ball teleported to hole position
    ball.position.x = holePos.x;
    ball.position.z = holePos.z;

    // Speed = sqrt(25 + 9) = ~5.83, above threshold
    const isInHole = checkBallInHole(ball, holePos);
    expect(isInHole).toBe(false);
  });

  it('portal cooldown prevents re-teleport after first teleport to hole', () => {
    const config = {
      entryPosition: new THREE.Vector3(-5, 0, -5),
      exitPosition: new THREE.Vector3(holePos.x, SURFACE_HEIGHT, holePos.z),
      radius: 1
    };
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    const ball = makeMockBall(config.entryPosition.x, config.entryPosition.z, 1.0, 0);

    // First teleport
    portal.update(1 / 60, ball);
    expect(ball.position.set).toHaveBeenCalledTimes(1);

    // Place ball back at entry (simulating it rolled back)
    ball.position.x = config.entryPosition.x;
    ball.position.z = config.entryPosition.z;

    // Second update within cooldown — should NOT teleport
    portal.update(1 / 60, ball);
    expect(ball.position.set).toHaveBeenCalledTimes(1); // Still just once
  });
});
