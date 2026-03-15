/**
 * Unit tests for WallElement
 */

import { WallElement } from '../../objects/WallElement';
import { BaseElement } from '../../objects/BaseElement';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Mock BaseElement
jest.mock('../../objects/BaseElement', () => ({
  BaseElement: jest.fn(function (world, config, scene) {
    this.world = world;
    this.config = config;
    this.scene = scene;
    this.id = config.id || 'test-id';
    this.name = config.name || 'Test Element';
    this.elementType = config.type || 'generic';
    this.position = config.position || { x: 0, y: 0, z: 0 };
    this.meshes = [];
    this.bodies = [];
    this.group = { position: { copy: jest.fn() } };
  })
}));

// Mock THREE.js
jest.mock('three', () => {
  const mockVector3 = jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.clone = jest.fn(() => new mockVector3(this.x, this.y, this.z));
    this.copy = jest.fn();
    this.set = jest.fn();
  });

  return {
    Vector3: mockVector3,
    BoxGeometry: jest.fn(() => ({ dispose: jest.fn() })),
    MeshLambertMaterial: jest.fn(() => ({ dispose: jest.fn() })),
    MeshStandardMaterial: jest.fn(() => ({ dispose: jest.fn() })),
    EdgesGeometry: jest.fn(() => ({ dispose: jest.fn() })),
    LineBasicMaterial: jest.fn(() => ({ dispose: jest.fn() })),
    LineSegments: jest.fn(function (geometry, material) {
      this.geometry = geometry;
      this.material = material;
    }),
    Color: jest.fn(function (color) {
      this.r = 1;
      this.g = 1;
      this.b = 1;
      this.lerp = jest.fn(() => this);
    }),
    DoubleSide: 'DoubleSide',
    Mesh: jest.fn(function (geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { copy: jest.fn(), set: jest.fn(), y: 0 };
      this.rotation = { y: 0 };
      this.userData = {};
      this.castShadow = false;
      this.receiveShadow = false;
      this.add = jest.fn();
    })
  };
});

// Mock CANNON.js
jest.mock('cannon-es', () => {
  const mockBody = jest.fn(function (options) {
    this.mass = options?.mass || 0;
    this.type = options?.type || 'dynamic';
    this.position = options?.position || { copy: jest.fn(), set: jest.fn() };
    this.quaternion = { setFromAxisAngle: jest.fn() };
    this.material = options?.material;
    this.userData = {};
    this.addShape = jest.fn();
  });

  mockBody.STATIC = 'static';

  return {
    Box: jest.fn(() => ({ calculateLocalInertia: jest.fn(() => ({ x: 0, y: 0, z: 0 })) })),
    Body: mockBody,
    Vec3: jest.fn(function (x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    })
  };
});

describe('WallElement', () => {
  let wallElement;
  let mockWorld;
  let mockScene;
  let mockConfig;

  beforeEach(() => {
    // Mock world
    mockWorld = {
      addBody: jest.fn(),
      removeBody: jest.fn(),
      defaultMaterial: { name: 'default' },
      bumperMaterial: { name: 'bumper' }
    };

    // Mock scene
    mockScene = {
      add: jest.fn(),
      remove: jest.fn()
    };

    // Mock config
    mockConfig = {
      id: 'test-wall',
      name: 'Test Wall',
      position: new THREE.Vector3(5, 0, 5),
      width: 6,
      height: 2,
      depth: 0.3,
      rotation: Math.PI / 4,
      color: 0xff0000
    };

    // Clear all mocks
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Mock BaseElement prototype methods
    BaseElement.prototype.create = jest.fn(() => true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with provided config', () => {
      wallElement = new WallElement(mockWorld, mockConfig, mockScene);

      expect(BaseElement).toHaveBeenCalledWith(
        mockWorld,
        expect.objectContaining({
          type: 'wall',
          name: 'Test Wall',
          position: mockConfig.position
        }),
        mockScene
      );

      expect(wallElement.width).toBe(6);
      expect(wallElement.height).toBe(2);
      expect(wallElement.depth).toBe(0.3);
      expect(wallElement.rotation).toBe(Math.PI / 4);
      expect(wallElement.color).toBe(0xff0000);
    });

    test('should use default values when config properties missing', () => {
      const minimalConfig = { id: 'minimal-wall' };

      wallElement = new WallElement(mockWorld, minimalConfig, mockScene);

      expect(wallElement.width).toBe(4);
      expect(wallElement.height).toBe(1.0);
      expect(wallElement.depth).toBe(0.2);
      expect(wallElement.rotation).toBe(0);
      expect(wallElement.color).toBe(0xa0522d);
    });

    test('should set default name when not provided', () => {
      const configWithoutName = { id: 'test' };

      wallElement = new WallElement(mockWorld, configWithoutName, mockScene);

      expect(BaseElement).toHaveBeenCalledWith(
        mockWorld,
        expect.objectContaining({
          name: 'Wall'
        }),
        mockScene
      );
    });

    test('should set default position when not provided', () => {
      const configWithoutPosition = { id: 'test' };

      wallElement = new WallElement(mockWorld, configWithoutPosition, mockScene);

      expect(BaseElement).toHaveBeenCalledWith(
        mockWorld,
        expect.objectContaining({
          position: expect.any(THREE.Vector3)
        }),
        mockScene
      );
    });

    test('should preserve existing position from config', () => {
      const position = new THREE.Vector3(10, 5, 15);
      const configWithPosition = { ...mockConfig, position };

      wallElement = new WallElement(mockWorld, configWithPosition, mockScene);

      expect(BaseElement).toHaveBeenCalledWith(
        mockWorld,
        expect.objectContaining({
          position
        }),
        mockScene
      );
    });
  });

  describe('create', () => {
    beforeEach(() => {
      wallElement = new WallElement(mockWorld, mockConfig, mockScene);

      // Mock the methods that create() calls
      wallElement.createVisuals = jest.fn();
      wallElement.createPhysics = jest.fn();
    });

    test('should call base create method', () => {
      wallElement.create();

      expect(BaseElement.prototype.create).toHaveBeenCalled();
    });

    test('should log creation message', () => {
      wallElement.create();

      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[WallElement] Creating wall Test Wall');
    });

    test('should call createVisuals', () => {
      wallElement.create();

      expect(wallElement.createVisuals).toHaveBeenCalled();
    });

    test('should call createPhysics', () => {
      wallElement.create();

      expect(wallElement.createPhysics).toHaveBeenCalled();
    });

    test('should return true', () => {
      const result = wallElement.create();

      expect(result).toBe(true);
    });
  });

  describe('createVisuals', () => {
    beforeEach(() => {
      wallElement = new WallElement(mockWorld, mockConfig, mockScene);
      // Mock required properties that would be set by BaseElement
      wallElement.group = { add: jest.fn() };
      wallElement.meshes = [];
    });

    test('should create geometry with correct dimensions', () => {
      wallElement.createVisuals();

      expect(THREE.BoxGeometry).toHaveBeenCalledWith(
        wallElement.width,
        wallElement.height,
        wallElement.depth
      );
    });

    test('should create material with correct color', () => {
      wallElement.createVisuals();

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith({
        color: wallElement.color,
        roughness: 0.7,
        metalness: 0.2,
        side: THREE.DoubleSide
      });
    });

    test('should create mesh and configure it', () => {
      wallElement.createVisuals();

      expect(THREE.Mesh).toHaveBeenCalled();

      // Check that a mesh was created and configured
      const meshCalls = THREE.Mesh.mock.instances;
      expect(meshCalls.length).toBeGreaterThan(0);

      const mesh = meshCalls[0];
      expect(mesh.position.y).toBe(wallElement.height / 2);
      expect(mesh.rotation.y).toBe(wallElement.rotation);
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    });

    test('should add mesh to group and meshes array', () => {
      wallElement.createVisuals();

      expect(wallElement.group.add).toHaveBeenCalled();
      expect(wallElement.meshes).toHaveLength(1);
    });

    test('should add wall details to mesh', () => {
      wallElement.createVisuals();

      const mesh = THREE.Mesh.mock.instances[0];
      // Check that addWallDetails was called which adds edge geometry
      expect(THREE.EdgesGeometry).toHaveBeenCalled();
      expect(THREE.LineBasicMaterial).toHaveBeenCalled();
      expect(THREE.LineSegments).toHaveBeenCalled();
      expect(mesh.add).toHaveBeenCalled();
    });
  });

  describe('createPhysics', () => {
    beforeEach(() => {
      wallElement = new WallElement(mockWorld, mockConfig, mockScene);
      wallElement.bodies = [];
    });

    test('should create physics shape with correct dimensions', () => {
      wallElement.createPhysics();

      expect(CANNON.Box).toHaveBeenCalledWith(
        new CANNON.Vec3(wallElement.width / 2, wallElement.height / 2, wallElement.depth / 2)
      );
    });

    test('should create physics body with zero mass', () => {
      wallElement.createPhysics();

      expect(CANNON.Body).toHaveBeenCalledWith({
        mass: 0,
        type: CANNON.Body.STATIC,
        material: mockWorld.bumperMaterial,
        position: expect.any(CANNON.Vec3)
      });
    });

    test('should configure physics body', () => {
      wallElement.createPhysics();

      const body = CANNON.Body.mock.instances[0];
      expect(body.addShape).toHaveBeenCalled();
      expect(body.quaternion.setFromAxisAngle).toHaveBeenCalledWith(
        expect.any(CANNON.Vec3),
        wallElement.rotation
      );
    });

    test('should set userData on physics body', () => {
      wallElement.createPhysics();

      const body = CANNON.Body.mock.instances[0];
      expect(body.userData.elementType).toBe('wall');
      expect(body.userData.elementId).toBe(wallElement.id);
    });

    test('should add body to world and bodies array', () => {
      wallElement.createPhysics();

      expect(mockWorld.addBody).toHaveBeenCalled();
      expect(wallElement.bodies).toHaveLength(1);
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete wall creation lifecycle', () => {
      wallElement = new WallElement(mockWorld, mockConfig, mockScene);

      // Mock methods
      wallElement.createVisuals = jest.fn();
      wallElement.createPhysics = jest.fn();

      // Create the wall
      const result = wallElement.create();

      expect(result).toBe(true);
      expect(BaseElement.prototype.create).toHaveBeenCalled();
      expect(wallElement.createVisuals).toHaveBeenCalled();
      expect(wallElement.createPhysics).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[WallElement] Creating wall Test Wall');
    });

    test('should handle minimal configuration', () => {
      const minimalConfig = {};

      wallElement = new WallElement(mockWorld, minimalConfig, mockScene);

      expect(wallElement.width).toBe(4);
      expect(wallElement.height).toBe(1.0);
      expect(wallElement.depth).toBe(0.2);
      expect(wallElement.rotation).toBe(0);
      expect(wallElement.color).toBe(0xa0522d);
    });

    test('should extend BaseElement correctly', () => {
      wallElement = new WallElement(mockWorld, mockConfig, mockScene);

      expect(wallElement).toBeInstanceOf(BaseElement);
      expect(wallElement.elementType).toBe('wall');
    });
  });
});
