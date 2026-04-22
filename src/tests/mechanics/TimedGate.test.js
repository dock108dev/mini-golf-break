/**
 * Unit tests for TimedGate mechanic
 * ISSUE-009, ISSUE-043
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { TimedGate } from '../../mechanics/TimedGate';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';
import { EventTypes } from '../../events/EventTypes';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
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
    angularVelocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn() },
    addShape: jest.fn(),
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

  THREE.BoxGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
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

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimedGate', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  // --- Registry ---

  describe('registry', () => {
    it('is registered as timed_gate in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('timed_gate');
    });
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
        SURFACE_HEIGHT
      );

      expect(gate.meshes).toHaveLength(1);
      expect(gate.bodies).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
      expect(world.addBody).toHaveBeenCalledTimes(1);
    });

    it('positions mesh at closedY', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 3, y: 0, z: -2 },
          size: { width: 2, height: 1, depth: 0.2 },
          openDuration: 2,
          closedDuration: 3
        },
        SURFACE_HEIGHT
      );

      expect(gate.mesh.position.set).toHaveBeenCalledWith(3, SURFACE_HEIGHT + 0.5, -2);
    });

    it('stores openDuration and closedDuration from config', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 5, closedDuration: 7 },
        SURFACE_HEIGHT
      );

      expect(gate.openDuration).toBe(5);
      expect(gate.closedDuration).toBe(7);
    });

    it('uses default durations when not specified', () => {
      const gate = new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      expect(gate.openDuration).toBe(2);
      expect(gate.closedDuration).toBe(3);
    });

    it('starts in closed state', () => {
      const gate = new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      expect(gate.isOpen).toBe(false);
    });

    it('initializes timer with phase offset when provided', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, phase: 1.0 },
        SURFACE_HEIGHT
      );

      expect(gate.timer).toBe(1.0);
    });

    it('initializes timer at 0 when no phase provided', () => {
      const gate = new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      expect(gate.timer).toBe(0);
    });

    it('calculates closedY and openY correctly', () => {
      const height = 2;
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, size: { width: 1, height, depth: 0.2 } },
        SURFACE_HEIGHT
      );

      expect(gate.closedY).toBeCloseTo(SURFACE_HEIGHT + height / 2);
      expect(gate.openY).toBeCloseTo(SURFACE_HEIGHT - height);
    });

    it('sets userData type to timed_gate', () => {
      const gate = new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      expect(gate.body.userData).toEqual({ type: 'timed_gate' });
    });

    it('uses custom color when specified', () => {
      new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, color: 0xff0000 },
        SURFACE_HEIGHT
      );

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xff0000 })
      );
    });

    it('uses default color when not specified', () => {
      new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x4488cc })
      );
    });
  });

  // --- Timer / State Cycling ---

  describe('timer cycling', () => {
    it('opens when timer is within openDuration', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 3, closedDuration: 2 },
        SURFACE_HEIGHT
      );

      gate.update(0.5, null);

      expect(gate.isOpen).toBe(true);
    });

    it('closes when timer passes openDuration', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 1, closedDuration: 3 },
        SURFACE_HEIGHT
      );

      gate.update(1.5, null);

      expect(gate.isOpen).toBe(false);
    });

    it('cycles back to open after a full cycle', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 1, closedDuration: 1 },
        SURFACE_HEIGHT
      );

      gate.update(2.5, null);

      expect(gate.isOpen).toBe(true);
    });

    it('phase offset shifts initial timer state', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 2, closedDuration: 3, phase: 2.5 },
        SURFACE_HEIGHT
      );

      gate.update(0.016, null);

      expect(gate.isOpen).toBe(false);
    });

    it('phase offset can start gate in open state', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 3, closedDuration: 2, phase: 0.5 },
        SURFACE_HEIGHT
      );

      gate.update(0.016, null);

      expect(gate.isOpen).toBe(true);
    });
  });

  // --- Gate Movement ---

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
        SURFACE_HEIGHT
      );

      gate.mesh.position.y = gate.closedY;
      gate.update(0.1, null);

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
        SURFACE_HEIGHT
      );

      gate.mesh.position.y = gate.openY;
      gate.update(1.5, null);

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
        SURFACE_HEIGHT
      );

      gate.mesh.position.y = gate.closedY;
      gate.update(0.1, null);

      expect(gate.body.position.y).toBe(gate.mesh.position.y);
    });

    it('uses lerp interpolation (does not snap instantly)', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 2, height: 1, depth: 0.2 },
          openDuration: 5,
          closedDuration: 1
        },
        SURFACE_HEIGHT
      );

      gate.mesh.position.y = gate.closedY;
      gate.update(0.016, null);

      expect(gate.mesh.position.y).not.toBe(gate.openY);
      expect(gate.mesh.position.y).not.toBe(gate.closedY);
    });
  });

  // --- onDtSpike ---

  describe('onDtSpike', () => {
    it('resets timer and snaps to closed position', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 2, closedDuration: 3 },
        SURFACE_HEIGHT
      );

      gate.update(1.0, null);
      gate.onDtSpike();

      expect(gate.timer).toBe(0);
      expect(gate.isOpen).toBe(false);
      expect(gate.mesh.position.y).toBe(gate.closedY);
      expect(gate.body.position.y).toBe(gate.closedY);
    });
  });

  // --- Edge Cases ---

  describe('edge cases', () => {
    it('does not throw with null ballBody', () => {
      const gate = new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      expect(() => gate.update(0.016, null)).not.toThrow();
    });

    it('handles zero dt without error', () => {
      const gate = new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      expect(() => gate.update(0, null)).not.toThrow();
    });
  });

  // --- Velocity-servo (ISSUE-009) ---

  describe('velocity-servo movement', () => {
    it('sets body.velocity.y to (targetY - currentY) / dt on an open gate', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 2, height: 1, depth: 0.2 },
          openDuration: 5,
          closedDuration: 1
        },
        SURFACE_HEIGHT
      );

      gate.mesh.position.y = gate.closedY;
      const dt = 0.1;
      gate.update(dt, null); // gate opens immediately (openDuration=5)

      // Expected raw velocity (clamped by maxSpeed = depth/fixedDt = 0.2*60 = 12)
      const rawVy = (gate.openY - gate.closedY) / dt;
      const maxSpeed = 0.2 * 60;
      const expectedVy = Math.max(-maxSpeed, Math.min(maxSpeed, rawVy));

      expect(gate.isOpen).toBe(true);
      expect(gate.body.velocity.set).toHaveBeenCalledWith(0, expectedVy, 0);
    });

    it('clamps body.velocity.y to maxSpeed (depth / fixedDt)', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 2, height: 2, depth: 0.2 },
          openDuration: 5,
          closedDuration: 1
        },
        SURFACE_HEIGHT
      );

      gate.mesh.position.y = gate.closedY;
      gate.update(0.016, null); // very small dt → large raw velocity → must be clamped

      const maxSpeed = 0.2 * 60; // 12 units/s
      const callArgs = gate.body.velocity.set.mock.calls[0];
      expect(Math.abs(callArgs[1])).toBeLessThanOrEqual(maxSpeed + 0.001);
    });

    it('sets body.velocity to zero when gate is already at target', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          size: { width: 2, height: 1, depth: 0.2 },
          openDuration: 5,
          closedDuration: 1
        },
        SURFACE_HEIGHT
      );

      // Place mesh exactly at target (openY) and gate should be open
      gate.mesh.position.y = gate.openY;
      gate.isOpen = true;
      gate.timer = 0.1;
      gate.update(0.016, null);

      const callArgs = gate.body.velocity.set.mock.calls[0];
      expect(callArgs[1]).toBeCloseTo(0, 3);
    });
  });

  // --- Emissive lerp (ISSUE-009) ---

  describe('emissive color lerp', () => {
    it('starts with _emissiveT = 0 (closed/red)', () => {
      const gate = new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      expect(gate._emissiveT).toBe(0);
    });

    it('_emissiveT increases toward 1 after gate opens', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 5,
          closedDuration: 1
        },
        SURFACE_HEIGHT
      );

      gate.update(0.1, null); // gate opens
      expect(gate.isOpen).toBe(true);
      expect(gate._emissiveT).toBeGreaterThan(0);
    });

    it('_emissiveT saturates at 1 after sufficient open time', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 5, // large enough to stay open during saturation
          closedDuration: 1
        },
        SURFACE_HEIGHT
      );

      gate.update(0.1, null); // opens (timer=0.1 < 5)
      gate.update(1.0, null); // still open (timer=1.1 < 5); lerp factor = min(1,5*1)=1 → saturates

      expect(gate._emissiveT).toBeCloseTo(1, 3);
    });

    it('_emissiveT returns to 0 when gate closes', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 5,
          closedDuration: 5
        },
        SURFACE_HEIGHT
      );

      // Saturate to open (timer stays within openDuration=5)
      gate.update(0.1, null); // opens, _emissiveT → 0.5
      gate.update(1.0, null); // still open, saturates to 1.0
      expect(gate._emissiveT).toBeCloseTo(1, 3);

      // Advance past openDuration to close gate (timer=6.1, cyclePos=6.1>5 → closed)
      gate.update(5.0, null); // closes; lerp factor = min(1,5*5)=1 → _emissiveT snaps to 0
      expect(gate._emissiveT).toBeCloseTo(0, 3);
    });

    it('onDtSpike snaps _emissiveT to 0', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 5, closedDuration: 1 },
        SURFACE_HEIGHT
      );

      gate.update(0.5, null);
      expect(gate._emissiveT).toBeGreaterThan(0);

      gate.onDtSpike();
      expect(gate._emissiveT).toBe(0);
    });
  });

  // --- GATE_STATE_CHANGED event (ISSUE-009) ---

  describe('GATE_STATE_CHANGED event', () => {
    it('publishes GATE_STATE_CHANGED via eventManager when gate opens', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 5, closedDuration: 1 },
        SURFACE_HEIGHT
      );

      const mockEventManager = { publish: jest.fn() };
      gate.eventManager = mockEventManager;

      gate.update(0.1, null); // triggers open

      expect(mockEventManager.publish).toHaveBeenCalledWith(
        EventTypes.GATE_STATE_CHANGED,
        expect.objectContaining({ isOpen: true })
      );
    });

    it('publishes GATE_STATE_CHANGED when gate closes', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 1, closedDuration: 5 },
        SURFACE_HEIGHT
      );

      const mockEventManager = { publish: jest.fn() };
      gate.eventManager = mockEventManager;

      gate.update(0.1, null); // opens (cyclePos=0.1 < openDuration=1)
      gate.update(1.5, null); // closes (cyclePos=1.6 > openDuration=1)

      const closedCall = mockEventManager.publish.mock.calls.find(
        args => args[1]?.isOpen === false
      );
      expect(closedCall).toBeDefined();
      expect(closedCall[0]).toBe(EventTypes.GATE_STATE_CHANGED);
    });

    it('does not publish if no eventManager is set', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, openDuration: 5, closedDuration: 1 },
        SURFACE_HEIGHT
      );

      expect(() => gate.update(0.1, null)).not.toThrow();
    });
  });

  // --- Grace period (ISSUE-018) ---

  describe('grace period', () => {
    it('initializes _gracePeriod from config', () => {
      const gate = new TimedGate(
        world,
        group,
        { position: { x: 0, y: 0, z: 0 }, gracePeriod: 2 },
        SURFACE_HEIGHT
      );

      expect(gate._gracePeriod).toBe(2);
    });

    it('defaults _gracePeriod to 0 when not in config', () => {
      const gate = new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      expect(gate._gracePeriod).toBe(0);
    });

    it('forces gate open during grace period regardless of cycle phase', () => {
      // phase=3 would normally put the gate in closed state (cyclePos=3 > openDuration=2)
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 2,
          closedDuration: 3,
          phase: 3,
          gracePeriod: 2
        },
        SURFACE_HEIGHT
      );

      gate.update(0.5, null); // still in grace period (graceTimer=0.5 < 2)

      expect(gate.isOpen).toBe(true);
    });

    it('gate stays open for the full grace period duration', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 2,
          closedDuration: 3,
          phase: 3, // would be closed without grace
          gracePeriod: 2
        },
        SURFACE_HEIGHT
      );

      gate.update(1.9, null); // graceTimer=1.9, still in grace
      expect(gate.isOpen).toBe(true);
    });

    it('exits grace period and follows normal cycle after gracePeriod seconds', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 0.1, // very short open, so after grace expires gate closes quickly
          closedDuration: 5,
          gracePeriod: 2
        },
        SURFACE_HEIGHT
      );

      // After grace (graceTimer=2.1), timer advances by 2.1−(last grace tick) only for excess
      gate.update(2.5, null); // graceTimer=2.5 > 2 → out of grace; timer += 2.5; cyclePos=2.5>0.1 → closed
      expect(gate.isOpen).toBe(false);
    });

    it('cycle timer does not advance during grace period', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 2,
          closedDuration: 3,
          gracePeriod: 2
        },
        SURFACE_HEIGHT
      );

      gate.update(1.5, null); // inside grace period
      expect(gate.timer).toBe(0); // timer must not advance during grace
    });

    it('onDtSpike resets _graceTimer so grace period restarts', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 2,
          closedDuration: 3,
          gracePeriod: 2
        },
        SURFACE_HEIGHT
      );

      gate.update(1.5, null);
      expect(gate._graceTimer).toBeGreaterThan(0);

      gate.onDtSpike();
      expect(gate._graceTimer).toBe(0);
    });

    it('grace period of 0 has no effect — normal cycle runs immediately', () => {
      const gate = new TimedGate(
        world,
        group,
        {
          position: { x: 0, y: 0, z: 0 },
          openDuration: 1,
          closedDuration: 5,
          gracePeriod: 0
        },
        SURFACE_HEIGHT
      );

      gate.update(1.5, null); // timer=1.5 > openDuration=1 → closed
      expect(gate.isOpen).toBe(false);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up meshes and bodies', () => {
      const gate = new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      expect(gate.meshes).toHaveLength(1);
      expect(gate.bodies).toHaveLength(1);

      gate.destroy();

      expect(gate.meshes).toEqual([]);
      expect(gate.bodies).toEqual([]);
      expect(world.removeBody).toHaveBeenCalled();
    });

    it('can be called multiple times without error', () => {
      const gate = new TimedGate(world, group, { position: { x: 0, y: 0, z: 0 } }, SURFACE_HEIGHT);

      gate.destroy();
      expect(() => gate.destroy()).not.toThrow();
    });
  });
});
