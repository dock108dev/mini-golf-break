/**
 * Unit tests for ElevatedGreen mechanic
 * ISSUE-007
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ElevatedGreen } from '../../mechanics/ElevatedGreen';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// ---------------------------------------------------------------------------
// Enhance mocks from jest.setup.js for ElevatedGreen tests
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
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      set: jest.fn(),
      setFromAxisAngle: jest.fn(),
      copy: jest.fn(),
    },
    addShape: jest.fn(),
    userData: {},
  }));

  CANNON.Quaternion = jest.fn(() => ({
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    setFromAxisAngle: jest.fn(),
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
        }),
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn(function (x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        }),
      },
      receiveShadow: false,
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

  THREE.BoxGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
  THREE.PlaneGeometry.mockImplementation(() => ({ dispose: jest.fn() }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    groundMaterial: { id: 'ground' },
    bumperMaterial: { id: 'bumper' },
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
    platform: {
      position: { x: 0, y: 0, z: -5 },
      width: 4,
      length: 4,
    },
    elevation: 0.5,
    ramp: {
      start: { x: 0, y: 0, z: -3 },
      end: { x: 0, y: 0, z: -5 },
      width: 2,
    },
    color: 0x2ecc71,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ElevatedGreen
// ---------------------------------------------------------------------------

describe('ElevatedGreen', () => {
  let world, group, config;
  const surfaceHeight = 0.2;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
    config = makeConfig();
  });

  // --- Constructor: platform ---

  describe('constructor — platform', () => {
    it('creates a raised platform at configured elevation', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      // Platform mesh should be positioned at surfaceHeight + elevation
      const platformMesh = eg.meshes[0];
      const expectedY = surfaceHeight + config.elevation;
      expect(platformMesh.position.set).toHaveBeenCalledWith(
        config.platform.position.x,
        expectedY,
        config.platform.position.z,
      );
    });

    it('creates platform with correct dimensions from config', () => {
      const customConfig = makeConfig({
        platform: { position: { x: 2, y: 0, z: -8 }, width: 6, length: 10 },
      });
      const eg = new ElevatedGreen(world, group, customConfig, surfaceHeight);

      // BoxGeometry called with platform dimensions
      expect(THREE.BoxGeometry).toHaveBeenCalledWith(6, 0.02, 10);
      expect(eg.meshes.length).toBeGreaterThanOrEqual(1);
    });

    it('creates a static physics body for the platform', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      // First body is the platform body
      const platBody = eg.bodies[0];
      expect(platBody.userData).toEqual({ type: 'elevated_platform' });
      expect(platBody.position.set).toHaveBeenCalledWith(
        config.platform.position.x,
        surfaceHeight + config.elevation,
        config.platform.position.z,
      );
    });

    it('adds platform body to the world', () => {
      new ElevatedGreen(world, group, config, surfaceHeight);

      // At minimum, platform body was added
      expect(world.addBody).toHaveBeenCalled();
    });

    it('creates a side wall mesh for depth indication', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      // meshes[0] = platform, meshes[1] = front side wall
      expect(eg.meshes.length).toBeGreaterThanOrEqual(2);
      // Front side wall positioned at platform edge
      const frontMesh = eg.meshes[1];
      const expectedFrontZ = config.platform.position.z + config.platform.length / 2;
      expect(frontMesh.position.set).toHaveBeenCalledWith(
        config.platform.position.x,
        surfaceHeight + config.elevation / 2,
        expectedFrontZ,
      );
    });

    it('uses default platform values when config fields are missing', () => {
      const eg = new ElevatedGreen(world, group, {}, surfaceHeight);

      // Should not throw, uses defaults
      expect(eg.meshes.length).toBeGreaterThan(0);
      expect(eg.bodies.length).toBeGreaterThan(0);
    });
  });

  // --- Constructor: ramp ---

  describe('constructor — ramp', () => {
    it('creates a ramp mesh positioned at midpoint between start and end', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      // ramp mesh is meshes[2] (after platform mesh and side wall)
      const rampMesh = eg.meshes[2];
      const expectedMidX = (config.ramp.start.x + config.ramp.end.x) / 2;
      const expectedMidZ = (config.ramp.start.z + config.ramp.end.z) / 2;
      const expectedMidY = surfaceHeight + config.elevation / 2;

      expect(rampMesh.position.set).toHaveBeenCalledWith(expectedMidX, expectedMidY, expectedMidZ);
    });

    it('creates a ramp physics body with ramp userData type', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      // ramp body is bodies[1]
      const rampBody = eg.bodies[1];
      expect(rampBody.userData).toEqual({ type: 'ramp' });
      expect(rampBody.addShape).toHaveBeenCalled();
    });

    it('positions the ramp body at the ramp start point', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      // ramp body is bodies[1]
      const rampBody = eg.bodies[1];
      expect(rampBody.position.set).toHaveBeenCalledWith(
        config.ramp.start.x,
        surfaceHeight,
        config.ramp.start.z,
      );
      expect(rampBody.userData).toEqual({ type: 'ramp' });
    });

    it('uses PlaneGeometry for visual ramp surface', () => {
      new ElevatedGreen(world, group, config, surfaceHeight);

      // PlaneGeometry called with ramp width and actual length
      expect(THREE.PlaneGeometry).toHaveBeenCalled();
      const callArgs = THREE.PlaneGeometry.mock.calls[0];
      expect(callArgs[0]).toBe(config.ramp.width); // ramp width
      // Actual length should be > horizontal length (hypotenuse includes elevation)
      const horizontalLength = 2; // distance from z=-3 to z=-5
      expect(callArgs[1]).toBeGreaterThan(horizontalLength);
    });

    it('computes correct ramp angle for angled ramps', () => {
      // Ramp going diagonally
      const diagonalConfig = makeConfig({
        ramp: { start: { x: 0, y: 0, z: 0 }, end: { x: 2, y: 0, z: -2 }, width: 2 },
        elevation: 1.0,
      });
      const eg = new ElevatedGreen(world, group, diagonalConfig, surfaceHeight);

      // Should still create ramp with correct geometry
      expect(eg.bodies.length).toBeGreaterThanOrEqual(2);
      const rampBody = eg.bodies[1];
      expect(rampBody.userData).toEqual({ type: 'ramp' });
    });
  });

  // --- Constructor: edge rails ---

  describe('constructor — edge rails', () => {
    it('creates two rail meshes for left and right sides', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      // meshes: platform, front side, ramp, left rail, right rail = 5 total
      expect(eg.meshes).toHaveLength(5);
    });

    it('creates two rail physics bodies', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      // bodies: platform, ramp, left rail, right rail = 4 total
      expect(eg.bodies).toHaveLength(4);
    });

    it('sets rail bodies userData type to ramp_rail', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      // Rail bodies are the last two
      const leftRail = eg.bodies[2];
      const rightRail = eg.bodies[3];
      expect(leftRail.userData).toEqual({ type: 'ramp_rail' });
      expect(rightRail.userData).toEqual({ type: 'ramp_rail' });
    });

    it('uses bumperMaterial for rail physics bodies', () => {
      new ElevatedGreen(world, group, config, surfaceHeight);

      // CANNON.Body constructor should be called with bumperMaterial for rails
      const bodyCalls = CANNON.Body.mock.calls;
      // Last two body calls should use bumperMaterial
      const railCalls = bodyCalls.slice(-2);
      for (const call of railCalls) {
        expect(call[0].material).toEqual(world.bumperMaterial);
      }
    });

    it('positions rails on opposite sides of the ramp', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      const leftRailMesh = eg.meshes[3];
      const rightRailMesh = eg.meshes[4];

      const rampMidX = (config.ramp.start.x + config.ramp.end.x) / 2;
      const halfWidth = config.ramp.width / 2;

      // Left rail at -halfWidth, right rail at +halfWidth
      expect(leftRailMesh.position.set).toHaveBeenCalledWith(
        rampMidX - halfWidth,
        expect.any(Number),
        expect.any(Number),
      );
      expect(rightRailMesh.position.set).toHaveBeenCalledWith(
        rampMidX + halfWidth,
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  // --- All meshes and bodies ---

  describe('constructor — totals', () => {
    it('adds all meshes to the group', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      expect(group.add).toHaveBeenCalledTimes(eg.meshes.length);
      expect(eg.meshes).toHaveLength(5);
    });

    it('adds all bodies to the world', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      expect(world.addBody).toHaveBeenCalledTimes(eg.bodies.length);
      expect(eg.bodies).toHaveLength(4);
    });
  });

  // --- Region config (Vector2 array) ---

  describe('region config', () => {
    it('accepts platform position as region boundary definition', () => {
      // The platform position + width/length defines the platform region
      const regionConfig = makeConfig({
        platform: { position: { x: 3, y: 0, z: -7 }, width: 5, length: 8 },
        elevation: 1.0,
      });

      const eg = new ElevatedGreen(world, group, regionConfig, surfaceHeight);

      // Platform body positioned correctly
      const platBody = eg.bodies[0];
      expect(platBody.position.set).toHaveBeenCalledWith(3, surfaceHeight + 1.0, -7);
      expect(platBody.userData).toEqual({ type: 'elevated_platform' });
    });
  });

  // --- destroy ---

  describe('destroy', () => {
    it('removes all meshes and clears the array', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);
      const meshCount = eg.meshes.length;

      expect(meshCount).toBe(5);

      eg.destroy();

      expect(eg.meshes).toEqual([]);
    });

    it('removes all bodies from the world and clears the array', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);
      const bodyCount = eg.bodies.length;

      expect(bodyCount).toBe(4);

      eg.destroy();

      expect(world.removeBody).toHaveBeenCalledTimes(4);
      expect(eg.bodies).toEqual([]);
    });

    it('can be called multiple times without error', () => {
      const eg = new ElevatedGreen(world, group, config, surfaceHeight);

      eg.destroy();
      expect(() => eg.destroy()).not.toThrow();
    });
  });

  // --- Ramp angle clamping ---

  describe('ramp angle clamping', () => {
    it('clamps elevation when ramp angle would exceed 30 degrees', () => {
      // Short ramp with high elevation => angle > 30 degrees
      // horizontal length = 1, elevation = 5 => atan2(5, 1) ≈ 78.7° >> 30°
      const steepConfig = makeConfig({
        elevation: 5,
        ramp: { start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: -1 }, width: 2 },
        platform: { position: { x: 0, y: 0, z: -2 }, width: 4, length: 4 },
      });

      const eg = new ElevatedGreen(world, group, steepConfig, surfaceHeight);

      // Max elevation at 30° for horizontal length 1 = tan(30°) * 1 ≈ 0.577
      const maxElevation = Math.tan(Math.PI / 6) * 1;
      const platformMesh = eg.meshes[0];
      const expectedY = surfaceHeight + maxElevation;
      expect(platformMesh.position.set).toHaveBeenCalledWith(
        0,
        expect.closeTo(expectedY, 2),
        -2,
      );
    });

    it('does not clamp when angle is under 30 degrees', () => {
      // Long ramp with low elevation => angle well under 30°
      const gentleConfig = makeConfig({
        elevation: 0.3,
        ramp: { start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: -4 }, width: 2 },
        platform: { position: { x: 0, y: 0, z: -6 }, width: 4, length: 4 },
      });

      const eg = new ElevatedGreen(world, group, gentleConfig, surfaceHeight);

      const platformMesh = eg.meshes[0];
      expect(platformMesh.position.set).toHaveBeenCalledWith(
        0,
        surfaceHeight + 0.3,
        -6,
      );
    });
  });

  // --- Registry ---

  describe('registry', () => {
    it('registers with MechanicRegistry as elevated_green', () => {
      const types = getRegisteredTypes();

      expect(types).toContain('elevated_green');
    });
  });
});
