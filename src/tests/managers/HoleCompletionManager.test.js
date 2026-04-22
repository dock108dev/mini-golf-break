/**
 * Unit tests for HoleCompletionManager
 */

import { HoleCompletionManager } from '../../managers/HoleCompletionManager';
import { EventTypes } from '../../events/EventTypes';
import { GameState } from '../../states/GameState';

jest.mock('../../events/EventTypes', () => ({
  EventTypes: {
    BALL_IN_HOLE: 'ball:in_hole',
    HOLE_COMPLETED: 'hole:completed',
    STROKE_LIMIT_REACHED: 'scoring:stroke_limit_reached'
  }
}));

jest.mock('../../states/GameState', () => ({
  GameState: {
    GAME_COMPLETED: 'GAME_COMPLETED'
  }
}));

function createMockGame(overrides = {}) {
  const mockHoleMesh = {
    material: { opacity: 1, transparent: false },
    scale: { set: jest.fn() }
  };

  return {
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
      getTotalHoles: jest.fn(() => 9),
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
      getTotalStrokes: jest.fn(() => 3)
    },
    ...overrides
  };
}

describe('HoleCompletionManager', () => {
  let mockGame;
  let manager;

  beforeEach(() => {
    jest.useFakeTimers();
    mockGame = createMockGame();
    manager = new HoleCompletionManager(mockGame);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should store game reference and set defaults', () => {
      expect(manager.game).toBe(mockGame);
      expect(manager.completionDelay).toBe(1500);
      expect(manager.detectionGracePeriod).toBe(2000);
      expect(manager.isTransitioning).toBe(false);
    });
  });

  describe('init', () => {
    test('should subscribe to events and reset grace period', () => {
      const result = manager.init();

      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_IN_HOLE,
        manager.handleBallInHole,
        manager
      );
      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.STROKE_LIMIT_REACHED,
        manager.handleStrokeLimitReached,
        manager
      );
      expect(result).toBe(manager);
    });
  });

  describe('setupEventListeners', () => {
    test('should subscribe to BALL_IN_HOLE event', () => {
      manager.setupEventListeners();

      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_IN_HOLE,
        manager.handleBallInHole,
        manager
      );
    });

    test('should subscribe to STROKE_LIMIT_REACHED event', () => {
      manager.setupEventListeners();

      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.STROKE_LIMIT_REACHED,
        manager.handleStrokeLimitReached,
        manager
      );
    });
  });

  describe('resetGracePeriod', () => {
    test('should reset transition state and update creation time', () => {
      manager.isTransitioning = true;
      const timeBefore = manager.holeCreationTime;

      jest.advanceTimersByTime(100);
      manager.resetGracePeriod();

      expect(manager.isTransitioning).toBe(false);
      expect(manager.holeCreationTime).toBeGreaterThanOrEqual(timeBefore);
    });
  });

  describe('handleBallInHole — valid completion', () => {
    test('should complete hole when ball enters cup (low speed scenario)', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(3);
      mockGame.scoringSystem.getTotalStrokes.mockReturnValue(4);

      manager.handleBallInHole();

      expect(manager.isTransitioning).toBe(true);
      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
      expect(mockGame.audioManager.playSound).toHaveBeenCalledWith('success', 0.7);
      expect(mockGame.ballManager.ball.handleHoleSuccess).toHaveBeenCalled();
    });

    test('should publish HOLE_COMPLETED with correct holeNumber and totalStrokes', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(5);
      mockGame.scoringSystem.getTotalStrokes.mockReturnValue(12);

      manager.handleBallInHole();

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_COMPLETED,
        { holeNumber: 5, totalStrokes: 12 },
        manager
      );
    });

    test('should schedule UI message and transition with delays', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(2);

      manager.handleBallInHole();

      jest.advanceTimersByTime(500);
      expect(mockGame.uiManager.showMessage).toHaveBeenCalledWith('Great Shot!', 2000);

      jest.advanceTimersByTime(1000);
      expect(mockGame.holeTransitionManager.transitionToNextHole).toHaveBeenCalled();
      expect(manager.isTransitioning).toBe(false);
    });
  });

  describe('handleBallInHole — no duplicate completion', () => {
    test('should ignore when hole is already completed', () => {
      mockGame.stateManager.isHoleCompleted.mockReturnValue(true);

      manager.handleBallInHole();

      expect(mockGame.audioManager.playSound).not.toHaveBeenCalled();
      expect(mockGame.stateManager.setHoleCompleted).not.toHaveBeenCalled();
      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();
    });

    test('should ignore when already transitioning', () => {
      manager.isTransitioning = true;

      manager.handleBallInHole();

      expect(mockGame.audioManager.playSound).not.toHaveBeenCalled();
      expect(mockGame.stateManager.setHoleCompleted).not.toHaveBeenCalled();
      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();
    });

    test('should not re-emit after first completion', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(3);

      manager.handleBallInHole();

      expect(mockGame.eventManager.publish).toHaveBeenCalledTimes(1);

      mockGame.stateManager.isHoleCompleted.mockReturnValue(true);
      manager.handleBallInHole();

      expect(mockGame.eventManager.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleBallInHole — final hole (game completion)', () => {
    test('should set GAME_COMPLETED state on final hole', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(9);
      mockGame.course.getTotalHoles.mockReturnValue(9);

      manager.handleBallInHole();

      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.GAME_COMPLETED);
      expect(manager.isTransitioning).toBe(false);
    });

    test('should not schedule transition on final hole', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(9);
      mockGame.course.getTotalHoles.mockReturnValue(9);

      manager.handleBallInHole();

      jest.advanceTimersByTime(2000);
      expect(mockGame.holeTransitionManager.transitionToNextHole).not.toHaveBeenCalled();
    });
  });

  describe('handleBallInHole — hole-in-one', () => {
    test('should complete with 1 stroke and emit correct payload', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(1);
      mockGame.scoringSystem.getTotalStrokes.mockReturnValue(1);

      manager.handleBallInHole();

      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_COMPLETED,
        { holeNumber: 1, totalStrokes: 1 },
        manager
      );
    });
  });

  describe('handleBallInHole — error resilience', () => {
    test('should handle missing ball manager', () => {
      mockGame.ballManager = null;

      expect(() => manager.handleBallInHole()).not.toThrow();
      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
    });

    test('should handle missing audio manager', () => {
      mockGame.audioManager = null;

      expect(() => manager.handleBallInHole()).not.toThrow();
      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
    });

    test('should catch errors in immediate feedback actions', () => {
      mockGame.ballManager.ball.handleHoleSuccess.mockImplementation(() => {
        throw new Error('feedback error');
      });

      manager.handleBallInHole();

      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
    });
  });

  describe('handleStrokeLimitReached', () => {
    test('should mark hole completed and show max strokes message', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(4);
      mockGame.scoringSystem.getTotalStrokes.mockReturnValue(10);

      manager.handleStrokeLimitReached();

      expect(manager.isTransitioning).toBe(true);
      expect(mockGame.uiManager.showMessage).toHaveBeenCalledWith('Max strokes reached', 2000);
      expect(mockGame.stateManager.setHoleCompleted).toHaveBeenCalledWith(true);
    });

    test('should publish HOLE_COMPLETED with correct payload', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(7);
      mockGame.scoringSystem.getTotalStrokes.mockReturnValue(10);

      manager.handleStrokeLimitReached();

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_COMPLETED,
        { holeNumber: 7, totalStrokes: 10 },
        manager
      );
    });

    test('should transition to next hole after delay', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(3);

      manager.handleStrokeLimitReached();

      jest.advanceTimersByTime(1500);
      expect(mockGame.holeTransitionManager.transitionToNextHole).toHaveBeenCalled();
      expect(manager.isTransitioning).toBe(false);
    });

    test('should set GAME_COMPLETED on final hole stroke limit', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(9);
      mockGame.course.getTotalHoles.mockReturnValue(9);

      manager.handleStrokeLimitReached();

      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.GAME_COMPLETED);
      expect(manager.isTransitioning).toBe(false);
    });

    test('should ignore when hole already completed', () => {
      mockGame.stateManager.isHoleCompleted.mockReturnValue(true);

      manager.handleStrokeLimitReached();

      expect(mockGame.stateManager.setHoleCompleted).not.toHaveBeenCalled();
    });

    test('should ignore when already transitioning', () => {
      manager.isTransitioning = true;

      manager.handleStrokeLimitReached();

      expect(mockGame.stateManager.setHoleCompleted).not.toHaveBeenCalled();
    });
  });

  describe('resetCompletionState — reset enables re-completion', () => {
    test('should reset all completion state properties', () => {
      manager.isHoleComplete = true;
      manager.completionTime = 5000;
      manager.strokes = 10;
      manager.currentPar = 4;

      manager.resetCompletionState();

      expect(manager.isHoleComplete).toBe(false);
      expect(manager.completionTime).toBe(0);
      expect(manager.strokes).toBe(0);
      expect(manager.currentPar).toBe(0);
    });

    test('should allow new completion after reset via onHoleTransition', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(1);

      manager.handleBallInHole();
      expect(mockGame.eventManager.publish).toHaveBeenCalledTimes(1);

      manager.isTransitioning = false;
      mockGame.stateManager.isHoleCompleted.mockReturnValue(false);
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(2);
      mockGame.scoringSystem.getTotalStrokes.mockReturnValue(5);

      manager.onHoleTransition(1, 2);
      manager.resetGracePeriod();

      manager.handleBallInHole();

      expect(mockGame.eventManager.publish).toHaveBeenCalledTimes(2);
      expect(mockGame.eventManager.publish).toHaveBeenLastCalledWith(
        EventTypes.HOLE_COMPLETED,
        { holeNumber: 2, totalStrokes: 5 },
        manager
      );
    });
  });

  describe('updateScore', () => {
    test('should publish HOLE_COMPLETED event and update UI', () => {
      manager.updateScore(7, 34);

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_COMPLETED,
        { holeNumber: 7, totalStrokes: 34 },
        manager
      );
      expect(mockGame.uiManager.updateScore).toHaveBeenCalled();
    });
  });

  describe('onHoleTransition', () => {
    test('should reset state and update UI for new hole', () => {
      manager.onHoleTransition(3, 4);

      expect(manager.isHoleComplete).toBe(false);
      expect(manager.strokes).toBe(0);
      expect(manager.currentHoleNumber).toBe(4);
      expect(mockGame.course.getHolePar).toHaveBeenCalledWith(4);
      expect(mockGame.uiManager.updateHoleNumber).toHaveBeenCalledWith(4);
      expect(mockGame.uiManager.updatePar).toHaveBeenCalledWith(3);
    });

    test('should handle missing course', () => {
      mockGame.course = null;

      expect(() => manager.onHoleTransition(1, 2)).not.toThrow();
      expect(manager.currentHoleNumber).toBe(2);
    });

    test('should handle missing UI manager', () => {
      mockGame.uiManager = null;

      expect(() => manager.onHoleTransition(2, 3)).not.toThrow();
    });
  });

  describe('showCompletionEffects', () => {
    test('should start animation on valid hole mesh', () => {
      const mockHole = {
        material: { opacity: 1, transparent: false },
        scale: { set: jest.fn() }
      };
      mockGame.course.getCurrentHoleMesh.mockReturnValue(mockHole);

      manager.showCompletionEffects();

      expect(mockHole.material.transparent).toBe(true);
    });

    test('should handle null hole mesh', () => {
      mockGame.course.getCurrentHoleMesh.mockReturnValue(null);

      expect(() => manager.showCompletionEffects()).not.toThrow();
      expect(mockGame.scene.remove).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    test('should complete without errors', () => {
      expect(() => manager.cleanup()).not.toThrow();
    });
  });

  describe('update — no errors without currentHole', () => {
    test('should accept delta time without errors when no currentHole', () => {
      expect(() => manager.update(0.016)).not.toThrow();
    });
  });

  describe('update — cup sink detection', () => {
    const holePos = { x: 0, y: 0, z: 0 };

    function makeBallBody(posX, posZ, speed) {
      return {
        position: { x: posX, y: 0.2, z: posZ },
        velocity: { x: speed, y: 0, z: 0, length: () => Math.abs(speed) }
      };
    }

    beforeEach(() => {
      mockGame = createMockGame({
        course: {
          getTotalHoles: jest.fn(() => 9),
          getCurrentHoleMesh: jest.fn(),
          getHolePar: jest.fn(() => 3),
          currentHole: { worldHolePosition: holePos, cupRadius: 0.3 }
        }
      });
      mockGame.ballManager = {
        ball: { handleHoleSuccess: jest.fn(), body: makeBallBody(0, 0, 0) }
      };
      manager = new HoleCompletionManager(mockGame);
      manager.init();
      manager.holeCreationTime = Date.now() - 3000; // Past grace period
    });

    test('fires BALL_IN_HOLE when ball within cupRadius and speed 0.3 (< 0.5)', () => {
      mockGame.ballManager.ball.body = makeBallBody(0, 0, 0.3);

      manager.update(0.016);

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.BALL_IN_HOLE,
        {},
        manager
      );
    });

    test('does not fire when speed 0.6 (>= 0.5 threshold)', () => {
      mockGame.ballManager.ball.body = makeBallBody(0, 0, 0.6);

      manager.update(0.016);

      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();
    });

    test('does not fire when ball is outside cupRadius', () => {
      mockGame.ballManager.ball.body = makeBallBody(0.35, 0, 0.1);

      manager.update(0.016);

      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();
    });

    test('min-speed guard prevents false trigger after fast rim entry (speed 1.5)', () => {
      // Tick 1: inside trigger at high speed — no detection (speed > 0.5)
      mockGame.ballManager.ball.body = makeBallBody(0, 0, 1.5);
      manager.update(0.016);
      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();

      // Tick 2: ball slows to 0.3 inside trigger — guard blocks (prevSpeed 1.5 > 0.2)
      mockGame.ballManager.ball.body = makeBallBody(0, 0, 0.3);
      manager.update(0.016);
      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();
    });

    test('does not fire during grace period', () => {
      manager.holeCreationTime = Date.now(); // Reset to within grace period
      mockGame.ballManager.ball.body = makeBallBody(0, 0, 0.3);

      manager.update(0.016);

      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();
    });

    test('does not fire when isTransitioning is true', () => {
      manager.isTransitioning = true;
      mockGame.ballManager.ball.body = makeBallBody(0, 0, 0.3);

      manager.update(0.016);

      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();
    });

    test('does not fire when hole already completed', () => {
      mockGame.stateManager.isHoleCompleted.mockReturnValue(true);
      mockGame.ballManager.ball.body = makeBallBody(0, 0, 0.3);

      manager.update(0.016);

      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();
    });

    test('cupRadius defaults to 0.3 when not in config', () => {
      mockGame.course.currentHole = { worldHolePosition: holePos };
      mockGame.ballManager.ball.body = makeBallBody(0, 0, 0.3);

      manager.update(0.016);

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.BALL_IN_HOLE,
        {},
        manager
      );
    });
  });

  describe('transition timeout guard', () => {
    test('should skip transition if isTransitioning was cleared before timeout fires', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(2);

      manager.handleBallInHole();
      manager.isTransitioning = false;

      jest.advanceTimersByTime(1500);
      expect(mockGame.holeTransitionManager.transitionToNextHole).not.toHaveBeenCalled();
    });

    test('should skip stroke-limit transition if isTransitioning was cleared', () => {
      mockGame.stateManager.getCurrentHoleNumber.mockReturnValue(3);

      manager.handleStrokeLimitReached();
      manager.isTransitioning = false;

      jest.advanceTimersByTime(1500);
      expect(mockGame.holeTransitionManager.transitionToNextHole).not.toHaveBeenCalled();
    });
  });
});
