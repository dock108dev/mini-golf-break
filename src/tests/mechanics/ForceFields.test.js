/**
 * Unit tests for force field mechanics
 * ISSUE-002
 *
 * Covers: BoostStrip, SuctionZone, LowGravityZone, BowlContour
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { SuctionZone } from '../../mechanics/SuctionZone';
import { LowGravityZone } from '../../mechanics/LowGravityZone';
import { BowlContour } from '../../mechanics/BowlContour';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js for force field tests
// ---------------------------------------------------------------------------

beforeAll(() => {
  // Vec3 needs scale() for BoostStrip constructor
  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    scale: s => ({ x: x * s, y: y * s, z: z * s })
  }));

  // Body needs position.set for BoostStrip trigger body
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
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn(), setFromAxisAngle: jest.fn() },
    addShape: jest.fn(),
    userData: {}
  }));

  // MeshStandardMaterial needs to pass through constructor opts
  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, roughness: 0.3, metalness: 0.2, dispose: jest.fn() };
    if (opts) {
      Object.assign(mat, opts);
    }
    return mat;
  });

  // Geometry constructors need dispose()
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
    step: jest.fn()
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

function makeMockBall(x = 0, z = 0, mass = 0.45) {
  return {
    position: { x, y: 0.2, z },
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    mass,
    sleepState: 0, // AWAKE (numeric, not CANNON.Body.AWAKE which is undefined in mock)
    applyForce: jest.fn()
  };
}

const SURFACE_HEIGHT = 0.2;

// CANNON.Body.SLEEPING is undefined in mock; source code checks
// ballBody.sleepState === CANNON.Body.SLEEPING, so we use undefined to match
const SLEEPING = CANNON.Body.SLEEPING;

// ---------------------------------------------------------------------------
// BoostStrip
// ---------------------------------------------------------------------------

describe('BoostStrip', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    position: new THREE.Vector3(0, 0, 0),
    boost_direction: new THREE.Vector3(0, 0, -1),
    boost_magnitude: 10,
    size: { width: 2, length: 4 }
  };

  describe('constructor', () => {
    it('creates a visual mesh and adds it to the group', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(strip.meshes).toHaveLength(1);
      expect(group.add).toHaveBeenCalled();
    });

    it('creates a semi-transparent visual mesh', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const mat = strip.mesh.material;
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBeLessThan(1);
    });

    it('creates a trigger physics body', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(strip.bodies).toHaveLength(1);
      expect(world.addBody).toHaveBeenCalledWith(strip.triggerBody);
    });

    it('normalizes boost_direction and stores boost_magnitude', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(strip._boostDir.x).toBeCloseTo(0);
      expect(strip._boostDir.z).toBeCloseTo(-1);
      expect(strip._boostMagnitude).toBe(10);
    });

    it('uses defaults when config fields are missing', () => {
      const strip = new BoostStrip(world, group, {}, SURFACE_HEIGHT);
      expect(strip.meshes).toHaveLength(1);
      expect(strip.bodies).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('adds velocity impulse when ball is in zone', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(strip.triggerBody.position.x, strip.triggerBody.position.z);

      strip.update(0.016, ball);

      // boost_direction [0,0,-1] * boost_magnitude 10 → velocity.z -= 10
      expect(ball.velocity.z).toBeCloseTo(-10);
    });

    it('does not modify velocity when ball is outside zone', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(100, 100);

      strip.update(0.016, ball);

      expect(ball.velocity.z).toBe(0);
    });

    it('wakes sleeping ball in zone and applies impulse', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(strip.triggerBody.position.x, strip.triggerBody.position.z);
      ball.sleepState = SLEEPING;
      ball.wakeUp = jest.fn();

      strip.update(0.016, ball);

      expect(ball.wakeUp).toHaveBeenCalled();
      expect(ball.velocity.z).toBeCloseTo(-10);
    });

    it('does not throw when ballBody is null', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(() => strip.update(0.016, null)).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('cleans up meshes and bodies', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(strip.meshes).toHaveLength(1);
      expect(strip.bodies).toHaveLength(1);

      strip.destroy();

      expect(strip.meshes).toHaveLength(0);
      expect(strip.bodies).toHaveLength(0);
      expect(world.removeBody).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// SuctionZone
// ---------------------------------------------------------------------------

describe('SuctionZone', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    position: new THREE.Vector3(0, 0, 0),
    radius: 5,
    force: 10
  };

  describe('constructor', () => {
    it('creates a semi-transparent visual mesh', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(zone.meshes).toHaveLength(1);
      expect(group.add).toHaveBeenCalled();
      expect(zone.mesh.material.transparent).toBe(true);
    });

    it('stores center and radius from config', () => {
      const config = {
        position: new THREE.Vector3(3, 0, -4),
        radius: 7,
        force: 5
      };
      const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);
      expect(zone.centerX).toBe(3);
      expect(zone.centerZ).toBe(-4);
      expect(zone.radius).toBe(7);
      expect(zone.force).toBe(5);
    });
  });

  describe('update', () => {
    it('applies radial pull toward center when ball is in zone', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(3, 0);

      zone.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalledTimes(1);
      const force = ball.applyForce.mock.calls[0][0];
      expect(force.x).toBeLessThan(0);
      expect(force.y).toBe(0);
    });

    it('changes force direction based on ball position', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      const ball1 = makeMockBall(3, 0);
      zone.update(0.016, ball1);
      const force1 = ball1.applyForce.mock.calls[0][0];

      const ball2 = makeMockBall(-3, 0);
      zone.update(0.016, ball2);
      const force2 = ball2.applyForce.mock.calls[0][0];

      expect(Math.sign(force1.x)).toBe(-Math.sign(force2.x));
    });

    it('does not apply force when ball is outside zone', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(100, 100);

      zone.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not apply force when ball is very close to center (distSq < 0.01)', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(0, 0);

      zone.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('force magnitude is constant (suction_force * mass) regardless of distance', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      const ballClose = makeMockBall(1, 0);
      zone.update(0.016, ballClose);
      const forceClose = ballClose.applyForce.mock.calls[0][0];

      const ballFar = makeMockBall(4, 0);
      zone.update(0.016, ballFar);
      const forceFar = ballFar.applyForce.mock.calls[0][0];

      // Constant force: same magnitude at different distances
      expect(Math.abs(forceClose.x)).toBeCloseTo(Math.abs(forceFar.x), 5);
      // Magnitude equals force * mass
      const expectedMagnitude = defaultConfig.force * 0.45;
      expect(Math.abs(forceClose.x)).toBeCloseTo(expectedMagnitude, 5);
    });

    it('wakes sleeping ball in zone and applies force', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(2, 0);
      ball.sleepState = SLEEPING;
      ball.wakeUp = jest.fn();

      zone.update(0.016, ball);

      expect(ball.wakeUp).toHaveBeenCalled();
      expect(ball.applyForce).toHaveBeenCalled();
    });

    it('does not throw when ballBody is null', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(() => zone.update(0.016, null)).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('cleans up meshes', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      zone.destroy();
      expect(zone.meshes).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// LowGravityZone
// ---------------------------------------------------------------------------

describe('LowGravityZone', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    position: new THREE.Vector3(0, 0, 0),
    radius: 3,
    gravity_fraction: 0.3
  };

  describe('constructor', () => {
    it('creates a semi-transparent visual mesh', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(zone.meshes).toHaveLength(1);
      expect(zone.mesh.material.transparent).toBe(true);
    });

    it('computes counter-force from gravity_fraction', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(zone.counterForce).toBeCloseTo(9.82 * 0.7);
    });

    it('handles gravity_fraction near 0 (nearly full counter)', () => {
      const config = { ...defaultConfig, gravity_fraction: 0.01 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);
      expect(zone.counterForce).toBeCloseTo(9.82 * 0.99);
    });

    it('handles gravity_fraction of 1 (no reduction)', () => {
      const config = { ...defaultConfig, gravity_fraction: 1 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);
      expect(zone.counterForce).toBeCloseTo(0);
    });
  });

  describe('update', () => {
    it('applies upward counter-gravity force when ball is in zone', () => {
      const config = { ...defaultConfig, radius: 5 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);
      const ball = makeMockBall(1, 1, 0.45);

      zone.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalledTimes(1);
      const force = ball.applyForce.mock.calls[0][0];
      expect(force.x).toBe(0);
      expect(force.y).toBeGreaterThan(0);
      expect(force.z).toBe(0);
      expect(force.y).toBeCloseTo(0.45 * 9.82 * 0.7);
    });

    it('does not apply force when ball is outside zone', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(100, 100);

      zone.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not apply force when ball is sleeping', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(0, 0);
      ball.sleepState = SLEEPING;

      zone.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not throw when ballBody is null', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(() => zone.update(0.016, null)).not.toThrow();
    });

    it('force scales with ball mass', () => {
      const config = { ...defaultConfig, radius: 5 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

      const lightBall = makeMockBall(1, 0, 0.2);
      zone.update(0.016, lightBall);
      const lightForce = lightBall.applyForce.mock.calls[0][0].y;

      const heavyBall = makeMockBall(1, 0, 1.0);
      zone.update(0.016, heavyBall);
      const heavyForce = heavyBall.applyForce.mock.calls[0][0].y;

      expect(heavyForce).toBeGreaterThan(lightForce);
      expect(heavyForce / lightForce).toBeCloseTo(1.0 / 0.2);
    });
  });

  describe('destroy', () => {
    it('cleans up meshes', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);
      zone.destroy();
      expect(zone.meshes).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// BowlContour
// ---------------------------------------------------------------------------

describe('BowlContour', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    position: new THREE.Vector3(0, 0, 0),
    radius: 4,
    force: 5
  };

  describe('constructor', () => {
    it('creates a semi-transparent visual mesh', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(bowl.meshes).toHaveLength(1);
      expect(bowl.mesh.material.transparent).toBe(true);
      expect(bowl.mesh.material.opacity).toBeLessThan(1);
    });

    it('stores center and radius from config', () => {
      const config = {
        position: new THREE.Vector3(2, 0, -3),
        radius: 6,
        force: 8
      };
      const bowl = new BowlContour(world, group, config, SURFACE_HEIGHT);
      expect(bowl.centerX).toBe(2);
      expect(bowl.centerZ).toBe(-3);
      expect(bowl.radius).toBe(6);
      expect(bowl.force).toBe(8);
    });
  });

  describe('update', () => {
    it('applies force toward center when ball is in zone', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(3, 0);

      bowl.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalledTimes(1);
      const force = ball.applyForce.mock.calls[0][0];
      expect(force.x).toBeLessThan(0);
      expect(force.y).toBe(0);
    });

    it('force direction is always toward center', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);

      const ball1 = makeMockBall(3, 0);
      bowl.update(0.016, ball1);
      const f1 = ball1.applyForce.mock.calls[0][0];

      const ball2 = makeMockBall(-3, 0);
      bowl.update(0.016, ball2);
      const f2 = ball2.applyForce.mock.calls[0][0];

      expect(f1.x).toBeLessThan(0);
      expect(f2.x).toBeGreaterThan(0);
    });

    it('force scales with distance from center (stronger at edges)', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);

      const ballNear = makeMockBall(1, 0);
      bowl.update(0.016, ballNear);
      const forceNear = ballNear.applyForce.mock.calls[0][0];

      const ballEdge = makeMockBall(3.5, 0);
      bowl.update(0.016, ballEdge);
      const forceEdge = ballEdge.applyForce.mock.calls[0][0];

      expect(Math.abs(forceEdge.x)).toBeGreaterThan(Math.abs(forceNear.x));
    });

    it('does not apply force when ball is outside zone', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(100, 100);

      bowl.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not apply force when ball is very close to center (distSq < 0.01)', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(0, 0);

      bowl.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not apply force when ball is sleeping', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeMockBall(2, 0);
      ball.sleepState = SLEEPING;

      bowl.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not throw when ballBody is null', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(() => bowl.update(0.016, null)).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('cleans up meshes', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      bowl.destroy();
      expect(bowl.meshes).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Registry registration
// ---------------------------------------------------------------------------

describe('Force field registry registration', () => {
  it('all force field types are registered in MechanicRegistry', () => {
    const types = getRegisteredTypes();
    expect(types).toContain('boost_strip');
    expect(types).toContain('suction_zone');
    expect(types).toContain('low_gravity_zone');
    expect(types).toContain('bowl_contour');
  });
});
