/**
 * Unit tests for GreenSurfaceBuilder theme and elevation support
 * ISSUE-027
 */

import { defaultTheme } from '../../themes/defaultTheme';
import { spaceTheme } from '../../themes/spaceTheme';

// Mock three-csg-ts
jest.mock('three-csg-ts', () => ({
  CSG: {
    subtract: jest.fn((baseMesh) => baseMesh)
  }
}));

// Override three mock with GreenSurfaceBuilder-specific needs
jest.mock('three', () => {
  const originalThree = jest.requireActual('three');
  return {
    ...originalThree,
    MeshStandardMaterial: jest.fn((params) => ({
      ...params,
      dispose: jest.fn()
    })),
    Mesh: jest.fn(function (geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = {
        x: 0, y: 0, z: 0,
        set: jest.fn(function (x, y, z) { this.x = x; this.y = y; this.z = z; }),
        copy: jest.fn()
      };
      this.rotation = {
        x: 0, y: 0, z: 0,
        copy: jest.fn()
      };
      this.castShadow = false;
      this.receiveShadow = false;
      this.updateMatrix = jest.fn();
      return this;
    }),
    Group: jest.fn(() => ({
      add: jest.fn(),
      remove: jest.fn(),
      children: [],
      position: { x: 0, y: 0, z: 0, set: jest.fn() }
    })),
    ExtrudeGeometry: jest.fn(() => ({
      rotateX: jest.fn()
    })),
    PlaneGeometry: jest.fn(() => ({
      attributes: {
        position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]) }
      },
      index: { array: new Uint16Array([0, 1, 2, 1, 3, 2]) },
      dispose: jest.fn()
    })),
    CylinderGeometry: jest.fn(() => ({})),
    BoxGeometry: jest.fn(() => ({})),
    Shape: jest.fn(function () { this.holes = []; }),
    Path: jest.fn(function () {}),
    Box2: jest.fn(() => ({
      min: { x: -5, y: -10 },
      max: { x: 5, y: 10 },
      setFromPoints: jest.fn(),
      getCenter: jest.fn((target) => { target.x = 0; target.y = 0; return target; }),
      getSize: jest.fn((target) => { target.x = 10; target.y = 20; return target; })
    })),
    Vector2: jest.fn(function (x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }),
    Vector3: jest.fn(function (x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.clone = jest.fn(() => new (jest.requireMock('three').Vector3)(this.x, this.y, this.z));
    })
  };
}, { virtual: true });

// Override cannon-es mock with position.set support
jest.mock('cannon-es', () => ({
  Body: Object.assign(jest.fn(() => ({
    position: {
      x: 0, y: 0, z: 0,
      set: jest.fn(function (x, y, z) { this.x = x; this.y = y; this.z = z; })
    },
    quaternion: {
      x: 0, y: 0, z: 0, w: 1,
      set: jest.fn(),
      setFromAxisAngle: jest.fn()
    },
    addShape: jest.fn(),
    userData: {}
  })), { STATIC: 1 }),
  Trimesh: jest.fn(() => ({})),
  Quaternion: jest.fn(() => ({
    setFromAxisAngle: jest.fn().mockReturnThis()
  })),
  Vec3: jest.fn((x = 0, y = 0, z = 0) => ({ x, y, z }))
}));

const THREE = require('three');
const CANNON = require('cannon-es');
const { buildGreenSurface } = require('../../objects/GreenSurfaceBuilder');
const { CSG } = require('three-csg-ts');

describe('GreenSurfaceBuilder', () => {
  let mockWorld;
  let mockGroup;
  let defaultConfig;
  const defaultSurfaceHeight = 0.2;

  function makeBoundaryShape() {
    return [
      new THREE.Vector2(-5, -10),
      new THREE.Vector2(5, -10),
      new THREE.Vector2(5, 10),
      new THREE.Vector2(-5, 10)
    ];
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockWorld = {
      groundMaterial: {},
      addBody: jest.fn()
    };

    mockGroup = new THREE.Group();

    defaultConfig = {
      index: 0,
      boundaryShape: makeBoundaryShape(),
      hazards: []
    };
  });

  function callBuilder(overrides = {}) {
    return buildGreenSurface({
      config: overrides.config || defaultConfig,
      world: overrides.world || mockWorld,
      group: overrides.group || mockGroup,
      worldHolePosition: overrides.worldHolePosition || new THREE.Vector3(0, 0.2, 5),
      surfaceHeight: overrides.surfaceHeight ?? defaultSurfaceHeight,
      boundaryShape: overrides.boundaryShape || makeBoundaryShape()
    });
  }

  describe('theme parameter support', () => {
    it('accepts a theme parameter and applies green color from theme', () => {
      const config = {
        ...defaultConfig,
        theme: {
          green: { color: 0xff0000, roughness: 0.5, metalness: 0.3 }
        }
      };

      callBuilder({ config });

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 0xff0000,
          roughness: 0.5,
          metalness: 0.3
        })
      );
    });

    it('uses hardcoded fallback color when no theme is provided', () => {
      callBuilder();

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 0x2ecc71,
          roughness: 0.8,
          metalness: 0.1
        })
      );
    });
  });

  describe('default theme produces same visual output as original hardcoded colors', () => {
    it('default theme green color matches hardcoded fallback', () => {
      const configWithDefaultTheme = {
        ...defaultConfig,
        theme: defaultTheme
      };

      callBuilder({ config: configWithDefaultTheme });

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 0x2ecc71,
          roughness: 0.8,
          metalness: 0.1
        })
      );
    });

    it('no-theme config and defaultTheme produce identical material params', () => {
      // Call without theme
      callBuilder();
      const noThemeCall = THREE.MeshStandardMaterial.mock.calls[0][0];

      jest.clearAllMocks();

      // Call with defaultTheme
      const configWithDefaultTheme = {
        ...defaultConfig,
        theme: defaultTheme
      };
      callBuilder({ config: configWithDefaultTheme });
      const defaultThemeCall = THREE.MeshStandardMaterial.mock.calls[0][0];

      expect(noThemeCall.color).toBe(defaultThemeCall.color);
      expect(noThemeCall.roughness).toBe(defaultThemeCall.roughness);
      expect(noThemeCall.metalness).toBe(defaultThemeCall.metalness);
    });
  });

  describe('space theme produces distinct green surface color', () => {
    it('space theme applies distinct green color', () => {
      const configWithSpaceTheme = {
        ...defaultConfig,
        theme: spaceTheme
      };

      callBuilder({ config: configWithSpaceTheme });

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 0x1a3a2a
        })
      );
    });

    it('space theme color differs from default/hardcoded color', () => {
      const configWithSpaceTheme = {
        ...defaultConfig,
        theme: spaceTheme
      };

      callBuilder({ config: configWithSpaceTheme });

      const materialArgs = THREE.MeshStandardMaterial.mock.calls[0][0];
      expect(materialArgs.color).not.toBe(0x2ecc71);
      expect(materialArgs.color).toBe(spaceTheme.green.color);
    });

    it('space theme applies emissive properties', () => {
      const configWithSpaceTheme = {
        ...defaultConfig,
        theme: spaceTheme
      };

      callBuilder({ config: configWithSpaceTheme });

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          emissive: spaceTheme.green.emissive,
          emissiveIntensity: spaceTheme.green.emissiveIntensity
        })
      );
    });

    it('space theme material properties differ from default theme', () => {
      const configWithSpaceTheme = {
        ...defaultConfig,
        theme: spaceTheme
      };

      callBuilder({ config: configWithSpaceTheme });

      const materialArgs = THREE.MeshStandardMaterial.mock.calls[0][0];
      expect(materialArgs.roughness).toBe(spaceTheme.green.roughness);
      expect(materialArgs.metalness).toBe(spaceTheme.green.metalness);
    });
  });

  describe('elevation parameter adjusts surface Y position', () => {
    it('positions mesh at provided surfaceHeight', () => {
      const surfaceHeight = 0.5;
      const greenDepth = 0.01;

      callBuilder({ surfaceHeight });

      // Mesh position.y should be surfaceHeight - greenDepth/2
      const meshInstance = THREE.Mesh.mock.instances[0];
      expect(meshInstance.position.y).toBe(surfaceHeight - greenDepth / 2);
    });

    it('positions physics body at surfaceHeight', () => {
      const surfaceHeight = 1.5;

      callBuilder({ surfaceHeight });

      const body = CANNON.Body.mock.results[0].value;
      expect(body.position.set).toHaveBeenCalledWith(0, surfaceHeight, 0);
    });

    it('default surfaceHeight of 0.2 produces valid result', () => {
      const result = callBuilder({ surfaceHeight: 0.2 });

      expect(result.meshes.length).toBeGreaterThan(0);
      expect(result.bodies.length).toBe(1);
      expect(mockWorld.addBody).toHaveBeenCalled();
    });

    it('higher elevation produces valid result', () => {
      const result = callBuilder({ surfaceHeight: 2.0 });

      expect(result.meshes.length).toBeGreaterThan(0);
      expect(result.bodies.length).toBe(1);

      const body = CANNON.Body.mock.results[0].value;
      expect(body.position.set).toHaveBeenCalledWith(0, 2.0, 0);
    });

    it('zero elevation produces valid result', () => {
      const result = callBuilder({ surfaceHeight: 0 });

      expect(result.meshes.length).toBeGreaterThan(0);
      expect(result.bodies.length).toBe(1);

      const body = CANNON.Body.mock.results[0].value;
      expect(body.position.set).toHaveBeenCalledWith(0, 0, 0);
    });
  });

  describe('CSG hole cutout works at non-default elevation', () => {
    it('performs CSG subtraction at default elevation', () => {
      callBuilder({ surfaceHeight: 0.2 });

      expect(CSG.subtract).toHaveBeenCalled();
    });

    it('performs CSG subtraction at higher elevation', () => {
      callBuilder({ surfaceHeight: 2.0 });

      expect(CSG.subtract).toHaveBeenCalled();
    });

    it('performs CSG subtraction at zero elevation', () => {
      callBuilder({ surfaceHeight: 0 });

      expect(CSG.subtract).toHaveBeenCalled();
    });

    it('CSG subtraction is called for hole cutout regardless of elevation', () => {
      const elevations = [0, 0.2, 0.5, 1.0, 2.0];

      elevations.forEach(surfaceHeight => {
        jest.clearAllMocks();
        callBuilder({ surfaceHeight });
        expect(CSG.subtract).toHaveBeenCalled();
      });
    });

    it('CSG subtraction includes hazard cutouts at non-default elevation', () => {
      const config = {
        ...defaultConfig,
        hazards: [
          {
            type: 'sand',
            shape: 'circle',
            position: new THREE.Vector3(2, 0, 3),
            size: { radius: 1 }
          }
        ]
      };

      callBuilder({ config, surfaceHeight: 1.5 });

      // Should have 2 CSG.subtract calls: one for hole, one for sand hazard
      expect(CSG.subtract).toHaveBeenCalledTimes(2);
    });
  });

  describe('return value structure', () => {
    it('returns meshes and bodies arrays', () => {
      const result = callBuilder();

      expect(result).toHaveProperty('meshes');
      expect(result).toHaveProperty('bodies');
      expect(Array.isArray(result.meshes)).toBe(true);
      expect(Array.isArray(result.bodies)).toBe(true);
    });

    it('adds mesh to group', () => {
      callBuilder();

      expect(mockGroup.add).toHaveBeenCalled();
    });

    it('adds physics body to world', () => {
      callBuilder();

      expect(mockWorld.addBody).toHaveBeenCalled();
    });

    it('returns empty arrays when no boundary shape is provided', () => {
      const config = { index: 0, hazards: [] };

      const result = callBuilder({ config });

      expect(result.meshes).toEqual([]);
      expect(result.bodies).toEqual([]);
    });
  });
});
