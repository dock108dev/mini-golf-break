/**
 * Unit tests for CannonDebugRenderer
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CannonDebugRenderer } from '../../utils/CannonDebugRenderer';

// Mock debug utility
jest.mock('../../utils/debug', () => ({
  debug: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

// Mock Three.js
jest.mock('three', () => ({
  MeshBasicMaterial: jest.fn(() => ({
    color: 0x00ff00,
    wireframe: true,
    transparent: true,
    opacity: 0.5
  })),
  SphereGeometry: jest.fn(() => ({ type: 'sphere' })),
  BoxGeometry: jest.fn(() => ({ type: 'box' })),
  PlaneGeometry: jest.fn(() => ({ type: 'plane' })),
  CylinderGeometry: jest.fn(() => ({ type: 'cylinder' })),
  BufferGeometry: jest.fn(() => ({
    setAttribute: jest.fn(),
    setIndex: jest.fn()
  })),
  BufferAttribute: jest.fn((data, size) => ({ data, size })),
  Float32BufferAttribute: jest.fn((data, size) => ({ data, size })),
  Mesh: jest.fn((geometry, material) => ({
    geometry,
    material,
    position: { copy: jest.fn() },
    quaternion: { copy: jest.fn() },
    scale: {
      set: jest.fn(),
      copy: jest.fn(),
      multiplyScalar: jest.fn()
    },
    parent: null
  })),
  Vector3: jest.fn(() => ({
    copy: jest.fn()
  })),
  Quaternion: jest.fn(() => ({
    copy: jest.fn()
  }))
}));

// Mock Cannon-es
jest.mock('cannon-es', () => ({
  Shape: {
    types: {
      SPHERE: 1,
      BOX: 2,
      PLANE: 4,
      CYLINDER: 16,
      TRIMESH: 256,
      HEIGHTFIELD: 512
    }
  }
}));

describe('CannonDebugRenderer', () => {
  let mockScene;
  let mockWorld;
  let debugRenderer;

  beforeEach(() => {
    // Mock scene
    mockScene = {
      add: jest.fn(),
      remove: jest.fn()
    };

    // Mock world
    mockWorld = {
      bodies: []
    };

    // Mock console
    console.log = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with scene and world', () => {
      debugRenderer = new CannonDebugRenderer(mockScene, mockWorld);

      expect(debugRenderer.scene).toBe(mockScene);
      expect(debugRenderer.world).toBe(mockWorld);
      expect(debugRenderer._meshes).toEqual([]);
    });

    test('should create material with default options', () => {
      debugRenderer = new CannonDebugRenderer(mockScene, mockWorld);

      expect(THREE.MeshBasicMaterial).toHaveBeenCalledWith({
        color: 0x00ff00,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
    });

    test('should create material with custom options', () => {
      debugRenderer = new CannonDebugRenderer(mockScene, mockWorld, {
        color: 0xff0000,
        opacity: 0.8
      });

      expect(THREE.MeshBasicMaterial).toHaveBeenCalledWith({
        color: 0xff0000,
        wireframe: true,
        transparent: true,
        opacity: 0.8
      });
    });

    test('should create all geometry types', () => {
      debugRenderer = new CannonDebugRenderer(mockScene, mockWorld);

      expect(THREE.SphereGeometry).toHaveBeenCalledWith(1);
      expect(THREE.BoxGeometry).toHaveBeenCalledWith(1, 1, 1);
      expect(THREE.PlaneGeometry).toHaveBeenCalledWith(10, 10, 10, 10);
      expect(THREE.CylinderGeometry).toHaveBeenCalledWith(1, 1, 1, 32);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      debugRenderer = new CannonDebugRenderer(mockScene, mockWorld);
    });

    test('should remove existing meshes before creating new ones', () => {
      const mockMesh1 = { type: 'mesh1' };
      const mockMesh2 = { type: 'mesh2' };
      debugRenderer._meshes = [mockMesh1, mockMesh2];

      debugRenderer.update();

      expect(mockScene.remove).toHaveBeenCalledWith(mockMesh1);
      expect(mockScene.remove).toHaveBeenCalledWith(mockMesh2);
      expect(debugRenderer._meshes).toHaveLength(0);
    });

    test('should create meshes for all body shapes', () => {
      const mockBody = {
        position: { x: 1, y: 2, z: 3 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        shapes: [{ type: CANNON.Shape.types.SPHERE, radius: 0.5 }]
      };
      mockWorld.bodies = [mockBody];

      debugRenderer.update();

      expect(mockScene.add).toHaveBeenCalled();
      expect(debugRenderer._meshes).toHaveLength(1);
    });

    test('should handle bodies with multiple shapes', () => {
      const mockBody = {
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        shapes: [
          { type: CANNON.Shape.types.SPHERE, radius: 0.5 },
          { type: CANNON.Shape.types.BOX, halfExtents: { x: 1, y: 1, z: 1 } }
        ]
      };
      mockWorld.bodies = [mockBody];

      debugRenderer.update();

      expect(mockScene.add).toHaveBeenCalledTimes(2);
      expect(debugRenderer._meshes).toHaveLength(2);
    });

    test('should skip shapes that cannot be created', () => {
      const mockBody = {
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        shapes: [
          { type: 999 } // Unknown shape type
        ]
      };
      mockWorld.bodies = [mockBody];

      debugRenderer.update();

      expect(console.warn).toHaveBeenCalledWith('Unhandled shape type: 999');
      expect(mockScene.add).not.toHaveBeenCalled();
      expect(debugRenderer._meshes).toHaveLength(0);
    });
  });

  describe('clearMeshes', () => {
    beforeEach(() => {
      debugRenderer = new CannonDebugRenderer(mockScene, mockWorld);
    });

    test('should remove all tracked meshes from their parents', () => {
      const mockParent = { remove: jest.fn() };
      const mockMesh1 = { parent: mockParent };
      const mockMesh2 = { parent: mockParent };
      const mockMesh3 = { parent: null }; // No parent

      debugRenderer._meshes = [mockMesh1, mockMesh2, mockMesh3];

      debugRenderer.clearMeshes();

      expect(mockParent.remove).toHaveBeenCalledWith(mockMesh1);
      expect(mockParent.remove).toHaveBeenCalledWith(mockMesh2);
      expect(mockParent.remove).toHaveBeenCalledTimes(2);
      expect(debugRenderer._meshes).toHaveLength(0);
      const { debug } = require('../../utils/debug');
      expect(debug.log).toHaveBeenCalledWith('[CannonDebugRenderer] Cleared tracked meshes.');
    });

    test('should handle empty meshes array', () => {
      debugRenderer._meshes = [];

      debugRenderer.clearMeshes();

      expect(debugRenderer._meshes).toHaveLength(0);
      const { debug } = require('../../utils/debug');
      expect(debug.log).toHaveBeenCalledWith('[CannonDebugRenderer] Cleared tracked meshes.');
    });
  });

  describe('_createMesh', () => {
    beforeEach(() => {
      debugRenderer = new CannonDebugRenderer(mockScene, mockWorld);
    });

    test('should create sphere mesh', () => {
      const shape = { type: CANNON.Shape.types.SPHERE };

      const mesh = debugRenderer._createMesh(shape);

      expect(mesh).toBeDefined();
      expect(THREE.Mesh).toHaveBeenCalledWith(
        debugRenderer._sphereGeometry,
        debugRenderer._material
      );
    });

    test('should create box mesh', () => {
      const shape = { type: CANNON.Shape.types.BOX };

      const mesh = debugRenderer._createMesh(shape);

      expect(mesh).toBeDefined();
      expect(THREE.Mesh).toHaveBeenCalledWith(debugRenderer._boxGeometry, debugRenderer._material);
    });

    test('should create plane mesh', () => {
      const shape = { type: CANNON.Shape.types.PLANE };

      const mesh = debugRenderer._createMesh(shape);

      expect(mesh).toBeDefined();
      expect(THREE.Mesh).toHaveBeenCalledWith(
        debugRenderer._planeGeometry,
        debugRenderer._material
      );
    });

    test('should create cylinder mesh', () => {
      const shape = { type: CANNON.Shape.types.CYLINDER };

      const mesh = debugRenderer._createMesh(shape);

      expect(mesh).toBeDefined();
      expect(THREE.Mesh).toHaveBeenCalledWith(
        debugRenderer._cylinderGeometry,
        debugRenderer._material
      );
    });

    test('should create trimesh with custom geometry', () => {
      const shape = {
        type: CANNON.Shape.types.TRIMESH,
        vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2]
      };

      const mesh = debugRenderer._createMesh(shape);

      expect(mesh).toBeDefined();
      expect(THREE.BufferGeometry).toHaveBeenCalled();
      expect(THREE.BufferAttribute).toHaveBeenCalledTimes(2);
    });

    test('should create heightfield with custom geometry', () => {
      const shape = {
        type: CANNON.Shape.types.HEIGHTFIELD,
        data: [
          [0, 1],
          [1, 0]
        ],
        elementSize: 1
      };

      const mesh = debugRenderer._createMesh(shape);

      expect(mesh).toBeDefined();
      expect(THREE.BufferGeometry).toHaveBeenCalled();
      expect(THREE.Float32BufferAttribute).toHaveBeenCalled();
    });

    test('should return null for unknown shape type', () => {
      const shape = { type: 999 };

      const mesh = debugRenderer._createMesh(shape);

      expect(mesh).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('Unhandled shape type: 999');
    });
  });

  describe('_scaleMesh', () => {
    let mockMesh;

    beforeEach(() => {
      debugRenderer = new CannonDebugRenderer(mockScene, mockWorld);
      mockMesh = {
        scale: {
          set: jest.fn(),
          copy: jest.fn(),
          multiplyScalar: jest.fn()
        }
      };
    });

    test('should scale sphere mesh by radius', () => {
      const shape = {
        type: CANNON.Shape.types.SPHERE,
        radius: 2.5
      };

      debugRenderer._scaleMesh(mockMesh, shape);

      expect(mockMesh.scale.set).toHaveBeenCalledWith(2.5, 2.5, 2.5);
    });

    test('should scale box mesh by halfExtents', () => {
      const shape = {
        type: CANNON.Shape.types.BOX,
        halfExtents: { x: 1, y: 2, z: 3 }
      };

      debugRenderer._scaleMesh(mockMesh, shape);

      expect(mockMesh.scale.copy).toHaveBeenCalledWith(shape.halfExtents);
      expect(mockMesh.scale.multiplyScalar).toHaveBeenCalledWith(2);
    });

    test('should not scale plane mesh', () => {
      const shape = { type: CANNON.Shape.types.PLANE };

      debugRenderer._scaleMesh(mockMesh, shape);

      expect(mockMesh.scale.set).not.toHaveBeenCalled();
      expect(mockMesh.scale.copy).not.toHaveBeenCalled();
    });

    test('should scale cylinder mesh', () => {
      const shape = {
        type: CANNON.Shape.types.CYLINDER,
        radiusTop: 1.5,
        height: 3
      };

      debugRenderer._scaleMesh(mockMesh, shape);

      expect(mockMesh.scale.set).toHaveBeenCalledWith(1.5, 3, 1.5);
    });

    test('should scale trimesh by shape scale', () => {
      const shape = {
        type: CANNON.Shape.types.TRIMESH,
        scale: { x: 2, y: 2, z: 2 }
      };

      debugRenderer._scaleMesh(mockMesh, shape);

      expect(mockMesh.scale.copy).toHaveBeenCalledWith(shape.scale);
    });

    test('should set heightfield scale to 1,1,1', () => {
      const shape = { type: CANNON.Shape.types.HEIGHTFIELD };

      debugRenderer._scaleMesh(mockMesh, shape);

      expect(mockMesh.scale.set).toHaveBeenCalledWith(1, 1, 1);
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      debugRenderer = new CannonDebugRenderer(mockScene, mockWorld);
    });

    test('should handle complete update cycle', () => {
      // Add a sphere body
      const sphereBody = {
        position: { x: 0, y: 1, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        shapes: [{ type: CANNON.Shape.types.SPHERE, radius: 0.5 }]
      };
      mockWorld.bodies = [sphereBody];

      // First update
      debugRenderer.update();
      expect(debugRenderer._meshes).toHaveLength(1);
      expect(mockScene.add).toHaveBeenCalledTimes(1);

      // Add another body
      const boxBody = {
        position: { x: 2, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        shapes: [{ type: CANNON.Shape.types.BOX, halfExtents: { x: 1, y: 1, z: 1 } }]
      };
      mockWorld.bodies.push(boxBody);

      // Second update - should clear previous meshes
      debugRenderer.update();
      expect(mockScene.remove).toHaveBeenCalledTimes(1);
      expect(debugRenderer._meshes).toHaveLength(2);
      expect(mockScene.add).toHaveBeenCalledTimes(3); // 1 from first update, 2 from second
    });

    test('should handle mesh lifecycle properly', () => {
      const body = {
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        shapes: [{ type: CANNON.Shape.types.SPHERE, radius: 1 }]
      };
      mockWorld.bodies = [body];

      // Create meshes
      debugRenderer.update();
      const createdMesh = debugRenderer._meshes[0];
      expect(createdMesh).toBeDefined();

      // Clear meshes
      debugRenderer.clearMeshes();
      expect(debugRenderer._meshes).toHaveLength(0);
    });
  });
});
