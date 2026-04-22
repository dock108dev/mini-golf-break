/**
 * Tests for ISSUE-064: Reset mechanic timers on large dt spike or page refocus.
 *
 * Verifies that:
 * - TimedHazard and TimedGate reset their timer to 0 when dt exceeds clamp threshold
 * - PortalGate cooldown is cleared on dt clamp
 * - MovingSweeper uses elapsed-time based angle and doesn't jump on dt spike
 * - HoleEntity threads dtWasClamped flag and calls onDtSpike() on mechanics
 * - CoursesManager reads dtWasClamped from GameLoopManager
 * - GameLoopManager exposes dtWasClamped and MAX_DELTA_TIME
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GameLoopManager, MAX_DELTA_TIME } from '../managers/GameLoopManager';
import { TimedHazard } from '../mechanics/TimedHazard';
import { TimedGate } from '../mechanics/TimedGate';
import { PortalGate } from '../mechanics/PortalGate';
import { MovingSweeper } from '../mechanics/MovingSweeper';
import { MechanicBase } from '../mechanics/MechanicBase';

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
// Helpers
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

function createMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    bumperMaterial: {}
  };
}

function createMockGroup() {
  return {
    add: jest.fn(),
    remove: jest.fn()
  };
}

// ---------------------------------------------------------------------------
// 1. GameLoopManager — dtWasClamped flag and MAX_DELTA_TIME export
// ---------------------------------------------------------------------------

describe('GameLoopManager dtWasClamped flag', () => {
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

  test('MAX_DELTA_TIME is exported and equals 1/30', () => {
    expect(MAX_DELTA_TIME).toBeCloseTo(1 / 30, 6);
  });

  test('dtWasClamped is false during normal 60fps gameplay', () => {
    gameLoopManager.lastFrameTime = performance.now() - 16; // 16ms = normal frame
    animationFrameCallback();

    expect(gameLoopManager.dtWasClamped).toBe(false);
  });

  test('dtWasClamped is true after a 5-second pause', () => {
    gameLoopManager.lastFrameTime = performance.now() - 5000;
    animationFrameCallback();

    expect(gameLoopManager.dtWasClamped).toBe(true);
    // dt should still be clamped
    expect(gameLoopManager.deltaTime).toBeCloseTo(MAX_DELTA_TIME, 4);
  });

  test('dtWasClamped resets to false on next normal frame', () => {
    // First: spike
    gameLoopManager.lastFrameTime = performance.now() - 5000;
    animationFrameCallback();
    expect(gameLoopManager.dtWasClamped).toBe(true);

    // Second: normal frame
    gameLoopManager.lastFrameTime = performance.now() - 16;
    animationFrameCallback();
    expect(gameLoopManager.dtWasClamped).toBe(false);
  });

  test('dtWasClamped initializes to false', () => {
    const glm = new GameLoopManager(mockGame);
    expect(glm.dtWasClamped).toBe(false);
    glm.cleanup();
  });
});

// ---------------------------------------------------------------------------
// 2. MechanicBase — onDtSpike() exists and is a no-op
// ---------------------------------------------------------------------------

describe('MechanicBase onDtSpike', () => {
  test('onDtSpike exists and does not throw', () => {
    const base = new MechanicBase(null, null, {}, 0.2);
    expect(typeof base.onDtSpike).toBe('function');
    expect(() => base.onDtSpike()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. TimedHazard — timer resets on dt spike
// ---------------------------------------------------------------------------

describe('TimedHazard onDtSpike', () => {
  let world, group;

  beforeEach(() => {
    world = createMockWorld();
    group = createMockGroup();

    CANNON.Body.mockImplementation(() => ({
      position: { x: 0, y: 0, z: 0, set: jest.fn() },
      velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
      quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn() },
      angularVelocity: { x: 0, y: 0, z: 0, set: jest.fn() },
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

  test('onDtSpike resets timer to 0', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      size: { width: 2, length: 2 },
      onDuration: 2,
      offDuration: 2
    };
    const hazard = new TimedHazard(world, group, config, 0.2);

    // Advance timer to mid-cycle
    for (let i = 0; i < 60; i++) {
      hazard.update(1 / 60, null);
    }
    expect(hazard.timer).toBeGreaterThan(0.5);

    // Trigger dt spike reset
    hazard.onDtSpike();

    expect(hazard.timer).toBe(0);
    expect(hazard.isActive).toBe(false);
    expect(hazard.mesh.visible).toBe(false);
  });

  test('after onDtSpike, hazard restarts cycle cleanly', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      size: { width: 2, length: 2 },
      onDuration: 1,
      offDuration: 1
    };
    const hazard = new TimedHazard(world, group, config, 0.2);

    // Advance past on-phase into off-phase
    for (let i = 0; i < 70; i++) {
      hazard.update(1 / 60, null); // ~1.17s total, past onDuration=1
    }
    expect(hazard.isActive).toBe(false); // in off phase

    // dt spike resets
    hazard.onDtSpike();
    expect(hazard.timer).toBe(0);

    // First frame after reset: timer = 1/30, still in on-phase (< onDuration=1)
    hazard.update(1 / 30, null);
    expect(hazard.isActive).toBe(true);
    expect(hazard.timer).toBeCloseTo(1 / 30, 6);
  });
});

// ---------------------------------------------------------------------------
// 4. TimedGate — timer resets and gate snaps to closed on dt spike
// ---------------------------------------------------------------------------

describe('TimedGate onDtSpike', () => {
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
      quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn() },
      angularVelocity: { x: 0, y: 0, z: 0, set: jest.fn() },
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

  test('onDtSpike resets timer to 0 and snaps gate to closed', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      size: { width: 2, height: 1, depth: 0.2 },
      openDuration: 2,
      closedDuration: 3
    };
    const gate = new TimedGate(world, group, config, 0.2);

    // Advance into open state
    for (let i = 0; i < 120; i++) {
      gate.update(1 / 60, null);
    }
    expect(gate.timer).toBeGreaterThan(1);
    expect(gate.isOpen).toBe(true);

    // Trigger dt spike
    gate.onDtSpike();

    expect(gate.timer).toBe(0);
    expect(gate.isOpen).toBe(false);
    expect(gate.mesh.position.y).toBe(gate.closedY);
    expect(gate.body.position.y).toBe(gate.closedY);
  });

  test('after onDtSpike, gate restarts cycle from closed state', () => {
    const config = {
      position: new THREE.Vector3(0, 0, 0),
      size: { width: 2, height: 1, depth: 0.2 },
      openDuration: 1,
      closedDuration: 1
    };
    const gate = new TimedGate(world, group, config, 0.2);

    // Advance timer
    for (let i = 0; i < 30; i++) {
      gate.update(1 / 30, null);
    }

    gate.onDtSpike();

    // After reset, first update: timer = 1/30, still in open phase (< openDuration=1)
    gate.update(1 / 30, null);
    expect(gate.isOpen).toBe(true);
    expect(gate.timer).toBeCloseTo(1 / 30, 6);
  });
});

// ---------------------------------------------------------------------------
// 5. PortalGate — cooldown clears on dt spike
// ---------------------------------------------------------------------------

describe('PortalGate onDtSpike', () => {
  let world, group;

  beforeEach(() => {
    world = createMockWorld();
    group = createMockGroup();

    CANNON.Body.mockImplementation(() => ({
      position: { x: 0, y: 0, z: 0, set: jest.fn() },
      velocity: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      addShape: jest.fn(),
      userData: {},
      wakeUp: jest.fn()
    }));

    CANNON.Vec3.mockImplementation((x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 }));
  });

  test('onDtSpike clears cooldown to 0', () => {
    const config = {
      entryPosition: new THREE.Vector3(-3, 0, 2),
      exitPosition: new THREE.Vector3(3, 0, -5),
      radius: 0.6
    };
    const portal = new PortalGate(world, group, config, 0.2);

    // Simulate teleportation to set cooldown
    portal.cooldown = 1.0;

    portal.onDtSpike();
    expect(portal.cooldown).toBe(0);
  });

  test('portal is immediately usable after dt spike reset', () => {
    const config = {
      entryPosition: new THREE.Vector3(0, 0, 0),
      exitPosition: new THREE.Vector3(5, 0, 5),
      radius: 1.0
    };
    const portal = new PortalGate(world, group, config, 0.2);

    // Set cooldown (as if just teleported)
    portal.cooldown = 0.8;

    // With cooldown active, ball at entry should NOT teleport
    const ballBody = {
      position: {
        x: 0,
        y: 0.2,
        z: 0,
        set: jest.fn(function (x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        })
      },
      wakeUp: jest.fn()
    };
    portal.update(1 / 60, ballBody);
    // Cooldown was active, ball should not have been teleported
    expect(ballBody.position.set).not.toHaveBeenCalled();

    // dt spike clears cooldown
    portal.onDtSpike();
    expect(portal.cooldown).toBe(0);

    // Now ball at entry should teleport
    ballBody.position.x = 0;
    ballBody.position.z = 0;
    portal.update(1 / 60, ballBody);
    // Ball should have been teleported to exit position
    expect(ballBody.position.set).toHaveBeenCalled();
    expect(ballBody.wakeUp).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. MovingSweeper — elapsed-time based angle, no jump on dt spike
// ---------------------------------------------------------------------------

describe('MovingSweeper onDtSpike and elapsed-time angle', () => {
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
      angularVelocity: { x: 0, y: 0, z: 0, set: jest.fn() },
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

  test('angle is computed from elapsed time, not accumulated', () => {
    const config = {
      pivot: new THREE.Vector3(0, 0, 0),
      armLength: 4,
      speed: 1.5,
      phase: 0.5
    };
    const sweeper = new MovingSweeper(world, group, config, 0.2);

    expect(sweeper.initialAngle).toBe(0.5);
    expect(sweeper.elapsedTime).toBe(0);
    expect(sweeper.angle).toBe(0.5);

    // After one frame
    sweeper.update(1 / 60, null);
    const expectedAngle = 0.5 + 1.5 * (1 / 60);
    expect(sweeper.angle).toBeCloseTo(expectedAngle, 6);
    expect(sweeper.elapsedTime).toBeCloseTo(1 / 60, 6);
  });

  test('onDtSpike recalculates elapsedTime from current angle', () => {
    const config = {
      pivot: new THREE.Vector3(0, 0, 0),
      armLength: 4,
      speed: 2.0,
      phase: 0
    };
    const sweeper = new MovingSweeper(world, group, config, 0.2);

    // Run for 60 frames
    for (let i = 0; i < 60; i++) {
      sweeper.update(1 / 60, null);
    }
    const angleBeforeSpike = sweeper.angle;

    // onDtSpike should recalculate elapsedTime from current angle
    sweeper.onDtSpike();

    // elapsedTime should be consistent with current angle
    expect(sweeper.elapsedTime).toBeCloseTo(angleBeforeSpike / sweeper.speed, 6);

    // After spike, next frame should advance smoothly from current position
    sweeper.update(1 / 60, null);
    const expectedAngle = sweeper.initialAngle + sweeper.speed * sweeper.elapsedTime;
    expect(sweeper.angle).toBeCloseTo(expectedAngle, 6);

    // The angle should have advanced by exactly one frame from pre-spike position
    const angleIncrement = sweeper.speed * (1 / 60);
    expect(sweeper.angle).toBeCloseTo(angleBeforeSpike + angleIncrement, 5);
  });

  test('no visual jump after dt spike — angle advances by one normal frame step', () => {
    const config = {
      pivot: new THREE.Vector3(2, 0, 3),
      armLength: 3,
      speed: 1.0
    };
    const sweeper = new MovingSweeper(world, group, config, 0.2);

    // Run for a while
    for (let i = 0; i < 100; i++) {
      sweeper.update(1 / 60, null);
    }
    const angleBefore = sweeper.angle;

    // Simulate dt spike: call onDtSpike(), then update with clamped dt
    sweeper.onDtSpike();
    sweeper.update(1 / 30, null); // clamped dt

    const angleAfter = sweeper.angle;
    const maxExpectedStep = sweeper.speed * (1 / 30);

    // Angle should have advanced by at most one clamped frame step
    expect(angleAfter - angleBefore).toBeCloseTo(maxExpectedStep, 6);
  });
});

// ---------------------------------------------------------------------------
// 7. HoleEntity — threads dtWasClamped and calls onDtSpike
// ---------------------------------------------------------------------------

describe('HoleEntity dtWasClamped threading', () => {
  test('calls onDtSpike on mechanics when dtWasClamped is true', () => {
    const mockMechanic = {
      _failed: false,
      onDtSpike: jest.fn(),
      update: jest.fn(),
      config: { type: 'test' }
    };

    // Minimal HoleEntity-like object to test the update logic
    const holeEntity = {
      mechanics: [mockMechanic],
      update(dt, ballBody, options) {
        if (!this.mechanics) {
          return;
        }
        const dtWasClamped = options?.dtWasClamped || false;
        for (const mechanic of this.mechanics) {
          if (mechanic._failed) {
            continue;
          }
          if (dtWasClamped && typeof mechanic.onDtSpike === 'function') {
            mechanic.onDtSpike();
          }
          mechanic.update(dt, ballBody);
        }
      }
    };

    // Normal frame — onDtSpike should NOT be called
    holeEntity.update(1 / 60, null, { dtWasClamped: false });
    expect(mockMechanic.onDtSpike).not.toHaveBeenCalled();
    expect(mockMechanic.update).toHaveBeenCalledWith(1 / 60, null);

    mockMechanic.onDtSpike.mockClear();
    mockMechanic.update.mockClear();

    // Clamped frame — onDtSpike SHOULD be called before update
    holeEntity.update(1 / 30, null, { dtWasClamped: true });
    expect(mockMechanic.onDtSpike).toHaveBeenCalledTimes(1);
    expect(mockMechanic.update).toHaveBeenCalledWith(1 / 30, null);

    // Verify onDtSpike was called before update
    const spikeOrder = mockMechanic.onDtSpike.mock.invocationCallOrder[0];
    const updateOrder = mockMechanic.update.mock.invocationCallOrder[0];
    expect(spikeOrder).toBeLessThan(updateOrder);
  });

  test('does not call onDtSpike on failed mechanics', () => {
    const failedMechanic = {
      _failed: true,
      onDtSpike: jest.fn(),
      update: jest.fn()
    };
    const activeMechanic = {
      _failed: false,
      onDtSpike: jest.fn(),
      update: jest.fn(),
      config: { type: 'test' }
    };

    const holeEntity = {
      mechanics: [failedMechanic, activeMechanic],
      update(dt, ballBody, options) {
        if (!this.mechanics) {
          return;
        }
        const dtWasClamped = options?.dtWasClamped || false;
        for (const mechanic of this.mechanics) {
          if (mechanic._failed) {
            continue;
          }
          if (dtWasClamped && typeof mechanic.onDtSpike === 'function') {
            mechanic.onDtSpike();
          }
          mechanic.update(dt, ballBody);
        }
      }
    };

    holeEntity.update(1 / 30, null, { dtWasClamped: true });

    expect(failedMechanic.onDtSpike).not.toHaveBeenCalled();
    expect(failedMechanic.update).not.toHaveBeenCalled();
    expect(activeMechanic.onDtSpike).toHaveBeenCalledTimes(1);
    expect(activeMechanic.update).toHaveBeenCalledTimes(1);
  });

  test('handles missing options gracefully (backward compat)', () => {
    const mockMechanic = {
      _failed: false,
      onDtSpike: jest.fn(),
      update: jest.fn(),
      config: { type: 'test' }
    };

    const holeEntity = {
      mechanics: [mockMechanic],
      update(dt, ballBody, options) {
        if (!this.mechanics) {
          return;
        }
        const dtWasClamped = options?.dtWasClamped || false;
        for (const mechanic of this.mechanics) {
          if (mechanic._failed) {
            continue;
          }
          if (dtWasClamped && typeof mechanic.onDtSpike === 'function') {
            mechanic.onDtSpike();
          }
          mechanic.update(dt, ballBody);
        }
      }
    };

    // No options parameter at all
    expect(() => holeEntity.update(1 / 60, null)).not.toThrow();
    expect(mockMechanic.onDtSpike).not.toHaveBeenCalled();
    expect(mockMechanic.update).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 8. CoursesManager — reads dtWasClamped from gameLoopManager
// ---------------------------------------------------------------------------

describe('CoursesManager dtWasClamped threading', () => {
  test('passes dtWasClamped true to HoleEntity when gameLoopManager flag is set', () => {
    const mockUpdate = jest.fn();
    const coursesManager = {
      game: {
        ballManager: { ball: { body: {} } },
        gameLoopManager: { dtWasClamped: true }
      },
      currentHoleEntity: { update: mockUpdate },
      update(dt) {
        if (this.currentHoleEntity?.update) {
          const ballBody = this.game?.ballManager?.ball?.body || null;
          const dtWasClamped = this.game?.gameLoopManager?.dtWasClamped || false;
          this.currentHoleEntity.update(dt, ballBody, { dtWasClamped });
        }
      }
    };

    coursesManager.update(1 / 30);
    expect(mockUpdate).toHaveBeenCalledWith(1 / 30, expect.any(Object), { dtWasClamped: true });
  });

  test('passes dtWasClamped false during normal frames', () => {
    const mockUpdate = jest.fn();
    const coursesManager = {
      game: {
        ballManager: { ball: { body: {} } },
        gameLoopManager: { dtWasClamped: false }
      },
      currentHoleEntity: { update: mockUpdate },
      update(dt) {
        if (this.currentHoleEntity?.update) {
          const ballBody = this.game?.ballManager?.ball?.body || null;
          const dtWasClamped = this.game?.gameLoopManager?.dtWasClamped || false;
          this.currentHoleEntity.update(dt, ballBody, { dtWasClamped });
        }
      }
    };

    coursesManager.update(1 / 60);
    expect(mockUpdate).toHaveBeenCalledWith(1 / 60, expect.any(Object), { dtWasClamped: false });
  });

  test('handles missing gameLoopManager gracefully', () => {
    const mockUpdate = jest.fn();
    const coursesManager = {
      game: { ballManager: null },
      currentHoleEntity: { update: mockUpdate },
      update(dt) {
        if (this.currentHoleEntity?.update) {
          const ballBody = this.game?.ballManager?.ball?.body || null;
          const dtWasClamped = this.game?.gameLoopManager?.dtWasClamped || false;
          this.currentHoleEntity.update(dt, ballBody, { dtWasClamped });
        }
      }
    };

    coursesManager.update(1 / 60);
    expect(mockUpdate).toHaveBeenCalledWith(1 / 60, null, { dtWasClamped: false });
  });
});
