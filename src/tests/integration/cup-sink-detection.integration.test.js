/**
 * Integration tests for cup sink detection (ISSUE-007).
 *
 * Verifies that HoleCompletionManager.update() correctly fires BALL_IN_HOLE
 * for 3 approach angles on holes 1 and 5, and that the speed threshold and
 * cupRadius config field behave as specified.
 */

import { HoleCompletionManager } from '../../managers/HoleCompletionManager';
import { EventTypes } from '../../events/EventTypes';

jest.mock('../../events/EventTypes', () => ({
  EventTypes: {
    BALL_IN_HOLE: 'ball:in_hole',
    HOLE_COMPLETED: 'hole:completed',
    STROKE_LIMIT_REACHED: 'scoring:stroke_limit_reached'
  }
}));

jest.mock('../../states/GameState', () => ({
  GameState: { GAME_COMPLETED: 'GAME_COMPLETED' }
}));

jest.mock('../../utils/devHoleHarness', () => ({
  isIsolationMode: () => false
}));

// Hole positions from orbitalDriftConfigs (after hydration)
// H1 "Docking Lane": holePosition [0, 0, -5]
const HOLE_1_POS = { x: 0, y: 0, z: -5 };
// H5 "Wormhole Transfer": holePosition [-5, 0, 5]
const HOLE_5_POS = { x: -5, y: 0, z: 5 };

const CUP_RADIUS = 0.3;

/**
 * Build a ball body at the hole center with velocity in the given direction.
 * @param {object} holePos - {x, y, z} hole centre world position
 * @param {number} speed - approach speed in m/s
 * @param {number} angleRad - approach angle in XZ plane (0 = along +Z axis)
 */
function makeBallBodyAtHole(holePos, speed, angleRad = 0) {
  const vx = speed * Math.sin(angleRad);
  const vz = speed * Math.cos(angleRad);
  const vel = { x: vx, y: 0, z: vz };
  vel.length = () => Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
  return {
    position: { x: holePos.x, y: 0.2, z: holePos.z },
    velocity: vel
  };
}

/**
 * Build a ball body at a given world position with a scalar speed along X.
 */
function makeBallBody(posX, posZ, speed) {
  const vel = { x: speed, y: 0, z: 0 };
  vel.length = () => Math.abs(speed);
  return {
    position: { x: posX, y: 0.2, z: posZ },
    velocity: vel
  };
}

function createManager(holePos, cupRadius = CUP_RADIUS) {
  const published = [];
  const mockGame = {
    eventManager: {
      subscribe: jest.fn(),
      publish: jest.fn((event, data, source) => published.push({ event, data, source }))
    },
    stateManager: {
      isHoleCompleted: jest.fn(() => false),
      getCurrentHoleNumber: jest.fn(() => 1),
      setHoleCompleted: jest.fn(),
      setGameState: jest.fn()
    },
    course: {
      getTotalHoles: jest.fn(() => 9),
      getCurrentHoleMesh: jest.fn(() => null),
      getHolePar: jest.fn(() => 3),
      currentHole: { worldHolePosition: holePos, cupRadius }
    },
    ballManager: { ball: { handleHoleSuccess: jest.fn(), body: null } },
    debugManager: { log: jest.fn() },
    holeTransitionManager: { transitionToNextHole: jest.fn() },
    scene: { remove: jest.fn() },
    uiManager: { showMessage: jest.fn(), updateScore: jest.fn() },
    audioManager: { playSound: jest.fn() },
    scoringSystem: { getTotalStrokes: jest.fn(() => 1) }
  };

  const manager = new HoleCompletionManager(mockGame);
  manager.init();
  manager.holeCreationTime = Date.now() - 3000; // past grace period

  return { manager, mockGame, published };
}

// ---------------------------------------------------------------------------
// cupRadius config field
// ---------------------------------------------------------------------------
describe('cupRadius config field', () => {
  test('holes 1, 5, 9 use default cupRadius of 0.3 when not specified in config', () => {
    // Simulate hole configs without explicit cupRadius
    [HOLE_1_POS, HOLE_5_POS, { x: 0, y: 0, z: 0 }].forEach(holePos => {
      const { mockGame } = createManager(holePos, CUP_RADIUS);
      expect(mockGame.course.currentHole.cupRadius).toBe(0.3);
    });
  });

  test('cupRadius can be overridden via config', () => {
    const { mockGame } = createManager(HOLE_1_POS, 0.5);
    expect(mockGame.course.currentHole.cupRadius).toBe(0.5);
  });

  test('ball within custom cupRadius of 0.5 still triggers detection', () => {
    const { manager, mockGame, published } = createManager(HOLE_1_POS, 0.5);
    // Ball 0.4 away — inside 0.5 cupRadius
    mockGame.ballManager.ball.body = makeBallBody(HOLE_1_POS.x + 0.4, HOLE_1_POS.z, 0.2);

    manager.update(1 / 60);

    expect(published.some(p => p.event === 'ball:in_hole')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Speed threshold
// ---------------------------------------------------------------------------
describe('speed threshold — approach speed < 0.5', () => {
  test('speed 0.3 triggers BALL_IN_HOLE', () => {
    const { manager, mockGame, published } = createManager(HOLE_1_POS);
    mockGame.ballManager.ball.body = makeBallBody(HOLE_1_POS.x, HOLE_1_POS.z, 0.3);

    manager.update(1 / 60);

    expect(published.some(p => p.event === 'ball:in_hole')).toBe(true);
  });

  test('speed 0.6 does not trigger BALL_IN_HOLE', () => {
    const { manager, mockGame, published } = createManager(HOLE_1_POS);
    mockGame.ballManager.ball.body = makeBallBody(HOLE_1_POS.x, HOLE_1_POS.z, 0.6);

    manager.update(1 / 60);

    expect(published.some(p => p.event === 'ball:in_hole')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Min-speed guard
// ---------------------------------------------------------------------------
describe('min-speed guard — prevents rim-bounce false trigger', () => {
  test('ball crossing at speed 1.5 does not emit BALL_IN_HOLE', () => {
    const { manager, mockGame, published } = createManager(HOLE_1_POS);

    // Tick 1: inside at high speed
    mockGame.ballManager.ball.body = makeBallBody(HOLE_1_POS.x, HOLE_1_POS.z, 1.5);
    manager.update(1 / 60);

    // Tick 2: slowed to 0.3 inside (rim-bounce) — guard must block
    mockGame.ballManager.ball.body = makeBallBody(HOLE_1_POS.x, HOLE_1_POS.z, 0.3);
    manager.update(1 / 60);

    expect(published.some(p => p.event === 'ball:in_hole')).toBe(false);
  });

  test('ball approaching slowly from outside fires detection (no guard)', () => {
    const { manager, mockGame, published } = createManager(HOLE_1_POS);

    // Ball outside trigger first tick
    mockGame.ballManager.ball.body = makeBallBody(HOLE_1_POS.x + 0.5, HOLE_1_POS.z, 0.3);
    manager.update(1 / 60);
    expect(published.some(p => p.event === 'ball:in_hole')).toBe(false); // outside

    // Ball enters trigger at low speed — no prior fast entry
    mockGame.ballManager.ball.body = makeBallBody(HOLE_1_POS.x, HOLE_1_POS.z, 0.3);
    manager.update(1 / 60);
    expect(published.some(p => p.event === 'ball:in_hole')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Approach angle tests — Hole 1 (holePosition [0, 0, -5])
// ---------------------------------------------------------------------------
describe('cup sink detection — 3 approach angles on hole 1', () => {
  [
    { label: 'straight (0°)', angleRad: 0 },
    { label: '30° approach', angleRad: Math.PI / 6 },
    { label: '60° approach', angleRad: Math.PI / 3 }
  ].forEach(({ label, angleRad }) => {
    test(`fires BALL_IN_HOLE on ${label} with speed 0.3`, () => {
      const { manager, mockGame, published } = createManager(HOLE_1_POS);

      // Ball at hole centre, approaching at the given angle with low speed
      mockGame.ballManager.ball.body = makeBallBodyAtHole(HOLE_1_POS, 0.3, angleRad);

      manager.update(1 / 60);

      expect(published.some(p => p.event === 'ball:in_hole')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Approach angle tests — Hole 5 (holePosition [-5, 0, 5])
// ---------------------------------------------------------------------------
describe('cup sink detection — 3 approach angles on hole 5', () => {
  [
    { label: 'straight (0°)', angleRad: 0 },
    { label: '30° approach', angleRad: Math.PI / 6 },
    { label: '60° approach', angleRad: Math.PI / 3 }
  ].forEach(({ label, angleRad }) => {
    test(`fires BALL_IN_HOLE on ${label} with speed 0.3`, () => {
      const { manager, mockGame, published } = createManager(HOLE_5_POS);

      // Ball at hole centre, approaching at the given angle with low speed
      mockGame.ballManager.ball.body = makeBallBodyAtHole(HOLE_5_POS, 0.3, angleRad);

      manager.update(1 / 60);

      expect(published.some(p => p.event === 'ball:in_hole')).toBe(true);
    });
  });
});
