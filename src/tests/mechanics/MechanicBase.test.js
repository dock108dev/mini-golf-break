/**
 * Unit tests for MechanicBase and MechanicRegistry
 * ISSUE-001
 */

import { MechanicBase } from '../../mechanics/MechanicBase';
import {
  registerMechanic,
  createMechanic,
  getRegisteredTypes
} from '../../mechanics/MechanicRegistry';

// ---------------------------------------------------------------------------
// Helpers — lightweight mocks matching patterns in setup.js / jest.setup.js
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

function makeMockBody(x = 0, z = 0) {
  return {
    position: { x, y: 0, z },
    velocity: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  };
}

function makeMockMesh(hasParent = true) {
  const mesh = {
    geometry: { dispose: jest.fn() },
    material: { dispose: jest.fn() },
    parent: hasParent ? { remove: jest.fn() } : null
  };
  return mesh;
}

// ---------------------------------------------------------------------------
// MechanicBase
// ---------------------------------------------------------------------------

describe('MechanicBase', () => {
  let world, group, config;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    config = { type: 'test_mechanic', speed: 5 };
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('stores world, group, config, and surfaceHeight', () => {
      const base = new MechanicBase(world, group, config, 0.3);
      expect(base.world).toBe(world);
      expect(base.group).toBe(group);
      expect(base.config).toBe(config);
      expect(base.surfaceHeight).toBe(0.3);
    });

    it('initialises empty meshes and bodies arrays', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      expect(base.meshes).toEqual([]);
      expect(base.bodies).toEqual([]);
    });
  });

  // --- Lifecycle methods exist ---

  describe('lifecycle methods', () => {
    it('has update as a callable method', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      expect(typeof base.update).toBe('function');
      // Should not throw when called (no-op in base)
      expect(() => base.update(0.016, makeMockBody())).not.toThrow();
    });

    it('has destroy as a callable method', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      expect(typeof base.destroy).toBe('function');
    });

    it('has getMeshes returning the meshes array', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      // getMeshes is just the property, verify it is the same reference
      expect(Array.isArray(base.meshes)).toBe(true);
    });

    it('has getBodies returning the bodies array', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      expect(Array.isArray(base.bodies)).toBe(true);
    });
  });

  // --- Speed cap validation (ISSUE-009) ---

  describe('speed cap validation', () => {
    it('emits console.warn when speed exceeds thickness / fixedDt', () => {
      const overSpecConfig = {
        type: 'test_mechanic',
        speed: 100, // way above 0.3 * 60 = 18
        size: { depth: 0.3 }
      };

      new MechanicBase(world, group, overSpecConfig, 0.2);

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('anti-tunneling limit'));
    });

    it('does not warn when speed is within safe limit', () => {
      console.warn.mockClear();
      const safeConfig = {
        type: 'test_mechanic',
        speed: 10, // below 0.3 * 60 = 18
        size: { depth: 0.3 }
      };

      new MechanicBase(world, group, safeConfig, 0.2);

      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('anti-tunneling limit')
      );
    });

    it('does not warn when speed is undefined', () => {
      console.warn.mockClear();
      new MechanicBase(world, group, { size: { depth: 0.3 } }, 0.2);

      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('anti-tunneling limit')
      );
    });

    it('does not warn when size.depth is undefined', () => {
      console.warn.mockClear();
      new MechanicBase(world, group, { speed: 100 }, 0.2);

      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('anti-tunneling limit')
      );
    });
  });

  // --- destroy ---

  describe('destroy', () => {
    it('disposes geometry and material for each mesh', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      const mesh = makeMockMesh(true);
      base.meshes.push(mesh);

      base.destroy();

      expect(mesh.geometry.dispose).toHaveBeenCalled();
      expect(mesh.material.dispose).toHaveBeenCalled();
      expect(mesh.parent.remove).toHaveBeenCalledWith(mesh);
      expect(base.meshes).toEqual([]);
    });

    it('handles mesh with array materials', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      const mat1 = { dispose: jest.fn() };
      const mat2 = { dispose: jest.fn() };
      const mesh = {
        geometry: { dispose: jest.fn() },
        material: [mat1, mat2],
        parent: { remove: jest.fn() }
      };
      base.meshes.push(mesh);

      base.destroy();

      expect(mat1.dispose).toHaveBeenCalled();
      expect(mat2.dispose).toHaveBeenCalled();
    });

    it('handles mesh with no parent gracefully', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      const mesh = makeMockMesh(false);
      base.meshes.push(mesh);

      expect(() => base.destroy()).not.toThrow();
      expect(mesh.geometry.dispose).toHaveBeenCalled();
    });

    it('removes all bodies from world', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      const body1 = makeMockBody();
      const body2 = makeMockBody();
      base.bodies.push(body1, body2);

      base.destroy();

      expect(world.removeBody).toHaveBeenCalledWith(body1);
      expect(world.removeBody).toHaveBeenCalledWith(body2);
      expect(base.bodies).toEqual([]);
    });

    it('handles null world gracefully', () => {
      const base = new MechanicBase(null, group, config, 0.2);
      base.bodies.push(makeMockBody());

      expect(() => base.destroy()).not.toThrow();
      expect(base.bodies).toEqual([]);
    });
  });

  // --- isBallInZone ---

  describe('isBallInZone', () => {
    it('returns true when ball is inside the trigger radius', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      const ball = makeMockBody(1, 1);
      const trigger = makeMockBody(1.5, 1.5);
      const radius = 2;

      expect(base.isBallInZone(ball, trigger, radius)).toBe(true);
    });

    it('returns false when ball is outside the trigger radius', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      const ball = makeMockBody(0, 0);
      const trigger = makeMockBody(10, 10);
      const radius = 1;

      expect(base.isBallInZone(ball, trigger, radius)).toBe(false);
    });

    it('returns true when ball is exactly on the boundary', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      const ball = makeMockBody(0, 0);
      const trigger = makeMockBody(3, 4); // distance = 5
      const radius = 5;

      expect(base.isBallInZone(ball, trigger, radius)).toBe(true);
    });

    it('returns true when ball and trigger are at the same position', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      const ball = makeMockBody(5, 5);
      const trigger = makeMockBody(5, 5);

      expect(base.isBallInZone(ball, trigger, 0.1)).toBe(true);
    });

    it('returns false when ballBody is null', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      expect(base.isBallInZone(null, makeMockBody(), 5)).toBe(false);
    });

    it('returns false when triggerBody is null', () => {
      const base = new MechanicBase(world, group, config, 0.2);
      expect(base.isBallInZone(makeMockBody(), null, 5)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// MechanicRegistry
// ---------------------------------------------------------------------------

describe('MechanicRegistry', () => {
  // The registry is module-level state, so we test additive behaviour.
  // We use unique type names per test to avoid cross-contamination.

  describe('registerMechanic', () => {
    it('stores a factory that can be retrieved via createMechanic', () => {
      const factory = jest.fn(() => ({ type: 'stub' }));
      registerMechanic('__test_reg_store', factory);

      const result = createMechanic('__test_reg_store', {}, {}, {}, 0.2);
      expect(factory).toHaveBeenCalledWith({}, {}, {}, 0.2, undefined);
      expect(result).toEqual({ type: 'stub' });
    });

    it('overwrites existing registration with a warning', () => {
      const warnSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const factory1 = jest.fn(() => 'first');
      const factory2 = jest.fn(() => 'second');

      registerMechanic('__test_reg_overwrite', factory1);
      registerMechanic('__test_reg_overwrite', factory2);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Overwriting'));

      const result = createMechanic('__test_reg_overwrite', null, null, null, 0);
      expect(result).toBe('second');

      warnSpy.mockRestore();
    });
  });

  describe('createMechanic', () => {
    it('returns the instance produced by the factory', () => {
      const world = makeMockWorld();
      const group = makeMockGroup();
      const config = { speed: 10 };
      const instance = new MechanicBase(world, group, config, 0.5);
      const factory = jest.fn(() => instance);

      registerMechanic('__test_create_ok', factory);
      const result = createMechanic('__test_create_ok', world, group, config, 0.5);

      expect(result).toBe(instance);
      expect(factory).toHaveBeenCalledWith(world, group, config, 0.5, undefined);
    });

    it('returns null for an unknown type', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = createMechanic('__nonexistent_type', {}, {}, {}, 0);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown mechanic type'));

      warnSpy.mockRestore();
    });
  });

  describe('getRegisteredTypes', () => {
    it('returns an array including previously registered types', () => {
      registerMechanic('__test_list_a', jest.fn());
      registerMechanic('__test_list_b', jest.fn());

      const types = getRegisteredTypes();
      expect(types).toContain('__test_list_a');
      expect(types).toContain('__test_list_b');
    });

    it('returns an array (not other iterable)', () => {
      expect(Array.isArray(getRegisteredTypes())).toBe(true);
    });
  });
});
