/**
 * Unit tests for StateManager
 */

import { StateManager } from '../../managers/StateManager';
import { GameState } from '../../states/GameState';
import { EventTypes } from '../../events/EventTypes';

// Mock dependencies
jest.mock('../../states/GameState', () => ({
  GameState: {
    INITIALIZING: 'INITIALIZING',
    AIMING: 'AIMING',
    BALL_MOVING: 'BALL_MOVING',
    HOLE_COMPLETED: 'HOLE_COMPLETED',
    GAME_COMPLETED: 'GAME_COMPLETED'
  }
}));

jest.mock('../../events/EventTypes', () => ({
  EventTypes: {
    STATE_CHANGED: 'STATE_CHANGED',
    GAME_COMPLETED: 'GAME_COMPLETED',
    HOLE_STARTED: 'HOLE_STARTED'
  }
}));

jest.mock('../../utils/debug', () => ({
  debug: {
    log: jest.fn()
  }
}));

describe('StateManager', () => {
  let mockGame;
  let stateManager;

  beforeEach(() => {
    // Mock game object
    mockGame = {
      eventManager: {
        publish: jest.fn()
      },
      course: {
        getTotalHoles: jest.fn(() => 9)
      },
      scoringSystem: {
        completeHole: jest.fn(),
        resetCurrentStrokes: jest.fn()
      }
    };

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Mock Date.now
    global.Date.now = jest.fn(() => 1000000);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with game reference and default state', () => {
      stateManager = new StateManager(mockGame);

      expect(stateManager.game).toBe(mockGame);
      expect(stateManager.state).toEqual({
        ballInMotion: false,
        holeCompleted: false,
        currentHoleNumber: 1,
        resetBall: false,
        gameOver: false,
        gameStarted: false,
        currentGameState: GameState.INITIALIZING,
        showingMessage: false,
        debugMode: false
      });
      expect(stateManager.eventCallbacks).toEqual({
        onHoleCompleted: [],
        onBallStopped: [],
        onBallHit: [],
        onStateChange: []
      });
    });
  });

  describe('setGameState', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('should change game state and publish event', () => {
      stateManager.setGameState(GameState.AIMING);

      expect(stateManager.state.currentGameState).toBe(GameState.AIMING);
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.STATE_CHANGED,
        {
          oldState: GameState.INITIALIZING,
          newState: GameState.AIMING
        },
        stateManager
      );
    });

    test('should publish GAME_COMPLETED event when transitioning to completed state', () => {
      stateManager.setGameState(GameState.GAME_COMPLETED);

      expect(mockGame.eventManager.publish).toHaveBeenCalledTimes(2);
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.GAME_COMPLETED,
        { timestamp: 1000000 },
        stateManager
      );
    });

    test('should return self for chaining', () => {
      const result = stateManager.setGameState(GameState.AIMING);
      expect(result).toBe(stateManager);
    });
  });

  describe('getGameState', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('should return current game state', () => {
      expect(stateManager.getGameState()).toBe(GameState.INITIALIZING);

      stateManager.setGameState(GameState.BALL_MOVING);
      expect(stateManager.getGameState()).toBe(GameState.BALL_MOVING);
    });
  });

  describe('isInState', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('should return true when in specified state', () => {
      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.isInState(GameState.AIMING)).toBe(true);
    });

    test('should return false when not in specified state', () => {
      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.isInState(GameState.BALL_MOVING)).toBe(false);
    });
  });

  describe('ball motion methods', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('setBallInMotion should set ball motion state', () => {
      stateManager.setBallInMotion(true);
      expect(stateManager.state.ballInMotion).toBe(true);

      stateManager.setBallInMotion(false);
      expect(stateManager.state.ballInMotion).toBe(false);
    });

    test('setBallInMotion should return self for chaining', () => {
      const result = stateManager.setBallInMotion(true);
      expect(result).toBe(stateManager);
    });

    test('isBallInMotion should return ball motion state', () => {
      expect(stateManager.isBallInMotion()).toBe(false);

      stateManager.setBallInMotion(true);
      expect(stateManager.isBallInMotion()).toBe(true);
    });
  });

  describe('hole completion methods', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('setHoleCompleted should set hole completion state', () => {
      stateManager.setHoleCompleted(true);
      expect(stateManager.state.holeCompleted).toBe(true);
      expect(stateManager.state.currentGameState).toBe(GameState.HOLE_COMPLETED);
    });

    test('setHoleCompleted(false) should only set flag', () => {
      stateManager.setHoleCompleted(false);
      expect(stateManager.state.holeCompleted).toBe(false);
      expect(stateManager.state.currentGameState).toBe(GameState.INITIALIZING);
    });

    test('setHoleCompleted(true) should notify callbacks', () => {
      const mockCallback = jest.fn();
      stateManager.eventCallbacks.onHoleCompleted.push(mockCallback);

      stateManager.setHoleCompleted(true);

      expect(mockCallback).toHaveBeenCalled();
    });

    test('setHoleCompleted should handle callback errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      stateManager.eventCallbacks.onHoleCompleted.push(errorCallback);

      expect(() => {
        stateManager.setHoleCompleted(true);
      }).not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        'Error in hole completed callback:',
        expect.any(Error)
      );
    });

    test('isHoleCompleted should return hole completion state', () => {
      expect(stateManager.isHoleCompleted()).toBe(false);

      stateManager.setHoleCompleted(true);
      expect(stateManager.isHoleCompleted()).toBe(true);
    });
  });

  describe('getCurrentHoleNumber', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('should return current hole number', () => {
      expect(stateManager.getCurrentHoleNumber()).toBe(1);

      stateManager.state.currentHoleNumber = 5;
      expect(stateManager.getCurrentHoleNumber()).toBe(5);
    });
  });

  describe('game over methods', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('setGameOver(true) should set game over and complete state', () => {
      stateManager.setGameOver(true);

      expect(stateManager.state.gameOver).toBe(true);
      expect(stateManager.state.currentGameState).toBe(GameState.GAME_COMPLETED);
    });

    test('setGameOver(false) should only set flag', () => {
      stateManager.setGameOver(false);

      expect(stateManager.state.gameOver).toBe(false);
      expect(stateManager.state.currentGameState).toBe(GameState.INITIALIZING);
    });

    test('setGameOver should return self for chaining', () => {
      const result = stateManager.setGameOver(true);
      expect(result).toBe(stateManager);
    });

    test('isGameOver should return game over state', () => {
      expect(stateManager.isGameOver()).toBe(false);

      stateManager.setGameOver(true);
      expect(stateManager.isGameOver()).toBe(true);
    });
  });

  describe('resetForNextHole', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('should increment hole number when not at last hole', () => {
      stateManager.state.currentHoleNumber = 3;

      stateManager.resetForNextHole();

      expect(stateManager.state.currentHoleNumber).toBe(4);
      expect(stateManager.state.holeCompleted).toBe(false);
      expect(stateManager.state.ballInMotion).toBe(false);
      expect(stateManager.state.currentGameState).toBe(GameState.AIMING);
    });

    test('should not increment when at last hole', () => {
      stateManager.state.currentHoleNumber = 9;
      mockGame.course.getTotalHoles.mockReturnValue(9);

      stateManager.resetForNextHole();

      expect(stateManager.state.currentHoleNumber).toBe(9);
    });

    test('should set game completed when past last hole', () => {
      stateManager.state.currentHoleNumber = 10;
      mockGame.course.getTotalHoles.mockReturnValue(9);

      stateManager.resetForNextHole();

      expect(console.warn).toHaveBeenCalledWith(
        '[StateManager] No more holes available - past last hole'
      );
      expect(stateManager.state.currentGameState).toBe(GameState.GAME_COMPLETED);
    });

    test('should reset scoring system', () => {
      stateManager.resetForNextHole();

      expect(mockGame.scoringSystem.resetCurrentStrokes).toHaveBeenCalled();
    });

    test('should handle missing scoring system', () => {
      mockGame.scoringSystem = null;

      expect(() => {
        stateManager.resetForNextHole();
      }).not.toThrow();

      expect(console.warn).toHaveBeenCalledWith(
        '[StateManager] ScoringSystem not found, cannot reset strokes.'
      );
    });

    test('should publish HOLE_STARTED event', () => {
      stateManager.state.currentHoleNumber = 2;

      stateManager.resetForNextHole();

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_STARTED,
        { holeNumber: 3 },
        stateManager
      );
    });

    test('should handle case where no more holes are available', () => {
      // Test with valid eventManager but past last hole
      stateManager = new StateManager(mockGame);
      stateManager.state.currentHoleNumber = 10;
      mockGame.course.getTotalHoles.mockReturnValue(9);

      stateManager.resetForNextHole();

      // Since we're past the last hole, it should warn and set game completed
      expect(console.warn).toHaveBeenCalledWith(
        '[StateManager] No more holes available - past last hole'
      );
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.GAME_COMPLETED,
        { timestamp: expect.any(Number) },
        stateManager
      );
    });

    test('should return self for chaining', () => {
      const result = stateManager.resetForNextHole();
      expect(result).toBe(stateManager);
    });
  });

  describe('resetState', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('should reset all state to initial values', () => {
      // Set some non-default values
      stateManager.state.ballInMotion = true;
      stateManager.state.holeCompleted = true;
      stateManager.state.currentHoleNumber = 5;
      stateManager.state.resetBall = true;
      stateManager.state.gameOver = true;
      stateManager.state.gameStarted = true;
      stateManager.state.showingMessage = true;
      stateManager.state.currentGameState = GameState.BALL_MOVING;

      stateManager.resetState();

      expect(stateManager.state).toEqual({
        ballInMotion: false,
        holeCompleted: false,
        currentHoleNumber: 1,
        resetBall: false,
        gameOver: false,
        gameStarted: false,
        currentGameState: GameState.INITIALIZING,
        showingMessage: false,
        debugMode: false
      });
    });

    test('should return self for chaining', () => {
      const result = stateManager.resetState();
      expect(result).toBe(stateManager);
    });
  });

  describe('reset ball methods', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('setResetBall should set reset ball flag', () => {
      stateManager.setResetBall(true);
      expect(stateManager.state.resetBall).toBe(true);

      stateManager.setResetBall(false);
      expect(stateManager.state.resetBall).toBe(false);
    });

    test('shouldResetBall should return reset ball state', () => {
      expect(stateManager.shouldResetBall()).toBe(false);

      stateManager.setResetBall(true);
      expect(stateManager.shouldResetBall()).toBe(true);
    });

    test('clearResetBall should clear reset ball flag', () => {
      stateManager.setResetBall(true);
      stateManager.clearResetBall();

      expect(stateManager.state.resetBall).toBe(false);
    });
  });

  describe('debug mode methods', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('isDebugMode should return debug mode state', () => {
      expect(stateManager.isDebugMode()).toBe(false);

      stateManager.state.debugMode = true;
      expect(stateManager.isDebugMode()).toBe(true);
    });

    test('toggleDebugMode should toggle debug mode', () => {
      expect(stateManager.isDebugMode()).toBe(false);

      stateManager.toggleDebugMode();
      expect(stateManager.isDebugMode()).toBe(true);

      stateManager.toggleDebugMode();
      expect(stateManager.isDebugMode()).toBe(false);
    });
  });

  describe('_notifyHoleCompleted', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('should call all registered callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      stateManager.eventCallbacks.onHoleCompleted = [callback1, callback2, callback3];

      stateManager._notifyHoleCompleted();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });

    test('should continue calling callbacks even if one throws', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn(() => {
        throw new Error('Callback error');
      });
      const callback3 = jest.fn();

      stateManager.eventCallbacks.onHoleCompleted = [callback1, callback2, callback3];

      stateManager._notifyHoleCompleted();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        'Error in hole completed callback:',
        expect.any(Error)
      );
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      stateManager = new StateManager(mockGame);
    });

    test('should handle complete hole progression', () => {
      // Start at hole 1
      expect(stateManager.getCurrentHoleNumber()).toBe(1);

      // Complete hole 1
      stateManager.setHoleCompleted(true);
      expect(stateManager.isHoleCompleted()).toBe(true);

      // Reset for hole 2
      stateManager.resetForNextHole();
      expect(stateManager.getCurrentHoleNumber()).toBe(2);
      expect(stateManager.isHoleCompleted()).toBe(false);
      expect(stateManager.getGameState()).toBe(GameState.AIMING);
    });

    test('should handle game completion flow', () => {
      // Set to last hole
      stateManager.state.currentHoleNumber = 9;
      mockGame.course.getTotalHoles.mockReturnValue(9);

      // Complete last hole
      stateManager.setHoleCompleted(true);

      // Try to go to next hole
      stateManager.resetForNextHole();

      // Should still be on hole 9
      expect(stateManager.getCurrentHoleNumber()).toBe(9);

      // Set game over
      stateManager.setGameOver(true);
      expect(stateManager.isGameOver()).toBe(true);
      expect(stateManager.getGameState()).toBe(GameState.GAME_COMPLETED);
    });

    test('should handle state transitions during gameplay', () => {
      // Initial state
      expect(stateManager.getGameState()).toBe(GameState.INITIALIZING);

      // Start aiming
      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.isInState(GameState.AIMING)).toBe(true);

      // Ball is hit
      stateManager.setBallInMotion(true);
      stateManager.setGameState(GameState.BALL_MOVING);
      expect(stateManager.isBallInMotion()).toBe(true);

      // Ball stops
      stateManager.setBallInMotion(false);
      stateManager.setGameState(GameState.AIMING);

      // Ball goes in hole
      stateManager.setHoleCompleted(true);
      expect(stateManager.getGameState()).toBe(GameState.HOLE_COMPLETED);
    });
  });
});
