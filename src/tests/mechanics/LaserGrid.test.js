/**
 * Unit tests for LaserGrid mechanic — ISSUE-030
 */

import * as CANNON from 'cannon-es';
import { LaserGrid } from '../../mechanics/LaserGrid';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';
import { EventTypes } from '../../events/EventTypes';
import { HAZARD_COLORS } from '../../themes/palette';

// Import to trigger registration
import '../../mechanics/LaserGrid';

// CANNON.Body.SLEEPING constant (matches cannon-es)
const SLEEPING = 2;
const DT = 1 / 60; // fixed physics timestep

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

function makeConfig(overrides = {}) {
  return {
    beams: [{ start: [0, 0, 0], end: [2, 0, 0] }],
    onDuration: 2,
    offDuration: 2,
    offset: 0,
    ...overrides
  };
}

/** Advance laser past the 1 s grace period. */
function expireGrace(laser) {
  laser.update(1.0, null);
}

/** Advance by N fixed-timestep ticks. */
function tickN(laser, n) {
  for (let i = 0; i < n; i++) {
    laser.update(DT, null);
  }
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
    CANNON.Body.SLEEPING = SLEEPING;
  });

  // --- Registry ---

  describe('registry', () => {
    it('is registered as laser_grid in MechanicRegistry', () => {
      expect(getRegisteredTypes()).toContain('laser_grid');
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
        makeConfig({ onDuration: 3, offDuration: 1.5 }),
        SURFACE_HEIGHT
      );

      expect(laser.onDuration).toBe(3);
      expect(laser.offDuration).toBe(1.5);
    });

    it('throws when beams is not provided', () => {
      expect(() => new LaserGrid(world, group, {}, SURFACE_HEIGHT)).toThrow(
        'LaserGrid: missing required config field "beams"'
      );
    });

    it('uses default values when optional config fields are missing', () => {
      const laser = new LaserGrid(world, group, { beams: [] }, SURFACE_HEIGHT);

      expect(laser.onDuration).toBe(2);
      expect(laser.offDuration).toBe(2);
      expect(laser.beamWidth).toBe(0.05);
      expect(laser.beamColor).toBe(HAZARD_COLORS.danger);
    });

    it('applies custom width and color from config', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ width: 0.1, color: 0x00ff00 }),
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

    it('starts with collisionResponse false during grace period', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);

      expect(laser.beamData[0].body.collisionResponse).toBe(false);
      expect(laser.isActive).toBe(false);
      expect(laser._inGrace).toBe(true);
    });
  });

  // --- Grace period ---

  describe('grace period', () => {
    it('stays inactive for the first 1 s regardless of offset', () => {
      // offset 0 would normally start in active phase
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 2, offDuration: 2, offset: 0 }),
        SURFACE_HEIGHT
      );

      // Advance 59 ticks (~0.983 s) — still in grace
      tickN(laser, 59);
      expect(laser.isActive).toBe(false);
      expect(laser.beamData[0].body.collisionResponse).toBe(false);
    });

    it('exits grace after 1 s and transitions to active phase', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 2, offDuration: 2, offset: 0 }),
        SURFACE_HEIGHT
      );

      // Advance 61 ticks (~1.017 s) — grace expired, should be active now
      tickN(laser, 61);
      expect(laser.isActive).toBe(true);
      expect(laser.beamData[0].body.collisionResponse).toBe(true);
    });

    it('grace period resets on onDtSpike', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);
      tickN(laser, 61); // exit grace
      expect(laser._inGrace).toBe(false);

      laser.onDtSpike();
      expect(laser._inGrace).toBe(true);
      expect(laser._graceTimer).toBe(0);
    });
  });

  // --- collisionResponse toggling ---

  describe('collisionResponse toggling', () => {
    it('body.collisionResponse is true during active phase', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 2, offDuration: 2 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser); // exits grace; cyclePos ~1/60 < 2 → active

      expect(laser.beamData[0].body.collisionResponse).toBe(true);
    });

    it('body.collisionResponse is false during inactive phase', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 1, offDuration: 1 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser); // grace expired, timer = 0; active

      // +1 tick to reliably cross the onDuration boundary despite fp rounding
      tickN(laser, Math.ceil(1 / DT) + 1);
      expect(laser.isActive).toBe(false);
      expect(laser.beamData[0].body.collisionResponse).toBe(false);
    });

    it('flips back to active after offDuration elapses (1/60 s ticks)', () => {
      const activeDuration = 1.5;
      const inactiveDuration = 1.0;
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: activeDuration, offDuration: inactiveDuration }),
        SURFACE_HEIGHT
      );

      // Expire grace
      expireGrace(laser);

      // Advance through onDuration → should flip to inactive (+1 for fp safety)
      tickN(laser, Math.ceil(activeDuration / DT) + 1);
      expect(laser.isActive).toBe(false);
      expect(laser.beamData[0].body.collisionResponse).toBe(false);

      // Advance through offDuration → should flip back to active (+1 for fp safety)
      tickN(laser, Math.ceil(inactiveDuration / DT) + 1);
      expect(laser.isActive).toBe(true);
      expect(laser.beamData[0].body.collisionResponse).toBe(true);
    });

    it('toggles collisionResponse on all beams simultaneously', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({
          beams: [
            { start: [0, 0, 0], end: [2, 0, 0] },
            { start: [0, 0, 1], end: [2, 0, 1] }
          ],
          onDuration: 1,
          offDuration: 1
        }),
        SURFACE_HEIGHT
      );

      expireGrace(laser);
      expect(laser.beamData[0].body.collisionResponse).toBe(true);
      expect(laser.beamData[1].body.collisionResponse).toBe(true);

      tickN(laser, Math.ceil(1 / DT));
      expect(laser.beamData[0].body.collisionResponse).toBe(false);
      expect(laser.beamData[1].body.collisionResponse).toBe(false);
    });
  });

  // --- LASER_GRID_STATE_CHANGE event ---

  describe('LASER_GRID_STATE_CHANGE event', () => {
    it('emits event with { active: true } when transitioning to active', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 2, offDuration: 2 }),
        SURFACE_HEIGHT
      );
      const mockPublish = jest.fn();
      laser.eventManager = { publish: mockPublish };

      expireGrace(laser); // transitions from grace (inactive) to active

      expect(mockPublish).toHaveBeenCalledWith(EventTypes.LASER_GRID_STATE_CHANGE, {
        active: true
      });
    });

    it('emits event with { active: false } when transitioning to inactive', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 1, offDuration: 1 }),
        SURFACE_HEIGHT
      );
      const mockPublish = jest.fn();
      laser.eventManager = { publish: mockPublish };

      expireGrace(laser);
      mockPublish.mockClear();

      tickN(laser, Math.ceil(1 / DT)); // advance through active phase

      expect(mockPublish).toHaveBeenCalledWith(EventTypes.LASER_GRID_STATE_CHANGE, {
        active: false
      });
    });

    it('does not throw when eventManager is absent', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(() => expireGrace(laser)).not.toThrow();
    });
  });

  // --- Timer cycling ---

  describe('timer cycling', () => {
    it('starts inactive during grace period', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(laser.isActive).toBe(false);
    });

    it('becomes active after grace period with offset 0', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);
      expireGrace(laser);
      expect(laser.isActive).toBe(true);
    });

    it('transitions to inactive after onDuration elapses', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 1, offDuration: 1 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser);

      tickN(laser, Math.ceil(1 / DT));
      expect(laser.isActive).toBe(false);
    });

    it('cycles back to active after full cycle', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 1, offDuration: 1 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser);

      tickN(laser, Math.ceil(2 / DT) + 1); // full cycle + 1 tick for fp safety
      expect(laser.isActive).toBe(true);
    });

    it('respects offset to start mid-cycle (inactive phase)', () => {
      // offset 0.5 of 4 s cycle = start at 2 s → in offDuration (2–4 s)
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 2, offDuration: 2, offset: 0.5 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser);

      // After grace timer starts at 2 s in cycle → inactive phase
      expect(laser.isActive).toBe(false);
    });

    it('shows beams when active, hides when inactive', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 1, offDuration: 1 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser);
      expect(laser.meshes[0].visible).toBe(true);

      tickN(laser, Math.ceil(1 / DT));
      expect(laser.meshes[0].visible).toBe(false);
    });
  });

  // --- Warn flash ---

  describe('warn flash', () => {
    it('shows warn flash 0.1 s before reactivation', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 1, offDuration: 1 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser);

      // Advance to just before cycle wraps: active(1) + inactive(1) = 2 s cycle
      // We need to be 0.05 s before the 2 s mark: advance 1.95 s of timer time
      tickN(laser, Math.ceil(1.95 / DT));
      expect(laser.isActive).toBe(false);
      expect(laser.isWarning).toBe(true);
      expect(laser.meshes[0].visible).toBe(true);
    });

    it('warn flash has reduced opacity', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 1, offDuration: 1 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser);

      tickN(laser, Math.ceil(1.95 / DT));
      expect(laser.meshes[0].material.opacity).toBe(0.3);
    });
  });

  // --- Emissive lerp ---

  describe('emissive color lerp', () => {
    it('_emissiveT starts at 0 (inactive color)', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(laser._emissiveT).toBe(0);
    });

    it('_emissiveT increases toward 1 after becoming active', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);
      expireGrace(laser); // now active

      const t0 = laser._emissiveT;
      laser.update(DT, null);
      expect(laser._emissiveT).toBeGreaterThan(t0);
    });

    it('_emissiveT decreases toward 0 after becoming inactive', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 1, offDuration: 2 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser);
      // Advance to fully active emissive
      tickN(laser, 30);
      const tBefore = laser._emissiveT;

      // Advance past active phase → inactive
      tickN(laser, Math.ceil(1 / DT));
      expect(laser._emissiveT).toBeLessThan(tBefore);
    });
  });

  // --- Danger-tier emissive pulse ---

  describe('danger-tier emissive pulse', () => {
    it('sets emissiveIntensity on beam materials when active', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 5, offDuration: 1 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser);
      laser.update(DT, null);

      expect(laser.beamData[0].mesh.material.emissiveIntensity).toBeDefined();
      expect(laser.beamData[0].mesh.material.emissiveIntensity).toBeGreaterThan(0);
    });

    it('emissiveIntensity changes between two update calls (1.5 Hz pulse)', () => {
      const laser = new LaserGrid(
        world,
        group,
        makeConfig({ onDuration: 5, offDuration: 1 }),
        SURFACE_HEIGHT
      );
      expireGrace(laser);

      laser.update(DT, null);
      const intensity1 = laser.beamData[0].mesh.material.emissiveIntensity;
      laser.update(DT, null);
      const intensity2 = laser.beamData[0].mesh.material.emissiveIntensity;

      expect(intensity1).not.toBeCloseTo(intensity2, 5);
    });
  });

  // --- onDtSpike ---

  describe('onDtSpike', () => {
    it('resets timer, state, and re-enters grace period', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);
      expireGrace(laser);
      laser.onDtSpike();

      expect(laser.timer).toBe(0);
      expect(laser.isActive).toBe(false);
      expect(laser.isWarning).toBe(false);
      expect(laser._inGrace).toBe(true);
      expect(laser._graceTimer).toBe(0);
    });

    it('sets collisionResponse false on all bodies after spike', () => {
      const laser = new LaserGrid(world, group, makeConfig(), SURFACE_HEIGHT);
      expireGrace(laser); // collisionResponse = true
      laser.onDtSpike();

      for (const beam of laser.beamData) {
        expect(beam.body.collisionResponse).toBe(false);
      }
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
});
