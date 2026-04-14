/**
 * Unit tests for LowGravityZone mechanic
 * ISSUE-043
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { LowGravityZone } from '../../mechanics/LowGravityZone';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

const SLEEPING = 2;

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

function makeBallBody(x = 0, z = 0, mass = 0.45) {
  return {
    position: { x, y: 0.2, z },
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
    gravityMultiplier: 0.3
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

    it('computes counter-force from gravity multiplier', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(zone.counterForce).toBeCloseTo(9.81 * 0.7);
    });

    it('handles zero gravity multiplier (full counter)', () => {
      const config = { ...defaultConfig, gravityMultiplier: 0 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

      expect(zone.counterForce).toBeCloseTo(9.81);
    });

    it('handles gravityMultiplier of 1 (no reduction)', () => {
      const config = { ...defaultConfig, gravityMultiplier: 1 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);

      expect(zone.counterForce).toBeCloseTo(0);
    });

    it('uses default values when config is minimal', () => {
      const zone = new LowGravityZone(world, group, {}, SURFACE_HEIGHT);

      expect(zone.radius).toBe(2);
      expect(zone.counterForce).toBeCloseTo(9.81 * 0.7);
    });

    it('applies theme color when no config color is set', () => {
      const theme = { mechanics: { lowGravityZone: { color: 0x112233 } } };
      new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT, theme);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x112233 })
      );
    });
  });

  // --- Update ---

  describe('update', () => {
    it('applies upward counter-gravity force when ball is in zone', () => {
      const config = { ...defaultConfig, radius: 5 };
      const zone = new LowGravityZone(world, group, config, SURFACE_HEIGHT);
      const ball = makeBallBody(1, 1, 0.45);

      zone.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalledTimes(1);
      const force = ball.applyForce.mock.calls[0][0];
      expect(force.x).toBe(0);
      expect(force.y).toBeGreaterThan(0);
      expect(force.z).toBe(0);
      expect(force.y).toBeCloseTo(0.45 * 9.81 * 0.7);
    });

    it('does not apply force when ball is outside zone', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(100, 100);

      zone.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not apply force when ball is sleeping', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(0, 0);
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

      const lightBall = makeBallBody(1, 0, 0.2);
      zone.update(0.016, lightBall);
      const lightForce = lightBall.applyForce.mock.calls[0][0].y;

      const heavyBall = makeBallBody(1, 0, 1.0);
      zone.update(0.016, heavyBall);
      const heavyForce = heavyBall.applyForce.mock.calls[0][0].y;

      expect(heavyForce).toBeGreaterThan(lightForce);
      expect(heavyForce / lightForce).toBeCloseTo(1.0 / 0.2);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up meshes', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      zone.destroy();

      expect(zone.meshes).toEqual([]);
    });

    it('can be called multiple times without error', () => {
      const zone = new LowGravityZone(world, group, defaultConfig, SURFACE_HEIGHT);

      zone.destroy();
      expect(() => zone.destroy()).not.toThrow();
    });
  });
});
