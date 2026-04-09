/**
 * Physics integration tests for mechanics affecting ball trajectory.
 * ISSUE-032
 *
 * Verifies that each mechanic type produces the expected physics outcome
 * when interacting with a ball body. Uses the mocked CANNON.World with
 * functional applyForce/position behavior to test measurable effects.
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { SuctionZone } from '../../mechanics/SuctionZone';
import { LowGravityZone } from '../../mechanics/LowGravityZone';
import { BowlContour } from '../../mechanics/BowlContour';
import { MovingSweeper } from '../../mechanics/MovingSweeper';
import { PortalGate } from '../../mechanics/PortalGate';

// ---------------------------------------------------------------------------
// Enhance mocks for physics integration testing
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
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }),
    },
    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      set: jest.fn(),
      setFromAxisAngle: jest.fn(),
      copy: jest.fn(),
    },
    addShape: jest.fn(),
    addEventListener: jest.fn(),
    userData: {},
  }));

  CANNON.Body.SLEEPING = 2;
  CANNON.Body.KINEMATIC = 4;
  CANNON.Body.STATIC = 1;

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, roughness: 0.3, metalness: 0.2, dispose: jest.fn() };
    if (opts) Object.assign(mat, opts);
    return mat;
  });

  // Override geometry constructors that are jest mocks
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
    bumperMaterial: { name: 'bumper' },
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

function makeMockBall(x = 0, z = 0, mass = 0.45) {
  return {
    position: {
      x,
      y: SURFACE_HEIGHT,
      z,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      }),
    },
    velocity: { x: 0, y: 0, z: 0 },
    mass,
    sleepState: 0, // AWAKE
    applyForce: jest.fn(),
    wakeUp: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// BoostStrip — ball velocity increases in configured direction
// ---------------------------------------------------------------------------

describe('BoostStrip physics integration', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('applies directional force to ball while in zone', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(1, 0, 0),
      force: 12,
      size: { width: 3, length: 3 },
    };
    const strip = new BoostStrip(world, group, config, SURFACE_HEIGHT);

    // Place ball at the trigger body position (center of strip)
    const ball = makeMockBall(strip.triggerBody.position.x, strip.triggerBody.position.z);

    strip.update(1 / 60, ball);

    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];
    expect(force.x).toBeCloseTo(12); // force in configured direction
    expect(force.z).toBeCloseTo(0);
  });

  it('applies force every frame while ball remains in zone', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
      force: 8,
      size: { width: 2, length: 4 },
    };
    const strip = new BoostStrip(world, group, config, SURFACE_HEIGHT);
    const ball = makeMockBall(strip.triggerBody.position.x, strip.triggerBody.position.z);

    // Simulate multiple frames
    strip.update(1 / 60, ball);
    strip.update(1 / 60, ball);
    strip.update(1 / 60, ball);

    expect(ball.applyForce).toHaveBeenCalledTimes(3);
    // Each call applies the same force magnitude in the z direction
    for (let i = 0; i < 3; i++) {
      expect(ball.applyForce.mock.calls[i][0].z).toBeCloseTo(-8);
    }
  });

  it('does not apply force when ball is outside zone', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(1, 0, 0),
      force: 10,
      size: { width: 1, length: 1 },
    };
    const strip = new BoostStrip(world, group, config, SURFACE_HEIGHT);
    const ball = makeMockBall(50, 50); // far away

    strip.update(1 / 60, ball);

    expect(ball.applyForce).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SuctionZone — ball velocity gains component toward zone center
// ---------------------------------------------------------------------------

describe('SuctionZone physics integration', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('applies radial inward force toward zone center', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      force: 10,
    };
    const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);

    // Ball at (3, 0) — should be pulled toward center (negative x)
    const ball = makeMockBall(3, 0);

    zone.update(1 / 60, ball);

    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];
    // Force should point toward center: negative x component
    expect(force.x).toBeLessThan(0);
    expect(force.z).toBeCloseTo(0);
    expect(force.y).toBe(0);
  });

  it('force strength scales with proximity (stronger closer to center)', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 10,
      force: 20,
    };
    const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);

    // Ball close to center (dist=2)
    const ballClose = makeMockBall(2, 0);
    zone.update(1 / 60, ballClose);

    // Ball farther from center (dist=8)
    const ballFar = makeMockBall(8, 0);
    zone.update(1 / 60, ballFar);

    const forceClose = Math.abs(ballClose.applyForce.mock.calls[0][0].x);
    const forceFar = Math.abs(ballFar.applyForce.mock.calls[0][0].x);

    // SuctionZone uses inverse distance: strength = force * (1 - dist/radius)
    // Closer ball gets stronger pull
    expect(forceClose).toBeGreaterThan(forceFar);
  });

  it('does not apply force when ball is outside radius', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 3,
      force: 10,
    };
    const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);
    const ball = makeMockBall(10, 10);

    zone.update(1 / 60, ball);

    expect(ball.applyForce).not.toHaveBeenCalled();
  });

  it('applies force in correct direction for arbitrary ball position', () => {
    const config = {
      position: new THREE.Vector3(5, 0, 5),
      radius: 10,
      force: 8,
    };
    const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);

    // Ball at (2, 2) — center is at (5, 5), so pull should be +x and +z
    const ball = makeMockBall(2, 2);

    zone.update(1 / 60, ball);

    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];
    expect(force.x).toBeGreaterThan(0); // pulled toward center x=5
    expect(force.z).toBeGreaterThan(0); // pulled toward center z=5
  });
});

// ---------------------------------------------------------------------------
// MovingSweeper — sweeper body position changes after update(dt)
// ---------------------------------------------------------------------------

describe('MovingSweeper physics integration', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('sweeper body position changes after update', () => {
    const config = {
      pivot: new THREE.Vector3(0, 0, 0),
      armLength: 4,
      speed: 2.0,
      size: { width: 4, height: 0.4, depth: 0.3 },
    };
    const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

    const initialX = sweeper.body.position.x;
    const initialZ = sweeper.body.position.z;

    // Update with a significant dt
    sweeper.update(0.5, null);

    // After rotation, the arm center position should have moved
    const newX = sweeper.body.position.x;
    const newZ = sweeper.body.position.z;

    // At least one coordinate should have changed
    const moved = (newX !== initialX) || (newZ !== initialZ);
    expect(moved).toBe(true);
  });

  it('sweeper rotates continuously over multiple updates', () => {
    const config = {
      pivot: new THREE.Vector3(0, 0, 0),
      armLength: 4,
      speed: Math.PI, // half revolution per second
      size: { width: 4, height: 0.4, depth: 0.3 },
    };
    const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

    const positions = [];
    for (let i = 0; i < 4; i++) {
      sweeper.update(0.25, null); // quarter-second steps
      positions.push({
        x: sweeper.body.position.x,
        z: sweeper.body.position.z,
      });
    }

    // All four positions should be different (arm sweeping around)
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      const same = (Math.abs(curr.x - prev.x) < 0.001) && (Math.abs(curr.z - prev.z) < 0.001);
      expect(same).toBe(false);
    }
  });

  it('body position stays at configured arm distance from pivot', () => {
    const pivotX = 3;
    const pivotZ = -2;
    const armLength = 5;
    const config = {
      pivot: new THREE.Vector3(pivotX, 0, pivotZ),
      armLength,
      speed: 1.5,
      size: { width: 5, height: 0.4, depth: 0.3 },
    };
    const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

    // Update several times and check distance from pivot
    for (let i = 0; i < 10; i++) {
      sweeper.update(0.1, null);
      const dx = sweeper.body.position.x - pivotX;
      const dz = sweeper.body.position.z - pivotZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Arm center is at half arm length from pivot
      expect(dist).toBeCloseTo(armLength / 2, 1);
    }
  });

  it('body position is updated via set() with same values as mesh', () => {
    const config = {
      pivot: new THREE.Vector3(0, 0, 0),
      armLength: 3,
      speed: 2.0,
      size: { width: 3, height: 0.4, depth: 0.3 },
    };
    const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

    sweeper.update(0.3, null);

    // Body position.set is called directly (and updates x/y/z)
    // Mesh position.set is also called with the same cx, y, cz values
    // Verify body.position was updated (it has a functional set)
    const halfLength = config.armLength / 2;
    const expectedAngle = 0 + config.speed * 0.3;
    const expectedX = 0 + Math.cos(expectedAngle) * halfLength;
    const expectedZ = 0 + Math.sin(expectedAngle) * halfLength;

    expect(sweeper.body.position.x).toBeCloseTo(expectedX, 5);
    expect(sweeper.body.position.z).toBeCloseTo(expectedZ, 5);
  });
});

// ---------------------------------------------------------------------------
// PortalGate — ball position matches exit position after teleport
// ---------------------------------------------------------------------------

describe('PortalGate physics integration', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('teleports ball from entry to exit position', () => {
    const config = {
      entryPosition: new THREE.Vector3(0, 0, 0),
      exitPosition: new THREE.Vector3(10, 0, -8),
      radius: 1.0,
    };
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    // Place ball at entry position
    const ball = makeMockBall(0, 0);

    portal.update(1 / 60, ball);

    // Ball should be teleported to exit position
    expect(ball.position.set).toHaveBeenCalledWith(10, SURFACE_HEIGHT + 0.3, -8);
  });

  it('preserves ball velocity through teleport', () => {
    const config = {
      entryPosition: new THREE.Vector3(0, 0, 0),
      exitPosition: new THREE.Vector3(5, 0, 5),
      radius: 1.0,
    };
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    const ball = makeMockBall(0, 0);
    ball.velocity.x = 3;
    ball.velocity.z = -2;

    portal.update(1 / 60, ball);

    // Velocity should be preserved (not zeroed out)
    expect(ball.velocity.x).toBe(3);
    expect(ball.velocity.z).toBe(-2);
  });

  it('wakes up ball after teleport', () => {
    const config = {
      entryPosition: new THREE.Vector3(0, 0, 0),
      exitPosition: new THREE.Vector3(5, 0, 5),
      radius: 1.0,
    };
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    const ball = makeMockBall(0, 0);

    portal.update(1 / 60, ball);

    expect(ball.wakeUp).toHaveBeenCalled();
  });

  it('does not teleport ball outside entry radius', () => {
    const config = {
      entryPosition: new THREE.Vector3(0, 0, 0),
      exitPosition: new THREE.Vector3(10, 0, 10),
      radius: 0.5,
    };
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    const ball = makeMockBall(5, 5); // well outside entry radius

    portal.update(1 / 60, ball);

    expect(ball.position.set).not.toHaveBeenCalled();
    expect(ball.wakeUp).not.toHaveBeenCalled();
  });

  it('respects cooldown — does not re-teleport immediately', () => {
    const config = {
      entryPosition: new THREE.Vector3(0, 0, 0),
      exitPosition: new THREE.Vector3(5, 0, 5),
      radius: 1.0,
    };
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    const ball = makeMockBall(0, 0);

    // First teleport
    portal.update(1 / 60, ball);
    expect(ball.position.set).toHaveBeenCalledTimes(1);

    // Place ball back at entry (simulating it moved back somehow)
    ball.position.x = 0;
    ball.position.z = 0;

    // Immediate retry — should be blocked by cooldown
    portal.update(1 / 60, ball);
    expect(ball.position.set).toHaveBeenCalledTimes(1); // still just 1
  });

  it('allows re-teleport after cooldown expires', () => {
    const config = {
      entryPosition: new THREE.Vector3(0, 0, 0),
      exitPosition: new THREE.Vector3(5, 0, 5),
      radius: 1.0,
    };
    const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

    const ball = makeMockBall(0, 0);

    // First teleport
    portal.update(1 / 60, ball);
    expect(ball.position.set).toHaveBeenCalledTimes(1);

    // Wait for cooldown to expire (cooldown is 1.0s)
    ball.position.x = 100; // move away during cooldown
    ball.position.z = 100;
    portal.update(1.1, ball); // large dt to expire cooldown

    // Move ball back to entry
    ball.position.x = 0;
    ball.position.z = 0;

    // Should teleport again
    portal.update(1 / 60, ball);
    expect(ball.position.set).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// LowGravityZone — ball receives upward counter-force
// ---------------------------------------------------------------------------

describe('LowGravityZone physics integration', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('applies upward counter-force reducing effective gravity', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      gravityMultiplier: 0.3, // 30% gravity remains → 70% counter
    };
    const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

    const ball = makeMockBall(0, 0);
    ball.mass = 0.45;

    zone.update(1 / 60, ball);

    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];

    // Force should be purely upward
    expect(force.x).toBe(0);
    expect(force.z).toBe(0);
    expect(force.y).toBeGreaterThan(0);

    // Expected: mass * 9.81 * (1 - 0.3) = 0.45 * 9.81 * 0.7 ≈ 3.0906
    const expected = 0.45 * 9.81 * 0.7;
    expect(force.y).toBeCloseTo(expected, 2);
  });

  it('counter-force scales with ball mass', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      gravityMultiplier: 0.5,
    };
    const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

    const lightBall = makeMockBall(0, 0);
    lightBall.mass = 0.2;
    zone.update(1 / 60, lightBall);

    const heavyBall = makeMockBall(0, 0);
    heavyBall.mass = 1.0;
    zone.update(1 / 60, heavyBall);

    const lightForce = lightBall.applyForce.mock.calls[0][0].y;
    const heavyForce = heavyBall.applyForce.mock.calls[0][0].y;

    // Heavy ball should receive proportionally more counter-force
    expect(heavyForce / lightForce).toBeCloseTo(1.0 / 0.2, 1);
  });

  it('does not apply force outside radius', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 2,
      gravityMultiplier: 0.3,
    };
    const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

    const ball = makeMockBall(10, 10);
    zone.update(1 / 60, ball);

    expect(ball.applyForce).not.toHaveBeenCalled();
  });

  it('does not apply force to sleeping ball', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      gravityMultiplier: 0.3,
    };
    const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

    const ball = makeMockBall(0, 0);
    ball.sleepState = CANNON.Body.SLEEPING;

    zone.update(1 / 60, ball);

    expect(ball.applyForce).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// BowlContour — radial force toward center scaling with distance
// ---------------------------------------------------------------------------

describe('BowlContour physics integration', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('applies inward force toward center', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      force: 6,
    };
    const bowl = new BowlContour(world, group, config, SURFACE_HEIGHT);

    // Ball at (3, 0) — force should pull toward center (negative x)
    const ball = makeMockBall(3, 0);
    bowl.update(1 / 60, ball);

    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    const force = ball.applyForce.mock.calls[0][0];
    expect(force.x).toBeLessThan(0); // toward center
    expect(force.z).toBeCloseTo(0);
    expect(force.y).toBe(0);
  });

  it('force scales with distance from center (stronger at edges)', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 10,
      force: 10,
    };
    const bowl = new BowlContour(world, group, config, SURFACE_HEIGHT);

    // Ball close to center
    const ballClose = makeMockBall(1, 0);
    bowl.update(1 / 60, ballClose);

    // Ball at edge
    const ballEdge = makeMockBall(9, 0);
    bowl.update(1 / 60, ballEdge);

    const forceClose = Math.abs(ballClose.applyForce.mock.calls[0][0].x);
    const forceEdge = Math.abs(ballEdge.applyForce.mock.calls[0][0].x);

    // BowlContour: strength = force * (dist / radius)
    // Edge ball should receive stronger force
    expect(forceEdge).toBeGreaterThan(forceClose);
  });

  it('force direction matches ball-to-center vector', () => {
    const config = {
      position: new THREE.Vector3(5, 0, 5),
      radius: 10,
      force: 8,
    };
    const bowl = new BowlContour(world, group, config, SURFACE_HEIGHT);

    // Ball at (2, 2) — center is (5, 5), so force should be +x and +z
    const ball = makeMockBall(2, 2);
    bowl.update(1 / 60, ball);

    const force = ball.applyForce.mock.calls[0][0];
    expect(force.x).toBeGreaterThan(0); // toward center x=5
    expect(force.z).toBeGreaterThan(0); // toward center z=5
  });

  it('does not apply force outside radius', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 3,
      force: 10,
    };
    const bowl = new BowlContour(world, group, config, SURFACE_HEIGHT);
    const ball = makeMockBall(20, 20);

    bowl.update(1 / 60, ball);

    expect(ball.applyForce).not.toHaveBeenCalled();
  });

  it('does not apply force to sleeping ball', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      force: 10,
    };
    const bowl = new BowlContour(world, group, config, SURFACE_HEIGHT);

    const ball = makeMockBall(2, 0);
    ball.sleepState = CANNON.Body.SLEEPING;

    bowl.update(1 / 60, ball);

    expect(ball.applyForce).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cross-mechanic: multiple mechanics affect the same ball in sequence
// ---------------------------------------------------------------------------

describe('Multiple mechanics affecting ball trajectory', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('ball receives forces from all active mechanics in a single frame', () => {
    const boost = new BoostStrip(world, group, {
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(1, 0, 0),
      force: 10,
      size: { width: 6, length: 6 },
    }, SURFACE_HEIGHT);

    const suction = new SuctionZone(world, group, {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      force: 5,
    }, SURFACE_HEIGHT);

    const lowGrav = new LowGravityZone(world, group, {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      gravityMultiplier: 0.4,
    }, SURFACE_HEIGHT);

    const bowl = new BowlContour(world, group, {
      position: new THREE.Vector3(0, 0, 0),
      radius: 5,
      force: 3,
    }, SURFACE_HEIGHT);

    // Place ball at (2, 0) — inside all zones
    const ball = makeMockBall(2, 0);

    boost.update(1 / 60, ball);
    suction.update(1 / 60, ball);
    lowGrav.update(1 / 60, ball);
    bowl.update(1 / 60, ball);

    // All four should have applied force
    expect(ball.applyForce).toHaveBeenCalledTimes(4);

    // BoostStrip: positive x direction
    expect(ball.applyForce.mock.calls[0][0].x).toBeCloseTo(10);
    // SuctionZone: negative x (toward center)
    expect(ball.applyForce.mock.calls[1][0].x).toBeLessThan(0);
    // LowGravityZone: upward force
    expect(ball.applyForce.mock.calls[2][0].y).toBeGreaterThan(0);
    // BowlContour: negative x (toward center)
    expect(ball.applyForce.mock.calls[3][0].x).toBeLessThan(0);
  });
});
