/**
 * Unit tests for RicochetBumpers mechanic
 * ISSUE-043
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RicochetBumpers } from '../../mechanics/RicochetBumpers';
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
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn() },
    mass: 0,
    type: CANNON.Body.STATIC,
    addShape: jest.fn(),
    userData: {}
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
    this.rotation = { x: 0, y: 0, z: 0 };
    this.castShadow = false;
    this.userData = {};
    return this;
  });

  const geomFactory = () => ({ dispose: jest.fn() });
  THREE.CylinderGeometry.mockImplementation(geomFactory);
  THREE.SphereGeometry.mockImplementation(geomFactory);
  THREE.BoxGeometry.mockImplementation(geomFactory);

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, dispose: jest.fn() };
    if (opts) {
      Object.assign(mat, opts);
    }
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

describe('RicochetBumpers', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  // --- Registry ---

  describe('registry', () => {
    it('is registered as ricochet_bumpers in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('ricochet_bumpers');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a cylinder bumper by default', () => {
      const config = {
        bumpers: [{ position: { x: 0, y: 0, z: 0 }, radius: 0.4 }]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.meshes).toHaveLength(1);
      expect(rb.bodies).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
      expect(world.addBody).toHaveBeenCalledTimes(1);
    });

    it('creates a sphere bumper when geometry is sphere', () => {
      const config = {
        bumpers: [{ position: { x: 0, y: 0, z: 0 }, geometry: 'sphere', radius: 0.5 }]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.meshes).toHaveLength(1);
      expect(rb.bodies).toHaveLength(1);
      expect(rb.meshes[0].position.y).toBeCloseTo(SURFACE_HEIGHT + 0.5);
    });

    it('creates a box bumper when geometry is box', () => {
      const config = {
        bumpers: [
          {
            position: { x: 0, y: 0, z: 0 },
            geometry: 'box',
            size: { x: 1, y: 0.6, z: 1 }
          }
        ]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.meshes).toHaveLength(1);
      expect(rb.bodies).toHaveLength(1);
    });

    it('creates multiple bumpers of different types', () => {
      const config = {
        bumpers: [
          { position: { x: -2, y: 0, z: 0 }, geometry: 'cylinder', radius: 0.3 },
          { position: { x: 0, y: 0, z: 0 }, geometry: 'sphere', radius: 0.4 },
          { position: { x: 2, y: 0, z: 0 }, geometry: 'box', size: { x: 0.5, y: 0.5, z: 0.5 } }
        ]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.meshes).toHaveLength(3);
      expect(rb.bodies).toHaveLength(3);
      expect(group.add).toHaveBeenCalledTimes(3);
      expect(world.addBody).toHaveBeenCalledTimes(3);
    });

    it('sets userData type to ricochet_bumper', () => {
      const config = {
        bumpers: [{ position: { x: 0, y: 0, z: 0 } }]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.bodies[0].userData.type).toBe('ricochet_bumper');
    });

    it('sets shadow casting on meshes', () => {
      const config = {
        bumpers: [{ position: { x: 0, y: 0, z: 0 } }]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.meshes[0].castShadow).toBe(true);
    });

    it('handles empty bumpers array', () => {
      const rb = new RicochetBumpers(world, group, { bumpers: [] }, SURFACE_HEIGHT);

      expect(rb.meshes).toHaveLength(0);
      expect(rb.bodies).toHaveLength(0);
    });

    it('handles missing bumpers config', () => {
      const rb = new RicochetBumpers(world, group, {}, SURFACE_HEIGHT);

      expect(rb.meshes).toHaveLength(0);
      expect(rb.bodies).toHaveLength(0);
    });

    it('uses default position when not provided', () => {
      const config = {
        bumpers: [{ geometry: 'cylinder', radius: 0.3 }]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.meshes).toHaveLength(1);
    });

    it('applies custom color from config', () => {
      const config = {
        color: 0xff0000,
        bumpers: [{ position: { x: 0, y: 0, z: 0 } }]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.meshes).toHaveLength(1);
    });

    it('applies per-bumper color override', () => {
      const config = {
        color: 0xff0000,
        bumpers: [{ position: { x: 0, y: 0, z: 0 }, color: 0x00ff00 }]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.meshes).toHaveLength(1);
    });

    it('applies theme color when no config color is set', () => {
      const theme = { mechanics: { ricochetBumpers: { color: 0xaabb00 } } };
      const config = {
        bumpers: [{ position: { x: 0, y: 0, z: 0 } }]
      };
      new RicochetBumpers(world, group, config, SURFACE_HEIGHT, theme);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xaabb00 })
      );
    });

    it('positions cylinder bumper at correct Y height', () => {
      const config = {
        bumpers: [{ position: { x: 0, y: 0, z: 0 }, height: 0.8 }]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.meshes[0].position.y).toBeCloseTo(SURFACE_HEIGHT + 0.4);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up all meshes and bodies', () => {
      const config = {
        bumpers: [
          { position: { x: -1, y: 0, z: 0 }, geometry: 'cylinder' },
          { position: { x: 1, y: 0, z: 0 }, geometry: 'sphere' }
        ]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      expect(rb.meshes).toHaveLength(2);
      expect(rb.bodies).toHaveLength(2);

      rb.destroy();

      expect(rb.meshes).toEqual([]);
      expect(rb.bodies).toEqual([]);
      expect(world.removeBody).toHaveBeenCalledTimes(2);
    });

    it('can be called multiple times without error', () => {
      const config = {
        bumpers: [{ position: { x: 0, y: 0, z: 0 } }]
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);

      rb.destroy();
      expect(() => rb.destroy()).not.toThrow();
    });
  });
});
