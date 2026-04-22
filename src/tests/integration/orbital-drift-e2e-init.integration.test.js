/**
 * End-to-end initialization tests for each Orbital Drift hole with mechanics.
 * ISSUE-056
 *
 * For each of the 9 OD holes: init with full config (including mechanics),
 * step update 10 times with a ball body, then destroy cleanly.
 * Uses real MechanicRegistry (not mocked) to catch registration gaps.
 */

// Mock Three.js before any imports
jest.mock('three', () => {
  const mockVector3 = jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.clone = jest.fn(() => new mockVector3(this.x, this.y, this.z));
    this.copy = jest.fn(function (other) {
      if (other) {
        this.x = other.x || 0;
        this.y = other.y || 0;
        this.z = other.z || 0;
      }
      return this;
    });
    this.set = jest.fn(function (x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    });
    this.setY = jest.fn(function (v) {
      this.y = v;
      return this;
    });
    this.normalize = jest.fn(() => this);
    this.multiplyScalar = jest.fn(() => this);
    this.subVectors = jest.fn(() => this);
    this.addVectors = jest.fn(() => this);
    this.toArray = jest.fn(() => [this.x, this.y, this.z]);
    this.distanceTo = jest.fn(() => 5);
  });

  const mockVector2 = jest.fn(function (x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.clone = jest.fn(() => new mockVector2(this.x, this.y));
    this.subVectors = jest.fn((a, b) => {
      this.x = a.x - b.x;
      this.y = a.y - b.y;
      return this;
    });
    this.length = jest.fn(() => Math.sqrt(this.x * this.x + this.y * this.y));
    this.normalize = jest.fn(() => this);
    this.multiplyScalar = jest.fn(s => {
      this.x *= s;
      this.y *= s;
      return this;
    });
    this.addVectors = jest.fn((a, b) => {
      this.x = a.x + b.x;
      this.y = a.y + b.y;
      return this;
    });
  });

  const mockBox2 = jest.fn(function () {
    this.min = { x: -5, y: -5 };
    this.max = { x: 5, y: 5 };
    this.setFromPoints = jest.fn();
    this.getCenter = jest.fn(target => {
      target.x = 0;
      target.y = 0;
    });
    this.getSize = jest.fn(target => {
      target.x = 10;
      target.y = 10;
    });
  });

  const mockGeometry = () => ({
    dispose: jest.fn(),
    rotateX: jest.fn(),
    translate: jest.fn(),
    attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]) } },
    index: { array: new Uint16Array([0, 1, 2, 2, 3, 0]) }
  });

  const mockMaterial = jest.fn(function () {
    this.dispose = jest.fn();
    this.color = 0xffffff;
    this.clone = jest.fn(() => new mockMaterial());
  });

  const mockMesh = jest.fn(function () {
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0, set: jest.fn() };
    this.geometry = { dispose: jest.fn() };
    this.material = { dispose: jest.fn(), clone: jest.fn(() => new mockMaterial()) };
    this.parent = null;
    this.updateMatrix = jest.fn();
    this.name = '';
    this.castShadow = false;
    this.receiveShadow = false;
  });

  const mockGroup = jest.fn(function () {
    this.position = {
      x: 0,
      y: 0,
      z: 0,
      copy: jest.fn(function (other) {
        if (other) {
          this.x = other.x || 0;
          this.y = other.y || 0;
          this.z = other.z || 0;
        }
      }),
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    };
    this.parent = null;
    this.add = jest.fn();
    this.remove = jest.fn();
    this.children = [];
    this.name = '';
    this.userData = {};
  });

  return {
    Vector3: mockVector3,
    Vector2: mockVector2,
    Box2: mockBox2,
    Euler: jest.fn(function (x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }),
    Shape: jest.fn(function () {
      this.holes = [];
      this.moveTo = jest.fn();
      this.lineTo = jest.fn();
      this.closePath = jest.fn();
    }),
    ShapeGeometry: jest.fn(mockGeometry),
    ExtrudeGeometry: jest.fn(function () {
      this.dispose = jest.fn();
      this.rotateX = jest.fn();
      this.translate = jest.fn();
    }),
    MeshStandardMaterial: mockMaterial,
    MeshPhongMaterial: mockMaterial,
    MeshBasicMaterial: mockMaterial,
    BufferGeometry: jest.fn(function () {
      this.setFromPoints = jest.fn().mockReturnValue(this);
      this.setAttribute = jest.fn();
      this.dispose = jest.fn();
    }),
    LineBasicMaterial: jest.fn(function () {
      this.color = 0xffffff;
      this.dispose = jest.fn();
    }),
    Line: jest.fn(function (geometry, material) {
      this.geometry = geometry || { dispose: jest.fn() };
      this.material = material || { dispose: jest.fn() };
      this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    }),
    Mesh: mockMesh,
    Group: mockGroup,
    CylinderGeometry: jest.fn(mockGeometry),
    PlaneGeometry: jest.fn(mockGeometry),
    CircleGeometry: jest.fn(mockGeometry),
    TorusGeometry: jest.fn(mockGeometry),
    BoxGeometry: jest.fn(mockGeometry),
    RingGeometry: jest.fn(mockGeometry),
    SphereGeometry: jest.fn(mockGeometry),
    Path: jest.fn(function () {
      return {};
    }),
    Color: jest.fn(function (c) {
      this.r = 0;
      this.g = 0;
      this.b = 0;
    }),
    SpriteMaterial: jest.fn(function (opts) {
      this.opacity = opts?.opacity !== undefined ? opts.opacity : 1;
      this.dispose = jest.fn();
    }),
    Sprite: jest.fn(function (material) {
      this.material = material || { opacity: 1, dispose: jest.fn() };
      this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
      this.scale = { set: jest.fn() };
      this.parent = null;
    }),
    PointLight: jest.fn(function () {
      this.position = { x: 0, y: 0, z: 0, set: jest.fn() };
      this.parent = null;
    }),
    AdditiveBlending: 2,
    GridHelper: jest.fn(function () {
      this.geometry = { dispose: jest.fn() };
      this.material = { dispose: jest.fn() };
      this.position = { set: jest.fn() };
    })
  };
});

// Mock cannon-es
jest.mock('cannon-es', () => {
  const mockVec3 = jest.fn(function (x, y, z) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
    this.scale = jest.fn(() => new mockVec3(this.x, this.y, this.z));
  });

  const mockQuaternion = jest.fn(function () {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 1;
    this.set = jest.fn();
    this.copy = jest.fn();
    this.setFromAxisAngle = jest.fn(() => this);
  });

  const mockBody = jest.fn(function () {
    this.position = new mockVec3();
    this.position.set = jest.fn(function (x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    });
    this.velocity = new mockVec3();
    this.velocity.set = jest.fn();
    this.angularVelocity = new mockVec3();
    this.angularVelocity.set = jest.fn();
    this.quaternion = new mockQuaternion();
    this.material = null;
    this.type = 'STATIC';
    this.addShape = jest.fn();
    this.addEventListener = jest.fn();
    this.userData = {};
    this.isTrigger = false;
  });
  mockBody.STATIC = 'STATIC';
  mockBody.KINEMATIC = 'KINEMATIC';
  mockBody.SLEEPING = 'SLEEPING';

  return {
    Box: jest.fn(() => ({ material: null })),
    Body: mockBody,
    Material: jest.fn(),
    ContactMaterial: jest.fn(),
    Vec3: mockVec3,
    Cylinder: jest.fn(),
    Trimesh: jest.fn(),
    Sphere: jest.fn(),
    Quaternion: mockQuaternion,
    BODY_TYPES: { STATIC: 'STATIC' }
  };
});

// Mock three-csg-ts
jest.mock('three-csg-ts', () => ({
  CSG: {
    fromMesh: jest.fn(() => ({
      subtract: jest.fn(() => ({
        toMesh: jest.fn(() => ({
          position: { set: jest.fn() },
          geometry: { dispose: jest.fn() },
          material: { dispose: jest.fn() }
        }))
      }))
    })),
    subtract: jest.fn(() => ({
      position: { set: jest.fn() },
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    }))
  }
}));

// Mock HazardFactory
jest.mock('../../objects/hazards/HazardFactory', () => ({
  createHazard: jest.fn(() => ({
    mesh: {
      position: { set: jest.fn() },
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    },
    body: { position: { set: jest.fn() } },
    destroy: jest.fn()
  }))
}));

// Mock HeroPropFactory
jest.mock('../../objects/HeroPropFactory', () => ({
  createHeroProp: jest.fn(() => [])
}));

import { createOrbitalDriftConfigs } from '../../config/orbitalDriftConfigs';
import { HoleEntity } from '../../objects/HoleEntity';

// Import barrel to trigger all real mechanic registrations (not mocked)
import '../../mechanics/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  const addedBodies = [];
  const removedBodies = [];
  return {
    addBody: jest.fn(body => {
      addedBodies.push(body);
    }),
    removeBody: jest.fn(body => {
      removedBodies.push(body);
    }),
    addContactMaterial: jest.fn(),
    step: jest.fn(),
    groundMaterial: { name: 'ground' },
    bumperMaterial: { name: 'bumper' },
    bodies: [],
    // Expose tracking arrays for orphan-body assertions
    _addedBodies: addedBodies,
    _removedBodies: removedBodies
  };
}

function makeMockScene() {
  return {
    add: jest.fn(),
    remove: jest.fn(),
    children: []
  };
}

function makeMockBallBody() {
  return {
    position: { x: 0, y: 0.2, z: 0 },
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    force: { x: 0, y: 0, z: 0, set: jest.fn() },
    applyForce: jest.fn(),
    wakeUp: jest.fn()
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const configs = createOrbitalDriftConfigs();

describe('Orbital Drift end-to-end initialization (ISSUE-056)', () => {
  let world, scene;

  beforeEach(() => {
    world = makeMockWorld();
    scene = makeMockScene();
    jest.clearAllMocks();
  });

  // AC1: For each of the 9 orbitalDriftConfigs: HoleEntity.init() completes without throwing
  describe('init() completes without throwing', () => {
    it.each(configs.map(c => [c.description, c]))('%s', async (_desc, config) => {
      const hole = new HoleEntity(world, config, scene);
      await expect(hole.init()).resolves.not.toThrow();
    });
  });

  // AC2: For each hole: all mechanics in the config are instantiated
  describe('mechanic count matches config.mechanics.length', () => {
    it.each(configs.map(c => [c.description, c]))('%s', async (_desc, config) => {
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const expectedCount = (config.mechanics || []).length;
      expect(hole.mechanics).toHaveLength(expectedCount);
    });
  });

  // AC3: For each hole: calling HoleEntity.update(1/60, ballBody) 10 times does not throw
  describe('update(1/60, ballBody) x10 does not throw', () => {
    it.each(configs.map(c => [c.description, c]))('%s', async (_desc, config) => {
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();
      const dt = 1 / 60;

      for (let i = 0; i < 10; i++) {
        expect(() => hole.update(dt, ballBody)).not.toThrow();
      }
    });
  });

  // AC4: For each hole: HoleEntity.destroy() completes without throwing
  //      or leaving orphan bodies in the physics world
  describe('destroy() completes cleanly with no orphan bodies', () => {
    it.each(configs.map(c => [c.description, c]))('%s', async (_desc, config) => {
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Run a few updates before destroying (realistic scenario)
      const ballBody = makeMockBallBody();
      for (let i = 0; i < 10; i++) {
        hole.update(1 / 60, ballBody);
      }

      // Capture tracked bodies before destroy
      const bodiesBeforeDestroy = [...hole.bodies];

      expect(() => hole.destroy()).not.toThrow();

      // Mechanics array should be empty after destroy
      expect(hole.mechanics).toEqual([]);

      // All tracked bodies should have been removed from the world
      for (const body of bodiesBeforeDestroy) {
        expect(world.removeBody).toHaveBeenCalledWith(body);
      }

      // No tracked bodies should remain after destroy
      expect(hole.bodies).toEqual([]);
    });
  });

  // AC5: Test uses real MechanicRegistry (verified by AC2 — if any
  // mechanic type were unregistered, createMechanic would return null
  // and the count would not match config.mechanics.length)

  // Full lifecycle: init → 10 updates → destroy for all 9 holes
  describe('full lifecycle per hole', () => {
    it.each(configs.map(c => [c.description, c]))(
      '%s — init → update x10 → destroy',
      async (_desc, config) => {
        const hole = new HoleEntity(world, config, scene);
        await hole.init();

        const expectedMechanics = (config.mechanics || []).length;
        expect(hole.mechanics).toHaveLength(expectedMechanics);

        const ballBody = makeMockBallBody();
        for (let i = 0; i < 10; i++) {
          hole.update(1 / 60, ballBody);
        }

        hole.destroy();

        expect(hole.mechanics).toEqual([]);

        // update after destroy should be safe
        expect(() => hole.update(1 / 60, ballBody)).not.toThrow();
      }
    );
  });
});
