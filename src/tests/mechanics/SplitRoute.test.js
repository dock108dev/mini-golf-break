/**
 * Unit tests for SplitRoute mechanic
 * ISSUE-043
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { SplitRoute } from '../../mechanics/SplitRoute';
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
    remove: jest.fn(),
    children
  };
}

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SplitRoute', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  // --- Registry ---

  describe('registry', () => {
    it('is registered as split_route in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('split_route');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a mesh and physics body per wall', () => {
      const config = {
        walls: [{ start: { x: 0, y: 0, z: -3 }, end: { x: 0, y: 0, z: 3 } }]
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);

      expect(route.meshes).toHaveLength(1);
      expect(route.bodies).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
      expect(world.addBody).toHaveBeenCalledTimes(1);
    });

    it('creates multiple wall dividers', () => {
      const config = {
        walls: [
          { start: { x: 0, y: 0, z: -3 }, end: { x: 0, y: 0, z: 3 } },
          { start: { x: -2, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }
        ]
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);

      expect(route.meshes).toHaveLength(2);
      expect(route.bodies).toHaveLength(2);
    });

    it('skips walls with zero length', () => {
      const config = {
        walls: [{ start: { x: 1, y: 0, z: 1 }, end: { x: 1, y: 0, z: 1 } }]
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);

      expect(route.meshes).toHaveLength(0);
      expect(route.bodies).toHaveLength(0);
    });

    it('positions wall at correct Y height', () => {
      const config = {
        walls: [{ start: { x: 0, y: 0, z: -3 }, end: { x: 0, y: 0, z: 3 } }],
        height: 0.8
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);

      expect(route.meshes[0].position.y).toBeCloseTo(SURFACE_HEIGHT + 0.4);
    });

    it('positions at midpoint of wall endpoints', () => {
      const config = {
        walls: [{ start: { x: -4, y: 0, z: 2 }, end: { x: 6, y: 0, z: 2 } }]
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);

      expect(route.meshes[0].position.x).toBeCloseTo(1);
      expect(route.meshes[0].position.z).toBeCloseTo(2);
    });

    it('sets shadow casting on mesh', () => {
      const config = {
        walls: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }]
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);

      expect(route.meshes[0].castShadow).toBe(true);
    });

    it('sets userData type to split_route_wall', () => {
      const config = {
        walls: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }]
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);

      expect(route.bodies[0].userData.type).toBe('split_route_wall');
    });

    it('handles empty walls array', () => {
      const route = new SplitRoute(world, group, { walls: [] }, SURFACE_HEIGHT);

      expect(route.meshes).toHaveLength(0);
    });

    it('handles missing walls config', () => {
      const route = new SplitRoute(world, group, {}, SURFACE_HEIGHT);

      expect(route.meshes).toHaveLength(0);
    });

    it('uses default height and thickness when not specified', () => {
      const config = {
        walls: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }]
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);

      expect(route.meshes).toHaveLength(1);
      expect(route.bodies).toHaveLength(1);
    });

    it('applies theme color when no config color is set', () => {
      const theme = { mechanics: { splitRoute: { color: 0x334455 } } };
      const config = {
        walls: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }]
      };
      new SplitRoute(world, group, config, SURFACE_HEIGHT, theme);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x334455 })
      );
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up all meshes and bodies', () => {
      const config = {
        walls: [
          { start: { x: 0, y: 0, z: -3 }, end: { x: 0, y: 0, z: 3 } },
          { start: { x: -2, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }
        ]
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);

      expect(route.meshes).toHaveLength(2);
      expect(route.bodies).toHaveLength(2);

      route.destroy();

      expect(route.meshes).toEqual([]);
      expect(route.bodies).toEqual([]);
      expect(world.removeBody).toHaveBeenCalledTimes(2);
    });

    it('can be called multiple times without error', () => {
      const config = {
        walls: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }]
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);

      route.destroy();
      expect(() => route.destroy()).not.toThrow();
    });
  });
});
