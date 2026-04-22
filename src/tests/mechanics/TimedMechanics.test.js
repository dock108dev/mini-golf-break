/**
 * Unit tests for TimedHazard and TimedGate mechanics
 * ISSUE-005
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { TimedHazard } from '../../mechanics/TimedHazard';
import { TimedGate } from '../../mechanics/TimedGate';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js for timed mechanic tests
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Body.SLEEPING = 2;
  CANNON.Body.KINEMATIC = 4;

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
    applyImpulse: jest.fn(),
    sleepState: 0,
    userData: {}
  }));

  CANNON.Vec3.mockImplementation((x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 }));
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

// ===========================================================================
// TimedHazard
// ===========================================================================

describe('TimedHazard', () => {
  let world, group;
  const surfaceHeight = 0.2;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
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
        surfaceHeight
      );

      expect(hazard.meshes).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
    });

    it('creates no physics bodies', () => {
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

      expect(hazard.bodies).toHaveLength(0);
      expect(world.addBody).not.toHaveBeenCalled();
    });

    it('positions mesh at config position with slight Y offset above surface', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 5, y: 0, z: -3 },
          onDuration: 1,
          offDuration: 1
        },
        surfaceHeight
      );

      const mesh = hazard.mesh;
      expect(mesh.position.set).toHaveBeenCalledWith(5, surfaceHeight + 0.006, -3);
    });

    it('starts with mesh hidden (inactive state)', () => {
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

      expect(hazard.mesh.visible).toBe(false);
    });

    it('stores onDuration and offDuration from config', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          onDuration: 4,
          offDuration: 6
        },
        surfaceHeight
      );

      expect(hazard.onDuration).toBe(4);
      expect(hazard.offDuration).toBe(6);
    });

    it('uses default durations when not specified', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(hazard.onDuration).toBe(2);
      expect(hazard.offDuration).toBe(2);
    });

    it('defaults hazardType to water', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(hazard.hazardType).toBe('water');
    });

    it('initializes timer with phase offset when provided', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          onDuration: 2,
          offDuration: 2,
          phase: 1.5
        },
        surfaceHeight
      );

      expect(hazard.timer).toBe(1.5);
    });

    it('initializes timer at 0 when no phase provided', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(hazard.timer).toBe(0);
    });

    it('uses water color (0xff4400) for water hazardType by default', () => {
      new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          hazardType: 'water'
        },
        surfaceHeight
      );

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xff4400 })
      );
    });

    it('uses sand color (0xffaa00) for sand hazardType by default', () => {
      new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          hazardType: 'sand'
        },
        surfaceHeight
      );

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xffaa00 })
      );
    });

    it('uses custom color when specified', () => {
      new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          color: 0x00ff00
        },
        surfaceHeight
      );

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x00ff00 })
      );
    });

    it('creates a PlaneGeometry for the hazard visual', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 4, length: 3 }
        },
        surfaceHeight
      );

      // Mesh was created and added
      expect(hazard.meshes).toHaveLength(1);
      expect(hazard.mesh.rotation.x).toBe(-Math.PI / 2);
    });

    it('computes half dimensions from configured size', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 4, length: 6 }
        },
        surfaceHeight
      );

      expect(hazard.halfWidth).toBe(2);
      expect(hazard.halfLength).toBe(3);
    });

    it('uses default size when not specified', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(hazard.halfWidth).toBe(1);
      expect(hazard.halfLength).toBe(0.5);
    });
  });

  // --- Timer / State Cycling ---

  describe('timer cycling', () => {
    it('becomes active when timer is within onDuration', () => {
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

      // Timer starts at 0, after small dt cyclePos = dt < onDuration → active
      hazard.update(0.5, null);
      expect(hazard.isActive).toBe(true);
      expect(hazard.mesh.visible).toBe(true);
    });

    it('becomes inactive when timer passes onDuration', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          onDuration: 1,
          offDuration: 2
        },
        surfaceHeight
      );

      // Advance past onDuration
      hazard.update(1.5, null);
      expect(hazard.isActive).toBe(false);
      expect(hazard.mesh.visible).toBe(false);
    });

    it('cycles back to active after a full cycle', () => {
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

      // Cycle: on [0,1), off [1,2)
      // After 2.5s: timer=2.5, cyclePos=0.5, 0.5 < 1 → active
      hazard.update(2.5, null);
      expect(hazard.isActive).toBe(true);
    });

    it('respects phase offset for initial timer state', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          onDuration: 2,
          offDuration: 2,
          phase: 3 // starts at 3s into cycle; cyclePos = 3 % 4 = 3, 3 >= 2 → inactive
        },
        surfaceHeight
      );

      hazard.update(0.016, null);
      // timer = 3 + 0.016 = 3.016, cyclePos = 3.016 % 4 = 3.016, 3.016 >= 2 → inactive
      expect(hazard.isActive).toBe(false);
    });

    it('phase offset can start hazard in active state', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          onDuration: 3,
          offDuration: 2,
          phase: 0.5 // starts at 0.5s; cyclePos after dt = 0.516 < 3 → active
        },
        surfaceHeight
      );

      hazard.update(0.016, null);
      expect(hazard.isActive).toBe(true);
    });

    it('toggles visibility only on state change', () => {
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

      // First update: inactive → active → sets visible = true
      hazard.update(0.5, null);
      expect(hazard.mesh.visible).toBe(true);

      // Second update while still active: no visibility change
      const prevVisible = hazard.mesh.visible;
      hazard.update(0.5, null);
      expect(hazard.mesh.visible).toBe(prevVisible);
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
        surfaceHeight
      );

      const ball = makeBallBody(0, 0.5, 0); // At center of hazard

      hazard.update(0.5, ball); // timer=0.5, active
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
        surfaceHeight
      );

      const ball = makeBallBody(0, 0.5, 0);

      // Advance past onDuration → inactive
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
        surfaceHeight
      );

      const ball = makeBallBody(10, 0.5, 10); // Far from hazard

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
        surfaceHeight
      );

      const ball = makeBallBody(0, 0.5, 0);
      ball.sleepState = CANNON.Body.SLEEPING;

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
        surfaceHeight
      );

      const ball = makeBallBody(0, 0.5, 0);

      hazard.update(0.5, ball);
      expect(CANNON.Vec3).toHaveBeenCalledWith(0, 2, 0);
    });

    it('does not throw when ballBody is null', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          onDuration: 5,
          offDuration: 1
        },
        surfaceHeight
      );

      expect(() => hazard.update(0.5, null)).not.toThrow();
    });

    it('does not throw when ballBody is undefined', () => {
      const hazard = new TimedHazard(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          onDuration: 5,
          offDuration: 1
        },
        surfaceHeight
      );

      expect(() => hazard.update(0.5, undefined)).not.toThrow();
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up meshes', () => {
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

      expect(hazard.meshes).toHaveLength(1);
      hazard.destroy();
      expect(hazard.meshes).toEqual([]);
    });

    it('can be called multiple times without error', () => {
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

      hazard.destroy();
      expect(() => hazard.destroy()).not.toThrow();
    });
  });

  // --- Registry ---

  describe('registry', () => {
    it('registers with MechanicRegistry as timed_hazard', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('timed_hazard');
    });
  });
});

// ===========================================================================
// TimedGate
// ===========================================================================

describe('TimedGate', () => {
  let world, group;
  const surfaceHeight = 0.2;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a visual mesh and a physics body', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 2, y: 0, z: -1 },
          size: { width: 3, height: 1.5, depth: 0.3 },
          openDuration: 2,
          closedDuration: 3
        },
        surfaceHeight
      );

      expect(gate.meshes).toHaveLength(1);
      expect(gate.bodies).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
      expect(world.addBody).toHaveBeenCalledTimes(1);
    });

    it('positions mesh at closedY (surfaceHeight + height/2)', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 3, y: 0, z: -2 },
          size: { width: 2, height: 1, depth: 0.2 },
          openDuration: 2,
          closedDuration: 3
        },
        surfaceHeight
      );

      const expectedClosedY = surfaceHeight + 0.5; // surfaceHeight + height/2
      expect(gate.mesh.position.set).toHaveBeenCalledWith(3, expectedClosedY, -2);
    });

    it('positions physics body at same position as mesh', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 3, y: 0, z: -2 },
          size: { width: 2, height: 1, depth: 0.2 },
          openDuration: 2,
          closedDuration: 3
        },
        surfaceHeight
      );

      const expectedClosedY = surfaceHeight + 0.5;
      expect(gate.body.position.set).toHaveBeenCalledWith(3, expectedClosedY, -2);
    });

    it('creates a KINEMATIC physics body', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 1,
          closedDuration: 1
        },
        surfaceHeight
      );

      expect(CANNON.Body).toHaveBeenCalledWith(
        expect.objectContaining({
          mass: 0,
          type: CANNON.Body.KINEMATIC
        })
      );
    });

    it('stores openDuration and closedDuration from config', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 5,
          closedDuration: 7
        },
        surfaceHeight
      );

      expect(gate.openDuration).toBe(5);
      expect(gate.closedDuration).toBe(7);
    });

    it('uses default durations when not specified', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(gate.openDuration).toBe(2);
      expect(gate.closedDuration).toBe(3);
    });

    it('starts in closed state', () => {
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

      expect(gate.isOpen).toBe(false);
    });

    it('initializes timer with phase offset when provided', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 2,
          closedDuration: 3,
          phase: 1.0
        },
        surfaceHeight
      );

      expect(gate.timer).toBe(1.0);
    });

    it('initializes timer at 0 when no phase provided', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(gate.timer).toBe(0);
    });

    it('creates BoxGeometry with configured dimensions', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 3, height: 2, depth: 0.5 }
        },
        surfaceHeight
      );

      expect(gate.meshes).toHaveLength(1);
      expect(gate.body.addShape).toHaveBeenCalled();
    });

    it('uses default size dimensions', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      // Default height=1, closedY = surfaceHeight + 0.5
      expect(gate.closedY).toBeCloseTo(surfaceHeight + 0.5, 5);
      expect(gate.openY).toBeCloseTo(surfaceHeight - 1, 5);
    });

    it('uses custom color when specified', () => {
      new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          color: 0xff0000
        },
        surfaceHeight
      );

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xff0000 })
      );
    });

    it('uses default color (0x4488cc) when not specified', () => {
      new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x4488cc })
      );
    });

    it('sets userData type to timed_gate', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(gate.body.userData).toEqual({ type: 'timed_gate' });
    });

    it('calculates closedY and openY correctly', () => {
      const height = 2;
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 1, height, depth: 0.2 }
        },
        surfaceHeight
      );

      expect(gate.closedY).toBeCloseTo(surfaceHeight + height / 2, 5);
      expect(gate.openY).toBeCloseTo(surfaceHeight - height, 5);
    });

    it('adds physics shape with correct half extents', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 4, height: 2, depth: 0.6 }
        },
        surfaceHeight
      );

      expect(CANNON.Vec3).toHaveBeenCalledWith(2, 1, 0.3);
      expect(gate.body.addShape).toHaveBeenCalled();
    });
  });

  // --- Timer / State Cycling ---

  describe('timer cycling', () => {
    it('opens when timer is within openDuration', () => {
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

      // Timer starts at 0, after update cyclePos < openDuration → open
      gate.update(0.5, null);
      expect(gate.isOpen).toBe(true);
    });

    it('closes when timer passes openDuration', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 1,
          closedDuration: 3
        },
        surfaceHeight
      );

      // Advance past openDuration
      gate.update(1.5, null);
      expect(gate.isOpen).toBe(false);
    });

    it('cycles back to open after a full cycle', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 1,
          closedDuration: 1
        },
        surfaceHeight
      );

      // Cycle duration = 2, after 2.5s: cyclePos = 0.5 < 1 → open
      gate.update(2.5, null);
      expect(gate.isOpen).toBe(true);
    });

    it('respects openDuration and closedDuration config', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 4,
          closedDuration: 6
        },
        surfaceHeight
      );

      // Cycle = 10. At 3s: cyclePos=3 < 4 → open
      gate.update(3, null);
      expect(gate.isOpen).toBe(true);

      // At 5s: cyclePos=5 >= 4 → closed
      gate.update(2, null);
      expect(gate.isOpen).toBe(false);
    });

    it('phase offset shifts initial timer state correctly', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 2,
          closedDuration: 3,
          phase: 2.5 // cycle=5, cyclePos after dt ≈ 2.516, 2.516 >= 2 → closed
        },
        surfaceHeight
      );

      gate.update(0.016, null);
      expect(gate.isOpen).toBe(false);
    });

    it('phase offset can start gate in open state', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 3,
          closedDuration: 2,
          phase: 0.5 // cyclePos after dt ≈ 0.516 < 3 → open
        },
        surfaceHeight
      );

      gate.update(0.016, null);
      expect(gate.isOpen).toBe(true);
    });
  });

  // --- Gate Position ---

  describe('gate movement', () => {
    it('moves mesh toward openY when open', () => {
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

      // Set mesh position to closedY initially
      gate.mesh.position.y = gate.closedY;

      gate.update(0.1, null); // Should be open, lerps toward openY

      // New Y should have moved toward openY
      expect(gate.mesh.position.y).toBeLessThan(gate.closedY);
    });

    it('moves mesh toward closedY when closed', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 2, height: 1, depth: 0.2 },
          openDuration: 1,
          closedDuration: 5
        },
        surfaceHeight
      );

      // Simulate gate being at openY
      gate.mesh.position.y = gate.openY;

      // Advance past openDuration → closed
      gate.update(1.5, null);

      // Should have moved toward closedY (up)
      expect(gate.mesh.position.y).toBeGreaterThan(gate.openY);
    });

    it('syncs physics body Y position with mesh', () => {
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
      gate.update(0.1, null);

      expect(gate.body.position.y).toBe(gate.mesh.position.y);
    });

    it('uses lerp interpolation for smooth movement', () => {
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

      // Small dt should not instantly snap to target
      gate.update(0.016, null);

      // Should be between closedY and openY, not at openY
      expect(gate.mesh.position.y).not.toBe(gate.openY);
      expect(gate.mesh.position.y).not.toBe(gate.closedY);
    });
  });

  // --- Edge Cases ---

  describe('edge cases', () => {
    it('does not throw with null ballBody', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(() => gate.update(0.016, null)).not.toThrow();
    });

    it('handles zero dt without error', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(() => gate.update(0, null)).not.toThrow();
    });

    it('uses default position when not specified', () => {
      const gate = new TimedGate(world, group, {}, surfaceHeight);

      // Default position is (0,0,0), closedY = surfaceHeight + height/2
      const defaultHeight = 1;
      const expectedClosedY = surfaceHeight + defaultHeight / 2;
      expect(gate.mesh.position.set).toHaveBeenCalledWith(0, expectedClosedY, 0);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up meshes and bodies', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      expect(gate.meshes).toHaveLength(1);
      expect(gate.bodies).toHaveLength(1);

      gate.destroy();

      expect(gate.meshes).toEqual([]);
      expect(gate.bodies).toEqual([]);
    });

    it('removes body from world', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      gate.destroy();

      expect(world.removeBody).toHaveBeenCalled();
    });

    it('can be called multiple times without error', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 }
        },
        surfaceHeight
      );

      gate.destroy();
      expect(() => gate.destroy()).not.toThrow();
    });
  });

  // --- Registry ---

  describe('registry', () => {
    it('registers with MechanicRegistry as timed_gate', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('timed_gate');
    });
  });
});
