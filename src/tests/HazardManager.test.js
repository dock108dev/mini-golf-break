/**
 * Unit tests for HazardManager
 */

import { HazardManager } from '../managers/HazardManager';
import { EventTypes } from '../events/EventTypes';

// Mock dependencies
jest.mock('../objects/hazards/HazardFactory');

describe('HazardManager', () => {
  let mockGame;
  let mockEventManager;
  let mockBallManager;
  let hazardManager;

  beforeEach(() => {
    // Setup mock event manager
    mockEventManager = {
      publish: jest.fn(),
      subscribe: jest.fn(() => jest.fn())
    };

    // Setup mock ball manager
    mockBallManager = {
      ball: {
        mesh: {
          position: { x: 0, y: 0, z: 0 }
        }
      }
    };

    // Setup mock game object
    mockGame = {
      eventManager: mockEventManager,
      ballManager: mockBallManager,
      stateManager: {
        getState: jest.fn(() => ({ currentHoleNumber: 1 }))
      },
      debugManager: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with game reference', () => {
      hazardManager = new HazardManager(mockGame);

      expect(hazardManager.game).toBe(mockGame);
      expect(hazardManager.hazards).toBeDefined();
      expect(Array.isArray(hazardManager.hazards)).toBe(true);
      expect(hazardManager.hazards.length).toBe(0);
    });

    test('should initialize event subscriptions array', () => {
      hazardManager = new HazardManager(mockGame);

      expect(hazardManager.eventSubscriptions).toBeDefined();
      expect(Array.isArray(hazardManager.eventSubscriptions)).toBe(true);
    });

    test('should set default check frequency', () => {
      hazardManager = new HazardManager(mockGame);

      expect(hazardManager.checkFrequency).toBe(5);
      expect(hazardManager.frameCount).toBe(0);
    });
  });

  describe('init', () => {
    beforeEach(() => {
      hazardManager = new HazardManager(mockGame);
    });

    test('should set up event listeners', () => {
      hazardManager.init();

      expect(mockEventManager.subscribe).toHaveBeenCalled();
      expect(hazardManager.isInitialized).toBe(true);
    });

    test('should subscribe to ball movement events', () => {
      hazardManager.init();

      expect(mockEventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_MOVED,
        expect.any(Function),
        hazardManager
      );
    });

    test('should handle multiple init calls', () => {
      hazardManager.init();
      const firstCallCount = mockEventManager.subscribe.mock.calls.length;

      hazardManager.init();
      const secondCallCount = mockEventManager.subscribe.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('hazard management', () => {
    beforeEach(() => {
      hazardManager = new HazardManager(mockGame);
      hazardManager.init();
    });

    test('should track hazards array', () => {
      expect(hazardManager.hazards).toEqual([]);
    });

    test('should add hazard to array', () => {
      const mockHazard = {
        type: 'out-of-bounds',
        position: { x: 10, y: 0, z: 10 }
      };

      hazardManager.hazards.push(mockHazard);

      expect(hazardManager.hazards.length).toBe(1);
      expect(hazardManager.hazards[0]).toBe(mockHazard);
    });

    test('should clear hazards', () => {
      hazardManager.hazards = [{ type: 'bunker' }, { type: 'water' }];

      hazardManager.clearHazards();

      expect(hazardManager.hazards.length).toBe(0);
    });
  });

  describe('frame counting', () => {
    beforeEach(() => {
      hazardManager = new HazardManager(mockGame);
    });

    test('should increment frame count', () => {
      // Initialize the manager and add a ball
      hazardManager.init();
      mockGame.ballManager = { ball: {} };

      expect(hazardManager.frameCount).toBe(0);

      hazardManager.update();
      expect(hazardManager.frameCount).toBe(1);

      hazardManager.update();
      expect(hazardManager.frameCount).toBe(2);
    });

    test('should reset frame count after check frequency', () => {
      hazardManager.checkFrequency = 3;

      hazardManager.update();
      hazardManager.update();
      hazardManager.update();

      expect(hazardManager.frameCount).toBe(0);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      hazardManager = new HazardManager(mockGame);
      hazardManager.init();
    });

    test('should not check hazards if not initialized', () => {
      hazardManager.isInitialized = false;
      const checkSpy = jest.spyOn(hazardManager, 'checkHazards');

      hazardManager.update();

      expect(checkSpy).not.toHaveBeenCalled();
    });

    test('should not check hazards without ball', () => {
      mockGame.ballManager.ball = null;
      const checkSpy = jest.spyOn(hazardManager, 'checkHazards');

      hazardManager.update();

      expect(checkSpy).not.toHaveBeenCalled();
    });

    test('should check hazards at specified frequency', () => {
      const checkSpy = jest.spyOn(hazardManager, 'checkHazards');
      hazardManager.checkFrequency = 2;

      hazardManager.update(); // frameCount = 1, no check
      expect(checkSpy).not.toHaveBeenCalled();

      hazardManager.update(); // frameCount = 2, should check
      expect(checkSpy).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      hazardManager = new HazardManager(mockGame);
      hazardManager.init();
    });

    test('should unsubscribe from events', () => {
      const unsubscribeMock = jest.fn();
      hazardManager.eventSubscriptions = [unsubscribeMock, unsubscribeMock];

      hazardManager.cleanup();

      expect(unsubscribeMock).toHaveBeenCalledTimes(2);
    });

    test('should clear hazards', () => {
      hazardManager.hazards = [{ type: 'bunker' }];

      hazardManager.cleanup();

      expect(hazardManager.hazards.length).toBe(0);
    });

    test('should reset initialization state', () => {
      hazardManager.cleanup();

      expect(hazardManager.isInitialized).toBe(false);
    });
  });

  describe('hazard detection', () => {
    beforeEach(() => {
      hazardManager = new HazardManager(mockGame);
      hazardManager.init();
    });

    test('should publish hazard detected event', () => {
      const hazardData = {
        type: 'bunker',
        position: { x: 5, y: 0, z: 5 }
      };

      hazardManager.publishHazardDetected(hazardData);

      expect(mockEventManager.publish).toHaveBeenCalledWith(
        EventTypes.HAZARD_DETECTED,
        hazardData,
        hazardManager
      );
    });

    test('should publish out of bounds event', () => {
      const position = { x: 100, y: 0, z: 100 };

      hazardManager.publishOutOfBounds(position);

      expect(mockEventManager.publish).toHaveBeenCalledWith(
        EventTypes.HAZARD_DETECTED,
        { hazardType: 'outOfBounds', position },
        hazardManager
      );
    });
  });
});
