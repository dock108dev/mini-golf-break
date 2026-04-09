/**
 * Integration tests for theme threading through HoleEntity to builders
 * ISSUE-036
 *
 * Verifies that when a hole config includes a theme property, the theme colors
 * are passed through HoleEntity to GreenSurfaceBuilder, HazardFactory, and
 * bumper creation. Also verifies defaultTheme fallback when no theme is provided.
 */

// Track MeshStandardMaterial calls to verify theme colors are applied
// Use global to survive jest.mock hoisting
global.__mockMaterialInstances = [];


// Mock Three.js before any imports
jest.mock('three', () => {
  const mockVector3 = jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.clone = jest.fn(() => new mockVector3(this.x, this.y, this.z));
    this.copy = jest.fn(function (other) {
      if (other) { this.x = other.x || 0; this.y = other.y || 0; this.z = other.z || 0; }
      return this;
    });
    this.set = jest.fn(function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; });
    this.setY = jest.fn(function (v) { this.y = v; return this; });
    this.normalize = jest.fn(() => this);
    this.multiplyScalar = jest.fn(() => this);
    this.subVectors = jest.fn(() => this);
    this.addVectors = jest.fn(() => this);
    this.toArray = jest.fn(() => [this.x, this.y, this.z]);
    this.distanceTo = jest.fn(() => 5);
  });

  const mockVector2 = jest.fn(function (x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.clone = jest.fn(() => new mockVector2(this.x, this.y));
    this.subVectors = jest.fn((a, b) => { this.x = a.x - b.x; this.y = a.y - b.y; return this; });
    this.length = jest.fn(() => Math.sqrt(this.x * this.x + this.y * this.y));
    this.normalize = jest.fn(() => this);
    this.multiplyScalar = jest.fn((s) => { this.x *= s; this.y *= s; return this; });
    this.addVectors = jest.fn((a, b) => { this.x = a.x + b.x; this.y = a.y + b.y; return this; });
  });

  const mockBox2 = jest.fn(function () {
    this.min = { x: -5, y: -5 };
    this.max = { x: 5, y: 5 };
    this.setFromPoints = jest.fn();
    this.getCenter = jest.fn(target => { target.x = 0; target.y = 0; });
    this.getSize = jest.fn(target => { target.x = 10; target.y = 10; });
  });

  const mockGeometry = () => ({
    dispose: jest.fn(),
    rotateX: jest.fn(),
    translate: jest.fn(),
    attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]) } },
    index: { array: new Uint16Array([0, 1, 2, 2, 3, 0]) }
  });

  const mockMesh = jest.fn(function (geometry, material) {
    this.geometry = geometry || { dispose: jest.fn() };
    this.material = material || { dispose: jest.fn() };
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.parent = null;
    this.updateMatrix = jest.fn();
    this.castShadow = false;
    this.receiveShadow = false;
    this.name = '';
  });

  const mockGroup = jest.fn(function () {
    this.position = {
      x: 0, y: 0, z: 0,
      copy: jest.fn(function (other) { if (other) { this.x = other.x || 0; this.y = other.y || 0; this.z = other.z || 0; } }),
      set: jest.fn(function (x, y, z) { this.x = x; this.y = y; this.z = z; })
    };
    this.parent = null;
    this.add = jest.fn();
    this.remove = jest.fn();
    this.children = [];
    this.name = '';
    this.userData = {};
  });

  return {
    Vector3: mockVector3,
    Vector2: mockVector2,
    Box2: mockBox2,
    Shape: jest.fn(function () { this.holes = []; }),
    ExtrudeGeometry: jest.fn(function () { this.dispose = jest.fn(); this.rotateX = jest.fn(); this.translate = jest.fn(); }),
    MeshStandardMaterial: jest.fn(function (params = {}) {
      const instance = {
        color: params.color ?? 0xffffff,
        roughness: params.roughness ?? 0.5,
        metalness: params.metalness ?? 0.5,
        emissive: params.emissive ?? undefined,
        emissiveIntensity: params.emissiveIntensity ?? undefined,
        transparent: params.transparent ?? false,
        opacity: params.opacity ?? 1.0,
        dispose: jest.fn(),
        _constructorParams: { ...params }
      };
      global.__mockMaterialInstances.push(instance);
      return instance;
    }),
    MeshPhongMaterial: jest.fn(() => ({ dispose: jest.fn(), color: 0xffffff })),
    MeshBasicMaterial: jest.fn(() => ({ dispose: jest.fn(), color: 0xffffff })),
    Mesh: mockMesh,
    Group: mockGroup,
    CylinderGeometry: jest.fn(mockGeometry),
    PlaneGeometry: jest.fn(mockGeometry),
    CircleGeometry: jest.fn(mockGeometry),
    BoxGeometry: jest.fn(mockGeometry),
    RingGeometry: jest.fn(mockGeometry),
    SphereGeometry: jest.fn(mockGeometry),
    Path: jest.fn(function () { return {}; })
  };
});

// Mock cannon-es
jest.mock('cannon-es', () => {
  const mockBody = jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn(), copy: jest.fn() },
    material: null,
    type: 'STATIC',
    addShape: jest.fn(),
    userData: {}
  }));
  mockBody.STATIC = 'STATIC';

  return {
    Box: jest.fn(() => ({ material: null })),
    Body: mockBody,
    Material: jest.fn(),
    ContactMaterial: jest.fn(),
    Vec3: jest.fn((x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 })),
    Cylinder: jest.fn(),
    Trimesh: jest.fn(),
    Sphere: jest.fn(),
    Quaternion: jest.fn(() => ({ setFromAxisAngle: jest.fn(() => ({ x: 0, y: 0, z: 0, w: 1 })) })),
    BODY_TYPES: { STATIC: 'STATIC' }
  };
});

// Mock three-csg-ts
jest.mock('three-csg-ts', () => ({
  CSG: {
    fromMesh: jest.fn(() => ({
      subtract: jest.fn(() => ({
        toMesh: jest.fn(() => ({
          position: { set: jest.fn() },
          geometry: { dispose: jest.fn() },
          material: { dispose: jest.fn() }
        }))
      }))
    })),
    subtract: jest.fn((mesh1) => ({
      position: { set: jest.fn() },
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    }))
  }
}));

// Track HazardFactory calls to verify theme is passed
let mockHazardFactoryCalls = [];
jest.mock('../../objects/hazards/HazardFactory', () => ({
  createHazard: jest.fn((...args) => {
    mockHazardFactoryCalls.push(args);
    return {
      meshes: [],
      bodies: []
    };
  })
}));

// Mock HeroPropFactory
jest.mock('../../objects/HeroPropFactory', () => ({
  createHeroProp: jest.fn(() => [])
}));

import { HoleEntity } from '../../objects/HoleEntity';
import { defaultTheme } from '../../themes/defaultTheme';
import { spaceTheme } from '../../themes/spaceTheme';
import { createHazard } from '../../objects/hazards/HazardFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    addContactMaterial: jest.fn(),
    step: jest.fn(),
    groundMaterial: { name: 'ground' },
    bumperMaterial: { name: 'bumper' },
    bodies: []
  };
}

function makeMockScene() {
  return {
    add: jest.fn(),
    remove: jest.fn(),
    children: []
  };
}

function makeMinimalHoleConfig(overrides = {}) {
  const THREE = require('three');
  return {
    index: 0,
    startPosition: new THREE.Vector3(0, 0, -5),
    holePosition: new THREE.Vector3(0, 0, 5),
    boundaryShape: [
      { x: -3, y: -10 },
      { x: -3, y: 10 },
      { x: 3, y: 10 },
      { x: 3, y: -10 },
      { x: -3, y: -10 }
    ],
    ...overrides
  };
}

/**
 * Find material instances created with a specific color value.
 */
function findMaterialsByColor(color) {
  return global.__mockMaterialInstances.filter(m => m._constructorParams.color === color);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Theme threading through HoleEntity to builders (integration)', () => {
  let world, scene;

  beforeEach(() => {
    world = makeMockWorld();
    scene = makeMockScene();
    global.__mockMaterialInstances.length = 0;
    mockHazardFactoryCalls = [];
    jest.clearAllMocks();
  });

  // --- Default theme fallback ---

  describe('default theme fallback', () => {
    it('uses defaultTheme when no theme is provided in config', async () => {
      const config = makeMinimalHoleConfig();
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // resolvedTheme should match defaultTheme
      expect(hole.resolvedTheme.name).toBe(defaultTheme.name);
      expect(hole.resolvedTheme.green.color).toBe(defaultTheme.green.color);
      expect(hole.resolvedTheme.wall.color).toBe(defaultTheme.wall.color);
      expect(hole.resolvedTheme.sand.color).toBe(defaultTheme.sand.color);
      expect(hole.resolvedTheme.water.color).toBe(defaultTheme.water.color);
    });

    it('stores resolved defaultTheme on config.theme for builders', async () => {
      const config = makeMinimalHoleConfig();
      const hole = new HoleEntity(world, config, scene);

      // config.theme should be set even without explicit theme in input config
      expect(hole.config.theme).toBeDefined();
      expect(hole.config.theme.green.color).toBe(defaultTheme.green.color);
    });

    it('creates green surface material with defaultTheme green color', async () => {
      const config = makeMinimalHoleConfig();
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // GreenSurfaceBuilder should have created a material with default green color
      const greenMaterials = findMaterialsByColor(defaultTheme.green.color);
      expect(greenMaterials.length).toBeGreaterThanOrEqual(1);
    });

    it('creates wall materials with defaultTheme wall color', async () => {
      const config = makeMinimalHoleConfig();
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Walls should use default wall color
      const wallMaterials = findMaterialsByColor(defaultTheme.wall.color);
      expect(wallMaterials.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Space theme threading ---

  describe('spaceTheme threading', () => {
    it('resolves spaceTheme when provided in config', async () => {
      const config = makeMinimalHoleConfig({ theme: spaceTheme });
      const hole = new HoleEntity(world, config, scene);

      expect(hole.resolvedTheme.name).toBe(spaceTheme.name);
      expect(hole.resolvedTheme.green.color).toBe(spaceTheme.green.color);
      expect(hole.resolvedTheme.wall.color).toBe(spaceTheme.wall.color);
    });

    it('passes spaceTheme to GreenSurfaceBuilder via config.theme', async () => {
      const config = makeMinimalHoleConfig({ theme: spaceTheme });
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // GreenSurfaceBuilder reads config.theme.green — verify the space green color was used
      const spaceGreenMaterials = findMaterialsByColor(spaceTheme.green.color);
      expect(spaceGreenMaterials.length).toBeGreaterThanOrEqual(1);

      // Verify emissive properties from spaceTheme were passed through
      const greenMat = spaceGreenMaterials[0];
      expect(greenMat._constructorParams.emissive).toBe(spaceTheme.green.emissive);
      expect(greenMat._constructorParams.emissiveIntensity).toBe(spaceTheme.green.emissiveIntensity);
    });

    it('passes spaceTheme to HazardFactory', async () => {
      const config = makeMinimalHoleConfig({
        theme: spaceTheme,
        hazards: [
          { type: 'sand', shape: 'circle', position: { x: 0, y: 0, z: 2 }, size: 1, depth: 0.2 }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // HazardFactory should have been called with the resolved theme
      expect(createHazard).toHaveBeenCalled();
      const lastCall = mockHazardFactoryCalls[0];
      // 6th argument is the theme
      const passedTheme = lastCall[5];
      expect(passedTheme).toBeDefined();
      expect(passedTheme.sand.color).toBe(spaceTheme.sand.color);
      expect(passedTheme.water.color).toBe(spaceTheme.water.color);
    });

    it('creates wall materials with spaceTheme wall color', async () => {
      const config = makeMinimalHoleConfig({ theme: spaceTheme });
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Walls should use space wall color
      const spaceWallMaterials = findMaterialsByColor(spaceTheme.wall.color);
      expect(spaceWallMaterials.length).toBeGreaterThanOrEqual(1);

      // Verify emissive properties
      const wallMat = spaceWallMaterials[0];
      expect(wallMat._constructorParams.emissive).toBe(spaceTheme.wall.emissive);
    });

    it('creates rim material with spaceTheme rim color', async () => {
      const config = makeMinimalHoleConfig({ theme: spaceTheme });
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const rimMaterials = findMaterialsByColor(spaceTheme.rim.color);
      expect(rimMaterials.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Theme deep merge ---

  describe('theme deep merge', () => {
    it('merges partial theme overrides with defaultTheme', async () => {
      const partialTheme = {
        green: { color: 0xff0000 }
        // No wall, sand, water, etc. — should fall back to defaultTheme
      };

      const config = makeMinimalHoleConfig({ theme: partialTheme });
      const hole = new HoleEntity(world, config, scene);

      // Green should use the override
      expect(hole.resolvedTheme.green.color).toBe(0xff0000);
      // Green roughness should fall back to defaultTheme
      expect(hole.resolvedTheme.green.roughness).toBe(defaultTheme.green.roughness);
      // Wall should be entirely from defaultTheme
      expect(hole.resolvedTheme.wall.color).toBe(defaultTheme.wall.color);
      // Sand should be from defaultTheme
      expect(hole.resolvedTheme.sand.color).toBe(defaultTheme.sand.color);
    });

    it('passes merged theme to HazardFactory for partial overrides', async () => {
      const partialTheme = {
        sand: { color: 0x123456 }
      };

      const config = makeMinimalHoleConfig({
        theme: partialTheme,
        hazards: [
          { type: 'sand', shape: 'circle', position: { x: 0, y: 0, z: 2 }, size: 1, depth: 0.2 }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const passedTheme = mockHazardFactoryCalls[0][5];
      // Sand color should be the override
      expect(passedTheme.sand.color).toBe(0x123456);
      // Water should fall back to default
      expect(passedTheme.water.color).toBe(defaultTheme.water.color);
    });
  });

  // --- End-to-end: colors actually used ---

  describe('end-to-end theme color application', () => {
    it('defaultTheme and spaceTheme produce different material colors', async () => {
      // Init with default theme
      const defaultConfig = makeMinimalHoleConfig();
      const defaultHole = new HoleEntity(world, defaultConfig, scene);
      await defaultHole.init();
      const defaultMaterialColors = global.__mockMaterialInstances.map(m => m._constructorParams.color);

      // Clear and init with space theme
      global.__mockMaterialInstances.length = 0;
      jest.clearAllMocks();

      const spaceConfig = makeMinimalHoleConfig({ theme: spaceTheme });
      const spaceHole = new HoleEntity(world, spaceConfig, scene);
      await spaceHole.init();
      const spaceMaterialColors = global.__mockMaterialInstances.map(m => m._constructorParams.color);

      // The green colors should differ between themes
      expect(defaultMaterialColors).toContain(defaultTheme.green.color);
      expect(spaceMaterialColors).toContain(spaceTheme.green.color);
      expect(defaultTheme.green.color).not.toBe(spaceTheme.green.color);

      // The wall colors should differ between themes
      expect(defaultMaterialColors).toContain(defaultTheme.wall.color);
      expect(spaceMaterialColors).toContain(spaceTheme.wall.color);
      expect(defaultTheme.wall.color).not.toBe(spaceTheme.wall.color);
    });
  });
});
