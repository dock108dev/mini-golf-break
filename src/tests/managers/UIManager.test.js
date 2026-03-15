/**
 * Unit tests for UIManager
 */

import { UIManager } from '../../managers/UIManager';
import { EventTypes } from '../../events/EventTypes';

// Mock dependencies
jest.mock('../../events/EventTypes', () => ({
  EventTypes: {
    HOLE_COMPLETED: 'HOLE_COMPLETED',
    HOLE_STARTED: 'HOLE_STARTED',
    GAME_COMPLETED: 'GAME_COMPLETED',
    BALL_HIT: 'BALL_HIT',
    BALL_IN_HOLE: 'BALL_IN_HOLE',
    HAZARD_DETECTED: 'HAZARD_DETECTED',
    UI_REQUEST_RESTART_GAME: 'UI_REQUEST_RESTART_GAME'
  }
}));

jest.mock('../../managers/ui/UIScoreOverlay', () => ({
  UIScoreOverlay: jest.fn(() => ({
    init: jest.fn(),
    updateHoleInfo: jest.fn(),

    updateScore: jest.fn(),
    updateStrokes: jest.fn(),
    showFinalScorecard: jest.fn(),
    hideFinalScorecard: jest.fn(),
    cleanup: jest.fn()
  }))
}));

jest.mock('../../managers/ui/UIDebugOverlay', () => ({
  UIDebugOverlay: jest.fn(() => ({
    init: jest.fn(),
    updateDebugDisplay: jest.fn(),
    cleanup: jest.fn()
  }))
}));

jest.mock('../../utils/debug', () => ({
  debug: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('UIManager', () => {
  let mockGame;
  let uiManager;

  beforeEach(() => {
    // Mock DOM methods completely - no complex implementation
    document.body.innerHTML = '';
    document.createElement = jest.fn(() => ({
      id: '',
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn()
      },
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      addEventListener: jest.fn(),
      style: {},
      remove: jest.fn(),
      removeChild: jest.fn(),
      parentNode: null,
      firstChild: null
    }));
    document.getElementById = jest.fn(() => null);
    document.body.appendChild = jest.fn();
    document.body.insertBefore = jest.fn();

    // Create mock game
    mockGame = {
      eventManager: {
        subscribe: jest.fn(() => jest.fn()) // Return unsubscribe function
      },
      scoringSystem: {
        getTotalStrokes: jest.fn(() => 42)
      },
      debugManager: {
        error: jest.fn(),
        warn: jest.fn()
      }
    };

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Mock global alert
    global.alert = jest.fn();

    // Mock setTimeout and clearTimeout
    global.setTimeout = jest.fn((fn, timeout) => {
      return 'timeout-id-' + timeout;
    });
    global.clearTimeout = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up any remaining DOM elements
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    test('should initialize with game reference', () => {
      uiManager = new UIManager(mockGame);

      expect(uiManager.game).toBe(mockGame);
    });

    test('should initialize with default state', () => {
      uiManager = new UIManager(mockGame);

      expect(uiManager.uiContainer).toBeNull();
      expect(uiManager.renderer).toBeNull();
      expect(uiManager.scoreOverlay).toBeNull();
      expect(uiManager.debugOverlay).toBeNull();
      expect(uiManager.isShowingMessage).toBe(false);
      expect(uiManager.messageTimeoutId).toBeNull();
      expect(uiManager.messageTimeout).toBeNull();
      expect(uiManager.messageElement).toBeNull();
      expect(uiManager.powerIndicator).toBeNull();
      expect(uiManager.eventSubscriptions).toEqual([]);
    });
  });

  describe('init', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
    });

    test('should initialize successfully', () => {
      const result = uiManager.init();

      expect(uiManager.uiContainer).toBeTruthy();
      expect(uiManager.scoreOverlay).toBeTruthy();
      expect(uiManager.debugOverlay).toBeTruthy();
      expect(uiManager.messageElement).toBeTruthy();
      expect(uiManager.powerIndicator).toBeTruthy();
      expect(result).toBe(uiManager); // Returns self for chaining
    });

    test('should handle initialization errors', () => {
      // Mock createMainContainer to throw an error
      const createMainContainerSpy = jest
        .spyOn(uiManager, 'createMainContainer')
        .mockImplementation(() => {
          throw new Error('Failed to create container');
        });

      uiManager.init();

      expect(console.error).toHaveBeenCalledWith('[UIManager.init] Failed:', expect.any(Error));
      expect(mockGame.debugManager.error).toHaveBeenCalledWith(
        'UIManager.init',
        'Initialization failed',
        expect.any(Error),
        true
      );

      createMainContainerSpy.mockRestore();
    });
  });

  describe('createMainContainer', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
    });

    test('should set uiContainer property when creating new container', () => {
      uiManager.createMainContainer();

      expect(uiManager.uiContainer).toBeTruthy();
      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    test('should use existing container when available', () => {
      const mockExistingContainer = { id: 'ui-container' };
      document.getElementById.mockReturnValue(mockExistingContainer);

      uiManager.createMainContainer();

      expect(uiManager.uiContainer).toBe(mockExistingContainer);
      expect(document.createElement).not.toHaveBeenCalled();
    });

    test('should call cleanup before creating container', () => {
      const cleanupSpy = jest.spyOn(uiManager, 'cleanup').mockImplementation(() => {});

      uiManager.createMainContainer();

      expect(cleanupSpy).toHaveBeenCalled();
      cleanupSpy.mockRestore();
    });
  });

  describe('createMessageUI', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.uiContainer = { appendChild: jest.fn() };
    });

    test('should create and set messageElement property', () => {
      uiManager.createMessageUI();

      expect(uiManager.messageElement).toBeTruthy();
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(uiManager.uiContainer.appendChild).toHaveBeenCalledWith(uiManager.messageElement);
    });
  });

  describe('createPowerIndicatorUI', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.uiContainer = { appendChild: jest.fn() };
    });

    test('should create and set powerIndicator property', () => {
      uiManager.createPowerIndicatorUI();

      expect(uiManager.powerIndicator).toBeTruthy();
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(uiManager.uiContainer.appendChild).toHaveBeenCalledWith(uiManager.powerIndicator);
    });
  });

  describe('setupEventListeners', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
    });

    test('should setup event listeners successfully', () => {
      uiManager.setupEventListeners();

      expect(mockGame.eventManager.subscribe).toHaveBeenCalledTimes(7); // All event types
      expect(uiManager.eventSubscriptions.length).toBe(7);
    });

    test('should handle missing event manager gracefully', () => {
      mockGame.eventManager = null;

      uiManager.setupEventListeners();

      expect(console.warn).toHaveBeenCalledWith(
        '[UIManager.setupEventListeners] EventManager not available, skipping.'
      );
    });

    test('should clear existing subscriptions before adding new ones', () => {
      const mockUnsubscribe1 = jest.fn();
      const mockUnsubscribe2 = jest.fn();
      uiManager.eventSubscriptions = [mockUnsubscribe1, mockUnsubscribe2];

      uiManager.setupEventListeners();

      expect(mockUnsubscribe1).toHaveBeenCalled();
      expect(mockUnsubscribe2).toHaveBeenCalled();
    });

    test('should handle subscription errors', () => {
      mockGame.eventManager.subscribe.mockImplementation(() => {
        throw new Error('Subscription failed');
      });

      uiManager.setupEventListeners();

      expect(console.error).toHaveBeenCalledWith(
        '[UIManager.setupEventListeners] Failed:',
        expect.any(Error)
      );
    });
  });

  describe('event handlers', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    describe('handleHoleCompleted', () => {
      test('should show completion message and update overlay', () => {
        const mockEvent = {
          get: jest.fn(key => (key === 'holeNumber' ? 3 : null))
        };
        const showMessageSpy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});

        uiManager.handleHoleCompleted(mockEvent);

        expect(showMessageSpy).toHaveBeenCalledWith(
          'Hole 3 completed! Total strokes so far: 42',
          3000
        );
        expect(uiManager.scoreOverlay.updateHoleInfo).toHaveBeenCalled();

        expect(uiManager.scoreOverlay.updateScore).toHaveBeenCalled();

        showMessageSpy.mockRestore();
      });
    });

    describe('handleHoleStarted', () => {
      test('should show hole message and update overlay', () => {
        const mockEvent = {
          get: jest.fn(key => (key === 'holeNumber' ? 5 : null))
        };
        const showMessageSpy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});

        uiManager.handleHoleStarted(mockEvent);

        expect(showMessageSpy).toHaveBeenCalledWith('Hole 5', 2000);
        expect(uiManager.scoreOverlay.updateHoleInfo).toHaveBeenCalled();

        expect(uiManager.scoreOverlay.updateScore).toHaveBeenCalled();
        expect(uiManager.scoreOverlay.updateStrokes).toHaveBeenCalled();

        showMessageSpy.mockRestore();
      });
    });

    describe('handleGameCompleted', () => {
      test('should show final scorecard when available', () => {
        uiManager.handleGameCompleted({});

        expect(uiManager.scoreOverlay.showFinalScorecard).toHaveBeenCalled();
      });

      test('should fallback to alert when scorecard not available', () => {
        uiManager.scoreOverlay.showFinalScorecard = undefined;

        uiManager.handleGameCompleted({});

        expect(global.alert).toHaveBeenCalledWith('Game Complete! Total strokes: 42');
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[UIManager.handleGameCompleted] ERROR: Cannot show scorecard')
        );
      });

      test('should handle missing scoreOverlay', () => {
        uiManager.scoreOverlay = null;

        uiManager.handleGameCompleted({});

        expect(global.alert).toHaveBeenCalledWith('Game Complete! Total strokes: 42');
      });
    });

    describe('handleBallHit', () => {
      test('should update score and strokes', () => {
        uiManager.handleBallHit({});

        expect(uiManager.scoreOverlay.updateScore).toHaveBeenCalled();
        expect(uiManager.scoreOverlay.updateStrokes).toHaveBeenCalled();
      });
    });

    describe('handleBallInHole', () => {
      test('should not perform specific actions', () => {
        expect(() => {
          uiManager.handleBallInHole({});
        }).not.toThrow();
      });
    });

    describe('handleHazardDetected', () => {
      test('should show water hazard message', () => {
        const mockEvent = {
          get: jest.fn(key => (key === 'hazardType' ? 'water' : null))
        };
        const showMessageSpy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});

        uiManager.handleHazardDetected(mockEvent);

        expect(showMessageSpy).toHaveBeenCalledWith('Water hazard! +1 stroke penalty.', 2000);
        expect(uiManager.scoreOverlay.updateStrokes).toHaveBeenCalled();

        showMessageSpy.mockRestore();
      });

      test('should show out of bounds message', () => {
        const mockEvent = {
          get: jest.fn(key => (key === 'hazardType' ? 'outOfBounds' : null))
        };
        const showMessageSpy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});

        uiManager.handleHazardDetected(mockEvent);

        expect(showMessageSpy).toHaveBeenCalledWith('Out of bounds! +1 stroke penalty.', 2000);

        showMessageSpy.mockRestore();
      });

      test('should not show message for sand hazard', () => {
        const mockEvent = {
          get: jest.fn(key => (key === 'hazardType' ? 'sand' : null))
        };
        const showMessageSpy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});

        uiManager.handleHazardDetected(mockEvent);

        expect(showMessageSpy).not.toHaveBeenCalled();
        expect(uiManager.scoreOverlay.updateStrokes).toHaveBeenCalled();

        showMessageSpy.mockRestore();
      });
    });
  });

  describe('attachRenderer', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
    });

    test('should store renderer reference when valid', () => {
      const mockRenderer = {
        domElement: { parentNode: null }
      };

      uiManager.attachRenderer(mockRenderer);

      expect(uiManager.renderer).toBe(mockRenderer);
    });

    test('should handle invalid renderer gracefully', () => {
      uiManager.attachRenderer(null);

      expect(mockGame.debugManager.warn).toHaveBeenCalledWith(
        'UIManager.attachRenderer',
        'Invalid renderer or domElement'
      );
    });

    test('should handle renderer without domElement', () => {
      uiManager.attachRenderer({});

      expect(mockGame.debugManager.warn).toHaveBeenCalledWith(
        'UIManager.attachRenderer',
        'Invalid renderer or domElement'
      );
    });
  });

  describe('message display', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.createMainContainer();
      uiManager.createMessageUI();
    });

    describe('showMessage', () => {
      test('should display message with default duration', () => {
        // Spy on classList.add to verify it was called
        const addClassSpy = jest.spyOn(uiManager.messageElement.classList, 'add');

        uiManager.showMessage('Test message');

        expect(uiManager.messageElement.textContent).toBe('Test message');
        expect(uiManager.messageElement.style.opacity).toBe('1');
        expect(uiManager.messageElement.style.visibility).toBe('visible');
        expect(addClassSpy).toHaveBeenCalledWith('visible');
        expect(uiManager.isShowingMessage).toBe(true);
        expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);

        addClassSpy.mockRestore();
      });

      test('should display message with custom duration', () => {
        uiManager.showMessage('Custom message', 5000);

        expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
      });

      test('should clear existing timeout before showing new message', () => {
        uiManager.messageTimeout = 'existing-timeout';

        uiManager.showMessage('New message');

        expect(global.clearTimeout).toHaveBeenCalledWith('existing-timeout');
        expect(uiManager.messageTimeout).toBe('timeout-id-2000');
      });

      test('should handle missing message element gracefully', () => {
        uiManager.messageElement = null;

        expect(() => {
          uiManager.showMessage('Test message');
        }).not.toThrow();
      });
    });

    describe('hideMessage', () => {
      test('should hide message when showing', () => {
        uiManager.isShowingMessage = true;

        uiManager.hideMessage();

        expect(uiManager.messageElement.style.opacity).toBe('0');
        expect(uiManager.isShowingMessage).toBe(false);
        expect(uiManager.messageTimeout).toBeNull();
      });

      test('should handle hiding when not showing message', () => {
        uiManager.isShowingMessage = false;

        expect(() => {
          uiManager.hideMessage();
        }).not.toThrow();
      });

      test('should handle missing message element', () => {
        uiManager.messageElement = null;
        uiManager.isShowingMessage = true;

        expect(() => {
          uiManager.hideMessage();
        }).not.toThrow();
      });

      test('should set up transition event listener', () => {
        uiManager.messageElement = {
          style: {},
          classList: { remove: jest.fn() },
          addEventListener: jest.fn()
        };
        uiManager.isShowingMessage = true;

        uiManager.hideMessage();

        expect(uiManager.messageElement.addEventListener).toHaveBeenCalledWith(
          'transitionend',
          expect.any(Function),
          { once: true }
        );
      });
    });
  });

  describe('delegated methods', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('updateScore should delegate to scoreOverlay', () => {
      uiManager.updateScore();
      expect(uiManager.scoreOverlay.updateScore).toHaveBeenCalled();
    });

    test('updateHoleInfo should delegate to scoreOverlay', () => {
      uiManager.updateHoleInfo();
      expect(uiManager.scoreOverlay.updateHoleInfo).toHaveBeenCalled();
    });

    test('updateStrokes should delegate to scoreOverlay', () => {
      uiManager.updateStrokes();
      expect(uiManager.scoreOverlay.updateStrokes).toHaveBeenCalled();
    });

    test('updateDebugDisplay should delegate to debugOverlay', () => {
      const debugInfo = { test: 'data' };
      uiManager.updateDebugDisplay(debugInfo);
      expect(uiManager.debugOverlay.updateDebugDisplay).toHaveBeenCalledWith(debugInfo);
    });

    test('showFinalScorecard should delegate to scoreOverlay', () => {
      uiManager.showFinalScorecard();
      expect(uiManager.scoreOverlay.showFinalScorecard).toHaveBeenCalled();
    });

    test('hideFinalScorecard should delegate to scoreOverlay', () => {
      uiManager.hideFinalScorecard();
      expect(uiManager.scoreOverlay.hideFinalScorecard).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('should cleanup all UI elements and subscriptions', () => {
      // Create mock unsubscribe function that will be added to eventSubscriptions
      const mockUnsubscribe = jest.fn();
      uiManager.eventSubscriptions = [mockUnsubscribe];
      uiManager.messageTimeout = 'timeout-id';

      // Verify initial state - overlays should be created
      expect(uiManager.scoreOverlay).toBeTruthy();
      expect(uiManager.debugOverlay).toBeTruthy();

      uiManager.cleanup();

      expect(uiManager.scoreOverlay).toBeNull();
      expect(uiManager.debugOverlay).toBeNull();
      expect(global.clearTimeout).toHaveBeenCalledWith('timeout-id');
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(uiManager.eventSubscriptions).toEqual([]);

      // Check properties are reset
      expect(uiManager.messageElement).toBeNull();
      expect(uiManager.powerIndicator).toBeNull();
      expect(uiManager.uiContainer).toBeNull();
      expect(uiManager.messageTimeout).toBeNull();
    });

    test('should handle cleanup with missing elements gracefully', () => {
      uiManager.scoreOverlay = null;
      uiManager.debugOverlay = null;
      uiManager.messageElement = null;
      uiManager.powerIndicator = null;
      uiManager.uiContainer = null;

      expect(() => {
        uiManager.cleanup();
      }).not.toThrow();
    });

    test('should handle unsubscription errors', () => {
      const failingUnsubscribe = jest.fn(() => {
        throw new Error('Unsubscribe failed');
      });
      uiManager.eventSubscriptions = [failingUnsubscribe];

      uiManager.cleanup();

      expect(console.warn).toHaveBeenCalledWith(
        '[UIManager.cleanup] Error unsubscribing from an event:',
        expect.any(Error)
      );
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
    });

    test('should handle complete initialization and cleanup cycle', () => {
      // Initialize
      uiManager.init();
      expect(uiManager.uiContainer).toBeTruthy();
      expect(uiManager.scoreOverlay).toBeTruthy();

      // Show a message
      uiManager.showMessage('Test message', 1000);
      expect(uiManager.isShowingMessage).toBe(true);

      // Cleanup
      uiManager.cleanup();
      expect(uiManager.uiContainer).toBeNull();
      expect(uiManager.scoreOverlay).toBeNull();
    });

    test('should handle renderer attachment after initialization', () => {
      uiManager.init();

      const mockRenderer = {
        domElement: { parentNode: null }
      };

      uiManager.attachRenderer(mockRenderer);

      expect(uiManager.renderer).toBe(mockRenderer);
    });

    test('should handle event workflow for hole completion', () => {
      uiManager.init();
      const showMessageSpy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});

      const mockEvent = {
        get: jest.fn(key => (key === 'holeNumber' ? 1 : null))
      };

      uiManager.handleHoleCompleted(mockEvent);

      expect(showMessageSpy).toHaveBeenCalled();
      expect(uiManager.scoreOverlay.updateScore).toHaveBeenCalled();

      showMessageSpy.mockRestore();
    });
  });
});
