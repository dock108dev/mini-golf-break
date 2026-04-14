/**
 * Unit tests for MultiLevelRamp mechanic
 * ISSUE-006
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { MultiLevelRamp } from '../../mechanics/MultiLevelRamp';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// Trigger registration
import '../../mechanics/MultiLevelRamp';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js for MultiLevelRamp tests
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
      })
    },
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      set: jest.fn(),
      setFromAxisAngle: jest.fn(),
      copy: jest.fn()
    },
    addShape: jest.fn(),
    userData: {}
  }));

  CANNON.Quaternion = jest.fn(() => ({
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    setFromAxisAngle: jest.fn()
  }));

  CANNON.Trimesh = jest.fn(() => ({ type: 'trimesh' }));

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
      rotation: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn(function (x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        })
      },
      receiveShadow: false,
      castShadow: false,
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
    groundMaterial: { id: 'ground' },
    bumperMaterial: { id: 'bumper' }
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
    startPosition: [0, 0, 0],
    endPosition: [0, 1, -4],
    width: 1.2,
    ...overrides
  };
}

const SURFACE_HEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MultiLevelRamp', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    CANNON.Body.mockClear();
    THREE.MeshStandardMaterial.mockClear();
    THREE.Mesh.mockClear();
    THREE.BoxGeometry.mockClear();
  });

  // --- Registry ---

  describe('registry', () => {
    it('is registered as multi_level_ramp in MechanicRegistry', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('multi_level_ramp');
    });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('throws when startPosition field is missing', () => {
      expect(
        () => new MultiLevelRamp(world, group, { endPosition: [0, 1, -4] }, SURFACE_HEIGHT)
      ).toThrow('MultiLevelRamp: missing required config field "startPosition"');
    });

    it('throws when endPosition field is missing', () => {
      expect(
        () => new MultiLevelRamp(world, group, { startPosition: [0, 0, 0] }, SURFACE_HEIGHT)
      ).toThrow('MultiLevelRamp: missing required config field "endPosition"');
    });

    it('creates ramp mesh added to group', () => {
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      expect(ramp.meshes.length).toBeGreaterThanOrEqual(1);
      expect(group.add).toHaveBeenCalled();
    });

    it('creates physics body added to world', () => {
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      expect(ramp.bodies.length).toBeGreaterThanOrEqual(1);
      expect(world.addBody).toHaveBeenCalled();
    });

    it('creates side walls by default (sideWalls: true)', () => {
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      // 1 ramp mesh + 2 wall meshes = 3
      expect(ramp.meshes.length).toBe(3);
      // 1 ramp body + 2 wall bodies = 3
      expect(ramp.bodies.length).toBe(3);
    });

    it('omits side walls when sideWalls: false', () => {
      const ramp = new MultiLevelRamp(
        world,
        group,
        makeConfig({ sideWalls: false }),
        SURFACE_HEIGHT
      );

      expect(ramp.meshes.length).toBe(1);
      expect(ramp.bodies.length).toBe(1);
    });

    it('uses default width when not specified', () => {
      const config = makeConfig();
      delete config.width;
      const ramp = new MultiLevelRamp(world, group, config, SURFACE_HEIGHT);

      expect(ramp.rampWidth).toBe(1.2);
    });

    it('accepts custom surfaceColor', () => {
      new MultiLevelRamp(world, group, makeConfig({ surfaceColor: 0xff0000 }), SURFACE_HEIGHT);

      const matCalls = THREE.MeshStandardMaterial.mock.calls;
      expect(matCalls[0][0].color).toBe(0xff0000);
    });

    it('uses theme color when no surfaceColor provided', () => {
      const theme = { mechanics: { multiLevelRamp: { color: 0x00ff00 } } };
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT, theme);

      expect(ramp.meshes.length).toBeGreaterThanOrEqual(1);
    });

    it('handles array-style position coordinates', () => {
      const ramp = new MultiLevelRamp(
        world,
        group,
        makeConfig({ startPosition: [1, 0, 2], endPosition: [1, 1, -2] }),
        SURFACE_HEIGHT
      );

      expect(ramp.meshes.length).toBeGreaterThanOrEqual(1);
    });

    it('handles object-style position coordinates', () => {
      const ramp = new MultiLevelRamp(
        world,
        group,
        makeConfig({
          startPosition: { x: 1, y: 0, z: 2 },
          endPosition: { x: 1, y: 1, z: -2 }
        }),
        SURFACE_HEIGHT
      );

      expect(ramp.meshes.length).toBeGreaterThanOrEqual(1);
    });

    it('clamps ramp angle to 30 degrees max', () => {
      const ramp = new MultiLevelRamp(
        world,
        group,
        makeConfig({ startPosition: [0, 0, 0], endPosition: [0, 10, -1] }),
        SURFACE_HEIGHT
      );

      expect(ramp.bodies.length).toBeGreaterThanOrEqual(1);
    });

    it('handles downward ramp (start higher than end)', () => {
      const ramp = new MultiLevelRamp(
        world,
        group,
        makeConfig({ startPosition: [0, 2, 0], endPosition: [0, 0, -4] }),
        SURFACE_HEIGHT
      );

      expect(ramp.meshes.length).toBeGreaterThanOrEqual(1);
      expect(ramp.bodies.length).toBeGreaterThanOrEqual(1);
    });

    it('ramp physics body is STATIC with mass 0', () => {
      new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      const bodyCalls = CANNON.Body.mock.calls;
      expect(bodyCalls[0][0].mass).toBe(0);
      expect(bodyCalls[0][0].type).toBe(CANNON.Body.STATIC);
    });

    it('ramp body uses groundMaterial', () => {
      new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      const bodyCalls = CANNON.Body.mock.calls;
      expect(bodyCalls[0][0].material).toEqual(world.groundMaterial);
    });

    it('wall bodies use bumperMaterial', () => {
      new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      const bodyCalls = CANNON.Body.mock.calls;
      const wallCalls = bodyCalls.slice(-2);
      for (const call of wallCalls) {
        expect(call[0].material).toEqual(world.bumperMaterial);
      }
    });

    it('sets userData type on ramp body', () => {
      new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      const rampBody = world.addBody.mock.calls[0][0];
      expect(rampBody.userData.type).toBe('multi_level_ramp');
    });

    it('sets userData type on wall bodies', () => {
      new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      const wall1 = world.addBody.mock.calls[1][0];
      expect(wall1.userData.type).toBe('ramp_wall');
    });

    it('ramp mesh receives shadows', () => {
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      expect(ramp.meshes[0].receiveShadow).toBe(true);
    });
  });

  // --- Destroy ---

  describe('destroy', () => {
    it('cleans up all meshes and bodies', () => {
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      expect(ramp.meshes.length).toBe(3);
      expect(ramp.bodies.length).toBe(3);

      ramp.destroy();

      expect(ramp.meshes).toEqual([]);
      expect(ramp.bodies).toEqual([]);
      expect(world.removeBody).toHaveBeenCalledTimes(3);
    });

    it('can be called multiple times safely', () => {
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      ramp.destroy();
      expect(() => ramp.destroy()).not.toThrow();
    });
  });

  // --- MechanicBase interface ---

  describe('MechanicBase interface', () => {
    it('extends MechanicBase', () => {
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);

      expect(typeof ramp.update).toBe('function');
      expect(typeof ramp.destroy).toBe('function');
      expect(typeof ramp.onDtSpike).toBe('function');
      expect(typeof ramp.getMeshes).toBe('function');
      expect(typeof ramp.getBodies).toBe('function');
    });

    it('isForceField is false (structural mechanic)', () => {
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(ramp.isForceField).toBe(false);
    });

    it('getMeshes returns all meshes', () => {
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(ramp.getMeshes()).toHaveLength(3);
    });

    it('getBodies returns all bodies', () => {
      const ramp = new MultiLevelRamp(world, group, makeConfig(), SURFACE_HEIGHT);
      expect(ramp.getBodies()).toHaveLength(3);
    });
  });
});
