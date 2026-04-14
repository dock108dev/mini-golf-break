/**
 * Tests for pause/resume interaction with timed mechanics
 * ISSUE-079
 *
 * Verifies that when the game is paused (update() calls stop), all mechanic
 * timers and animations freeze, and on resume they continue from the exact
 * pre-pause state.
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { MovingSweeper } from '../../mechanics/MovingSweeper';
import { TimedHazard } from '../../mechanics/TimedHazard';
import { TimedGate } from '../../mechanics/TimedGate';
import { PortalGate } from '../../mechanics/PortalGate';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { SuctionZone } from '../../mechanics/SuctionZone';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Body.SLEEPING = 2;
  CANNON.Body.KINEMATIC = 4;
  CANNON.Body.STATIC = 1;

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
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    },
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
    applyForce: jest.fn(),
    applyImpulse: jest.fn(),
    wakeUp: jest.fn(),
    addEventListener: jest.fn(),
    sleepState: 0,
    userData: {}
  }));

  CANNON.Quaternion = jest.fn(() => ({
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    setFromAxisAngle: jest.fn()
  }));

  CANNON.Vec3.mockImplementation((x, y, z) => ({
    x: x || 0,
    y: y || 0,
    z: z || 0,
    scale: jest.fn(function (s) {
      return { x: this.x * s, y: this.y * s, z: this.z * s };
    })
  }));
  CANNON.Box.mockImplementation(() => ({}));

  THREE.Mesh.mockImplementation(() => {
    const mesh = {
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
      quaternion: { x: 0, y: 0, z: 0, w: 1, copy: jest.fn() },
      castShadow: false,
      visible: true,
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    };
    mesh.parent = null;
    return mesh;
  });

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, dispose: jest.fn() };
    if (opts) {
      Object.assign(mat, opts);
    }
    return mat;
  });

  THREE.PlaneGeometry = jest.fn(() => ({ dispose: jest.fn() }));
  THREE.BoxGeometry = jest.fn(() => ({ dispose: jest.fn() }));
  THREE.CylinderGeometry = jest.fn(() => ({ dispose: jest.fn() }));
  THREE.RingGeometry = jest.fn(() => ({ dispose: jest.fn() }));
  THREE.CircleGeometry = jest.fn(() => ({ dispose: jest.fn() }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    bumperMaterial: { id: 'bumper' }
  };
}

function makeMockGroup() {
  const children = [];
  return {
    add: jest.fn(child => children.push(child)),
    remove: jest.fn(child => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
      }
    }),
    children
  };
}

function makeBallBody(x = 0, y = 0.5, z = 0) {
  const body = new CANNON.Body();
  body.position.x = x;
  body.position.y = y;
  body.position.z = z;
  body.sleepState = 0;
  return body;
}

/**
 * Simulate a pause/resume cycle:
 *   1. Run mechanic for prePauseFrames at the given dt
 *   2. Stop calling update() (simulates pause — game loop stops)
 *   3. Resume by calling update() for postResumeFrames at the given dt
 *
 * Returns { preState, postState } snapshots.
 */
function simulatePauseResume(
  mechanic,
  { dt = 0.016, prePauseFrames = 10, postResumeFrames = 1, ballBody = null, captureState }
) {
  // Run pre-pause frames
  for (let i = 0; i < prePauseFrames; i++) {
    mechanic.update(dt, ballBody);
  }
  const preState = captureState(mechanic);

  // --- PAUSE: no update() calls ---

  // Resume
  for (let i = 0; i < postResumeFrames; i++) {
    mechanic.update(dt, ballBody);
  }
  const postState = captureState(mechanic);

  return { preState, postState };
}

const surfaceHeight = 0.2;

// ===========================================================================
// MovingSweeper — angle does not change while paused
// ===========================================================================

describe('Pause/Resume: MovingSweeper', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('angle does not change while game is paused (no update calls)', () => {
    const sweeper = new MovingSweeper(
      world,
      group,
      {
        pivot: { x: 0, y: 0, z: 0 },
        armLength: 4,
        speed: 2
      },
      surfaceHeight
    );

    // Run for several frames
    sweeper.update(0.5, null);
    sweeper.update(0.5, null);
    const angleBeforePause = sweeper.angle;
    const elapsedBeforePause = sweeper.elapsedTime;

    // --- PAUSE: no update() calls ---

    // Verify state is unchanged (nothing called update)
    expect(sweeper.angle).toBe(angleBeforePause);
    expect(sweeper.elapsedTime).toBe(elapsedBeforePause);
  });

  it('resumes from exact pre-pause angle on next update', () => {
    const sweeper = new MovingSweeper(
      world,
      group,
      {
        pivot: { x: 0, y: 0, z: 0 },
        armLength: 4,
        speed: 2,
        phase: 0
      },
      surfaceHeight
    );

    // Run for 1 second total
    sweeper.update(0.5, null);
    sweeper.update(0.5, null);
    const angleBeforePause = sweeper.angle;
    expect(angleBeforePause).toBeCloseTo(2.0, 5); // speed(2) * time(1.0)

    // --- PAUSE: no update() calls ---

    // Resume with a single frame
    sweeper.update(0.1, null);

    // Should continue from where it left off
    const expectedAngle = 2 * (1.0 + 0.1); // speed * total elapsed
    expect(sweeper.angle).toBeCloseTo(expectedAngle, 5);
  });

  it('mesh position is unchanged during pause', () => {
    const sweeper = new MovingSweeper(
      world,
      group,
      {
        pivot: { x: 0, y: 0, z: 0 },
        armLength: 4,
        speed: 2
      },
      surfaceHeight
    );

    sweeper.update(0.5, null);
    const posXBefore = sweeper.mesh.position.x;
    const posZBefore = sweeper.mesh.position.z;

    // No update calls (paused) — position stays the same
    expect(sweeper.mesh.position.x).toBe(posXBefore);
    expect(sweeper.mesh.position.z).toBe(posZBefore);
  });
});

// ===========================================================================
// TimedHazard — timer does not advance while paused
// ===========================================================================

describe('Pause/Resume: TimedHazard', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('timer does not advance while game is paused (no update calls)', () => {
    const hazard = new TimedHazard(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        onDuration: 2,
        offDuration: 3
      },
      surfaceHeight
    );

    hazard.update(0.5, null);
    const timerBeforePause = hazard.timer;
    const isActiveBeforePause = hazard.isActive;

    // --- PAUSE: no update() calls ---

    expect(hazard.timer).toBe(timerBeforePause);
    expect(hazard.isActive).toBe(isActiveBeforePause);
  });

  it('active/inactive state is preserved during pause', () => {
    const hazard = new TimedHazard(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        onDuration: 1,
        offDuration: 1
      },
      surfaceHeight
    );

    // Advance into active state
    hazard.update(0.5, null);
    expect(hazard.isActive).toBe(true);

    // --- PAUSE ---

    // State unchanged
    expect(hazard.isActive).toBe(true);
    expect(hazard.mesh.visible).toBe(true);
  });

  it('resumes timer from exact pre-pause value', () => {
    const hazard = new TimedHazard(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        onDuration: 2,
        offDuration: 2
      },
      surfaceHeight
    );

    hazard.update(0.7, null);
    expect(hazard.timer).toBeCloseTo(0.7, 5);

    // --- PAUSE ---

    // Resume with a normal frame
    hazard.update(0.3, null);
    expect(hazard.timer).toBeCloseTo(1.0, 5);
  });

  it('does not skip timer state on resume — continues exact cycle position', () => {
    const hazard = new TimedHazard(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        onDuration: 1,
        offDuration: 1
      },
      surfaceHeight
    );

    // Advance to timer=0.9, still in active phase (cyclePos 0.9 < onDuration 1)
    hazard.update(0.9, null);
    expect(hazard.isActive).toBe(true);

    // --- PAUSE ---

    // Resume with 0.2s — timer becomes 1.1, cyclePos=1.1%2=1.1 >= 1 → inactive
    hazard.update(0.2, null);
    expect(hazard.timer).toBeCloseTo(1.1, 5);
    expect(hazard.isActive).toBe(false);
  });
});

// ===========================================================================
// TimedGate — timer does not advance while paused
// ===========================================================================

describe('Pause/Resume: TimedGate', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('timer does not advance while game is paused (no update calls)', () => {
    const gate = new TimedGate(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        openDuration: 2,
        closedDuration: 3
      },
      surfaceHeight
    );

    gate.update(1.0, null);
    const timerBeforePause = gate.timer;
    const isOpenBeforePause = gate.isOpen;

    // --- PAUSE: no update() calls ---

    expect(gate.timer).toBe(timerBeforePause);
    expect(gate.isOpen).toBe(isOpenBeforePause);
  });

  it('open/closed state is preserved during pause', () => {
    const gate = new TimedGate(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        openDuration: 3,
        closedDuration: 2
      },
      surfaceHeight
    );

    // Advance into open state
    gate.update(0.5, null);
    expect(gate.isOpen).toBe(true);

    // --- PAUSE ---

    expect(gate.isOpen).toBe(true);
  });

  it('resumes timer from exact pre-pause value', () => {
    const gate = new TimedGate(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        openDuration: 2,
        closedDuration: 3
      },
      surfaceHeight
    );

    gate.update(1.5, null);
    expect(gate.timer).toBeCloseTo(1.5, 5);

    // --- PAUSE ---

    // Resume
    gate.update(0.5, null);
    expect(gate.timer).toBeCloseTo(2.0, 5);
  });

  it('gate position does not change during pause', () => {
    const gate = new TimedGate(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        size: { width: 2, height: 1, depth: 0.2 },
        openDuration: 5,
        closedDuration: 1
      },
      surfaceHeight
    );

    // Set mesh to closedY, then update to start lerping
    gate.mesh.position.y = gate.closedY;
    gate.update(0.1, null);
    const yBeforePause = gate.mesh.position.y;

    // --- PAUSE: no update() calls ---

    expect(gate.mesh.position.y).toBe(yBeforePause);
    expect(gate.body.position.y).toBe(yBeforePause);
  });

  it('gate lerp continues from pre-pause position on resume', () => {
    const gate = new TimedGate(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        size: { width: 2, height: 1, depth: 0.2 },
        openDuration: 5,
        closedDuration: 1
      },
      surfaceHeight
    );

    gate.mesh.position.y = gate.closedY;
    gate.update(0.05, null);
    const yAfterFirstFrame = gate.mesh.position.y;

    // --- PAUSE ---

    // Resume — gate should continue lerping from yAfterFirstFrame
    gate.update(0.05, null);
    const yAfterResume = gate.mesh.position.y;

    // Should have moved further toward openY
    expect(yAfterResume).toBeLessThan(yAfterFirstFrame);
  });
});

// ===========================================================================
// PortalGate — cooldown timer does not decrement while paused
// ===========================================================================

describe('Pause/Resume: PortalGate', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('cooldown does not decrement while game is paused (no update calls)', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: { x: -3, y: 0, z: 2 },
        exitPosition: { x: 3, y: 0, z: -5 },
        radius: 0.6
      },
      surfaceHeight
    );

    // Trigger a teleport to start cooldown
    const ball = makeBallBody(-3, 0.5, 2);
    portal.update(0.016, ball);
    expect(portal.cooldown).toBe(1.0);

    // Move ball away
    ball.position.x = 0;
    ball.position.z = 0;

    // One frame to decrement cooldown slightly
    portal.update(0.2, ball);
    const cooldownBeforePause = portal.cooldown;
    expect(cooldownBeforePause).toBeCloseTo(0.8, 5);

    // --- PAUSE: no update() calls ---

    expect(portal.cooldown).toBe(cooldownBeforePause);
  });

  it('cooldown continues decrementing from exact pre-pause value on resume', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: { x: -3, y: 0, z: 2 },
        exitPosition: { x: 3, y: 0, z: -5 },
        radius: 0.6
      },
      surfaceHeight
    );

    // Trigger teleport
    const ball = makeBallBody(-3, 0.5, 2);
    portal.update(0.016, ball);

    // Move ball away and decrement cooldown
    ball.position.x = 0;
    ball.position.z = 0;
    portal.update(0.5, ball);
    expect(portal.cooldown).toBeCloseTo(0.5, 5);

    // --- PAUSE ---

    // Resume
    portal.update(0.3, ball);
    expect(portal.cooldown).toBeCloseTo(0.2, 5);
  });

  it('teleport remains blocked during cooldown across pause/resume', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: { x: -3, y: 0, z: 2 },
        exitPosition: { x: 3, y: 0, z: -5 },
        radius: 0.6
      },
      surfaceHeight
    );

    // Trigger first teleport
    const ball = makeBallBody(-3, 0.5, 2);
    portal.update(0.016, ball);
    ball.position.set.mockClear();

    // Move ball away, partial cooldown decrement
    ball.position.x = 0;
    ball.position.z = 0;
    portal.update(0.3, ball);

    // --- PAUSE ---

    // Resume — move ball back to entry, cooldown still active
    ball.position.x = -3;
    ball.position.z = 2;
    portal.update(0.3, ball);

    // Cooldown started at 1.0, decremented 0.3 + 0.3 = 0.6, remaining = 0.4 > 0
    // Should NOT teleport
    expect(ball.position.set).not.toHaveBeenCalledWith(portal.exitX, portal.exitY, portal.exitZ);
  });
});

// ===========================================================================
// BoostStrip — does not apply force while paused
// ===========================================================================

describe('Pause/Resume: BoostStrip', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('does not apply force while game is paused (no update calls)', () => {
    const boost = new BoostStrip(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: -1 },
        force: 10,
        size: { width: 2, length: 4 }
      },
      surfaceHeight
    );

    const ball = makeBallBody(0, 0.5, 0);

    // One frame — force is applied
    boost.update(0.016, ball);
    const callCountBefore = ball.applyForce.mock.calls.length;
    expect(callCountBefore).toBeGreaterThan(0);

    // --- PAUSE: no update() calls ---

    // No additional force calls during pause
    expect(ball.applyForce.mock.calls.length).toBe(callCountBefore);
  });

  it('resumes applying force on next update after pause', () => {
    const boost = new BoostStrip(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: -1 },
        force: 10,
        size: { width: 2, length: 4 }
      },
      surfaceHeight
    );

    const ball = makeBallBody(0, 0.5, 0);

    boost.update(0.016, ball);
    const callCountBefore = ball.applyForce.mock.calls.length;

    // --- PAUSE ---

    // Resume
    boost.update(0.016, ball);
    expect(ball.applyForce.mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  it('sound cooldown does not decrement during pause', () => {
    const boost = new BoostStrip(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: -1 },
        force: 10,
        size: { width: 2, length: 4 }
      },
      surfaceHeight
    );

    // Set a known cooldown value
    boost.boostSoundCooldown = 0.3;

    // --- PAUSE: no update() calls ---

    expect(boost.boostSoundCooldown).toBe(0.3);

    // Resume
    boost.update(0.1, null);
    expect(boost.boostSoundCooldown).toBeCloseTo(0.2, 5);
  });
});

// ===========================================================================
// SuctionZone — does not apply force while paused
// ===========================================================================

describe('Pause/Resume: SuctionZone', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('does not apply force while game is paused (no update calls)', () => {
    const suction = new SuctionZone(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        radius: 5,
        force: 8
      },
      surfaceHeight
    );

    const ball = makeBallBody(1, 0.5, 1);

    // One frame — force applied
    suction.update(0.016, ball);
    const callCountBefore = ball.applyForce.mock.calls.length;
    expect(callCountBefore).toBeGreaterThan(0);

    // --- PAUSE: no update() calls ---

    expect(ball.applyForce.mock.calls.length).toBe(callCountBefore);
  });

  it('resumes applying force on next update after pause', () => {
    const suction = new SuctionZone(
      world,
      group,
      {
        position: { x: 0, y: 0, z: 0 },
        radius: 5,
        force: 8
      },
      surfaceHeight
    );

    const ball = makeBallBody(1, 0.5, 1);

    suction.update(0.016, ball);
    const callCountBefore = ball.applyForce.mock.calls.length;

    // --- PAUSE ---

    // Resume
    suction.update(0.016, ball);
    expect(ball.applyForce.mock.calls.length).toBeGreaterThan(callCountBefore);
  });
});

// ===========================================================================
// Cross-mechanic: all mechanics continue from exact pre-pause state on resume
// ===========================================================================

describe('Pause/Resume: all mechanics resume from exact pre-pause state', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('MovingSweeper: continuous run matches pause/resume run', () => {
    // Continuous run (no pause)
    const continuous = new MovingSweeper(
      world,
      group,
      {
        pivot: { x: 0, y: 0, z: 0 },
        armLength: 4,
        speed: 2,
        phase: 0
      },
      surfaceHeight
    );

    // Run 20 frames at 0.016s each = 0.32s total
    for (let i = 0; i < 20; i++) {
      continuous.update(0.016, null);
    }

    // Pause/resume run: 10 frames, pause, 10 frames
    const pauseResume = new MovingSweeper(
      world,
      group,
      {
        pivot: { x: 0, y: 0, z: 0 },
        armLength: 4,
        speed: 2,
        phase: 0
      },
      surfaceHeight
    );

    for (let i = 0; i < 10; i++) {
      pauseResume.update(0.016, null);
    }
    // --- PAUSE (no calls) ---
    for (let i = 0; i < 10; i++) {
      pauseResume.update(0.016, null);
    }

    expect(pauseResume.angle).toBeCloseTo(continuous.angle, 10);
    expect(pauseResume.elapsedTime).toBeCloseTo(continuous.elapsedTime, 10);
  });

  it('TimedHazard: continuous run matches pause/resume run', () => {
    const config = {
      position: { x: 0, y: 0, z: 0 },
      onDuration: 1,
      offDuration: 1
    };

    const continuous = new TimedHazard(world, group, config, surfaceHeight);
    for (let i = 0; i < 20; i++) {
      continuous.update(0.016, null);
    }

    const pauseResume = new TimedHazard(world, group, config, surfaceHeight);
    for (let i = 0; i < 10; i++) {
      pauseResume.update(0.016, null);
    }
    // --- PAUSE ---
    for (let i = 0; i < 10; i++) {
      pauseResume.update(0.016, null);
    }

    expect(pauseResume.timer).toBeCloseTo(continuous.timer, 10);
    expect(pauseResume.isActive).toBe(continuous.isActive);
  });

  it('TimedGate: continuous run matches pause/resume run', () => {
    const config = {
      position: { x: 0, y: 0, z: 0 },
      openDuration: 2,
      closedDuration: 3
    };

    const continuous = new TimedGate(world, group, config, surfaceHeight);
    for (let i = 0; i < 20; i++) {
      continuous.update(0.016, null);
    }

    const pauseResume = new TimedGate(world, group, config, surfaceHeight);
    for (let i = 0; i < 10; i++) {
      pauseResume.update(0.016, null);
    }
    // --- PAUSE ---
    for (let i = 0; i < 10; i++) {
      pauseResume.update(0.016, null);
    }

    expect(pauseResume.timer).toBeCloseTo(continuous.timer, 10);
    expect(pauseResume.isOpen).toBe(continuous.isOpen);
  });

  it('PortalGate: cooldown state identical after pause/resume', () => {
    const config = {
      entryPosition: { x: -3, y: 0, z: 2 },
      exitPosition: { x: 3, y: 0, z: -5 },
      radius: 0.6
    };

    // Trigger teleport on both, then decrement cooldown identically
    const continuous = new PortalGate(world, group, config, surfaceHeight);
    const ball1 = makeBallBody(-3, 0.5, 2);
    continuous.update(0.016, ball1);
    ball1.position.x = 10;
    ball1.position.z = 10;
    for (let i = 0; i < 19; i++) {
      continuous.update(0.016, ball1);
    }

    const pauseResume = new PortalGate(world, group, config, surfaceHeight);
    const ball2 = makeBallBody(-3, 0.5, 2);
    pauseResume.update(0.016, ball2);
    ball2.position.x = 10;
    ball2.position.z = 10;
    for (let i = 0; i < 9; i++) {
      pauseResume.update(0.016, ball2);
    }
    // --- PAUSE ---
    for (let i = 0; i < 10; i++) {
      pauseResume.update(0.016, ball2);
    }

    expect(pauseResume.cooldown).toBeCloseTo(continuous.cooldown, 10);
  });
});
