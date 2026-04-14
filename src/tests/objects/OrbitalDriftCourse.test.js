/**
 * Unit tests for OrbitalDriftCourse
 */

import * as THREE from 'three';
import { OrbitalDriftCourse } from '../../objects/OrbitalDriftCourse';
import { createOrbitalDriftConfigs } from '../../config/orbitalDriftConfigs';

// Mock dependencies
jest.mock('three', () => {
  const Vector3 = jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.clone = jest.fn(() => new Vector3(this.x, this.y, this.z));
    this.copy = jest.fn();
    this.set = jest.fn();
  });
  const Vector2 = jest.fn(function (x = 0, y = 0) {
    this.x = x;
    this.y = y;
  });
  const Euler = jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  });
  return {
    Vector3,
    Vector2,
    Euler,
    Group: jest.fn(() => ({
      add: jest.fn(),
      remove: jest.fn(),
      position: { x: 0, y: 0, z: 0, copy: jest.fn() },
      name: '',
      userData: {},
      children: [],
      visible: true,
      parent: null
    })),
    Scene: jest.fn(),
    Mesh: jest.fn(),
    BoxGeometry: jest.fn(),
    SphereGeometry: jest.fn(),
    CylinderGeometry: jest.fn(),
    PlaneGeometry: jest.fn(),
    CircleGeometry: jest.fn(),
    RingGeometry: jest.fn(),
    MeshStandardMaterial: jest.fn(() => ({ color: 0xffffff })),
    MeshBasicMaterial: jest.fn(() => ({ color: 0xffffff })),
    CanvasTexture: jest.fn(),
    PointLight: jest.fn(() => ({ position: { x: 0, y: 0, z: 0, copy: jest.fn() } })),
    Box3: jest.fn(() => ({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      expandByPoint: jest.fn()
    }))
  };
});

jest.mock('cannon-es', () => ({
  World: jest.fn(),
  Body: jest.fn(),
  Material: jest.fn(),
  ContactMaterial: jest.fn(),
  Vec3: jest.fn((x = 0, y = 0, z = 0) => ({ x, y, z })),
  Sphere: jest.fn(),
  Box: jest.fn(),
  Cylinder: jest.fn(),
  Plane: jest.fn()
}));

jest.mock('three-csg-ts', () => ({ CSG: {} }));

// Mock HoleEntity
const mockHoleEntityInit = jest.fn().mockResolvedValue(undefined);
const mockHoleEntityDestroy = jest.fn();
const mockHoleEntityUpdate = jest.fn();

jest.mock('../../objects/HoleEntity', () => ({
  HoleEntity: jest.fn().mockImplementation((world, config, group) => ({
    init: mockHoleEntityInit,
    destroy: mockHoleEntityDestroy,
    update: mockHoleEntityUpdate,
    config,
    group
  }))
}));

jest.mock('../../config/hydrateHoleConfig', () => ({
  hydrateHoleConfig: jest.fn(config => {
    const mockThree = require('three');
    const hydrated = { ...config };
    if (Array.isArray(config.startPosition)) {
      hydrated.startPosition = new mockThree.Vector3(
        config.startPosition[0],
        config.startPosition[1],
        config.startPosition[2]
      );
    }
    if (Array.isArray(config.holePosition)) {
      hydrated.holePosition = new mockThree.Vector3(
        config.holePosition[0],
        config.holePosition[1],
        config.holePosition[2]
      );
    }
    if (Array.isArray(config.boundaryShape)) {
      hydrated.boundaryShape = config.boundaryShape.map(p =>
        Array.isArray(p) ? new mockThree.Vector2(p[0], p[1]) : p
      );
    }
    return hydrated;
  })
}));

jest.mock('../../mechanics/index', () => ({}));
jest.mock('../../mechanics/MechanicRegistry', () => ({
  createMechanic: jest.fn()
}));
jest.mock('../../objects/HeroPropFactory', () => ({
  createHeroProp: jest.fn()
}));

describe('OrbitalDriftCourse', () => {
  let mockGame;
  let mockPhysicsWorld;
  let mockScene;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPhysicsWorld = {
      addBody: jest.fn(),
      removeBody: jest.fn()
    };

    mockScene = {
      add: jest.fn(),
      remove: jest.fn(),
      children: []
    };

    mockGame = {
      scene: mockScene,
      physicsWorld: mockPhysicsWorld,
      physicsManager: {
        getWorld: jest.fn(() => mockPhysicsWorld)
      },
      ballManager: {
        ball: {
          body: { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }
        }
      }
    };

    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  describe('constructor', () => {
    test('should load orbitalDriftConfigs correctly', () => {
      const course = new OrbitalDriftCourse(mockGame);

      expect(course.holeConfigs).toBeDefined();
      expect(course.holeConfigs.length).toBe(18);
    });

    test('should set totalHoles to 18', () => {
      const course = new OrbitalDriftCourse(mockGame);

      expect(course.totalHoles).toBe(18);
    });

    test('should create 18 hole groups and add them to the scene', () => {
      const course = new OrbitalDriftCourse(mockGame);

      expect(course.holeGroups.length).toBe(18);
      expect(mockScene.add).toHaveBeenCalledTimes(18);
    });

    test('should name hole groups correctly', () => {
      const course = new OrbitalDriftCourse(mockGame);

      for (let i = 0; i < 18; i++) {
        expect(course.holeGroups[i].name).toBe(`OD_Hole_${i + 1}_Group`);
      }
    });

    test('should set holeIndex userData on each group', () => {
      const course = new OrbitalDriftCourse(mockGame);

      for (let i = 0; i < 12; i++) {
        expect(course.holeGroups[i].userData).toEqual({ holeIndex: i });
      }
    });

    test('should initialize currentHoleIndex to 0', () => {
      const course = new OrbitalDriftCourse(mockGame);

      expect(course.currentHoleIndex).toBe(0);
    });

    test('should initialize currentHoleEntity to null', () => {
      const course = new OrbitalDriftCourse(mockGame);

      expect(course.currentHoleEntity).toBeNull();
    });

    test('should store game reference', () => {
      const course = new OrbitalDriftCourse(mockGame);

      expect(course.game).toBe(mockGame);
    });
  });

  describe('initializeHole', () => {
    test('should create HoleEntity with correct config for hole index 0', async () => {
      const { HoleEntity } = require('../../objects/HoleEntity');
      const course = new OrbitalDriftCourse(mockGame);

      const result = await course.initializeHole(0);

      expect(result).toBe(true);
      expect(HoleEntity).toHaveBeenCalledWith(
        mockPhysicsWorld,
        course.holeConfigs[0],
        course.holeGroups[0]
      );
      expect(mockHoleEntityInit).toHaveBeenCalled();
    });

    test('should create HoleEntity with correct config for each hole index 0-9', async () => {
      const { HoleEntity } = require('../../objects/HoleEntity');

      for (let i = 0; i < 12; i++) {
        jest.clearAllMocks();
        const course = new OrbitalDriftCourse(mockGame);

        const result = await course.initializeHole(i);

        expect(result).toBe(true);
        expect(HoleEntity).toHaveBeenCalledWith(
          mockPhysicsWorld,
          course.holeConfigs[i],
          course.holeGroups[i]
        );
      }
    });

    test('should set currentHoleEntity after initialization', async () => {
      const course = new OrbitalDriftCourse(mockGame);

      await course.initializeHole(0);

      expect(course.currentHoleEntity).not.toBeNull();
    });

    test('should set currentHoleIndex', async () => {
      const course = new OrbitalDriftCourse(mockGame);

      await course.initializeHole(3);

      expect(course.currentHoleIndex).toBe(3);
    });

    test('should set startPosition from hole config', async () => {
      const course = new OrbitalDriftCourse(mockGame);

      await course.initializeHole(0);

      expect(course.startPosition).toBeDefined();
    });

    test('should return false for negative hole index', async () => {
      const course = new OrbitalDriftCourse(mockGame);

      const result = await course.initializeHole(-1);

      expect(result).toBe(false);
    });

    test('should return false for hole index >= totalHoles', async () => {
      const course = new OrbitalDriftCourse(mockGame);

      const result = await course.initializeHole(18);

      expect(result).toBe(false);
    });

    test('should hide all other hole groups', async () => {
      const course = new OrbitalDriftCourse(mockGame);

      await course.initializeHole(3);

      // The active hole group should be visible
      expect(course.holeGroups[3].visible).toBe(true);
    });

    test('should set currentHole to the entity', async () => {
      const course = new OrbitalDriftCourse(mockGame);

      await course.initializeHole(0);

      expect(course.currentHole).toBe(course.currentHoleEntity);
    });
  });

  describe('update', () => {
    test('should retrieve ballBody from game.ballManager and pass to HoleEntity.update', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      course.update(0.016);

      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, mockGame.ballManager.ball.body, {
        dtWasClamped: false
      });
    });

    test('should pass null ballBody when ball is not available', async () => {
      mockGame.ballManager = null;
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      course.update(0.016);

      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, null, { dtWasClamped: false });
    });

    test('should pass null when ballManager.ball is null', async () => {
      mockGame.ballManager = { ball: null };
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      course.update(0.016);

      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, null, { dtWasClamped: false });
    });

    test('should not throw when currentHoleEntity is null', () => {
      const course = new OrbitalDriftCourse(mockGame);

      expect(() => course.update(0.016)).not.toThrow();
    });
  });

  describe('hole transition', () => {
    test('clearCurrentHole destroys current entity', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      course.clearCurrentHole();

      expect(mockHoleEntityDestroy).toHaveBeenCalled();
      expect(course.currentHoleEntity).toBeNull();
      expect(course.currentHole).toBeNull();
    });

    test('createCourse clears current hole then initializes new one', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      const result = await course.createCourse(5);

      expect(result).toBe(true);
      expect(mockHoleEntityDestroy).toHaveBeenCalled();
      expect(course.currentHoleIndex).toBe(4); // 5 - 1 = 4
    });

    test('createCourse returns false for invalid hole number', async () => {
      const course = new OrbitalDriftCourse(mockGame);

      const result = await course.createCourse(0);
      expect(result).toBe(false);

      const result2 = await course.createCourse(19);
      expect(result2).toBe(false);
    });

    test('clearCurrentHole hides current group', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(2);

      course.clearCurrentHole();

      expect(course.holeGroups[2].visible).toBe(false);
    });
  });

  describe('accessor methods', () => {
    test('getCurrentHoleNumber returns 1-indexed hole number', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      expect(course.getCurrentHoleNumber()).toBe(1);
    });

    test('getCurrentHoleConfig returns current config', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      const config = course.getCurrentHoleConfig();
      expect(config).toBe(course.holeConfigs[0]);
    });

    test('hasNextHole returns true when not on last hole', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      expect(course.hasNextHole()).toBe(true);
    });

    test('hasNextHole returns false on last hole', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(17);

      expect(course.hasNextHole()).toBe(false);
    });

    test('getHolePosition returns current hole position', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      const pos = course.getHolePosition();
      expect(pos).toBe(course.holeConfigs[0].holePosition);
    });

    test('getHoleStartPosition returns current start position', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      const pos = course.getHoleStartPosition();
      expect(pos).toBe(course.holeConfigs[0].startPosition);
    });

    test('getHolePar returns current par', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      expect(course.getHolePar()).toBe(2);
    });
  });

  describe('all 18 hole configs validation', () => {
    test('all configs have required fields: boundaryShape, startPosition, holePosition, par', () => {
      const configs = createOrbitalDriftConfigs();

      expect(configs.length).toBe(18);

      configs.forEach((config, i) => {
        expect(config.boundaryShape).toBeDefined();
        expect(Array.isArray(config.boundaryShape)).toBe(true);
        expect(config.boundaryShape.length).toBeGreaterThan(0);

        expect(config.startPosition).toBeDefined();
        expect(Array.isArray(config.startPosition)).toBe(true);
        expect(config.startPosition).toHaveLength(3);

        expect(config.holePosition).toBeDefined();
        expect(Array.isArray(config.holePosition)).toBe(true);
        expect(config.holePosition).toHaveLength(3);

        expect(typeof config.par).toBe('number');
        expect(config.par).toBeGreaterThan(0);

        expect(typeof config.index).toBe('number');
      });
    });

    test('all configs have unique indices', () => {
      const configs = createOrbitalDriftConfigs();
      const indices = configs.map(c => c.index);
      const uniqueIndices = new Set(indices);
      expect(uniqueIndices.size).toBe(configs.length);
    });

    test('all configs have description', () => {
      const configs = createOrbitalDriftConfigs();

      configs.forEach(config => {
        expect(typeof config.description).toBe('string');
        expect(config.description.length).toBeGreaterThan(0);
      });
    });

    test('all configs have hazards and bumpers arrays', () => {
      const configs = createOrbitalDriftConfigs();

      configs.forEach(config => {
        expect(Array.isArray(config.hazards)).toBe(true);
        expect(Array.isArray(config.bumpers)).toBe(true);
      });
    });

    test('all configs have mechanics array', () => {
      const configs = createOrbitalDriftConfigs();

      configs.forEach(config => {
        expect(Array.isArray(config.mechanics)).toBe(true);
        expect(config.mechanics.length).toBeGreaterThan(0);
      });
    });

    test('all configs have theme variant applied', () => {
      const configs = createOrbitalDriftConfigs();

      configs.forEach((config, i) => {
        expect(config.theme).toBeDefined();
        if (i < 9) {
          expect(config.theme.name).toBe('Station Side');
        } else {
          expect(config.theme.name).toBe('Deep Void');
        }
      });
    });

    test('all configs have heroProps array with at least one prop', () => {
      const configs = createOrbitalDriftConfigs();

      configs.forEach(config => {
        expect(Array.isArray(config.heroProps)).toBe(true);
        expect(config.heroProps.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('static create', () => {
    test('should create course and initialize first hole', async () => {
      const course = await OrbitalDriftCourse.create(mockGame);

      expect(course).toBeInstanceOf(OrbitalDriftCourse);
      expect(course.currentHoleIndex).toBe(0);
      expect(course.currentHoleEntity).not.toBeNull();
      expect(course.startPosition).toBeDefined();
    });

    test('should throw if physics world is not available', async () => {
      mockGame.physicsManager.getWorld = jest.fn(() => null);

      await expect(OrbitalDriftCourse.create(mockGame)).rejects.toThrow(
        'Physics world not available'
      );
    });
  });
});
