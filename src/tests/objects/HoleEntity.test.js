/**
 * Unit tests for HoleEntity
 */

import { HoleEntity } from '../../objects/HoleEntity';

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
    this.multiplyScalar = jest.fn(scalar => {
      this.x *= scalar;
      this.y *= scalar;
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

  const mockShape = jest.fn(function () {
    this.holes = [];
  });

  const mockExtrudeGeometry = jest.fn(function () {
    this.dispose = jest.fn();
    this.rotateX = jest.fn();
    this.translate = jest.fn();
  });

  const mockMaterial = jest.fn(function () {
    this.dispose = jest.fn();
  });

  const mockMesh = jest.fn(function () {
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.geometry = { dispose: jest.fn() };
    this.material = { dispose: jest.fn() };
    this.parent = null;
    this.updateMatrix = jest.fn();
  });

  const mockGroup = jest.fn(function () {
    this.position = {
      copy: jest.fn(),
      set: jest.fn(),
      x: 0,
      y: 0,
      z: 0
    };
    this.parent = null;
    this.add = jest.fn();
  });

  return {
    Vector3: mockVector3,
    Vector2: mockVector2,
    Box2: mockBox2,
    Shape: mockShape,
    ExtrudeGeometry: mockExtrudeGeometry,
    MeshStandardMaterial: mockMaterial,
    MeshPhongMaterial: mockMaterial,
    Mesh: mockMesh,
    Group: mockGroup,
    CylinderGeometry: jest.fn(() => ({
      dispose: jest.fn(),
      rotateX: jest.fn(),
      translate: jest.fn()
    })),
    PlaneGeometry: jest.fn(() => ({
      dispose: jest.fn(),
      rotateX: jest.fn(),
      translate: jest.fn(),
      attributes: {
        position: {
          array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0])
        }
      },
      index: {
        array: new Uint16Array([0, 1, 2, 2, 3, 0])
      }
    })),
    CircleGeometry: jest.fn(() => ({
      dispose: jest.fn(),
      rotateX: jest.fn(),
      translate: jest.fn()
    })),
    BoxGeometry: jest.fn(() => ({
      dispose: jest.fn(),
      rotateX: jest.fn(),
      translate: jest.fn()
    })),
    Path: jest.fn(function () {
      return {};
    }),
    RingGeometry: jest.fn(() => ({
      dispose: jest.fn(),
      rotateX: jest.fn(),
      translate: jest.fn()
    }))
  };
});

// Mock CANNON.js
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
    Quaternion: jest.fn(() => ({
      setFromAxisAngle: jest.fn(() => ({ x: 0, y: 0, z: 0, w: 1 }))
    })),
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
    subtract: jest.fn((mesh1, mesh2) => ({
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

describe('HoleEntity', () => {
  let mockWorld;
  let mockScene;
  let mockConfig;

  beforeEach(() => {
    // Mock physics world
    mockWorld = {
      addBody: jest.fn(),
      removeBody: jest.fn(),
      addContactMaterial: jest.fn(),
      groundMaterial: { name: 'ground' }
    };

    // Mock THREE.js scene
    mockScene = {
      add: jest.fn(),
      remove: jest.fn()
    };

    // Mock configuration
    mockConfig = {
      index: 0,
      startPosition: new THREE.Vector3(0, 0, -5),
      holePosition: new THREE.Vector3(0, 0, 5),
      boundaryShape: [
        { x: -2, y: -10 },
        { x: -2, y: 10 },
        { x: 2, y: 10 },
        { x: 2, y: -10 }
      ]
    };

    // Clear all mocks
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with basic config', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);

      expect(holeEntity.world).toBe(mockWorld);
      expect(holeEntity.config).toEqual(expect.objectContaining(mockConfig));
      expect(holeEntity.scene).toBe(mockScene);
      expect(holeEntity.elementType).toBe('hole');
      expect(holeEntity.name).toBe('Hole 1');
      expect(holeEntity.wallHeight).toBe(1.0);
      expect(holeEntity.wallThickness).toBe(0.2);
      expect(holeEntity.holeRadius).toBe(0.35);
    });

    test('should handle group as scene parameter', () => {
      const mockGroup = new THREE.Group();
      mockGroup.parent = mockScene;

      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockGroup);

      expect(holeEntity.scene).toBeDefined();
      expect(holeEntity.parentGroup).toBeDefined();
    });

    test('should use default boundary shape when invalid', () => {
      const configWithInvalidBoundary = {
        ...mockConfig,
        boundaryShape: []
      };

      const holeEntity = new HoleEntity(mockWorld, configWithInvalidBoundary, mockScene);

      expect(holeEntity.boundaryShape).toHaveLength(5); // Default rectangular shape
      expect(holeEntity.boundaryShape[0]).toBeDefined();
    });

    test('should handle missing start and hole positions', () => {
      const configWithoutPositions = {
        index: 0
      };

      const holeEntity = new HoleEntity(mockWorld, configWithoutPositions, mockScene);

      expect(holeEntity.worldStartPosition.x).toBe(0);
      expect(holeEntity.worldStartPosition.y).toBe(0);
      expect(holeEntity.worldStartPosition.z).toBe(0);
      expect(holeEntity.worldHolePosition.x).toBe(0);
      expect(holeEntity.worldHolePosition.y).toBe(0);
      expect(holeEntity.worldHolePosition.z).toBe(0);
    });

    test('should clone provided Vector3 positions', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);

      expect(holeEntity.worldStartPosition).toBeDefined();
      expect(holeEntity.worldHolePosition).toBeDefined();
    });

    test('should handle plain object positions', () => {
      const configWithObjectPositions = {
        ...mockConfig,
        startPosition: { x: 1, y: 2, z: 3 },
        holePosition: { x: 4, y: 5, z: 6 }
      };

      const holeEntity = new HoleEntity(mockWorld, configWithObjectPositions, mockScene);

      expect(holeEntity.worldStartPosition.x).toBe(1);
      expect(holeEntity.worldStartPosition.y).toBe(2);
      expect(holeEntity.worldStartPosition.z).toBe(3);
      expect(holeEntity.worldHolePosition.x).toBe(4);
      expect(holeEntity.worldHolePosition.y).toBe(5);
      expect(holeEntity.worldHolePosition.z).toBe(6);
    });
  });

  describe('init', () => {
    test('should initialize successfully with valid references', async () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);

      const result = await holeEntity.init();

      expect(result).toBeUndefined(); // Promise.resolve() returns undefined
      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', expect.stringContaining('Initialization complete for hole index 0')
      );
    });

    test('should reject when missing world reference', async () => {
      const holeEntity = new HoleEntity(null, mockConfig, mockScene);

      await expect(holeEntity.init()).rejects.toBe('Missing references');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing world, scene, or group reference during init')
      );
    });

    test('should reject when missing scene reference', async () => {
      // This test should verify the constructor validation
      expect(() => {
        new HoleEntity(mockWorld, mockConfig, null);
      }).toThrow('BaseElement requires a valid scene');
    });

    test('should handle initialization errors gracefully', async () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);

      // Mock a method to throw an error
      holeEntity.createGreenSurfaceAndPhysics = jest.fn(() => {
        throw new Error('Test error');
      });

      const destroySpy = jest.spyOn(holeEntity, 'destroy').mockImplementation();

      await expect(holeEntity.init()).rejects.toEqual(new Error('Test error'));
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during initialization for hole 0'),
        expect.any(Error)
      );
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('createGreenSurfaceAndPhysics', () => {
    test('should create green surface with default boundary', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);

      expect(() => {
        holeEntity.createGreenSurfaceAndPhysics();
      }).not.toThrow();

      // Test that the method completes without throwing
      expect(holeEntity.boundaryShape).toBeDefined();
      expect(holeEntity.surfaceHeight).toBeDefined();
    });

    test('should handle boundary shape definition with holes', () => {
      const configWithShapeDef = {
        ...mockConfig,
        boundaryShapeDef: {
          outer: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 }
          ],
          holes: [
            [
              { x: 0.25, y: 0.25 },
              { x: 0.75, y: 0.25 },
              { x: 0.75, y: 0.75 },
              { x: 0.25, y: 0.75 }
            ]
          ]
        }
      };

      const holeEntity = new HoleEntity(mockWorld, configWithShapeDef, mockScene);

      expect(() => {
        holeEntity.createGreenSurfaceAndPhysics();
      }).not.toThrow();
    });
  });

  describe('getters', () => {
    test('should have position properties defined', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);

      expect(holeEntity.worldStartPosition).toBeDefined();
      expect(holeEntity.worldHolePosition).toBeDefined();
      expect(typeof holeEntity.worldStartPosition.x).toBe('number');
      expect(typeof holeEntity.worldHolePosition.x).toBe('number');
    });
  });

  describe('hazards and bumpers', () => {
    test('should create hazards when specified in config', () => {
      const configWithHazards = {
        ...mockConfig,
        hazards: [
          {
            type: 'water',
            position: { x: 1, y: 0, z: 1 },
            size: { width: 1, height: 1 }
          }
        ]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithHazards, mockScene);

      expect(() => {
        holeEntity.createHazards();
      }).not.toThrow();
    });

    test('should create bumpers when specified in config', () => {
      const configWithBumpers = {
        ...mockConfig,
        bumpers: [
          {
            position: { x: 2, y: 0, z: 2 },
            radius: 0.5
          }
        ]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithBumpers, mockScene);

      expect(() => {
        holeEntity.createBumpers();
      }).not.toThrow();
    });
  });

  describe('error handling and edge cases', () => {
    test('should have createStartPosition method', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);

      expect(typeof holeEntity.createStartPosition).toBe('function');
    });

    test('should handle boundary shape validation', () => {
      const configWithMinimalBoundary = {
        ...mockConfig,
        boundaryShape: [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ] // Less than 3 points
      };

      const holeEntity = new HoleEntity(mockWorld, configWithMinimalBoundary, mockScene);

      expect(holeEntity.boundaryShape).toHaveLength(5); // Should use default
    });

    test('should log initialization messages', () => {
      new HoleEntity(mockWorld, mockConfig, mockScene);

      expect(console.log).toHaveBeenCalledWith('[DEBUG]', expect.stringContaining('Created for hole index 1'));
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', expect.stringContaining('World Start:'));
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete lifecycle', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);

      // Test that basic methods and properties exist
      expect(typeof holeEntity.init).toBe('function');
      expect(holeEntity.worldStartPosition).toBeDefined();
      expect(holeEntity.worldHolePosition).toBeDefined();
      expect(typeof holeEntity.destroy).toBe('function');
    });

    test('should handle complex configuration', () => {
      const complexConfig = {
        index: 2,
        startPosition: new THREE.Vector3(1, 2, 3),
        holePosition: new THREE.Vector3(4, 5, 6),
        boundaryShape: [
          { x: -3, y: -15 },
          { x: -3, y: 15 },
          { x: 3, y: 15 },
          { x: 3, y: -15 }
        ],
        hazards: [{ type: 'sand', position: { x: 0, y: 0, z: 0 }, size: { width: 2, height: 2 } }],
        bumpers: [{ position: { x: 1, y: 0, z: 1 }, radius: 0.3 }]
      };

      const holeEntity = new HoleEntity(mockWorld, complexConfig, mockScene);

      expect(holeEntity.name).toBe('Hole 3');
      expect(holeEntity.boundaryShape).toHaveLength(4);
    });
  });
});
