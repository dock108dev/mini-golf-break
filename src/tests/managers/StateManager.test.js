import { StateManager } from '../../managers/StateManager';
import { GameState } from '../../states/GameState';
import { EventTypes } from '../../events/EventTypes';

jest.mock('../../states/GameState', () => ({
  GameState: {
    INITIALIZING: 'initializing',
    PLAYING: 'playing',
    AIMING: 'aiming',
    HOLE_COMPLETED: 'hole_completed',
    GAME_COMPLETED: 'game_completed',
    PAUSED: 'paused'
  }
}));

jest.mock('../../events/EventTypes', () => ({
  EventTypes: {
    STATE_CHANGED: 'state:changed',
    GAME_COMPLETED: 'game:completed',
    HOLE_STARTED: 'hole:started'
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
    mockGame = {
      eventManager: {
        publish: jest.fn()
      },
      course: {
        getTotalHoles: jest.fn(() => 9),
        getCurrentHoleConfig: jest.fn(() => ({ par: 3, maxStrokes: 8 })),
        getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
        createCourse: jest.fn(() => Promise.resolve(true))
      },
      scoringSystem: {
        completeHole: jest.fn(),
        resetCurrentStrokes: jest.fn(),
        setMaxStrokes: jest.fn()
      },
      holeTransitionManager: {
        unloadCurrentHole: jest.fn(() => Promise.resolve())
      },
      physicsManager: {
        resetWorld: jest.fn(() => Promise.resolve({ world: {} }))
      },
      uiManager: {
        showTransitionOverlay: jest.fn(),
        hideTransitionOverlay: jest.fn(),
        updateHoleInfo: jest.fn(),
        showMessage: jest.fn(),
        updateScore: jest.fn(),
        updateStrokes: jest.fn()
      },
      ballManager: {
        createBall: jest.fn()
      },
      inputController: {
        enableInput: jest.fn()
      },
      cameraController: {
        positionCameraForHole: jest.fn()
      },
      hazardManager: {
        setHoleBounds: jest.fn()
      },
      holeCompletionManager: {
        resetGracePeriod: jest.fn()
      },
      cannonDebugRenderer: null
    };

    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Date, 'now').mockReturnValue(1000000);

    stateManager = new StateManager(mockGame);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('initializes with game reference and default state', () => {
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
    });

    test('initializes empty event callback arrays', () => {
      expect(stateManager.eventCallbacks).toEqual({
        onHoleCompleted: [],
        onBallStopped: [],
        onBallHit: [],
        onStateChange: []
      });
    });
  });

  describe('setGameState', () => {
    test('updates currentGameState', () => {
      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.state.currentGameState).toBe(GameState.AIMING);
    });

    test('publishes STATE_CHANGED with old and new state', () => {
      stateManager.setGameState(GameState.AIMING);

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.STATE_CHANGED,
        { oldState: GameState.INITIALIZING, newState: GameState.AIMING },
        stateManager
      );
    });

    test('publishes GAME_COMPLETED event when transitioning to GAME_COMPLETED', () => {
      stateManager.setGameState(GameState.GAME_COMPLETED);

      expect(mockGame.eventManager.publish).toHaveBeenCalledTimes(2);
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.STATE_CHANGED,
        { oldState: GameState.INITIALIZING, newState: GameState.GAME_COMPLETED },
        stateManager
      );
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.GAME_COMPLETED,
        { timestamp: 1000000 },
        stateManager
      );
    });

    test('does not publish GAME_COMPLETED event for non-completed states', () => {
      stateManager.setGameState(GameState.AIMING);
      expect(mockGame.eventManager.publish).toHaveBeenCalledTimes(1);
    });

    test('returns self for chaining', () => {
      expect(stateManager.setGameState(GameState.AIMING)).toBe(stateManager);
    });
  });

  describe('every GameState value is reachable', () => {
    test.each([
      ['INITIALIZING', GameState.INITIALIZING],
      ['PLAYING', GameState.PLAYING],
      ['AIMING', GameState.AIMING],
      ['HOLE_COMPLETED', GameState.HOLE_COMPLETED],
      ['GAME_COMPLETED', GameState.GAME_COMPLETED],
      ['PAUSED', GameState.PAUSED]
    ])('can transition to %s', (_label, state) => {
      stateManager.setGameState(state);
      expect(stateManager.getGameState()).toBe(state);
    });
  });

  describe('valid state transitions', () => {
    test('INITIALIZING -> AIMING', () => {
      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.getGameState()).toBe(GameState.AIMING);
    });

    test('AIMING -> PLAYING', () => {
      stateManager.setGameState(GameState.AIMING);
      stateManager.setGameState(GameState.PLAYING);
      expect(stateManager.getGameState()).toBe(GameState.PLAYING);
    });

    test('PLAYING -> AIMING (ball stops, no hole)', () => {
      stateManager.setGameState(GameState.PLAYING);
      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.getGameState()).toBe(GameState.AIMING);
    });

    test('PLAYING -> HOLE_COMPLETED', () => {
      stateManager.setGameState(GameState.PLAYING);
      stateManager.setGameState(GameState.HOLE_COMPLETED);
      expect(stateManager.getGameState()).toBe(GameState.HOLE_COMPLETED);
    });

    test('HOLE_COMPLETED -> AIMING (next hole)', () => {
      stateManager.setGameState(GameState.HOLE_COMPLETED);
      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.getGameState()).toBe(GameState.AIMING);
    });

    test('HOLE_COMPLETED -> GAME_COMPLETED (last hole)', () => {
      stateManager.setGameState(GameState.HOLE_COMPLETED);
      stateManager.setGameState(GameState.GAME_COMPLETED);
      expect(stateManager.getGameState()).toBe(GameState.GAME_COMPLETED);
    });

    test('each transition emits STATE_CHANGED with correct old/new', () => {
      stateManager.setGameState(GameState.AIMING);
      stateManager.setGameState(GameState.PLAYING);

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.STATE_CHANGED,
        { oldState: GameState.INITIALIZING, newState: GameState.AIMING },
        stateManager
      );
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.STATE_CHANGED,
        { oldState: GameState.AIMING, newState: GameState.PLAYING },
        stateManager
      );
    });
  });

  describe('PAUSED state', () => {
    test.each([
      ['AIMING', GameState.AIMING],
      ['PLAYING', GameState.PLAYING],
      ['HOLE_COMPLETED', GameState.HOLE_COMPLETED],
      ['INITIALIZING', GameState.INITIALIZING]
    ])('can be entered from %s', (_label, activeState) => {
      stateManager.setGameState(activeState);
      mockGame.eventManager.publish.mockClear();

      stateManager.setGameState(GameState.PAUSED);

      expect(stateManager.getGameState()).toBe(GameState.PAUSED);
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.STATE_CHANGED,
        { oldState: activeState, newState: GameState.PAUSED },
        stateManager
      );
    });

    test.each([
      ['AIMING', GameState.AIMING],
      ['PLAYING', GameState.PLAYING],
      ['HOLE_COMPLETED', GameState.HOLE_COMPLETED]
    ])('can resume back to %s', (_label, priorState) => {
      stateManager.setGameState(priorState);
      const savedState = stateManager.getGameState();

      stateManager.setGameState(GameState.PAUSED);
      expect(stateManager.getGameState()).toBe(GameState.PAUSED);

      stateManager.setGameState(savedState);
      expect(stateManager.getGameState()).toBe(priorState);
    });

    test('pausing and resuming emits two STATE_CHANGED events', () => {
      stateManager.setGameState(GameState.AIMING);
      mockGame.eventManager.publish.mockClear();

      stateManager.setGameState(GameState.PAUSED);
      stateManager.setGameState(GameState.AIMING);

      expect(mockGame.eventManager.publish).toHaveBeenCalledTimes(2);
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.STATE_CHANGED,
        { oldState: GameState.AIMING, newState: GameState.PAUSED },
        stateManager
      );
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.STATE_CHANGED,
        { oldState: GameState.PAUSED, newState: GameState.AIMING },
        stateManager
      );
    });
  });

  describe('state integrity on repeated transitions', () => {
    test('setting same state twice does not corrupt state', () => {
      stateManager.setGameState(GameState.AIMING);
      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.getGameState()).toBe(GameState.AIMING);
    });

    test('setting an unrecognized string does set it (no guard)', () => {
      stateManager.setGameState('BOGUS_STATE');
      expect(stateManager.getGameState()).toBe('BOGUS_STATE');
    });
  });

  describe('getGameState', () => {
    test('returns INITIALIZING by default', () => {
      expect(stateManager.getGameState()).toBe(GameState.INITIALIZING);
    });

    test('reflects the most recent setGameState call', () => {
      stateManager.setGameState(GameState.PLAYING);
      expect(stateManager.getGameState()).toBe(GameState.PLAYING);
    });
  });

  describe('isInState', () => {
    test('returns true for matching state', () => {
      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.isInState(GameState.AIMING)).toBe(true);
    });

    test('returns false for non-matching state', () => {
      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.isInState(GameState.PLAYING)).toBe(false);
    });
  });

  describe('ball motion', () => {
    test('setBallInMotion updates and isBallInMotion reads', () => {
      expect(stateManager.isBallInMotion()).toBe(false);
      stateManager.setBallInMotion(true);
      expect(stateManager.isBallInMotion()).toBe(true);
      stateManager.setBallInMotion(false);
      expect(stateManager.isBallInMotion()).toBe(false);
    });

    test('setBallInMotion returns self', () => {
      expect(stateManager.setBallInMotion(true)).toBe(stateManager);
    });
  });

  describe('hole completion', () => {
    test('setHoleCompleted(true) sets flag, transitions to HOLE_COMPLETED, notifies callbacks', () => {
      const cb = jest.fn();
      stateManager.eventCallbacks.onHoleCompleted.push(cb);

      stateManager.setHoleCompleted(true);

      expect(stateManager.state.holeCompleted).toBe(true);
      expect(stateManager.getGameState()).toBe(GameState.HOLE_COMPLETED);
      expect(cb).toHaveBeenCalled();
    });

    test('setHoleCompleted(false) sets flag only, no state transition', () => {
      stateManager.setHoleCompleted(false);
      expect(stateManager.state.holeCompleted).toBe(false);
      expect(stateManager.getGameState()).toBe(GameState.INITIALIZING);
    });

    test('setHoleCompleted returns self', () => {
      expect(stateManager.setHoleCompleted(true)).toBe(stateManager);
    });

    test('callback error does not prevent other callbacks', () => {
      const cb1 = jest.fn();
      const errorCb = jest.fn(() => {
        throw new Error('fail');
      });
      const cb2 = jest.fn();
      stateManager.eventCallbacks.onHoleCompleted = [cb1, errorCb, cb2];

      stateManager.setHoleCompleted(true);

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        'Error in hole completed callback:',
        expect.any(Error)
      );
    });

    test('isHoleCompleted reflects current flag', () => {
      expect(stateManager.isHoleCompleted()).toBe(false);
      stateManager.setHoleCompleted(true);
      expect(stateManager.isHoleCompleted()).toBe(true);
    });
  });

  describe('getCurrentHoleNumber', () => {
    test('returns 1 initially', () => {
      expect(stateManager.getCurrentHoleNumber()).toBe(1);
    });

    test('returns updated value', () => {
      stateManager.state.currentHoleNumber = 7;
      expect(stateManager.getCurrentHoleNumber()).toBe(7);
    });
  });

  describe('game over', () => {
    test('setGameOver(true) sets flag and transitions to GAME_COMPLETED', () => {
      stateManager.setGameOver(true);
      expect(stateManager.state.gameOver).toBe(true);
      expect(stateManager.getGameState()).toBe(GameState.GAME_COMPLETED);
    });

    test('setGameOver(false) sets flag only', () => {
      stateManager.setGameOver(false);
      expect(stateManager.state.gameOver).toBe(false);
      expect(stateManager.getGameState()).toBe(GameState.INITIALIZING);
    });

    test('setGameOver returns self', () => {
      expect(stateManager.setGameOver(true)).toBe(stateManager);
    });

    test('isGameOver reflects current flag', () => {
      expect(stateManager.isGameOver()).toBe(false);
      stateManager.setGameOver(true);
      expect(stateManager.isGameOver()).toBe(true);
    });
  });

  describe('resetForNextHole', () => {
    test('increments hole number when not at last hole', () => {
      stateManager.state.currentHoleNumber = 3;
      stateManager.resetForNextHole();
      expect(stateManager.state.currentHoleNumber).toBe(4);
    });

    test('does not increment at last hole', () => {
      stateManager.state.currentHoleNumber = 9;
      stateManager.resetForNextHole();
      expect(stateManager.state.currentHoleNumber).toBe(9);
    });

    test('sets GAME_COMPLETED when past last hole', () => {
      stateManager.state.currentHoleNumber = 10;
      stateManager.resetForNextHole();

      expect(stateManager.getGameState()).toBe(GameState.GAME_COMPLETED);
      expect(console.warn).toHaveBeenCalledWith(
        '[StateManager] No more holes available - past last hole'
      );
    });

    test('resets holeCompleted and ballInMotion', () => {
      stateManager.state.holeCompleted = true;
      stateManager.state.ballInMotion = true;
      stateManager.state.currentHoleNumber = 1;

      stateManager.resetForNextHole();

      expect(stateManager.state.holeCompleted).toBe(false);
      expect(stateManager.state.ballInMotion).toBe(false);
    });

    test('calls scoringSystem.completeHole and resetCurrentStrokes', () => {
      stateManager.resetForNextHole();

      expect(mockGame.scoringSystem.completeHole).toHaveBeenCalled();
      expect(mockGame.scoringSystem.resetCurrentStrokes).toHaveBeenCalled();
    });

    test('calls scoringSystem.setMaxStrokes with config values', () => {
      stateManager.resetForNextHole();

      expect(mockGame.scoringSystem.setMaxStrokes).toHaveBeenCalledWith(3, 8);
    });

    test('handles missing scoringSystem gracefully', () => {
      mockGame.scoringSystem = null;

      expect(() => stateManager.resetForNextHole()).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        '[StateManager] ScoringSystem not found, cannot reset strokes.'
      );
    });

    test('transitions to AIMING state', () => {
      stateManager.resetForNextHole();
      expect(stateManager.getGameState()).toBe(GameState.AIMING);
    });

    test('publishes HOLE_STARTED event with updated hole number', () => {
      stateManager.state.currentHoleNumber = 2;
      stateManager.resetForNextHole();

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_STARTED,
        { holeNumber: 3 },
        stateManager
      );
    });

    test('handles missing eventManager', () => {
      mockGame.eventManager = null;
      stateManager = new StateManager(mockGame);

      expect(() => stateManager.resetForNextHole()).toThrow();
    });

    test('returns self for chaining', () => {
      expect(stateManager.resetForNextHole()).toBe(stateManager);
    });

    test('handles missing course config for setMaxStrokes', () => {
      mockGame.course.getCurrentHoleConfig.mockReturnValue(null);
      stateManager.resetForNextHole();

      expect(mockGame.scoringSystem.setMaxStrokes).not.toHaveBeenCalled();
    });
  });

  describe('skipToHole', () => {
    test('returns false for non-integer hole number', async () => {
      const result = await stateManager.skipToHole(1.5);
      expect(result).toBe(false);
    });

    test('returns false for hole number below 1', async () => {
      const result = await stateManager.skipToHole(0);
      expect(result).toBe(false);
    });

    test('returns false for hole number above total', async () => {
      const result = await stateManager.skipToHole(10);
      expect(result).toBe(false);
    });

    test('successfully skips to a valid hole', async () => {
      const result = await stateManager.skipToHole(5);

      expect(result).toBe(true);
      expect(stateManager.state.currentHoleNumber).toBe(5);
      expect(stateManager.state.holeCompleted).toBe(false);
      expect(stateManager.state.ballInMotion).toBe(false);
      expect(stateManager.getGameState()).toBe(GameState.AIMING);
    });

    test('unloads current hole and resets physics', async () => {
      await stateManager.skipToHole(3);

      expect(mockGame.holeTransitionManager.unloadCurrentHole).toHaveBeenCalled();
      expect(mockGame.physicsManager.resetWorld).toHaveBeenCalled();
    });

    test('creates course for target hole', async () => {
      await stateManager.skipToHole(4);
      expect(mockGame.course.createCourse).toHaveBeenCalledWith(4);
    });

    test('publishes HOLE_STARTED event on success', async () => {
      await stateManager.skipToHole(5);

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_STARTED,
        { holeNumber: 5 },
        stateManager
      );
    });

    test('updates UI after skip', async () => {
      await stateManager.skipToHole(5);

      expect(mockGame.uiManager.updateHoleInfo).toHaveBeenCalledWith(5);
      expect(mockGame.uiManager.showMessage).toHaveBeenCalledWith('Hole 5');
      expect(mockGame.uiManager.updateScore).toHaveBeenCalled();
      expect(mockGame.uiManager.updateStrokes).toHaveBeenCalled();
      expect(mockGame.uiManager.hideTransitionOverlay).toHaveBeenCalled();
    });

    test('returns false when createCourse fails', async () => {
      mockGame.course.createCourse.mockResolvedValue(false);
      const result = await stateManager.skipToHole(3);
      expect(result).toBe(false);
    });

    test('returns false and hides overlay on error', async () => {
      mockGame.holeTransitionManager.unloadCurrentHole.mockRejectedValue(new Error('fail'));
      const result = await stateManager.skipToHole(3);

      expect(result).toBe(false);
      expect(mockGame.uiManager.hideTransitionOverlay).toHaveBeenCalled();
    });

    test('handles missing physicsManager.resetWorld', async () => {
      mockGame.physicsManager = {};
      const result = await stateManager.skipToHole(3);
      expect(result).toBe(true);
    });

    test('sets up managers after skip', async () => {
      await stateManager.skipToHole(3);

      expect(mockGame.holeCompletionManager.resetGracePeriod).toHaveBeenCalled();
      expect(mockGame.ballManager.createBall).toHaveBeenCalled();
      expect(mockGame.inputController.enableInput).toHaveBeenCalled();
      expect(mockGame.cameraController.positionCameraForHole).toHaveBeenCalled();
    });

    test('resets scoring for new hole', async () => {
      await stateManager.skipToHole(5);

      expect(mockGame.scoringSystem.resetCurrentStrokes).toHaveBeenCalled();
      expect(mockGame.scoringSystem.setMaxStrokes).toHaveBeenCalledWith(3, 8);
    });
  });

  describe('resetState', () => {
    test('resets all state to initial values', () => {
      stateManager.state.ballInMotion = true;
      stateManager.state.holeCompleted = true;
      stateManager.state.currentHoleNumber = 5;
      stateManager.state.resetBall = true;
      stateManager.state.gameOver = true;
      stateManager.state.gameStarted = true;
      stateManager.state.showingMessage = true;
      stateManager.state.currentGameState = GameState.PLAYING;

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

    test('publishes STATE_CHANGED to INITIALIZING', () => {
      stateManager.setGameState(GameState.PLAYING);
      mockGame.eventManager.publish.mockClear();

      stateManager.resetState();

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.STATE_CHANGED,
        { oldState: GameState.PLAYING, newState: GameState.INITIALIZING },
        stateManager
      );
    });

    test('returns self for chaining', () => {
      expect(stateManager.resetState()).toBe(stateManager);
    });
  });

  describe('reset ball methods', () => {
    test('setResetBall sets the flag', () => {
      stateManager.setResetBall(true);
      expect(stateManager.state.resetBall).toBe(true);
      stateManager.setResetBall(false);
      expect(stateManager.state.resetBall).toBe(false);
    });

    test('shouldResetBall returns the flag', () => {
      expect(stateManager.shouldResetBall()).toBe(false);
      stateManager.setResetBall(true);
      expect(stateManager.shouldResetBall()).toBe(true);
    });

    test('clearResetBall sets flag to false', () => {
      stateManager.setResetBall(true);
      stateManager.clearResetBall();
      expect(stateManager.shouldResetBall()).toBe(false);
    });
  });

  describe('debug mode', () => {
    test('isDebugMode returns false by default', () => {
      expect(stateManager.isDebugMode()).toBe(false);
    });

    test('toggleDebugMode flips the flag', () => {
      stateManager.toggleDebugMode();
      expect(stateManager.isDebugMode()).toBe(true);
      stateManager.toggleDebugMode();
      expect(stateManager.isDebugMode()).toBe(false);
    });
  });

  describe('_notifyHoleCompleted', () => {
    test('calls all registered callbacks', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      stateManager.eventCallbacks.onHoleCompleted = [cb1, cb2];

      stateManager._notifyHoleCompleted();

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    test('continues after callback error', () => {
      const cb1 = jest.fn(() => {
        throw new Error('boom');
      });
      const cb2 = jest.fn();
      stateManager.eventCallbacks.onHoleCompleted = [cb1, cb2];

      stateManager._notifyHoleCompleted();

      expect(cb2).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test('does nothing with empty callback array', () => {
      expect(() => stateManager._notifyHoleCompleted()).not.toThrow();
    });
  });

  describe('integration: full gameplay flow', () => {
    test('complete hole progression from start to finish', () => {
      expect(stateManager.getGameState()).toBe(GameState.INITIALIZING);

      stateManager.setGameState(GameState.AIMING);
      expect(stateManager.isInState(GameState.AIMING)).toBe(true);

      stateManager.setBallInMotion(true);
      stateManager.setGameState(GameState.PLAYING);
      expect(stateManager.isBallInMotion()).toBe(true);
      expect(stateManager.getGameState()).toBe(GameState.PLAYING);

      stateManager.setBallInMotion(false);
      stateManager.setHoleCompleted(true);
      expect(stateManager.getGameState()).toBe(GameState.HOLE_COMPLETED);

      stateManager.resetForNextHole();
      expect(stateManager.getCurrentHoleNumber()).toBe(2);
      expect(stateManager.getGameState()).toBe(GameState.AIMING);
      expect(stateManager.isHoleCompleted()).toBe(false);
    });

    test('game completion at last hole', () => {
      stateManager.state.currentHoleNumber = 9;

      stateManager.setHoleCompleted(true);
      stateManager.resetForNextHole();
      expect(stateManager.getCurrentHoleNumber()).toBe(9);

      stateManager.setGameOver(true);
      expect(stateManager.isGameOver()).toBe(true);
      expect(stateManager.getGameState()).toBe(GameState.GAME_COMPLETED);
    });

    test('pause and resume mid-play', () => {
      stateManager.setGameState(GameState.AIMING);
      stateManager.setBallInMotion(true);
      stateManager.setGameState(GameState.PLAYING);

      const priorState = stateManager.getGameState();
      stateManager.setGameState(GameState.PAUSED);
      expect(stateManager.getGameState()).toBe(GameState.PAUSED);
      expect(stateManager.isBallInMotion()).toBe(true);

      stateManager.setGameState(priorState);
      expect(stateManager.getGameState()).toBe(GameState.PLAYING);
    });

    test('resetState then start new game', () => {
      stateManager.setGameState(GameState.AIMING);
      stateManager.state.currentHoleNumber = 5;
      stateManager.setBallInMotion(true);

      stateManager.resetState();

      expect(stateManager.getGameState()).toBe(GameState.INITIALIZING);
      expect(stateManager.getCurrentHoleNumber()).toBe(1);
      expect(stateManager.isBallInMotion()).toBe(false);
    });
  });
});
