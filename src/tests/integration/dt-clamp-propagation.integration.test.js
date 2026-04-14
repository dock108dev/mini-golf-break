/**
 * Integration test for dt clamp propagation to mechanics
 * ISSUE-120
 *
 * Verifies that dt clamping in GameLoopManager correctly propagates through
 * HoleEntity to all mechanic types, and that timed mechanics handle the
 * clamped dt without state skipping or visual jumps.
 */

// Mock Three.js
jest.mock('three', () => {
  const mockVector3 = jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.clone = jest.fn(() => new mockVector3(this.x, this.y, this.z));
    this.copy = jest.fn(function (other) {
      if (other) {
        this.x = other.x || 0;
        this.y = other.y || 0;
        this.z = other.z || 0;
      }
      return this;
    });
    this.set = jest.fn(function (x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    });
    this.setY = jest.fn(function (v) {
      this.y = v;
      return this;
    });
    this.normalize = jest.fn(() => this);
    this.multiplyScalar = jest.fn(() => this);
    this.subVectors = jest.fn(() => this);
    this.addVectors = jest.fn(() => this);
    this.toArray = jest.fn(() => [this.x, this.y, this.z]);
    this.distanceTo = jest.fn(() => 5);
  });

  const mockVector2 = jest.fn(function (x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.clone = jest.fn(() => new mockVector2(this.x, this.y));
    this.subVectors = jest.fn((a, b) => {
      this.x = a.x - b.x;
      this.y = a.y - b.y;
      return this;
    });
    this.length = jest.fn(() => Math.sqrt(this.x * this.x + this.y * this.y));
    this.normalize = jest.fn(() => this);
    this.multiplyScalar = jest.fn(s => {
      this.x *= s;
      this.y *= s;
      return this;
    });
    this.addVectors = jest.fn((a, b) => {
      this.x = a.x + b.x;
      this.y = a.y + b.y;
      return this;
    });
  });

  const mockBox2 = jest.fn(function () {
    this.min = { x: -5, y: -5 };
    this.max = { x: 5, y: 5 };
    this.setFromPoints = jest.fn();
    this.getCenter = jest.fn(target => {
      target.x = 0;
      target.y = 0;
    });
    this.getSize = jest.fn(target => {
      target.x = 10;
      target.y = 10;
    });
  });

  const mockGeometry = () => ({
    dispose: jest.fn(),
    rotateX: jest.fn(),
    translate: jest.fn(),
    attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]) } },
    index: { array: new Uint16Array([0, 1, 2, 2, 3, 0]) }
  });

  const mockMaterial = jest.fn(() => ({ dispose: jest.fn(), color: 0xffffff }));

  const mockMesh = jest.fn(function () {
    this.position = {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }),
      copy: jest.fn()
    };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.geometry = { dispose: jest.fn() };
    this.material = { dispose: jest.fn() };
    this.parent = null;
    this.updateMatrix = jest.fn();
    this.visible = true;
    this.castShadow = false;
    this.name = '';
  });

  const mockGroup = jest.fn(function () {
    this.position = {
      x: 0,
      y: 0,
      z: 0,
      copy: jest.fn(function (other) {
        if (other) {
          this.x = other.x || 0;
          this.y = other.y || 0;
          this.z = other.z || 0;
        }
      }),
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    };
    this.parent = null;
    this.add = jest.fn();
    this.remove = jest.fn();
    this.children = [];
    this.name = '';
    this.userData = {};
  });

  return {
    Vector3: mockVector3,
    Vector2: mockVector2,
    Box2: mockBox2,
    DoubleSide: 2,
    Shape: jest.fn(function () {
      this.holes = [];
    }),
    ExtrudeGeometry: jest.fn(function () {
      this.dispose = jest.fn();
      this.rotateX = jest.fn();
      this.translate = jest.fn();
    }),
    MeshStandardMaterial: mockMaterial,
    MeshPhongMaterial: mockMaterial,
    MeshBasicMaterial: mockMaterial,
    BufferGeometry: jest.fn(function () {
      this.setFromPoints = jest.fn().mockReturnValue(this);
      this.setAttribute = jest.fn();
      this.dispose = jest.fn();
    }),
    LineBasicMaterial: jest.fn(function () {
      this.color = 0xffffff;
      this.dispose = jest.fn();
    }),
    Line: jest.fn(function (geometry, material) {
      this.geometry = geometry || { dispose: jest.fn() };
      this.material = material || { dispose: jest.fn() };
      this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    }),
    Mesh: mockMesh,
    Group: mockGroup,
    CylinderGeometry: jest.fn(mockGeometry),
    PlaneGeometry: jest.fn(mockGeometry),
    CircleGeometry: jest.fn(mockGeometry),
    BoxGeometry: jest.fn(mockGeometry),
    RingGeometry: jest.fn(mockGeometry),
    SphereGeometry: jest.fn(mockGeometry),
    Path: jest.fn(function () {
      return {};
    })
  };
});

// Mock cannon-es
jest.mock('cannon-es', () => {
  const mockBody = jest.fn(function (opts) {
    this.position = {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1, set: jest.fn(), copy: jest.fn() };
    this.velocity = {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    };
    this.force = { x: 0, y: 0, z: 0 };
    this.material = opts?.material || null;
    this.type = opts?.type || 'STATIC';
    this.mass = opts?.mass || 0;
    this.addShape = jest.fn();
    this.addEventListener = jest.fn();
    this.userData = {};
    this.sleepState = 0;
    this.applyForce = jest.fn();
    this.applyImpulse = jest.fn();
    this.wakeUp = jest.fn();
  });
  mockBody.STATIC = 'STATIC';
  mockBody.KINEMATIC = 'KINEMATIC';
  mockBody.SLEEPING = 2;

  return {
    Box: jest.fn(() => ({ material: null })),
    Body: mockBody,
    Material: jest.fn(),
    ContactMaterial: jest.fn(),
    Vec3: jest.fn(function (x, y, z) {
      this.x = x || 0;
      this.y = y || 0;
      this.z = z || 0;
      this.scale = jest.fn(
        s => new (jest.requireMock('cannon-es').Vec3)(this.x * s, this.y * s, this.z * s)
      );
    }),
    Cylinder: jest.fn(),
    Trimesh: jest.fn(),
    Sphere: jest.fn(),
    Quaternion: jest.fn(function () {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.w = 1;
      this.setFromAxisAngle = jest.fn(() => this);
      this.copy = jest.fn();
    }),
    BODY_TYPES: { STATIC: 'STATIC', KINEMATIC: 'KINEMATIC' }
  };
});

// Mock three-csg-ts
jest.mock('three-csg-ts', () => ({
  CSG: {
    fromMesh: jest.fn(() => ({
      subtract: jest.fn(() => ({
        toMesh: jest.fn(() => ({
          position: { set: jest.fn() },
          geometry: { dispose: jest.fn() },
          material: { dispose: jest.fn() }
        }))
      }))
    })),
    subtract: jest.fn(() => ({
      position: { set: jest.fn() },
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    }))
  }
}));

// Mock HazardFactory and HeroPropFactory
jest.mock('../../objects/hazards/HazardFactory', () => ({
  createHazard: jest.fn(() => ({
    mesh: {
      position: { set: jest.fn() },
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    },
    body: { position: { set: jest.fn() } },
    destroy: jest.fn()
  }))
}));

jest.mock('../../objects/HeroPropFactory', () => ({
  createHeroProp: jest.fn(() => [])
}));

import { HoleEntity } from '../../objects/HoleEntity';
import { MAX_DELTA_TIME } from '../../managers/GameLoopManager';
import { TimedHazard } from '../../mechanics/TimedHazard';
import { TimedGate } from '../../mechanics/TimedGate';
import { MovingSweeper } from '../../mechanics/MovingSweeper';
import { PortalGate } from '../../mechanics/PortalGate';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { SuctionZone } from '../../mechanics/SuctionZone';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SURFACE_HEIGHT = 0.2;

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    addContactMaterial: jest.fn(),
    step: jest.fn(),
    groundMaterial: { name: 'ground' },
    bumperMaterial: { name: 'bumper' },
    bodies: []
  };
}

function makeMockScene() {
  return { add: jest.fn(), remove: jest.fn(), children: [] };
}

function makeMinimalHoleConfig(overrides = {}) {
  const THREE = require('three');
  return {
    index: 0,
    startPosition: new THREE.Vector3(0, 0, -5),
    holePosition: new THREE.Vector3(0, 0, 5),
    boundaryShape: [
      { x: -5, y: -10 },
      { x: -5, y: 10 },
      { x: 5, y: 10 },
      { x: 5, y: -10 }
    ],
    ...overrides
  };
}

function makeMockBallBody(x = 0, z = 0) {
  return {
    position: {
      x,
      y: SURFACE_HEIGHT + 0.1,
      z,
      set: jest.fn(function (px, py, pz) {
        this.x = px;
        this.y = py;
        this.z = pz;
      })
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (vx, vy, vz) {
        this.x = vx;
        this.y = vy;
        this.z = vz;
      })
    },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    force: { x: 0, y: 0, z: 0 },
    applyForce: jest.fn(),
    applyImpulse: jest.fn(),
    wakeUp: jest.fn(),
    sleepState: 0
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dt clamp propagation to mechanics (integration)', () => {
  describe('GameLoopManager passes clamped dt (max 1/30s) to HoleEntity.update()', () => {
    it('HoleEntity receives MAX_DELTA_TIME when a large dt gap occurs', async () => {
      const world = makeMockWorld();
      const scene = makeMockScene();
      const THREE = require('three');

      // Create a HoleEntity with a test mechanic that records received dt
      const receivedDts = [];
      const config = makeMinimalHoleConfig({ mechanics: [] });
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Manually add a spy mechanic to the mechanics array
      hole.mechanics.push({
        _failed: false,
        onDtSpike: jest.fn(),
        update: jest.fn(dt => {
          receivedDts.push(dt);
        }),
        config: { type: 'test_spy' }
      });

      // Simulate what GameLoopManager does: clamp dt and pass to HoleEntity
      const rawDt = 5.0; // 5 seconds — way beyond MAX_DELTA_TIME
      const clampedDt = Math.min(rawDt, MAX_DELTA_TIME);
      const dtWasClamped = rawDt > MAX_DELTA_TIME;

      hole.update(clampedDt, makeMockBallBody(), { dtWasClamped });

      expect(clampedDt).toBeCloseTo(MAX_DELTA_TIME, 6);
      expect(receivedDts).toHaveLength(1);
      expect(receivedDts[0]).toBeCloseTo(MAX_DELTA_TIME, 6);
    });

    it('MAX_DELTA_TIME is exactly 1/30', () => {
      expect(MAX_DELTA_TIME).toBeCloseTo(1 / 30, 6);
    });
  });

  describe('TimedHazard: clamped dt after 5s gap does not skip through multiple on/off cycles', () => {
    it('resets to initial state (timer=0, inactive) on dt spike instead of jumping ahead', () => {
      const world = makeMockWorld();
      const THREE = require('three');
      const group = new THREE.Group();

      const config = {
        type: 'timed_hazard',
        position: new THREE.Vector3(0, 0, 0),
        size: { width: 2, length: 2 },
        onDuration: 1.0,
        offDuration: 1.0,
        hazardType: 'water'
      };

      const hazard = new TimedHazard(world, group, config, SURFACE_HEIGHT);
      const ball = makeMockBallBody();

      // Advance to a known state: 0.5s into on-phase
      for (let i = 0; i < 30; i++) {
        hazard.update(1 / 60, ball);
      }
      expect(hazard.isActive).toBe(true);
      expect(hazard.timer).toBeCloseTo(0.5, 1);

      // Simulate dt spike: onDtSpike resets, then update with clamped dt
      hazard.onDtSpike();
      expect(hazard.timer).toBe(0);
      expect(hazard.isActive).toBe(false);

      // After spike, update with clamped dt (1/30 ≈ 0.033s)
      hazard.update(MAX_DELTA_TIME, ball);

      // Timer should only be ~0.033s, not 5+ seconds
      expect(hazard.timer).toBeCloseTo(MAX_DELTA_TIME, 4);
      // With onDuration=1s, 0.033s into cycle is still in on-phase
      expect(hazard.isActive).toBe(true);
      // The key: timer did NOT skip through multiple 2s cycles
      expect(hazard.timer).toBeLessThan(1.0);
    });

    it('without onDtSpike, a raw 5s dt would cause multiple cycle skips', () => {
      const world = makeMockWorld();
      const THREE = require('three');
      const group = new THREE.Group();

      const config = {
        type: 'timed_hazard',
        position: new THREE.Vector3(0, 0, 0),
        size: { width: 2, length: 2 },
        onDuration: 1.0,
        offDuration: 1.0,
        hazardType: 'water'
      };

      const hazard = new TimedHazard(world, group, config, SURFACE_HEIGHT);

      // Without clamping, passing 5s of dt would jump to timer=5.0
      // That is 5.0 % 2.0 = 1.0, which is right at the on/off boundary
      hazard.update(5.0, null);
      // Timer advanced by 5 full seconds, skipping multiple cycles
      expect(hazard.timer).toBeCloseTo(5.0, 4);
    });
  });

  describe('TimedGate: clamped dt after 5s gap does not skip through multiple open/close cycles', () => {
    it('resets to closed state on dt spike instead of jumping ahead', () => {
      const world = makeMockWorld();
      const THREE = require('three');
      const group = new THREE.Group();

      const config = {
        type: 'timed_gate',
        position: new THREE.Vector3(0, 0, 0),
        size: { width: 2, height: 1, depth: 0.2 },
        openDuration: 1.5,
        closedDuration: 2.0
      };

      const gate = new TimedGate(world, group, config, SURFACE_HEIGHT);

      // Advance to open state: past openDuration threshold
      // openDuration=1.5 means first 1.5s is "open", next 2s is "closed"
      for (let i = 0; i < 30; i++) {
        gate.update(1 / 60, null); // ~0.5s total
      }
      expect(gate.isOpen).toBe(true);
      expect(gate.timer).toBeCloseTo(0.5, 1);

      // Simulate dt spike
      gate.onDtSpike();
      expect(gate.timer).toBe(0);
      expect(gate.isOpen).toBe(false);

      // After spike, update with clamped dt
      gate.update(MAX_DELTA_TIME, null);

      // Timer should only be ~0.033s
      expect(gate.timer).toBeCloseTo(MAX_DELTA_TIME, 4);
      // 0.033s into cycle with openDuration=1.5 → should be open
      expect(gate.isOpen).toBe(true);
      // Timer did NOT skip through multiple 3.5s cycles
      expect(gate.timer).toBeLessThan(1.0);
    });
  });

  describe('MovingSweeper: angle after clamped dt is within one frame rotation of pre-pause angle', () => {
    it('continues from current angle after dt spike without a large jump', () => {
      const world = makeMockWorld();
      const THREE = require('three');
      const group = new THREE.Group();

      const speed = 2.0; // rad/s
      const config = {
        type: 'moving_sweeper',
        pivot: new THREE.Vector3(0, 0, 0),
        armLength: 3,
        speed,
        size: { width: 3, height: 0.4, depth: 0.3 }
      };

      const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

      // Run for 60 frames at 60fps (1 second) to establish a known angle
      for (let i = 0; i < 60; i++) {
        sweeper.update(1 / 60, null);
      }
      const angleBeforePause = sweeper.angle;
      // After 1s at speed=2.0, angle should be ~2.0 radians
      expect(angleBeforePause).toBeCloseTo(2.0, 1);

      // Simulate dt spike: onDtSpike recalculates elapsedTime from current angle
      sweeper.onDtSpike();

      // After spike, update with clamped dt
      sweeper.update(MAX_DELTA_TIME, null);
      const angleAfterSpike = sweeper.angle;

      // The angle should advance by at most speed * MAX_DELTA_TIME from pre-pause
      const maxExpectedDelta = speed * MAX_DELTA_TIME;
      const actualDelta = Math.abs(angleAfterSpike - angleBeforePause);
      expect(actualDelta).toBeCloseTo(maxExpectedDelta, 3);
      // Confirm it's within one frame's rotation
      expect(actualDelta).toBeLessThanOrEqual(maxExpectedDelta + 0.001);
    });

    it('without onDtSpike, a raw 5s dt would cause a large angle jump', () => {
      const world = makeMockWorld();
      const THREE = require('three');
      const group = new THREE.Group();

      const speed = 2.0;
      const config = {
        type: 'moving_sweeper',
        pivot: new THREE.Vector3(0, 0, 0),
        armLength: 3,
        speed,
        size: { width: 3, height: 0.4, depth: 0.3 }
      };

      const sweeper = new MovingSweeper(world, group, config, SURFACE_HEIGHT);

      // Run for 1 second
      for (let i = 0; i < 60; i++) {
        sweeper.update(1 / 60, null);
      }
      const angleBeforePause = sweeper.angle;

      // Without spike handling, 5s raw dt would jump 10 radians
      sweeper.update(5.0, null);
      const jump = Math.abs(sweeper.angle - angleBeforePause);
      expect(jump).toBeCloseTo(10.0, 1); // 5s * 2 rad/s = 10 rad
    });
  });

  describe('PortalGate: cooldown is cleared after dt clamp, portal is immediately usable', () => {
    it('resets cooldown on dt spike so portal can be used immediately', () => {
      const world = makeMockWorld();
      const THREE = require('three');
      const group = new THREE.Group();

      const config = {
        type: 'portal_gate',
        entryPosition: new THREE.Vector3(0, 0, 0),
        exitPosition: new THREE.Vector3(5, 0, 5),
        radius: 0.6
      };

      const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);

      // Place ball at entry and trigger teleport
      const ball = makeMockBallBody(0, 0);
      portal.update(1 / 60, ball);

      // Cooldown should be set
      expect(portal.cooldown).toBe(1.0);

      // Simulate dt spike — cooldown should be cleared
      portal.onDtSpike();
      expect(portal.cooldown).toBe(0);

      // Ball is at exit now, move it back to entry
      ball.position.x = 0;
      ball.position.z = 0;

      // Portal should be immediately usable after spike
      portal.update(MAX_DELTA_TIME, ball);
      // Ball should have been teleported (position.set called again)
      expect(ball.position.set).toHaveBeenCalled();
    });

    it('without onDtSpike, portal would still be on cooldown', () => {
      const world = makeMockWorld();
      const THREE = require('three');
      const group = new THREE.Group();

      const config = {
        type: 'portal_gate',
        entryPosition: new THREE.Vector3(0, 0, 0),
        exitPosition: new THREE.Vector3(5, 0, 5),
        radius: 0.6
      };

      const portal = new PortalGate(world, group, config, SURFACE_HEIGHT);
      const ball = makeMockBallBody(0, 0);

      // Trigger teleport
      portal.update(1 / 60, ball);
      expect(portal.cooldown).toBe(1.0);

      // Without spike handling, clamped dt (0.033s) barely dents the 1s cooldown
      portal.update(MAX_DELTA_TIME, ball);
      expect(portal.cooldown).toBeGreaterThan(0.9);
    });
  });

  describe('Force fields apply force based on clamped dt magnitude, not raw dt', () => {
    it('BoostStrip applies force with clamped dt — same force regardless of dt value', () => {
      const world = makeMockWorld();
      const THREE = require('three');
      const group = new THREE.Group();

      const config = {
        type: 'boost_strip',
        position: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(0, 0, -1),
        force: 10,
        size: { width: 2, length: 3 }
      };

      const boost = new BoostStrip(world, group, config, SURFACE_HEIGHT);

      // Place ball inside the boost strip zone
      const ball = makeMockBallBody(0, 0);

      // Update with clamped dt
      boost.update(MAX_DELTA_TIME, ball);

      // Force should have been applied
      expect(ball.applyForce).toHaveBeenCalledTimes(1);

      // BoostStrip applies a constant force per frame (not scaled by dt),
      // so the force magnitude is the same whether dt is 0.016 or 0.033
      const firstCallArgs = ball.applyForce.mock.calls[0][0];
      ball.applyForce.mockClear();

      // Now update with a normal frame dt
      boost.update(1 / 60, ball);
      expect(ball.applyForce).toHaveBeenCalledTimes(1);

      // Force direction/magnitude should be identical
      const secondCallArgs = ball.applyForce.mock.calls[0][0];
      expect(secondCallArgs.x).toBe(firstCallArgs.x);
      expect(secondCallArgs.z).toBe(firstCallArgs.z);
    });

    it('SuctionZone applies force based on position, not dt', () => {
      const world = makeMockWorld();
      const THREE = require('three');
      const group = new THREE.Group();

      const config = {
        type: 'suction_zone',
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        force: 10
      };

      const suction = new SuctionZone(world, group, config, SURFACE_HEIGHT);

      // Place ball inside the suction zone
      const ball = makeMockBallBody(2, 0);

      // Update with clamped dt
      suction.update(MAX_DELTA_TIME, ball);
      expect(ball.applyForce).toHaveBeenCalledTimes(1);

      const firstCallArgs = ball.applyForce.mock.calls[0][0];
      ball.applyForce.mockClear();

      // Update with normal dt — same position means same force
      suction.update(1 / 60, ball);
      expect(ball.applyForce).toHaveBeenCalledTimes(1);

      const secondCallArgs = ball.applyForce.mock.calls[0][0];
      expect(secondCallArgs.x).toBe(firstCallArgs.x);
      expect(secondCallArgs.z).toBe(firstCallArgs.z);
    });
  });

  describe('End-to-end: HoleEntity threads dtWasClamped to all mechanic types', () => {
    it('calls onDtSpike on mechanics before update when dtWasClamped is true', async () => {
      const world = makeMockWorld();
      const scene = makeMockScene();
      const config = makeMinimalHoleConfig({ mechanics: [] });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const callOrder = [];
      const mockMechanic = {
        _failed: false,
        config: { type: 'test_ordered' },
        onDtSpike: jest.fn(() => callOrder.push('onDtSpike')),
        update: jest.fn(() => callOrder.push('update'))
      };

      hole.mechanics.push(mockMechanic);
      const ball = makeMockBallBody();

      // Normal frame — onDtSpike should NOT be called
      hole.update(1 / 60, ball, { dtWasClamped: false });
      expect(mockMechanic.onDtSpike).not.toHaveBeenCalled();
      expect(mockMechanic.update).toHaveBeenCalledTimes(1);

      // Clamped frame — onDtSpike should be called BEFORE update
      callOrder.length = 0;
      hole.update(MAX_DELTA_TIME, ball, { dtWasClamped: true });
      expect(mockMechanic.onDtSpike).toHaveBeenCalledTimes(1);
      expect(mockMechanic.update).toHaveBeenCalledTimes(2);
      expect(callOrder).toEqual(['onDtSpike', 'update']);
    });

    it('threads dtWasClamped to multiple mechanics of different types', async () => {
      const world = makeMockWorld();
      const scene = makeMockScene();
      const config = makeMinimalHoleConfig({ mechanics: [] });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const spikeCalls = [];
      const mechanicTypes = ['timedHazard', 'timedGate', 'movingSweeper', 'portalGate'];

      for (const type of mechanicTypes) {
        hole.mechanics.push({
          _failed: false,
          config: { type },
          onDtSpike: jest.fn(() => spikeCalls.push(type)),
          update: jest.fn()
        });
      }

      const ball = makeMockBallBody();
      hole.update(MAX_DELTA_TIME, ball, { dtWasClamped: true });

      // All mechanics should have received onDtSpike
      expect(spikeCalls).toEqual(mechanicTypes);
      // All mechanics should have received update
      for (const mechanic of hole.mechanics) {
        expect(mechanic.update).toHaveBeenCalledWith(MAX_DELTA_TIME, ball);
      }
    });

    it('mechanics without onDtSpike still receive update normally', async () => {
      const world = makeMockWorld();
      const scene = makeMockScene();
      const config = makeMinimalHoleConfig({ mechanics: [] });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Mechanic without onDtSpike (like a stateless mechanic)
      const statelessMechanic = {
        _failed: false,
        config: { type: 'stateless' },
        update: jest.fn()
        // No onDtSpike method
      };

      hole.mechanics.push(statelessMechanic);

      const ball = makeMockBallBody();
      // Should not throw even with dtWasClamped=true
      expect(() => hole.update(MAX_DELTA_TIME, ball, { dtWasClamped: true })).not.toThrow();
      expect(statelessMechanic.update).toHaveBeenCalledWith(MAX_DELTA_TIME, ball);
    });
  });
});
