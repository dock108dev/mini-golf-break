/**
 * Integration tests for HoleEntity hero prop creation
 * ISSUE-040
 *
 * Verifies that HoleEntity correctly creates hero props from heroProps[] config
 * via HeroPropFactory, adds them to the hole group, and cleans up on destroy.
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

  const mockMaterial = jest.fn(() => ({ dispose: jest.fn(), color: 0xffffff }));

  const mockMesh = jest.fn(function () {
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.geometry = { dispose: jest.fn() };
    this.material = { dispose: jest.fn() };
    this.parent = null;
    this.updateMatrix = jest.fn();
    this.name = '';
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
    Shape: jest.fn(function () {
      this.holes = [];
    }),
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
    BoxGeometry: jest.fn(mockGeometry),
    RingGeometry: jest.fn(mockGeometry),
    SphereGeometry: jest.fn(mockGeometry),
    Path: jest.fn(function () {
      return {};
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
  const mockBody = jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn(), copy: jest.fn() },
    material: null,
    type: 'STATIC',
    addShape: jest.fn(),
    userData: {}
  }));
  mockBody.STATIC = 'STATIC';

  return {
    Box: jest.fn(() => ({ material: null })),
    Body: mockBody,
    Material: jest.fn(),
    ContactMaterial: jest.fn(),
    Vec3: jest.fn((x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 })),
    Cylinder: jest.fn(),
    Trimesh: jest.fn(),
    Sphere: jest.fn(),
    Quaternion: jest.fn(() => ({ setFromAxisAngle: jest.fn(() => ({ x: 0, y: 0, z: 0, w: 1 })) })),
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

// Mock MechanicRegistry (not the focus of this test)
jest.mock('../../mechanics/MechanicRegistry', () => ({
  createMechanic: jest.fn(() => null),
  registerMechanic: jest.fn()
}));

// HeroPropFactory mock — configured per test
const mockCreateHeroProp = jest.fn(() => []);
jest.mock('../../objects/HeroPropFactory', () => ({
  createHeroProp: (...args) => mockCreateHeroProp(...args)
}));

import { HoleEntity } from '../../objects/HoleEntity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    addContactMaterial: jest.fn(),
    step: jest.fn(),
    groundMaterial: { name: 'ground' },
    bodies: []
  };
}

function makeMockScene() {
  return {
    add: jest.fn(),
    remove: jest.fn(),
    children: []
  };
}

function makeMinimalHoleConfig(overrides = {}) {
  const THREE = require('three');
  return {
    index: 0,
    startPosition: new THREE.Vector3(0, 0, -5),
    holePosition: new THREE.Vector3(0, 0, 5),
    boundaryShape: [
      { x: -3, y: -10 },
      { x: -3, y: 10 },
      { x: 3, y: 10 },
      { x: 3, y: -10 }
    ],
    ...overrides
  };
}

function makeMockMesh(name = '') {
  return {
    name,
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0 },
    geometry: { dispose: jest.fn() },
    material: { dispose: jest.fn() },
    parent: null
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HoleEntity hero prop creation (integration)', () => {
  let world, scene;

  beforeEach(() => {
    world = makeMockWorld();
    scene = makeMockScene();
    mockCreateHeroProp.mockReset();
    mockCreateHeroProp.mockReturnValue([]);
    jest.clearAllMocks();
  });

  describe('init() with heroProps config', () => {
    it('calls HeroPropFactory.createHeroProp for each hero prop entry', async () => {
      const heroProps = [
        { type: 'rocket_stand', position: { x: -5, y: 0, z: 8 }, scale: 2 },
        { type: 'moon_rover', position: { x: 3, y: 0, z: -4 }, scale: 1 }
      ];
      const config = makeMinimalHoleConfig({ heroProps });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      expect(mockCreateHeroProp).toHaveBeenCalledTimes(2);
      expect(mockCreateHeroProp).toHaveBeenCalledWith(hole.group, heroProps[0]);
      expect(mockCreateHeroProp).toHaveBeenCalledWith(hole.group, heroProps[1]);
    });

    it('adds hero prop meshes to the HoleEntity meshes array', async () => {
      const mesh1 = makeMockMesh('rocket_body');
      const mesh2 = makeMockMesh('rocket_nose');
      const mesh3 = makeMockMesh('rover_body');

      mockCreateHeroProp.mockReturnValueOnce([mesh1, mesh2]).mockReturnValueOnce([mesh3]);

      const config = makeMinimalHoleConfig({
        heroProps: [
          { type: 'rocket_stand', position: { x: 0, y: 0, z: 0 } },
          { type: 'moon_rover', position: { x: 1, y: 0, z: 1 } }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      expect(hole.meshes).toEqual(expect.arrayContaining([mesh1, mesh2, mesh3]));
    });
  });

  describe('empty or missing heroProps', () => {
    it('works without errors when heroProps is an empty array', async () => {
      const config = makeMinimalHoleConfig({ heroProps: [] });

      const hole = new HoleEntity(world, config, scene);
      await expect(hole.init()).resolves.not.toThrow();

      expect(mockCreateHeroProp).not.toHaveBeenCalled();
    });

    it('works without errors when heroProps is not present in config', async () => {
      const config = makeMinimalHoleConfig();
      delete config.heroProps;

      const hole = new HoleEntity(world, config, scene);
      await expect(hole.init()).resolves.not.toThrow();

      expect(mockCreateHeroProp).not.toHaveBeenCalled();
    });
  });

  describe('destroy() cleans up hero prop meshes', () => {
    it('disposes geometry and material for hero prop meshes on destroy', async () => {
      const mesh1 = makeMockMesh('prop_mesh_1');
      const mesh2 = makeMockMesh('prop_mesh_2');

      mockCreateHeroProp.mockReturnValue([mesh1, mesh2]);

      const config = makeMinimalHoleConfig({
        heroProps: [{ type: 'rocket_stand', position: { x: 0, y: 0, z: 0 } }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Set parent to match containerGroup so remove() is called
      const containerGroup = hole.parentGroup || hole.group;
      mesh1.parent = containerGroup;
      mesh2.parent = containerGroup;

      hole.destroy();

      expect(mesh1.geometry.dispose).toHaveBeenCalled();
      expect(mesh1.material.dispose).toHaveBeenCalled();
      expect(mesh2.geometry.dispose).toHaveBeenCalled();
      expect(mesh2.material.dispose).toHaveBeenCalled();
      expect(containerGroup.remove).toHaveBeenCalledWith(mesh1);
      expect(containerGroup.remove).toHaveBeenCalledWith(mesh2);
    });

    it('clears meshes array after destroy', async () => {
      const mesh = makeMockMesh('prop');
      mockCreateHeroProp.mockReturnValue([mesh]);

      const config = makeMinimalHoleConfig({
        heroProps: [{ type: 'rocket_stand', position: { x: 0, y: 0, z: 0 } }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      hole.destroy();

      expect(hole.meshes).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('continues creating remaining props if one fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const goodMesh = makeMockMesh('good_prop');
      mockCreateHeroProp
        .mockImplementationOnce(() => {
          throw new Error('prop creation failed');
        })
        .mockReturnValueOnce([goodMesh]);

      const config = makeMinimalHoleConfig({
        heroProps: [
          { type: 'bad_prop', position: { x: 0, y: 0, z: 0 } },
          { type: 'good_prop', position: { x: 1, y: 0, z: 1 } }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      expect(mockCreateHeroProp).toHaveBeenCalledTimes(2);
      expect(hole.meshes).toEqual(expect.arrayContaining([goodMesh]));
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create hero prop'),
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });
  });

  describe('full lifecycle', () => {
    it('creates props on init, tracks meshes, and cleans up on destroy', async () => {
      const mesh1 = makeMockMesh('lifecycle_mesh_1');
      const mesh2 = makeMockMesh('lifecycle_mesh_2');
      mockCreateHeroProp.mockReturnValue([mesh1, mesh2]);

      const config = makeMinimalHoleConfig({
        heroProps: [{ type: 'satellite_dish', position: { x: 2, y: 0, z: 3 }, scale: 1.5 }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Verify creation
      expect(mockCreateHeroProp).toHaveBeenCalledTimes(1);
      expect(hole.meshes).toEqual(expect.arrayContaining([mesh1, mesh2]));

      // Set parent for cleanup path
      const containerGroup = hole.parentGroup || hole.group;
      mesh1.parent = containerGroup;
      mesh2.parent = containerGroup;

      // Destroy
      hole.destroy();

      expect(mesh1.geometry.dispose).toHaveBeenCalled();
      expect(mesh2.geometry.dispose).toHaveBeenCalled();
      expect(hole.meshes).toEqual([]);
    });
  });
});
