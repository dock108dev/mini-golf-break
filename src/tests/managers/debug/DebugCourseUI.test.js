/**
 * Unit tests for DebugCourseUI
 */

import { DebugCourseUI } from '../../../managers/debug/DebugCourseUI';
import { DEBUG_CONFIG } from '../../../managers/DebugManager';

// Mock DEBUG_CONFIG
jest.mock('../../../managers/DebugManager', () => ({
  DEBUG_CONFIG: {
    courseDebug: {
      enabled: true,
      toggleCourseTypeKey: 'c',
      loadSpecificHoleKey: 'h',
      quickLoadKeys: {
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
        6: 6,
        7: 7,
        8: 8,
        9: 9
      }
    }
  }
}));

describe('DebugCourseUI', () => {
  let debugCourseUI;
  let mockDebugManager;
  let mockGame;

  beforeEach(() => {
    // Mock game
    mockGame = {
      scene: { add: jest.fn() }
    };

    // Mock debug manager
    mockDebugManager = {
      enabled: true,
      game: mockGame,
      courseDebugState: {
        courseType: 'NineHoleCourse',
        currentHole: 1
      },
      toggleCourseType: jest.fn(),
      promptForHoleNumber: jest.fn(),
      loadSpecificHole: jest.fn()
    };

    // Clear document body
    document.body.innerHTML = '';

    // Mock DOM methods
    document.createElement = jest.fn(tagName => {
      const element = {
        tagName: tagName.toUpperCase(),
        id: '',
        style: {},
        textContent: '',
        innerHTML: '',
        children: [],
        appendChild: jest.fn(),
        querySelector: jest.fn(),
        remove: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };

      // Add cssText setter/getter
      Object.defineProperty(element.style, 'cssText', {
        set: jest.fn(),
        get: jest.fn(() => '')
      });

      return element;
    });

    document.getElementById = jest.fn(() => null);
    document.body.appendChild = jest.fn();

    // Mock window event listeners
    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();

    debugCourseUI = new DebugCourseUI(mockDebugManager);

    // Clear all mocks
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with debug manager reference', () => {
      expect(debugCourseUI.debugManager).toBe(mockDebugManager);
      expect(debugCourseUI.game).toBe(mockGame);
    });

    test('should initialize with default values', () => {
      expect(debugCourseUI.courseDebugUI).toBeNull();
      expect(debugCourseUI.OVERLAY_ID).toBe('course-debug-overlay');
    });

    test('should have proper styling constants', () => {
      expect(debugCourseUI.STYLE).toContain('position: fixed');
      expect(debugCourseUI.STYLE).toContain('background-color: rgba(0, 0, 0, 0.7)');
      expect(debugCourseUI.HEADER_STYLE).toContain('font-weight: bold');
      expect(debugCourseUI.INFO_STYLE).toBe('margin-bottom: 5px;');
    });

    test('should bind event handler', () => {
      expect(debugCourseUI.boundHandleKeyPress).toBeDefined();
      expect(typeof debugCourseUI.boundHandleKeyPress).toBe('function');
    });
  });

  describe('init', () => {
    test('should create new overlay when none exists', () => {
      document.getElementById.mockReturnValue(null);
      const mockElement = {
        id: '',
        style: { cssText: '' },
        appendChild: jest.fn(),
        querySelector: jest.fn()
      };
      document.createElement.mockReturnValue(mockElement);

      debugCourseUI.init();

      expect(document.getElementById).toHaveBeenCalledWith('course-debug-overlay');
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(mockElement.appendChild).toHaveBeenCalledTimes(4); // header, type, hole, keyInfo
      expect(document.body.appendChild).toHaveBeenCalledWith(mockElement);
      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', '[DebugCourseUI] Creating course debug overlay element...'
      );
    });

    test('should use existing overlay when present', () => {
      const existingElement = {
        id: 'course-debug-overlay',
        style: { display: 'block' },
        appendChild: jest.fn(),
        querySelector: jest.fn()
      };
      document.getElementById.mockReturnValue(existingElement);
      const removeListenerSpy = jest.spyOn(debugCourseUI, 'removeInputListener');
      const addListenerSpy = jest.spyOn(debugCourseUI, 'addInputListener');
      const updateDisplaySpy = jest.spyOn(debugCourseUI, 'updateDisplay');

      debugCourseUI.init();

      expect(debugCourseUI.courseDebugUI).toBe(existingElement);
      expect(removeListenerSpy).toHaveBeenCalled();
      expect(addListenerSpy).toHaveBeenCalled();
      expect(updateDisplaySpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', '[DebugCourseUI] Found existing course debug overlay.'
      );
    });

    test('should add input listener during initialization', () => {
      const addListenerSpy = jest.spyOn(debugCourseUI, 'addInputListener');

      debugCourseUI.init();

      expect(addListenerSpy).toHaveBeenCalled();
    });

    test('should update display during initialization', () => {
      const updateDisplaySpy = jest.spyOn(debugCourseUI, 'updateDisplay');

      debugCourseUI.init();

      expect(updateDisplaySpy).toHaveBeenCalled();
    });

    test('should create proper UI structure', () => {
      const mockElement = {
        id: '',
        style: { cssText: '' },
        appendChild: jest.fn(),
        querySelector: jest.fn()
      };
      document.createElement.mockReturnValue(mockElement);

      debugCourseUI.init();

      // Verify all UI elements are created
      expect(document.createElement).toHaveBeenCalledWith('div'); // Main container
      expect(mockElement.appendChild).toHaveBeenCalledTimes(4); // header, courseType, hole, keyInfo
    });
  });

  describe('addInputListener', () => {
    test('should add keydown listener when course debug enabled', () => {
      DEBUG_CONFIG.courseDebug.enabled = true;

      debugCourseUI.addInputListener();

      expect(window.addEventListener).toHaveBeenCalledWith(
        'keydown',
        debugCourseUI.boundHandleKeyPress
      );
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugCourseUI] Added keydown listener.');
    });

    test('should not add listener when course debug disabled', () => {
      DEBUG_CONFIG.courseDebug.enabled = false;

      debugCourseUI.addInputListener();

      expect(window.addEventListener).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalledWith('[DEBUG]', '[DebugCourseUI] Added keydown listener.');
    });
  });

  describe('removeInputListener', () => {
    test('should remove keydown listener', () => {
      debugCourseUI.removeInputListener();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        debugCourseUI.boundHandleKeyPress
      );
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugCourseUI] Removed keydown listener.');
    });
  });

  describe('handleKeyPress', () => {
    beforeEach(() => {
      mockDebugManager.enabled = true;
    });

    test('should not process keys when debug manager disabled', () => {
      mockDebugManager.enabled = false;
      const event = { key: 'c', preventDefault: jest.fn() };

      debugCourseUI.handleKeyPress(event);

      expect(mockDebugManager.toggleCourseType).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should toggle course type on "c" key', () => {
      const event = { key: 'c', preventDefault: jest.fn() };

      debugCourseUI.handleKeyPress(event);

      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugCourseUI] Toggle Course Type key pressed.');
      expect(mockDebugManager.toggleCourseType).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    test('should prompt for hole number on "h" key', () => {
      const event = { key: 'h', preventDefault: jest.fn() };

      debugCourseUI.handleKeyPress(event);

      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugCourseUI] Load Specific Hole key pressed.');
      expect(mockDebugManager.promptForHoleNumber).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    test('should load specific hole on number keys 1-9', () => {
      const event = { key: '3', preventDefault: jest.fn() };

      debugCourseUI.handleKeyPress(event);

      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugCourseUI] Quick Load key pressed: 3');
      expect(mockDebugManager.loadSpecificHole).toHaveBeenCalledWith(3);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    test('should handle all number keys 1-9', () => {
      for (let i = 1; i <= 9; i++) {
        jest.clearAllMocks();
        const event = { key: i.toString(), preventDefault: jest.fn() };

        debugCourseUI.handleKeyPress(event);

        expect(mockDebugManager.loadSpecificHole).toHaveBeenCalledWith(i);
        expect(event.preventDefault).toHaveBeenCalled();
      }
    });

    test('should ignore unrecognized keys', () => {
      const event = { key: 'x', preventDefault: jest.fn() };

      debugCourseUI.handleKeyPress(event);

      expect(mockDebugManager.toggleCourseType).not.toHaveBeenCalled();
      expect(mockDebugManager.promptForHoleNumber).not.toHaveBeenCalled();
      expect(mockDebugManager.loadSpecificHole).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('updateDisplay', () => {
    beforeEach(() => {
      const mockCourseDebugUI = {
        style: { display: 'none' },
        querySelector: jest.fn()
      };
      debugCourseUI.courseDebugUI = mockCourseDebugUI;
    });

    test('should not update when courseDebugUI is null', () => {
      debugCourseUI.courseDebugUI = null;

      expect(() => {
        debugCourseUI.updateDisplay();
      }).not.toThrow();
    });

    test('should show UI when debug manager enabled', () => {
      mockDebugManager.enabled = true;
      const mockTypeElement = { textContent: '' };
      const mockHoleElement = { textContent: '' };

      debugCourseUI.courseDebugUI.querySelector
        .mockReturnValueOnce(mockTypeElement)
        .mockReturnValueOnce(mockHoleElement);

      debugCourseUI.updateDisplay();

      expect(debugCourseUI.courseDebugUI.style.display).toBe('block');
      expect(mockTypeElement.textContent).toBe('Course Type: NineHoleCourse');
      expect(mockHoleElement.textContent).toBe('Current Hole: 1');
    });

    test('should hide UI when debug manager disabled', () => {
      mockDebugManager.enabled = false;

      debugCourseUI.updateDisplay();

      expect(debugCourseUI.courseDebugUI.style.display).toBe('none');
    });

    test('should handle missing DOM elements gracefully', () => {
      mockDebugManager.enabled = true;
      debugCourseUI.courseDebugUI.querySelector.mockReturnValue(null);

      expect(() => {
        debugCourseUI.updateDisplay();
      }).not.toThrow();

      expect(debugCourseUI.courseDebugUI.style.display).toBe('block');
    });

    test('should update course type and hole information', () => {
      mockDebugManager.enabled = true;
      mockDebugManager.courseDebugState = {
        courseType: 'BasicCourse',
        currentHole: 5
      };

      const mockTypeElement = { textContent: '' };
      const mockHoleElement = { textContent: '' };

      debugCourseUI.courseDebugUI.querySelector
        .mockReturnValueOnce(mockTypeElement)
        .mockReturnValueOnce(mockHoleElement);

      debugCourseUI.updateDisplay();

      expect(mockTypeElement.textContent).toBe('Course Type: BasicCourse');
      expect(mockHoleElement.textContent).toBe('Current Hole: 5');
    });
  });

  describe('cleanup', () => {
    test('should remove input listener and UI element', () => {
      const mockElement = { remove: jest.fn() };
      debugCourseUI.courseDebugUI = mockElement;
      const removeListenerSpy = jest.spyOn(debugCourseUI, 'removeInputListener');

      debugCourseUI.cleanup();

      expect(removeListenerSpy).toHaveBeenCalled();
      expect(mockElement.remove).toHaveBeenCalled();
      expect(debugCourseUI.courseDebugUI).toBeNull();
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugCourseUI] Cleaned up.');
    });

    test('should handle null courseDebugUI gracefully', () => {
      debugCourseUI.courseDebugUI = null;
      const removeListenerSpy = jest.spyOn(debugCourseUI, 'removeInputListener');

      expect(() => {
        debugCourseUI.cleanup();
      }).not.toThrow();

      expect(removeListenerSpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugCourseUI] Cleaned up.');
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete lifecycle', () => {
      // Initialize
      debugCourseUI.init();
      expect(debugCourseUI.courseDebugUI).toBeDefined();

      // Update display
      debugCourseUI.updateDisplay();
      expect(debugCourseUI.courseDebugUI.style.display).toBe('block');

      // Handle key press
      const event = { key: 'c', preventDefault: jest.fn() };
      debugCourseUI.handleKeyPress(event);
      expect(mockDebugManager.toggleCourseType).toHaveBeenCalled();

      // Cleanup
      debugCourseUI.cleanup();
      expect(debugCourseUI.courseDebugUI).toBeNull();
    });

    test('should handle multiple initializations', () => {
      // First initialization
      debugCourseUI.init();
      const firstElement = debugCourseUI.courseDebugUI;

      // Mock existing element for second init
      document.getElementById.mockReturnValue(firstElement);

      // Second initialization should reuse existing element
      debugCourseUI.init();
      expect(debugCourseUI.courseDebugUI).toBe(firstElement);
    });

    test('should handle debug state changes', () => {
      debugCourseUI.init();

      // Initially enabled
      mockDebugManager.enabled = true;
      debugCourseUI.updateDisplay();
      expect(debugCourseUI.courseDebugUI.style.display).toBe('block');

      // Disable debug
      mockDebugManager.enabled = false;
      debugCourseUI.updateDisplay();
      expect(debugCourseUI.courseDebugUI.style.display).toBe('none');

      // Re-enable debug
      mockDebugManager.enabled = true;
      debugCourseUI.updateDisplay();
      expect(debugCourseUI.courseDebugUI.style.display).toBe('block');
    });
  });
});
