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
    // Mock THREE objects
    Object.defineProperty(THREE, 'PointLight', {
      value: jest.fn(() => ({
        position: { set: jest.fn(), copy: jest.fn() },
        color: new THREE.Color(),
        intensity: 1,
        distance: 100,
        decay: 2
      })),
      writable: true,
      configurable: true
    });

    Object.defineProperty(THREE, 'Color', {
      value: jest.fn(() => ({
        setHex: jest.fn(),
        r: 1,
        g: 1,
        b: 1
      })),
      writable: true,
      configurable: true
    });

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
    beforeEach(() => {
      visualEffectsManager = new VisualEffectsManager(mockGame);
    });

    test('should log initialization', () => {
      // Clear previous constructor logs
      mockGame.debugManager.log.mockClear();

      visualEffectsManager.init();

      // Check if console.log was called (not debugManager)
      expect(console.log).toHaveBeenCalledWith('[VisualEffectsManager] init() called.');
    });
  });

  describe('triggerRejectionEffect', () => {
    beforeEach(() => {
      visualEffectsManager = new VisualEffectsManager(mockGame);
      visualEffectsManager.init();
    });

    test('should log rejection effect message', () => {
      const position = new THREE.Vector3(10, 5, 15);

      visualEffectsManager.triggerRejectionEffect(position);

      expect(console.log).toHaveBeenCalledWith(
        '[VisualEffectsManager] Triggering rejection effect at (10.00, 5.00, 15.00)'
      );
    });

    test('should handle missing scene gracefully', () => {
      visualEffectsManager.scene = null;
      const position = new THREE.Vector3(10, 5, 15);

      expect(() => {
        visualEffectsManager.triggerRejectionEffect(position);
      }).not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        '[VisualEffectsManager] Cannot trigger effect: Scene not available.'
      );
    });
  });

  describe('resetBallVisuals', () => {
    beforeEach(() => {
      visualEffectsManager = new VisualEffectsManager(mockGame);
      visualEffectsManager.init();
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
});
