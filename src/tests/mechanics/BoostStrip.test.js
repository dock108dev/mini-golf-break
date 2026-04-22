/**
 * Unit tests for BoostStrip mechanic
 * ISSUE-028
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

const SLEEPING = 2;

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Body.SLEEPING = SLEEPING;

  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z
  }));

  CANNON.Body.mockImplementation(() => ({
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn(), setFromAxisAngle: jest.fn() },
    addShape: jest.fn(),
    userData: {}
  }));

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
      material: { dispose: jest.fn(), transparent: true, opacity: 0.85 }
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

  THREE.PlaneGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn()
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

function makeBallBody(x = 0, z = 0) {
  return {
    position: { x, y: 0.2, z },
    velocity: { x: 0, y: 0, z: 0 },
    sleepState: 0,
    wakeUp: jest.fn()
  };
}

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoostStrip', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    position: { x: 0, y: 0, z: 0 },
    boost_direction: { x: 0, y: 0, z: -1 },
    boost_magnitude: 10,
    size: { width: 2, length: 4 }
  };

  // --- Registry ---

  describe('registry', () => {
    it('is registered as boost_strip in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('boost_strip');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a visual mesh and adds it to the group', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.meshes).toHaveLength(1);
      expect(group.add).toHaveBeenCalled();
    });

    it('creates a trigger physics body', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.bodies).toHaveLength(1);
      expect(world.addBody).toHaveBeenCalledWith(strip.triggerBody);
    });

    it('sets isForceField to true', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.isForceField).toBe(true);
    });

    it('normalizes boost_direction from config', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip._boostDir.z).toBeCloseTo(-1);
      expect(strip._boostDir.x).toBeCloseTo(0);
      expect(strip._boostDir.y).toBeCloseTo(0);
    });

    it('stores boost_magnitude from config', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip._boostMagnitude).toBe(10);
    });

    it('normalizes a diagonal boost_direction to unit length', () => {
      const config = {
        ...defaultConfig,
        boost_direction: { x: 1, y: 0, z: -1 }
      };
      const strip = new BoostStrip(world, group, config, SURFACE_HEIGHT);
      const len = Math.sqrt(
        strip._boostDir.x ** 2 + strip._boostDir.y ** 2 + strip._boostDir.z ** 2
      );

      expect(len).toBeCloseTo(1);
    });

    it('uses default boost_magnitude (12) when not provided', () => {
      const strip = new BoostStrip(world, group, {}, SURFACE_HEIGHT);

      expect(strip._boostMagnitude).toBe(12);
    });

    it('uses defaults when config fields are missing', () => {
      const strip = new BoostStrip(world, group, {}, SURFACE_HEIGHT);

      expect(strip.meshes).toHaveLength(1);
      expect(strip.bodies).toHaveLength(1);
    });

    it('initializes _boostCooldown to zero', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip._boostCooldown).toBe(0);
    });

    it('sets trigger body userData type to boost_strip', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.triggerBody.userData.type).toBe('boost_strip');
    });

    it('applies theme color when no config color is set', () => {
      const theme = { mechanics: { boostStrip: { color: 0x123456 } } };
      new BoostStrip(world, group, { ...defaultConfig, color: undefined }, SURFACE_HEIGHT, theme);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x123456 })
      );
    });

    it('warns and uses default when boost_magnitude is <= 0', () => {
      new BoostStrip(world, group, { ...defaultConfig, boost_magnitude: -5 }, SURFACE_HEIGHT);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('boost_magnitude must be > 0')
      );
    });
  });

  // --- Update / impulse ---

  describe('update — velocity impulse', () => {
    it('adds boost_direction * boost_magnitude to ball velocity when in zone', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(strip.triggerBody.position.x, strip.triggerBody.position.z);

      strip.update(0.016, ball);

      // boost_direction is [0,0,-1], magnitude 10 → velocity.z -= 10
      expect(ball.velocity.z).toBeCloseTo(-10);
      expect(ball.velocity.x).toBeCloseTo(0);
    });

    it('does not modify velocity when ball is outside zone', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(100, 100);

      strip.update(0.016, ball);

      expect(ball.velocity.z).toBe(0);
    });

    it('wakes sleeping ball before applying impulse', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(strip.triggerBody.position.x, strip.triggerBody.position.z);
      ball.sleepState = SLEEPING;

      strip.update(0.016, ball);

      expect(ball.wakeUp).toHaveBeenCalled();
      expect(ball.velocity.z).toBeCloseTo(-10);
    });

    it('does not throw when ballBody is null', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(() => strip.update(0.016, null)).not.toThrow();
    });

    it('does not re-trigger within 0.8s cooldown window', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(strip.triggerBody.position.x, strip.triggerBody.position.z);

      strip.update(0.016, ball); // first contact — boost fires
      const velocityAfterFirst = ball.velocity.z;

      strip.update(0.016, ball); // still in zone, cooldown active — should not fire
      expect(ball.velocity.z).toBeCloseTo(velocityAfterFirst);
    });

    it('re-triggers after cooldown expires (> 0.8s elapsed)', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(strip.triggerBody.position.x, strip.triggerBody.position.z);

      strip.update(0.016, ball);
      const velocityAfterFirst = ball.velocity.z;

      strip.update(0.9, ball); // advance past 0.8s cooldown
      expect(ball.velocity.z).toBeCloseTo(velocityAfterFirst - 10);
    });

    it('decrements _boostCooldown each frame', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      strip._boostCooldown = 0.8;

      strip.update(0.1, null);

      expect(strip._boostCooldown).toBeCloseTo(0.7);
    });
  });

  // --- UV scroll ---

  describe('UV scrolling', () => {
    it('advances _uvOffset by UV_SCROLL_SPEED * dt each frame', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      strip.update(0.1, null);

      expect(strip._uvOffset).toBeCloseTo(0.1 * 0.3);
    });

    it('_uvOffset accumulates across multiple frames', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      strip.update(0.1, null);
      strip.update(0.2, null);

      expect(strip._uvOffset).toBeCloseTo(0.3 * 0.3);
    });
  });

  // --- Reward-tier emissive pulse ---

  describe('reward-tier emissive pulse', () => {
    it('sets emissiveIntensity on mesh material during update', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      strip.update(0.1, null);

      expect(strip.mesh.material.emissiveIntensity).toBeDefined();
      expect(strip.mesh.material.emissiveIntensity).toBeGreaterThan(0);
    });

    it('emissiveIntensity changes between two update calls (0.5 Hz pulse)', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      strip.update(0.1, null);
      const intensity1 = strip.mesh.material.emissiveIntensity;

      strip.update(0.5, null);
      const intensity2 = strip.mesh.material.emissiveIntensity;

      expect(intensity1).not.toBeCloseTo(intensity2, 5);
    });

    it('emissiveIntensity does not change when dt is zero', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      strip.update(0.1, null);
      const intensity1 = strip.mesh.material.emissiveIntensity;

      strip.update(0, null);
      const intensity2 = strip.mesh.material.emissiveIntensity;

      expect(intensity1).toBeCloseTo(intensity2, 5);
    });
  });

  // --- onDtSpike ---

  describe('onDtSpike', () => {
    it('resets _boostCooldown to zero', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);
      strip._boostCooldown = 0.5;

      strip.onDtSpike();

      expect(strip._boostCooldown).toBe(0);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up meshes and bodies', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(strip.meshes).toHaveLength(1);
      expect(strip.bodies).toHaveLength(1);

      strip.destroy();

      expect(strip.meshes).toEqual([]);
      expect(strip.bodies).toEqual([]);
      expect(world.removeBody).toHaveBeenCalled();
    });

    it('can be called multiple times without error', () => {
      const strip = new BoostStrip(world, group, defaultConfig, SURFACE_HEIGHT);

      strip.destroy();
      expect(() => strip.destroy()).not.toThrow();
    });
  });
});
