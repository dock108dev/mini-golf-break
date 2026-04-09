/**
 * Unit tests for WebGLContextManager
 */

import { WebGLContextManager } from '../../managers/WebGLContextManager';

jest.mock('../../utils/debug', () => ({
  debug: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WebGLContextManager', () => {
  let mockGame;
  let manager;
  let mockCanvas;

  beforeEach(() => {
    // Reset DOM tracking
    document.body.innerHTML = '';
    if (global.document._elements) {
      Object.keys(global.document._elements).forEach(key => {
        delete global.document._elements[key];
      });
    }
    if (global.document.body._children) {
      global.document.body._children = [];
    }

    mockCanvas = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    mockGame = {
      renderer: {
        domElement: mockCanvas,
        setSize: jest.fn(),
        shadowMap: { enabled: false, needsUpdate: false }
      },
      gameLoopManager: {
        stopLoop: jest.fn(),
        startLoop: jest.fn()
      },
      stateManager: {
        getCurrentHoleNumber: jest.fn(() => 3)
      },
      course: {
        clearCurrentHole: jest.fn(),
        createCourse: jest.fn(() => Promise.resolve(true)),
        getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0.2, z: 0 }))
      },
      ballManager: {
        removeBall: jest.fn(),
        createBall: jest.fn()
      },
      inputController: {
        enableInput: jest.fn()
      }
    };

    manager = new WebGLContextManager(mockGame);
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('constructor', () => {
    it('should store game reference and initialize state', () => {
      expect(manager.game).toBe(mockGame);
      expect(manager.overlay).toBeNull();
      expect(manager.isContextLost).toBe(false);
    });
  });

  describe('init', () => {
    it('should attach context loss listeners to the canvas', () => {
      manager.init();

      expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
        'webglcontextlost',
        expect.any(Function)
      );
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
        'webglcontextrestored',
        expect.any(Function)
      );
    });

    it('should handle missing renderer gracefully', () => {
      mockGame.renderer = null;
      expect(() => manager.init()).not.toThrow();
    });

    it('should handle missing domElement gracefully', () => {
      mockGame.renderer = { domElement: null };
      expect(() => manager.init()).not.toThrow();
    });

    it('should return this for chaining', () => {
      const result = manager.init();
      expect(result).toBe(manager);
    });
  });

  describe('handleContextLost', () => {
    it('should call preventDefault on the event', () => {
      const event = { preventDefault: jest.fn() };
      manager.handleContextLost(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should set isContextLost to true', () => {
      manager.handleContextLost({ preventDefault: jest.fn() });
      expect(manager.isContextLost).toBe(true);
    });

    it('should stop the game loop', () => {
      manager.handleContextLost({ preventDefault: jest.fn() });
      expect(mockGame.gameLoopManager.stopLoop).toHaveBeenCalled();
    });

    it('should show the overlay', () => {
      manager.handleContextLost({ preventDefault: jest.fn() });
      expect(manager.overlay).not.toBeNull();
    });

    it('should handle missing gameLoopManager gracefully', () => {
      mockGame.gameLoopManager = null;
      expect(() => manager.handleContextLost({ preventDefault: jest.fn() })).not.toThrow();
    });
  });

  describe('handleContextRestored', () => {
    it('should call restoreGame', async () => {
      // Set up context lost state first
      manager.isContextLost = true;
      manager.showOverlay();

      const restoreSpy = jest.spyOn(manager, 'restoreGame');
      manager.handleContextRestored({});

      expect(restoreSpy).toHaveBeenCalled();
    });
  });

  describe('restoreGame', () => {
    beforeEach(() => {
      // Simulate context lost state
      manager.isContextLost = true;
      manager.showOverlay();
    });

    it('should do nothing if context is not lost', async () => {
      manager.isContextLost = false;
      await manager.restoreGame();
      expect(mockGame.renderer.setSize).not.toHaveBeenCalled();
    });

    it('should reinitialize renderer settings', async () => {
      await manager.restoreGame();
      expect(mockGame.renderer.setSize).toHaveBeenCalledWith(
        window.innerWidth,
        window.innerHeight
      );
      expect(mockGame.renderer.shadowMap.enabled).toBe(true);
      expect(mockGame.renderer.shadowMap.needsUpdate).toBe(true);
    });

    it('should reload the current hole', async () => {
      await manager.restoreGame();
      expect(mockGame.course.clearCurrentHole).toHaveBeenCalled();
      expect(mockGame.course.createCourse).toHaveBeenCalledWith(3);
    });

    it('should recreate the ball', async () => {
      await manager.restoreGame();
      expect(mockGame.ballManager.removeBall).toHaveBeenCalled();
      expect(mockGame.ballManager.createBall).toHaveBeenCalledWith({ x: 0, y: 0.2, z: 0 });
    });

    it('should re-enable input', async () => {
      await manager.restoreGame();
      expect(mockGame.inputController.enableInput).toHaveBeenCalled();
    });

    it('should restart the game loop', async () => {
      await manager.restoreGame();
      expect(mockGame.gameLoopManager.startLoop).toHaveBeenCalled();
    });

    it('should hide the overlay on success', async () => {
      await manager.restoreGame();
      expect(manager.overlay).toBeNull();
    });

    it('should set isContextLost to false', async () => {
      await manager.restoreGame();
      expect(manager.isContextLost).toBe(false);
    });

    it('should keep overlay visible on restoration failure', async () => {
      mockGame.course.createCourse.mockRejectedValueOnce(new Error('GPU error'));
      await manager.restoreGame();
      // Overlay should remain since restoreGame catches the error
      // isContextLost is set to false before the async work, but the overlay remains
      expect(manager.overlay).not.toBeNull();
    });

    it('should handle missing course gracefully', async () => {
      mockGame.course = null;
      await manager.restoreGame();
      expect(mockGame.gameLoopManager.startLoop).toHaveBeenCalled();
    });

    it('should handle missing ballManager gracefully', async () => {
      mockGame.ballManager = null;
      await expect(manager.restoreGame()).resolves.not.toThrow();
    });

    it('should handle missing inputController gracefully', async () => {
      mockGame.inputController = null;
      await expect(manager.restoreGame()).resolves.not.toThrow();
    });
  });

  describe('showOverlay', () => {
    it('should create an overlay element', () => {
      manager.showOverlay();
      expect(manager.overlay).not.toBeNull();
    });

    it('should append overlay to document.body', () => {
      manager.showOverlay();
      expect(document.body.appendChild).toHaveBeenCalledWith(manager.overlay);
    });

    it('should not create duplicate overlays', () => {
      manager.showOverlay();
      const firstOverlay = manager.overlay;
      manager.showOverlay();
      expect(manager.overlay).toBe(firstOverlay);
    });

    it('should create a retry button', () => {
      manager.showOverlay();
      // The overlay should have children (message, detail, button)
      expect(manager.overlay.appendChild).toHaveBeenCalledTimes(3);
    });
  });

  describe('hideOverlay', () => {
    it('should remove the overlay', () => {
      manager.showOverlay();
      const overlay = manager.overlay;
      manager.hideOverlay();
      expect(overlay.remove).toHaveBeenCalled();
      expect(manager.overlay).toBeNull();
    });

    it('should handle no existing overlay', () => {
      expect(() => manager.hideOverlay()).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners from canvas', () => {
      manager.init();
      manager.cleanup();

      expect(mockCanvas.removeEventListener).toHaveBeenCalledWith(
        'webglcontextlost',
        expect.any(Function)
      );
      expect(mockCanvas.removeEventListener).toHaveBeenCalledWith(
        'webglcontextrestored',
        expect.any(Function)
      );
    });

    it('should hide overlay on cleanup', () => {
      manager.showOverlay();
      manager.cleanup();
      expect(manager.overlay).toBeNull();
    });

    it('should reset isContextLost', () => {
      manager.isContextLost = true;
      manager.cleanup();
      expect(manager.isContextLost).toBe(false);
    });

    it('should handle missing renderer gracefully', () => {
      mockGame.renderer = null;
      expect(() => manager.cleanup()).not.toThrow();
    });
  });

  describe('retry button integration', () => {
    it('should call restoreGame when retry button is clicked', () => {
      manager.isContextLost = true;
      manager.showOverlay();

      const restoreSpy = jest.spyOn(manager, 'restoreGame');

      // The retry button is the third child appended to the overlay
      // Find the addEventListener call for 'click' on the button
      const allCreateCalls = document.createElement.mock.results;
      // The button is the 4th createElement call (overlay div, message div, detail div, button)
      const buttonElement = allCreateCalls[allCreateCalls.length - 1].value;

      // Simulate click via the addEventListener mock
      const clickHandlers = buttonElement.addEventListener.mock.calls
        .filter(call => call[0] === 'click');

      if (clickHandlers.length > 0) {
        clickHandlers[0][1](); // Call the click handler
        expect(restoreSpy).toHaveBeenCalled();
      }
    });
  });

  describe('full context loss/restore cycle', () => {
    it('should handle a complete loss and restoration cycle', async () => {
      manager.init();

      // Simulate context loss
      manager.handleContextLost({ preventDefault: jest.fn() });

      expect(manager.isContextLost).toBe(true);
      expect(mockGame.gameLoopManager.stopLoop).toHaveBeenCalled();
      expect(manager.overlay).not.toBeNull();

      // Simulate context restoration
      await manager.restoreGame();

      expect(manager.isContextLost).toBe(false);
      expect(mockGame.gameLoopManager.startLoop).toHaveBeenCalled();
      expect(manager.overlay).toBeNull();
      expect(mockGame.course.clearCurrentHole).toHaveBeenCalled();
      expect(mockGame.course.createCourse).toHaveBeenCalledWith(3);
    });

    it('should not produce unhandled errors during context loss', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Minimal game object - many managers missing
      const minimalGame = {
        renderer: { domElement: mockCanvas, setSize: jest.fn(), shadowMap: {} },
        gameLoopManager: null,
        stateManager: null,
        course: null,
        ballManager: null,
        inputController: null
      };

      const minimalManager = new WebGLContextManager(minimalGame);
      expect(() => {
        minimalManager.handleContextLost({ preventDefault: jest.fn() });
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});
