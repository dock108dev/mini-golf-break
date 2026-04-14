/**
 * Unit tests for GravityFunnel mechanic
 * ISSUE-005
 */

import * as CANNON from 'cannon-es';
import { GravityFunnel } from '../../mechanics/GravityFunnel';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// Import to trigger registration
import '../../mechanics/GravityFunnel';

// CANNON.Body.SLEEPING constant (matches cannon-es)
const SLEEPING = 2;

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

function makeBallBody(x = 0, y = 0, z = 0) {
  return {
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    sleepState: 0, // AWAKE
    wakeUp: jest.fn(),
    applyForce: jest.fn()
  };
}

function makeConfig(overrides = {}) {
  return {
    position: [0, 0, 0],
    radius: 3,
    exitPoint: [0, 0, -5],
    force: 2.0,
    ...overrides
  };
}

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GravityFunnel', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    CANNON.Body.SLEEPING = SLEEPING;
  });

  // --- Registry ---

  describe('registry', () => {
    it('is registered as gravity_funnel in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('gravity_funnel');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates visual meshes (ring, disc, arrow)', () => {
      const funnel = new GravityFunnel(world, group, makeConfig(), SURFACE_HEIGHT);

      expect(funnel.meshes.length).toBe(3);
      expect(group.add).toHaveBeenCalledTimes(3);
    });

    it('sets isForceField to true', () => {
      const funnel = new GravityFunnel(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(funnel.isForceField).toBe(true);
    });

    it('throws when position field is missing', () => {
      expect(
        () => new GravityFunnel(world, group, { exitPoint: [0, 0, -5] }, SURFACE_HEIGHT)
      ).toThrow('GravityFunnel: missing required config field "position"');
    });

    it('throws when exitPoint field is missing', () => {
      expect(
        () => new GravityFunnel(world, group, { position: [0, 0, 0] }, SURFACE_HEIGHT)
      ).toThrow('GravityFunnel: missing required config field "exitPoint"');
    });

    it('uses default force when not specified', () => {
      const config = makeConfig();
      delete config.force;
      const funnel = new GravityFunnel(world, group, config, SURFACE_HEIGHT);
      expect(funnel.force).toBe(2.0);
    });

    it('accepts custom color', () => {
      const funnel = new GravityFunnel(
        world,
        group,
        makeConfig({ color: 0xff0000 }),
        SURFACE_HEIGHT
      );
      // Ring mesh should use the custom color
      expect(funnel.ringMesh.material.color).toBeDefined();
    });

    it('stores center and radius from config', () => {
      const funnel = new GravityFunnel(
        world,
        group,
        makeConfig({ position: [5, 0, 3], radius: 4 }),
        SURFACE_HEIGHT
      );

      expect(funnel.centerX).toBe(5);
      expect(funnel.centerZ).toBe(3);
      expect(funnel.radius).toBe(4);
    });

    it('computes exit direction from center to exitPoint', () => {
      const funnel = new GravityFunnel(
        world,
        group,
        makeConfig({ position: [0, 0, 0], exitPoint: [3, 0, 0] }),
        SURFACE_HEIGHT
      );

      // Exit direction should be (1, 0) — pointing along +X
      expect(funnel.exitDirX).toBeCloseTo(1, 5);
      expect(funnel.exitDirZ).toBeCloseTo(0, 5);
    });

    it('uses default exit direction for degenerate exitPoint', () => {
      const funnel = new GravityFunnel(
        world,
        group,
        makeConfig({ position: [2, 0, 3], exitPoint: [2, 0, 3] }),
        SURFACE_HEIGHT
      );

      // Fallback direction (0, -1)
      expect(funnel.exitDirX).toBe(0);
      expect(funnel.exitDirZ).toBe(-1);
    });

    it('handles object-style position coordinates', () => {
      const funnel = new GravityFunnel(
        world,
        group,
        makeConfig({ position: { x: 1, y: 0, z: 2 }, exitPoint: { x: 4, y: 0, z: 2 } }),
        SURFACE_HEIGHT
      );

      expect(funnel.centerX).toBe(1);
      expect(funnel.centerZ).toBe(2);
      expect(funnel.exitDirX).toBeCloseTo(1, 5);
      expect(funnel.exitDirZ).toBeCloseTo(0, 5);
    });
  });

  // --- Force application ---

  describe('force application', () => {
    it('applies force to ball inside the zone', () => {
      const funnel = new GravityFunnel(world, group, makeConfig({ radius: 5 }), SURFACE_HEIGHT);

      const ball = makeBallBody(1, 0, 0);
      ball.velocity = { x: 2, y: 0, z: 0 };
      funnel.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalled();
    });

    it('does not apply force to ball outside the zone', () => {
      const funnel = new GravityFunnel(world, group, makeConfig({ radius: 2 }), SURFACE_HEIGHT);

      const ball = makeBallBody(10, 0, 10);
      funnel.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not apply vertical force (y component is always 0)', () => {
      const funnel = new GravityFunnel(world, group, makeConfig({ radius: 5 }), SURFACE_HEIGHT);

      const ball = makeBallBody(1, 0, 1);
      ball.velocity = { x: 3, y: 0, z: 1 };
      funnel.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalled();
      const forceArg = ball.applyForce.mock.calls[0][0];
      expect(forceArg.y).toBe(0);
    });

    it('ball aimed at exit (on-axis) receives minimal deflection', () => {
      // Exit is at (0, 0, -5) from center (0,0,0), so exit dir is (0, 0, -1)
      const funnel = new GravityFunnel(
        world,
        group,
        makeConfig({ position: [0, 0, 0], exitPoint: [0, 0, -5], radius: 5, force: 2.0 }),
        SURFACE_HEIGHT
      );

      // Ball moving exactly in exit direction — no lateral component
      const ball = makeBallBody(0, 0, 1);
      ball.velocity = { x: 0, y: 0, z: -3 };
      funnel.update(0.016, ball);

      if (ball.applyForce.mock.calls.length > 0) {
        const forceArg = ball.applyForce.mock.calls[0][0];
        // X force should be near zero (no lateral correction needed)
        expect(Math.abs(forceArg.x)).toBeLessThan(0.5);
      }
    });

    it('ball entering off-axis is redirected toward exit direction', () => {
      // Exit direction is (0, 0, -1)
      const funnel = new GravityFunnel(
        world,
        group,
        makeConfig({ position: [0, 0, 0], exitPoint: [0, 0, -5], radius: 5, force: 4.0 }),
        SURFACE_HEIGHT
      );

      // Ball moving perpendicular to exit — entirely lateral velocity
      const ball = makeBallBody(1, 0, 0);
      ball.velocity = { x: 3, y: 0, z: 0 };
      funnel.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalled();
      const forceArg = ball.applyForce.mock.calls[0][0];
      // Should apply corrective force in -X direction (opposing lateral motion)
      expect(forceArg.x).toBeLessThan(0);
      // Should also have a small push in -Z (exit direction)
      expect(forceArg.z).toBeLessThan(0);
    });

    it('force is stronger closer to the center (influence scaling)', () => {
      const funnel = new GravityFunnel(
        world,
        group,
        makeConfig({ position: [0, 0, 0], exitPoint: [0, 0, -5], radius: 10, force: 4.0 }),
        SURFACE_HEIGHT
      );

      // Ball near center
      const ballClose = makeBallBody(1, 0, 0);
      ballClose.velocity = { x: 3, y: 0, z: 0 };
      funnel.update(0.016, ballClose);

      // Ball near edge
      const ballFar = makeBallBody(9, 0, 0);
      ballFar.velocity = { x: 3, y: 0, z: 0 };
      funnel.update(0.016, ballFar);

      const forceClose = ballClose.applyForce.mock.calls[0][0];
      const forceFar = ballFar.applyForce.mock.calls[0][0];

      // Force magnitude should be greater near center
      const magClose = Math.sqrt(forceClose.x * forceClose.x + forceClose.z * forceClose.z);
      const magFar = Math.sqrt(forceFar.x * forceFar.x + forceFar.z * forceFar.z);
      expect(magClose).toBeGreaterThan(magFar);
    });

    it('force is additive — does not snap or teleport the ball', () => {
      const funnel = new GravityFunnel(world, group, makeConfig({ radius: 5 }), SURFACE_HEIGHT);

      const ball = makeBallBody(1, 0, 0);
      ball.velocity = { x: 2, y: 0, z: -1 };
      funnel.update(0.016, ball);

      // Ball position should not have changed (force-based, not teleport)
      expect(ball.position.x).toBe(1);
      expect(ball.position.z).toBe(0);
      // applyForce was used, not direct velocity manipulation
      expect(ball.applyForce).toHaveBeenCalled();
    });

    it('wakes sleeping ball inside the zone', () => {
      const funnel = new GravityFunnel(world, group, makeConfig({ radius: 5 }), SURFACE_HEIGHT);

      const ball = makeBallBody(1, 0, 0);
      ball.sleepState = SLEEPING;
      ball.velocity = { x: 0, y: 0, z: 0 };
      funnel.update(0.016, ball);

      expect(ball.wakeUp).toHaveBeenCalled();
    });

    it('handles null ballBody gracefully', () => {
      const funnel = new GravityFunnel(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(() => funnel.update(0.016, null)).not.toThrow();
    });

    it('handles ball exactly at center', () => {
      const funnel = new GravityFunnel(
        world,
        group,
        makeConfig({ position: [0, 0, 0], radius: 5 }),
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(0, 0, 0);
      ball.velocity = { x: 1, y: 0, z: 0 };
      expect(() => funnel.update(0.016, ball)).not.toThrow();
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    function addDisposeMocks(funnel) {
      for (const mesh of funnel.meshes) {
        if (mesh.geometry && !mesh.geometry.dispose) {
          mesh.geometry.dispose = jest.fn();
        }
        if (mesh.material && !mesh.material.dispose) {
          mesh.material.dispose = jest.fn();
        }
      }
    }

    it('cleans up all meshes', () => {
      const funnel = new GravityFunnel(world, group, makeConfig(), SURFACE_HEIGHT);

      expect(funnel.meshes.length).toBe(3);

      addDisposeMocks(funnel);
      funnel.destroy();

      expect(funnel.meshes).toEqual([]);
    });

    it('can be called multiple times safely', () => {
      const funnel = new GravityFunnel(world, group, makeConfig(), SURFACE_HEIGHT);

      addDisposeMocks(funnel);
      funnel.destroy();
      expect(() => funnel.destroy()).not.toThrow();
    });
  });
});
