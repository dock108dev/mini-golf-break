/**
 * Unit tests for SuctionZone mechanic
 * ISSUE-026
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { SuctionZone } from '../../mechanics/SuctionZone';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

const SLEEPING = 2;

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Body.SLEEPING = SLEEPING;

  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({ x, y, z }));

  THREE.Mesh.mockImplementation((_geometry, material) => {
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
      visible: true,
      geometry: { dispose: jest.fn() },
      material: material || { dispose: jest.fn(), transparent: true, opacity: 0.9 }
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

  THREE.TorusGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
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
    mass: 0.45,
    sleepState: 0,
    applyForce: jest.fn(),
    wakeUp: jest.fn()
  };
}

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SuctionZone', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    position: { x: 0, y: 0, z: 0 },
    radius: 5,
    force: 10
  };

  // --- Registry ---

  describe('registry', () => {
    it('is registered as suction_zone in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('suction_zone');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a visual mesh and adds it to the group', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(zone.meshes).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
    });

    it('creates no physics bodies', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(zone.bodies).toHaveLength(0);
    });

    it('sets isForceField to true', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(zone.isForceField).toBe(true);
    });

    it('stores center and radius from config', () => {
      const config = { position: { x: 3, y: 0, z: -4 }, radius: 7, force: 5 };
      const zone = new SuctionZone(world, group, config, SURFACE_HEIGHT);

      expect(zone.centerX).toBe(3);
      expect(zone.centerZ).toBe(-4);
      expect(zone.radius).toBe(7);
      expect(zone.force).toBe(5);
    });

    it('uses default values when config is minimal', () => {
      const zone = new SuctionZone(world, group, {}, SURFACE_HEIGHT);

      expect(zone.radius).toBe(3);
      expect(zone.force).toBe(6);
    });

    it('applies theme color when no config color is set', () => {
      const theme = { mechanics: { suctionZone: { color: 0x998877 } } };
      new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT, theme);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0x998877 })
      );
    });

    it('uses TorusGeometry for the visual ring', () => {
      new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(THREE.TorusGeometry).toHaveBeenCalledWith(
        defaultConfig.radius,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('warns when radius is zero or negative', () => {
      new SuctionZone(world, group, { ...defaultConfig, radius: 0 }, SURFACE_HEIGHT);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('outer_radius'));
    });

    it('warns when force is zero or negative', () => {
      new SuctionZone(world, group, { ...defaultConfig, force: -1 }, SURFACE_HEIGHT);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('suction_force'));
    });
  });

  // --- Update ---

  describe('update', () => {
    it('applies radial pull toward center when ball is in zone', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(3, 0);

      zone.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalledTimes(1);
      const force = ball.applyForce.mock.calls[0][0];
      expect(force.x).toBeLessThan(0);
      expect(force.y).toBe(0);
    });

    it('force direction changes based on ball position', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      const ball1 = makeBallBody(3, 0);
      zone.update(0.016, ball1);
      const f1 = ball1.applyForce.mock.calls[0][0];

      const ball2 = makeBallBody(-3, 0);
      zone.update(0.016, ball2);
      const f2 = ball2.applyForce.mock.calls[0][0];

      expect(Math.sign(f1.x)).toBe(-Math.sign(f2.x));
    });

    it('force magnitude is constant (suction_force * mass) regardless of distance', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      const ballClose = makeBallBody(1, 0);
      zone.update(0.016, ballClose);
      const forceClose = ballClose.applyForce.mock.calls[0][0];

      const ballFar = makeBallBody(4, 0);
      zone.update(0.016, ballFar);
      const forceFar = ballFar.applyForce.mock.calls[0][0];

      // Constant force: same magnitude at different distances
      expect(Math.abs(forceClose.x)).toBeCloseTo(Math.abs(forceFar.x), 5);
      // Magnitude equals force * mass
      const expectedMagnitude = defaultConfig.force * 0.45;
      expect(Math.abs(forceClose.x)).toBeCloseTo(expectedMagnitude, 5);
    });

    it('does not apply force when ball is outside zone', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(100, 100);

      zone.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not apply force when ball is very close to center', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(0, 0);

      zone.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('wakes sleeping ball in zone', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(2, 0);
      ball.sleepState = SLEEPING;

      zone.update(0.016, ball);

      expect(ball.wakeUp).toHaveBeenCalled();
      expect(ball.applyForce).toHaveBeenCalled();
    });

    it('does not throw when ballBody is null', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(() => zone.update(0.016, null)).not.toThrow();
    });
  });

  // --- Visual rotation ---

  describe('visual rotation', () => {
    it('rotates mesh on Y-axis at 0.5 rad/s', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);
      const initialY = zone.mesh.rotation.y;

      zone.update(1.0, null);

      expect(zone.mesh.rotation.y).toBeCloseTo(initialY + 0.5, 5);
    });

    it('rotation.y increases monotonically across frames', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      zone.update(0.016, null);
      const y1 = zone.mesh.rotation.y;

      zone.update(0.016, null);
      const y2 = zone.mesh.rotation.y;

      expect(y2).toBeGreaterThan(y1);
    });
  });

  // --- Emissive visual ---

  describe('emissive visual', () => {
    it('material uses reward-color emissive (#aaff44) by default', () => {
      new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ emissive: 0xaaff44 })
      );
    });

    it('material emissiveIntensity is positive', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(zone.mesh.material.emissiveIntensity).toBeGreaterThan(0);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up meshes', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      zone.destroy();

      expect(zone.meshes).toEqual([]);
    });

    it('can be called multiple times without error', () => {
      const zone = new SuctionZone(world, group, defaultConfig, SURFACE_HEIGHT);

      zone.destroy();
      expect(() => zone.destroy()).not.toThrow();
    });
  });
});
