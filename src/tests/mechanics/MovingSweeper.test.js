/**
 * Unit tests for MovingSweeper mechanic
 * ISSUE-003
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { MovingSweeper } from '../../mechanics/MovingSweeper';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js for MovingSweeper tests
// ---------------------------------------------------------------------------

beforeAll(() => {
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

  // Quaternion is not mocked in setup.js, define it as a constructor
  CANNON.Quaternion = jest.fn(() => ({
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    setFromAxisAngle: jest.fn(),
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
        }),
      },
      rotation: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1, copy: jest.fn() },
      castShadow: false,
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() },
    };
    mesh.parent = null;
    return mesh;
  });

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, dispose: jest.fn() };
    if (opts) Object.assign(mat, opts);
    return mat;
  });

  THREE.BoxGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
  THREE.CylinderGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    bumperMaterial: { id: 'bumper' },
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

function makeConfig(overrides = {}) {
  return {
    pivot: { x: 0, y: 0, z: 0 },
    armLength: 4,
    speed: 2,
    size: { width: 4, height: 0.4, depth: 0.3 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MovingSweeper
// ---------------------------------------------------------------------------

describe('MovingSweeper', () => {
  let world, group, config;
  const surfaceHeight = 0.2;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    config = makeConfig();
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a kinematic CANNON body added to the world', () => {
      const sweeper = new MovingSweeper(world, group, config, surfaceHeight);

      expect(sweeper.bodies).toHaveLength(1);
      expect(world.addBody).toHaveBeenCalledTimes(1);
      expect(world.addBody).toHaveBeenCalledWith(sweeper.body);
    });

    it('creates meshes (arm + pivot post) added to the group', () => {
      const sweeper = new MovingSweeper(world, group, config, surfaceHeight);

      // arm mesh + pivot post = 2 meshes
      expect(sweeper.meshes).toHaveLength(2);
      expect(group.add).toHaveBeenCalledTimes(2);
    });

    it('positions the arm mesh at the pivot point initially', () => {
      const pivotConfig = makeConfig({ pivot: { x: 3, y: 0, z: -5 } });
      const sweeper = new MovingSweeper(world, group, pivotConfig, surfaceHeight);

      expect(sweeper.mesh.position.x).toBe(3);
      expect(sweeper.mesh.position.z).toBe(-5);
    });

    it('positions the body at the same location as the mesh', () => {
      const pivotConfig = makeConfig({ pivot: { x: 2, y: 0, z: 7 } });
      const sweeper = new MovingSweeper(world, group, pivotConfig, surfaceHeight);

      expect(sweeper.body.position.x).toBe(sweeper.mesh.position.x);
      expect(sweeper.body.position.z).toBe(sweeper.mesh.position.z);
    });

    it('sets body userData type to moving_sweeper', () => {
      const sweeper = new MovingSweeper(world, group, config, surfaceHeight);

      expect(sweeper.body.userData).toEqual({ type: 'moving_sweeper' });
    });

    it('stores arm length from config', () => {
      const sweeper = new MovingSweeper(world, group, makeConfig({ armLength: 6 }), surfaceHeight);

      expect(sweeper.armLength).toBe(6);
    });

    it('stores speed from config', () => {
      const sweeper = new MovingSweeper(world, group, makeConfig({ speed: 3.5 }), surfaceHeight);

      expect(sweeper.speed).toBe(3.5);
    });

    it('uses default values when config fields are missing', () => {
      const minimal = {};
      const sweeper = new MovingSweeper(world, group, minimal, surfaceHeight);

      expect(sweeper.armLength).toBe(3); // default
      expect(sweeper.speed).toBe(1.5); // default
      expect(sweeper.angle).toBe(0); // default phase
    });
  });

  // --- Phase offset ---

  describe('phase offset', () => {
    it('sets initial angle from phase config', () => {
      const phaseConfig = makeConfig({ phase: Math.PI / 4 });
      const sweeper = new MovingSweeper(world, group, phaseConfig, surfaceHeight);

      expect(sweeper.angle).toBe(Math.PI / 4);
    });

    it('defaults to 0 when no phase is specified', () => {
      const sweeper = new MovingSweeper(world, group, config, surfaceHeight);

      expect(sweeper.angle).toBe(0);
    });

    it('applies phase offset to first update position', () => {
      const phaseConfig = makeConfig({ phase: Math.PI / 2, pivot: { x: 0, y: 0, z: 0 }, armLength: 4 });
      const sweeper = new MovingSweeper(world, group, phaseConfig, surfaceHeight);

      // After one update with dt=0, angle stays at phase
      sweeper.update(0, null);

      const halfLength = 4 / 2;
      const expectedX = Math.cos(Math.PI / 2) * halfLength;
      const expectedZ = Math.sin(Math.PI / 2) * halfLength;

      expect(sweeper.mesh.position.x).toBeCloseTo(expectedX, 5);
      expect(sweeper.mesh.position.z).toBeCloseTo(expectedZ, 5);
    });
  });

  // --- update ---

  describe('update(dt)', () => {
    it('increments the angle by speed * dt', () => {
      const sweeper = new MovingSweeper(world, group, makeConfig({ speed: 2, phase: 0 }), surfaceHeight);

      sweeper.update(0.5, null);
      expect(sweeper.angle).toBeCloseTo(1.0, 5);

      sweeper.update(0.25, null);
      expect(sweeper.angle).toBeCloseTo(1.5, 5);
    });

    it('rotates the arm around the pivot at configured speed', () => {
      const pivotConfig = makeConfig({ pivot: { x: 0, y: 0, z: 0 }, armLength: 4, speed: Math.PI });
      const sweeper = new MovingSweeper(world, group, pivotConfig, surfaceHeight);

      // After 1 second at PI rad/s, angle = PI
      sweeper.update(1.0, null);

      const halfLength = 4 / 2;
      const expectedX = Math.cos(Math.PI) * halfLength; // -2
      const expectedZ = Math.sin(Math.PI) * halfLength; // ~0

      expect(sweeper.mesh.position.x).toBeCloseTo(expectedX, 5);
      expect(sweeper.mesh.position.z).toBeCloseTo(expectedZ, 5);
    });

    it('syncs the physics body position to match the mesh', () => {
      const sweeper = new MovingSweeper(world, group, config, surfaceHeight);

      sweeper.update(0.1, null);

      expect(sweeper.body.position.x).toBe(sweeper.mesh.position.x);
      expect(sweeper.body.position.z).toBe(sweeper.mesh.position.z);
    });

    it('updates the mesh rotation to match the current angle', () => {
      const sweeper = new MovingSweeper(world, group, makeConfig({ speed: 1, phase: 0 }), surfaceHeight);

      sweeper.update(0.5, null);

      // mesh.rotation.y should be -angle
      expect(sweeper.mesh.rotation.y).toBeCloseTo(-0.5, 5);
    });

    it('handles zero dt without changing angle', () => {
      const sweeper = new MovingSweeper(world, group, makeConfig({ phase: 1.0 }), surfaceHeight);

      sweeper.update(0, null);

      expect(sweeper.angle).toBe(1.0);
    });

    it('does not throw when ballBody is null', () => {
      const sweeper = new MovingSweeper(world, group, config, surfaceHeight);

      expect(() => sweeper.update(0.016, null)).not.toThrow();
    });

    it('correctly offsets from non-zero pivot', () => {
      const pivotConfig = makeConfig({ pivot: { x: 5, y: 0, z: 3 }, armLength: 2, speed: 0, phase: 0 });
      const sweeper = new MovingSweeper(world, group, pivotConfig, surfaceHeight);

      sweeper.update(0, null);

      // At angle 0, arm center is at pivot.x + cos(0)*1, pivot.z + sin(0)*1
      expect(sweeper.mesh.position.x).toBeCloseTo(5 + 1, 5);
      expect(sweeper.mesh.position.z).toBeCloseTo(3 + 0, 5);
    });
  });

  // --- Arm length ---

  describe('arm length', () => {
    it('controls distance from pivot to sweeper body center', () => {
      const config6 = makeConfig({ pivot: { x: 0, y: 0, z: 0 }, armLength: 6, speed: 0, phase: 0 });
      const sweeper = new MovingSweeper(world, group, config6, surfaceHeight);

      sweeper.update(0, null);

      // At angle 0, center should be at halfLength = 3 along x
      expect(sweeper.mesh.position.x).toBeCloseTo(3, 5);
      expect(sweeper.mesh.position.z).toBeCloseTo(0, 5);
    });

    it('shorter arm length keeps sweeper closer to pivot', () => {
      const shortConfig = makeConfig({ pivot: { x: 0, y: 0, z: 0 }, armLength: 2, speed: 0, phase: 0 });
      const sweeper = new MovingSweeper(world, group, shortConfig, surfaceHeight);

      sweeper.update(0, null);

      expect(sweeper.mesh.position.x).toBeCloseTo(1, 5);
      expect(sweeper.mesh.position.z).toBeCloseTo(0, 5);
    });
  });

  // --- destroy ---

  describe('destroy', () => {
    it('removes all meshes and disposes geometry/materials', () => {
      const sweeper = new MovingSweeper(world, group, config, surfaceHeight);
      const meshCount = sweeper.meshes.length;

      expect(meshCount).toBe(2);

      sweeper.destroy();

      expect(sweeper.meshes).toEqual([]);
    });

    it('removes all bodies from the world', () => {
      const sweeper = new MovingSweeper(world, group, config, surfaceHeight);

      expect(sweeper.bodies).toHaveLength(1);

      sweeper.destroy();

      expect(world.removeBody).toHaveBeenCalledWith(sweeper.body);
      expect(sweeper.bodies).toEqual([]);
    });

    it('can be called multiple times without error', () => {
      const sweeper = new MovingSweeper(world, group, config, surfaceHeight);

      sweeper.destroy();
      expect(() => sweeper.destroy()).not.toThrow();
    });
  });

  // --- Registry ---

  describe('registry', () => {
    it('registers with MechanicRegistry as moving_sweeper', () => {
      const types = getRegisteredTypes();

      expect(types).toContain('moving_sweeper');
    });
  });
});
