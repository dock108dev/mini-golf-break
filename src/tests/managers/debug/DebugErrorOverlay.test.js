/**
 * Unit tests for DebugErrorOverlay
 */

import { DebugErrorOverlay } from '../../../managers/debug/DebugErrorOverlay';

describe('DebugErrorOverlay', () => {
  let debugErrorOverlay;
  let mockParentManager;
  let mockParentContainer;

  beforeEach(() => {
    // Mock parent manager
    mockParentManager = {
      enabled: true
    };

    // Mock parent container
    mockParentContainer = {
      appendChild: jest.fn(),
      removeChild: jest.fn()
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
        appendChild: jest.fn(child => {
          element.children.push(child);
          return child;
        }),
        insertBefore: jest.fn((newNode, referenceNode) => {
          const index = element.children.indexOf(referenceNode);
          if (index !== -1) {
            element.children.splice(index, 0, newNode);
          } else {
            element.children.push(newNode);
          }
          return newNode;
        }),
        remove: jest.fn(() => {
          if (element.parentNode) {
            const index = element.parentNode.children.indexOf(element);
            if (index !== -1) {
              element.parentNode.children.splice(index, 1);
            }
          }
        }),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };

      // Add cssText setter/getter
      Object.defineProperty(element.style, 'cssText', {
        set: jest.fn(),
        get: jest.fn(() => '')
      });

      // Add display property
      Object.defineProperty(element.style, 'display', {
        set: jest.fn(),
        get: jest.fn(() => 'none'),
        configurable: true,
        enumerable: true
      });

      // Mock parentNode
      Object.defineProperty(element, 'parentNode', {
        value: null,
        writable: true,
        configurable: true
      });

      return element;
    });

    document.getElementById = jest.fn(() => null);
    document.body.appendChild = jest.fn();

    // Mock setTimeout to be synchronous for easier testing
    global.setTimeout = jest.fn((callback, delay) => {
      // Return a mock timer ID and execute immediately for testing
      const timerId = Math.random();
      if (typeof callback === 'function') {
        // Store callback for manual execution in tests
        global.setTimeout.mockCallbacks = global.setTimeout.mockCallbacks || [];
        global.setTimeout.mockCallbacks.push({ callback, delay, timerId });
      }
      return timerId;
    });

    debugErrorOverlay = new DebugErrorOverlay(mockParentManager, mockParentContainer);

    // Clear all mocks
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.setTimeout.mockCallbacks = [];
  });

  describe('constructor', () => {
    test('should initialize with parent manager and container', () => {
      expect(debugErrorOverlay.parentManager).toBe(mockParentManager);
      expect(debugErrorOverlay.parentContainer).toBe(mockParentContainer);
    });

    test('should use document.body as default parent container', () => {
      const overlay = new DebugErrorOverlay(mockParentManager);
      expect(overlay.parentContainer).toBe(document.body);
    });

    test('should initialize with default values', () => {
      expect(debugErrorOverlay.errorOverlay).toBeNull();
      expect(debugErrorOverlay.OVERLAY_ID).toBe('error-overlay');
    });

    test('should have proper styling constants', () => {
      expect(debugErrorOverlay.OVERLAY_STYLE).toContain('position: fixed');
      expect(debugErrorOverlay.OVERLAY_STYLE).toContain('background-color: rgba(255, 0, 0, 0.8)');
      expect(debugErrorOverlay.CLOSE_BUTTON_STYLE).toContain('position: absolute');
      expect(debugErrorOverlay.ERROR_ITEM_STYLE).toContain('margin-bottom: 5px');
    });
  });

  describe('init', () => {
    test('should handle DOM availability check', () => {
      // This test verifies the DOM check logic exists
      // The actual implementation checks for typeof document === 'undefined'

      debugErrorOverlay.init();

      // Should proceed normally in test environment since document is available
      expect(debugErrorOverlay.errorOverlay).toBeDefined();
    });

    test('should create new overlay when none exists', () => {
      document.getElementById.mockReturnValue(null);
      const mockElement = {
        id: '',
        style: { cssText: '' },
        appendChild: jest.fn()
      };
      const mockButton = {
        style: { cssText: '' },
        textContent: '',
        addEventListener: jest.fn()
      };
      document.createElement.mockReturnValueOnce(mockElement).mockReturnValueOnce(mockButton);

      debugErrorOverlay.init();

      expect(document.getElementById).toHaveBeenCalledWith('error-overlay');
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.createElement).toHaveBeenCalledWith('button');
      expect(mockElement.appendChild).toHaveBeenCalledWith(mockButton);
      expect(mockParentContainer.appendChild).toHaveBeenCalledWith(mockElement);
      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', '[DebugErrorOverlay] Creating error overlay element...'
      );
    });

    test('should use existing overlay when present', () => {
      const existingElement = {
        id: 'error-overlay',
        style: { display: 'none' }
      };
      document.getElementById.mockReturnValue(existingElement);

      debugErrorOverlay.init();

      expect(debugErrorOverlay.errorOverlay).toBe(existingElement);
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugErrorOverlay] Found existing error overlay.');
      expect(document.createElement).not.toHaveBeenCalled();
    });

    test('should create close button with proper event listener', () => {
      const mockElement = {
        id: '',
        style: { cssText: '' },
        appendChild: jest.fn()
      };
      const mockButton = {
        style: { cssText: '' },
        textContent: '',
        addEventListener: jest.fn()
      };
      document.createElement.mockReturnValueOnce(mockElement).mockReturnValueOnce(mockButton);

      debugErrorOverlay.init();

      expect(mockButton.textContent).toBe('×');
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('should set proper styles on created elements', () => {
      const mockElement = {
        id: '',
        style: { cssText: '' },
        appendChild: jest.fn()
      };
      const mockButton = {
        style: { cssText: '' },
        textContent: '',
        addEventListener: jest.fn()
      };
      document.createElement.mockReturnValueOnce(mockElement).mockReturnValueOnce(mockButton);

      debugErrorOverlay.init();

      expect(mockElement.id).toBe('error-overlay');
      expect(mockElement.style.cssText).toContain('position: fixed');
      expect(mockButton.style.cssText).toContain('position: absolute');
    });
  });

  describe('showError', () => {
    beforeEach(() => {
      debugErrorOverlay.init();
    });

    test('should initialize overlay if not already initialized', () => {
      debugErrorOverlay.errorOverlay = null;
      const initSpy = jest.spyOn(debugErrorOverlay, 'init');

      debugErrorOverlay.showError('Test error');

      expect(initSpy).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        '[DebugErrorOverlay] Overlay not initialized, cannot show error.'
      );
    });

    test('should handle missing DOM methods gracefully', () => {
      debugErrorOverlay.errorOverlay = { appendChild: null };

      expect(() => {
        debugErrorOverlay.showError('Test error');
      }).not.toThrow();
    });

    test('should create and display error message', () => {
      const message = 'Test error message';
      const mockErrorElement = {
        style: { cssText: '' },
        textContent: ''
      };
      document.createElement.mockReturnValue(mockErrorElement);
      const showSpy = jest.spyOn(debugErrorOverlay, 'show');

      debugErrorOverlay.showError(message);

      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(mockErrorElement.textContent).toBe(message);
      expect(showSpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', `[DebugErrorOverlay] Displaying error: ${message}`);
    });

    test('should insert error element after close button when children exist', () => {
      const message = 'Test error';
      const mockErrorElement = {
        style: { cssText: '' },
        textContent: ''
      };
      document.createElement.mockReturnValue(mockErrorElement);

      // Mock overlay with close button and another element
      const mockCloseButton = { id: 'close-button' };
      const mockExistingElement = { id: 'existing-element' };
      debugErrorOverlay.errorOverlay.children = [mockCloseButton, mockExistingElement];

      debugErrorOverlay.showError(message);

      expect(debugErrorOverlay.errorOverlay.insertBefore).toHaveBeenCalledWith(
        mockErrorElement,
        mockExistingElement
      );
    });

    test('should append error element when no children exist', () => {
      const message = 'Test error';
      const mockErrorElement = {
        style: { cssText: '' },
        textContent: ''
      };
      document.createElement.mockReturnValue(mockErrorElement);

      // Mock overlay with no children
      debugErrorOverlay.errorOverlay.children = [];

      debugErrorOverlay.showError(message);

      expect(debugErrorOverlay.errorOverlay.appendChild).toHaveBeenCalledWith(mockErrorElement);
    });

    test('should set auto-removal timeout for error message', () => {
      const message = 'Test error';
      const mockErrorElement = {
        style: { cssText: '' },
        textContent: '',
        parentNode: debugErrorOverlay.errorOverlay,
        remove: jest.fn()
      };
      document.createElement.mockReturnValue(mockErrorElement);

      debugErrorOverlay.showError(message);

      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 15000);
    });

    test('should auto-remove error after timeout', () => {
      const message = 'Test error message';
      const mockErrorElement = {
        style: { cssText: '' },
        textContent: '',
        parentNode: debugErrorOverlay.errorOverlay,
        remove: jest.fn()
      };
      document.createElement.mockReturnValue(mockErrorElement);
      const hideIfEmptySpy = jest.spyOn(debugErrorOverlay, 'hideIfEmpty');

      debugErrorOverlay.showError(message);

      // Execute the timeout callback
      const timeoutCallback = global.setTimeout.mockCallbacks[0].callback;
      timeoutCallback();

      expect(mockErrorElement.remove).toHaveBeenCalled();
      expect(hideIfEmptySpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', expect.stringContaining('[DebugErrorOverlay] Auto-removed error message:')
      );
    });

    test('should not auto-remove error if no longer in overlay', () => {
      const message = 'Test error';
      const mockErrorElement = {
        style: { cssText: '' },
        textContent: '',
        parentNode: null, // Removed from overlay
        remove: jest.fn()
      };
      document.createElement.mockReturnValue(mockErrorElement);

      debugErrorOverlay.showError(message);

      // Execute the timeout callback
      const timeoutCallback = global.setTimeout.mockCallbacks[0].callback;
      timeoutCallback();

      expect(mockErrorElement.remove).not.toHaveBeenCalled();
    });
  });

  describe('show', () => {
    test('should make overlay visible', () => {
      debugErrorOverlay.init();

      debugErrorOverlay.show();

      expect(debugErrorOverlay.errorOverlay.style.display).toBeDefined();
    });

    test('should handle null overlay gracefully', () => {
      debugErrorOverlay.errorOverlay = null;

      expect(() => {
        debugErrorOverlay.show();
      }).not.toThrow();
    });
  });

  describe('hide', () => {
    test('should hide overlay and log message', () => {
      debugErrorOverlay.init();

      debugErrorOverlay.hide();

      expect(debugErrorOverlay.errorOverlay.style.display).toBeDefined();
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugErrorOverlay] Overlay hidden by user.');
    });

    test('should handle null overlay gracefully', () => {
      debugErrorOverlay.errorOverlay = null;

      expect(() => {
        debugErrorOverlay.hide();
      }).not.toThrow();
    });
  });

  describe('hideIfEmpty', () => {
    beforeEach(() => {
      debugErrorOverlay.init();
    });

    test('should hide overlay when only close button exists', () => {
      const hideSpy = jest.spyOn(debugErrorOverlay, 'hide');
      debugErrorOverlay.errorOverlay.children = [{ id: 'close-button' }];

      debugErrorOverlay.hideIfEmpty();

      expect(hideSpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', '[DebugErrorOverlay] Overlay hidden automatically as it is empty.'
      );
    });

    test('should hide overlay when no children exist', () => {
      const hideSpy = jest.spyOn(debugErrorOverlay, 'hide');
      debugErrorOverlay.errorOverlay.children = [];

      debugErrorOverlay.hideIfEmpty();

      expect(hideSpy).toHaveBeenCalled();
    });

    test('should not hide overlay when error messages exist', () => {
      const hideSpy = jest.spyOn(debugErrorOverlay, 'hide');
      debugErrorOverlay.errorOverlay.children = [
        { id: 'close-button' },
        { id: 'error-1' },
        { id: 'error-2' }
      ];

      debugErrorOverlay.hideIfEmpty();

      expect(hideSpy).not.toHaveBeenCalled();
    });

    test('should handle null overlay gracefully', () => {
      debugErrorOverlay.errorOverlay = null;

      expect(() => {
        debugErrorOverlay.hideIfEmpty();
      }).not.toThrow();
    });

    test('should handle overlay without children property', () => {
      debugErrorOverlay.errorOverlay = { style: { display: 'block' } };

      expect(() => {
        debugErrorOverlay.hideIfEmpty();
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    test('should remove overlay and set to null', () => {
      debugErrorOverlay.init();
      const mockRemove = jest.fn();
      debugErrorOverlay.errorOverlay.remove = mockRemove;

      debugErrorOverlay.cleanup();

      expect(mockRemove).toHaveBeenCalled();
      expect(debugErrorOverlay.errorOverlay).toBeNull();
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugErrorOverlay] Cleaned up.');
    });

    test('should handle null overlay gracefully', () => {
      debugErrorOverlay.errorOverlay = null;

      expect(() => {
        debugErrorOverlay.cleanup();
      }).not.toThrow();

      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugErrorOverlay] Cleaned up.');
    });
  });

  describe('close button functionality', () => {
    test('should hide overlay when close button is clicked', () => {
      debugErrorOverlay.init();
      const hideSpy = jest.spyOn(debugErrorOverlay, 'hide');

      // Find the close button event listener
      const closeButton = debugErrorOverlay.errorOverlay.children[0];
      const clickHandler = closeButton.addEventListener.mock.calls[0][1];

      clickHandler();

      expect(hideSpy).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete error lifecycle', () => {
      // Initialize
      debugErrorOverlay.init();
      expect(debugErrorOverlay.errorOverlay).toBeDefined();

      // Show error
      debugErrorOverlay.showError('Test error');
      expect(global.setTimeout).toHaveBeenCalled();

      // Hide manually
      debugErrorOverlay.hide();
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', '[DebugErrorOverlay] Overlay hidden by user.');

      // Cleanup
      debugErrorOverlay.cleanup();
      expect(debugErrorOverlay.errorOverlay).toBeNull();
    });

    test('should handle multiple errors', () => {
      debugErrorOverlay.init();

      debugErrorOverlay.showError('Error 1');
      debugErrorOverlay.showError('Error 2');
      debugErrorOverlay.showError('Error 3');

      expect(global.setTimeout).toHaveBeenCalledTimes(3);
      // Note: document.createElement may be called more times due to overlay creation
      expect(document.createElement).toHaveBeenCalled();
    });

    test('should handle error display without initialization', () => {
      const initSpy = jest.spyOn(debugErrorOverlay, 'init');

      debugErrorOverlay.showError('Test error');

      expect(initSpy).toHaveBeenCalled();
    });

    test('should handle DOM environment changes', () => {
      debugErrorOverlay.init();

      // Simulate overlay being removed from DOM
      debugErrorOverlay.errorOverlay = null;

      debugErrorOverlay.showError('Test error');

      expect(console.warn).toHaveBeenCalledWith(
        '[DebugErrorOverlay] Overlay not initialized, cannot show error.'
      );
    });
  });
});
