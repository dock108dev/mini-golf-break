/**
 * Unit tests for VisualEffectsManager
 */

import { VisualEffectsManager } from '../managers/VisualEffectsManager';
import * as THREE from 'three';

describe('VisualEffectsManager', () => {
  let mockGame;
  let mockScene;
  let visualEffectsManager;

  beforeEach(() => {
    // Setup mock scene
    mockScene = {
      add: jest.fn(),
      remove: jest.fn()
    };

    // Setup mock game object
    mockGame = {
      scene: mockScene,
      debugManager: {
        log: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with game reference', () => {
      visualEffectsManager = new VisualEffectsManager(mockGame);

      expect(visualEffectsManager.game).toBe(mockGame);
      expect(visualEffectsManager.scene).toBe(mockScene);
      expect(visualEffectsManager.effects).toBeDefined();
      expect(Array.isArray(visualEffectsManager.effects)).toBe(true);
      expect(visualEffectsManager.effects.length).toBe(0);
    });
  });

  describe('init', () => {
    test('should not throw', () => {
      visualEffectsManager = new VisualEffectsManager(mockGame);
      expect(() => visualEffectsManager.init()).not.toThrow();
    });
  });

  describe('triggerRejectionEffect', () => {
    beforeEach(() => {
      visualEffectsManager = new VisualEffectsManager(mockGame);
    });

    test('should create particles and add to scene', () => {
      const position = new THREE.Vector3(10, 5, 15);

      visualEffectsManager.triggerRejectionEffect(position);

      expect(mockScene.add).toHaveBeenCalledTimes(1);
      expect(visualEffectsManager.effects.length).toBe(1);
      expect(visualEffectsManager.effects[0].age).toBe(0);
      expect(visualEffectsManager.effects[0].lifetime).toBe(1.0);
      expect(visualEffectsManager.effects[0].velocities.length).toBe(40);
    });

    test('should handle missing scene gracefully', () => {
      visualEffectsManager.scene = null;
      const position = new THREE.Vector3(10, 5, 15);

      expect(() => {
        visualEffectsManager.triggerRejectionEffect(position);
      }).not.toThrow();

      expect(visualEffectsManager.effects.length).toBe(0);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      visualEffectsManager = new VisualEffectsManager(mockGame);
    });

    test('should age effects and update positions', () => {
      const position = new THREE.Vector3(0, 0, 0);
      visualEffectsManager.triggerRejectionEffect(position);

      const effect = visualEffectsManager.effects[0];
      const initialAge = effect.age;

      visualEffectsManager.update(0.1);

      expect(effect.age).toBeGreaterThan(initialAge);
    });

    test('should remove expired effects', () => {
      const position = new THREE.Vector3(0, 0, 0);
      visualEffectsManager.triggerRejectionEffect(position);

      // Fast-forward past lifetime
      visualEffectsManager.effects[0].age = 1.5;
      visualEffectsManager.update(0.016);

      expect(visualEffectsManager.effects.length).toBe(0);
      expect(mockScene.remove).toHaveBeenCalledTimes(1);
    });

    test('should fade opacity over time', () => {
      const position = new THREE.Vector3(0, 0, 0);
      visualEffectsManager.triggerRejectionEffect(position);

      const effect = visualEffectsManager.effects[0];
      effect.age = 0.5; // Half lifetime

      visualEffectsManager.update(0.016);

      expect(effect.points.material.opacity).toBeLessThan(1.0);
    });

    test('should handle non-number dt gracefully', () => {
      const position = new THREE.Vector3(0, 0, 0);
      visualEffectsManager.triggerRejectionEffect(position);

      expect(() => {
        visualEffectsManager.update(null);
      }).not.toThrow();
    });
  });

  describe('resetBallVisuals', () => {
    beforeEach(() => {
      visualEffectsManager = new VisualEffectsManager(mockGame);
    });

    test('should reset ball material and scale', () => {
      const mockBall = {
        mesh: {
          material: 'modified-material',
          scale: { set: jest.fn() }
        },
        defaultMaterial: 'default-material'
      };

      visualEffectsManager.resetBallVisuals(mockBall);

      expect(mockBall.mesh.material).toBe('default-material');
      expect(mockBall.mesh.scale.set).toHaveBeenCalledWith(1, 1, 1);
    });

    test('should handle null ball gracefully', () => {
      expect(() => {
        visualEffectsManager.resetBallVisuals(null);
      }).not.toThrow();
    });

    test('should handle ball without mesh gracefully', () => {
      const mockBall = { defaultMaterial: 'default' };

      expect(() => {
        visualEffectsManager.resetBallVisuals(mockBall);
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      visualEffectsManager = new VisualEffectsManager(mockGame);
    });

    test('should dispose all effects and clear array', () => {
      const position = new THREE.Vector3(0, 0, 0);
      visualEffectsManager.triggerRejectionEffect(position);
      visualEffectsManager.triggerRejectionEffect(position);

      expect(visualEffectsManager.effects.length).toBe(2);

      visualEffectsManager.cleanup();

      expect(visualEffectsManager.effects.length).toBe(0);
      expect(mockScene.remove).toHaveBeenCalledTimes(2);
    });

    test('should handle empty effects array', () => {
      expect(() => {
        visualEffectsManager.cleanup();
      }).not.toThrow();
    });
  });
});
