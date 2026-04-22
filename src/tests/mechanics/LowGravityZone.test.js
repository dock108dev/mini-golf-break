/**
 * Unit tests for LowGravityZone mechanic
 * ISSUE-025
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { LowGravityZone } from '../../mechanics/LowGravityZone';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

const SLEEPING = 2;
const GRAVITY = 9.82;

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Body.SLEEPING = SLEEPING;

  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({ x, y, z }));

  THREE.Mesh.mockImplementation(() => {
    const mesh = {
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
      rotation: { x: 0, y: 0, z: 0 },
      visible: true,
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn(), transparent: true, opacity: 0.25 }
    };
    mesh.parent = null;
    return mesh;
  });

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, dispose: jest.fn() };
    if (opts) {
      Object.assign(mat, opts);
    }
    return mat;
  });

  THREE.CircleGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn()
  };
}

function makeMockGroup() {
  const children = [];
  return {
    add: jest.fn(child => children.push(child)),
    remove: jest.fn(),
    children
  };
}

function makeBallBody(x = 0, y = 0.2, z = 0, mass = 0.45) {
  return {
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    mass,
    sleepState: 0,
    applyForce: jest.fn()
  };
}

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LowGravityZone', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    position: { x: 0, y: 0, z: 0 },
    radius: 3,
    gravity_fraction: 0.25
  };

  // --- Registry ---

  describe('registry', () => {
    it('is registered as low_gravity_zone in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('low_gravity_zone');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a visual mesh and adds it to the group', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(zone.meshes).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
    });

    it('creates no physics bodies', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(zone.bodies).toHaveLength(0);
    });

    it('sets isForceField to true', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(zone.isForceField).toBe(true);
    });

    it('computes counter-force from gravity_fraction 0.25 → 75% of 9.82 upward', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(zone.counterForce).toBeCloseTo(GRAVITY * 0.75);
    });

    it('handles gravity_fraction of 1 (no counter force)', () => {
      const config = { ...defaultConfig, gravity_fraction: 1 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

      expect(zone.counterForce).toBeCloseTo(0);
    });

    it('handles small gravity_fraction near 0 (nearly full counter)', () => {
      const config = { ...defaultConfig, gravity_fraction: 0.01 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

      expect(zone.counterForce).toBeCloseTo(GRAVITY * 0.99);
    });

    it('uses default gravity_fraction 0.25 when omitted', () => {
      const zone = new LowGravityZone(world, group, { radius: 3 }, SURFACE_HEIGHT);

      expect(zone.counterForce).toBeCloseTo(GRAVITY * 0.75);
    });

    it('uses default radius 2 when config is minimal', () => {
      const zone = new LowGravityZone(world, group, {}, SURFACE_HEIGHT);

      expect(zone.radius).toBe(2);
    });

    it('applies theme color when no config color is set', () => {
      const theme = { mechanics: { lowGravityZone: { color: 0x112233 } } };
      new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT, theme);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x112233 })
      );
    });
  });

  // --- Update: force application ---

  describe('update', () => {
    it('applies upward counter-gravity force when ball is inside zone', () => {
      const config = { ...defaultConfig, radius: 5 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);
      const ball = makeBallBody(1, 0.2, 1, 0.45);

      zone.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalledTimes(1);
      const force = ball.applyForce.mock.calls[0][0];
      expect(force.x).toBe(0);
      expect(force.y).toBeGreaterThan(0);
      expect(force.z).toBe(0);
      // F = mass * (1 - gravity_fraction) * 9.82
      expect(force.y).toBeCloseTo(0.45 * GRAVITY * 0.75);
    });

    it('effective downward acceleration equals gravity_fraction * 9.82', () => {
      // Net acceleration = gravity - counterForce/mass = g - (1-f)*g = f*g
      const gravFraction = 0.25;
      const mass = 0.45;
      const config = { ...defaultConfig, gravity_fraction: gravFraction, radius: 5 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);
      const ball = makeBallBody(0, 0.2, 0, mass);

      zone.update(1 / 60, ball);

      const upForce = ball.applyForce.mock.calls[0][0].y;
      // net downward accel = g - upForce/mass
      const netDownAccel = GRAVITY - upForce / mass;
      expect(netDownAccel).toBeCloseTo(gravFraction * GRAVITY, 5);
    });

    it('does not apply force when ball is outside zone (XZ plane)', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(100, 0.2, 100);

      zone.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not apply force when ball is outside zone vertically (3D sphere check)', () => {
      // Ball is within XZ radius but far above center
      const config = { position: { x: 0, y: 0, z: 0 }, radius: 2, gravity_fraction: 0.25 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);
      // XZ distance = 0 but Y distance = 10 > radius 2
      const ball = makeBallBody(0, 10, 0);

      zone.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('applies force when ball is inside sphere but off the green plane', () => {
      // Ball slightly above zone center, within radius
      const config = { position: { x: 0, y: 1, z: 0 }, radius: 3, gravity_fraction: 0.25 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);
      const ball = makeBallBody(0, 2, 0); // dy=1, within radius 3

      zone.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalledTimes(1);
    });

    it('does not apply force when ball is sleeping', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(0, 0.2, 0);
      ball.sleepState = SLEEPING;

      zone.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not throw when ballBody is null', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(() => zone.update(0.016, null)).not.toThrow();
    });

    it('force scales proportionally with ball mass', () => {
      const config = { ...defaultConfig, radius: 5 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

      const lightBall = makeBallBody(1, 0.2, 0, 0.2);
      zone.update(0.016, lightBall);
      const lightForce = lightBall.applyForce.mock.calls[0][0].y;

      const heavyBall = makeBallBody(1, 0.2, 0, 1.0);
      zone.update(0.016, heavyBall);
      const heavyForce = heavyBall.applyForce.mock.calls[0][0].y;

      expect(heavyForce).toBeGreaterThan(lightForce);
      expect(heavyForce / lightForce).toBeCloseTo(1.0 / 0.2, 5);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up meshes', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      zone.destroy();

      expect(zone.meshes).toEqual([]);
    });

    it('holds no references to ball body after destroy', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      zone.destroy();

      // LowGravityZone must not cache a ballBody reference — it receives it per-frame
      expect(zone._ballBody).toBeUndefined();
    });

    it('can be called multiple times without error', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      zone.destroy();
      expect(() => zone.destroy()).not.toThrow();
    });
  });
});
