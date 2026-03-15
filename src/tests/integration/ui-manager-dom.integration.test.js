/**
 * Integration tests for UIManager DOM interactions
 * Tests actual DOM manipulation and element relationships
 */

import { UIManager } from '../../managers/UIManager';
import { EventTypes } from '../../events/EventTypes';

// Mock dependencies that are not part of DOM testing
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

describe('UIManager DOM Integration Tests', () => {
  let mockGame;
  let uiManager;

  beforeEach(() => {
    // Clear DOM completely
    document.body.innerHTML = '';

    // Create mock game with minimal DOM-unrelated dependencies
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
    document.body.innerHTML = '';
    // Clear tracked elements in document mock
    if (global.document._elements) {
      global.document._elements = {};
    }
  });

  describe('DOM Container Creation', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
    });

    test('should create new UI container when none exists', () => {
      uiManager.createMainContainer();

      // Verify container was created and added to DOM
      expect(uiManager.uiContainer).toBeTruthy();
      expect(uiManager.uiContainer.id).toBe('ui-container');
      expect(uiManager.uiContainer.tagName?.toLowerCase()).toBe('div');

      // Verify it's actually in the DOM
      const containerInDOM = document.getElementById('ui-container');
      expect(containerInDOM?.id).toBe(uiManager.uiContainer.id);
      expect(document.body.contains(uiManager.uiContainer)).toBe(true);

      // Verify CSS class was added
      expect(uiManager.uiContainer.classList.contains('ui-container')).toBe(true);
    });

    test('should use existing ui-container if available', () => {
      // Create existing container
      const existingContainer = document.createElement('div');
      existingContainer.id = 'ui-container';
      existingContainer.innerHTML = '<span>existing content</span>';
      document.body.appendChild(existingContainer);

      uiManager.createMainContainer();

      // Should use existing container (compare by ID since object identity may differ)
      expect(uiManager.uiContainer.id).toBe(existingContainer.id);
      expect(uiManager.uiContainer.id).toBe('ui-container');

      // Should clear existing contents
      expect(uiManager.uiContainer.children.length).toBe(0);
      expect(uiManager.uiContainer.innerHTML).toBe('');
    });

    test('should use existing ui-overlay as fallback', () => {
      // Create ui-overlay instead of ui-container
      const existingOverlay = document.createElement('div');
      existingOverlay.id = 'ui-overlay';
      document.body.appendChild(existingOverlay);

      uiManager.createMainContainer();

      // Should use the overlay (compare by ID since object identity may differ)
      expect(uiManager.uiContainer.id).toBe(existingOverlay.id);
      expect(uiManager.uiContainer.id).toBe('ui-overlay');
      expect(document.body.contains(uiManager.uiContainer)).toBe(true);
    });
  });

  describe('DOM Message UI Creation', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.createMainContainer();
    });

    test('should create message element and append to container', () => {
      uiManager.createMessageUI();

      // Verify message element was created
      expect(uiManager.messageElement).toBeTruthy();
      expect(uiManager.messageElement.id).toBe('message-container');
      expect(uiManager.messageElement.tagName?.toLowerCase()).toBe('div');

      // Verify CSS class was added
      expect(uiManager.messageElement.classList.contains('message-container')).toBe(true);

      // Verify it's appended to the UI container
      expect(uiManager.uiContainer.contains(uiManager.messageElement)).toBe(true);
      expect(uiManager.messageElement.parentNode?.id).toBe(uiManager.uiContainer.id);
    });
  });

  describe('DOM Power Indicator Creation', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
      uiManager.createMainContainer();
    });

    test('should create power indicator with fill element', () => {
      uiManager.createPowerIndicatorUI();

      // Verify power indicator was created
      expect(uiManager.powerIndicator).toBeTruthy();
      expect(uiManager.powerIndicator.tagName?.toLowerCase()).toBe('div');

      // Verify CSS class was added
      expect(uiManager.powerIndicator.classList.contains('power-indicator')).toBe(true);

      // Verify it's appended to the UI container
      expect(uiManager.uiContainer.contains(uiManager.powerIndicator)).toBe(true);
      expect(uiManager.powerIndicator.parentNode?.id).toBe(uiManager.uiContainer.id);

      // Verify fill element was created inside
      const fillElement = uiManager.powerIndicator.querySelector('.power-indicator-fill');
      expect(fillElement).toBeTruthy();
      expect(fillElement.tagName?.toLowerCase()).toBe('div');
      expect(fillElement.classList.contains('power-indicator-fill')).toBe(true);
      expect(uiManager.powerIndicator.contains(fillElement)).toBe(true);
    });
  });

  describe('DOM Renderer Attachment', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
    });

    test('should attach renderer to existing game container', () => {
      // Create existing game container in DOM
      const gameContainer = document.createElement('div');
      gameContainer.id = 'game-container';
      document.body.appendChild(gameContainer);

      const mockCanvas = document.createElement('canvas');
      const mockRenderer = {
        domElement: mockCanvas
      };

      uiManager.attachRenderer(mockRenderer);

      expect(uiManager.renderer).toBe(mockRenderer);

      // Verify DOM attachment through actual DOM methods
      const retrievedContainer = document.getElementById('game-container');
      expect(retrievedContainer).toBe(gameContainer);
      expect(Array.from(gameContainer.children)).toContain(mockCanvas);
    });

    test('should create game container when none exists', () => {
      const mockCanvas = document.createElement('canvas');
      const mockRenderer = {
        domElement: mockCanvas
      };

      uiManager.attachRenderer(mockRenderer);

      // Verify game container was created
      const gameContainer = document.getElementById('game-container');
      expect(gameContainer).toBeTruthy();
      expect(gameContainer.tagName.toLowerCase()).toBe('div');

      // Verify renderer was attached
      expect(Array.from(gameContainer.children)).toContain(mockCanvas);
      expect(mockCanvas.parentNode).toBe(gameContainer);

      // Verify container styling
      expect(gameContainer.style.position).toBe('absolute');
      expect(gameContainer.style.top).toBe('0');
      expect(gameContainer.style.left).toBe('0');
      expect(gameContainer.style.width).toBe('100%');
      expect(gameContainer.style.height).toBe('100%');
    });

    test('should move renderer from existing parent', () => {
      const oldParent = document.createElement('div');
      document.body.appendChild(oldParent);

      const mockCanvas = document.createElement('canvas');
      const mockRenderer = {
        domElement: mockCanvas
      };

      // Initially attach to old parent
      oldParent.appendChild(mockCanvas);
      expect(Array.from(oldParent.children)).toContain(mockCanvas);

      uiManager.attachRenderer(mockRenderer);

      // Should be moved to new game container
      expect(Array.from(oldParent.children)).not.toContain(mockCanvas);

      const gameContainer = document.getElementById('game-container');
      expect(Array.from(gameContainer.children)).toContain(mockCanvas);
      expect(mockCanvas.parentNode).toBe(gameContainer);
    });

    test('should handle invalid renderer gracefully', () => {
      uiManager.attachRenderer(null);
      expect(mockGame.debugManager.warn).toHaveBeenCalledWith(
        'UIManager.attachRenderer',
        'Invalid renderer or domElement'
      );

      uiManager.attachRenderer({});
      expect(mockGame.debugManager.warn).toHaveBeenCalledWith(
        'UIManager.attachRenderer',
        'Invalid renderer or domElement'
      );
    });
  });

  describe('DOM Integration Scenarios', () => {
    beforeEach(() => {
      uiManager = new UIManager(mockGame);
    });

    test('should handle complete UI initialization with DOM elements', () => {
      // Initialize complete UI
      uiManager.init();

      // Verify all DOM elements are created and properly structured
      expect(uiManager.uiContainer).toBeTruthy();
      expect(Array.from(document.body.children)).toContain(uiManager.uiContainer);

      expect(uiManager.messageElement).toBeTruthy();
      expect(Array.from(uiManager.uiContainer.children)).toContain(uiManager.messageElement);

      expect(uiManager.powerIndicator).toBeTruthy();
      expect(Array.from(uiManager.uiContainer.children)).toContain(uiManager.powerIndicator);

      // Verify proper hierarchy
      expect(uiManager.messageElement.parentNode).toBe(uiManager.uiContainer);
      expect(uiManager.powerIndicator.parentNode).toBe(uiManager.uiContainer);
    });

    test('should cleanup DOM elements properly', () => {
      uiManager.init();

      // Verify elements exist
      expect(document.getElementById('ui-container')).toBeTruthy();
      const messageElement = uiManager.messageElement;
      const powerIndicator = uiManager.powerIndicator;

      uiManager.cleanup();

      // Verify elements are cleaned up
      expect(uiManager.uiContainer).toBeNull();
      expect(uiManager.messageElement).toBeNull();
      expect(uiManager.powerIndicator).toBeNull();
    });

    test('should handle renderer attachment after UI initialization', () => {
      uiManager.init();

      const mockCanvas = document.createElement('canvas');
      const mockRenderer = {
        domElement: mockCanvas
      };

      uiManager.attachRenderer(mockRenderer);

      // Verify both UI container and game container exist independently
      expect(document.getElementById('ui-container')).toBeTruthy();
      expect(document.getElementById('game-container')).toBeTruthy();

      // Verify renderer is in game container, not UI container
      const gameContainer = document.getElementById('game-container');
      expect(Array.from(gameContainer.children)).toContain(mockCanvas);
      expect(Array.from(uiManager.uiContainer.children)).not.toContain(mockCanvas);
    });
  });
});
