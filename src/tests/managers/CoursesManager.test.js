/**
 * Unit tests for CoursesManager
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CoursesManager } from '../../managers/CoursesManager';

// Mock Three.js and Cannon-es modules
jest.mock('three', () => ({
  Scene: jest.fn(),
  Vector3: jest.fn(() => ({
    x: 0,
    y: 0,
    z: 0,
    copy: jest.fn(),
    clone: jest.fn()
  })),
  Mesh: jest.fn(),
  Material: jest.fn(),
  Geometry: jest.fn()
}));

jest.mock('cannon-es', () => ({
  World: jest.fn(),
  Body: jest.fn()
}));

jest.mock('three-csg-ts', () => ({
  CSG: {}
}));

describe('CoursesManager', () => {
  let mockScene;
  let mockPhysicsWorld;
  let coursesManager;

  beforeEach(() => {
    // Create mock scene
    mockScene = {
      add: jest.fn(),
      remove: jest.fn()
    };

    // Create mock physics world
    mockPhysicsWorld = {
      addBody: jest.fn(),
      removeBody: jest.fn()
    };

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with scene and physics world', () => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });

      expect(coursesManager.scene).toBe(mockScene);
      expect(coursesManager.physicsWorld).toBe(mockPhysicsWorld);
    });

    test('should initialize with default state', () => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });

      expect(coursesManager.currentHoleIndex).toBe(0);
      expect(coursesManager.totalHoles).toBe(0);
      expect(coursesManager.holes).toEqual([]);
      expect(coursesManager.courseObjects).toEqual([]);
      expect(coursesManager.physicsBodies).toEqual([]);
    });

    test('should store game reference from options', () => {
      const mockGame = { test: 'game' };
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, {
        game: mockGame,
        autoCreate: false
      });

      expect(coursesManager.game).toBe(mockGame);
    });

    test('should call createCourse by default', () => {
      const createCourseSpy = jest
        .spyOn(CoursesManager.prototype, 'createCourse')
        .mockImplementation(() => {});

      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld);

      expect(createCourseSpy).toHaveBeenCalled();

      createCourseSpy.mockRestore();
    });

    test('should not call createCourse when autoCreate is false', () => {
      const createCourseSpy = jest
        .spyOn(CoursesManager.prototype, 'createCourse')
        .mockImplementation(() => {});

      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });

      expect(createCourseSpy).not.toHaveBeenCalled();

      createCourseSpy.mockRestore();
    });
  });

  describe('createCourse', () => {
    test('should throw error when not implemented by subclass', () => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });

      expect(() => {
        coursesManager.createCourse();
      }).toThrow('createCourse must be implemented by subclass');
    });
  });

  describe('getCurrentHoleMesh', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should return null for invalid negative hole index', () => {
      coursesManager.currentHoleIndex = -1;
      coursesManager.holes = [{ mesh: 'test-mesh' }];

      const result = coursesManager.getCurrentHoleMesh();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('[CoursesManager] Invalid hole index for mesh: -1');
    });

    test('should return null for hole index beyond array length', () => {
      coursesManager.currentHoleIndex = 5;
      coursesManager.holes = [{ mesh: 'test-mesh' }];

      const result = coursesManager.getCurrentHoleMesh();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('[CoursesManager] Invalid hole index for mesh: 5');
    });

    test('should return hole mesh for valid index', () => {
      const mockMesh = { type: 'test-mesh' };
      coursesManager.currentHoleIndex = 0;
      coursesManager.holes = [{ mesh: mockMesh }];

      const result = coursesManager.getCurrentHoleMesh();

      expect(result).toBe(mockMesh);
    });
  });

  describe('getHolePosition', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should return null when holes array is empty', () => {
      coursesManager.holes = [];

      const result = coursesManager.getHolePosition();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] getHolePosition called when holes array is empty.'
      );
    });

    test('should return null for invalid negative hole index', () => {
      coursesManager.currentHoleIndex = -1;
      coursesManager.holes = [{ holePosition: new THREE.Vector3(1, 2, 3) }];

      const result = coursesManager.getHolePosition();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Invalid hole index (-1) for getting position.'
      );
    });

    test('should return null for hole index beyond array length', () => {
      coursesManager.currentHoleIndex = 2;
      coursesManager.holes = [{ holePosition: new THREE.Vector3(1, 2, 3) }];

      const result = coursesManager.getHolePosition();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Invalid hole index (2) for getting position.'
      );
    });

    test('should return null when hole data is missing', () => {
      coursesManager.currentHoleIndex = 0;
      coursesManager.holes = [null];

      const result = coursesManager.getHolePosition();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Hole data or position missing for index 0.'
      );
    });

    test('should return null when holePosition is missing', () => {
      coursesManager.currentHoleIndex = 0;
      coursesManager.holes = [{ otherData: 'test' }];

      const result = coursesManager.getHolePosition();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Hole data or position missing for index 0.'
      );
    });

    test('should return hole position for valid index and data', () => {
      const mockPosition = new THREE.Vector3(1, 2, 3);
      coursesManager.currentHoleIndex = 0;
      coursesManager.holes = [{ holePosition: mockPosition }];

      const result = coursesManager.getHolePosition();

      expect(result).toBe(mockPosition);
    });
  });

  describe('getHoleStartPosition', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should return null when holes array is empty', () => {
      coursesManager.holes = [];

      const result = coursesManager.getHoleStartPosition();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] getHoleStartPosition called when holes array is empty.'
      );
    });

    test('should return null for invalid negative hole index', () => {
      coursesManager.currentHoleIndex = -1;
      coursesManager.holes = [{ startPosition: new THREE.Vector3(5, 6, 7) }];

      const result = coursesManager.getHoleStartPosition();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Invalid hole index (-1) for getting start position.'
      );
    });

    test('should return null for hole index beyond array length', () => {
      coursesManager.currentHoleIndex = 3;
      coursesManager.holes = [{ startPosition: new THREE.Vector3(5, 6, 7) }];

      const result = coursesManager.getHoleStartPosition();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Invalid hole index (3) for getting start position.'
      );
    });

    test('should return null when hole data is missing', () => {
      coursesManager.currentHoleIndex = 0;
      coursesManager.holes = [null];

      const result = coursesManager.getHoleStartPosition();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Hole data or startPosition missing for index 0.'
      );
    });

    test('should return null when startPosition is missing', () => {
      coursesManager.currentHoleIndex = 0;
      coursesManager.holes = [{ holePosition: new THREE.Vector3(1, 2, 3) }];

      const result = coursesManager.getHoleStartPosition();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Hole data or startPosition missing for index 0.'
      );
    });

    test('should return start position for valid index and data', () => {
      const mockStartPosition = new THREE.Vector3(5, 6, 7);
      coursesManager.currentHoleIndex = 0;
      coursesManager.holes = [{ startPosition: mockStartPosition }];

      const result = coursesManager.getHoleStartPosition();

      expect(result).toBe(mockStartPosition);
    });
  });

  describe('getHolePar', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should return 0 when holes array is empty', () => {
      coursesManager.holes = [];

      const result = coursesManager.getHolePar();

      expect(result).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] getHolePar called when holes array is empty.'
      );
    });

    test('should return 0 for invalid negative hole index', () => {
      coursesManager.currentHoleIndex = -1;
      coursesManager.holes = [{ par: 3 }];

      const result = coursesManager.getHolePar();

      expect(result).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Invalid hole index (-1) for getting par.'
      );
    });

    test('should return 0 for hole index beyond array length', () => {
      coursesManager.currentHoleIndex = 4;
      coursesManager.holes = [{ par: 3 }];

      const result = coursesManager.getHolePar();

      expect(result).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Invalid hole index (4) for getting par.'
      );
    });

    test('should return 0 when hole data is missing', () => {
      coursesManager.currentHoleIndex = 0;
      coursesManager.holes = [null];

      const result = coursesManager.getHolePar();

      expect(result).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Hole data or par missing/invalid for index 0.'
      );
    });

    test('should return 0 when par is not a number', () => {
      coursesManager.currentHoleIndex = 0;
      coursesManager.holes = [{ par: 'invalid' }];

      const result = coursesManager.getHolePar();

      expect(result).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        '[CoursesManager] Hole data or par missing/invalid for index 0.'
      );
    });

    test('should return par for valid index and data', () => {
      coursesManager.currentHoleIndex = 0;
      coursesManager.holes = [{ par: 4 }];

      const result = coursesManager.getHolePar();

      expect(result).toBe(4);
    });
  });

  describe('getTotalHoles', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should return total holes count', () => {
      coursesManager.totalHoles = 18;

      const result = coursesManager.getTotalHoles();

      expect(result).toBe(18);
    });

    test('should return 0 when totalHoles is 0', () => {
      coursesManager.totalHoles = 0;

      const result = coursesManager.getTotalHoles();

      expect(result).toBe(0);
    });
  });

  describe('hasNextHole', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should return true when current hole is not the last', () => {
      coursesManager.currentHoleIndex = 2;
      coursesManager.totalHoles = 5;

      const result = coursesManager.hasNextHole();

      expect(result).toBe(true);
    });

    test('should return false when current hole is the last', () => {
      coursesManager.currentHoleIndex = 4;
      coursesManager.totalHoles = 5;

      const result = coursesManager.hasNextHole();

      expect(result).toBe(false);
    });

    test('should return false when there are no holes', () => {
      coursesManager.currentHoleIndex = 0;
      coursesManager.totalHoles = 0;

      const result = coursesManager.hasNextHole();

      expect(result).toBe(false);
    });
  });

  describe('loadNextHole', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should return false when no next hole available', () => {
      coursesManager.currentHoleIndex = 2;
      coursesManager.totalHoles = 3;

      const result = coursesManager.loadNextHole();

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith('[CoursesManager] No next hole available');
    });

    test('should successfully load next hole', () => {
      coursesManager.currentHoleIndex = 1;
      coursesManager.totalHoles = 5;

      const clearSpy = jest.spyOn(coursesManager, 'clearCurrentHole').mockImplementation(() => {});
      const createSpy = jest.spyOn(coursesManager, 'createCourse').mockImplementation(() => {});

      const result = coursesManager.loadNextHole();

      expect(result).toBe(true);
      expect(clearSpy).toHaveBeenCalled();
      expect(coursesManager.currentHoleIndex).toBe(2);
      expect(createSpy).toHaveBeenCalled();

      clearSpy.mockRestore();
      createSpy.mockRestore();
    });

    test('should handle errors during hole loading', () => {
      coursesManager.currentHoleIndex = 1;
      coursesManager.totalHoles = 5;

      const clearSpy = jest.spyOn(coursesManager, 'clearCurrentHole').mockImplementation(() => {});
      const createSpy = jest.spyOn(coursesManager, 'createCourse').mockImplementation(() => {
        throw new Error('Failed to create course');
      });

      const result = coursesManager.loadNextHole();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        '[CoursesManager] Failed to load next hole:',
        expect.any(Error)
      );

      clearSpy.mockRestore();
      createSpy.mockRestore();
    });
  });

  describe('clearCurrentHole', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should clear course objects and dispose resources', () => {
      const mockGeometry = { dispose: jest.fn() };
      const mockMaterial = { dispose: jest.fn() };
      const mockObject = {
        geometry: mockGeometry,
        material: mockMaterial
      };

      coursesManager.courseObjects = [mockObject];

      coursesManager.clearCurrentHole();

      expect(mockGeometry.dispose).toHaveBeenCalled();
      expect(mockMaterial.dispose).toHaveBeenCalled();
      expect(mockScene.remove).toHaveBeenCalledWith(mockObject);
      expect(coursesManager.courseObjects).toEqual([]);
    });

    test('should handle array of materials', () => {
      const mockMaterial1 = { dispose: jest.fn() };
      const mockMaterial2 = { dispose: jest.fn() };
      const mockObject = {
        geometry: { dispose: jest.fn() },
        material: [mockMaterial1, mockMaterial2]
      };

      coursesManager.courseObjects = [mockObject];

      coursesManager.clearCurrentHole();

      expect(mockMaterial1.dispose).toHaveBeenCalled();
      expect(mockMaterial2.dispose).toHaveBeenCalled();
    });

    test('should handle objects without geometry or material', () => {
      const mockObject = {};
      coursesManager.courseObjects = [mockObject];

      expect(() => {
        coursesManager.clearCurrentHole();
      }).not.toThrow();

      expect(mockScene.remove).toHaveBeenCalledWith(mockObject);
    });

    test('should remove physics bodies', () => {
      const mockBody1 = { id: 'body1' };
      const mockBody2 = { id: 'body2' };
      coursesManager.physicsBodies = [mockBody1, mockBody2];

      coursesManager.clearCurrentHole();

      expect(mockPhysicsWorld.removeBody).toHaveBeenCalledWith(mockBody1);
      expect(mockPhysicsWorld.removeBody).toHaveBeenCalledWith(mockBody2);
      expect(coursesManager.physicsBodies).toEqual([]);
    });

    test('should handle missing physics world gracefully', () => {
      coursesManager.physicsWorld = null;
      const mockBody = { id: 'body1' };
      coursesManager.physicsBodies = [mockBody];

      expect(() => {
        coursesManager.clearCurrentHole();
      }).not.toThrow();

      expect(coursesManager.physicsBodies).toEqual([]);
    });

    test('should clear all arrays', () => {
      coursesManager.courseObjects = ['obj1', 'obj2'];
      coursesManager.physicsBodies = ['body1', 'body2'];
      coursesManager.holes = ['hole1', 'hole2'];

      coursesManager.clearCurrentHole();

      expect(coursesManager.courseObjects).toEqual([]);
      expect(coursesManager.physicsBodies).toEqual([]);
      expect(coursesManager.holes).toEqual([]);
    });

    test('should log clearing message', () => {
      coursesManager.clearCurrentHole();

      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[CoursesManager] Clearing current hole resources');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should accept delta time parameter', () => {
      expect(() => {
        coursesManager.update(0.016);
      }).not.toThrow();
    });

    test('should handle missing delta time', () => {
      expect(() => {
        coursesManager.update();
      }).not.toThrow();
    });

    test('should retrieve ballBody from game.ballManager and pass to currentHoleEntity.update', () => {
      const mockBallBody = { position: { x: 0, y: 0, z: 0 } };
      const mockUpdate = jest.fn();
      coursesManager.game = {
        ballManager: {
          ball: { body: mockBallBody }
        }
      };
      coursesManager.currentHoleEntity = { update: mockUpdate };

      coursesManager.update(0.016);

      expect(mockUpdate).toHaveBeenCalledWith(0.016, mockBallBody, { dtWasClamped: false });
    });

    test('should pass null ballBody when ball is not available', () => {
      const mockUpdate = jest.fn();
      coursesManager.game = { ballManager: { ball: null } };
      coursesManager.currentHoleEntity = { update: mockUpdate };

      coursesManager.update(0.016);

      expect(mockUpdate).toHaveBeenCalledWith(0.016, null, { dtWasClamped: false });
    });

    test('should pass null ballBody when ballManager is not available', () => {
      const mockUpdate = jest.fn();
      coursesManager.game = { ballManager: null };
      coursesManager.currentHoleEntity = { update: mockUpdate };

      coursesManager.update(0.016);

      expect(mockUpdate).toHaveBeenCalledWith(0.016, null, { dtWasClamped: false });
    });

    test('should pass null ballBody when game is not available', () => {
      const mockUpdate = jest.fn();
      coursesManager.game = null;
      coursesManager.currentHoleEntity = { update: mockUpdate };

      coursesManager.update(0.016);

      expect(mockUpdate).toHaveBeenCalledWith(0.016, null, { dtWasClamped: false });
    });

    test('should not throw when currentHoleEntity is null', () => {
      coursesManager.currentHoleEntity = null;
      expect(() => coursesManager.update(0.016)).not.toThrow();
    });

    test('should not call update when currentHoleEntity has no update method', () => {
      coursesManager.currentHoleEntity = {};
      expect(() => coursesManager.update(0.016)).not.toThrow();
    });
  });

  describe('getCurrentHole', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should return null for invalid negative hole index', () => {
      coursesManager.currentHoleIndex = -1;
      coursesManager.holeConfigs = [{ par: 3 }];

      const result = coursesManager.getCurrentHole();

      expect(result).toBeNull();
    });

    test('should return null for hole index beyond configs length', () => {
      coursesManager.currentHoleIndex = 5;
      coursesManager.holeConfigs = [{ par: 3 }];

      const result = coursesManager.getCurrentHole();

      expect(result).toBeNull();
    });

    test('should return hole config with mesh when available', () => {
      const mockMesh = { type: 'test-mesh' };
      coursesManager.currentHoleIndex = 0;
      coursesManager.holeConfigs = [{ par: 3, name: 'Hole 1' }];
      coursesManager.holes = [{ mesh: mockMesh }];

      const result = coursesManager.getCurrentHole();

      expect(result).toEqual({
        par: 3,
        name: 'Hole 1',
        mesh: mockMesh
      });
    });

    test('should return hole config with null mesh when not available', () => {
      coursesManager.currentHoleIndex = 0;
      coursesManager.holeConfigs = [{ par: 4, name: 'Hole 2' }];
      coursesManager.holes = [];

      const result = coursesManager.getCurrentHole();

      expect(result).toEqual({
        par: 4,
        name: 'Hole 2',
        mesh: null
      });
    });
  });

  describe('getNextHole', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should return null when no next hole available', () => {
      coursesManager.currentHoleIndex = 2;
      coursesManager.totalHoles = 3;

      const result = coursesManager.getNextHole();

      expect(result).toBeNull();
    });

    test('should return next hole config with null mesh', () => {
      coursesManager.currentHoleIndex = 0;
      coursesManager.totalHoles = 3;
      coursesManager.holeConfigs = [
        { par: 3, name: 'Hole 1' },
        { par: 4, name: 'Hole 2' }
      ];

      const result = coursesManager.getNextHole();

      expect(result).toEqual({
        par: 4,
        name: 'Hole 2',
        mesh: null
      });
    });
  });

  describe('createHazard', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should log warning for base implementation', () => {
      const hazardConfig = { type: 'sand', position: [0, 0, 0] };

      coursesManager.createHazard(hazardConfig);

      expect(console.warn).toHaveBeenCalledWith('createHazard not implemented in this course');
    });
  });

  describe('getCurrentHoleConfig', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should return null for base implementation', () => {
      const result = coursesManager.getCurrentHoleConfig();

      expect(result).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      coursesManager = new CoursesManager(mockScene, mockPhysicsWorld, { autoCreate: false });
    });

    test('should handle complete hole progression workflow', () => {
      // Setup initial state
      coursesManager.currentHoleIndex = 0;
      coursesManager.totalHoles = 3;
      coursesManager.holes = [{ par: 3, holePosition: new THREE.Vector3(0, 0, 10) }];

      // Check we can get current hole data
      expect(coursesManager.getHolePar()).toBe(3);
      expect(coursesManager.hasNextHole()).toBe(true);

      // Mock methods for hole loading
      const clearSpy = jest.spyOn(coursesManager, 'clearCurrentHole').mockImplementation(() => {});
      const createSpy = jest.spyOn(coursesManager, 'createCourse').mockImplementation(() => {});

      // Load next hole
      const success = coursesManager.loadNextHole();
      expect(success).toBe(true);
      expect(coursesManager.currentHoleIndex).toBe(1);

      clearSpy.mockRestore();
      createSpy.mockRestore();
    });

    test('should handle resource cleanup during hole transition', () => {
      const mockGeometry = { dispose: jest.fn() };
      const mockMaterial = { dispose: jest.fn() };
      const mockObject = { geometry: mockGeometry, material: mockMaterial };
      const mockBody = { id: 'body1' };

      coursesManager.courseObjects = [mockObject];
      coursesManager.physicsBodies = [mockBody];

      coursesManager.clearCurrentHole();

      expect(mockGeometry.dispose).toHaveBeenCalled();
      expect(mockMaterial.dispose).toHaveBeenCalled();
      expect(mockScene.remove).toHaveBeenCalledWith(mockObject);
      expect(mockPhysicsWorld.removeBody).toHaveBeenCalledWith(mockBody);
    });
  });
});
