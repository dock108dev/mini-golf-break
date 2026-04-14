/**
 * Regression tests for OrbitalDriftCourse ballBody threading.
 *
 * Verifies that OrbitalDriftCourse correctly threads ballBody through
 * to HoleEntity.update() across all lifecycle scenarios: normal play,
 * null ball states, hole transitions, and empty-mechanics holes.
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
    PointLight: jest.fn(() => ({
      position: { x: 0, y: 0, z: 0, copy: jest.fn() }
    })),
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

// Track HoleEntity instances for per-instance assertions
const mockHoleEntityInstances = [];
const mockHoleEntityInit = jest.fn().mockResolvedValue(undefined);
const mockHoleEntityDestroy = jest.fn();
const mockHoleEntityUpdate = jest.fn();

jest.mock('../../objects/HoleEntity', () => ({
  HoleEntity: jest.fn().mockImplementation((world, config, group) => {
    const instance = {
      init: mockHoleEntityInit,
      destroy: mockHoleEntityDestroy,
      update: mockHoleEntityUpdate,
      config,
      group,
      mechanics: config.mechanics || []
    };
    mockHoleEntityInstances.push(instance);
    return instance;
  })
}));

jest.mock('../../mechanics/index', () => ({}));
jest.mock('../../mechanics/MechanicRegistry', () => ({
  createMechanic: jest.fn()
}));
jest.mock('../../objects/HeroPropFactory', () => ({
  createHeroProp: jest.fn()
}));

describe('OrbitalDriftCourse ballBody threading regression', () => {
  let mockGame;
  let mockPhysicsWorld;
  let mockScene;
  let mockBallBody;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHoleEntityInstances.length = 0;

    mockBallBody = {
      position: { x: 1, y: 0.5, z: 2 },
      velocity: { x: 0, y: 0, z: 0 }
    };

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
          body: mockBallBody
        }
      }
    };

    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  describe('ballBody passed to HoleEntity.update()', () => {
    test('update(dt) passes ballBody reference to currentHoleEntity.update()', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      course.update(0.016);

      expect(mockHoleEntityUpdate).toHaveBeenCalledTimes(1);
      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, mockBallBody, {
        dtWasClamped: false
      });
    });

    test('ballBody reference is the exact same object from ballManager', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      course.update(0.016);

      const passedBallBody = mockHoleEntityUpdate.mock.calls[0][1];
      expect(passedBallBody).toBe(mockGame.ballManager.ball.body);
    });

    test('update passes fresh ballBody each frame (not cached)', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      course.update(0.016);

      const newBallBody = { position: { x: 5, y: 0, z: 5 }, velocity: { x: 1, y: 0, z: 0 } };
      mockGame.ballManager.ball.body = newBallBody;

      course.update(0.016);

      expect(mockHoleEntityUpdate).toHaveBeenCalledTimes(2);
      expect(mockHoleEntityUpdate.mock.calls[1][1]).toBe(newBallBody);
    });
  });

  describe('null ball handling', () => {
    test('handles null ballManager gracefully', async () => {
      mockGame.ballManager = null;
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      expect(() => course.update(0.016)).not.toThrow();
      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, null, { dtWasClamped: false });
    });

    test('handles null ball gracefully', async () => {
      mockGame.ballManager = { ball: null };
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      expect(() => course.update(0.016)).not.toThrow();
      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, null, { dtWasClamped: false });
    });

    test('handles null ball.body gracefully', async () => {
      mockGame.ballManager = { ball: { body: null } };
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      expect(() => course.update(0.016)).not.toThrow();
      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, null, { dtWasClamped: false });
    });

    test('handles undefined ballManager gracefully', async () => {
      mockGame.ballManager = undefined;
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      expect(() => course.update(0.016)).not.toThrow();
      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, null, { dtWasClamped: false });
    });

    test('does not throw when no currentHoleEntity and ball is null', () => {
      mockGame.ballManager = null;
      const course = new OrbitalDriftCourse(mockGame);

      expect(() => course.update(0.016)).not.toThrow();
      expect(mockHoleEntityUpdate).not.toHaveBeenCalled();
    });
  });

  describe('all 9 holes initialize successfully', () => {
    test('each hole from 0-8 initializes and returns true', async () => {
      for (let i = 0; i < 9; i++) {
        jest.clearAllMocks();
        mockHoleEntityInstances.length = 0;
        const course = new OrbitalDriftCourse(mockGame);

        const result = await course.initializeHole(i);

        expect(result).toBe(true);
        expect(course.currentHoleEntity).not.toBeNull();
        expect(course.currentHoleIndex).toBe(i);
      }
    });

    test('each hole receives correct config from orbitalDriftConfigs', async () => {
      const { HoleEntity } = require('../../objects/HoleEntity');
      const configs = createOrbitalDriftConfigs();

      for (let i = 0; i < 9; i++) {
        jest.clearAllMocks();
        const course = new OrbitalDriftCourse(mockGame);

        await course.initializeHole(i);

        expect(HoleEntity).toHaveBeenCalledWith(
          mockPhysicsWorld,
          expect.objectContaining({ index: i }),
          expect.anything()
        );
      }
    });

    test('ballBody threading works for every hole index', async () => {
      for (let i = 0; i < 9; i++) {
        jest.clearAllMocks();
        const course = new OrbitalDriftCourse(mockGame);
        await course.initializeHole(i);

        course.update(0.016);

        expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, mockBallBody, {
          dtWasClamped: false
        });
      }
    });
  });

  describe('HoleEntity with empty mechanics config', () => {
    test('update works when HoleEntity has empty mechanics array', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      // The mock HoleEntity's update is a jest.fn() so it always succeeds,
      // but this verifies the course-level call chain doesn't break.
      course.update(0.016);

      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, mockBallBody, {
        dtWasClamped: false
      });
    });

    test('multiple update calls work with empty mechanics', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      for (let frame = 0; frame < 100; frame++) {
        course.update(0.016);
      }

      expect(mockHoleEntityUpdate).toHaveBeenCalledTimes(100);
    });
  });

  describe('hole transitions with ballBody threading', () => {
    test('ballBody threading works after transitioning to next hole', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      // Verify update works on hole 1
      course.update(0.016);
      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, mockBallBody, {
        dtWasClamped: false
      });

      jest.clearAllMocks();

      // Transition to hole 2
      await course.createCourse(2);
      course.update(0.016);

      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, mockBallBody, {
        dtWasClamped: false
      });
      expect(course.currentHoleIndex).toBe(1);
    });

    test('ballBody threading works after clearing and reinitializing same hole', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      course.update(0.016);
      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, mockBallBody, {
        dtWasClamped: false
      });

      // Clear and reinitialize
      course.clearCurrentHole();
      expect(course.currentHoleEntity).toBeNull();

      // update should not throw when no hole loaded
      expect(() => course.update(0.016)).not.toThrow();

      jest.clearAllMocks();

      // Reinitialize
      await course.initializeHole(0);
      course.update(0.016);

      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, mockBallBody, {
        dtWasClamped: false
      });
    });

    test('previous HoleEntity is destroyed on transition', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      await course.createCourse(2);

      expect(mockHoleEntityDestroy).toHaveBeenCalledTimes(1);
    });

    test('sequential transitions through all 9 holes maintain ballBody threading', async () => {
      const course = new OrbitalDriftCourse(mockGame);

      for (let holeNum = 1; holeNum <= 9; holeNum++) {
        jest.clearAllMocks();
        const result = await course.createCourse(holeNum);
        expect(result).toBe(true);

        course.update(0.016);
        expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, mockBallBody, {
          dtWasClamped: false
        });
      }
    });

    test('ball becoming null mid-game after transition does not throw', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      // Ball exists initially
      course.update(0.016);
      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, mockBallBody, {
        dtWasClamped: false
      });

      // Transition
      await course.createCourse(2);

      // Ball disappears (e.g., during reset)
      mockGame.ballManager.ball = null;

      expect(() => course.update(0.016)).not.toThrow();
      expect(mockHoleEntityUpdate).toHaveBeenLastCalledWith(0.016, null, { dtWasClamped: false });
    });

    test('ball reappearing after null is correctly threaded', async () => {
      const course = new OrbitalDriftCourse(mockGame);
      await course.initializeHole(0);

      // Ball is null
      mockGame.ballManager.ball = null;
      course.update(0.016);
      expect(mockHoleEntityUpdate).toHaveBeenCalledWith(0.016, null, { dtWasClamped: false });

      // Ball reappears
      const newBallBody = { position: { x: 0, y: 1, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
      mockGame.ballManager.ball = { body: newBallBody };
      course.update(0.016);
      expect(mockHoleEntityUpdate).toHaveBeenLastCalledWith(0.016, newBallBody, {
        dtWasClamped: false
      });
    });
  });
});
