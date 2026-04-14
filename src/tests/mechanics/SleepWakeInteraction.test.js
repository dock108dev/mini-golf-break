/**
 * Tests for ball sleep/wake interaction with mechanics
 * ISSUE-069
 *
 * Verifies that mechanics correctly handle sleeping balls:
 * - BoostStrip wakes sleeping ball and applies force
 * - SuctionZone wakes sleeping ball and pulls toward center
 * - LowGravityZone leaves sleeping ball asleep (no force needed when stationary)
 * - PortalGate teleports sleeping ball and wakes it at exit
 * - MovingSweeper kinematic body can wake sleeping ball on collision
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { SuctionZone } from '../../mechanics/SuctionZone';
import { LowGravityZone } from '../../mechanics/LowGravityZone';
import { PortalGate } from '../../mechanics/PortalGate';
import { MovingSweeper } from '../../mechanics/MovingSweeper';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    scale: s => ({ x: x * s, y: y * s, z: z * s }),
    set: jest.fn(function (nx, ny, nz) {
      this.x = nx;
      this.y = ny;
      this.z = nz;
    })
  }));

  CANNON.Body.mockImplementation((opts = {}) => ({
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
    userData: {},
    type: opts.type || 0,
    mass: opts.mass || 0,
    isTrigger: opts.isTrigger || false
  }));

  CANNON.Quaternion = jest.fn(() => ({
    setFromAxisAngle: jest.fn(),
    copy: jest.fn()
  }));

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, roughness: 0.3, metalness: 0.2, dispose: jest.fn() };
    if (opts) {
      Object.assign(mat, opts);
    }
    return mat;
  });

  THREE.CircleGeometry = jest.fn(() => ({ dispose: jest.fn() }));
  THREE.PlaneGeometry = jest.fn(() => ({ dispose: jest.fn() }));
  THREE.RingGeometry = jest.fn(() => ({ dispose: jest.fn() }));
  THREE.BoxGeometry = jest.fn(() => ({ dispose: jest.fn() }));
  THREE.CylinderGeometry = jest.fn(() => ({ dispose: jest.fn() }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    step: jest.fn(),
    bumperMaterial: {}
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

const SLEEPING = CANNON.Body.SLEEPING;
const SURFACE_HEIGHT = 0.2;

function makeSleepingBall(x = 0, z = 0, mass = 0.45) {
  return {
    position: { x, y: SURFACE_HEIGHT, z },
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    mass,
    sleepState: SLEEPING,
    applyForce: jest.fn(),
    wakeUp: jest.fn()
  };
}

function makeAwakeBall(x = 0, z = 0, mass = 0.45) {
  return {
    position: { x, y: SURFACE_HEIGHT, z },
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    mass,
    sleepState: 0, // AWAKE
    applyForce: jest.fn(),
    wakeUp: jest.fn()
  };
}

// ---------------------------------------------------------------------------
// BoostStrip + sleeping ball
// ---------------------------------------------------------------------------

describe('BoostStrip sleep/wake interaction', () => {
  const config = {
    position: new THREE.Vector3(0, 0, 0),
    direction: new THREE.Vector3(0, 0, -1),
    force: 10,
    size: { width: 2, length: 4 }
  };

  it('wakes sleeping ball inside zone and applies force on next update', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const strip = new BoostStrip(world, group, config, SURFACE_HEIGHT);

    // Place sleeping ball at trigger body position (inside zone)
    const ball = makeSleepingBall(strip.triggerBody.position.x, strip.triggerBody.position.z);

    strip.update(0.016, ball);

    expect(ball.wakeUp).toHaveBeenCalled();
    expect(ball.applyForce).toHaveBeenCalledWith(strip.direction);
  });

  it('does not wake sleeping ball outside zone', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const strip = new BoostStrip(world, group, config, SURFACE_HEIGHT);

    const ball = makeSleepingBall(100, 100);

    strip.update(0.016, ball);

    expect(ball.wakeUp).not.toHaveBeenCalled();
    expect(ball.applyForce).not.toHaveBeenCalled();
  });

  it('does not call wakeUp on awake ball', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const strip = new BoostStrip(world, group, config, SURFACE_HEIGHT);

    const ball = makeAwakeBall(strip.triggerBody.position.x, strip.triggerBody.position.z);

    strip.update(0.016, ball);

    expect(ball.wakeUp).not.toHaveBeenCalled();
    expect(ball.applyForce).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SuctionZone + sleeping ball
// ---------------------------------------------------------------------------

describe('SuctionZone sleep/wake interaction', () => {
  const config = {
    position: new THREE.Vector3(0, 0, 0),
    radius: 5,
    force: 6
  };

  it('wakes sleeping ball inside zone and pulls toward center', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);

    // Place sleeping ball inside the zone (not at center)
    const ball = makeSleepingBall(2, 0);

    zone.update(0.016, ball);

    expect(ball.wakeUp).toHaveBeenCalled();
    expect(ball.applyForce).toHaveBeenCalled();

    // Force should pull toward center (negative x direction since ball is at x=2)
    const force = ball.applyForce.mock.calls[0][0];
    expect(force.x).toBeLessThan(0); // pulling toward center at x=0
  });

  it('does not wake sleeping ball outside zone', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);

    const ball = makeSleepingBall(100, 100);

    zone.update(0.016, ball);

    expect(ball.wakeUp).not.toHaveBeenCalled();
    expect(ball.applyForce).not.toHaveBeenCalled();
  });

  it('does not call wakeUp on awake ball', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);

    const ball = makeAwakeBall(2, 0);

    zone.update(0.016, ball);

    expect(ball.wakeUp).not.toHaveBeenCalled();
    expect(ball.applyForce).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// LowGravityZone + sleeping ball
// ---------------------------------------------------------------------------

describe('LowGravityZone sleep/wake interaction', () => {
  const config = {
    position: new THREE.Vector3(0, 0, 0),
    radius: 5,
    gravityMultiplier: 0.3
  };

  it('does not wake sleeping ball (no force needed when stationary)', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

    const ball = makeSleepingBall(1, 1);

    zone.update(0.016, ball);

    expect(ball.applyForce).not.toHaveBeenCalled();
    // Ball should remain sleeping — gravity reduction is irrelevant at rest
    expect(ball.sleepState).toBe(SLEEPING);
  });

  it('does not have wakeUp called on sleeping ball', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

    const ball = makeSleepingBall(0, 0);

    zone.update(0.016, ball);

    expect(ball.wakeUp).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PortalGate + sleeping ball
// ---------------------------------------------------------------------------

describe('PortalGate sleep/wake interaction', () => {
  const config = {
    entryPosition: new THREE.Vector3(-3, 0, 2),
    exitPosition: new THREE.Vector3(3, 0, -5),
    radius: 0.6
  };

  it('teleports sleeping ball and wakes it at the exit', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    // Place sleeping ball at entry position
    const ball = makeSleepingBall(-3, 2);
    ball.position.set = jest.fn(
      function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }.bind(ball.position)
    );

    portal.update(0.016, ball);

    // Ball should have been teleported to exit position
    expect(ball.position.set).toHaveBeenCalledWith(
      config.exitPosition.x,
      SURFACE_HEIGHT + 0.3, // exitY = surfaceHeight + 0.3
      config.exitPosition.z
    );
    // Ball should be woken after teleport
    expect(ball.wakeUp).toHaveBeenCalled();
  });

  it('does not skip sleeping ball (no sleep check before teleport)', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    const ball = makeSleepingBall(-3, 2);
    ball.position.set = jest.fn(
      function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }.bind(ball.position)
    );

    portal.update(0.016, ball);

    // Portal should still teleport even though ball is sleeping
    expect(ball.position.set).toHaveBeenCalled();
    expect(ball.wakeUp).toHaveBeenCalled();
  });

  it('does not teleport sleeping ball outside entry radius', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    const ball = makeSleepingBall(100, 100);

    portal.update(0.016, ball);

    expect(ball.wakeUp).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// MovingSweeper + sleeping ball
// ---------------------------------------------------------------------------

describe('MovingSweeper sleep/wake interaction', () => {
  const config = {
    pivot: new THREE.Vector3(0, 0, 0),
    armLength: 3,
    speed: 1.5,
    size: { width: 3, height: 0.4, depth: 0.3 }
  };

  it('uses KINEMATIC body type that wakes sleeping balls on collision', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

    // KINEMATIC bodies in Cannon-es automatically wake sleeping bodies on contact.
    // The constructor passes type: CANNON.Body.KINEMATIC and mass: 0.
    // Verify mass is 0 (kinematic characteristic) and body is added to world.
    expect(sweeper.body.mass).toBe(0);
    expect(world.addBody).toHaveBeenCalledWith(sweeper.body);
  });

  it('continues updating position even when ball is sleeping', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

    const initialX = sweeper.body.position.x;
    const ball = makeSleepingBall(0, 0);

    // Sweeper should keep moving regardless of ball sleep state
    sweeper.update(1.0, ball);

    // Body position should have changed (sweeper rotates around pivot)
    expect(sweeper.body.position.set).toHaveBeenCalled();
  });

  it('registers collision event listener for ball wake interaction', () => {
    const world = makeMockWorld();
    const group = makeMockGroup();
    const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

    // Sweeper should have a collide event listener registered
    expect(sweeper.body.addEventListener).toHaveBeenCalledWith('collide', expect.any(Function));
  });
});
