/**
 * Unit tests for BankWall mechanic
 * ISSUE-043
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BankWall } from '../../mechanics/BankWall';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Body.STATIC = 0;

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
    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      set: jest.fn(),
      copy: jest.fn(),
      setFromAxisAngle: jest.fn()
    },
    mass: 0,
    type: CANNON.Body.STATIC,
    addShape: jest.fn(),
    userData: {}
  }));

  CANNON.Quaternion = jest.fn(() => ({
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    setFromAxisAngle: jest.fn()
  }));

  THREE.Mesh.mockImplementation(function (geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    };
    this.rotation = { x: 0, y: 0, z: 0, set: jest.fn() };
    this.castShadow = false;
    this.userData = {};
    return this;
  });

  THREE.BoxGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, dispose: jest.fn() };
    if (opts) {
      Object.assign(mat, opts);
    }
    mat.clone = jest.fn(() => ({ ...mat, clone: mat.clone }));
    return mat;
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    bumperMaterial: { id: 'bumper' }
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

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BankWall', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  // --- Registry ---

  describe('registry', () => {
    it('is registered as bank_wall in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('bank_wall');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a mesh and physics body per segment', () => {
      const config = {
        segments: [{ start: { x: -2, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(wall.meshes).toHaveLength(1);
      expect(wall.bodies).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
      expect(world.addBody).toHaveBeenCalledTimes(1);
    });

    it('creates multiple segments', () => {
      const config = {
        segments: [
          { start: { x: -2, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } },
          { start: { x: 0, y: 0, z: -3 }, end: { x: 0, y: 0, z: 3 } },
          { start: { x: -1, y: 0, z: -1 }, end: { x: 1, y: 0, z: 1 } }
        ]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(wall.meshes).toHaveLength(3);
      expect(wall.bodies).toHaveLength(3);
      expect(group.add).toHaveBeenCalledTimes(3);
      expect(world.addBody).toHaveBeenCalledTimes(3);
    });

    it('skips segments with zero length', () => {
      const config = {
        segments: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 } }]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(wall.meshes).toHaveLength(0);
      expect(wall.bodies).toHaveLength(0);
    });

    it('positions wall at correct Y height', () => {
      const config = {
        segments: [{ start: { x: -2, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }],
        height: 0.6
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(wall.meshes[0].position.y).toBeCloseTo(SURFACE_HEIGHT + 0.3);
    });

    it('positions at midpoint of segment', () => {
      const config = {
        segments: [{ start: { x: -3, y: 0, z: 2 }, end: { x: 5, y: 0, z: 2 } }]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(wall.meshes[0].position.x).toBeCloseTo(1);
      expect(wall.meshes[0].position.z).toBeCloseTo(2);
    });

    it('calculates rotation from segment angle', () => {
      const config = {
        segments: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 4 } }]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(wall.meshes[0].rotation.y).toBeCloseTo(Math.PI / 2);
    });

    it('sets shadow casting on mesh', () => {
      const config = {
        segments: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(wall.meshes[0].castShadow).toBe(true);
    });

    it('sets userData type to bank_wall', () => {
      const config = {
        segments: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(wall.bodies[0].userData.type).toBe('bank_wall');
    });

    it('handles empty segments array', () => {
      const wall = new BankWall(world, group, { segments: [] }, SURFACE_HEIGHT);

      expect(wall.meshes).toHaveLength(0);
      expect(wall.bodies).toHaveLength(0);
    });

    it('handles missing segments config', () => {
      const wall = new BankWall(world, group, {}, SURFACE_HEIGHT);

      expect(wall.meshes).toHaveLength(0);
      expect(wall.bodies).toHaveLength(0);
    });

    it('uses default height and thickness when not specified', () => {
      const config = {
        segments: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(wall.meshes).toHaveLength(1);
      expect(wall.bodies).toHaveLength(1);
    });

    it('applies theme color when no config color is set', () => {
      const theme = { mechanics: { bankWall: { color: 0x112233 } } };
      const config = {
        segments: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }]
      };
      new BankWall(world, group, config, SURFACE_HEIGHT, theme);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x112233 })
      );
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up all meshes and bodies', () => {
      const config = {
        segments: [
          { start: { x: -2, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } },
          { start: { x: 0, y: 0, z: -2 }, end: { x: 0, y: 0, z: 2 } }
        ]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(wall.meshes).toHaveLength(2);
      expect(wall.bodies).toHaveLength(2);

      wall.destroy();

      expect(wall.meshes).toEqual([]);
      expect(wall.bodies).toEqual([]);
      expect(world.removeBody).toHaveBeenCalledTimes(2);
    });

    it('can be called multiple times without error', () => {
      const config = {
        segments: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);

      wall.destroy();
      expect(() => wall.destroy()).not.toThrow();
    });
  });
});
