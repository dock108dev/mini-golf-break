/**
 * Unit tests for LaserGrid mechanic
 * ISSUE-003
 */

import * as CANNON from 'cannon-es';
import { LaserGrid } from '../../mechanics/LaserGrid';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// Import to trigger registration
import '../../mechanics/LaserGrid';

// CANNON.Body.SLEEPING constant (matches cannon-es)
const SLEEPING = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    step: jest.fn(),
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

function makeBallBody(x = 0, y = 0, z = 0) {
  return {
    position: {
      x,
      y,
      z,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    velocity: { x: 0, y: 0, z: 0 },
    sleepState: 0, // AWAKE
    applyImpulse: jest.fn()
  };
}

function makeConfig(overrides = {}) {
  return {
    beams: [{ start: [0, 0, 0], end: [2, 0, 0] }],
    onDuration: 2,
    offDuration: 2,
    offset: 0,
    ...overrides
  };
}

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LaserGrid', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    // Ensure CANNON.Body.SLEEPING is defined for sleep-state checks
    CANNON.Body.SLEEPING = SLEEPING;
  });

  // --- Registry ---

  describe('registry', () => {
    it('is registered as laser_grid in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('laser_grid');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a mesh and body for each beam', () => {
      const config = makeConfig({
        beams: [
          { start: [0, 0, 0], end: [2, 0, 0] },
          { start: [1, 0, -1], end: [1, 0, 1] }
        ]
      });
      const laser = new LaserGrid(world, group, config, SURFACE_HEIGHT);

      expect(laser.meshes.length).toBe(2);
      expect(laser.bodies.length).toBe(2);
      expect(group.add).toHaveBeenCalledTimes(2);
      expect(world.addBody).toHaveBeenCalledTimes(2);
    });

    it('stores onDuration and offDuration from config', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          onDuration: 3,
          offDuration: 1.5
        }),
        SURFACE_HEIGHT
      );

      expect(laser.onDuration).toBe(3);
      expect(laser.offDuration).toBe(1.5);
    });

    it('throws when beams field is missing', () => {
      expect(() => new LaserGrid(world, group, {}, SURFACE_HEIGHT)).toThrow(
        'LaserGrid: missing required config field "beams"'
      );
    });

    it('uses default values when optional config fields are missing', () => {
      const laser = new LaserGrid(world, group, { beams: [] }, SURFACE_HEIGHT);

      expect(laser.onDuration).toBe(2);
      expect(laser.offDuration).toBe(2);
      expect(laser.beamWidth).toBe(0.05);
      expect(laser.beamColor).toBe(0xff2222);
    });

    it('applies custom width and color from config', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          width: 0.1,
          color: 0x00ff00
        }),
        SURFACE_HEIGHT
      );

      expect(laser.beamWidth).toBe(0.1);
      expect(laser.beamColor).toBe(0x00ff00);
    });

    it('handles beams with object-style coordinates', () => {
      const config = makeConfig({
        beams: [{ start: { x: 1, y: 0, z: 2 }, end: { x: 3, y: 0, z: 4 } }]
      });
      const laser = new LaserGrid(world, group, config, SURFACE_HEIGHT);

      expect(laser.meshes.length).toBe(1);
      expect(laser.beamData[0].start).toEqual({ x: 1, y: 0, z: 2 });
    });

    it('creates no beams when beams array is empty', () => {
      const laser = new LaserGrid(world, group, makeConfig({ beams: [] }), SURFACE_HEIGHT);

      expect(laser.meshes.length).toBe(0);
      expect(laser.bodies.length).toBe(0);
    });
  });

  // --- Timer cycling ---

  describe('timer cycling', () => {
    it('starts active when offset is 0', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);

      // Timer starts at 0, which is within onDuration
      expect(laser.isActive).toBe(true);
    });

    it('transitions to inactive after onDuration elapses', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          onDuration: 1,
          offDuration: 1
        }),
        SURFACE_HEIGHT
      );

      // Advance past onDuration
      laser.update(1.1, null);
      expect(laser.isActive).toBe(false);
    });

    it('cycles back to active after full cycle', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          onDuration: 1,
          offDuration: 1
        }),
        SURFACE_HEIGHT
      );

      // Advance through full cycle
      laser.update(2.1, null);
      expect(laser.isActive).toBe(true);
    });

    it('respects offset to start mid-cycle', () => {
      // offset 0.5 with cycle 4s = start at 2s, which is in offDuration
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          onDuration: 2,
          offDuration: 2,
          offset: 0.5
        }),
        SURFACE_HEIGHT
      );

      expect(laser.isActive).toBe(false);
    });

    it('offset 0.25 starts partway through on phase', () => {
      // offset 0.25 with cycle 4s = start at 1s, still in onDuration (0-2)
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          onDuration: 2,
          offDuration: 2,
          offset: 0.25
        }),
        SURFACE_HEIGHT
      );

      expect(laser.isActive).toBe(true);
    });

    it('shows beams when active, hides when inactive', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          onDuration: 1,
          offDuration: 1
        }),
        SURFACE_HEIGHT
      );

      // Active initially
      expect(laser.meshes[0].visible).toBe(true);

      // Advance past onDuration
      laser.update(1.1, null);
      expect(laser.meshes[0].visible).toBe(false);
    });
  });

  // --- Warn flash ---

  describe('warn flash', () => {
    it('shows warn flash 0.1s before reactivation', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          onDuration: 1,
          offDuration: 1
        }),
        SURFACE_HEIGHT
      );

      // Advance to 1.95s (0.05s before cycle wraps at 2s)
      laser.update(1.95, null);
      expect(laser.isActive).toBe(false);
      expect(laser.isWarning).toBe(true);
      // Mesh should be visible during warning
      expect(laser.meshes[0].visible).toBe(true);
    });

    it('warn flash has reduced opacity', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          onDuration: 1,
          offDuration: 1
        }),
        SURFACE_HEIGHT
      );

      laser.update(1.95, null);
      expect(laser.meshes[0].material.opacity).toBe(0.3);
    });
  });

  // --- Hazard interaction ---

  describe('hazard interaction', () => {
    it('applies impulse when ball overlaps active beam', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          beams: [{ start: [0, 0, 0], end: [2, 0, 0] }],
          onDuration: 2,
          offDuration: 2
        }),
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(1, 0, 0); // On the beam
      laser.update(0.1, ball);

      expect(ball.applyImpulse).toHaveBeenCalled();
    });

    it('does not apply impulse when beam is inactive', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          beams: [{ start: [0, 0, 0], end: [2, 0, 0] }],
          onDuration: 1,
          offDuration: 1
        }),
        SURFACE_HEIGHT
      );

      // Advance past onDuration
      laser.update(1.1, null);

      const ball = makeBallBody(1, 0, 0);
      laser.update(0.1, ball);

      expect(ball.applyImpulse).not.toHaveBeenCalled();
    });

    it('does not apply impulse when ball is far from beam', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          beams: [{ start: [0, 0, 0], end: [2, 0, 0] }],
          onDuration: 2,
          offDuration: 2
        }),
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(1, 0, 10); // Far from beam
      laser.update(0.1, ball);

      expect(ball.applyImpulse).not.toHaveBeenCalled();
    });

    it('handles null ballBody gracefully', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(() => laser.update(0.1, null)).not.toThrow();
    });

    it('skips sleeping ball', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          beams: [{ start: [0, 0, 0], end: [2, 0, 0] }]
        }),
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(1, 0, 0);
      ball.sleepState = SLEEPING;
      laser.update(0.1, ball);

      expect(ball.applyImpulse).not.toHaveBeenCalled();
    });
  });

  // --- onDtSpike ---

  describe('onDtSpike', () => {
    it('resets timer and state', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);

      laser.update(1.5, null);
      laser.onDtSpike();

      expect(laser.timer).toBe(0);
      expect(laser.isActive).toBe(false);
      expect(laser.isWarning).toBe(false);
    });

    it('hides all beams after dtSpike', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);

      laser.onDtSpike();

      for (const beam of laser.beamData) {
        expect(beam.mesh.visible).toBe(false);
      }
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    function addDisposeMocks(laser) {
      // The global THREE.Mesh mock doesn't include dispose on geometry/material.
      // Patch them so MechanicBase.destroy() can call dispose().
      for (const mesh of laser.meshes) {
        if (mesh.geometry && !mesh.geometry.dispose) {
          mesh.geometry.dispose = jest.fn();
        }
        if (mesh.material && !mesh.material.dispose) {
          mesh.material.dispose = jest.fn();
        }
      }
    }

    it('cleans up all meshes and bodies', () => {
      const config = makeConfig({
        beams: [
          { start: [0, 0, 0], end: [2, 0, 0] },
          { start: [1, 0, -1], end: [1, 0, 1] }
        ]
      });
      const laser = new LaserGrid(world, group, config, SURFACE_HEIGHT);

      expect(laser.meshes.length).toBe(2);
      expect(laser.bodies.length).toBe(2);

      addDisposeMocks(laser);
      laser.destroy();

      expect(laser.meshes).toEqual([]);
      expect(laser.bodies).toEqual([]);
      expect(world.removeBody).toHaveBeenCalledTimes(2);
    });

    it('can be called multiple times safely', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);

      addDisposeMocks(laser);
      laser.destroy();
      expect(() => laser.destroy()).not.toThrow();
    });
  });

  // --- Point-to-segment collision ---

  describe('_isBallOnBeam', () => {
    it('detects ball at beam midpoint', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          beams: [{ start: [0, 0, 0], end: [4, 0, 0] }]
        }),
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(2, 0, 0);
      expect(laser._isBallOnBeam(ball, laser.beamData[0])).toBe(true);
    });

    it('detects ball at beam start', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          beams: [{ start: [0, 0, 0], end: [4, 0, 0] }]
        }),
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(0, 0, 0);
      expect(laser._isBallOnBeam(ball, laser.beamData[0])).toBe(true);
    });

    it('rejects ball far from beam', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          beams: [{ start: [0, 0, 0], end: [4, 0, 0] }]
        }),
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(2, 0, 5);
      expect(laser._isBallOnBeam(ball, laser.beamData[0])).toBe(false);
    });

    it('handles zero-length degenerate beam', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          beams: [{ start: [1, 0, 1], end: [1, 0, 1] }]
        }),
        SURFACE_HEIGHT
      );

      const ballNear = makeBallBody(1, 0, 1);
      const ballFar = makeBallBody(5, 0, 5);
      expect(laser._isBallOnBeam(ballNear, laser.beamData[0])).toBe(true);
      expect(laser._isBallOnBeam(ballFar, laser.beamData[0])).toBe(false);
    });
  });
});
