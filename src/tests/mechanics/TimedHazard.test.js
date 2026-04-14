/**
 * Unit tests for TimedHazard mechanic
 * ISSUE-043
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { TimedHazard } from '../../mechanics/TimedHazard';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

const SLEEPING = 2;

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Body.SLEEPING = SLEEPING;

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
    applyImpulse: jest.fn(),
    sleepState: 0,
    userData: {}
  }));

  CANNON.Vec3.mockImplementation((x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 }));

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
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    bumperMaterial: {}
  };
}

function makeMockGroup() {
  const children = [];
  return {
    add: jest.fn(child => children.push(child)),
    remove: jest.fn(),
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

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimedHazard', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  // --- Registry ---

  describe('registry', () => {
    it('is registered as timed_hazard in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('timed_hazard');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a visual mesh and adds it to the group', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 1, y: 0, z: 2 },
          size: { width: 3, length: 2 },
          onDuration: 2,
          offDuration: 3,
          hazardType: 'water'
        },
        SURFACE_HEIGHT
      );

      expect(hazard.meshes).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
    });

    it('creates no physics bodies', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 1, offDuration: 1 },
        SURFACE_HEIGHT
      );

      expect(hazard.bodies).toHaveLength(0);
      expect(world.addBody).not.toHaveBeenCalled();
    });

    it('starts with mesh hidden', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 2, offDuration: 2 },
        SURFACE_HEIGHT
      );

      expect(hazard.mesh.visible).toBe(false);
    });

    it('stores onDuration and offDuration from config', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 4, offDuration: 6 },
        SURFACE_HEIGHT
      );

      expect(hazard.onDuration).toBe(4);
      expect(hazard.offDuration).toBe(6);
    });

    it('uses default durations when not specified', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 } },
        SURFACE_HEIGHT
      );

      expect(hazard.onDuration).toBe(2);
      expect(hazard.offDuration).toBe(2);
    });

    it('defaults hazardType to water', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 } },
        SURFACE_HEIGHT
      );

      expect(hazard.hazardType).toBe('water');
    });

    it('initializes timer with phase offset when provided', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, phase: 1.5 },
        SURFACE_HEIGHT
      );

      expect(hazard.timer).toBe(1.5);
    });

    it('initializes timer at 0 when no phase provided', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 } },
        SURFACE_HEIGHT
      );

      expect(hazard.timer).toBe(0);
    });

    it('computes half dimensions from configured size', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, size: { width: 4, length: 6 } },
        SURFACE_HEIGHT
      );

      expect(hazard.halfWidth).toBe(2);
      expect(hazard.halfLength).toBe(3);
    });

    it('uses default size when not specified', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 } },
        SURFACE_HEIGHT
      );

      expect(hazard.halfWidth).toBe(1);
      expect(hazard.halfLength).toBe(0.5);
    });

    it('uses water color for water hazardType by default', () => {
      new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, hazardType: 'water' },
        SURFACE_HEIGHT
      );

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xff4400 })
      );
    });

    it('uses sand color for sand hazardType by default', () => {
      new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, hazardType: 'sand' },
        SURFACE_HEIGHT
      );

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xffaa00 })
      );
    });

    it('uses custom color when specified', () => {
      new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, color: 0x00ff00 },
        SURFACE_HEIGHT
      );

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x00ff00 })
      );
    });
  });

  // --- Timer / State Cycling ---

  describe('timer cycling', () => {
    it('becomes active when timer is within onDuration', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 2, offDuration: 3 },
        SURFACE_HEIGHT
      );

      hazard.update(0.5, null);

      expect(hazard.isActive).toBe(true);
      expect(hazard.mesh.visible).toBe(true);
    });

    it('becomes inactive when timer passes onDuration', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 1, offDuration: 2 },
        SURFACE_HEIGHT
      );

      hazard.update(1.5, null);

      expect(hazard.isActive).toBe(false);
      expect(hazard.mesh.visible).toBe(false);
    });

    it('cycles back to active after a full cycle', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 1, offDuration: 1 },
        SURFACE_HEIGHT
      );

      hazard.update(2.5, null);

      expect(hazard.isActive).toBe(true);
    });

    it('respects phase offset for initial timer state', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 2, offDuration: 2, phase: 3 },
        SURFACE_HEIGHT
      );

      hazard.update(0.016, null);

      expect(hazard.isActive).toBe(false);
    });

    it('phase offset can start hazard in active state', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 3, offDuration: 2, phase: 0.5 },
        SURFACE_HEIGHT
      );

      hazard.update(0.016, null);

      expect(hazard.isActive).toBe(true);
    });
  });

  // --- Ball Interaction ---

  describe('ball interaction', () => {
    it('applies impulse to ball when active and ball is in hazard zone', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 4, length: 4 },
          onDuration: 5,
          offDuration: 1
        },
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(0, 0.5, 0);
      hazard.update(0.5, ball);

      expect(ball.applyImpulse).toHaveBeenCalled();
    });

    it('does not apply impulse when hazard is inactive', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 4, length: 4 },
          onDuration: 1,
          offDuration: 5
        },
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(0, 0.5, 0);
      hazard.update(1.5, ball);

      expect(ball.applyImpulse).not.toHaveBeenCalled();
    });

    it('does not apply impulse when ball is outside hazard zone', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 2, length: 2 },
          onDuration: 5,
          offDuration: 1
        },
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(10, 0.5, 10);
      hazard.update(0.5, ball);

      expect(ball.applyImpulse).not.toHaveBeenCalled();
    });

    it('does not apply impulse when ball is sleeping', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 4, length: 4 },
          onDuration: 5,
          offDuration: 1
        },
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(0, 0.5, 0);
      ball.sleepState = SLEEPING;
      hazard.update(0.5, ball);

      expect(ball.applyImpulse).not.toHaveBeenCalled();
    });

    it('applies upward impulse (bounce-out effect)', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 4, length: 4 },
          onDuration: 5,
          offDuration: 1
        },
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(0, 0.5, 0);
      hazard.update(0.5, ball);

      expect(CANNON.Vec3).toHaveBeenCalledWith(0, 2, 0);
    });

    it('does not throw when ballBody is null', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 5, offDuration: 1 },
        SURFACE_HEIGHT
      );

      expect(() => hazard.update(0.5, null)).not.toThrow();
    });
  });

  // --- onDtSpike ---

  describe('onDtSpike', () => {
    it('resets timer and state', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 2, offDuration: 2 },
        SURFACE_HEIGHT
      );

      hazard.update(0.5, null);
      hazard.onDtSpike();

      expect(hazard.timer).toBe(0);
      expect(hazard.isActive).toBe(false);
      expect(hazard.mesh.visible).toBe(false);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up meshes', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 1, offDuration: 1 },
        SURFACE_HEIGHT
      );

      expect(hazard.meshes).toHaveLength(1);

      hazard.destroy();

      expect(hazard.meshes).toEqual([]);
    });

    it('can be called multiple times without error', () => {
      const hazard = new TimedHazard(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, onDuration: 1, offDuration: 1 },
        SURFACE_HEIGHT
      );

      hazard.destroy();
      expect(() => hazard.destroy()).not.toThrow();
    });
  });
});
