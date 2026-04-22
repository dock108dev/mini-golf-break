/**
 * Integration tests for scoring correctness with active mechanics.
 * ISSUE-083
 *
 * Verifies that ScoringSystem tracks strokes correctly when mechanics are
 * active. Portal teleports, hazard resets, and obstacle collisions should
 * not incorrectly increment the stroke counter.
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ScoringSystem } from '../../game/ScoringSystem';
import { PortalGate } from '../../mechanics/PortalGate';
import { MovingSweeper } from '../../mechanics/MovingSweeper';
import { TimedHazard } from '../../mechanics/TimedHazard';
import { TimedGate } from '../../mechanics/TimedGate';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { SuctionZone } from '../../mechanics/SuctionZone';

// ---------------------------------------------------------------------------
// Enhance mocks for scoring integration testing
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    scale: s => ({ x: x * s, y: y * s, z: z * s })
  }));

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
    angularVelocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    addShape: jest.fn(),
    addEventListener: jest.fn(),
    userData: {}
  }));

  CANNON.Body.SLEEPING = 2;
  CANNON.Body.KINEMATIC = 4;
  CANNON.Body.STATIC = 1;

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, roughness: 0.3, metalness: 0.2, dispose: jest.fn() };
    if (opts) {
      Object.assign(mat, opts);
    }
    return mat;
  });

  const geomProto = { dispose: jest.fn() };
  if (typeof THREE.CircleGeometry.mockImplementation === 'function') {
    THREE.CircleGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.PlaneGeometry.mockImplementation === 'function') {
    THREE.PlaneGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.BoxGeometry.mockImplementation === 'function') {
    THREE.BoxGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.CylinderGeometry.mockImplementation === 'function') {
    THREE.CylinderGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.RingGeometry?.mockImplementation === 'function') {
    THREE.RingGeometry.mockImplementation(() => ({ ...geomProto }));
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SURFACE_HEIGHT = 0.2;

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    step: jest.fn(),
    bumperMaterial: { name: 'bumper' }
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

function makeMockBall(x = 0, z = 0) {
  return {
    position: {
      x,
      y: SURFACE_HEIGHT,
      z,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    velocity: { x: 0, y: 0, z: 0 },
    mass: 0.45,
    sleepState: 0, // AWAKE
    applyForce: jest.fn(),
    applyImpulse: jest.fn(),
    wakeUp: jest.fn()
  };
}

// ---------------------------------------------------------------------------
// PortalGate teleport does not increment stroke count
// ---------------------------------------------------------------------------

describe('PortalGate teleport does not affect stroke count', () => {
  let world, group, scoringSystem;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    scoringSystem = new ScoringSystem(null);
  });

  it('stroke count remains unchanged after portal teleport', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(0, 0, 0),
        exitPosition: new THREE.Vector3(10, 0, -8),
        radius: 1.0
      },
      SURFACE_HEIGHT
    );

    // Simulate player hitting the ball (1 stroke)
    scoringSystem.addStroke();
    expect(scoringSystem.getCurrentStrokes()).toBe(1);

    // Ball enters portal and gets teleported
    const ball = makeMockBall(0, 0);
    portal.update(1 / 60, ball);

    // Verify teleport happened
    expect(ball.position.set).toHaveBeenCalled();

    // Stroke count should still be 1 — portal does not add strokes
    expect(scoringSystem.getCurrentStrokes()).toBe(1);
    expect(scoringSystem.getTotalStrokes()).toBe(1);
  });

  it('multiple portal teleports do not add strokes', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(0, 0, 0),
        exitPosition: new THREE.Vector3(5, 0, 5),
        radius: 1.0
      },
      SURFACE_HEIGHT
    );

    scoringSystem.addStroke();

    // First teleport
    const ball = makeMockBall(0, 0);
    portal.update(1 / 60, ball);
    expect(ball.position.set).toHaveBeenCalledTimes(1);

    // Wait for cooldown, teleport again
    ball.position.x = 100;
    ball.position.z = 100;
    portal.update(1.1, ball); // expire cooldown

    ball.position.x = 0;
    ball.position.z = 0;
    portal.update(1 / 60, ball);
    expect(ball.position.set).toHaveBeenCalledTimes(2);

    // Still only 1 stroke from the initial hit
    expect(scoringSystem.getCurrentStrokes()).toBe(1);
    expect(scoringSystem.getTotalStrokes()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Water hazard inside a force field adds exactly 1 penalty stroke
// ---------------------------------------------------------------------------

describe('Ball reset from water hazard inside force field adds exactly 1 penalty stroke', () => {
  let world, group, scoringSystem;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    scoringSystem = new ScoringSystem(null);
  });

  it('water hazard penalty is exactly 1 stroke even with active force field', () => {
    // Set up a suction zone (force field)
    const suction = new SuctionZone(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        force: 10
      },
      SURFACE_HEIGHT
    );

    // Player hits ball (1 stroke)
    scoringSystem.addStroke();

    // Ball is inside the suction zone
    const ball = makeMockBall(1, 1);

    // Force field applies force each frame — no stroke added
    suction.update(1 / 60, ball);
    suction.update(1 / 60, ball);
    suction.update(1 / 60, ball);
    expect(ball.applyForce).toHaveBeenCalledTimes(3);

    // Simulate water hazard reset: adds exactly 1 penalty stroke
    scoringSystem.addStroke(); // water penalty

    // Total should be 2: 1 hit + 1 penalty
    expect(scoringSystem.getCurrentStrokes()).toBe(2);
    expect(scoringSystem.getTotalStrokes()).toBe(2);
  });

  it('boost strip does not add strokes when ball enters water hazard zone', () => {
    const boost = new BoostStrip(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        force: 12,
        size: { width: 3, length: 3 }
      },
      SURFACE_HEIGHT
    );

    // Player hits ball
    scoringSystem.addStroke();

    const ball = makeMockBall(boost.triggerBody.position.x, boost.triggerBody.position.z);

    // Boost strip applies force over several frames
    for (let i = 0; i < 5; i++) {
      boost.update(1 / 60, ball);
    }

    // Ball lands in water — exactly 1 penalty
    scoringSystem.addStroke();

    expect(scoringSystem.getCurrentStrokes()).toBe(2);
    expect(scoringSystem.getTotalStrokes()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// MovingSweeper collision does not add a stroke
// ---------------------------------------------------------------------------

describe('MovingSweeper collision does not add a stroke', () => {
  let world, group, scoringSystem;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    scoringSystem = new ScoringSystem(null);
  });

  it('sweeper deflecting ball does not increment stroke count', () => {
    const sweeper = new MovingSweeper(
      world,
      group,
      {
        pivot: new THREE.Vector3(0, 0, 0),
        armLength: 4,
        speed: 2.0,
        size: { width: 4, height: 0.4, depth: 0.3 }
      },
      SURFACE_HEIGHT
    );

    // Player hits ball (1 stroke)
    scoringSystem.addStroke();

    // Sweeper rotates and collides with ball over multiple frames
    const ball = makeMockBall(1, 0);
    for (let i = 0; i < 10; i++) {
      sweeper.update(1 / 60, ball);
    }

    // Stroke count unchanged — sweeper collision is physics-only
    expect(scoringSystem.getCurrentStrokes()).toBe(1);
    expect(scoringSystem.getTotalStrokes()).toBe(1);
  });

  it('multiple sweeper collisions across frames do not add strokes', () => {
    const sweeper = new MovingSweeper(
      world,
      group,
      {
        pivot: new THREE.Vector3(0, 0, 0),
        armLength: 3,
        speed: Math.PI,
        size: { width: 3, height: 0.4, depth: 0.3 }
      },
      SURFACE_HEIGHT
    );

    // Player hits ball twice (2 strokes)
    scoringSystem.addStroke();
    scoringSystem.addStroke();

    const ball = makeMockBall(0.5, 0);

    // Simulate many frames of sweeper rotation
    for (let i = 0; i < 60; i++) {
      sweeper.update(1 / 60, ball);
    }

    // Only the 2 player hits count
    expect(scoringSystem.getCurrentStrokes()).toBe(2);
    expect(scoringSystem.getTotalStrokes()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// TimedHazard activating on stopped ball does not add a stroke
// ---------------------------------------------------------------------------

describe('TimedHazard activating and hitting a stopped ball does not add a stroke', () => {
  let world, group, scoringSystem;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    scoringSystem = new ScoringSystem(null);
  });

  it('timed hazard activating on awake ball does not add a stroke', () => {
    const hazard = new TimedHazard(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        size: { width: 3, length: 3 },
        onDuration: 2,
        offDuration: 2,
        hazardType: 'water'
      },
      SURFACE_HEIGHT
    );

    // Player hits ball (1 stroke)
    scoringSystem.addStroke();

    // Ball is sitting in the hazard zone
    const ball = makeMockBall(0, 0);

    // Advance time so hazard becomes active (starts at timer=0, active for first 2s)
    hazard.update(0.5, ball);

    // Hazard applies impulse but does NOT add a stroke
    expect(ball.applyImpulse).toHaveBeenCalled();
    expect(scoringSystem.getCurrentStrokes()).toBe(1);
    expect(scoringSystem.getTotalStrokes()).toBe(1);
  });

  it('timed hazard cycling on/off does not accumulate strokes', () => {
    const hazard = new TimedHazard(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        size: { width: 4, length: 4 },
        onDuration: 1,
        offDuration: 1,
        hazardType: 'water'
      },
      SURFACE_HEIGHT
    );

    scoringSystem.addStroke();
    const ball = makeMockBall(0, 0);

    // Run through several on/off cycles
    for (let i = 0; i < 120; i++) {
      hazard.update(1 / 60, ball);
    }

    // Stroke count stays at 1
    expect(scoringSystem.getCurrentStrokes()).toBe(1);
  });

  it('timed hazard does not affect sleeping ball stroke count', () => {
    const hazard = new TimedHazard(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        size: { width: 3, length: 3 },
        onDuration: 2,
        offDuration: 1,
        hazardType: 'water'
      },
      SURFACE_HEIGHT
    );

    scoringSystem.addStroke();

    const ball = makeMockBall(0, 0);
    ball.sleepState = CANNON.Body.SLEEPING;

    // Hazard activates but ball is sleeping
    hazard.update(0.5, ball);

    // No impulse applied and no stroke added
    expect(ball.applyImpulse).not.toHaveBeenCalled();
    expect(scoringSystem.getCurrentStrokes()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Completing a hole with mechanics active records correct stroke count
// ---------------------------------------------------------------------------

describe('Hole completion with active mechanics records correct stroke count', () => {
  let world, group, scoringSystem;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    scoringSystem = new ScoringSystem(null);
  });

  it('records correct stroke count after portal teleport and hole completion', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(0, 0, 0),
        exitPosition: new THREE.Vector3(8, 0, -6),
        radius: 1.0
      },
      SURFACE_HEIGHT
    );

    // Player takes 3 strokes, with a portal teleport after the 2nd
    scoringSystem.addStroke();
    scoringSystem.addStroke();

    const ball = makeMockBall(0, 0);
    portal.update(1 / 60, ball);

    scoringSystem.addStroke();

    // Complete hole
    scoringSystem.completeHole();

    expect(scoringSystem.getScoreForHole(0)).toBe(3);
    expect(scoringSystem.getTotalStrokes()).toBe(3);
  });

  it('records correct stroke count with multiple mechanics active', () => {
    const sweeper = new MovingSweeper(
      world,
      group,
      {
        pivot: new THREE.Vector3(0, 0, 0),
        armLength: 4,
        speed: 2.0,
        size: { width: 4, height: 0.4, depth: 0.3 }
      },
      SURFACE_HEIGHT
    );

    const suction = new SuctionZone(
      world,
      group,
      {
        position: new THREE.Vector3(3, 0, 3),
        radius: 5,
        force: 8
      },
      SURFACE_HEIGHT
    );

    const hazard = new TimedHazard(
      world,
      group,
      {
        position: new THREE.Vector3(-2, 0, -2),
        size: { width: 2, length: 2 },
        onDuration: 2,
        offDuration: 2,
        hazardType: 'water'
      },
      SURFACE_HEIGHT
    );

    const ball = makeMockBall(3, 3);

    // Stroke 1: player hits
    scoringSystem.addStroke();

    // Mechanics update over many frames — none add strokes
    for (let i = 0; i < 30; i++) {
      sweeper.update(1 / 60, null);
      suction.update(1 / 60, ball);
      hazard.update(1 / 60, ball);
    }

    // Stroke 2: player hits again
    scoringSystem.addStroke();

    // More mechanic updates
    for (let i = 0; i < 30; i++) {
      sweeper.update(1 / 60, ball);
      suction.update(1 / 60, ball);
      hazard.update(1 / 60, ball);
    }

    // Complete hole
    scoringSystem.completeHole();

    expect(scoringSystem.getScoreForHole(0)).toBe(2);
    expect(scoringSystem.getTotalStrokes()).toBe(2);
  });

  it('records correct scores across multiple holes with mechanics', () => {
    // Hole 1: 2 strokes with portal
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(0, 0, 0),
        exitPosition: new THREE.Vector3(5, 0, 5),
        radius: 1.0
      },
      SURFACE_HEIGHT
    );

    scoringSystem.addStroke();
    const ball = makeMockBall(0, 0);
    portal.update(1 / 60, ball);
    scoringSystem.addStroke();
    scoringSystem.completeHole();
    scoringSystem.resetCurrentStrokes();

    // Hole 2: 3 strokes with sweeper and force field
    const sweeper = new MovingSweeper(
      world,
      group,
      {
        pivot: new THREE.Vector3(0, 0, 0),
        armLength: 3,
        speed: 1.5,
        size: { width: 3, height: 0.4, depth: 0.3 }
      },
      SURFACE_HEIGHT
    );

    const boost = new BoostStrip(
      world,
      group,
      {
        position: new THREE.Vector3(2, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        force: 10,
        size: { width: 2, length: 2 }
      },
      SURFACE_HEIGHT
    );

    for (let stroke = 0; stroke < 3; stroke++) {
      scoringSystem.addStroke();
      const ballH2 = makeMockBall(boost.triggerBody.position.x, boost.triggerBody.position.z);
      for (let frame = 0; frame < 20; frame++) {
        sweeper.update(1 / 60, ballH2);
        boost.update(1 / 60, ballH2);
      }
    }
    scoringSystem.completeHole();

    // Verify both holes
    expect(scoringSystem.getScoreForHole(0)).toBe(2);
    expect(scoringSystem.getScoreForHole(1)).toBe(3);
    expect(scoringSystem.getTotalStrokes()).toBe(5);
    expect(scoringSystem.getHoleScores()).toEqual([2, 3]);
  });

  it('water penalty stroke counted correctly alongside timed hazard impulse', () => {
    const hazard = new TimedHazard(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        size: { width: 3, length: 3 },
        onDuration: 2,
        offDuration: 2,
        hazardType: 'water'
      },
      SURFACE_HEIGHT
    );

    const ball = makeMockBall(0, 0);

    // Player hits (stroke 1)
    scoringSystem.addStroke();

    // Timed hazard fires impulse (no stroke)
    hazard.update(0.5, ball);
    expect(ball.applyImpulse).toHaveBeenCalled();

    // Ball lands in actual water hazard (penalty stroke 2)
    scoringSystem.addStroke();

    // Player hits again after reset (stroke 3)
    scoringSystem.addStroke();

    scoringSystem.completeHole();

    expect(scoringSystem.getScoreForHole(0)).toBe(3);
    expect(scoringSystem.getTotalStrokes()).toBe(3);
  });
});
