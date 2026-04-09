/**
 * Unit tests for structural mechanics
 * ISSUE-092
 *
 * Covers: BankWall, SplitRoute, RicochetBumpers
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BankWall } from '../../mechanics/BankWall';
import { SplitRoute } from '../../mechanics/SplitRoute';
import { RicochetBumpers } from '../../mechanics/RicochetBumpers';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js for structural mechanics
// ---------------------------------------------------------------------------

beforeAll(() => {
  // Body needs position.set and quaternion methods for wall/bumper creation
  // Body needs position.set and quaternion methods for wall/bumper creation
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
      copy: jest.fn(),
    },
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      set: jest.fn(),
      copy: jest.fn(),
      setFromAxisAngle: jest.fn(),
    },
    mass: 0,
    type: CANNON.Body.STATIC,
    addShape: jest.fn(),
    userData: {},
  }));

  // Mesh position.set needs to update x/y/z for position assertions
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
      }),
      copy: jest.fn(),
    };
    this.rotation = { x: 0, y: 0, z: 0, set: jest.fn() };
    this.scale = { x: 1, y: 1, z: 1, set: jest.fn() };
    this.castShadow = false;
    this.receiveShadow = false;
    this.name = '';
    this.userData = {};
    this.add = jest.fn();
    this.remove = jest.fn();
    this.children = [];
    return this;
  });

  // Geometry constructors need dispose()
  const geomFactory = () => ({ dispose: jest.fn() });
  THREE.BoxGeometry.mockImplementation(geomFactory);
  THREE.CylinderGeometry.mockImplementation(geomFactory);
  THREE.SphereGeometry.mockImplementation(geomFactory);

  // MeshStandardMaterial needs dispose()
  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, roughness: 0.3, metalness: 0.2, dispose: jest.fn() };
    if (opts) Object.assign(mat, opts);
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

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// BankWall
// ---------------------------------------------------------------------------

describe('BankWall', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    segments: [
      {
        start: new THREE.Vector3(-2, 0, 0),
        end: new THREE.Vector3(2, 0, 0),
      },
    ],
    height: 0.6,
    thickness: 0.15,
    restitution: 0.8,
    color: 0x6666aa,
  };

  describe('constructor', () => {
    it('creates a mesh and physics body per segment', () => {
      const wall = new BankWall(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(wall.meshes).toHaveLength(1);
      expect(wall.bodies).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
      expect(world.addBody).toHaveBeenCalledTimes(1);
    });

    it('creates multiple segments', () => {
      const config = {
        segments: [
          { start: new THREE.Vector3(-2, 0, 0), end: new THREE.Vector3(2, 0, 0) },
          { start: new THREE.Vector3(0, 0, -3), end: new THREE.Vector3(0, 0, 3) },
          { start: new THREE.Vector3(-1, 0, -1), end: new THREE.Vector3(1, 0, 1) },
        ],
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);
      expect(wall.meshes).toHaveLength(3);
      expect(wall.bodies).toHaveLength(3);
    });

    it('skips segments with zero length', () => {
      const config = {
        segments: [
          { start: new THREE.Vector3(0, 0, 0), end: new THREE.Vector3(0, 0, 0) },
        ],
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);
      expect(wall.meshes).toHaveLength(0);
      expect(wall.bodies).toHaveLength(0);
    });

    it('positions wall at correct Y height', () => {
      const wall = new BankWall(world, group, defaultConfig, SURFACE_HEIGHT);
      const mesh = wall.meshes[0];
      expect(mesh.position.y).toBeCloseTo(SURFACE_HEIGHT + 0.6 / 2);
    });

    it('calculates rotation from segment angle', () => {
      const config = {
        segments: [
          { start: new THREE.Vector3(0, 0, 0), end: new THREE.Vector3(0, 0, 4) },
        ],
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);
      // atan2(4, 0) = PI/2
      expect(wall.meshes[0].rotation.y).toBeCloseTo(Math.PI / 2);
    });

    it('positions at midpoint of segment', () => {
      const config = {
        segments: [
          { start: new THREE.Vector3(-3, 0, 2), end: new THREE.Vector3(5, 0, 2) },
        ],
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);
      expect(wall.meshes[0].position.x).toBeCloseTo(1); // (-3+5)/2
      expect(wall.meshes[0].position.z).toBeCloseTo(2);
    });

    it('sets shadow casting on mesh', () => {
      const wall = new BankWall(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(wall.meshes[0].castShadow).toBe(true);
    });

    it('uses STATIC body type', () => {
      const wall = new BankWall(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(wall.bodies[0].type).toBe(CANNON.Body.STATIC);
    });

    it('sets userData type to bank_wall', () => {
      const wall = new BankWall(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(wall.bodies[0].userData.type).toBe('bank_wall');
    });

    it('uses default values when config is minimal', () => {
      const config = {
        segments: [
          { start: new THREE.Vector3(0, 0, 0), end: new THREE.Vector3(1, 0, 0) },
        ],
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);
      expect(wall.meshes).toHaveLength(1);
      expect(wall.bodies).toHaveLength(1);
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
  });

  describe('destroy', () => {
    it('cleans up all meshes and bodies', () => {
      const config = {
        segments: [
          { start: new THREE.Vector3(-2, 0, 0), end: new THREE.Vector3(2, 0, 0) },
          { start: new THREE.Vector3(0, 0, -2), end: new THREE.Vector3(0, 0, 2) },
        ],
      };
      const wall = new BankWall(world, group, config, SURFACE_HEIGHT);
      expect(wall.meshes).toHaveLength(2);
      expect(wall.bodies).toHaveLength(2);

      wall.destroy();

      expect(wall.meshes).toHaveLength(0);
      expect(wall.bodies).toHaveLength(0);
      expect(world.removeBody).toHaveBeenCalledTimes(2);
    });
  });
});

// ---------------------------------------------------------------------------
// SplitRoute
// ---------------------------------------------------------------------------

describe('SplitRoute', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    walls: [
      {
        start: new THREE.Vector3(0, 0, -3),
        end: new THREE.Vector3(0, 0, 3),
      },
    ],
    height: 0.8,
    thickness: 0.15,
    color: 0x8888aa,
  };

  describe('constructor', () => {
    it('creates a mesh and physics body per wall', () => {
      const route = new SplitRoute(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(route.meshes).toHaveLength(1);
      expect(route.bodies).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
      expect(world.addBody).toHaveBeenCalledTimes(1);
    });

    it('creates multiple wall dividers', () => {
      const config = {
        walls: [
          { start: new THREE.Vector3(0, 0, -3), end: new THREE.Vector3(0, 0, 3) },
          { start: new THREE.Vector3(-2, 0, 0), end: new THREE.Vector3(2, 0, 0) },
        ],
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);
      expect(route.meshes).toHaveLength(2);
      expect(route.bodies).toHaveLength(2);
    });

    it('skips walls with zero length', () => {
      const config = {
        walls: [
          { start: new THREE.Vector3(1, 0, 1), end: new THREE.Vector3(1, 0, 1) },
        ],
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);
      expect(route.meshes).toHaveLength(0);
      expect(route.bodies).toHaveLength(0);
    });

    it('positions wall at correct Y height', () => {
      const route = new SplitRoute(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(route.meshes[0].position.y).toBeCloseTo(SURFACE_HEIGHT + 0.8 / 2);
    });

    it('uses STATIC body type', () => {
      const route = new SplitRoute(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(route.bodies[0].type).toBe(CANNON.Body.STATIC);
    });

    it('sets userData type to split_route_wall', () => {
      const route = new SplitRoute(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(route.bodies[0].userData.type).toBe('split_route_wall');
    });

    it('sets shadow casting on mesh', () => {
      const route = new SplitRoute(world, group, defaultConfig, SURFACE_HEIGHT);
      expect(route.meshes[0].castShadow).toBe(true);
    });

    it('handles empty walls array', () => {
      const route = new SplitRoute(world, group, { walls: [] }, SURFACE_HEIGHT);
      expect(route.meshes).toHaveLength(0);
    });

    it('handles missing walls config', () => {
      const route = new SplitRoute(world, group, {}, SURFACE_HEIGHT);
      expect(route.meshes).toHaveLength(0);
    });

    it('positions at midpoint of wall endpoints', () => {
      const config = {
        walls: [
          { start: new THREE.Vector3(-4, 0, 2), end: new THREE.Vector3(6, 0, 2) },
        ],
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);
      expect(route.meshes[0].position.x).toBeCloseTo(1); // (-4+6)/2
      expect(route.meshes[0].position.z).toBeCloseTo(2);
    });
  });

  describe('destroy', () => {
    it('cleans up all meshes and bodies', () => {
      const config = {
        walls: [
          { start: new THREE.Vector3(0, 0, -3), end: new THREE.Vector3(0, 0, 3) },
          { start: new THREE.Vector3(-2, 0, 0), end: new THREE.Vector3(2, 0, 0) },
        ],
      };
      const route = new SplitRoute(world, group, config, SURFACE_HEIGHT);
      expect(route.meshes).toHaveLength(2);

      route.destroy();

      expect(route.meshes).toHaveLength(0);
      expect(route.bodies).toHaveLength(0);
      expect(world.removeBody).toHaveBeenCalledTimes(2);
    });
  });
});

// ---------------------------------------------------------------------------
// RicochetBumpers
// ---------------------------------------------------------------------------

describe('RicochetBumpers', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  describe('constructor', () => {
    it('creates a cylinder bumper by default', () => {
      const config = {
        bumpers: [{ position: new THREE.Vector3(0, 0, 0), radius: 0.4 }],
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);
      expect(rb.meshes).toHaveLength(1);
      expect(rb.bodies).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
      expect(world.addBody).toHaveBeenCalledTimes(1);
    });

    it('creates a sphere bumper when geometry is sphere', () => {
      const config = {
        bumpers: [
          { position: new THREE.Vector3(0, 0, 0), geometry: 'sphere', radius: 0.5 },
        ],
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);
      expect(rb.meshes).toHaveLength(1);
      expect(rb.bodies).toHaveLength(1);
      // Sphere position is surfaceHeight + radius
      expect(rb.meshes[0].position.y).toBeCloseTo(SURFACE_HEIGHT + 0.5);
    });

    it('creates a box bumper when geometry is box', () => {
      const config = {
        bumpers: [
          {
            position: new THREE.Vector3(0, 0, 0),
            geometry: 'box',
            size: new THREE.Vector3(1, 0.6, 1),
          },
        ],
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);
      expect(rb.meshes).toHaveLength(1);
      expect(rb.bodies).toHaveLength(1);
    });

    it('creates multiple bumpers of different types', () => {
      const config = {
        bumpers: [
          { position: new THREE.Vector3(-2, 0, 0), geometry: 'cylinder', radius: 0.3 },
          { position: new THREE.Vector3(0, 0, 0), geometry: 'sphere', radius: 0.4 },
          { position: new THREE.Vector3(2, 0, 0), geometry: 'box', size: new THREE.Vector3(0.5, 0.5, 0.5) },
        ],
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);
      expect(rb.meshes).toHaveLength(3);
      expect(rb.bodies).toHaveLength(3);
      expect(group.add).toHaveBeenCalledTimes(3);
      expect(world.addBody).toHaveBeenCalledTimes(3);
    });

    it('uses STATIC body type', () => {
      const config = {
        bumpers: [{ position: new THREE.Vector3(0, 0, 0) }],
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);
      expect(rb.bodies[0].type).toBe(CANNON.Body.STATIC);
    });

    it('sets userData type to ricochet_bumper', () => {
      const config = {
        bumpers: [{ position: new THREE.Vector3(0, 0, 0) }],
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);
      expect(rb.bodies[0].userData.type).toBe('ricochet_bumper');
    });

    it('sets shadow casting on meshes', () => {
      const config = {
        bumpers: [{ position: new THREE.Vector3(0, 0, 0) }],
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
        bumpers: [{ geometry: 'cylinder', radius: 0.3 }],
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);
      expect(rb.meshes).toHaveLength(1);
    });

    it('applies custom color from config', () => {
      const config = {
        color: 0xff0000,
        bumpers: [{ position: new THREE.Vector3(0, 0, 0) }],
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);
      expect(rb.meshes).toHaveLength(1);
    });

    it('applies per-bumper color override', () => {
      const config = {
        color: 0xff0000,
        bumpers: [{ position: new THREE.Vector3(0, 0, 0), color: 0x00ff00 }],
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);
      expect(rb.meshes).toHaveLength(1);
    });
  });

  describe('destroy', () => {
    it('cleans up all meshes and bodies', () => {
      const config = {
        bumpers: [
          { position: new THREE.Vector3(-1, 0, 0), geometry: 'cylinder' },
          { position: new THREE.Vector3(1, 0, 0), geometry: 'sphere' },
        ],
      };
      const rb = new RicochetBumpers(world, group, config, SURFACE_HEIGHT);
      expect(rb.meshes).toHaveLength(2);
      expect(rb.bodies).toHaveLength(2);

      rb.destroy();

      expect(rb.meshes).toHaveLength(0);
      expect(rb.bodies).toHaveLength(0);
      expect(world.removeBody).toHaveBeenCalledTimes(2);
    });
  });
});

// ---------------------------------------------------------------------------
// Registry registration
// ---------------------------------------------------------------------------

describe('Structural mechanics registry registration', () => {
  it('all structural mechanic types are registered in MechanicRegistry', () => {
    const types = getRegisteredTypes();
    expect(types).toContain('bank_wall');
    expect(types).toContain('split_route');
    expect(types).toContain('ricochet_bumpers');
  });
});
