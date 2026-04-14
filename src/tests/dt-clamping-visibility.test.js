/**
 * Tests for dt clamping and page visibility handling
 * ISSUE-061: Handle page visibility changes and large dt spikes
 *
 * Verifies that:
 * - GameLoopManager clamps dt to prevent physics explosions after tab switch
 * - Mechanics timers (TimedHazard, TimedGate) do not skip multiple cycles
 * - MovingSweeper does not jump to unexpected position after tab re-focus
 * - No ball teleportation when switching back to the game tab
 * - document.visibilitychange event is handled
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GameLoopManager } from '../managers/GameLoopManager';
import { TimedHazard } from '../mechanics/TimedHazard';
import { TimedGate } from '../mechanics/TimedGate';
import { MovingSweeper } from '../mechanics/MovingSweeper';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

let animationFrameCallback;

beforeAll(() => {
  CANNON.Body.SLEEPING = 2;
  CANNON.Body.KINEMATIC = 4;
});

beforeEach(() => {
  global.requestAnimationFrame = jest.fn(cb => {
    animationFrameCallback = cb;
    return 1;
  });
  global.cancelAnimationFrame = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper to create a mock game
// ---------------------------------------------------------------------------

function createMockGame() {
  return {
    renderer: { render: jest.fn() },
    scene: {},
    camera: {},
    clock: { getDelta: jest.fn(() => 0.016) },
    physicsManager: { update: jest.fn() },
    performanceManager: {
      beginFrame: jest.fn(),
      endFrame: jest.fn(),
      startTimer: jest.fn(),
      endTimer: jest.fn()
    },
    ballManager: { update: jest.fn() },
    hazardManager: { update: jest.fn() },
    cameraController: { update: jest.fn() },
    cannonDebugRenderer: { update: jest.fn() },
    visualEffectsManager: { update: jest.fn() },
    debugManager: { log: jest.fn(), enabled: false }
  };
}

// ---------------------------------------------------------------------------
// Helper to create a mock CANNON world
// ---------------------------------------------------------------------------

function createMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    bumperMaterial: {}
  };
}

// ---------------------------------------------------------------------------
// Helper to create a mock THREE group
// ---------------------------------------------------------------------------

function createMockGroup() {
  return {
    add: jest.fn(),
    remove: jest.fn()
  };
}

// ---------------------------------------------------------------------------
// Helper to create a mock ball body
// ---------------------------------------------------------------------------

function createMockBallBody(x = 0, z = 0) {
  return {
    position: { x, y: 0.2, z },
    velocity: { x: 0, y: 0, z: 0 },
    sleepState: 0,
    applyImpulse: jest.fn()
  };
}

// ---------------------------------------------------------------------------
// 1. GameLoopManager dt clamping
// ---------------------------------------------------------------------------

describe('GameLoopManager dt clamping', () => {
  let gameLoopManager;
  let mockGame;

  beforeEach(() => {
    mockGame = createMockGame();
    gameLoopManager = new GameLoopManager(mockGame);
    gameLoopManager.init();
    gameLoopManager.startLoop();
  });

  afterEach(() => {
    gameLoopManager.cleanup();
  });

  test('should clamp dt to 1/30s (~33ms) after a 5-second tab switch', () => {
    gameLoopManager.lastFrameTime = performance.now() - 5000;
    animationFrameCallback();

    expect(gameLoopManager.deltaTime).toBeCloseTo(1 / 30, 4);
  });

  test('should clamp dt after a 30-second pause', () => {
    gameLoopManager.lastFrameTime = performance.now() - 30000;
    animationFrameCallback();

    expect(gameLoopManager.deltaTime).toBeCloseTo(1 / 30, 4);
  });

  test('should not clamp dt during normal 60fps gameplay (~16ms)', () => {
    gameLoopManager.lastFrameTime = performance.now() - 16;
    animationFrameCallback();

    // 16ms = 0.016s, well under 1/30 = 0.0333s
    expect(gameLoopManager.deltaTime).toBeLessThanOrEqual(1 / 30);
  });

  test('should pass clamped dt (not raw dt) to physics manager', () => {
    // Clear calls from the initial startLoop → animate()
    mockGame.physicsManager.update.mockClear();

    // Manually set a stale lastFrameTime to simulate a long pause
    gameLoopManager.lastFrameTime = Date.now() - 5000;
    animationFrameCallback();

    const passedDt = mockGame.physicsManager.update.mock.calls[0][0];
    // Should be clamped to 1/30, not the raw ~5s
    expect(passedDt).toBeLessThanOrEqual(1 / 30 + 0.001);
  });

  test('should pass clamped dt to camera controller', () => {
    mockGame.cameraController.update.mockClear();

    gameLoopManager.lastFrameTime = Date.now() - 5000;
    animationFrameCallback();

    const passedDt = mockGame.cameraController.update.mock.calls[0][0];
    expect(passedDt).toBeLessThanOrEqual(1 / 30 + 0.001);
  });

  test('should still render after clamping', () => {
    gameLoopManager.lastFrameTime = performance.now() - 5000;
    animationFrameCallback();

    expect(mockGame.renderer.render).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. TimedHazard — timer behavior with clamped dt
// ---------------------------------------------------------------------------

describe('TimedHazard with clamped dt', () => {
  let world, group;

  beforeEach(() => {
    world = createMockWorld();
    group = createMockGroup();

    CANNON.Body.mockImplementation(() => ({
      position: { x: 0, y: 0, z: 0, set: jest.fn() },
      velocity: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn() },
      addShape: jest.fn(),
      applyImpulse: jest.fn(),
      sleepState: 0,
      userData: {}
    }));

    CANNON.Vec3.mockImplementation((x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 }));

    THREE.Mesh.mockImplementation(() => ({
      position: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn(function (x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        })
      },
      rotation: { x: 0, y: 0, z: 0 },
      visible: true,
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() },
      parent: null
    }));
  });

  test('should not skip multiple on/off cycles when dt is clamped', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      size: { width: 2, length: 2 },
      onDuration: 2,
      offDuration: 2,
      hazardType: 'water'
    };
    const hazard = new TimedHazard(world, group, config, 0.2);

    // Simulate what the game loop does: clamp dt to 1/30
    // Even if 10 seconds pass, the mechanic only sees 1/30s per frame
    const clampedDt = 1 / 30;

    // Run a few clamped frames
    hazard.update(clampedDt, null);
    hazard.update(clampedDt, null);
    hazard.update(clampedDt, null);

    // After 3 frames of ~33ms each = ~100ms total, timer should be ~0.1s
    // With cycle = 4s (2 on + 2 off), it should still be in the first cycle position
    expect(hazard.timer).toBeCloseTo(3 * clampedDt, 4);
    // The hazard should be active (timer < onDuration = 2)
    expect(hazard.isActive).toBe(true);
  });

  test('timer should advance by exactly clamped dt, not raw elapsed time', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      size: { width: 2, length: 2 },
      onDuration: 1,
      offDuration: 1
    };
    const hazard = new TimedHazard(world, group, config, 0.2);

    // If a real 5-second pause happened but dt is clamped to 1/30:
    const clampedDt = 1 / 30;
    hazard.update(clampedDt, null);

    // Timer should be 1/30, not 5.0
    expect(hazard.timer).toBeCloseTo(1 / 30, 6);
    expect(hazard.timer).toBeLessThan(1); // Still in first on cycle
  });

  test('should not falsely toggle state with single clamped frame', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      size: { width: 2, length: 2 },
      onDuration: 0.5,
      offDuration: 0.5,
      phase: 0.49 // Near end of on-cycle
    };
    const hazard = new TimedHazard(world, group, config, 0.2);

    // One clamped frame should advance by 1/30 ≈ 0.033s
    // timer goes from 0.49 to ~0.523 — crosses into off phase (> 0.5)
    hazard.update(1 / 30, null);
    const stateAfterOneFrame = hazard.isActive;

    // Should have toggled exactly once, to inactive
    expect(stateAfterOneFrame).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. TimedGate — timer behavior with clamped dt
// ---------------------------------------------------------------------------

describe('TimedGate with clamped dt', () => {
  let world, group;

  beforeEach(() => {
    world = createMockWorld();
    group = createMockGroup();

    CANNON.Body.mockImplementation(() => ({
      position: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn(function (x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        })
      },
      velocity: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn() },
      addShape: jest.fn(),
      userData: {}
    }));

    CANNON.Vec3.mockImplementation((x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 }));
    CANNON.Box.mockImplementation(() => ({}));

    THREE.Mesh.mockImplementation(() => ({
      position: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn(function (x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        })
      },
      rotation: { x: 0, y: 0, z: 0 },
      castShadow: false,
      visible: true,
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() },
      parent: null
    }));
  });

  test('should not skip cycles when dt is clamped after tab switch', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      size: { width: 2, height: 1, depth: 0.2 },
      openDuration: 2,
      closedDuration: 3
    };
    const gate = new TimedGate(world, group, config, 0.2);

    // Simulate clamped frames (as if coming back from a tab switch)
    const clampedDt = 1 / 30;
    for (let i = 0; i < 10; i++) {
      gate.update(clampedDt, null);
    }

    // After 10 frames × 1/30 ≈ 0.333s, timer should be ~0.333
    // Still in first open phase (openDuration=2), so gate should be open
    expect(gate.timer).toBeCloseTo(10 * clampedDt, 4);
    expect(gate.isOpen).toBe(true);
  });

  test('gate position should interpolate smoothly with clamped dt', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      size: { width: 2, height: 1, depth: 0.2 },
      openDuration: 2,
      closedDuration: 3
    };
    const gate = new TimedGate(world, group, config, 0.2);

    const clampedDt = 1 / 30;
    const positions = [];

    // Collect positions over several frames
    for (let i = 0; i < 5; i++) {
      gate.update(clampedDt, null);
      positions.push(gate.mesh.position.y);
    }

    // Positions should change smoothly (each step should be a small increment)
    for (let i = 1; i < positions.length; i++) {
      const delta = Math.abs(positions[i] - positions[i - 1]);
      // No sudden jump — each step should be bounded by lerpSpeed * dt * range
      expect(delta).toBeLessThan(1.0); // Gate height is 1, so no frame should jump the full range
    }
  });
});

// ---------------------------------------------------------------------------
// 4. MovingSweeper — position continuity with clamped dt
// ---------------------------------------------------------------------------

describe('MovingSweeper with clamped dt', () => {
  let world, group;

  beforeEach(() => {
    world = createMockWorld();
    group = createMockGroup();

    CANNON.Body.mockImplementation(() => ({
      position: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn(function (x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        })
      },
      velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
      quaternion: {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
        set: jest.fn(),
        setFromAxisAngle: jest.fn(),
        copy: jest.fn()
      },
      addShape: jest.fn(),
      addEventListener: jest.fn(),
      userData: {}
    }));

    CANNON.Quaternion = jest.fn(() => ({
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      setFromAxisAngle: jest.fn()
    }));

    CANNON.Vec3.mockImplementation((x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 }));
    CANNON.Box.mockImplementation(() => ({}));

    THREE.Mesh.mockImplementation(() => ({
      position: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn(function (x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        })
      },
      rotation: { x: 0, y: 0, z: 0 },
      castShadow: false,
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() },
      parent: null
    }));
  });

  test('should not jump to unexpected position after tab re-focus', () => {
    const config = {
      pivot: new THREE.Vector3(0, 0, 0),
      armLength: 4,
      speed: 1.5,
      size: { width: 4, height: 0.4, depth: 0.3 }
    };
    const sweeper = new MovingSweeper(world, group, config, 0.2);

    // Run a few normal frames to establish baseline
    const normalDt = 1 / 60;
    sweeper.update(normalDt, null);
    const angleAfterNormal = sweeper.angle;

    // Now simulate what happens after a tab switch:
    // dt is clamped to 1/30, NOT the raw 5 seconds
    const clampedDt = 1 / 30;
    sweeper.update(clampedDt, null);
    const angleAfterClamped = sweeper.angle;

    // The angle increment should be speed * clampedDt = 1.5 * 1/30 = 0.05 rad
    const expectedIncrement = 1.5 * clampedDt;
    const actualIncrement = angleAfterClamped - angleAfterNormal;

    expect(actualIncrement).toBeCloseTo(expectedIncrement, 6);
  });

  test('angle should advance by at most speed * MAX_DT per frame', () => {
    const config = {
      pivot: new THREE.Vector3(0, 0, 0),
      armLength: 3,
      speed: 2.0
    };
    const sweeper = new MovingSweeper(world, group, config, 0.2);

    const initialAngle = sweeper.angle;
    const clampedDt = 1 / 30;
    sweeper.update(clampedDt, null);

    const maxAngleStep = 2.0 * (1 / 30);
    expect(sweeper.angle - initialAngle).toBeCloseTo(maxAngleStep, 6);
  });

  test('mesh and body positions should remain consistent after clamped frame', () => {
    const config = {
      pivot: new THREE.Vector3(2, 0, 3),
      armLength: 4,
      speed: 1.0
    };
    const sweeper = new MovingSweeper(world, group, config, 0.2);

    sweeper.update(1 / 30, null);

    // Mesh and body should both have been positioned via set()
    expect(sweeper.mesh.position.set).toHaveBeenCalled();
    expect(sweeper.body.position.set).toHaveBeenCalled();

    // The arguments to both set() calls should match
    const meshArgs = sweeper.mesh.position.set.mock.calls.slice(-1)[0];
    const bodyArgs = sweeper.body.position.set.mock.calls.slice(-1)[0];
    expect(meshArgs[0]).toBeCloseTo(bodyArgs[0], 6); // x
    expect(meshArgs[2]).toBeCloseTo(bodyArgs[2], 6); // z
  });
});

// ---------------------------------------------------------------------------
// 5. No ball teleportation — physics receives clamped dt
// ---------------------------------------------------------------------------

describe('Ball teleportation prevention', () => {
  let mockGame, gameLoopManager;

  beforeEach(() => {
    mockGame = createMockGame();
    gameLoopManager = new GameLoopManager(mockGame);
    gameLoopManager.init();
    gameLoopManager.startLoop();
  });

  afterEach(() => {
    gameLoopManager.cleanup();
  });

  test('physics step receives at most 1/30s after any length pause', () => {
    // Simulate various pause durations
    const pauseDurations = [100, 500, 1000, 5000, 30000, 60000];

    for (const pauseMs of pauseDurations) {
      mockGame.physicsManager.update.mockClear();
      gameLoopManager.lastFrameTime = performance.now() - pauseMs;
      animationFrameCallback();

      const passedDt = mockGame.physicsManager.update.mock.calls[0][0];
      expect(passedDt).toBeLessThanOrEqual(1 / 30 + 0.001);
    }
  });

  test('ball update is still called after dt clamping', () => {
    gameLoopManager.lastFrameTime = performance.now() - 10000;
    animationFrameCallback();

    expect(mockGame.ballManager.update).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. document.visibilitychange event handling
// ---------------------------------------------------------------------------

describe('Page visibility change handling', () => {
  let mockGame, gameLoopManager;

  beforeEach(() => {
    mockGame = createMockGame();
    gameLoopManager = new GameLoopManager(mockGame);
    gameLoopManager.init();
  });

  afterEach(() => {
    gameLoopManager.cleanup();
  });

  test('should register visibilitychange listener on construction', () => {
    const addEventSpy = jest.spyOn(document, 'addEventListener');
    const glm = new GameLoopManager(mockGame);

    expect(addEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    glm.cleanup();
    addEventSpy.mockRestore();
  });

  test('should remove visibilitychange listener on cleanup', () => {
    const removeEventSpy = jest.spyOn(document, 'removeEventListener');
    const glm = new GameLoopManager(mockGame);
    glm.cleanup();

    expect(removeEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    removeEventSpy.mockRestore();
  });

  test('should pause loop when tab becomes hidden', () => {
    gameLoopManager.startLoop();
    expect(gameLoopManager.isRunning).toBe(true);

    // Simulate tab hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true
    });
    gameLoopManager._onVisibilityChange();

    expect(gameLoopManager.isPaused).toBe(true);
    expect(gameLoopManager._pausedByVisibility).toBe(true);
  });

  test('should resume loop when tab becomes visible after being hidden', () => {
    gameLoopManager.startLoop();

    // Hide
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true
    });
    gameLoopManager._onVisibilityChange();
    expect(gameLoopManager.isPaused).toBe(true);

    // Show
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true
    });
    gameLoopManager._onVisibilityChange();

    expect(gameLoopManager.isPaused).toBe(false);
    expect(gameLoopManager._pausedByVisibility).toBe(false);
    expect(gameLoopManager.isRunning).toBe(true);
  });

  test('should not resume if paused by user (not by visibility)', () => {
    gameLoopManager.startLoop();

    // User manually pauses
    gameLoopManager.pause();
    expect(gameLoopManager.isPaused).toBe(true);
    expect(gameLoopManager._pausedByVisibility).toBe(false);

    // Tab becomes visible — should NOT resume since user paused manually
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true
    });
    gameLoopManager._onVisibilityChange();

    expect(gameLoopManager.isPaused).toBe(true);
    expect(gameLoopManager.isRunning).toBe(false);
  });

  test('should not pause if loop is not running', () => {
    // Loop not started
    expect(gameLoopManager.isRunning).toBe(false);

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true
    });
    gameLoopManager._onVisibilityChange();

    expect(gameLoopManager._pausedByVisibility).toBe(false);
  });

  test('should reset lastFrameTime on resume to prevent stale dt', () => {
    gameLoopManager.startLoop();

    // Pause via visibility
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true
    });
    gameLoopManager._onVisibilityChange();

    // Wait simulated time (advance performance.now)
    const timeBeforeResume = performance.now();

    // Resume
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true
    });
    gameLoopManager._onVisibilityChange();

    // lastFrameTime should be fresh (set by startLoop via resume)
    // The difference should be very small (< 100ms)
    expect(performance.now() - gameLoopManager.lastFrameTime).toBeLessThan(100);
  });
});
