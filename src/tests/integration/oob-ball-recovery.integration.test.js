/**
 * Integration tests for OOB detection and ball recovery using lastValidPosition.
 * ISSUE-008
 *
 * Verifies:
 *   - lastValidPosition is updated when ball speed > 0.2, throttled to 1/sec
 *   - lastValidPosition is NOT updated when speed <= 0.2
 *   - On HAZARD_DETECTED, ball resets to lastValidPosition (not OOB position)
 *   - A 1-stroke penalty is applied on OOB
 */

import { BallManager } from '../../managers/BallManager';
import { EventTypes } from '../../events/EventTypes';

// Three.js mock (already set up in jest.setup.js / setup.js)
jest.mock('../../objects/Ball', () => {
  const MockBall = jest.fn(() => ({
    mesh: {
      position: {
        x: 0,
        y: 0.2,
        z: 0,
        copy: jest.fn(),
        clone: jest.fn(() => ({ x: 0, y: 0.2, z: 0 }))
      },
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    },
    body: {
      position: { x: 0, y: 0.2, z: 0 },
      velocity: { x: 0, y: 0, z: 0, set: jest.fn(), clone: jest.fn(() => ({ x: 0, y: 0, z: 0 })) },
      angularVelocity: { x: 0, y: 0, z: 0, set: jest.fn() },
      wakeUp: jest.fn(),
      applyImpulse: jest.fn()
    },
    setPosition: jest.fn(),
    applyImpulse: jest.fn(),
    isMoving: false,
    resetVelocity: jest.fn(),
    cleanup: jest.fn(),
    update: jest.fn(),
    handleHoleSuccess: jest.fn()
  }));
  MockBall.START_HEIGHT = 0.2;
  return { Ball: MockBall };
});

function makeMockGame() {
  const eventSubscribers = {};

  const eventManager = {
    subscribe: jest.fn((type, handler, ctx) => {
      if (!eventSubscribers[type]) {
        eventSubscribers[type] = [];
      }
      eventSubscribers[type].push(handler.bind(ctx));
      return jest.fn();
    }),
    publish: jest.fn((type, data, source) => {
      // Simulate event delivery so subscribers are called
      const handlers = eventSubscribers[type] || [];
      // Wrap data in a GameEvent-like object with .get()
      const event = {
        get: (key, defaultVal) => (data && key in data ? data[key] : defaultVal)
      };
      handlers.forEach(h => h(event));
    })
  };

  const mockGame = {
    scene: { add: jest.fn(), remove: jest.fn() },
    course: {
      getHoleStartPosition: jest.fn(() => ({
        x: 0,
        y: 0,
        z: 5,
        clone: jest.fn(() => ({ x: 0, y: 0, z: 5 }))
      })),
      getHolePosition: jest.fn(() => ({
        x: 0,
        y: 0,
        z: -5,
        clone: jest.fn(() => ({ x: 0, y: 0, z: -5 }))
      })),
      currentHole: { id: 1 }
    },
    physicsManager: {
      getWorld: jest.fn(() => ({ addBody: jest.fn(), removeBody: jest.fn() })),
      removeBody: jest.fn()
    },
    eventManager,
    stateManager: {
      isBallInMotion: jest.fn(() => false),
      setBallInMotion: jest.fn()
    },
    debugManager: { enabled: false, log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    scoringSystem: {
      addStroke: jest.fn(),
      addPenaltyStrokes: jest.fn(),
      getTotalStrokes: jest.fn(() => 0),
      isAtLimit: jest.fn(() => false)
    },
    uiManager: { updateStrokes: jest.fn(), showMessage: jest.fn() },
    cameraController: { setBall: jest.fn() },
    audioManager: { playSound: jest.fn() },
    hazardManager: { setLastSafePosition: jest.fn() },
    deltaTime: 0.016
  };

  return { mockGame, eventManager, eventSubscribers };
}

describe('BallManager — lastValidPosition tracking', () => {
  let ballManager;
  let mockGame;

  beforeEach(() => {
    ({ mockGame } = makeMockGame());
    ballManager = new BallManager(mockGame);
    ballManager.init();
    ballManager.createBall({ x: 0, y: 0, z: 5 });
  });

  test('lastValidPosition initializes to ball start position', () => {
    expect(ballManager.lastValidPosition).toBeDefined();
    // copy() was called with the mesh position at creation
    // (Three.js mock: copy is jest.fn, so we just check it was invoked)
    expect(ballManager.ball.mesh.position.copy).not.toBeUndefined();
  });

  test('lastValidPosition is NOT updated when speed is 0 (< 0.2)', () => {
    // Set up a known lastValidPosition
    ballManager.lastValidPosition = {
      x: 3,
      y: 0.2,
      z: -1,
      copy: jest.fn(),
      clone: jest.fn(() => ({ x: 3, y: 0.2, z: -1 }))
    };

    ballManager.ball.body.velocity = { x: 0, y: 0, z: 0 };
    ballManager.ball.mesh.position.y = 0.3;
    mockGame.deltaTime = 2; // 2 seconds — enough to exceed the 1s throttle if speed > 0.2

    ballManager.update();

    // copy() should not have been called on lastValidPosition
    expect(ballManager.lastValidPosition.copy).not.toHaveBeenCalled();
  });

  test('lastValidPosition is NOT updated immediately when speed > 0.2 (throttled to 1/sec)', () => {
    ballManager.lastValidPosition = {
      x: 3,
      y: 0.2,
      z: -1,
      copy: jest.fn(),
      clone: jest.fn(() => ({ x: 3, y: 0.2, z: -1 }))
    };

    ballManager.ball.body.velocity = { x: 1, y: 0, z: 0 }; // speed = 1 > 0.2
    ballManager.ball.mesh.position.y = 0.3;
    mockGame.deltaTime = 0.5; // only 0.5 s — under the 1s throttle

    ballManager.update();

    expect(ballManager._lastValidPositionTimer).toBeCloseTo(0.5);
    expect(ballManager.lastValidPosition.copy).not.toHaveBeenCalled();
  });

  test('lastValidPosition updates after 1 second of speed > 0.2', () => {
    ballManager.lastValidPosition = {
      x: 3,
      y: 0.2,
      z: -1,
      copy: jest.fn(),
      clone: jest.fn(() => ({ x: 3, y: 0.2, z: -1 }))
    };

    ballManager.ball.body.velocity = { x: 1, y: 0, z: 0 }; // speed = 1 > 0.2
    ballManager.ball.mesh.position.y = 0.3;

    // Accumulate past the 1s threshold in two steps
    mockGame.deltaTime = 0.6;
    ballManager.update();
    expect(ballManager.lastValidPosition.copy).not.toHaveBeenCalled(); // still < 1s

    mockGame.deltaTime = 0.5;
    ballManager.update();

    expect(ballManager.lastValidPosition.copy).toHaveBeenCalledWith(ballManager.ball.mesh.position);
    expect(ballManager._lastValidPositionTimer).toBe(0); // timer reset after update
  });

  test('_lastValidPositionTimer resets to 0 when speed drops below 0.2', () => {
    ballManager.ball.body.velocity = { x: 0.5, y: 0, z: 0 };
    mockGame.deltaTime = 0.4;
    ballManager.update();
    expect(ballManager._lastValidPositionTimer).toBeCloseTo(0.4);

    // Speed drops
    ballManager.ball.body.velocity = { x: 0, y: 0, z: 0 };
    ballManager.update();
    expect(ballManager._lastValidPositionTimer).toBe(0);
  });
});

describe('BallManager — OOB respawn uses lastValidPosition', () => {
  let ballManager;
  let mockGame;

  beforeEach(() => {
    ({ mockGame } = makeMockGame());
    ballManager = new BallManager(mockGame);
    ballManager.init();
    ballManager.createBall({ x: 0, y: 0, z: 5 });
  });

  test('handleHazardDetected resets ball to lastValidPosition and adds penalty', () => {
    // Set a known lastValidPosition (safe position the ball was at)
    const cloned = { x: 1, y: 0.2, z: 3, clone: jest.fn(() => ({ x: 1, y: 0.2, z: 3 })) };
    const safePos = { x: 1, y: 0.2, z: 3, clone: jest.fn(() => cloned) };
    ballManager.lastValidPosition = safePos;

    const resetSpy = jest.spyOn(ballManager, 'resetBall');

    // Simulate HAZARD_DETECTED (as published by HazardManager)
    mockGame.eventManager.publish(
      EventTypes.HAZARD_DETECTED,
      { hazardType: 'outOfBounds', penalty: 1 },
      {}
    );

    // Penalty added
    expect(mockGame.scoringSystem.addPenaltyStrokes).toHaveBeenCalledWith(1);

    // Ball resets to lastValidPosition, not (0,0,0) or the OOB position
    expect(resetSpy).toHaveBeenCalledWith(expect.objectContaining({ x: 1, y: 0.2, z: 3 }));
  });

  test('OOB respawn does NOT use the OOB position itself', () => {
    // Give ball an OOB position
    ballManager.ball.mesh.position.x = 100;
    ballManager.ball.mesh.position.z = 100;

    // lastValidPosition was at (2, 0.2, -1) — a safe spot
    const cloned2 = { x: 2, y: 0.2, z: -1, clone: jest.fn(() => ({ x: 2, y: 0.2, z: -1 })) };
    const safePos = { x: 2, y: 0.2, z: -1, clone: jest.fn(() => cloned2) };
    ballManager.lastValidPosition = safePos;

    const resetSpy = jest.spyOn(ballManager, 'resetBall');

    mockGame.eventManager.publish(
      EventTypes.HAZARD_DETECTED,
      { hazardType: 'outOfBounds', penalty: 1 },
      {}
    );

    // Must reset to safePos, not the OOB position (100, _, 100)
    const [resetArg] = resetSpy.mock.calls[0];
    expect(resetArg.x).not.toBe(100);
    expect(resetArg.z).not.toBe(100);
    expect(resetArg.x).toBe(2);
    expect(resetArg.z).toBe(-1);
  });

  test('handles missing lastValidPosition.clone gracefully', () => {
    // lastValidPosition without clone (edge case)
    ballManager.lastValidPosition = { x: 0, y: 0, z: 0 };

    const resetSpy = jest.spyOn(ballManager, 'resetBall');

    expect(() =>
      mockGame.eventManager.publish(
        EventTypes.HAZARD_DETECTED,
        { hazardType: 'outOfBounds', penalty: 1 },
        {}
      )
    ).not.toThrow();

    expect(resetSpy).toHaveBeenCalledWith(null);
  });
});
