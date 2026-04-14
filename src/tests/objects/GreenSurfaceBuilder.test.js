/**
 * Unit tests for GreenSurfaceBuilder — config-driven geometry construction
 * ISSUE-027, ISSUE-128
 */

import { defaultTheme } from '../../themes/defaultTheme';
import { spaceTheme } from '../../themes/spaceTheme';
import { MATERIAL_PALETTE } from '../../themes/palette';

// Mock three-csg-ts
jest.mock('three-csg-ts', () => ({
  CSG: {
    subtract: jest.fn(baseMesh => baseMesh)
  }
}));

// Override three mock with GreenSurfaceBuilder-specific needs
jest.mock(
  'three',
  () => {
    const originalThree = jest.requireActual('three');
    return {
      ...originalThree,
      MeshStandardMaterial: jest.fn(params => ({
        ...params,
        dispose: jest.fn()
      })),
      Mesh: jest.fn(function (geometry, material) {
        this.geometry = geometry;
        this.material = material;
        this.position = {
          x: 0,
          y: 0,
          z: 0,
          set: jest.fn(function (x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
          }),
          copy: jest.fn()
        };
        this.rotation = {
          x: 0,
          y: 0,
          z: 0,
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
      Shape: jest.fn(function () {
        this.holes = [];
      }),
      Path: jest.fn(function () {}),
      Box2: jest.fn(() => ({
        min: { x: -5, y: -10 },
        max: { x: 5, y: 10 },
        setFromPoints: jest.fn(),
        getCenter: jest.fn(target => {
          target.x = 0;
          target.y = 0;
          return target;
        }),
        getSize: jest.fn(target => {
          target.x = 10;
          target.y = 20;
          return target;
        })
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
  },
  { virtual: true }
);

// Override cannon-es mock with position.set support
jest.mock('cannon-es', () => ({
  Body: Object.assign(
    jest.fn(() => ({
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
      quaternion: {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
        set: jest.fn(),
        setFromAxisAngle: jest.fn()
      },
      addShape: jest.fn(),
      userData: {}
    })),
    { STATIC: 1 }
  ),
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

    it('uses palette fallback color when no theme is provided', () => {
      callBuilder();

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: MATERIAL_PALETTE.floor.color,
          roughness: MATERIAL_PALETTE.floor.roughness,
          metalness: MATERIAL_PALETTE.floor.metalness
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

    it('no-theme config falls back to MATERIAL_PALETTE values', () => {
      callBuilder();
      const noThemeCall = THREE.MeshStandardMaterial.mock.calls[0][0];

      expect(noThemeCall.color).toBe(MATERIAL_PALETTE.floor.color);
      expect(noThemeCall.roughness).toBe(MATERIAL_PALETTE.floor.roughness);
      expect(noThemeCall.metalness).toBe(MATERIAL_PALETTE.floor.metalness);
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

    it('mesh has geometry and material assigned', () => {
      const result = callBuilder();

      expect(result.meshes.length).toBe(1);
      const mesh = result.meshes[0];
      expect(mesh.material).toBeDefined();
      expect(mesh.material.color).toBeDefined();
    });

    it('mesh receives shadow but does not cast shadow', () => {
      const result = callBuilder();

      const mesh = result.meshes[0];
      expect(mesh.receiveShadow).toBe(true);
      expect(mesh.castShadow).toBe(false);
    });

    it('physics body has green userData type', () => {
      callBuilder();

      const body = CANNON.Body.mock.results[0].value;
      expect(body.userData).toEqual({ type: 'green', holeIndex: 0 });
    });
  });

  describe('boundary shape dimensions affect physics plane size', () => {
    it('creates physics PlaneGeometry sized from boundary shape bounds plus padding', () => {
      const boundaryShape = [
        new THREE.Vector2(-3, -6),
        new THREE.Vector2(3, -6),
        new THREE.Vector2(3, 6),
        new THREE.Vector2(-3, 6)
      ];

      callBuilder({ boundaryShape });

      expect(THREE.PlaneGeometry).toHaveBeenCalled();
      const planeArgs = THREE.PlaneGeometry.mock.calls[0];
      expect(planeArgs[0]).toBeGreaterThan(0);
      expect(planeArgs[1]).toBeGreaterThan(0);
    });

    it('creates ExtrudeGeometry from boundaryShape', () => {
      callBuilder();

      expect(THREE.Shape).toHaveBeenCalled();
      expect(THREE.ExtrudeGeometry).toHaveBeenCalledWith(expect.any(THREE.Shape), {
        depth: 0.01,
        bevelEnabled: false
      });
    });

    it('disposes temporary physics plane geometry after creating trimesh', () => {
      callBuilder();

      const planeGeom = THREE.PlaneGeometry.mock.results[0].value;
      expect(planeGeom.dispose).toHaveBeenCalled();
    });
  });

  describe('invalid and missing config handling', () => {
    it('returns empty arrays when config has neither boundaryShape nor boundaryShapeDef', () => {
      const config = { index: 0, hazards: [] };

      const result = callBuilder({ config });

      expect(result.meshes).toEqual([]);
      expect(result.bodies).toEqual([]);
      expect(mockWorld.addBody).not.toHaveBeenCalled();
      expect(mockGroup.add).not.toHaveBeenCalled();
    });

    it('logs an error when no boundary shape is provided', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const config = { index: 3, hazards: [] };

      callBuilder({ config });

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('No valid boundaryShape or boundaryShapeDef found for hole 3')
      );
      spy.mockRestore();
    });

    it('handles config with empty hazards array gracefully', () => {
      const config = { ...defaultConfig, hazards: [] };

      const result = callBuilder({ config });

      expect(result.meshes.length).toBe(1);
      expect(result.bodies.length).toBe(1);
    });

    it('handles config with undefined hazards gracefully', () => {
      const config = { ...defaultConfig };
      delete config.hazards;

      const result = callBuilder({ config });

      expect(result.meshes.length).toBe(1);
      expect(result.bodies.length).toBe(1);
    });

    it('handles missing theme gracefully by using palette defaults', () => {
      const config = { ...defaultConfig };
      delete config.theme;

      const result = callBuilder({ config });

      expect(result.meshes.length).toBe(1);
      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: MATERIAL_PALETTE.floor.color })
      );
    });
  });

  describe('boundaryShapeDef with outer and holes', () => {
    it('uses boundaryShapeDef.outer when provided instead of boundaryShape', () => {
      const config = {
        ...defaultConfig,
        boundaryShapeDef: {
          outer: [
            new THREE.Vector2(-4, -8),
            new THREE.Vector2(4, -8),
            new THREE.Vector2(4, 8),
            new THREE.Vector2(-4, 8)
          ]
        }
      };

      const result = callBuilder({ config });

      expect(result.meshes.length).toBe(1);
      expect(result.bodies.length).toBe(1);
      expect(THREE.Shape).toHaveBeenCalledWith(config.boundaryShapeDef.outer);
    });

    it('adds holes from boundaryShapeDef.holes to the shape', () => {
      const holePoints = [
        new THREE.Vector2(-1, -1),
        new THREE.Vector2(1, -1),
        new THREE.Vector2(1, 1),
        new THREE.Vector2(-1, 1)
      ];
      const config = {
        ...defaultConfig,
        boundaryShapeDef: {
          outer: [
            new THREE.Vector2(-4, -8),
            new THREE.Vector2(4, -8),
            new THREE.Vector2(4, 8),
            new THREE.Vector2(-4, 8)
          ],
          holes: [holePoints]
        }
      };

      callBuilder({ config });

      expect(THREE.Path).toHaveBeenCalledWith(holePoints);
      const shapeInstance = THREE.Shape.mock.instances[0];
      expect(shapeInstance.holes.length).toBe(1);
    });
  });

  describe('hazard cutters', () => {
    it('creates cylindrical cutter for circular sand hazard', () => {
      const config = {
        ...defaultConfig,
        hazards: [
          {
            type: 'sand',
            shape: 'circle',
            position: new THREE.Vector3(2, 0, 3),
            size: { radius: 1.5 }
          }
        ]
      };

      callBuilder({ config });

      expect(THREE.CylinderGeometry).toHaveBeenCalledWith(1.5, 1.5, expect.any(Number), 32);
      expect(CSG.subtract).toHaveBeenCalledTimes(2);
    });

    it('creates box cutter for rectangular water hazard', () => {
      const config = {
        ...defaultConfig,
        hazards: [
          {
            type: 'water',
            shape: 'rectangle',
            position: new THREE.Vector3(1, 0, 4),
            size: { width: 2, length: 3 }
          }
        ]
      };

      callBuilder({ config });

      expect(THREE.BoxGeometry).toHaveBeenCalledWith(2, expect.any(Number), 3);
      expect(CSG.subtract).toHaveBeenCalledTimes(2);
    });

    it('ignores non-sand/water hazard types for cutouts', () => {
      const config = {
        ...defaultConfig,
        hazards: [
          {
            type: 'lava',
            shape: 'circle',
            position: new THREE.Vector3(1, 0, 2),
            size: { radius: 1 }
          }
        ]
      };

      callBuilder({ config });

      expect(CSG.subtract).toHaveBeenCalledTimes(1);
    });

    it('handles hazard position as plain object instead of Vector3', () => {
      const config = {
        ...defaultConfig,
        hazards: [
          {
            type: 'sand',
            shape: 'circle',
            position: { x: 2, z: 3 },
            size: { radius: 1 }
          }
        ]
      };

      const result = callBuilder({ config });

      expect(result.meshes.length).toBe(1);
      expect(CSG.subtract).toHaveBeenCalledTimes(2);
    });

    it('creates multiple cutters for multiple hazards', () => {
      const config = {
        ...defaultConfig,
        hazards: [
          {
            type: 'sand',
            shape: 'circle',
            position: new THREE.Vector3(2, 0, 3),
            size: { radius: 1 }
          },
          {
            type: 'water',
            shape: 'rectangle',
            position: new THREE.Vector3(-2, 0, -3),
            size: { width: 1.5, length: 2 }
          }
        ]
      };

      callBuilder({ config });

      expect(CSG.subtract).toHaveBeenCalledTimes(3);
    });
  });

  describe('physics body configuration', () => {
    it('creates a static body with mass 0', () => {
      callBuilder();

      expect(CANNON.Body).toHaveBeenCalledWith(
        expect.objectContaining({
          mass: 0,
          type: CANNON.Body.STATIC
        })
      );
    });

    it('uses world groundMaterial for physics body', () => {
      const groundMaterial = { id: 'ground' };
      mockWorld.groundMaterial = groundMaterial;

      callBuilder();

      expect(CANNON.Body).toHaveBeenCalledWith(
        expect.objectContaining({
          material: groundMaterial
        })
      );
    });

    it('adds a Trimesh shape to the physics body', () => {
      callBuilder();

      expect(CANNON.Trimesh).toHaveBeenCalled();
      const body = CANNON.Body.mock.results[0].value;
      expect(body.addShape).toHaveBeenCalled();
    });
  });
});
