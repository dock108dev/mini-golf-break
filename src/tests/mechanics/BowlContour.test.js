/**
 * Unit tests for BowlContour mechanic
 * ISSUE-043
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BowlContour } from '../../mechanics/BowlContour';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

const SLEEPING = 2;

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Body.SLEEPING = SLEEPING;

  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({ x, y, z }));

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
      visible: true,
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn(), transparent: true, opacity: 0.2 }
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

  THREE.CircleGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
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
    applyForce: jest.fn()
  };
}

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BowlContour', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  const defaultConfig = {
    position: { x: 0, y: 0, z: 0 },
    radius: 4,
    force: 5
  };

  // --- Registry ---

  describe('registry', () => {
    it('is registered as bowl_contour in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('bowl_contour');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates a visual mesh and adds it to the group', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(bowl.meshes).toHaveLength(1);
      expect(group.add).toHaveBeenCalledTimes(1);
    });

    it('creates no physics bodies', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(bowl.bodies).toHaveLength(0);
      expect(world.addBody).not.toHaveBeenCalled();
    });

    it('sets isForceField to true', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(bowl.isForceField).toBe(true);
    });

    it('stores center and radius from config', () => {
      const config = { position: { x: 2, y: 0, z: -3 }, radius: 6, force: 8 };
      const bowl = new BowlContour(world, group, config, SURFACE_HEIGHT);

      expect(bowl.centerX).toBe(2);
      expect(bowl.centerZ).toBe(-3);
      expect(bowl.radius).toBe(6);
      expect(bowl.force).toBe(8);
    });

    it('uses default values when config is minimal', () => {
      const bowl = new BowlContour(world, group, {}, SURFACE_HEIGHT);

      expect(bowl.radius).toBe(4);
      expect(bowl.force).toBe(3);
    });

    it('applies theme color when no config color is set', () => {
      const theme = { mechanics: { bowlContour: { color: 0xaabbcc } } };
      new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT, theme);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xaabbcc })
      );
    });
  });

  // --- Update ---

  describe('update', () => {
    it('applies force toward center when ball is in zone', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(3, 0);

      bowl.update(0.016, ball);

      expect(ball.applyForce).toHaveBeenCalledTimes(1);
      const force = ball.applyForce.mock.calls[0][0];
      expect(force.x).toBeLessThan(0);
      expect(force.y).toBe(0);
    });

    it('force direction is always toward center', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);

      const ball1 = makeBallBody(3, 0);
      bowl.update(0.016, ball1);
      const f1 = ball1.applyForce.mock.calls[0][0];

      const ball2 = makeBallBody(-3, 0);
      bowl.update(0.016, ball2);
      const f2 = ball2.applyForce.mock.calls[0][0];

      expect(f1.x).toBeLessThan(0);
      expect(f2.x).toBeGreaterThan(0);
    });

    it('force is stronger at edges than near center', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);

      const ballNear = makeBallBody(1, 0);
      bowl.update(0.016, ballNear);
      const forceNear = ballNear.applyForce.mock.calls[0][0];

      const ballEdge = makeBallBody(3.5, 0);
      bowl.update(0.016, ballEdge);
      const forceEdge = ballEdge.applyForce.mock.calls[0][0];

      expect(Math.abs(forceEdge.x)).toBeGreaterThan(Math.abs(forceNear.x));
    });

    it('does not apply force when ball is outside zone', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(100, 100);

      bowl.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not apply force when ball is very close to center', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(0, 0);

      bowl.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not apply force when ball is sleeping', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);
      const ball = makeBallBody(2, 0);
      ball.sleepState = SLEEPING;

      bowl.update(0.016, ball);

      expect(ball.applyForce).not.toHaveBeenCalled();
    });

    it('does not throw when ballBody is null', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(() => bowl.update(0.016, null)).not.toThrow();
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up meshes', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);

      expect(bowl.meshes).toHaveLength(1);

      bowl.destroy();

      expect(bowl.meshes).toEqual([]);
    });

    it('can be called multiple times without error', () => {
      const bowl = new BowlContour(world, group, defaultConfig, SURFACE_HEIGHT);

      bowl.destroy();
      expect(() => bowl.destroy()).not.toThrow();
    });
  });
});
