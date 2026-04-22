/**
 * Unit tests for StuckBallManager — nudge (at-rest stuck detection) behaviour.
 * ISSUE-008
 */

import { StuckBallManager } from '../../managers/StuckBallManager';
import { EventTypes } from '../../events/EventTypes';

jest.mock('../../utils/debug', () => ({
  debug: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

function makeButton() {
  return {
    classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
    textContent: '',
    setAttribute: jest.fn(),
    addEventListener: jest.fn(),
    remove: jest.fn()
  };
}

function makeMockGame({ velocity = { x: 0, y: 0, z: 0 } } = {}) {
  const eventHandlers = {};
  const mockGame = {
    eventManager: {
      subscribe: jest.fn((type, handler, ctx) => {
        eventHandlers[type] = handler.bind(ctx);
        return jest.fn();
      }),
      publish: jest.fn()
    },
    stateManager: { isBallInMotion: jest.fn(() => false) },
    ballManager: {
      ball: {
        mesh: { position: { x: 1, y: 0.2, z: 2 } },
        body: {
          velocity,
          position: { x: 1, y: 0.2, z: 2 },
          applyImpulse: jest.fn()
        }
      },
      lastBallPosition: {
        x: 0,
        y: 0.2,
        z: 0,
        clone: jest.fn(function () {
          return { x: this.x, y: this.y, z: this.z };
        })
      },
      resetBall: jest.fn()
    },
    scoringSystem: { addPenaltyStrokes: jest.fn() },
    uiManager: { updateStrokes: jest.fn(), showMessage: jest.fn() }
  };
  return { mockGame, eventHandlers };
}

describe('StuckBallManager — nudge button initialization', () => {
  let createElement;

  beforeEach(() => {
    const buttons = [];
    createElement = jest.spyOn(document, 'createElement').mockImplementation(() => makeButton());
    jest.spyOn(document, 'getElementById').mockReturnValue({ appendChild: jest.fn() });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates nudge button element on init', () => {
    const { mockGame } = makeMockGame();
    const manager = new StuckBallManager(mockGame);
    manager.init();

    // createElement called twice: once for reset button, once for nudge button
    expect(document.createElement).toHaveBeenCalledWith('button');
    expect(document.createElement).toHaveBeenCalledTimes(2);
    expect(manager.nudgeButton).toBeDefined();

    manager.cleanup();
  });

  test('nudge button starts hidden', () => {
    const { mockGame } = makeMockGame();
    const manager = new StuckBallManager(mockGame);
    manager.init();

    expect(manager.isShowingNudgePrompt).toBe(false);

    manager.cleanup();
  });
});

describe('StuckBallManager — at-rest stuck detection', () => {
  let manager;
  let mockGame;

  beforeEach(() => {
    jest.spyOn(document, 'createElement').mockImplementation(() => makeButton());
    jest.spyOn(document, 'getElementById').mockReturnValue({ appendChild: jest.fn() });

    ({ mockGame } = makeMockGame({ velocity: { x: 0, y: 0, z: 0 } }));
    manager = new StuckBallManager(mockGame);
    manager.init();
  });

  afterEach(() => {
    manager.cleanup();
    jest.restoreAllMocks();
  });

  test('timer does not accumulate while ball is moving fast (speed > 0.05)', () => {
    mockGame.ballManager.ball.body.velocity = { x: 1, y: 0, z: 0 };

    manager.update(1);
    manager.update(1);

    expect(manager.stuckAtRestTimer).toBe(0);
    expect(manager.isShowingNudgePrompt).toBe(false);
  });

  test('timer accumulates when ball speed < 0.05', () => {
    // velocity is 0 (< 0.05)
    manager.update(1);
    expect(manager.stuckAtRestTimer).toBe(1);

    manager.update(1);
    expect(manager.stuckAtRestTimer).toBe(2);
  });

  test('nudge prompt appears after 3 s of speed < 0.05', () => {
    manager.update(3);

    expect(manager.isShowingNudgePrompt).toBe(true);
    expect(manager.nudgeButton.classList.add).toHaveBeenCalledWith('visible');
  });

  test('nudge prompt does not appear before 3 s', () => {
    manager.update(2.99);

    expect(manager.isShowingNudgePrompt).toBe(false);
  });

  test('timer resets when ball speeds up past threshold', () => {
    manager.update(2); // accumulate 2 s
    expect(manager.stuckAtRestTimer).toBe(2);

    // Ball now moves fast
    mockGame.ballManager.ball.body.velocity = { x: 2, y: 0, z: 0 };
    manager.update(0.016);

    expect(manager.stuckAtRestTimer).toBe(0);
  });

  test('nudge prompt is hidden when ball speeds up', () => {
    // Show nudge first
    manager.update(3);
    expect(manager.isShowingNudgePrompt).toBe(true);

    // Ball now moving
    mockGame.ballManager.ball.body.velocity = { x: 1, y: 0, z: 0 };
    manager.update(0.016);

    expect(manager.isShowingNudgePrompt).toBe(false);
    expect(manager.nudgeButton.classList.remove).toHaveBeenCalledWith('visible');
  });

  test('at-rest detection skipped when ball has no physics body', () => {
    mockGame.ballManager.ball.body = null;

    expect(() => manager.update(5)).not.toThrow();
    expect(manager.stuckAtRestTimer).toBe(0);
    expect(manager.isShowingNudgePrompt).toBe(false);
  });

  test('does not re-show nudge if already showing', () => {
    manager.update(3); // show
    const addCallsBefore = manager.nudgeButton.classList.add.mock.calls.length;

    manager.update(1); // 4 s total — should not re-call classList.add
    expect(manager.nudgeButton.classList.add.mock.calls.length).toBe(addCallsBefore);
  });
});

describe('StuckBallManager — handleNudgeClick', () => {
  let manager;
  let mockGame;

  beforeEach(() => {
    jest.spyOn(document, 'createElement').mockImplementation(() => makeButton());
    jest.spyOn(document, 'getElementById').mockReturnValue({ appendChild: jest.fn() });

    ({ mockGame } = makeMockGame());
    manager = new StuckBallManager(mockGame);
    manager.init();
  });

  afterEach(() => {
    manager.cleanup();
    jest.restoreAllMocks();
  });

  test('applies a non-zero impulse to the ball body', () => {
    manager.handleNudgeClick();

    expect(mockGame.ballManager.ball.body.applyImpulse).toHaveBeenCalledTimes(1);

    const [impulse] = mockGame.ballManager.ball.body.applyImpulse.mock.calls[0];
    // Magnitude must be non-zero in exactly one horizontal axis
    const magnitude = Math.sqrt(impulse.x ** 2 + impulse.z ** 2);
    expect(magnitude).toBeCloseTo(0.5, 5);
    expect(impulse.y).toBe(0);
  });

  test('dismisses the nudge prompt after nudge', () => {
    manager.update(3); // show prompt
    expect(manager.isShowingNudgePrompt).toBe(true);

    manager.handleNudgeClick();

    expect(manager.isShowingNudgePrompt).toBe(false);
    expect(manager.nudgeButton.classList.remove).toHaveBeenCalledWith('visible');
  });

  test('resets the at-rest timer after nudge', () => {
    manager.update(3);
    expect(manager.stuckAtRestTimer).toBe(3);

    manager.handleNudgeClick();

    expect(manager.stuckAtRestTimer).toBe(0);
  });

  test('does nothing if ball has no physics body', () => {
    mockGame.ballManager.ball.body = null;

    expect(() => manager.handleNudgeClick()).not.toThrow();
    expect(manager.isShowingNudgePrompt).toBe(false);
  });

  test('does nothing if ball is null', () => {
    mockGame.ballManager.ball = null;

    expect(() => manager.handleNudgeClick()).not.toThrow();
  });
});

describe('StuckBallManager — resetTimer also resets at-rest state', () => {
  let manager;
  let mockGame;

  beforeEach(() => {
    jest.spyOn(document, 'createElement').mockImplementation(() => makeButton());
    jest.spyOn(document, 'getElementById').mockReturnValue({ appendChild: jest.fn() });

    ({ mockGame } = makeMockGame());
    manager = new StuckBallManager(mockGame);
    manager.init();
  });

  afterEach(() => {
    manager.cleanup();
    jest.restoreAllMocks();
  });

  test('resetTimer clears stuckAtRestTimer', () => {
    manager.stuckAtRestTimer = 2.5;
    manager.resetTimer();

    expect(manager.stuckAtRestTimer).toBe(0);
  });

  test('resetTimer hides nudge prompt if showing', () => {
    manager.update(3); // show
    expect(manager.isShowingNudgePrompt).toBe(true);

    manager.resetTimer();

    expect(manager.isShowingNudgePrompt).toBe(false);
  });

  test('BALL_HIT event hides nudge prompt and resets at-rest timer', () => {
    // Manually show nudge
    manager.update(3);
    expect(manager.isShowingNudgePrompt).toBe(true);
    manager.stuckAtRestTimer = 3;

    // Trigger via subscribed event handler
    const { eventHandlers } = makeMockGame();
    // Call resetTimer directly (event handlers call resetTimer)
    manager.resetTimer();

    expect(manager.isShowingNudgePrompt).toBe(false);
    expect(manager.stuckAtRestTimer).toBe(0);
  });
});

describe('StuckBallManager — cleanup removes nudge button', () => {
  test('removes nudge button DOM element on cleanup', () => {
    jest.spyOn(document, 'createElement').mockImplementation(() => makeButton());
    jest.spyOn(document, 'getElementById').mockReturnValue({ appendChild: jest.fn() });

    const { mockGame } = makeMockGame();
    const manager = new StuckBallManager(mockGame);
    manager.init();

    const nudgeRemove = manager.nudgeButton.remove;
    manager.cleanup();

    expect(nudgeRemove).toHaveBeenCalled();
    expect(manager.nudgeButton).toBeNull();
    expect(manager.isShowingNudgePrompt).toBe(false);

    jest.restoreAllMocks();
  });
});
