/**
 * Unit tests for HoleCompletionManager
 */

import { HoleCompletionManager } from '../../managers/HoleCompletionManager';
import { EventTypes } from '../../events/EventTypes';
import { GameState } from '../../states/GameState';

// Mock dependencies
jest.mock('../../events/EventTypes', () => ({
  EventTypes: {
    BALL_IN_HOLE: 'BALL_IN_HOLE',
    HOLE_COMPLETED: 'HOLE_COMPLETED'
  }
}));

jest.mock('../../states/GameState', () => ({
  GameState: {
    GAME_COMPLETED: 'GAME_COMPLETED'
  }
}));

describe('HoleCompletionManager', () => {
  let mockGame;
  let holeCompletionManager;

  beforeEach(() => {
    // Mock game object
    mockGame = {
      eventManager: {
        subscribe: jest.fn(),
        publish: jest.fn()
      },
      stateManager: {
        getCurrentHoleNumber: jest.fn(() => 1),
        isHoleCompleted: jest.fn(() => false),
        setHoleCompleted: jest.fn(),
        setGameState: jest.fn()
      },
      course: {
        getTotalHoles: jest.fn(() => 18),
        getCurrentHoleMesh: jest.fn(() => mockHoleMesh),
        getHolePar: jest.fn(() => 3)
      },
      ballManager: {
        ball: {
          handleHoleSuccess: jest.fn()
        }
      },
      audioManager: {
        playSound: jest.fn()
      },
      uiManager: {
        showMessage: jest.fn(),
        updateScore: jest.fn(),
        updateHoleNumber: jest.fn(),
        updatePar: jest.fn()
      },
      debugManager: {
        log: jest.fn()
      },
      holeTransitionManager: {
        transitionToNextHole: jest.fn()
      },
      scene: {
        remove: jest.fn()
      },
      scoringSystem: {
        getTotalStrokes: jest.fn(() => 15)
      }
    };

    // Mock hole mesh
    const mockHoleMesh = {
      material: {
        opacity: 1,
        transparent: false
      },
      scale: {
        set: jest.fn()
      }
    };

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Mock setTimeout
    global.setTimeout = jest.fn((fn, timeout) => {
      return 'timeout-id-' + timeout;
    });

    // Mock Date.now with incrementing time to avoid infinite loops
    let mockTime = 1000000;
    global.Date.now = jest.fn(() => {
      mockTime += 100; // Increment time each call
      return mockTime;
    });

    // Mock requestAnimationFrame - don't execute the callback to avoid infinite loops
    global.requestAnimationFrame = jest.fn(fn => {
      return 'raf-id';
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with game reference', () => {
      holeCompletionManager = new HoleCompletionManager(mockGame);

      expect(holeCompletionManager.game).toBe(mockGame);
    });

    test('should initialize with default values', () => {
      holeCompletionManager = new HoleCompletionManager(mockGame);

      expect(holeCompletionManager.completionDelay).toBe(1500);
      expect(holeCompletionManager.detectionGracePeriod).toBe(2000);
      expect(holeCompletionManager.holeCreationTime).toBeGreaterThan(1000000);
      expect(holeCompletionManager.isTransitioning).toBe(false);
    });
  });

  describe('init', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should setup event listeners and reset grace period', () => {
      const setupEventListenersSpy = jest
        .spyOn(holeCompletionManager, 'setupEventListeners')
        .mockImplementation(() => {});
      const resetGracePeriodSpy = jest
        .spyOn(holeCompletionManager, 'resetGracePeriod')
        .mockImplementation(() => {});

      const result = holeCompletionManager.init();

      expect(setupEventListenersSpy).toHaveBeenCalled();
      expect(resetGracePeriodSpy).toHaveBeenCalled();
      expect(result).toBe(holeCompletionManager); // Returns self for chaining

      setupEventListenersSpy.mockRestore();
      resetGracePeriodSpy.mockRestore();
    });
  });

  describe('setupEventListeners', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should subscribe to BALL_IN_HOLE event', () => {
      holeCompletionManager.setupEventListeners();

      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_IN_HOLE,
        holeCompletionManager.handleBallInHole,
        holeCompletionManager
      );
    });
  });

  describe('resetGracePeriod', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should reset grace period and transition state', () => {
      holeCompletionManager.isTransitioning = true;
      const timeBefore = holeCompletionManager.holeCreationTime;

      holeCompletionManager.resetGracePeriod();

      expect(holeCompletionManager.holeCreationTime).toBeGreaterThan(timeBefore);
      expect(holeCompletionManager.isTransitioning).toBe(false);
      expect(mockGame.debugManager.log).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] Hole detection grace period reset at')
      );
    });
  });

  describe('handleBallInHole', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should complete hole on first non-final hole', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(3);
      mockGame.course.getTotalHoles.mockReturnValue(18);

      holeCompletionManager.handleBallInHole();

      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', '[HoleCompletionManager] Ball in hole for hole 3 of 18'
      );
      expect(holeCompletionManager.isTransitioning).toBe(true);
      expect(mockGame.audioManager.playSound).toHaveBeenCalledWith('success', 0.7);
      expect(mockGame.ballManager.ball.handleHoleSuccess).toHaveBeenCalled();
      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1500);
    });

    test('should complete game on final hole', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(18);
      mockGame.course.getTotalHoles.mockReturnValue(18);

      holeCompletionManager.handleBallInHole();

      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[HoleCompletionManager] Final hole 18 completed');
      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.GAME_COMPLETED);
      expect(holeCompletionManager.isTransitioning).toBe(false);
    });

    test('should ignore event when hole already completed', () => {
      mockGame.stateManager.isHoleCompleted.mockReturnValue(true);

      holeCompletionManager.handleBallInHole();

      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', '[HoleCompletionManager] Hole already completed or transitioning, ignoring ball in hole event'
      );
      expect(mockGame.audioManager.playSound).not.toHaveBeenCalled();
    });

    test('should ignore event when already transitioning', () => {
      holeCompletionManager.isTransitioning = true;

      holeCompletionManager.handleBallInHole();

      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', '[HoleCompletionManager] Hole already completed or transitioning, ignoring ball in hole event'
      );
      expect(mockGame.audioManager.playSound).not.toHaveBeenCalled();
    });

    test('should handle missing ball manager gracefully', () => {
      mockGame.ballManager = null;

      expect(() => {
        holeCompletionManager.handleBallInHole();
      }).not.toThrow();

      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
    });

    test('should handle missing audio manager gracefully', () => {
      mockGame.audioManager = null;

      expect(() => {
        holeCompletionManager.handleBallInHole();
      }).not.toThrow();

      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
    });

    test('should handle errors during immediate feedback actions', () => {
      mockGame.ballManager.ball.handleHoleSuccess.mockImplementation(() => {
        throw new Error('Ball success handler failed');
      });

      holeCompletionManager.handleBallInHole();

      expect(console.error).toHaveBeenCalledWith(
        '[HoleCompletionManager] Error during immediate feedback actions:',
        expect.any(Error)
      );
      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
    });

    test('should call updateScore with correct parameters', () => {
      const updateScoreSpy = jest
        .spyOn(holeCompletionManager, 'updateScore')
        .mockImplementation(() => {});
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(5);
      mockGame.scoringSystem.getTotalStrokes.mockReturnValue(23);

      holeCompletionManager.handleBallInHole();

      expect(updateScoreSpy).toHaveBeenCalledWith(5, 23);

      updateScoreSpy.mockRestore();
    });
  });

  describe('showCompletionEffects', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should animate hole disappearing', () => {
      const mockHole = {
        material: {
          opacity: 1,
          transparent: false
        },
        scale: {
          set: jest.fn()
        }
      };
      mockGame.course.getCurrentHoleMesh.mockReturnValue(mockHole);

      holeCompletionManager.showCompletionEffects();

      // Verify that animation starts
      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(mockHole.material.transparent).toBe(true);

      // Since we don't execute the callback, we can't test the final state
      // But we can verify the animation setup was called
    });

    test('should handle missing hole mesh gracefully', () => {
      mockGame.course.getCurrentHoleMesh.mockReturnValue(null);

      expect(() => {
        holeCompletionManager.showCompletionEffects();
      }).not.toThrow();

      expect(mockGame.scene.remove).not.toHaveBeenCalled();
    });

    test('should handle hole without material gracefully', () => {
      const mockHole = {
        material: null,
        scale: {
          set: jest.fn()
        }
      };
      mockGame.course.getCurrentHoleMesh.mockReturnValue(mockHole);

      expect(() => {
        holeCompletionManager.showCompletionEffects();
      }).not.toThrow();

      // Verify animation setup is called even without material
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('updateScore', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should publish hole completed event and update UI', () => {
      holeCompletionManager.updateScore(7, 34);

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_COMPLETED,
        {
          holeNumber: 7,
          totalStrokes: 34
        },
        holeCompletionManager
      );
      expect(mockGame.uiManager.updateScore).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should complete without errors', () => {
      expect(() => {
        holeCompletionManager.cleanup();
      }).not.toThrow();
    });
  });

  describe('onHoleTransition', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should handle hole transition correctly', () => {
      const resetCompletionStateSpy = jest
        .spyOn(holeCompletionManager, 'resetCompletionState')
        .mockImplementation(() => {});

      holeCompletionManager.onHoleTransition(3, 4);

      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', '[HoleCompletionManager] Handling transition from hole 3 to 4'
      );
      expect(resetCompletionStateSpy).toHaveBeenCalled();
      expect(holeCompletionManager.currentHoleNumber).toBe(4);
      expect(mockGame.course.getHolePar).toHaveBeenCalledWith(4);
      expect(holeCompletionManager.currentPar).toBe(3);
      expect(mockGame.uiManager.updateHoleNumber).toHaveBeenCalledWith(4);
      expect(mockGame.uiManager.updatePar).toHaveBeenCalledWith(3);
      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', '[HoleCompletionManager] Transition to hole 4 complete'
      );

      resetCompletionStateSpy.mockRestore();
    });

    test('should handle missing course gracefully', () => {
      mockGame.course = null;
      const resetCompletionStateSpy = jest
        .spyOn(holeCompletionManager, 'resetCompletionState')
        .mockImplementation(() => {});

      expect(() => {
        holeCompletionManager.onHoleTransition(1, 2);
      }).not.toThrow();

      expect(resetCompletionStateSpy).toHaveBeenCalled();
      expect(holeCompletionManager.currentHoleNumber).toBe(2);

      resetCompletionStateSpy.mockRestore();
    });

    test('should handle missing UI manager gracefully', () => {
      mockGame.uiManager = null;
      const resetCompletionStateSpy = jest
        .spyOn(holeCompletionManager, 'resetCompletionState')
        .mockImplementation(() => {});

      expect(() => {
        holeCompletionManager.onHoleTransition(2, 3);
      }).not.toThrow();

      expect(resetCompletionStateSpy).toHaveBeenCalled();

      resetCompletionStateSpy.mockRestore();
    });
  });

  describe('resetCompletionState', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should reset completion state properties', () => {
      holeCompletionManager.isHoleComplete = true;
      holeCompletionManager.completionTime = 5000;
      holeCompletionManager.strokes = 10;
      holeCompletionManager.currentPar = 4;

      holeCompletionManager.resetCompletionState();

      expect(holeCompletionManager.isHoleComplete).toBe(false);
      expect(holeCompletionManager.completionTime).toBe(0);
      expect(holeCompletionManager.strokes).toBe(0);
      expect(holeCompletionManager.currentPar).toBe(0);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should accept delta time parameter without errors', () => {
      expect(() => {
        holeCompletionManager.update(0.016);
      }).not.toThrow();
    });

    test('should handle missing delta time', () => {
      expect(() => {
        holeCompletionManager.update();
      }).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      holeCompletionManager = new HoleCompletionManager(mockGame);
    });

    test('should handle complete hole workflow', () => {
      // Initialize manager
      holeCompletionManager.init();

      // Simulate ball in hole for mid-game hole
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(5);
      mockGame.course.getTotalHoles.mockReturnValue(9);

      holeCompletionManager.handleBallInHole();

      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_IN_HOLE,
        holeCompletionManager.handleBallInHole,
        holeCompletionManager
      );
      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_COMPLETED,
        {
          holeNumber: 5,
          totalStrokes: 15
        },
        holeCompletionManager
      );
    });

    test('should handle game completion workflow', () => {
      holeCompletionManager.init();

      // Simulate ball in hole for final hole
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(9);
      mockGame.course.getTotalHoles.mockReturnValue(9);

      holeCompletionManager.handleBallInHole();

      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.GAME_COMPLETED);
      expect(holeCompletionManager.isTransitioning).toBe(false);
    });

    test('should handle hole transition with state reset', () => {
      holeCompletionManager.init();

      // Set some state
      holeCompletionManager.isHoleComplete = true;
      holeCompletionManager.strokes = 5;

      // Perform transition
      holeCompletionManager.onHoleTransition(2, 3);

      // Verify state was reset
      expect(holeCompletionManager.isHoleComplete).toBe(false);
      expect(holeCompletionManager.strokes).toBe(0);
      expect(holeCompletionManager.currentHoleNumber).toBe(3);
    });

    test('should handle completion effects animation', () => {
      const mockHole = {
        material: {
          opacity: 1,
          transparent: false
        },
        scale: {
          set: jest.fn()
        }
      };
      mockGame.course.getCurrentHoleMesh.mockReturnValue(mockHole);

      holeCompletionManager.showCompletionEffects();

      // Verify animation setup
      expect(mockHole.material.transparent).toBe(true);
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });
  });
});
