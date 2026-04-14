/**
 * Resource leak tests for mechanics destroy lifecycle
 * ISSUE-042
 *
 * Verifies that every mechanic type properly cleans up all Three.js meshes
 * (including geometry/material disposal) and Cannon-es bodies on destroy().
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Import all mechanics via barrel import (triggers registration)
import '../../mechanics/index';
import { createMechanic, getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// ---------------------------------------------------------------------------
// Enhanced mocks — the module-level mocks from jest.setup.js lack dispose/set
// methods needed by mechanics constructors. We patch them here.
// ---------------------------------------------------------------------------

function makeMockMaterial() {
  const mat = {
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.2,
    dispose: jest.fn(),
    clone: jest.fn(() => makeMockMaterial())
  };
  return mat;
}

function makeMockGeometry() {
  return { dispose: jest.fn() };
}

// Patch THREE constructors to return objects with dispose/clone
beforeEach(() => {
  // Geometry constructors — some may be real functions (not jest.fn), so reassign
  const geomCtors = [
    'BoxGeometry',
    'PlaneGeometry',
    'CylinderGeometry',
    'SphereGeometry',
    'CircleGeometry',
    'RingGeometry'
  ];
  for (const name of geomCtors) {
    if (typeof THREE[name].mockImplementation === 'function') {
      THREE[name].mockImplementation(() => makeMockGeometry());
    } else {
      THREE[name] = jest.fn(() => makeMockGeometry());
    }
  }

  // Material constructors
  THREE.MeshStandardMaterial.mockImplementation(() => makeMockMaterial());
  THREE.MeshBasicMaterial.mockImplementation(() => makeMockMaterial());

  // Mesh constructor — preserve geometry/material refs, add position.set
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
      copy: jest.fn()
    };
    this.rotation = {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z, o) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    };
    this.scale = { x: 1, y: 1, z: 1, set: jest.fn() };
    this.castShadow = false;
    this.receiveShadow = false;
    this.parent = null;
    return this;
  });

  // CANNON.Body — add position.set and velocity.set
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
      copy: jest.fn()
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }),
      copy: jest.fn(),
      scale: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
      normalize: jest.fn()
    },
    angularVelocity: { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() },
    force: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      set: jest.fn(),
      copy: jest.fn(),
      setFromAxisAngle: jest.fn(),
      normalize: jest.fn()
    },
    addShape: jest.fn(),
    removeShape: jest.fn(),
    userData: {},
    material: null,
    mass: 0,
    type: 0,
    sleepState: 0,
    wakeUp: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    applyForce: jest.fn(),
    applyImpulse: jest.fn()
  }));

  // CANNON.Vec3 — needs scale() method
  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    scale: jest.fn(s => ({ x: x * s, y: y * s, z: z * s }))
  }));

  // CANNON.Quaternion
  CANNON.Quaternion = jest.fn(() => ({
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    setFromAxisAngle: jest.fn(),
    copy: jest.fn(),
    normalize: jest.fn()
  }));

  // CANNON.Trimesh
  CANNON.Trimesh = jest.fn(() => ({}));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  const bodies = [];
  return {
    addBody: jest.fn(body => bodies.push(body)),
    removeBody: jest.fn(body => {
      const idx = bodies.indexOf(body);
      if (idx !== -1) {
        bodies.splice(idx, 1);
      }
    }),
    step: jest.fn(),
    bodies,
    groundMaterial: {},
    bumperMaterial: {},
    gravity: { set: jest.fn() }
  };
}

function makeMockGroup() {
  const children = [];
  const group = {
    add: jest.fn(child => {
      children.push(child);
      if (child) {
        child.parent = group;
      }
    }),
    remove: jest.fn(child => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
      }
      if (child) {
        child.parent = null;
      }
    }),
    children,
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0, set: jest.fn() }
  };
  return group;
}

// Minimal configs for each mechanic type
const MECHANIC_CONFIGS = {
  boost_strip: {
    position: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: -1 },
    force: 8,
    size: { width: 1.5, length: 3 }
  },
  suction_zone: {
    position: { x: 0, y: 0, z: 0 },
    radius: 3,
    force: 6
  },
  low_gravity_zone: {
    position: { x: 0, y: 0, z: 0 },
    radius: 2,
    gravityMultiplier: 0.3
  },
  bowl_contour: {
    position: { x: 0, y: 0, z: 0 },
    radius: 4,
    force: 3
  },
  moving_sweeper: {
    pivot: { x: 0, y: 0, z: 0 },
    armLength: 3,
    speed: 1.5
  },
  timed_hazard: {
    position: { x: 0, y: 0, z: 0 },
    size: { width: 2, length: 1 },
    onDuration: 2,
    offDuration: 2,
    hazardType: 'water'
  },
  timed_gate: {
    position: { x: 0, y: 0, z: 0 },
    size: { width: 2, height: 1, depth: 0.2 },
    openDuration: 2,
    closedDuration: 3
  },
  bank_wall: {
    segments: [
      { start: { x: -2, y: 0, z: 0 }, end: { x: 2, y: 0, z: 0 } },
      { start: { x: 2, y: 0, z: 0 }, end: { x: 2, y: 0, z: -3 } }
    ]
  },
  split_route: {
    walls: [{ start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: -4 } }]
  },
  ricochet_bumpers: {
    bumpers: [
      { position: { x: -1, y: 0, z: -2 }, geometry: 'cylinder', radius: 0.4 },
      { position: { x: 1, y: 0, z: -3 }, geometry: 'sphere', radius: 0.3 }
    ]
  },
  elevated_green: {
    platform: { position: { x: 0, y: 0, z: -5 }, width: 4, length: 4 },
    elevation: 0.5,
    ramp: { start: { x: 0, y: 0, z: -3 }, end: { x: 0, y: 0, z: -5 }, width: 2 }
  },
  portal_gate: {
    entryPosition: { x: -3, y: 0, z: 2 },
    exitPosition: { x: 3, y: 0, z: -5 },
    radius: 0.6
  },
  laser_grid: {
    beams: [{ start: [0, 0, 0], end: [2, 0, 0] }],
    onDuration: 2,
    offDuration: 2
  },
  disappearing_platform: {
    platforms: [
      { position: [0, 0, 0], size: [2, 0.15, 2], onDuration: 3, offDuration: 2, offset: 0 }
    ],
    hazardBelowY: -1
  },
  gravity_funnel: {
    position: [0, 0, 0],
    radius: 3,
    exitPoint: [0, 0, -5],
    force: 2.0
  },
  multi_level_ramp: {
    startPosition: [0, 0, 0],
    endPosition: [0, 1, -4],
    width: 1.2
  }
};

const ALL_TYPES = Object.keys(MECHANIC_CONFIGS);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Resource leak tests — mechanics destroy lifecycle', () => {
  it('covers all 16 registered mechanic types', () => {
    const registered = getRegisteredTypes();
    expect(registered.length).toBe(16);
    for (const type of registered) {
      expect(MECHANIC_CONFIGS).toHaveProperty(type);
    }
  });

  // Per-type destroy cleanup
  describe.each(ALL_TYPES)('%s', type => {
    let world, group, mechanic;

    beforeEach(() => {
      world = makeMockWorld();
      group = makeMockGroup();
      mechanic = createMechanic(type, world, group, MECHANIC_CONFIGS[type], 0.2);
    });

    it('creates at least one mesh or body', () => {
      expect(mechanic.meshes.length + mechanic.bodies.length).toBeGreaterThan(0);
    });

    it('after destroy(), meshes array is empty', () => {
      expect(mechanic.meshes.length).toBeGreaterThan(0);
      mechanic.destroy();
      expect(mechanic.meshes).toEqual([]);
    });

    it('after destroy(), bodies array is empty', () => {
      mechanic.destroy();
      expect(mechanic.bodies).toEqual([]);
    });

    it('after destroy(), all bodies are removed from CANNON.World', () => {
      const bodiesCopy = [...mechanic.bodies];
      mechanic.destroy();

      for (const body of bodiesCopy) {
        expect(world.removeBody).toHaveBeenCalledWith(body);
      }
      expect(world.bodies.length).toBe(0);
    });

    it('calls geometry.dispose() on all meshes during destroy()', () => {
      const meshes = [...mechanic.meshes];
      // Wrap dispose with spies where needed (in case mock returned non-jest fns)
      for (const mesh of meshes) {
        if (
          mesh.geometry &&
          typeof mesh.geometry.dispose === 'function' &&
          !mesh.geometry.dispose._isMockFunction
        ) {
          mesh.geometry.dispose = jest.fn(mesh.geometry.dispose);
        }
      }

      mechanic.destroy();

      for (const mesh of meshes) {
        if (mesh.geometry) {
          expect(mesh.geometry.dispose).toHaveBeenCalled();
        }
      }
    });

    it('calls material.dispose() on all meshes during destroy()', () => {
      const meshes = [...mechanic.meshes];
      // Wrap dispose with spies where needed
      for (const mesh of meshes) {
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of materials) {
            if (typeof mat.dispose === 'function' && !mat.dispose._isMockFunction) {
              mat.dispose = jest.fn(mat.dispose);
            }
          }
        }
      }

      mechanic.destroy();

      for (const mesh of meshes) {
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            for (const mat of mesh.material) {
              expect(mat.dispose).toHaveBeenCalled();
            }
          } else {
            expect(mesh.material.dispose).toHaveBeenCalled();
          }
        }
      }
    });

    it('removes all meshes from parent group during destroy()', () => {
      const meshes = [...mechanic.meshes];
      mechanic.destroy();

      for (const mesh of meshes) {
        expect(group.children).not.toContain(mesh);
      }
    });
  });

  // 100x create/destroy stress test
  describe('repeated create/destroy does not leak bodies', () => {
    it.each(ALL_TYPES)('%s — 100 cycles leaves zero bodies in world', type => {
      const world = makeMockWorld();

      for (let i = 0; i < 100; i++) {
        const group = makeMockGroup();
        const mechanic = createMechanic(type, world, group, MECHANIC_CONFIGS[type], 0.2);
        mechanic.destroy();
      }

      expect(world.bodies.length).toBe(0);
    });
  });
});
