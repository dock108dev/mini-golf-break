/**
 * Unit tests for UIManager — overlay lifecycle and event-driven visibility (ISSUE-119)
 */

import { UIManager } from '../../managers/UIManager';
import { EventTypes } from '../../events/EventTypes';

jest.mock('../../events/EventTypes', () => ({
  EventTypes: {
    HOLE_COMPLETED: 'HOLE_COMPLETED',
    HOLE_STARTED: 'HOLE_STARTED',
    GAME_COMPLETED: 'GAME_COMPLETED',
    BALL_HIT: 'BALL_HIT',
    BALL_IN_HOLE: 'BALL_IN_HOLE',
    HAZARD_DETECTED: 'HAZARD_DETECTED',
    STROKE_LIMIT_WARNING: 'STROKE_LIMIT_WARNING',
    STROKE_LIMIT_REACHED: 'STROKE_LIMIT_REACHED',
    GAME_PAUSED: 'GAME_PAUSED',
    GAME_RESUMED: 'GAME_RESUMED',
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

jest.mock('../../utils/navigation', () => ({
  reloadPage: jest.fn()
}));

describe('UIManager', () => {
  let mockGame;
  let uiManager;
  let subscribedHandlers;

  function createMockGame() {
    return {
      eventManager: {
        subscribe: jest.fn((type, handler) => {
          subscribedHandlers[type] = handler;
          return jest.fn();
        })
      },
      scoringSystem: {
        getTotalStrokes: jest.fn(() => 42),
        getCurrentStrokes: jest.fn(() => 3)
      },
      debugManager: {
        error: jest.fn(),
        warn: jest.fn()
      },
      audioManager: {
        isMuted: false,
        toggleMute: jest.fn(),
        getMasterVolume: jest.fn().mockReturnValue(1.0),
        setMasterVolume: jest.fn()
      }
    };
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    subscribedHandlers = {};
    mockGame = createMockGame();

    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    global.alert = jest.fn();
    global.setTimeout = jest.fn((_fn, timeout) => 'timeout-id-' + timeout);
    global.clearTimeout = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    test('should initialize with game reference and default state', () => {
      uiManager = new UIManager(mockGame);

      expect(uiManager.game).toBe(mockGame);
      expect(uiManager.uiContainer).toBeNull();
      expect(uiManager.scoreOverlay).toBeNull();
      expect(uiManager.debugOverlay).toBeNull();
      expect(uiManager.eventSubscriptions).toEqual([]);
    });
  });

  describe('init', () => {
    test('should initialize submodules and return self', () => {
      uiManager = new UIManager(mockGame);
      const result = uiManager.init();

      expect(uiManager.scoreOverlay).toBeTruthy();
      expect(uiManager.debugOverlay).toBeTruthy();
      expect(result).toBe(uiManager);
    });

    test('should handle initialization errors', () => {
      uiManager = new UIManager(mockGame);
      jest.spyOn(uiManager, 'createMainContainer').mockImplementation(() => {
        throw new Error('init failure');
      });

      uiManager.init();

      expect(console.error).toHaveBeenCalledWith('[UIManager.init] Failed:', expect.any(Error));
    });
  });

  describe('setupEventListeners — subscription verification', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('should subscribe to all expected EventTypes', () => {
      const subscribeCalls = mockGame.eventManager.subscribe.mock.calls;
      const subscribedTypes = subscribeCalls.map(call => call[0]);

      expect(subscribedTypes).toContain(EventTypes.HOLE_COMPLETED);
      expect(subscribedTypes).toContain(EventTypes.HOLE_STARTED);
      expect(subscribedTypes).toContain(EventTypes.GAME_COMPLETED);
      expect(subscribedTypes).toContain(EventTypes.BALL_HIT);
      expect(subscribedTypes).toContain(EventTypes.BALL_IN_HOLE);
      expect(subscribedTypes).toContain(EventTypes.HAZARD_DETECTED);
      expect(subscribedTypes).toContain(EventTypes.STROKE_LIMIT_WARNING);
      expect(subscribedTypes).toContain(EventTypes.STROKE_LIMIT_REACHED);
      expect(subscribedTypes).toContain(EventTypes.GAME_PAUSED);
      expect(subscribedTypes).toContain(EventTypes.GAME_RESUMED);
      expect(subscribedTypes).toContain(EventTypes.UI_REQUEST_RESTART_GAME);
    });

    test('should store unsubscribe functions for all subscriptions', () => {
      expect(uiManager.eventSubscriptions.length).toBe(11);
      uiManager.eventSubscriptions.forEach(unsub => {
        expect(typeof unsub).toBe('function');
      });
    });

    test('should handle missing event manager gracefully', () => {
      mockGame.eventManager = null;
      uiManager = new UIManager(mockGame);
      uiManager.setupEventListeners();

      expect(console.warn).toHaveBeenCalledWith(
        '[UIManager.setupEventListeners] EventManager not available, skipping.'
      );
    });

    test('should clear existing subscriptions before re-subscribing', () => {
      const unsub1 = jest.fn();
      const unsub2 = jest.fn();
      uiManager.eventSubscriptions = [unsub1, unsub2];

      uiManager.setupEventListeners();

      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).toHaveBeenCalled();
    });
  });

  describe('HOLE_STARTED event — score overlay update', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('should update score overlay with hole info and reset strokes', () => {
      const mockEvent = { get: jest.fn(key => (key === 'holeNumber' ? 5 : null)) };
      const showMessageSpy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});

      uiManager.handleHoleStarted(mockEvent);

      expect(showMessageSpy).toHaveBeenCalledWith('Hole 5', 2000);
      expect(uiManager.scoreOverlay.updateHoleInfo).toHaveBeenCalled();
      expect(uiManager.scoreOverlay.updateScore).toHaveBeenCalled();
      expect(uiManager.scoreOverlay.updateStrokes).toHaveBeenCalled();
    });
  });

  describe('BALL_HIT event — stroke count update', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('should update strokes display on ball hit', () => {
      uiManager.handleBallHit({});

      expect(uiManager.scoreOverlay.updateScore).toHaveBeenCalled();
      expect(uiManager.scoreOverlay.updateStrokes).toHaveBeenCalled();
    });
  });

  describe('HOLE_COMPLETED event — completion overlay and power indicator', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('should show completion message and hide power indicator', () => {
      const mockEvent = { get: jest.fn(key => (key === 'holeNumber' ? 3 : null)) };
      const showMessageSpy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});
      const hidePowerSpy = jest.spyOn(uiManager, 'hidePowerIndicator').mockImplementation(() => {});

      uiManager.handleHoleCompleted(mockEvent);

      expect(showMessageSpy).toHaveBeenCalledWith(
        'Hole 3 completed! Total strokes so far: 42',
        3000
      );
      expect(hidePowerSpy).toHaveBeenCalled();
      expect(uiManager.scoreOverlay.updateHoleInfo).toHaveBeenCalled();
      expect(uiManager.scoreOverlay.updateScore).toHaveBeenCalled();
    });

    test('hidePowerIndicator sets display none on power indicator', () => {
      uiManager.hidePowerIndicator();

      expect(uiManager.powerIndicator.style.display).toBe('none');
    });

    test('hidePowerIndicator handles missing power indicator', () => {
      uiManager.powerIndicator = null;

      expect(() => uiManager.hidePowerIndicator()).not.toThrow();
    });

    test('showPowerIndicator restores display', () => {
      uiManager.powerIndicator.style.display = 'none';
      uiManager.showPowerIndicator();

      expect(uiManager.powerIndicator.style.display).toBe('');
    });
  });

  describe('GAME_PAUSED event — pause overlay visibility', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('should show pause overlay when GAME_PAUSED handler is called', () => {
      const showSpy = jest.spyOn(uiManager, 'showPauseOverlay');

      uiManager.handleGamePaused();

      expect(showSpy).toHaveBeenCalled();
    });

    test('showPauseOverlay adds visible class', () => {
      uiManager.resumeButton = { focus: jest.fn() };

      uiManager.showPauseOverlay();

      expect(uiManager.pauseOverlay.classList.add).toHaveBeenCalledWith('visible');
    });

    test('showPauseOverlay hides the pause button', () => {
      uiManager.resumeButton = { focus: jest.fn() };

      uiManager.showPauseOverlay();

      expect(uiManager.pauseButton.style.display).toBe('none');
    });

    test('showPauseOverlay focuses resume button', () => {
      uiManager.resumeButton = { focus: jest.fn() };

      uiManager.showPauseOverlay();

      expect(uiManager.resumeButton.focus).toHaveBeenCalled();
    });

    test('showPauseOverlay handles missing overlay', () => {
      uiManager.pauseOverlay = null;

      expect(() => uiManager.showPauseOverlay()).not.toThrow();
    });

    test('GAME_PAUSED event triggers showPauseOverlay via subscription', () => {
      const handler = subscribedHandlers[EventTypes.GAME_PAUSED];

      expect(handler).toBeDefined();
      expect(handler).toBe(uiManager.handleGamePaused);
    });
  });

  describe('GAME_RESUMED event — pause overlay hidden', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('should hide pause overlay when GAME_RESUMED handler is called', () => {
      const hideSpy = jest.spyOn(uiManager, 'hidePauseOverlay');

      uiManager.handleGameResumed();

      expect(hideSpy).toHaveBeenCalled();
    });

    test('hidePauseOverlay removes visible class', () => {
      uiManager.hidePauseOverlay();

      expect(uiManager.pauseOverlay.classList.remove).toHaveBeenCalledWith('visible');
    });

    test('hidePauseOverlay restores pause button display', () => {
      uiManager.pauseButton.style.display = 'none';

      uiManager.hidePauseOverlay();

      expect(uiManager.pauseButton.style.display).toBe('');
    });

    test('hidePauseOverlay handles missing overlay', () => {
      uiManager.pauseOverlay = null;

      expect(() => uiManager.hidePauseOverlay()).not.toThrow();
    });

    test('GAME_RESUMED event triggers hidePauseOverlay via subscription', () => {
      const handler = subscribedHandlers[EventTypes.GAME_RESUMED];

      expect(handler).toBeDefined();
      expect(handler).toBe(uiManager.handleGameResumed);
    });
  });

  describe('cleanup (dispose) — unsubscribes and disposes sub-overlays', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('should call cleanup on scoreOverlay and debugOverlay', () => {
      const scoreCleanup = uiManager.scoreOverlay.cleanup;
      const debugCleanup = uiManager.debugOverlay.cleanup;

      uiManager.cleanup();

      expect(scoreCleanup).toHaveBeenCalled();
      expect(debugCleanup).toHaveBeenCalled();
    });

    test('should unsubscribe all event listeners', () => {
      const unsubFns = uiManager.eventSubscriptions.map(fn => fn);
      expect(unsubFns.length).toBeGreaterThan(0);

      uiManager.cleanup();

      unsubFns.forEach(fn => expect(fn).toHaveBeenCalled());
      expect(uiManager.eventSubscriptions).toEqual([]);
    });

    test('should null out all overlay references', () => {
      uiManager.cleanup();

      expect(uiManager.scoreOverlay).toBeNull();
      expect(uiManager.debugOverlay).toBeNull();
      expect(uiManager.pauseOverlay).toBeNull();
      expect(uiManager.messageElement).toBeNull();
      expect(uiManager.powerIndicator).toBeNull();
      expect(uiManager.transitionOverlay).toBeNull();
      expect(uiManager.uiContainer).toBeNull();
      expect(uiManager.muteButton).toBeNull();
      expect(uiManager.resumeButton).toBeNull();
      expect(uiManager.quitButton).toBeNull();
    });

    test('should clear message timeout', () => {
      uiManager.messageTimeout = 'timeout-id';

      uiManager.cleanup();

      expect(global.clearTimeout).toHaveBeenCalledWith('timeout-id');
      expect(uiManager.messageTimeout).toBeNull();
    });

    test('should handle errors during unsubscribe gracefully', () => {
      uiManager.eventSubscriptions = [
        jest.fn(() => {
          throw new Error('unsub error');
        })
      ];

      uiManager.cleanup();

      expect(console.warn).toHaveBeenCalledWith(
        '[UIManager.cleanup] Error unsubscribing from an event:',
        expect.any(Error)
      );
      expect(uiManager.eventSubscriptions).toEqual([]);
    });

    test('should handle cleanup when overlays are already null', () => {
      uiManager.scoreOverlay = null;
      uiManager.debugOverlay = null;
      uiManager.messageElement = null;
      uiManager.powerIndicator = null;
      uiManager.uiContainer = null;

      expect(() => uiManager.cleanup()).not.toThrow();
    });
  });

  describe('handleGameCompleted', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('should show final scorecard when available', () => {
      uiManager.handleGameCompleted({});

      expect(uiManager.scoreOverlay.showFinalScorecard).toHaveBeenCalled();
    });

    test('should fallback to alert when scorecard method missing', () => {
      uiManager.scoreOverlay.showFinalScorecard = undefined;

      uiManager.handleGameCompleted({});

      expect(global.alert).toHaveBeenCalledWith('Game Complete! Total strokes: 42');
    });

    test('should handle missing scoreOverlay', () => {
      uiManager.scoreOverlay = null;

      uiManager.handleGameCompleted({});

      expect(global.alert).toHaveBeenCalledWith('Game Complete! Total strokes: 42');
    });
  });

  describe('handleHazardDetected', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('should show water hazard message', () => {
      const mockEvent = { get: jest.fn(key => (key === 'hazardType' ? 'water' : null)) };
      const spy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});

      uiManager.handleHazardDetected(mockEvent);

      expect(spy).toHaveBeenCalledWith('Water hazard! +1 stroke penalty.', 2000);
      expect(uiManager.scoreOverlay.updateStrokes).toHaveBeenCalled();
    });

    test('should show out of bounds message', () => {
      const mockEvent = { get: jest.fn(key => (key === 'hazardType' ? 'outOfBounds' : null)) };
      const spy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});

      uiManager.handleHazardDetected(mockEvent);

      expect(spy).toHaveBeenCalledWith('Out of bounds! +1 stroke penalty.', 2000);
    });

    test('should not show message for unknown hazard type', () => {
      const mockEvent = { get: jest.fn(key => (key === 'hazardType' ? 'sand' : null)) };
      const spy = jest.spyOn(uiManager, 'showMessage').mockImplementation(() => {});

      uiManager.handleHazardDetected(mockEvent);

      expect(spy).not.toHaveBeenCalled();
      expect(uiManager.scoreOverlay.updateStrokes).toHaveBeenCalled();
    });
  });

  describe('delegated methods', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('updateScore delegates to scoreOverlay', () => {
      uiManager.updateScore();
      expect(uiManager.scoreOverlay.updateScore).toHaveBeenCalled();
    });

    test('updateHoleInfo delegates to scoreOverlay', () => {
      uiManager.updateHoleInfo();
      expect(uiManager.scoreOverlay.updateHoleInfo).toHaveBeenCalled();
    });

    test('updateStrokes delegates to scoreOverlay', () => {
      uiManager.updateStrokes();
      expect(uiManager.scoreOverlay.updateStrokes).toHaveBeenCalled();
    });

    test('updateDebugDisplay delegates to debugOverlay', () => {
      uiManager.updateDebugDisplay({ fps: 60 });
      expect(uiManager.debugOverlay.updateDebugDisplay).toHaveBeenCalledWith({ fps: 60 });
    });

    test('showFinalScorecard delegates to scoreOverlay', () => {
      uiManager.showFinalScorecard();
      expect(uiManager.scoreOverlay.showFinalScorecard).toHaveBeenCalled();
    });

    test('hideFinalScorecard delegates to scoreOverlay', () => {
      uiManager.hideFinalScorecard();
      expect(uiManager.scoreOverlay.hideFinalScorecard).toHaveBeenCalled();
    });
  });

  describe('attachRenderer', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
    });

    test('should store renderer reference', () => {
      const mockRenderer = {
        domElement: { parentNode: null, setAttribute: jest.fn() }
      };

      uiManager.attachRenderer(mockRenderer);

      expect(uiManager.renderer).toBe(mockRenderer);
    });

    test('should warn for invalid renderer', () => {
      uiManager.attachRenderer(null);

      expect(mockGame.debugManager.warn).toHaveBeenCalledWith(
        'UIManager.attachRenderer',
        'Invalid renderer or domElement'
      );
    });

    test('should warn for renderer without domElement', () => {
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

    test('showMessage sets content and visibility', () => {
      uiManager.showMessage('Test message');

      expect(uiManager.messageElement.textContent).toBe('Test message');
      expect(uiManager.messageElement.style.opacity).toBe('1');
      expect(uiManager.messageElement.style.visibility).toBe('visible');
      expect(uiManager.isShowingMessage).toBe(true);
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
    });

    test('showMessage with custom duration', () => {
      uiManager.showMessage('Custom', 5000);

      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    test('showMessage clears existing timeout', () => {
      uiManager.messageTimeout = 'old-timeout';

      uiManager.showMessage('New');

      expect(global.clearTimeout).toHaveBeenCalledWith('old-timeout');
    });

    test('showMessage handles missing messageElement', () => {
      uiManager.messageElement = null;

      expect(() => uiManager.showMessage('Test')).not.toThrow();
    });

    test('hideMessage sets opacity to 0', () => {
      uiManager.isShowingMessage = true;

      uiManager.hideMessage();

      expect(uiManager.messageElement.style.opacity).toBe('0');
      expect(uiManager.isShowingMessage).toBe(false);
    });

    test('hideMessage no-ops when not showing', () => {
      uiManager.isShowingMessage = false;

      uiManager.hideMessage();

      expect(uiManager.messageElement.style.opacity).not.toBe('0');
    });
  });

  describe('transition overlay', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.createMainContainer();
      uiManager.createTransitionOverlay();
    });

    test('showTransitionOverlay adds visible class', () => {
      const spy = jest.spyOn(uiManager.transitionOverlay.classList, 'add');

      uiManager.showTransitionOverlay();

      expect(spy).toHaveBeenCalledWith('visible');
    });

    test('hideTransitionOverlay removes visible class', () => {
      const spy = jest.spyOn(uiManager.transitionOverlay.classList, 'remove');

      uiManager.hideTransitionOverlay();

      expect(spy).toHaveBeenCalledWith('visible');
    });
  });

  describe('UI_REQUEST_RESTART_GAME handler', () => {
    afterEach(() => {
      delete window.App;
    });

    test('should call window.App.returnToMenu when available', () => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
      const mockReturnToMenu = jest.fn();
      window.App = { returnToMenu: mockReturnToMenu };

      const handler = subscribedHandlers[EventTypes.UI_REQUEST_RESTART_GAME];
      handler();

      expect(mockReturnToMenu).toHaveBeenCalled();
    });

    test('should fallback to reload when App unavailable', () => {
      const { reloadPage } = require('../../utils/navigation');
      uiManager = new UIManager(mockGame);
      uiManager.init();

      const handler = subscribedHandlers[EventTypes.UI_REQUEST_RESTART_GAME];
      handler();

      expect(reloadPage).toHaveBeenCalled();
    });
  });

  describe('_trapFocus', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
    });

    test('ignores non-Tab keys', () => {
      const event = { key: 'Enter', preventDefault: jest.fn() };
      const container = { querySelectorAll: jest.fn() };

      uiManager._trapFocus(event, container);

      expect(container.querySelectorAll).not.toHaveBeenCalled();
    });

    test('handles empty focusable list', () => {
      const event = { key: 'Tab', shiftKey: false, preventDefault: jest.fn() };
      const container = { querySelectorAll: jest.fn(() => []) };

      uiManager._trapFocus(event, container);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('wraps Tab from last to first', () => {
      const btn1 = { focus: jest.fn() };
      const btn2 = { focus: jest.fn() };
      const event = { key: 'Tab', shiftKey: false, preventDefault: jest.fn() };
      const container = { querySelectorAll: jest.fn(() => [btn1, btn2]) };
      Object.defineProperty(document, 'activeElement', { value: btn2, configurable: true });

      uiManager._trapFocus(event, container);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(btn1.focus).toHaveBeenCalled();
    });

    test('wraps Shift+Tab from first to last', () => {
      const btn1 = { focus: jest.fn() };
      const btn2 = { focus: jest.fn() };
      const event = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() };
      const container = { querySelectorAll: jest.fn(() => [btn1, btn2]) };
      Object.defineProperty(document, 'activeElement', { value: btn1, configurable: true });

      uiManager._trapFocus(event, container);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(btn2.focus).toHaveBeenCalled();
    });
  });

  describe('mute button', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    test('creates mute button during init', () => {
      expect(uiManager.muteButton).toBeTruthy();
    });

    test('toggles audio on _handleMuteToggle', () => {
      uiManager._handleMuteToggle();

      expect(mockGame.audioManager.toggleMute).toHaveBeenCalled();
    });

    test('handles missing audioManager', () => {
      mockGame.audioManager = null;

      expect(() => uiManager._handleMuteToggle()).not.toThrow();
    });
  });
});
