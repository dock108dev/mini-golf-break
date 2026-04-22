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
    this.remove = jest.fn();
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
    })),
    SphereGeometry: jest.fn(() => ({
      dispose: jest.fn()
    })),
    MeshBasicMaterial: jest.fn(function () {
      this.dispose = jest.fn();
    }),
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

// Mock GreenSurfaceBuilder
const mockBuildGreenSurface = jest.fn(() => ({ meshes: [], bodies: [] }));
jest.mock('../../objects/GreenSurfaceBuilder', () => ({
  buildGreenSurface: (...args) => mockBuildGreenSurface(...args)
}));

// Mock HazardFactory
const mockCreateHazard = jest.fn(() => ({ meshes: [], bodies: [] }));
jest.mock('../../objects/hazards/HazardFactory', () => ({
  createHazard: (...args) => mockCreateHazard(...args)
}));

// Mock MechanicRegistry
const mockCreateMechanic = jest.fn();
jest.mock('../../mechanics/MechanicRegistry', () => ({
  createMechanic: (...args) => mockCreateMechanic(...args)
}));

// Mock mechanics barrel import (self-registration)
jest.mock('../../mechanics/index', () => ({}));

// Mock HeroPropFactory
jest.mock('../../objects/HeroPropFactory', () => ({
  createHeroProp: jest.fn(() => [])
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

    // Reset factory mocks with default returns
    mockBuildGreenSurface.mockReturnValue({ meshes: [], bodies: [] });
    mockCreateHazard.mockReturnValue({ meshes: [], bodies: [] });

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
        '[DEBUG]',
        expect.stringContaining('Initialization complete for hole index 0')
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
    test('should call buildGreenSurface with the provided hole config', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      holeEntity.createGreenSurfaceAndPhysics();

      expect(mockBuildGreenSurface).toHaveBeenCalledTimes(1);
      expect(mockBuildGreenSurface).toHaveBeenCalledWith(
        expect.objectContaining({
          config: holeEntity.config,
          world: mockWorld,
          group: holeEntity.group,
          worldHolePosition: holeEntity.worldHolePosition,
          surfaceHeight: holeEntity.surfaceHeight,
          boundaryShape: holeEntity.boundaryShape
        })
      );
    });

    test('should track meshes and bodies returned by GreenSurfaceBuilder', () => {
      const greenMesh = {
        geometry: { dispose: jest.fn() },
        material: { dispose: jest.fn() },
        parent: null
      };
      const greenBody = { position: { x: 0, y: 0, z: 0 } };
      mockBuildGreenSurface.mockReturnValue({
        meshes: [greenMesh],
        bodies: [greenBody]
      });

      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      holeEntity.createGreenSurfaceAndPhysics();

      expect(holeEntity.meshes).toContain(greenMesh);
      expect(holeEntity.bodies).toContain(greenBody);
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

      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]',
        expect.stringContaining('Created for hole index 1')
      );
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', expect.stringContaining('World Start:'));
    });
  });

  describe('createFloorGrid', () => {
    test('adds one entry to meshes', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      const before = holeEntity.meshes.length;
      holeEntity.createFloorGrid();
      expect(holeEntity.meshes.length).toBe(before + 1);
    });

    test('does not throw when boundaryShape is empty', () => {
      const configEmpty = { ...mockConfig, boundaryShape: [] };
      const holeEntity = new HoleEntity(mockWorld, configEmpty, mockScene);
      expect(() => holeEntity.createFloorGrid()).not.toThrow();
    });
  });

  describe('createLaneMarkers', () => {
    test('creates a lane marker mesh for hole index 0', async () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      const prevMeshCount = holeEntity.meshes.length;
      await holeEntity.init();

      const markerAdded = holeEntity.meshes.length > prevMeshCount;
      expect(markerAdded).toBe(true);
    });

    test('lane markers created for holes 0-3 but not hole 4', async () => {
      const makeEntity = index => {
        const cfg = { ...mockConfig, index };
        const e = new HoleEntity(mockWorld, cfg, mockScene);
        e.createLaneMarkers = jest.fn();
        return e;
      };

      for (let i = 0; i <= 3; i++) {
        const e = makeEntity(i);
        await e.init();
        expect(e.createLaneMarkers).toHaveBeenCalledTimes(1);
      }

      const e4 = makeEntity(4);
      await e4.init();
      expect(e4.createLaneMarkers).not.toHaveBeenCalled();
    });

    test('skips lane marker when tee and cup are at same XZ', () => {
      const configSamePos = {
        ...mockConfig,
        startPosition: { x: 0, y: 0, z: 0 },
        holePosition: { x: 0, y: 0, z: 0 }
      };
      const holeEntity = new HoleEntity(mockWorld, configSamePos, mockScene);
      expect(() => holeEntity.createLaneMarkers()).not.toThrow();
    });
  });

  describe('mechanics lifecycle', () => {
    let mockMechanic;

    beforeEach(() => {
      mockMechanic = {
        update: jest.fn(),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: []
      };
      mockCreateMechanic.mockReset();
    });

    test('init() with mechanics[] config calls createMechanic for each entry', async () => {
      mockCreateMechanic.mockReturnValue(mockMechanic);

      const configWithMechanics = {
        ...mockConfig,
        mechanics: [
          { type: 'moving_sweeper', speed: 1 },
          { type: 'boost_strip', force: 5 }
        ]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithMechanics, mockScene);
      await holeEntity.init();

      expect(mockCreateMechanic).toHaveBeenCalledTimes(2);
      expect(mockCreateMechanic).toHaveBeenCalledWith(
        'moving_sweeper',
        mockWorld,
        expect.anything(),
        expect.objectContaining({ type: 'moving_sweeper', speed: 1 }),
        expect.any(Number),
        expect.any(Object)
      );
      expect(mockCreateMechanic).toHaveBeenCalledWith(
        'boost_strip',
        mockWorld,
        expect.anything(),
        expect.objectContaining({ type: 'boost_strip', force: 5 }),
        expect.any(Number),
        expect.any(Object)
      );
      expect(holeEntity.mechanics).toHaveLength(2);
    });

    test('update(dt, ballBody) calls update() on each mechanic', async () => {
      const mockMechanic2 = {
        update: jest.fn(),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => [])
      };
      mockCreateMechanic.mockReturnValueOnce(mockMechanic).mockReturnValueOnce(mockMechanic2);

      const configWithMechanics = {
        ...mockConfig,
        mechanics: [{ type: 'moving_sweeper' }, { type: 'boost_strip' }]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithMechanics, mockScene);
      await holeEntity.init();

      const mockBallBody = { position: { x: 0, y: 0, z: 0 } };
      holeEntity.update(0.016, mockBallBody);

      expect(mockMechanic.update).toHaveBeenCalledWith(0.016, mockBallBody);
      expect(mockMechanic2.update).toHaveBeenCalledWith(0.016, mockBallBody);
    });

    test('destroy() calls destroy() on each mechanic', async () => {
      const mockMechanic2 = {
        update: jest.fn(),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => [])
      };
      mockCreateMechanic.mockReturnValueOnce(mockMechanic).mockReturnValueOnce(mockMechanic2);

      const configWithMechanics = {
        ...mockConfig,
        mechanics: [{ type: 'moving_sweeper' }, { type: 'boost_strip' }]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithMechanics, mockScene);
      await holeEntity.init();

      holeEntity.destroy();

      expect(mockMechanic.destroy).toHaveBeenCalled();
      expect(mockMechanic2.destroy).toHaveBeenCalled();
      expect(holeEntity.mechanics).toEqual([]);
    });

    test('works without errors when mechanics[] is empty', async () => {
      const configEmpty = {
        ...mockConfig,
        mechanics: []
      };

      const holeEntity = new HoleEntity(mockWorld, configEmpty, mockScene);
      await holeEntity.init();

      expect(mockCreateMechanic).not.toHaveBeenCalled();
      expect(holeEntity.mechanics).toEqual([]);

      // update and destroy should not throw
      expect(() => holeEntity.update(0.016, {})).not.toThrow();
      expect(() => holeEntity.destroy()).not.toThrow();
    });

    test('works without errors when mechanics config is missing', async () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      await holeEntity.init();

      expect(mockCreateMechanic).not.toHaveBeenCalled();
      expect(holeEntity.mechanics).toEqual([]);

      expect(() => holeEntity.update(0.016, {})).not.toThrow();
      expect(() => holeEntity.destroy()).not.toThrow();
    });

    test('logs error with hole index and type when createMechanic returns null (unknown type)', async () => {
      mockCreateMechanic.mockReturnValue(null);

      const configWithInvalid = {
        ...mockConfig,
        mechanics: [{ type: 'nonexistent_type' }]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithInvalid, mockScene);
      await holeEntity.init();

      expect(mockCreateMechanic).toHaveBeenCalledWith(
        'nonexistent_type',
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ type: 'nonexistent_type' }),
        expect.any(Number),
        expect.any(Object)
      );
      // null return means mechanic not added
      expect(holeEntity.mechanics).toEqual([]);
      // Error message should contain both hole index and mechanic type in the same call
      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/Hole 0.*nonexistent_type/));
    });

    test('logs error with hole index and type when createMechanic throws', async () => {
      mockCreateMechanic
        .mockImplementationOnce(() => {
          throw new Error('Bad mechanic');
        })
        .mockReturnValueOnce(mockMechanic);

      const configWithBadAndGood = {
        ...mockConfig,
        mechanics: [{ type: 'broken_type' }, { type: 'working_type' }]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithBadAndGood, mockScene);
      await holeEntity.init();

      // Error log must include both hole index and mechanic type
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/Hole 0.*broken_type/),
        expect.any(Error)
      );
      // The working mechanic should still be created (graceful degradation)
      expect(holeEntity.mechanics).toHaveLength(1);
    });

    test('remaining mechanics still initialize when one fails in the middle', async () => {
      const mockMechanic2 = {
        update: jest.fn(),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: []
      };

      mockCreateMechanic
        .mockReturnValueOnce(mockMechanic) // first: succeeds
        .mockImplementationOnce(() => {
          throw new Error('Kaboom');
        }) // second: throws
        .mockReturnValueOnce(null) // third: unknown type (null)
        .mockReturnValueOnce(mockMechanic2); // fourth: succeeds

      const config = {
        ...mockConfig,
        mechanics: [
          { type: 'good_a' },
          { type: 'throws_type' },
          { type: 'unknown_type' },
          { type: 'good_b' }
        ]
      };

      const holeEntity = new HoleEntity(mockWorld, config, mockScene);
      await holeEntity.init();

      // Both successful mechanics should be tracked
      expect(holeEntity.mechanics).toHaveLength(2);
      expect(holeEntity.mechanics[0]).toBe(mockMechanic);
      expect(holeEntity.mechanics[1]).toBe(mockMechanic2);

      // Errors logged for both failures
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/Hole 0.*throws_type/),
        expect.any(Error)
      );
      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/Hole 0.*unknown_type/));

      // All four mechanics were attempted
      expect(mockCreateMechanic).toHaveBeenCalledTimes(4);
    });

    test('error log includes correct hole index for non-zero holes', async () => {
      mockCreateMechanic.mockReturnValue(null);

      const configHole5 = {
        ...mockConfig,
        index: 5,
        mechanics: [{ type: 'bad_type' }]
      };

      const holeEntity = new HoleEntity(mockWorld, configHole5, mockScene);
      await holeEntity.init();

      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/Hole 5.*bad_type/));
    });

    test('tracks mechanic meshes and bodies for cleanup', async () => {
      const mechMesh = {
        geometry: { dispose: jest.fn() },
        material: { dispose: jest.fn() },
        parent: null
      };
      const mechBody = { position: { x: 0, y: 0, z: 0 } };
      mockMechanic.getMeshes.mockReturnValue([mechMesh]);
      mockMechanic.getBodies.mockReturnValue([mechBody]);
      mockCreateMechanic.mockReturnValue(mockMechanic);

      const configWithMechanics = {
        ...mockConfig,
        mechanics: [{ type: 'moving_sweeper' }]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithMechanics, mockScene);
      await holeEntity.init();

      expect(holeEntity.meshes).toContain(mechMesh);
      expect(holeEntity.bodies).toContain(mechBody);
    });

    test('update() is safe when mechanics is undefined', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      // Don't call init - mechanics will be undefined
      holeEntity.mechanics = undefined;

      expect(() => holeEntity.update(0.016, {})).not.toThrow();
    });

    test('update() catches mechanic.update() errors and disables failed mechanic', async () => {
      const failingMechanic = {
        update: jest.fn(() => {
          throw new Error('Runtime crash');
        }),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: [],
        config: { type: 'broken_sweeper' }
      };
      mockCreateMechanic.mockReturnValue(failingMechanic);

      const config = {
        ...mockConfig,
        mechanics: [{ type: 'broken_sweeper' }]
      };
      const holeEntity = new HoleEntity(mockWorld, config, mockScene);
      await holeEntity.init();

      const mockBallBody = { position: { x: 0, y: 0, z: 0 } };

      // First update: should catch the error, not throw
      expect(() => holeEntity.update(0.016, mockBallBody)).not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/Hole 0.*broken_sweeper.*disabling/),
        expect.any(Error)
      );
      expect(failingMechanic._failed).toBe(true);

      // Second update: failed mechanic should be skipped entirely
      failingMechanic.update.mockClear();
      console.error.mockClear();
      holeEntity.update(0.016, mockBallBody);
      expect(failingMechanic.update).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test('other mechanics continue when one fails during update', async () => {
      const failingMechanic = {
        update: jest.fn(() => {
          throw new Error('Boom');
        }),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: [],
        config: { type: 'bad_mech' }
      };
      const workingMechanic = {
        update: jest.fn(),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: [],
        config: { type: 'good_mech' }
      };
      mockCreateMechanic.mockReturnValueOnce(failingMechanic).mockReturnValueOnce(workingMechanic);

      const config = {
        ...mockConfig,
        mechanics: [{ type: 'bad_mech' }, { type: 'good_mech' }]
      };
      const holeEntity = new HoleEntity(mockWorld, config, mockScene);
      await holeEntity.init();

      const mockBallBody = { position: { x: 0, y: 0, z: 0 } };
      holeEntity.update(0.016, mockBallBody);

      // Failing mechanic threw but was caught
      expect(failingMechanic._failed).toBe(true);
      // Working mechanic still got called
      expect(workingMechanic.update).toHaveBeenCalledWith(0.016, mockBallBody);
    });

    test('game loop does not crash when multiple mechanics fail', async () => {
      const failMech1 = {
        update: jest.fn(() => {
          throw new Error('Fail 1');
        }),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: [],
        config: { type: 'fail_a' }
      };
      const failMech2 = {
        update: jest.fn(() => {
          throw new Error('Fail 2');
        }),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: [],
        config: { type: 'fail_b' }
      };
      mockCreateMechanic.mockReturnValueOnce(failMech1).mockReturnValueOnce(failMech2);

      const config = {
        ...mockConfig,
        mechanics: [{ type: 'fail_a' }, { type: 'fail_b' }]
      };
      const holeEntity = new HoleEntity(mockWorld, config, mockScene);
      await holeEntity.init();

      const mockBallBody = { position: { x: 0, y: 0, z: 0 } };

      // Both fail on first update but game loop doesn't crash
      expect(() => holeEntity.update(0.016, mockBallBody)).not.toThrow();
      expect(failMech1._failed).toBe(true);
      expect(failMech2._failed).toBe(true);

      // Subsequent updates skip both
      failMech1.update.mockClear();
      failMech2.update.mockClear();
      expect(() => holeEntity.update(0.016, mockBallBody)).not.toThrow();
      expect(failMech1.update).not.toHaveBeenCalled();
      expect(failMech2.update).not.toHaveBeenCalled();
    });

    test('error log includes mechanic type and hole index', async () => {
      const failingMechanic = {
        update: jest.fn(() => {
          throw new Error('Oops');
        }),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: [],
        config: { type: 'portal_gate' }
      };
      mockCreateMechanic.mockReturnValue(failingMechanic);

      const config = {
        ...mockConfig,
        index: 7,
        mechanics: [{ type: 'portal_gate' }]
      };
      const holeEntity = new HoleEntity(mockWorld, config, mockScene);
      await holeEntity.init();

      holeEntity.update(0.016, { position: { x: 0, y: 0, z: 0 } });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Hole 7'),
        expect.any(Error)
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('portal_gate'),
        expect.any(Error)
      );
    });

    test('failed mechanic gets a debug visual indicator', async () => {
      const failingMechanic = {
        update: jest.fn(() => {
          throw new Error('Crash');
        }),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: [],
        config: { type: 'timed_gate', position: { x: 1, y: 0, z: 2 } }
      };
      mockCreateMechanic.mockReturnValue(failingMechanic);

      const config = {
        ...mockConfig,
        mechanics: [{ type: 'timed_gate' }]
      };
      const holeEntity = new HoleEntity(mockWorld, config, mockScene);
      await holeEntity.init();

      const meshCountBefore = holeEntity.meshes.length;
      holeEntity.update(0.016, { position: { x: 0, y: 0, z: 0 } });

      // An indicator mesh should have been added
      expect(holeEntity.meshes.length).toBeGreaterThan(meshCountBefore);
      expect(failingMechanic._failedIndicator).toBeDefined();
      expect(failingMechanic._failedIndicator._isDebugIndicator).toBe(true);
    });
  });

  describe('hero props lifecycle', () => {
    test('should call createHeroProp for each entry in config.heroProps[]', () => {
      const { createHeroProp } = require('../../objects/HeroPropFactory');
      createHeroProp.mockReturnValue([{ geometry: {}, material: {} }]);

      const configWithProps = {
        ...mockConfig,
        heroProps: [
          { type: 'rocket_stand', position: { x: 1, y: 0, z: 2 }, scale: 1.5 },
          { type: 'moon_rover', position: { x: -1, y: 0, z: 3 } }
        ]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithProps, mockScene);
      holeEntity.init();

      expect(createHeroProp).toHaveBeenCalledTimes(2);
      expect(createHeroProp).toHaveBeenCalledWith(holeEntity.group, configWithProps.heroProps[0]);
      expect(createHeroProp).toHaveBeenCalledWith(holeEntity.group, configWithProps.heroProps[1]);
    });

    test('should track hero prop meshes for cleanup', () => {
      const { createHeroProp } = require('../../objects/HeroPropFactory');
      const mockMesh1 = { geometry: { dispose: jest.fn() }, material: { dispose: jest.fn() } };
      const mockMesh2 = { geometry: { dispose: jest.fn() }, material: { dispose: jest.fn() } };
      createHeroProp.mockReturnValue([mockMesh1, mockMesh2]);

      const configWithProps = {
        ...mockConfig,
        heroProps: [{ type: 'rocket_stand', position: { x: 0, y: 0, z: 0 } }]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithProps, mockScene);
      holeEntity.init();

      expect(holeEntity.meshes).toContain(mockMesh1);
      expect(holeEntity.meshes).toContain(mockMesh2);
    });

    test('should not error when heroProps is missing from config', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      expect(() => holeEntity.init()).not.toThrow();
    });

    test('should not error when heroProps is empty array', () => {
      const configWithEmptyProps = { ...mockConfig, heroProps: [] };
      const holeEntity = new HoleEntity(mockWorld, configWithEmptyProps, mockScene);
      expect(() => holeEntity.init()).not.toThrow();
    });

    test('should catch and log error for failing hero prop, continue with others', () => {
      const { createHeroProp } = require('../../objects/HeroPropFactory');
      createHeroProp
        .mockImplementationOnce(() => {
          throw new Error('Bad prop');
        })
        .mockReturnValueOnce([{ geometry: {}, material: {} }]);

      const configWithProps = {
        ...mockConfig,
        heroProps: [
          { type: 'bad_prop', position: { x: 0, y: 0, z: 0 } },
          { type: 'rocket_stand', position: { x: 1, y: 0, z: 1 } }
        ]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithProps, mockScene);
      expect(() => holeEntity.init()).not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create hero prop'),
        expect.any(Error)
      );
      // Second prop should still be created
      expect(createHeroProp).toHaveBeenCalledTimes(2);
    });

    test('should clean up hero prop meshes on destroy', () => {
      const { createHeroProp } = require('../../objects/HeroPropFactory');
      const mockMesh = {
        parent: null,
        geometry: { dispose: jest.fn() },
        material: { dispose: jest.fn() }
      };
      createHeroProp.mockReturnValue([mockMesh]);

      const configWithProps = {
        ...mockConfig,
        heroProps: [{ type: 'rocket_stand', position: { x: 0, y: 0, z: 0 } }]
      };

      const holeEntity = new HoleEntity(mockWorld, configWithProps, mockScene);
      holeEntity.init();

      // Set the mesh parent to the group so destroy can find it
      mockMesh.parent = holeEntity.group;

      holeEntity.destroy();

      expect(mockMesh.geometry.dispose).toHaveBeenCalled();
      expect(mockMesh.material.dispose).toHaveBeenCalled();
      expect(holeEntity.meshes).toHaveLength(0);
    });
  });

  describe('destroy — resource cleanup', () => {
    test('removes all physics bodies from the world', async () => {
      const body1 = { position: { x: 0, y: 0, z: 0 } };
      const body2 = { position: { x: 1, y: 0, z: 1 } };
      mockBuildGreenSurface.mockReturnValue({ meshes: [], bodies: [body1, body2] });

      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      await holeEntity.init();

      holeEntity.destroy();

      expect(mockWorld.removeBody).toHaveBeenCalledWith(body1);
      expect(mockWorld.removeBody).toHaveBeenCalledWith(body2);
      expect(holeEntity.bodies).toHaveLength(0);
    });

    test('disposes geometries and materials for all tracked meshes', async () => {
      const mesh1 = {
        parent: null,
        geometry: { dispose: jest.fn() },
        material: { dispose: jest.fn() }
      };
      const mesh2 = {
        parent: null,
        geometry: { dispose: jest.fn() },
        material: [{ dispose: jest.fn() }, { dispose: jest.fn() }]
      };
      mockBuildGreenSurface.mockReturnValue({ meshes: [mesh1, mesh2], bodies: [] });

      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      await holeEntity.init();

      mesh1.parent = holeEntity.group;
      mesh2.parent = holeEntity.group;

      holeEntity.destroy();

      expect(mesh1.geometry.dispose).toHaveBeenCalled();
      expect(mesh1.material.dispose).toHaveBeenCalled();
      expect(mesh2.geometry.dispose).toHaveBeenCalled();
      mesh2.material.forEach(mat => expect(mat.dispose).toHaveBeenCalled());
      expect(holeEntity.meshes).toHaveLength(0);
    });

    test('calls destroy on each mechanic and clears the list', async () => {
      const mech1 = {
        update: jest.fn(),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => [])
      };
      const mech2 = {
        update: jest.fn(),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => [])
      };
      mockCreateMechanic.mockReturnValueOnce(mech1).mockReturnValueOnce(mech2);

      const config = {
        ...mockConfig,
        mechanics: [{ type: 'a' }, { type: 'b' }]
      };
      const holeEntity = new HoleEntity(mockWorld, config, mockScene);
      await holeEntity.init();

      holeEntity.destroy();

      expect(mech1.destroy).toHaveBeenCalled();
      expect(mech2.destroy).toHaveBeenCalled();
      expect(holeEntity.mechanics).toEqual([]);
    });

    test('handles full lifecycle with GreenSurfaceBuilder bodies and mechanic bodies', async () => {
      const greenBody = { position: { x: 0, y: 0, z: 0 } };
      const mechBody = { position: { x: 1, y: 0, z: 1 } };
      const mechMesh = {
        parent: null,
        geometry: { dispose: jest.fn() },
        material: { dispose: jest.fn() }
      };
      mockBuildGreenSurface.mockReturnValue({ meshes: [], bodies: [greenBody] });

      const mech = {
        update: jest.fn(),
        destroy: jest.fn(),
        getMeshes: jest.fn(() => [mechMesh]),
        getBodies: jest.fn(() => [mechBody])
      };
      mockCreateMechanic.mockReturnValue(mech);

      const config = { ...mockConfig, mechanics: [{ type: 'boost_strip' }] };
      const holeEntity = new HoleEntity(mockWorld, config, mockScene);
      await holeEntity.init();

      expect(holeEntity.bodies).toContain(greenBody);
      expect(holeEntity.bodies).toContain(mechBody);

      holeEntity.destroy();

      expect(mockWorld.removeBody).toHaveBeenCalledWith(greenBody);
      expect(mockWorld.removeBody).toHaveBeenCalledWith(mechBody);
      expect(mech.destroy).toHaveBeenCalled();
    });
  });

  describe('update — dtWasClamped handling', () => {
    test('calls onDtSpike on mechanics when dtWasClamped is true', async () => {
      const mechanic = {
        update: jest.fn(),
        destroy: jest.fn(),
        onDtSpike: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: []
      };
      mockCreateMechanic.mockReturnValue(mechanic);

      const config = { ...mockConfig, mechanics: [{ type: 'timed_gate' }] };
      const holeEntity = new HoleEntity(mockWorld, config, mockScene);
      await holeEntity.init();

      const ballBody = { position: { x: 0, y: 0, z: 0 } };
      holeEntity.update(0.016, ballBody, { dtWasClamped: true });

      expect(mechanic.onDtSpike).toHaveBeenCalled();
      expect(mechanic.update).toHaveBeenCalledWith(0.016, ballBody);
    });

    test('does not call onDtSpike when dtWasClamped is false', async () => {
      const mechanic = {
        update: jest.fn(),
        destroy: jest.fn(),
        onDtSpike: jest.fn(),
        getMeshes: jest.fn(() => []),
        getBodies: jest.fn(() => []),
        meshes: [],
        bodies: []
      };
      mockCreateMechanic.mockReturnValue(mechanic);

      const config = { ...mockConfig, mechanics: [{ type: 'timed_gate' }] };
      const holeEntity = new HoleEntity(mockWorld, config, mockScene);
      await holeEntity.init();

      holeEntity.update(0.016, { position: { x: 0, y: 0, z: 0 } });

      expect(mechanic.onDtSpike).not.toHaveBeenCalled();
    });
  });

  describe('cup halo sprite and point light', () => {
    test('update(dt) changes sprite.material.opacity over two consecutive calls', async () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      await holeEntity.init();

      holeEntity.update(0.016, null);
      const opacity1 = holeEntity._haloSprite.material.opacity;

      holeEntity.update(0.5, null);
      const opacity2 = holeEntity._haloSprite.material.opacity;

      expect(opacity1).not.toEqual(opacity2);
    });

    test('destroy() disposes sprite material and nullifies sprite and light references', async () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      await holeEntity.init();

      const sprite = holeEntity._haloSprite;
      expect(sprite).toBeDefined();
      expect(holeEntity._cupPointLight).toBeDefined();

      holeEntity.destroy();

      expect(sprite.material.dispose).toHaveBeenCalled();
      expect(holeEntity._haloSprite).toBeNull();
      expect(holeEntity._cupPointLight).toBeNull();
    });

    test('sprite and point light are added to the hole group on init', async () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      await holeEntity.init();

      expect(holeEntity.group.add).toHaveBeenCalledWith(holeEntity._haloSprite);
      expect(holeEntity.group.add).toHaveBeenCalledWith(holeEntity._cupPointLight);
    });

    test('halo sprite is not present before init', () => {
      const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
      expect(holeEntity._haloSprite).toBeUndefined();
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
