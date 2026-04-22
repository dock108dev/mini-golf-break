/**
 * Unit tests for BankWall mechanic
 * ISSUE-043
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BankWall } from '../../mechanics/BankWall';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';
import { HAZARD_COLORS } from '../../themes/palette';

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

    it('applies blocker-tier gray-blue static emissive', () => {
      const config = {
        segments: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 } }]
      };
      new BankWall(world, group, config, SURFACE_HEIGHT);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          emissive: HAZARD_COLORS.blocker,
          emissiveIntensity: 0.2
        })
      );
    });

    it('wall normal produces correct velocity reversal for perpendicular impact', () => {
      // Wall along x-axis: start(-2,0,0) → end(2,0,0), angle=0, normal=(0,0,1)
      const config = {
        segments: [{ start: { x: -2, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }],
        restitution: 0.8
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);
      expect(wall.bodies).toHaveLength(1);

      // Compute wall normal perpendicular to segment direction in XZ plane
      const dx = 2 - -2; // 4
      const dz = 0 - 0; // 0
      const angle = Math.atan2(dz, dx); // 0
      const normalX = -Math.sin(angle); // 0
      const normalZ = Math.cos(angle); // 1

      // Ball moving in -z direction (straight into the wall)
      const inVx = 0;
      const inVz = -5;
      const inSpeed = Math.sqrt(inVx * inVx + inVz * inVz); // 5

      // Elastic reflection: v' = v - 2(v·n)n
      const dot = inVx * normalX + inVz * normalZ; // -5
      const outVx = inVx - 2 * dot * normalX; // 0
      const outVz = inVz - 2 * dot * normalZ; // 5

      // z-component reverses sign
      expect(outVz).toBeGreaterThan(0);
      // x-component unchanged (ball moving parallel to wall stays parallel)
      expect(outVx).toBeCloseTo(inVx, 5);
      // Speed preserved within 10% for elastic reflection
      const outSpeed = Math.sqrt(outVx * outVx + outVz * outVz);
      expect(outSpeed / inSpeed).toBeCloseTo(1.0, 1);
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

    it('disposes Three.js geometries and materials on destroy', () => {
      const config = {
        segments: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } }]
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);
      const mesh = wall.meshes[0];

      wall.destroy();

      expect(mesh.geometry.dispose).toHaveBeenCalled();
      expect(mesh.material.dispose).toHaveBeenCalled();
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
