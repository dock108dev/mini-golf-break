/**
 * Unit tests for TimedGate mechanic
 * ISSUE-043
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { TimedGate } from '../../mechanics/TimedGate';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

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
