/**
 * Edge case tests for force field overlap and stacking
 * ISSUE-018
 *
 * Tests behavior when multiple force fields overlap, when a ball transitions
 * between adjacent force fields, and when exiting force fields.
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { SuctionZone } from '../../mechanics/SuctionZone';
import { LowGravityZone } from '../../mechanics/LowGravityZone';
import { BowlContour } from '../../mechanics/BowlContour';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js (same pattern as ForceFields.test.js)
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
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn(), setFromAxisAngle: jest.fn() },
    addShape: jest.fn(),
    userData: {}
  }));

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, roughness: 0.3, metalness: 0.2, dispose: jest.fn() };
    if (opts) {
      Object.assign(mat, opts);
    }
    return mat;
  });

  THREE.CircleGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
  THREE.PlaneGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    step: jest.fn()
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

function makeMockBall(x = 0, z = 0, mass = 0.45) {
  return {
    position: { x, y: 0.2, z },
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    mass,
    sleepState: 0, // AWAKE
    applyForce: jest.fn()
  };
}

const SURFACE_HEIGHT = 0.2;
const SLEEPING = CANNON.Body.SLEEPING;

// ---------------------------------------------------------------------------
// Overlapping force fields — additive force application
// ---------------------------------------------------------------------------

describe('Force field overlap and stacking', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  describe('BoostStrip + LowGravityZone overlap', () => {
    it('ball receives both forces when in overlapping zones', () => {
      const boostConfig = {
        position: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        force: 10,
        size: { width: 4, length: 4 }
      };
      const lowGravConfig = {
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        gravityMultiplier: 0.3
      };

      const boost = new BoostStrip(world, group, boostConfig, SURFACE_HEIGHT);
      const lowGrav = new LowGravityZone(world, group, lowGravConfig, SURFACE_HEIGHT);

      // Place ball at the center of both zones
      const ball = makeMockBall(boost.triggerBody.position.x, boost.triggerBody.position.z);

      boost.update(0.016, ball);
      lowGrav.update(0.016, ball);

      // Ball should have received exactly 2 force applications (one from each)
      expect(ball.applyForce).toHaveBeenCalledTimes(2);

      // First call: BoostStrip directional force (x-direction)
      const boostForce = ball.applyForce.mock.calls[0][0];
      expect(boostForce.x).toBeCloseTo(10);
      expect(boostForce.z).toBeCloseTo(0);

      // Second call: LowGravityZone upward counter-gravity
      const gravForce = ball.applyForce.mock.calls[1][0];
      expect(gravForce.x).toBe(0);
      expect(gravForce.y).toBeGreaterThan(0);
      expect(gravForce.z).toBe(0);
    });

    it('forces are independent — each mechanic applies its own force unchanged', () => {
      const boostConfig = {
        position: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(0, 0, -1),
        force: 15,
        size: { width: 6, length: 6 }
      };
      const lowGravConfig = {
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        gravityMultiplier: 0.5
      };

      const boost = new BoostStrip(world, group, boostConfig, SURFACE_HEIGHT);
      const lowGrav = new LowGravityZone(world, group, lowGravConfig, SURFACE_HEIGHT);

      // Ball in overlap zone
      const ballOverlap = makeMockBall(boost.triggerBody.position.x, boost.triggerBody.position.z);
      boost.update(0.016, ballOverlap);
      lowGrav.update(0.016, ballOverlap);

      // Ball in only boost zone (reference for boost force)
      const ballBoostOnly = makeMockBall(
        boost.triggerBody.position.x,
        boost.triggerBody.position.z
      );
      boost.update(0.016, ballBoostOnly);

      // Ball in only lowGrav zone (reference for gravity force)
      const ballGravOnly = makeMockBall(1, 0);
      lowGrav.update(0.016, ballGravOnly);

      // Boost force should be identical whether or not LowGravityZone is also active
      const overlapBoostForce = ballOverlap.applyForce.mock.calls[0][0];
      const soloBoostForce = ballBoostOnly.applyForce.mock.calls[0][0];
      expect(overlapBoostForce.x).toBeCloseTo(soloBoostForce.x);
      expect(overlapBoostForce.z).toBeCloseTo(soloBoostForce.z);

      // Gravity force should be identical whether or not BoostStrip is also active
      const overlapGravForce = ballOverlap.applyForce.mock.calls[1][0];
      const soloGravForce = ballGravOnly.applyForce.mock.calls[0][0];
      expect(overlapGravForce.y).toBeCloseTo(soloGravForce.y);
    });
  });

  describe('SuctionZone + BowlContour overlap', () => {
    it('ball receives forces from both radial fields additively', () => {
      const suctionConfig = {
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        force: 8
      };
      const bowlConfig = {
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        force: 4
      };

      const suction = new SuctionZone(world, group, suctionConfig, SURFACE_HEIGHT);
      const bowl = new BowlContour(world, group, bowlConfig, SURFACE_HEIGHT);

      const ball = makeMockBall(3, 0);

      suction.update(0.016, ball);
      bowl.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalledTimes(2);

      // Both should apply forces toward center (negative x since ball is at x=3)
      const suctionForce = ball.applyForce.mock.calls[0][0];
      const bowlForce = ball.applyForce.mock.calls[1][0];

      expect(suctionForce.x).toBeLessThan(0);
      expect(bowlForce.x).toBeLessThan(0);
    });
  });

  describe('Three overlapping force fields', () => {
    it('all three forces are applied when ball is in all zones', () => {
      const boostConfig = {
        position: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        force: 5,
        size: { width: 6, length: 6 }
      };
      const suctionConfig = {
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        force: 3
      };
      const lowGravConfig = {
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        gravityMultiplier: 0.2
      };

      const boost = new BoostStrip(world, group, boostConfig, SURFACE_HEIGHT);
      const suction = new SuctionZone(world, group, suctionConfig, SURFACE_HEIGHT);
      const lowGrav = new LowGravityZone(world, group, lowGravConfig, SURFACE_HEIGHT);

      const ball = makeMockBall(2, 0);

      boost.update(0.016, ball);
      suction.update(0.016, ball);
      lowGrav.update(0.016, ball);

      // All three mechanics applied force
      expect(ball.applyForce).toHaveBeenCalledTimes(3);

      // Boost: horizontal force in x direction
      expect(ball.applyForce.mock.calls[0][0].x).toBeCloseTo(5);
      // Suction: radial pull toward center (negative x)
      expect(ball.applyForce.mock.calls[1][0].x).toBeLessThan(0);
      // LowGrav: upward force
      expect(ball.applyForce.mock.calls[2][0].y).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Transitioning between adjacent force fields
// ---------------------------------------------------------------------------

describe('Force field transitions', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  describe('ball moving between adjacent fields', () => {
    it('receives exactly one force when in only one zone at a time', () => {
      // Two BoostStrips side by side with no overlap
      const boostA = new BoostStrip(
        world,
        group,
        {
          position: new THREE.Vector3(-5, 0, 0),
          direction: new THREE.Vector3(1, 0, 0),
          force: 10,
          size: { width: 2, length: 2 }
        },
        SURFACE_HEIGHT
      );

      const boostB = new BoostStrip(
        world,
        group,
        {
          position: new THREE.Vector3(5, 0, 0),
          direction: new THREE.Vector3(0, 0, -1),
          force: 8,
          size: { width: 2, length: 2 }
        },
        SURFACE_HEIGHT
      );

      // Ball in zone A only
      const ball = makeMockBall(boostA.triggerBody.position.x, boostA.triggerBody.position.z);

      boostA.update(0.016, ball);
      boostB.update(0.016, ball);

      // Only zone A should apply force
      expect(ball.applyForce).toHaveBeenCalledTimes(1);
      expect(ball.applyForce.mock.calls[0][0].x).toBeCloseTo(10);
    });

    it('no frame gap when ball transitions between adjacent zones', () => {
      // Two LowGravityZones that are touching/slightly overlapping
      const zoneA = new LowGravityZone(
        world,
        group,
        {
          position: new THREE.Vector3(-3, 0, 0),
          radius: 4,
          gravityMultiplier: 0.3
        },
        SURFACE_HEIGHT
      );

      const zoneB = new LowGravityZone(
        world,
        group,
        {
          position: new THREE.Vector3(3, 0, 0),
          radius: 4,
          gravityMultiplier: 0.5
        },
        SURFACE_HEIGHT
      );

      // Ball at the boundary between the two zones (x=0, within both radii)
      const ball = makeMockBall(0, 0);

      zoneA.update(0.016, ball);
      zoneB.update(0.016, ball);

      // Ball is within radius of both zones (distance 3 < radius 4)
      // so it receives force from both — no gap
      expect(ball.applyForce).toHaveBeenCalledTimes(2);
      expect(ball.applyForce.mock.calls[0][0].y).toBeGreaterThan(0);
      expect(ball.applyForce.mock.calls[1][0].y).toBeGreaterThan(0);
    });

    it('no double-application within a single update cycle', () => {
      // A single force field should only apply force once per update call
      const zone = new SuctionZone(
        world,
        group,
        {
          position: new THREE.Vector3(0, 0, 0),
          radius: 5,
          force: 10
        },
        SURFACE_HEIGHT
      );

      const ball = makeMockBall(2, 0);

      zone.update(0.016, ball);

      // Exactly one force application per update call
      expect(ball.applyForce).toHaveBeenCalledTimes(1);

      // Second update also applies exactly one more force
      zone.update(0.016, ball);
      expect(ball.applyForce).toHaveBeenCalledTimes(2);
    });
  });
});

// ---------------------------------------------------------------------------
// Exiting force fields — force stops immediately
// ---------------------------------------------------------------------------

describe('Force field exit behavior', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  describe('BoostStrip exit', () => {
    it('stops applying force immediately when ball leaves zone', () => {
      const strip = new BoostStrip(
        world,
        group,
        {
          position: new THREE.Vector3(0, 0, 0),
          direction: new THREE.Vector3(1, 0, 0),
          force: 10,
          size: { width: 2, length: 2 }
        },
        SURFACE_HEIGHT
      );

      // Frame 1: ball inside zone
      const ball = makeMockBall(strip.triggerBody.position.x, strip.triggerBody.position.z);
      strip.update(0.016, ball);
      expect(ball.applyForce).toHaveBeenCalledTimes(1);

      // Frame 2: ball moves outside zone
      ball.position.x = 100;
      ball.position.z = 100;
      strip.update(0.016, ball);

      // No additional force applied — still just the 1 call from frame 1
      expect(ball.applyForce).toHaveBeenCalledTimes(1);
    });
  });

  describe('SuctionZone exit', () => {
    it('stops applying force immediately when ball leaves zone', () => {
      const zone = new SuctionZone(
        world,
        group,
        {
          position: new THREE.Vector3(0, 0, 0),
          radius: 5,
          force: 10
        },
        SURFACE_HEIGHT
      );

      const ball = makeMockBall(3, 0);

      // Frame 1: inside
      zone.update(0.016, ball);
      expect(ball.applyForce).toHaveBeenCalledTimes(1);

      // Frame 2: outside
      ball.position.x = 20;
      zone.update(0.016, ball);
      expect(ball.applyForce).toHaveBeenCalledTimes(1);
    });
  });

  describe('LowGravityZone exit', () => {
    it('stops applying counter-gravity immediately when ball leaves zone', () => {
      const zone = new LowGravityZone(
        world,
        group,
        {
          position: new THREE.Vector3(0, 0, 0),
          radius: 3,
          gravityMultiplier: 0.3
        },
        SURFACE_HEIGHT
      );

      const ball = makeMockBall(1, 0);

      // Frame 1: inside
      zone.update(0.016, ball);
      expect(ball.applyForce).toHaveBeenCalledTimes(1);
      expect(ball.applyForce.mock.calls[0][0].y).toBeGreaterThan(0);

      // Frame 2: outside
      ball.position.x = 10;
      zone.update(0.016, ball);

      // No lingering upward force — still 1 call total
      expect(ball.applyForce).toHaveBeenCalledTimes(1);
    });
  });

  describe('BowlContour exit', () => {
    it('stops applying force immediately when ball leaves zone', () => {
      const bowl = new BowlContour(
        world,
        group,
        {
          position: new THREE.Vector3(0, 0, 0),
          radius: 4,
          force: 5
        },
        SURFACE_HEIGHT
      );

      const ball = makeMockBall(2, 0);

      // Frame 1: inside
      bowl.update(0.016, ball);
      expect(ball.applyForce).toHaveBeenCalledTimes(1);

      // Frame 2: outside
      ball.position.x = 20;
      bowl.update(0.016, ball);
      expect(ball.applyForce).toHaveBeenCalledTimes(1);
    });
  });

  describe('no lingering state after exit', () => {
    it('force field has no persistent effect after ball leaves and re-enters', () => {
      const zone = new LowGravityZone(
        world,
        group,
        {
          position: new THREE.Vector3(0, 0, 0),
          radius: 5,
          gravityMultiplier: 0.3
        },
        SURFACE_HEIGHT
      );

      // Enter
      const ball = makeMockBall(1, 0);
      zone.update(0.016, ball);
      const firstForce = ball.applyForce.mock.calls[0][0].y;

      // Exit
      ball.position.x = 100;
      zone.update(0.016, ball);

      // Re-enter at same position
      ball.position.x = 1;
      zone.update(0.016, ball);
      const reenterForce = ball.applyForce.mock.calls[1][0].y;

      // Force on re-entry should be identical to first entry
      expect(reenterForce).toBeCloseTo(firstForce);
    });
  });
});

// ---------------------------------------------------------------------------
// Visual mesh independence
// ---------------------------------------------------------------------------

describe('Force field visual mesh independence', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('overlapping force fields create separate visual meshes', () => {
    const boost = new BoostStrip(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        force: 10,
        size: { width: 4, length: 4 }
      },
      SURFACE_HEIGHT
    );

    const lowGrav = new LowGravityZone(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        gravityMultiplier: 0.3
      },
      SURFACE_HEIGHT
    );

    const suction = new SuctionZone(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        radius: 4,
        force: 6
      },
      SURFACE_HEIGHT
    );

    // Each mechanic has its own independent mesh
    expect(boost.meshes).toHaveLength(1);
    expect(lowGrav.meshes).toHaveLength(1);
    expect(suction.meshes).toHaveLength(1);

    // All meshes were added to the group
    expect(group.add).toHaveBeenCalledTimes(3);

    // Meshes are distinct objects
    expect(boost.mesh).not.toBe(lowGrav.mesh);
    expect(boost.mesh).not.toBe(suction.mesh);
    expect(lowGrav.mesh).not.toBe(suction.mesh);
  });

  it('destroying one field does not affect another overlapping field', () => {
    const boost = new BoostStrip(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        force: 10,
        size: { width: 4, length: 4 }
      },
      SURFACE_HEIGHT
    );

    const lowGrav = new LowGravityZone(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        gravityMultiplier: 0.3
      },
      SURFACE_HEIGHT
    );

    // Destroy boost — lowGrav should still work
    boost.destroy();
    expect(boost.meshes).toHaveLength(0);
    expect(lowGrav.meshes).toHaveLength(1);

    // LowGrav still applies force
    const ball = makeMockBall(1, 0);
    lowGrav.update(0.016, ball);
    expect(ball.applyForce).toHaveBeenCalledTimes(1);
    expect(ball.applyForce.mock.calls[0][0].y).toBeGreaterThan(0);
  });
});
