/**
 * Unit tests for BaseElement
 */

import { BaseElement } from '../../objects/BaseElement';

// Mock THREE.js
jest.mock('three', () => {
  const mockVector3 = jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.clone = jest.fn(() => new mockVector3(this.x, this.y, this.z));
    this.copy = jest.fn();
    this.set = jest.fn();
  });

  return {
    Vector3: mockVector3,
    Group: jest.fn(function () {
      this.position = {
        copy: jest.fn(),
        set: jest.fn(),
        x: 0,
        y: 0,
        z: 0
      };
      this.parent = null;
    })
  };
});

// Mock CANNON.js
jest.mock('cannon-es', () => ({
  // No specific mocks needed for BaseElement tests
}));

describe('BaseElement', () => {
  let mockWorld;
  let mockScene;
  let mockConfig;

  beforeEach(() => {
    // Mock physics world
    mockWorld = {
      removeBody: jest.fn()
    };

    // Mock THREE.js scene
    mockScene = {
      add: jest.fn(),
      remove: jest.fn()
    };

    // Mock configuration
    const mockPosition = new THREE.Vector3(5, 2, 3);
    mockConfig = {
      id: 'test-element',
      name: 'Test Element',
      type: 'test',
      position: mockPosition
    };

    // Clear all mocks (including THREE.Group)
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with provided config', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      expect(element.world).toBe(mockWorld);
      expect(element.config).toBe(mockConfig);
      expect(element.scene).toBe(mockScene);
      expect(element.id).toBe('test-element');
      expect(element.name).toBe('Test Element');
      expect(element.elementType).toBe('test');
      expect(element.position).toBeDefined();
      expect(typeof element.position.x).toBe('number');
      expect(typeof element.position.y).toBe('number');
      expect(typeof element.position.z).toBe('number');
    });

    test('should generate random ID when not provided', () => {
      const configWithoutId = {
        name: 'Test Element',
        type: 'test'
      };

      const element = new BaseElement(mockWorld, configWithoutId, mockScene);

      expect(element.id).toMatch(/^element_\d+$/);
    });

    test('should use default name when not provided', () => {
      const configWithoutName = {
        id: 'test',
        type: 'test'
      };

      const element = new BaseElement(mockWorld, configWithoutName, mockScene);

      expect(element.name).toBe('Unnamed Element');
    });

    test('should use default type when not provided', () => {
      const configWithoutType = {
        id: 'test',
        name: 'Test'
      };

      const element = new BaseElement(mockWorld, configWithoutType, mockScene);

      expect(element.elementType).toBe('generic');
    });

    test('should create default position when not provided', () => {
      const configWithoutPosition = {
        id: 'test',
        name: 'Test',
        type: 'test'
      };

      const element = new BaseElement(mockWorld, configWithoutPosition, mockScene);

      expect(element.position.x).toBe(0);
      expect(element.position.y).toBe(0);
      expect(element.position.z).toBe(0);
    });

    test('should clone provided position', () => {
      const position = new THREE.Vector3(1, 2, 3);
      const configWithPosition = {
        id: 'test',
        position
      };

      const element = new BaseElement(mockWorld, configWithPosition, mockScene);

      expect(element.position).toBeDefined();
      expect(typeof element.position.x).toBe('number');
      expect(typeof element.position.y).toBe('number');
      expect(typeof element.position.z).toBe('number');
    });

    test('should create default position when position is not Vector3', () => {
      const configWithInvalidPosition = {
        id: 'test',
        position: { x: 1, y: 2, z: 3 } // Plain object, not Vector3
      };

      const element = new BaseElement(mockWorld, configWithInvalidPosition, mockScene);

      expect(element.position).toBeDefined();
    });

    test('should create group and add to scene', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      expect(element.group).toBeDefined();
      expect(element.group.position).toBeDefined();
      expect(mockScene.add).toHaveBeenCalledWith(element.group);
    });

    test('should throw error when no scene provided', () => {
      expect(() => {
        new BaseElement(mockWorld, mockConfig, null);
      }).toThrow('BaseElement requires a valid scene');

      expect(console.error).toHaveBeenCalledWith(
        '[BaseElement] No valid scene provided to constructor'
      );
    });

    test('should throw error when scene lacks add method', () => {
      const invalidScene = {
        // Missing add method
        remove: jest.fn()
      };

      expect(() => {
        new BaseElement(mockWorld, mockConfig, invalidScene);
      }).toThrow('Cannot add group to scene - invalid scene reference');

      expect(console.error).toHaveBeenCalledWith(
        '[BaseElement] Cannot add group to scene - scene is invalid or lacks add() method'
      );
    });

    test('should handle scene with add method but invalid type', () => {
      const sceneWithInvalidAdd = {
        add: 'not a function'
      };

      expect(() => {
        new BaseElement(mockWorld, mockConfig, sceneWithInvalidAdd);
      }).toThrow('Cannot add group to scene - invalid scene reference');
    });

    test('should initialize arrays and group correctly', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      expect(element.meshes).toEqual([]);
      expect(element.bodies).toEqual([]);
      expect(element.group).toBeDefined();
    });

    test('should log initialization message', () => {
      new BaseElement(mockWorld, mockConfig, mockScene);

      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', '[BaseElement] Initializing test (Test Element):',
        expect.objectContaining({
          id: 'test-element',
          position: expect.any(Object)
        })
      );

      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[BaseElement] Added group to scene for test');
    });
  });

  describe('create', () => {
    test('should log warning and return true', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      const result = element.create();

      expect(console.warn).toHaveBeenCalledWith(
        '[BaseElement] Base create() called for test. Consider using an init() pattern.'
      );
      expect(result).toBe(true);
    });
  });

  describe('update', () => {
    test('should not throw with default implementation', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      expect(() => {
        element.update(0.016);
      }).not.toThrow();
    });

    test('should accept delta time parameter', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      expect(() => {
        element.update(0.016);
        element.update(0.033);
        element.update(1.0);
      }).not.toThrow();
    });
  });

  describe('destroy', () => {
    test('should clean up meshes with geometry and material', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      const mockGeometry = { dispose: jest.fn() };
      const mockMaterial = { dispose: jest.fn() };
      const mockMesh = {
        parent: { remove: jest.fn() },
        geometry: mockGeometry,
        material: mockMaterial
      };

      element.meshes.push(mockMesh);
      element.destroy();

      expect(mockMesh.parent.remove).toHaveBeenCalledWith(mockMesh);
      expect(mockGeometry.dispose).toHaveBeenCalled();
      expect(mockMaterial.dispose).toHaveBeenCalled();
    });

    test('should clean up meshes with array materials', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      const mockMaterial1 = { dispose: jest.fn() };
      const mockMaterial2 = { dispose: jest.fn() };
      const mockMesh = {
        parent: { remove: jest.fn() },
        geometry: { dispose: jest.fn() },
        material: [mockMaterial1, mockMaterial2]
      };

      element.meshes.push(mockMesh);
      element.destroy();

      expect(mockMaterial1.dispose).toHaveBeenCalled();
      expect(mockMaterial2.dispose).toHaveBeenCalled();
    });

    test('should handle meshes with null materials in array', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      const mockMaterial = { dispose: jest.fn() };
      const mockMesh = {
        parent: { remove: jest.fn() },
        geometry: { dispose: jest.fn() },
        material: [mockMaterial, null, undefined]
      };

      element.meshes.push(mockMesh);

      expect(() => {
        element.destroy();
      }).not.toThrow();

      expect(mockMaterial.dispose).toHaveBeenCalled();
    });

    test('should handle meshes without parent', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      const mockMesh = {
        parent: null,
        geometry: { dispose: jest.fn() },
        material: { dispose: jest.fn() }
      };

      element.meshes.push(mockMesh);

      expect(() => {
        element.destroy();
      }).not.toThrow();
    });

    test('should handle meshes without geometry', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      const mockMesh = {
        parent: { remove: jest.fn() },
        geometry: null,
        material: { dispose: jest.fn() }
      };

      element.meshes.push(mockMesh);

      expect(() => {
        element.destroy();
      }).not.toThrow();
    });

    test('should handle meshes without material', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      const mockMesh = {
        parent: { remove: jest.fn() },
        geometry: { dispose: jest.fn() },
        material: null
      };

      element.meshes.push(mockMesh);

      expect(() => {
        element.destroy();
      }).not.toThrow();
    });

    test('should handle material without dispose method', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      const mockMesh = {
        parent: { remove: jest.fn() },
        geometry: { dispose: jest.fn() },
        material: {
          /* no dispose method */
        }
      };

      element.meshes.push(mockMesh);

      expect(() => {
        element.destroy();
      }).not.toThrow();
    });

    test('should handle null meshes in array', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      element.meshes.push(null);
      element.meshes.push(undefined);

      expect(() => {
        element.destroy();
      }).not.toThrow();
    });

    test('should remove physics bodies from world', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      const mockBody1 = {};
      const mockBody2 = {};

      element.bodies.push(mockBody1, mockBody2);
      element.destroy();

      expect(mockWorld.removeBody).toHaveBeenCalledWith(mockBody1);
      expect(mockWorld.removeBody).toHaveBeenCalledWith(mockBody2);
    });

    test('should handle bodies when world is null', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);
      element.world = null;

      const mockBody = {};
      element.bodies.push(mockBody);

      expect(() => {
        element.destroy();
      }).not.toThrow();

      expect(mockWorld.removeBody).not.toHaveBeenCalled();
    });

    test('should handle null bodies in array', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      element.bodies.push(null);
      element.bodies.push(undefined);

      expect(() => {
        element.destroy();
      }).not.toThrow();
    });

    test('should remove group from scene', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      // Simulate the group being added to the scene (parent set automatically)
      const mockParent = { remove: jest.fn() };
      element.group.parent = mockParent;

      element.destroy();

      expect(mockParent.remove).toHaveBeenCalled();
    });

    test('should handle group without parent', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      element.group.parent = null;

      expect(() => {
        element.destroy();
      }).not.toThrow();
    });

    test('should handle null group', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      element.group = null;

      expect(() => {
        element.destroy();
      }).not.toThrow();
    });

    test('should clear arrays and nullify group', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      element.meshes.push({});
      element.bodies.push({});

      element.destroy();

      expect(element.meshes).toEqual([]);
      expect(element.bodies).toEqual([]);
      expect(element.group).toBeNull();
    });

    test('should log destruction messages', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      element.destroy();

      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[BaseElement] Destroying test (Test Element)');
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[BaseElement] Cleanup complete for test');
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete lifecycle', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      // Add some mock objects
      element.meshes.push({
        parent: { remove: jest.fn() },
        geometry: { dispose: jest.fn() },
        material: { dispose: jest.fn() }
      });
      element.bodies.push({});

      // Test create
      const createResult = element.create();
      expect(createResult).toBe(true);

      // Test update
      expect(() => element.update(0.016)).not.toThrow();

      // Test destroy
      expect(() => element.destroy()).not.toThrow();
      expect(element.meshes).toEqual([]);
      expect(element.bodies).toEqual([]);
      expect(element.group).toBeNull();
    });

    test('should handle minimal config', () => {
      const minimalConfig = {};

      const element = new BaseElement(mockWorld, minimalConfig, mockScene);

      expect(element.id).toMatch(/^element_\d+$/);
      expect(element.name).toBe('Unnamed Element');
      expect(element.elementType).toBe('generic');
      expect(element.position.x).toBe(0);
      expect(element.position.y).toBe(0);
      expect(element.position.z).toBe(0);
    });

    test('should handle multiple destroy calls safely', () => {
      const element = new BaseElement(mockWorld, mockConfig, mockScene);

      element.destroy();

      expect(() => {
        element.destroy(); // Should not throw on second call
      }).not.toThrow();
    });
  });
});
