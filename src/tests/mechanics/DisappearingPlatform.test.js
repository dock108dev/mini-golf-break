/**
 * Unit tests for DisappearingPlatform mechanic
 * ISSUE-004
 */

import * as CANNON from 'cannon-es';
import { DisappearingPlatform } from '../../mechanics/DisappearingPlatform';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// Import to trigger registration
import '../../mechanics/DisappearingPlatform';

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
    sleepState: 0,
    applyImpulse: jest.fn()
  };
}

function makeConfig(overrides = {}) {
  return {
    platforms: [
      {
        position: [1, 0, 2],
        size: [2, 0.15, 2],
        onDuration: 3,
        offDuration: 2,
        offset: 0
      }
    ],
    hazardBelowY: -1,
    ...overrides
  };
}

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DisappearingPlatform', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    CANNON.Body.SLEEPING = SLEEPING;
  });

  // --- Registry ---

  describe('registry', () => {
    it('is registered as disappearing_platform in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('disappearing_platform');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a mesh, strip mesh, and body for each platform', () => {
      const dp = new DisappearingPlatform(world, group, makeConfig(), SURFACE_HEIGHT);

      // 1 platform = 2 meshes (platform + strip) + 1 body
      expect(dp.meshes.length).toBe(2);
      expect(dp.bodies.length).toBe(1);
      expect(group.add).toHaveBeenCalledTimes(2);
      expect(world.addBody).toHaveBeenCalledTimes(1);
    });

    it('creates multiple independent platforms', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 2, offDuration: 1, offset: 0 },
          { position: [5, 0, 5], size: [1, 0.1, 1], onDuration: 1, offDuration: 3, offset: 0.5 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      expect(dp.platformData.length).toBe(2);
      expect(dp.meshes.length).toBe(4);
      expect(dp.bodies.length).toBe(2);
    });

    it('stores hazardBelowY from config', () => {
      const dp = new DisappearingPlatform(
        world,
        group,
        makeConfig({ hazardBelowY: -3 }),
        SURFACE_HEIGHT
      );
      expect(dp.hazardBelowY).toBe(-3);
    });

    it('throws when platforms field is missing', () => {
      expect(() => new DisappearingPlatform(world, group, {}, SURFACE_HEIGHT)).toThrow(
        'DisappearingPlatform: missing required config field "platforms"'
      );
    });

    it('defaults hazardBelowY relative to surface height', () => {
      const dp = new DisappearingPlatform(world, group, { platforms: [] }, SURFACE_HEIGHT);
      expect(dp.hazardBelowY).toBe(SURFACE_HEIGHT - 2);
    });

    it('handles object-style position and size', () => {
      const config = makeConfig({
        platforms: [
          {
            position: { x: 1, y: 0, z: 2 },
            size: { width: 3, height: 0.2, depth: 4 },
            onDuration: 2,
            offDuration: 1,
            offset: 0
          }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      expect(dp.platformData.length).toBe(1);
      expect(dp.platformData[0].width).toBe(3);
      expect(dp.platformData[0].depth).toBe(4);
    });

    it('creates no platforms when array is empty', () => {
      const dp = new DisappearingPlatform(
        world,
        group,
        makeConfig({ platforms: [] }),
        SURFACE_HEIGHT
      );

      expect(dp.platformData.length).toBe(0);
      expect(dp.meshes.length).toBe(0);
      expect(dp.bodies.length).toBe(0);
    });
  });

  // --- Timer cycling ---

  describe('timer cycling', () => {
    it('starts in on state when offset is 0', () => {
      const dp = new DisappearingPlatform(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(dp.platformData[0].isOn).toBe(true);
    });

    it('transitions to off after onDuration elapses', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 1, offDuration: 1, offset: 0 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      dp.update(1.1, null);
      expect(dp.platformData[0].isOn).toBe(false);
    });

    it('cycles back to on after full cycle', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 1, offDuration: 1, offset: 0 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      dp.update(2.1, null);
      expect(dp.platformData[0].isOn).toBe(true);
    });

    it('respects offset to start mid-cycle', () => {
      // offset 0.6 with cycle 5s = start at 3s, which is in offDuration (on=3, off=2)
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 3, offDuration: 2, offset: 0.6 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      expect(dp.platformData[0].isOn).toBe(false);
    });

    it('multiple platforms with different offsets run independently', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 1, offDuration: 1, offset: 0 },
          { position: [5, 0, 0], size: [1, 0.1, 1], onDuration: 1, offDuration: 1, offset: 0.5 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      // Platform 0: timer=0 => on, Platform 1: timer=1 => off
      expect(dp.platformData[0].isOn).toBe(true);
      expect(dp.platformData[1].isOn).toBe(false);
    });
  });

  // --- Visibility and fade ---

  describe('visibility and fade', () => {
    it('platform is visible and has collision when on', () => {
      const dp = new DisappearingPlatform(world, group, makeConfig(), SURFACE_HEIGHT);
      const plat = dp.platformData[0];

      expect(plat.mesh.visible).toBe(true);
      expect(plat.body.collisionResponse).toBe(true);
    });

    it('platform becomes invisible after turning off and fading', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 1, offDuration: 2, offset: 0 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      // Advance past onDuration + fade time
      dp.update(1.3, null);
      const plat = dp.platformData[0];

      expect(plat.mesh.visible).toBe(false);
      expect(plat.body.collisionResponse).toBe(false);
    });

    it('collision disabled during fade-out', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 1, offDuration: 2, offset: 0 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      // Advance in small steps so we stay within onDuration, then one step past
      for (let i = 0; i < 100; i++) {
        dp.update(0.01, null);
      }
      // Now at t=1.0: isOn just turned false, fadeProgress still 1 from last on frame
      // One more small step to start fading
      dp.update(0.01, null);
      // t=1.01: off for 0.01s, fadeProgress = 1 - 0.01/0.2 = 0.95
      dp.update(0.05, null);
      // t=1.06: fadeProgress = 0.95 - 0.05/0.2 = 0.7
      const plat = dp.platformData[0];

      expect(plat.fadeProgress).toBeGreaterThan(0);
      expect(plat.fadeProgress).toBeLessThan(1);
      expect(plat.body.collisionResponse).toBe(false);
    });

    it('fades back in when turning on', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 1, offDuration: 1, offset: 0 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      // Turn off and fully fade
      dp.update(1.3, null);
      expect(dp.platformData[0].isOn).toBe(false);

      // Cycle back on and let fade-in complete
      dp.update(1.0, null);
      const plat = dp.platformData[0];
      expect(plat.isOn).toBe(true);
      expect(plat.fadeProgress).toBe(1);
      expect(plat.body.collisionResponse).toBe(true);
    });
  });

  // --- Warning flash ---

  describe('warning flash', () => {
    it('shows amber warning 0.3s before platform disappears', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 2, offDuration: 2, offset: 0 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      // Advance to 1.8s (0.2s before platform turns off at 2.0s)
      dp.update(1.8, null);
      const plat = dp.platformData[0];

      // Strip should show amber warning
      expect(plat.stripMesh.material.emissiveIntensity).toBe(0.6);
      expect(plat.stripMesh.material.opacity).toBe(0.7);
    });

    it('does not show warning when platform just turned on', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 2, offDuration: 2, offset: 0 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      // Small update, well before warning threshold
      dp.update(0.1, null);
      const plat = dp.platformData[0];

      // Strip should show default green
      expect(plat.stripMesh.material.emissiveIntensity).toBe(0.3);
      expect(plat.stripMesh.material.opacity).toBe(0.4);
    });
  });

  // --- Hazard / fall detection ---

  describe('fall detection', () => {
    it('applies impulse when ball falls below hazardBelowY', () => {
      const dp = new DisappearingPlatform(
        world,
        group,
        makeConfig({ hazardBelowY: -1 }),
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(0, -2, 0);
      dp.update(0.1, ball);

      expect(ball.applyImpulse).toHaveBeenCalled();
    });

    it('does not trigger reset when ball is above hazardBelowY', () => {
      const dp = new DisappearingPlatform(
        world,
        group,
        makeConfig({ hazardBelowY: -1 }),
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(0, 1, 0);
      dp.update(0.1, ball);

      expect(ball.applyImpulse).not.toHaveBeenCalled();
    });

    it('handles null ballBody gracefully', () => {
      const dp = new DisappearingPlatform(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(() => dp.update(0.1, null)).not.toThrow();
    });

    it('skips sleeping ball', () => {
      const dp = new DisappearingPlatform(
        world,
        group,
        makeConfig({ hazardBelowY: -1 }),
        SURFACE_HEIGHT
      );

      const ball = makeBallBody(0, -2, 0);
      ball.sleepState = SLEEPING;
      dp.update(0.1, ball);

      expect(ball.applyImpulse).not.toHaveBeenCalled();
    });
  });

  // --- onDtSpike ---

  describe('onDtSpike', () => {
    it('resets all platforms to on state', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 1, offDuration: 1, offset: 0 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      dp.update(1.5, null);
      expect(dp.platformData[0].isOn).toBe(false);

      dp.onDtSpike();
      expect(dp.platformData[0].timer).toBe(0);
      expect(dp.platformData[0].isOn).toBe(true);
      expect(dp.platformData[0].fadeProgress).toBe(1);
    });

    it('makes platform visible and solid after spike', () => {
      const config = makeConfig({
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 1, offDuration: 1, offset: 0 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      dp.update(1.5, null);
      dp.onDtSpike();

      const plat = dp.platformData[0];
      expect(plat.mesh.visible).toBe(true);
      expect(plat.body.collisionResponse).toBe(true);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    function addDisposeMocks(dp) {
      for (const mesh of dp.meshes) {
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
        platforms: [
          { position: [0, 0, 0], size: [1, 0.1, 1], onDuration: 2, offDuration: 1, offset: 0 },
          { position: [5, 0, 0], size: [1, 0.1, 1], onDuration: 1, offDuration: 2, offset: 0 }
        ]
      });
      const dp = new DisappearingPlatform(world, group, config, SURFACE_HEIGHT);

      expect(dp.meshes.length).toBe(4);
      expect(dp.bodies.length).toBe(2);

      addDisposeMocks(dp);
      dp.destroy();

      expect(dp.meshes).toEqual([]);
      expect(dp.bodies).toEqual([]);
      expect(world.removeBody).toHaveBeenCalledTimes(2);
    });

    it('can be called multiple times safely', () => {
      const dp = new DisappearingPlatform(world, group, makeConfig(), SURFACE_HEIGHT);

      addDisposeMocks(dp);
      dp.destroy();
      expect(() => dp.destroy()).not.toThrow();
    });
  });
});
