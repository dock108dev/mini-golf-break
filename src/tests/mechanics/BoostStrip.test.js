/**
 * Unit tests for BoostStrip mechanic
 * ISSUE-043
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

const SLEEPING = 2;

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Body.SLEEPING = SLEEPING;

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
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn(), setFromAxisAngle: jest.fn() },
    addShape: jest.fn(),
    userData: {}
  }));

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
      castShadow: false,
      visible: true,
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn(), transparent: true, opacity: 0.6 }
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

  THREE.PlaneGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
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
    applyForce: jest.fn(),
    wakeUp: jest.fn()
  };
}

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoostStrip', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    position: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: -1 },
    force: 10,
    size: { width: 2, length: 4 }
  };

  // --- Registry ---

  describe('registry', () => {
    it('is registered as boost_strip in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('boost_strip');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a visual mesh and adds it to the group', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.meshes).toHaveLength(1);
      expect(group.add).toHaveBeenCalled();
    });

    it('creates a trigger physics body', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.bodies).toHaveLength(1);
      expect(world.addBody).toHaveBeenCalledWith(strip.triggerBody);
    });

    it('sets isForceField to true', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.isForceField).toBe(true);
    });

    it('computes direction force vector from config', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.direction.z).toBeCloseTo(-10);
      expect(strip.direction.x).toBeCloseTo(0);
    });

    it('uses defaults when config fields are missing', () => {
      const strip = new BoostStrip(world, group, {}, SURFACE_HEIGHT);

      expect(strip.meshes).toHaveLength(1);
      expect(strip.bodies).toHaveLength(1);
    });

    it('initializes boost sound cooldown to zero', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.boostSoundCooldown).toBe(0);
    });

    it('sets trigger body userData type to boost_strip', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.triggerBody.userData.type).toBe('boost_strip');
    });

    it('applies theme color when no config color is set', () => {
      const theme = { mechanics: { boostStrip: { color: 0x123456 } } };
      new BoostStrip(world, group, { ...defaultConfig, color: undefined }, SURFACE_HEIGHT, theme);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x123456 })
      );
    });
  });

  // --- Update ---

  describe('update', () => {
    it('applies directional force when ball is in zone', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(strip.triggerBody.position.x, strip.triggerBody.position.z);

      strip.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalledWith(strip.direction);
    });

    it('does not apply force when ball is outside zone', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(100, 100);

      strip.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('wakes sleeping ball in zone', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(strip.triggerBody.position.x, strip.triggerBody.position.z);
      ball.sleepState = SLEEPING;

      strip.update(0.016, ball);

      expect(ball.wakeUp).toHaveBeenCalled();
      expect(ball.applyForce).toHaveBeenCalledWith(strip.direction);
    });

    it('does not throw when ballBody is null', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(() => strip.update(0.016, null)).not.toThrow();
    });

    it('decrements boost sound cooldown over time', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      strip.boostSoundCooldown = 0.3;

      strip.update(0.1, null);

      expect(strip.boostSoundCooldown).toBeCloseTo(0.2);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up meshes and bodies', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.meshes).toHaveLength(1);
      expect(strip.bodies).toHaveLength(1);

      strip.destroy();

      expect(strip.meshes).toEqual([]);
      expect(strip.bodies).toEqual([]);
      expect(world.removeBody).toHaveBeenCalled();
    });

    it('can be called multiple times without error', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      strip.destroy();
      expect(() => strip.destroy()).not.toThrow();
    });
  });
});
