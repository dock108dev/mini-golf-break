/**
 * Unit tests for StuckBallManager
 */

import { StuckBallManager } from '../../managers/StuckBallManager';
import { EventTypes } from '../../events/EventTypes';

jest.mock('../../utils/debug', () => ({
  debug: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('StuckBallManager', () => {
  let mockGame;
  let manager;
  let eventHandlers;

  beforeEach(() => {
    document.createElement = jest.fn(() => ({
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn()
      },
      textContent: '',
      setAttribute: jest.fn(),
      addEventListener: jest.fn(),
      remove: jest.fn()
    }));
    document.getElementById = jest.fn(() => ({
      appendChild: jest.fn()
    }));

    eventHandlers = {};

    mockGame = {
      eventManager: {
        subscribe: jest.fn((type, handler, context) => {
          eventHandlers[type] = handler.bind(context);
          return jest.fn(); // unsubscribe function
        }),
        publish: jest.fn()
      },
      stateManager: {
        isBallInMotion: jest.fn(() => false)
      },
      ballManager: {
        ball: { mesh: { position: { x: 1, y: 0.2, z: 2 } } },
        lastBallPosition: {
          x: 0, y: 0.2, z: 0,
          clone: jest.fn(function () {
            return { x: this.x, y: this.y, z: this.z };
          })
        },
        resetBall: jest.fn()
      },
      scoringSystem: {
        addPenaltyStrokes: jest.fn()
      },
      uiManager: {
        updateStrokes: jest.fn(),
        showMessage: jest.fn()
      }
    };

    manager = new StuckBallManager(mockGame);
    manager.init();
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('initialization', () => {
    test('creates a reset button element', () => {
      expect(document.createElement).toHaveBeenCalledWith('button');
      expect(manager.resetButton).toBeDefined();
    });

    test('subscribes to timer-resetting events', () => {
      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_STOPPED, expect.any(Function), manager
      );
      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_IN_HOLE, expect.any(Function), manager
      );
      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_RESET, expect.any(Function), manager
      );
      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.HOLE_STARTED, expect.any(Function), manager
      );
      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_HIT, expect.any(Function), manager
      );
    });

    test('starts with timer at zero and button hidden', () => {
      expect(manager.motionTimer).toBe(0);
      expect(manager.isShowingResetButton).toBe(false);
    });
  });

  describe('update — timer accumulation', () => {
    test('does not accumulate time when ball is not moving', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(false);
      manager.update(1);
      expect(manager.motionTimer).toBe(0);
    });

    test('accumulates time when ball is moving', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(5);
      expect(manager.motionTimer).toBe(5);
      manager.update(3);
      expect(manager.motionTimer).toBe(8);
    });

    test('does nothing when ballManager has no ball', () => {
      mockGame.ballManager.ball = null;
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(20);
      expect(manager.motionTimer).toBe(0);
    });
  });

  describe('stuck detection — shows button after 15 seconds', () => {
    test('shows reset button after 15 seconds of motion', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);

      // Simulate frames totalling 15 seconds
      for (let i = 0; i < 15; i++) {
        manager.update(1);
      }

      expect(manager.isShowingResetButton).toBe(true);
      expect(manager.resetButton.classList.add).toHaveBeenCalledWith('visible');
    });

    test('publishes BALL_STUCK event when threshold reached', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(15);

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.BALL_STUCK,
        expect.objectContaining({ motionTime: 15 }),
        manager
      );
    });

    test('does not show button before 15 seconds', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(14.9);

      expect(manager.isShowingResetButton).toBe(false);
    });

    test('does not re-show button if already showing', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(15);
      const addCallCount = manager.resetButton.classList.add.mock.calls.length;

      manager.update(1); // 16 seconds total
      // classList.add should not have been called again
      expect(manager.resetButton.classList.add.mock.calls.length).toBe(addCallCount);
    });
  });

  describe('timer reset — events hide button and reset timer', () => {
    beforeEach(() => {
      // Get the ball stuck first
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(16);
      expect(manager.isShowingResetButton).toBe(true);
    });

    test('BALL_STOPPED resets timer and hides button', () => {
      eventHandlers[EventTypes.BALL_STOPPED]();
      expect(manager.motionTimer).toBe(0);
      expect(manager.isShowingResetButton).toBe(false);
      expect(manager.resetButton.classList.remove).toHaveBeenCalledWith('visible');
    });

    test('BALL_IN_HOLE resets timer and hides button', () => {
      eventHandlers[EventTypes.BALL_IN_HOLE]();
      expect(manager.motionTimer).toBe(0);
      expect(manager.isShowingResetButton).toBe(false);
    });

    test('BALL_RESET resets timer and hides button', () => {
      eventHandlers[EventTypes.BALL_RESET]();
      expect(manager.motionTimer).toBe(0);
      expect(manager.isShowingResetButton).toBe(false);
    });

    test('HOLE_STARTED resets timer and hides button', () => {
      eventHandlers[EventTypes.HOLE_STARTED]();
      expect(manager.motionTimer).toBe(0);
      expect(manager.isShowingResetButton).toBe(false);
    });

    test('BALL_HIT resets timer and hides button', () => {
      eventHandlers[EventTypes.BALL_HIT]();
      expect(manager.motionTimer).toBe(0);
      expect(manager.isShowingResetButton).toBe(false);
    });

    test('ball stopping via update also resets timer', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(false);
      manager.update(0.016);
      expect(manager.motionTimer).toBe(0);
      expect(manager.isShowingResetButton).toBe(false);
    });
  });

  describe('handleResetClick — resets ball with penalty', () => {
    test('adds 1 stroke penalty', () => {
      manager.handleResetClick();
      expect(mockGame.scoringSystem.addPenaltyStrokes).toHaveBeenCalledWith(1);
    });

    test('resets ball to last hit position', () => {
      mockGame.ballManager.lastBallPosition.x = 5;
      mockGame.ballManager.lastBallPosition.y = 0.2;
      mockGame.ballManager.lastBallPosition.z = -3;

      manager.handleResetClick();

      expect(mockGame.ballManager.resetBall).toHaveBeenCalledWith(
        expect.objectContaining({ x: 5, y: 0.2, z: -3 })
      );
    });

    test('updates UI with penalty message', () => {
      manager.handleResetClick();
      expect(mockGame.uiManager.showMessage).toHaveBeenCalledWith(
        'Ball reset! +1 stroke penalty.',
        2000
      );
      expect(mockGame.uiManager.updateStrokes).toHaveBeenCalled();
    });

    test('resets timer and hides button after click', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(16);
      expect(manager.isShowingResetButton).toBe(true);

      manager.handleResetClick();
      expect(manager.motionTimer).toBe(0);
      expect(manager.isShowingResetButton).toBe(false);
    });

    test('does nothing if no ball exists', () => {
      mockGame.ballManager.ball = null;
      manager.handleResetClick();
      expect(mockGame.scoringSystem.addPenaltyStrokes).not.toHaveBeenCalled();
      expect(mockGame.ballManager.resetBall).not.toHaveBeenCalled();
    });
  });

  describe('does not false-trigger', () => {
    test('normal long putt under 15 seconds does not trigger', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(14);
      expect(manager.isShowingResetButton).toBe(false);

      // Ball stops
      mockGame.stateManager.isBallInMotion.mockReturnValue(false);
      manager.update(0.016);
      expect(manager.motionTimer).toBe(0);
    });

    test('timer resets between shots', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(10);

      // Ball stops
      eventHandlers[EventTypes.BALL_STOPPED]();
      expect(manager.motionTimer).toBe(0);

      // New shot — timer starts fresh
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(10);
      expect(manager.motionTimer).toBe(10);
      expect(manager.isShowingResetButton).toBe(false); // still under 15s
    });

    test('portal teleport does not false-trigger the timer — timer continues without reset or spike', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(10);
      expect(manager.motionTimer).toBe(10);

      // Portal teleports ball — no BALL_STOPPED/BALL_RESET events fired,
      // ball remains in motion at a new position
      manager.update(1);
      expect(manager.motionTimer).toBe(11);

      // Timer did not spike or reset — it just kept counting normally
      expect(manager.isShowingResetButton).toBe(false); // still under 15s
    });
  });

  describe('AIMING state — timer does not run', () => {
    test('timer does not accumulate during AIMING state (ball not in motion)', () => {
      // During AIMING, isBallInMotion returns false
      mockGame.stateManager.isBallInMotion.mockReturnValue(false);
      manager.update(5);
      manager.update(5);
      manager.update(5);

      expect(manager.motionTimer).toBe(0);
      expect(manager.isShowingResetButton).toBe(false);
    });

    test('timer starts only after ball enters motion from AIMING', () => {
      // AIMING phase — no accumulation
      mockGame.stateManager.isBallInMotion.mockReturnValue(false);
      manager.update(10);
      expect(manager.motionTimer).toBe(0);

      // Ball hit — enters motion
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(5);
      expect(manager.motionTimer).toBe(5);
    });
  });

  describe('pause behavior', () => {
    test('timer does not advance when update is not called (game paused)', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(10);
      expect(manager.motionTimer).toBe(10);

      // Simulate pause — update() is not called during pause
      // After resume, dt should be clamped by GameLoopManager
      manager.update(0.033); // one frame after resume
      expect(manager.motionTimer).toBeCloseTo(10.033);
      expect(manager.isShowingResetButton).toBe(false);
    });
  });

  describe('cleanup', () => {
    test('removes button and unsubscribes events', () => {
      const removeFn = manager.resetButton.remove;
      manager.cleanup();
      expect(removeFn).toHaveBeenCalled();
      expect(manager.resetButton).toBeNull();
      expect(manager.eventSubscriptions).toHaveLength(0);
    });

    test('resets timer on cleanup', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      manager.update(16);
      manager.cleanup();
      expect(manager.motionTimer).toBe(0);
      expect(manager.isShowingResetButton).toBe(false);
    });
  });
});
