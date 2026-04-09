/**
 * Unit tests for PortalGate mechanic
 * ISSUE-004
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { PortalGate } from '../../mechanics/PortalGate';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js for PortalGate tests
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Body.mockImplementation(() => ({
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }),
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }),
    },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn() },
    addShape: jest.fn(),
    wakeUp: jest.fn(),
    userData: {},
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
        }),
      },
      rotation: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1, copy: jest.fn() },
      castShadow: false,
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() },
    };
    mesh.parent = null;
    return mesh;
  });

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, dispose: jest.fn() };
    if (opts) Object.assign(mat, opts);
    return mat;
  });

  THREE.RingGeometry = jest.fn(() => ({ dispose: jest.fn() }));
  THREE.CircleGeometry = jest.fn(() => ({ dispose: jest.fn() }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
  };
}

function makeMockGroup() {
  const children = [];
  return {
    add: jest.fn(child => children.push(child)),
    remove: jest.fn(child => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
    }),
    children,
  };
}

function makeConfig(overrides = {}) {
  return {
    entryPosition: { x: -3, y: 0, z: 2 },
    exitPosition: { x: 3, y: 0, z: -5 },
    radius: 0.6,
    ...overrides,
  };
}

function makeBallBody(x = 0, y = 0.5, z = 0) {
  const body = new CANNON.Body();
  body.position.x = x;
  body.position.y = y;
  body.position.z = z;
  body.velocity.x = 1;
  body.velocity.y = 0;
  body.velocity.z = -1;
  return body;
}

// ---------------------------------------------------------------------------
// PortalGate
// ---------------------------------------------------------------------------

describe('PortalGate', () => {
  let world, group, config;
  const surfaceHeight = 0.2;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    config = makeConfig();
  });

  // --- Constructor / Visuals ---

  describe('constructor', () => {
    it('creates 4 meshes (ring + disc for entry and exit)', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      // 2 meshes per portal (ring + inner glow disc) x 2 portals = 4
      expect(portal.meshes).toHaveLength(4);
      expect(group.add).toHaveBeenCalledTimes(4);
    });

    it('stores entry and exit coordinates from config', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      expect(portal.entryX).toBe(-3);
      expect(portal.entryZ).toBe(2);
      expect(portal.exitX).toBe(3);
      expect(portal.exitZ).toBe(-5);
    });

    it('calculates exit Y from surfaceHeight', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      expect(portal.exitY).toBeCloseTo(surfaceHeight + 0.3, 5);
    });

    it('stores radius from config', () => {
      const portal = new PortalGate(world, group, makeConfig({ radius: 1.2 }), surfaceHeight);

      expect(portal.radius).toBe(1.2);
    });

    it('uses default radius when not specified', () => {
      const portal = new PortalGate(world, group, { entryPosition: { x: 0, y: 0, z: 0 }, exitPosition: { x: 1, y: 0, z: 1 } }, surfaceHeight);

      expect(portal.radius).toBe(0.6);
    });

    it('initializes cooldown to 0', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      expect(portal.cooldown).toBe(0);
    });

    it('creates no physics bodies', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      expect(portal.bodies).toHaveLength(0);
      expect(world.addBody).not.toHaveBeenCalled();
    });

    it('positions entry ring meshes at entry position', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      // First mesh is the entry ring
      const entryRing = portal.meshes[0];
      expect(entryRing.position.set).toHaveBeenCalledWith(-3, surfaceHeight + 0.01, 2);
    });

    it('positions exit ring meshes at exit position', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      // Third mesh is the exit ring
      const exitRing = portal.meshes[2];
      expect(exitRing.position.set).toHaveBeenCalledWith(3, surfaceHeight + 0.01, -5);
    });

    it('creates emissive materials for portal rings', () => {
      const portal = new PortalGate(world, group, makeConfig({ color: 0xff0000 }), surfaceHeight);

      // MeshStandardMaterial should have been called with emissive properties
      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          emissive: 0xff0000,
          emissiveIntensity: 0.6,
        })
      );
    });

    it('uses default color when not specified', () => {
      const portal = new PortalGate(world, group, { entryPosition: { x: 0, y: 0, z: 0 }, exitPosition: { x: 1, y: 0, z: 1 } }, surfaceHeight);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 0x8800ff,
        })
      );
    });
  });

  // --- Teleportation ---

  describe('teleportation', () => {
    it('teleports ball to exit position when ball enters entry zone', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);
      // Place ball exactly at entry position
      const ball = makeBallBody(-3, 0.5, 2);

      portal.update(0.016, ball);

      expect(ball.position.set).toHaveBeenCalledWith(portal.exitX, portal.exitY, portal.exitZ);
    });

    it('teleports ball when within radius of entry portal', () => {
      const portal = new PortalGate(world, group, makeConfig({ radius: 1.0 }), surfaceHeight);
      // Place ball 0.5 units from entry (within radius of 1.0)
      const ball = makeBallBody(-2.5, 0.5, 2);

      portal.update(0.016, ball);

      expect(ball.position.set).toHaveBeenCalledWith(portal.exitX, portal.exitY, portal.exitZ);
    });

    it('does not teleport ball when outside entry zone', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);
      // Place ball far from entry
      const ball = makeBallBody(0, 0.5, 0);

      portal.update(0.016, ball);

      // position.set was called during makeBallBody construction, but not for teleport
      expect(ball.position.set).not.toHaveBeenCalledWith(portal.exitX, portal.exitY, portal.exitZ);
    });

    it('wakes up the ball body after teleport', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);
      const ball = makeBallBody(-3, 0.5, 2);

      portal.update(0.016, ball);

      expect(ball.wakeUp).toHaveBeenCalled();
    });

    it('does not teleport ball at exit position (only entry triggers)', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);
      // Place ball at exit position
      const ball = makeBallBody(3, 0.5, -5);

      portal.update(0.016, ball);

      // Should not re-teleport
      expect(ball.position.set).not.toHaveBeenCalledWith(portal.exitX, portal.exitY, portal.exitZ);
    });

    it('preserves ball velocity after teleport (direction and magnitude)', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);
      const ball = makeBallBody(-3, 0.5, 2);
      ball.velocity.x = 2.5;
      ball.velocity.y = 0;
      ball.velocity.z = -1.5;

      portal.update(0.016, ball);

      // Velocity should not be changed by PortalGate
      expect(ball.velocity.x).toBe(2.5);
      expect(ball.velocity.y).toBe(0);
      expect(ball.velocity.z).toBe(-1.5);
    });

    it('teleports ball at exact boundary of radius', () => {
      const portal = new PortalGate(world, group, makeConfig({ radius: 1.0 }), surfaceHeight);
      // Place ball exactly at radius distance along X from entry
      const ball = makeBallBody(-3 + 1.0, 0.5, 2);

      portal.update(0.016, ball);

      // dx^2 + dz^2 = 1.0^2 = 1.0, radius^2 = 1.0, so <= passes
      expect(ball.position.set).toHaveBeenCalledWith(portal.exitX, portal.exitY, portal.exitZ);
    });

    it('does not teleport ball just outside radius', () => {
      const portal = new PortalGate(world, group, makeConfig({ radius: 1.0 }), surfaceHeight);
      // Place ball just outside radius
      const ball = makeBallBody(-3 + 1.01, 0.5, 2);

      portal.update(0.016, ball);

      expect(ball.position.set).not.toHaveBeenCalledWith(portal.exitX, portal.exitY, portal.exitZ);
    });
  });

  // --- Cooldown ---

  describe('cooldown', () => {
    it('sets cooldown to 1.0 after teleport', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);
      const ball = makeBallBody(-3, 0.5, 2);

      portal.update(0.016, ball);

      expect(portal.cooldown).toBe(1.0);
    });

    it('prevents re-trigger during cooldown period', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);
      const ball = makeBallBody(-3, 0.5, 2);

      // First trigger
      portal.update(0.016, ball);
      ball.position.set.mockClear();

      // Move ball back to entry during cooldown
      ball.position.x = -3;
      ball.position.z = 2;

      // Should not teleport during cooldown
      portal.update(0.5, ball);
      expect(ball.position.set).not.toHaveBeenCalledWith(portal.exitX, portal.exitY, portal.exitZ);
    });

    it('decrements cooldown each frame', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);
      const ball = makeBallBody(-3, 0.5, 2);

      portal.update(0.016, ball);
      expect(portal.cooldown).toBe(1.0);

      // Move ball away so it doesn't re-trigger
      ball.position.x = 0;
      ball.position.z = 0;

      portal.update(0.3, ball);
      expect(portal.cooldown).toBeCloseTo(0.7, 5);

      portal.update(0.3, ball);
      expect(portal.cooldown).toBeCloseTo(0.4, 5);
    });

    it('allows re-trigger after cooldown expires', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);
      const ball = makeBallBody(-3, 0.5, 2);

      // First teleport
      portal.update(0.016, ball);
      ball.position.set.mockClear();

      // Wait for cooldown to expire (move ball away first)
      ball.position.x = 0;
      ball.position.z = 0;
      portal.update(1.1, ball); // cooldown fully expires

      // Move ball back to entry
      ball.position.x = -3;
      ball.position.z = 2;
      portal.update(0.016, ball);

      expect(ball.position.set).toHaveBeenCalledWith(portal.exitX, portal.exitY, portal.exitZ);
    });

    it('returns early during cooldown without checking ball position', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      // Trigger cooldown
      portal.cooldown = 0.5;

      const ball = makeBallBody(-3, 0.5, 2);
      portal.update(0.1, ball);

      // Should not teleport, just decrement cooldown
      expect(ball.position.set).not.toHaveBeenCalledWith(portal.exitX, portal.exitY, portal.exitZ);
      expect(portal.cooldown).toBeCloseTo(0.4, 5);
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('does not throw when ballBody is null', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      expect(() => portal.update(0.016, null)).not.toThrow();
    });

    it('does not throw when ballBody is undefined', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      expect(() => portal.update(0.016, undefined)).not.toThrow();
    });

    it('handles zero dt without error', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);
      const ball = makeBallBody(0, 0.5, 0);

      expect(() => portal.update(0, ball)).not.toThrow();
    });

    it('uses default positions when config positions are missing', () => {
      const portal = new PortalGate(world, group, {}, surfaceHeight);

      expect(portal.entryX).toBe(-3);
      expect(portal.entryZ).toBe(2);
      expect(portal.exitX).toBe(3);
      expect(portal.exitZ).toBe(-5);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('removes all meshes and disposes geometry/materials', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      expect(portal.meshes).toHaveLength(4);

      portal.destroy();

      expect(portal.meshes).toEqual([]);
    });

    it('clears bodies array', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      portal.destroy();

      expect(portal.bodies).toEqual([]);
    });

    it('can be called multiple times without error', () => {
      const portal = new PortalGate(world, group, config, surfaceHeight);

      portal.destroy();
      expect(() => portal.destroy()).not.toThrow();
    });
  });

  // --- Registry ---

  describe('registry', () => {
    it('registers with MechanicRegistry as portal_gate', () => {
      const types = getRegisteredTypes();

      expect(types).toContain('portal_gate');
    });
  });
});
