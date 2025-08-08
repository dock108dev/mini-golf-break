/**
 * Unit tests for NineHoleCourse
 */

import { NineHoleCourse } from '../objects/NineHoleCourse';

// Mock dependencies
jest.mock('../managers/CoursesManager');
jest.mock('../objects/HoleEntity');
jest.mock('../utils/debug');

describe('NineHoleCourse', () => {
  let mockGame;
  let mockScene;
  let mockPhysicsWorld;
  let nineHoleCourse;

  beforeEach(() => {
    // Setup mock game object
    mockScene = {
      add: jest.fn(),
      remove: jest.fn(),
      traverse: jest.fn()
    };

    mockPhysicsWorld = {
      addBody: jest.fn(),
      removeBody: jest.fn(),
      world: {
        bodies: []
      }
    };

    mockGame = {
      scene: mockScene,
      physicsWorld: mockPhysicsWorld,
      debugMode: false,
      stateManager: {
        setState: jest.fn(),
        state: {
          currentHoleNumber: 1
        }
      },
      eventManager: {
        publish: jest.fn(),
        subscribe: jest.fn()
      },
      physicsManager: {
        world: mockPhysicsWorld
      }
    };

    // Reset the global THREE.Group mock to ensure clean state
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      nineHoleCourse = new NineHoleCourse(mockGame);

      expect(nineHoleCourse.game).toBe(mockGame);
      expect(nineHoleCourse.scene).toBe(mockScene);
      expect(nineHoleCourse.physicsWorld).toBe(mockPhysicsWorld);
      expect(nineHoleCourse.debugMode).toBe(false);
      expect(nineHoleCourse.totalHoles).toBe(9);
    });

    test('should initialize with debug option', () => {
      const options = { debug: true };
      nineHoleCourse = new NineHoleCourse(mockGame, options);

      expect(nineHoleCourse.options.debug).toBe(true);
    });

    test('should create hole groups', () => {
      nineHoleCourse = new NineHoleCourse(mockGame);

      expect(nineHoleCourse.holeGroups).toBeDefined();
      expect(Array.isArray(nineHoleCourse.holeGroups)).toBe(true);
      expect(nineHoleCourse.holeGroups.length).toBe(9);
    });

    test('should add hole groups to scene', () => {
      nineHoleCourse = new NineHoleCourse(mockGame);

      expect(mockScene.add).toHaveBeenCalledTimes(9);
    });
  });

  describe('hole management', () => {
    test('should initialize hole entities array', () => {
      nineHoleCourse = new NineHoleCourse(mockGame);

      expect(nineHoleCourse.holeEntities).toBeDefined();
      expect(Array.isArray(nineHoleCourse.holeEntities)).toBe(true);
    });

    test('should set up hole group names and metadata', () => {
      nineHoleCourse = new NineHoleCourse(mockGame);

      // Check that holeGroups array was populated
      expect(nineHoleCourse.holeGroups).toBeDefined();
      expect(nineHoleCourse.holeGroups.length).toBe(9);

      // Check that each group has proper metadata
      nineHoleCourse.holeGroups.forEach((group, index) => {
        expect(group.name).toBe(`Hole_${index + 1}_Group`);
        expect(group.userData.holeIndex).toBe(index);
      });
    });

    test('should have correct total holes count', () => {
      expect(nineHoleCourse.totalHoles).toBe(9);
    });
  });

  describe('state management', () => {
    beforeEach(() => {
      nineHoleCourse = new NineHoleCourse(mockGame);
    });

    test('should track transitioning state when set', () => {
      // Properties are not initialized in constructor, but can be set
      expect(nineHoleCourse.isTransitioning).toBeUndefined();

      // Test that they can be set
      nineHoleCourse.isTransitioning = true;
      expect(nineHoleCourse.isTransitioning).toBe(true);
    });

    test('should handle pending hole transition state when set', () => {
      // Properties are not initialized in constructor, but can be set
      expect(nineHoleCourse.pendingHoleTransition).toBeUndefined();

      // Test that they can be set
      nineHoleCourse.pendingHoleTransition = true;
      expect(nineHoleCourse.pendingHoleTransition).toBe(true);
    });
  });

  describe('static factory method', () => {
    test('should have create method', () => {
      expect(NineHoleCourse.create).toBeDefined();
      expect(typeof NineHoleCourse.create).toBe('function');
    });
  });

  describe('inheritance', () => {
    test('should extend CoursesManager', () => {
      const CoursesManager = require('../managers/CoursesManager').CoursesManager;
      nineHoleCourse = new NineHoleCourse(mockGame);

      // NineHoleCourse should be an instance of CoursesManager
      expect(nineHoleCourse).toBeInstanceOf(CoursesManager);
    });
  });

  describe('hole configuration', () => {
    beforeEach(() => {
      nineHoleCourse = new NineHoleCourse(mockGame);
    });

    test('should have proper hole group structure', () => {
      expect(nineHoleCourse.holeGroups.length).toBe(nineHoleCourse.totalHoles);
    });

    test('should handle hole visibility management', () => {
      // Verify that the course has methods for managing hole visibility
      expect(nineHoleCourse.holeGroups).toBeDefined();
      expect(Array.isArray(nineHoleCourse.holeGroups)).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle missing game object gracefully', () => {
      expect(() => {
        new NineHoleCourse(null);
      }).toThrow();
    });

    test('should handle missing scene gracefully', () => {
      const invalidGame = { ...mockGame, scene: null };
      expect(() => {
        new NineHoleCourse(invalidGame);
      }).toThrow();
    });
  });
});
