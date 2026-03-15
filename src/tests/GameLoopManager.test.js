/**
 * Unit tests for GameLoopManager
 */

import { GameLoopManager } from '../managers/GameLoopManager';

describe('GameLoopManager', () => {
  let mockGame;
  let mockRenderer;
  let mockScene;
  let mockCamera;
  let gameLoopManager;
  let animationFrameCallback;

  beforeEach(() => {
    // Mock requestAnimationFrame
    global.requestAnimationFrame = jest.fn(callback => {
      animationFrameCallback = callback;
      return 1;
    });
    global.cancelAnimationFrame = jest.fn();

    // Setup mock objects
    mockRenderer = {
      render: jest.fn()
    };

    mockScene = {};
    mockCamera = {};

    mockGame = {
      renderer: mockRenderer,
      scene: mockScene,
      camera: mockCamera,
      clock: {
        getDelta: jest.fn(() => 0.016)
      },
      physicsManager: {
        update: jest.fn()
      },
      performanceManager: {
        beginFrame: jest.fn(),
        endFrame: jest.fn(),
        startFrame: jest.fn(),
        startTimer: jest.fn(),
        endTimer: jest.fn()
      },
      ballManager: {
        update: jest.fn()
      },
      hazardManager: {
        update: jest.fn()
      },
      cameraController: {
        update: jest.fn()
      },
      cannonDebugRenderer: {
        update: jest.fn()
      },
      visualEffectsManager: {
        update: jest.fn()
      },
      debugManager: {
        log: jest.fn(),
        enabled: false
      },
      stateManager: {
        getGameState: jest.fn(() => 'playing')
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with game reference', () => {
      gameLoopManager = new GameLoopManager(mockGame);

      expect(gameLoopManager.game).toBe(mockGame);
      expect(gameLoopManager.isLoopRunning).toBe(false);
      expect(gameLoopManager.animationFrameId).toBe(null);
    });
  });

  describe('init', () => {
    beforeEach(() => {
      gameLoopManager = new GameLoopManager(mockGame);
    });

    test('should return manager instance', () => {
      const result = gameLoopManager.init();

      expect(result).toBe(gameLoopManager);
    });
  });

  describe('startLoop', () => {
    beforeEach(() => {
      gameLoopManager = new GameLoopManager(mockGame);
      gameLoopManager.init();
    });

    test('should start the game loop', () => {
      gameLoopManager.startLoop();

      expect(gameLoopManager.isLoopRunning).toBe(true);
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    test('should not start if already running', () => {
      gameLoopManager.startLoop();
      const firstCallCount = global.requestAnimationFrame.mock.calls.length;

      gameLoopManager.startLoop();
      const secondCallCount = global.requestAnimationFrame.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });

    test('should store animation frame ID', () => {
      gameLoopManager.startLoop();

      expect(gameLoopManager.animationFrameId).toBe(1);
    });
  });

  describe('stopLoop', () => {
    beforeEach(() => {
      gameLoopManager = new GameLoopManager(mockGame);
      gameLoopManager.init();
    });

    test('should stop the game loop', () => {
      gameLoopManager.startLoop();
      gameLoopManager.stopLoop();

      expect(gameLoopManager.isLoopRunning).toBe(false);
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(1);
      expect(gameLoopManager.animationFrameId).toBe(null);
    });

    test('should handle stop when not running', () => {
      expect(() => {
        gameLoopManager.stopLoop();
      }).not.toThrow();
    });
  });

  describe('gameLoop', () => {
    beforeEach(() => {
      gameLoopManager = new GameLoopManager(mockGame);
      gameLoopManager.init();
      gameLoopManager.startLoop();
    });

    test('should update delta time', () => {
      animationFrameCallback();

      expect(mockGame.clock.getDelta).toHaveBeenCalled();
      expect(gameLoopManager.game.deltaTime).toBe(0.016);
    });

    test('should call performance manager frame methods', () => {
      animationFrameCallback();

      // Updated to use the correct method names based on implementation
      if (mockGame.performanceManager.startFrame) {
        expect(mockGame.performanceManager.startFrame).toHaveBeenCalled();
        expect(mockGame.performanceManager.endFrame).toHaveBeenCalled();
      } else {
        expect(mockGame.performanceManager.beginFrame).toHaveBeenCalled();
        expect(mockGame.performanceManager.endFrame).toHaveBeenCalled();
      }
    });

    test('should update all managers in correct order', () => {
      const callOrder = [];

      mockGame.physicsManager.update = jest.fn(() => callOrder.push('physics'));
      mockGame.ballManager.update = jest.fn(() => callOrder.push('ball'));
      mockGame.hazardManager.update = jest.fn(() => callOrder.push('hazard'));
      mockGame.cameraController.update = jest.fn(() => callOrder.push('camera'));
      mockGame.visualEffectsManager.update = jest.fn(() => callOrder.push('effects'));

      animationFrameCallback();

      expect(callOrder).toEqual(['physics', 'ball', 'hazard', 'camera', 'effects']);
    });

    test('should render scene', () => {
      animationFrameCallback();

      expect(mockRenderer.render).toHaveBeenCalledWith(mockScene, mockCamera);
    });

    test('should update debug renderer when enabled', () => {
      mockGame.debugManager.enabled = true;

      animationFrameCallback();

      expect(mockGame.cannonDebugRenderer.update).toHaveBeenCalled();
    });

    test('should not update debug renderer when disabled', () => {
      mockGame.debugManager.enabled = false;

      animationFrameCallback();

      expect(mockGame.cannonDebugRenderer.update).not.toHaveBeenCalled();
    });

    test('should continue loop when running', () => {
      gameLoopManager.isRunning = true;
      global.requestAnimationFrame.mockClear();

      animationFrameCallback();

      expect(global.requestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should not continue loop when stopped', () => {
      gameLoopManager.isRunning = false;
      global.requestAnimationFrame.mockClear();

      animationFrameCallback();

      expect(global.requestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      gameLoopManager = new GameLoopManager(mockGame);
      gameLoopManager.init();
    });

    test('should stop loop on cleanup', () => {
      gameLoopManager.startLoop();
      gameLoopManager.cleanup();

      expect(gameLoopManager.isRunning).toBe(false);
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    test('should handle cleanup when not running', () => {
      expect(() => {
        gameLoopManager.cleanup();
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      gameLoopManager = new GameLoopManager(mockGame);
      gameLoopManager.init();
      gameLoopManager.startLoop();
    });

    test('should handle errors in update cycle', () => {
      mockGame.physicsManager.update.mockImplementation(() => {
        throw new Error('Physics error');
      });

      expect(() => {
        animationFrameCallback();
      }).not.toThrow();

      // Should still try to render
      expect(mockRenderer.render).toHaveBeenCalled();
    });

    test('should handle missing managers gracefully', () => {
      mockGame.ballManager = null;

      expect(() => {
        animationFrameCallback();
      }).not.toThrow();

      expect(mockRenderer.render).toHaveBeenCalled();
    });
  });
});
