/**
 * Tests for mechanics barrel import and registry completeness
 * ISSUE-029
 *
 * Verifies that importing src/mechanics/index.js registers all 12 mechanic
 * types with MechanicRegistry, and that each type can create a valid instance.
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Enhance mocks before importing the barrel (registrations happen at import)
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    scale: s => ({ x: x * s, y: y * s, z: z * s }),
    copy: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    normalize: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
    distanceTo: jest.fn().mockReturnValue(0),
    vsub: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0, normalize: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0, scale: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }) }) }),
  }));

  CANNON.Body.mockImplementation(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() },
    velocity: { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, setFromEuler: jest.fn(), copy: jest.fn(), setFromAxisAngle: jest.fn() },
    userData: {},
    addShape: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    type: 1,
    sleepState: 0,
    applyImpulse: jest.fn(),
  }));

  CANNON.Body.KINEMATIC = 4;
  CANNON.Body.SLEEPING = 2;

  CANNON.Box.mockImplementation(() => ({}));
  CANNON.Sphere.mockImplementation(() => ({}));
  CANNON.Cylinder.mockImplementation(() => ({}));

  if (CANNON.Quaternion && typeof CANNON.Quaternion.mockImplementation === 'function') {
    CANNON.Quaternion.mockImplementation(() => ({
      x: 0, y: 0, z: 0, w: 1,
      setFromAxisAngle: jest.fn(),
      copy: jest.fn(),
    }));
  } else {
    CANNON.Quaternion = jest.fn(() => ({
      x: 0, y: 0, z: 0, w: 1,
      setFromAxisAngle: jest.fn(),
      copy: jest.fn(),
    }));
  }

  THREE.Vector3.mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    set: jest.fn().mockReturnThis(),
    copy: jest.fn().mockReturnThis(),
    normalize: jest.fn().mockReturnThis(),
    multiplyScalar: jest.fn().mockReturnThis(),
    subVectors: jest.fn().mockReturnThis(),
    length: jest.fn().mockReturnValue(0),
    clone: jest.fn().mockReturnValue({ x, y, z }),
  }));

  const makeMockMaterial = () => {
    const mat = {
      dispose: jest.fn(),
      color: { set: jest.fn() },
      transparent: false,
      opacity: 1,
      emissive: { set: jest.fn() },
      side: 0,
      clone: jest.fn(),
    };
    mat.clone.mockReturnValue({ ...mat, clone: jest.fn() });
    return mat;
  };

  THREE.MeshStandardMaterial.mockImplementation(makeMockMaterial);
  THREE.MeshBasicMaterial.mockImplementation(makeMockMaterial);

  const mockGeom = () => ({
    dispose: jest.fn(),
    translate: jest.fn().mockReturnThis(),
    rotateX: jest.fn().mockReturnThis(),
    rotateY: jest.fn().mockReturnThis(),
    rotateZ: jest.fn().mockReturnThis(),
  });

  const geomNames = [
    'BoxGeometry', 'CylinderGeometry', 'SphereGeometry',
    'RingGeometry', 'TorusGeometry', 'PlaneGeometry', 'CircleGeometry',
  ];
  for (const name of geomNames) {
    if (THREE[name] && typeof THREE[name].mockImplementation === 'function') {
      THREE[name].mockImplementation(mockGeom);
    } else {
      THREE[name] = jest.fn(mockGeom);
    }
  }

  THREE.Mesh.mockImplementation(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() },
    rotation: { x: 0, y: 0, z: 0, set: jest.fn() },
    scale: { set: jest.fn() },
    geometry: { dispose: jest.fn() },
    material: { dispose: jest.fn() },
    parent: null,
    visible: true,
    castShadow: false,
    receiveShadow: false,
  }));

  THREE.Group.mockImplementation(() => {
    const children = [];
    return {
      add: jest.fn(child => children.push(child)),
      remove: jest.fn(),
      children,
    };
  });
});

// Import barrel AFTER mocks are enhanced
import {
  createMechanic,
  getRegisteredTypes,
} from '../../mechanics/index';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    step: jest.fn(),
  };
}

function makeMockGroup() {
  const children = [];
  return {
    add: jest.fn(child => children.push(child)),
    remove: jest.fn(),
    children,
  };
}

const EXPECTED_TYPES = [
  'moving_sweeper',
  'boost_strip',
  'suction_zone',
  'low_gravity_zone',
  'bowl_contour',
  'portal_gate',
  'timed_hazard',
  'timed_gate',
  'bank_wall',
  'split_route',
  'ricochet_bumpers',
  'elevated_green',
];

// Minimal configs that satisfy each mechanic's constructor
const MECHANIC_CONFIGS = {
  moving_sweeper: {
    pivot: { x: 0, y: 0, z: 0 },
    armLength: 3,
    speed: 1,
    size: { x: 0.5, y: 0.3, z: 2 },
  },
  boost_strip: {
    position: { x: 0, y: 0, z: 0 },
    direction: { x: 1, y: 0, z: 0 },
    force: 5,
    size: { x: 2, y: 0.1, z: 1 },
  },
  suction_zone: {
    position: { x: 0, y: 0, z: 0 },
    radius: 2,
    force: 3,
  },
  low_gravity_zone: {
    position: { x: 0, y: 0, z: 0 },
    radius: 2,
    gravityMultiplier: 0.3,
  },
  bowl_contour: {
    position: { x: 0, y: 0, z: 0 },
    radius: 3,
    force: 2,
  },
  portal_gate: {
    entryPosition: { x: -2, y: 0, z: 0 },
    exitPosition: { x: 2, y: 0, z: 0 },
    radius: 0.5,
  },
  timed_hazard: {
    position: { x: 0, y: 0, z: 0 },
    size: { x: 1, y: 0.1, z: 1 },
    onDuration: 2,
    offDuration: 1,
    hazardType: 'fire',
  },
  timed_gate: {
    position: { x: 0, y: 0, z: 0 },
    size: { x: 2, y: 1, z: 0.3 },
    openDuration: 2,
    closedDuration: 2,
  },
  bank_wall: {
    segments: [
      { start: { x: -2, z: 0 }, end: { x: 2, z: 0 } },
    ],
    height: 0.5,
  },
  split_route: {
    walls: [
      { start: { x: 0, z: -3 }, end: { x: 0, z: 3 } },
    ],
    height: 0.5,
  },
  ricochet_bumpers: {
    bumpers: [
      { position: { x: 0, y: 0, z: 0 }, radius: 0.5, geometry: 'cylinder', restitution: 1.0 },
    ],
  },
  elevated_green: {
    region: [
      { x: -2, y: -2 },
      { x: 2, y: -2 },
      { x: 2, y: 2 },
      { x: -2, y: 2 },
    ],
    elevation: 1,
    rampStart: { x: -2, z: 0 },
    rampEnd: { x: -1, z: 0 },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Mechanics barrel import (index.js)', () => {
  test('all 12 mechanic types are registered', () => {
    const registered = getRegisteredTypes();
    expect(registered).toHaveLength(12);

    for (const type of EXPECTED_TYPES) {
      expect(registered).toContain(type);
    }
  });

  test('no unexpected types are registered', () => {
    const registered = getRegisteredTypes();
    for (const type of registered) {
      expect(EXPECTED_TYPES).toContain(type);
    }
  });

  describe('createMechanic returns valid instances', () => {
    const world = makeMockWorld();
    const surfaceHeight = 0.2;

    test.each(EXPECTED_TYPES)('%s', (type) => {
      const group = makeMockGroup();
      const config = MECHANIC_CONFIGS[type];
      const instance = createMechanic(type, world, group, config, surfaceHeight);

      expect(instance).not.toBeNull();
      expect(typeof instance.update).toBe('function');
      expect(typeof instance.destroy).toBe('function');
    });
  });

  test('no duplicate registration warnings during import', () => {
    // console.warn is already spied on by setup.js; verify no overwrite warnings
    const warnCalls = console.warn.mock?.calls || [];
    const overwriteWarnings = warnCalls.filter(
      args => args[0] && String(args[0]).includes('Overwriting existing mechanic type')
    );
    expect(overwriteWarnings).toHaveLength(0);
  });
});
