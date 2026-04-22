/**
 * Unit tests for VisualEffectsManager
 */

import { VisualEffectsManager } from '../managers/VisualEffectsManager';
import * as THREE from 'three';

describe('VisualEffectsManager', () => {
  let mockGame;
  let mockScene;
  let mockCanvas;
  let visualEffectsManager;

  beforeEach(() => {
    // Setup mock scene
    mockScene = {
      add: jest.fn(),
      remove: jest.fn()
    };

    mockCanvas = { style: { filter: '' } };

    // Setup mock game object
    mockGame = {
      scene: mockScene,
      renderer: { domElement: mockCanvas },
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

  describe('triggerCupSinkEffect', () => {
    beforeEach(() => {
      visualEffectsManager = new VisualEffectsManager(mockGame);
    });

    test('adds exactly 12 scene children', () => {
      const position = new THREE.Vector3(0, 0, 0);
      visualEffectsManager.triggerCupSinkEffect(position);
      expect(mockScene.add).toHaveBeenCalledTimes(12);
    });

    test('records a single effect entry with 12 meshes', () => {
      const position = new THREE.Vector3(0, 0, 0);
      visualEffectsManager.triggerCupSinkEffect(position);
      expect(visualEffectsManager.effects.length).toBe(1);
      expect(visualEffectsManager.effects[0].meshes).toHaveLength(12);
    });

    test('effect starts with age 0 and lifetime 0.5', () => {
      const position = new THREE.Vector3(0, 0, 0);
      visualEffectsManager.triggerCupSinkEffect(position);
      const effect = visualEffectsManager.effects[0];
      expect(effect.age).toBe(0);
      expect(effect.lifetime).toBe(0.5);
    });

    test('removes all 12 meshes from scene after lifetime expires', () => {
      const position = new THREE.Vector3(0, 0, 0);
      visualEffectsManager.triggerCupSinkEffect(position);
      // Manually expire the effect
      visualEffectsManager.effects[0].age = 0.6;
      visualEffectsManager.update(0.016);
      expect(mockScene.remove).toHaveBeenCalledTimes(12);
      expect(visualEffectsManager.effects.length).toBe(0);
    });

    test('handles missing scene gracefully', () => {
      visualEffectsManager.scene = null;
      const position = new THREE.Vector3(0, 0, 0);
      expect(() => visualEffectsManager.triggerCupSinkEffect(position)).not.toThrow();
      expect(visualEffectsManager.effects.length).toBe(0);
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

    test('unsubscribes BALL_HIT handler on cleanup', () => {
      const unsubscribe = jest.fn();
      const mockEventManager = {
        subscribe: jest.fn(() => unsubscribe),
        unsubscribe: jest.fn()
      };
      mockGame.eventManager = mockEventManager;
      visualEffectsManager = new VisualEffectsManager(mockGame);
      visualEffectsManager.init();
      visualEffectsManager.cleanup();
      expect(mockEventManager.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('chromatic aberration (BALL_HIT)', () => {
    let capturedBallHitHandler;

    beforeEach(() => {
      const mockEventManager = {
        subscribe: jest.fn((event, handler) => {
          if (event === 'ball:hit') {
            capturedBallHitHandler = handler;
          }
          return jest.fn();
        }),
        unsubscribe: jest.fn()
      };
      mockGame.eventManager = mockEventManager;
      visualEffectsManager = new VisualEffectsManager(mockGame);
      visualEffectsManager.init();
    });

    test('subscribes to BALL_HIT on init', () => {
      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        'ball:hit',
        expect.any(Function)
      );
    });

    test('applies CSS filter to canvas on BALL_HIT', () => {
      expect(capturedBallHitHandler).toBeDefined();
      capturedBallHitHandler();
      expect(mockCanvas.style.filter).not.toBe('');
    });

    test('does nothing when renderer is absent', () => {
      mockGame.renderer = null;
      expect(() => capturedBallHitHandler?.()).not.toThrow();
    });
  });

  describe('triggerHighScoreCelebration', () => {
    beforeEach(() => {
      visualEffectsManager = new VisualEffectsManager(mockGame);
    });

    test('adds 25 meshes to the scene', () => {
      visualEffectsManager.triggerHighScoreCelebration();
      expect(mockScene.add).toHaveBeenCalledTimes(25);
    });

    test('records one effect entry with 25 meshes', () => {
      visualEffectsManager.triggerHighScoreCelebration();
      expect(visualEffectsManager.effects.length).toBe(1);
      expect(visualEffectsManager.effects[0].meshes).toHaveLength(25);
    });

    test('effect has 1.5 s lifetime and isCelebration flag', () => {
      visualEffectsManager.triggerHighScoreCelebration();
      const effect = visualEffectsManager.effects[0];
      expect(effect.lifetime).toBe(1.5);
      expect(effect.isCelebration).toBe(true);
    });

    test('handles missing scene gracefully', () => {
      visualEffectsManager.scene = null;
      expect(() => visualEffectsManager.triggerHighScoreCelebration()).not.toThrow();
      expect(visualEffectsManager.effects.length).toBe(0);
    });

    test('removes all 25 meshes after lifetime expires', () => {
      visualEffectsManager.triggerHighScoreCelebration();
      visualEffectsManager.effects[0].age = 2.0;
      visualEffectsManager.update(0.016);
      expect(mockScene.remove).toHaveBeenCalledTimes(25);
      expect(visualEffectsManager.effects.length).toBe(0);
    });
  });
});
