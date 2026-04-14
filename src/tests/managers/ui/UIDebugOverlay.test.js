/**
 * Unit tests for UIDebugOverlay
 */

import { UIDebugOverlay } from '../../../managers/ui/UIDebugOverlay';
import { debug } from '../../../utils/debug';

// Mock debug utility
jest.mock('../../../utils/debug', () => ({
  debug: {
    log: jest.fn()
  }
}));

describe('UIDebugOverlay', () => {
  let uiDebugOverlay;
  let mockGame;
  let mockParentContainer;
  let originalCreateElement;

  beforeEach(() => {
    // Mock game object
    mockGame = {
      debugManager: {
        enabled: false
      }
    };

    // Restore real document.createElement so DOM operations work correctly
    originalCreateElement = document.createElement.getMockImplementation
      ? document.createElement
      : null;
    if (originalCreateElement) {
      document.createElement = Document.prototype.createElement.bind(document);
    }

    // Use real DOM elements so appendChild/createTextNode work correctly
    mockParentContainer = document.createElement('div');

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore the mock if it was in place
    if (originalCreateElement) {
      document.createElement = originalCreateElement;
    }
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with game and parent container', () => {
      uiDebugOverlay = new UIDebugOverlay(mockGame, mockParentContainer);

      expect(uiDebugOverlay.game).toBe(mockGame);
      expect(uiDebugOverlay.parentContainer).toBe(mockParentContainer);
      expect(uiDebugOverlay.debugElement).toBe(null);
      expect(uiDebugOverlay.DEBUG_OVERLAY_CLASS).toBe('debug-overlay');
    });
  });

  describe('init', () => {
    beforeEach(() => {
      uiDebugOverlay = new UIDebugOverlay(mockGame, mockParentContainer);
    });

    test('should create debug element if it does not exist', () => {
      uiDebugOverlay.init();

      const debugEl = uiDebugOverlay.debugElement;
      expect(debugEl).not.toBeNull();
      expect(debugEl.classList.contains('debug-overlay')).toBe(true);
      expect(mockParentContainer.contains(debugEl)).toBe(true);
      expect(debugEl.style.display).toBe('none');
      expect(debug.log).toHaveBeenCalledWith('[UIDebugOverlay] Initialized.');
    });

    test('should use existing debug element if found', () => {
      // Pre-add an element with the debug-overlay class
      const existingElement = document.createElement('div');
      existingElement.classList.add('debug-overlay');
      existingElement.style.display = 'block';
      mockParentContainer.appendChild(existingElement);

      uiDebugOverlay.init();

      expect(uiDebugOverlay.debugElement).toBe(existingElement);
      expect(existingElement.style.display).toBe('none');
      // Should not have added a second child
      expect(mockParentContainer.querySelectorAll('.debug-overlay').length).toBe(1);
    });
  });

  describe('updateDebugDisplay', () => {
    beforeEach(() => {
      uiDebugOverlay = new UIDebugOverlay(mockGame, mockParentContainer);
      uiDebugOverlay.init();
    });

    test('should return early if debug element does not exist', () => {
      const debugEl = uiDebugOverlay.debugElement;
      uiDebugOverlay.debugElement = null;

      uiDebugOverlay.updateDebugDisplay({ fps: 60 });

      // debugElement was null, nothing should have changed
      expect(debugEl.innerHTML).toBe('');
    });

    test('should hide overlay when debug manager is disabled', () => {
      mockGame.debugManager.enabled = false;
      uiDebugOverlay.debugElement.style.display = 'block';

      uiDebugOverlay.updateDebugDisplay({ fps: 60 });

      expect(uiDebugOverlay.debugElement.style.display).toBe('none');
      expect(debug.log).toHaveBeenCalledWith('[UIDebugOverlay] Hiding debug overlay.');
    });

    test('should not log when already hidden and debug is disabled', () => {
      mockGame.debugManager.enabled = false;
      uiDebugOverlay.debugElement.style.display = 'none';

      uiDebugOverlay.updateDebugDisplay({ fps: 60 });

      expect(uiDebugOverlay.debugElement.style.display).toBe('none');
      expect(debug.log).not.toHaveBeenCalledWith('[UIDebugOverlay] Hiding debug overlay.');
    });

    test('should show overlay when debug manager is enabled', () => {
      mockGame.debugManager.enabled = true;
      uiDebugOverlay.debugElement.style.display = 'none';

      uiDebugOverlay.updateDebugDisplay({ fps: 60 });

      expect(uiDebugOverlay.debugElement.style.display).toBe('block');
      expect(debug.log).toHaveBeenCalledWith('[UIDebugOverlay] Showing debug overlay.');
    });

    test('should format and display debug info with numbers', () => {
      mockGame.debugManager.enabled = true;

      const debugInfo = {
        fps: 60.123456,
        strokeCount: 3,
        timeElapsed: 45.6789
      };

      uiDebugOverlay.updateDebugDisplay(debugInfo);

      const html = uiDebugOverlay.debugElement.innerHTML;
      expect(html).toContain('fps:');
      expect(html).toContain('60.12');
      expect(html).toContain('strokeCount:');
      expect(html).toContain('3.00');
      expect(html).toContain('timeElapsed:');
      expect(html).toContain('45.68');
    });

    test('should format and display debug info with Vector3-like objects', () => {
      mockGame.debugManager.enabled = true;

      const debugInfo = {
        ballPosition: { x: 1.234, y: 2.567, z: 3.891 },
        velocity: { x: -0.123, y: 0, z: 0.456 }
      };

      uiDebugOverlay.updateDebugDisplay(debugInfo);

      const html = uiDebugOverlay.debugElement.innerHTML;
      expect(html).toContain('ballPosition:');
      expect(html).toContain('(1.23, 2.57, 3.89)');
      expect(html).toContain('velocity:');
      expect(html).toContain('(-0.12, 0.00, 0.46)');
    });

    test('should format and display debug info with other objects', () => {
      mockGame.debugManager.enabled = true;

      const debugInfo = {
        gameState: { state: 'playing', level: 3 },
        flags: { isActive: true, isPaused: false }
      };

      uiDebugOverlay.updateDebugDisplay(debugInfo);

      const html = uiDebugOverlay.debugElement.innerHTML;
      expect(html).toContain('gameState:');
      expect(html).toContain('{"state":"playing","level":3}');
      expect(html).toContain('flags:');
      expect(html).toContain('{"isActive":true,"isPaused":false}');
    });

    test('should handle null values in debug info', () => {
      mockGame.debugManager.enabled = true;

      const debugInfo = {
        nullValue: null,
        undefinedValue: undefined,
        stringValue: 'test'
      };

      uiDebugOverlay.updateDebugDisplay(debugInfo);

      const html = uiDebugOverlay.debugElement.innerHTML;
      expect(html).toContain('nullValue:');
      expect(html).toContain('null');
      expect(html).toContain('undefinedValue:');
      expect(html).toContain('undefined');
      expect(html).toContain('stringValue:');
      expect(html).toContain('test');
    });

    test('should handle missing debugManager', () => {
      mockGame.debugManager = null;
      uiDebugOverlay.debugElement.style.display = 'block';

      uiDebugOverlay.updateDebugDisplay({ fps: 60 });

      expect(uiDebugOverlay.debugElement.style.display).toBe('none');
    });

    test('should handle debugManager without enabled property', () => {
      mockGame.debugManager = {};
      uiDebugOverlay.debugElement.style.display = 'block';

      uiDebugOverlay.updateDebugDisplay({ fps: 60 });

      expect(uiDebugOverlay.debugElement.style.display).toBe('none');
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      uiDebugOverlay = new UIDebugOverlay(mockGame, mockParentContainer);
      uiDebugOverlay.init();
    });

    test('should remove debug element and reset reference', () => {
      const debugEl = uiDebugOverlay.debugElement;
      jest.spyOn(debugEl, 'remove');

      uiDebugOverlay.cleanup();

      expect(debugEl.remove).toHaveBeenCalled();
      expect(uiDebugOverlay.debugElement).toBe(null);
      expect(debug.log).toHaveBeenCalledWith('[UIDebugOverlay] Cleaned up.');
    });

    test('should handle cleanup when debug element is already null', () => {
      uiDebugOverlay.debugElement = null;

      uiDebugOverlay.cleanup();

      expect(debug.log).toHaveBeenCalledWith('[UIDebugOverlay] Cleaned up.');
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      uiDebugOverlay = new UIDebugOverlay(mockGame, mockParentContainer);
    });

    test('should handle complete lifecycle', () => {
      // Initialize
      uiDebugOverlay.init();
      expect(uiDebugOverlay.debugElement).toBeDefined();

      const debugEl = uiDebugOverlay.debugElement;

      // Update while disabled - should stay hidden
      uiDebugOverlay.updateDebugDisplay({ fps: 30 });
      expect(debugEl.style.display).toBe('none');

      // Enable debug mode
      mockGame.debugManager.enabled = true;

      // Update with various data
      uiDebugOverlay.updateDebugDisplay({
        fps: 60,
        position: { x: 10, y: 5, z: 15 },
        score: 42
      });
      expect(debugEl.style.display).toBe('block');
      expect(debugEl.innerHTML).toContain('60.00');
      expect(debugEl.innerHTML).toContain('(10.00, 5.00, 15.00)');
      expect(debugEl.innerHTML).toContain('42.00');

      // Disable debug mode
      mockGame.debugManager.enabled = false;
      uiDebugOverlay.updateDebugDisplay({ fps: 45 });
      expect(debugEl.style.display).toBe('none');

      // Cleanup
      uiDebugOverlay.cleanup();
      expect(uiDebugOverlay.debugElement).toBe(null);
    });

    test('should handle rapid enable/disable toggles', () => {
      uiDebugOverlay.init();

      const debugEl = uiDebugOverlay.debugElement;

      // Toggle debug mode rapidly
      for (let i = 0; i < 5; i++) {
        mockGame.debugManager.enabled = true;
        uiDebugOverlay.updateDebugDisplay({ iteration: i });
        expect(debugEl.style.display).toBe('block');

        mockGame.debugManager.enabled = false;
        uiDebugOverlay.updateDebugDisplay({ iteration: i });
        expect(debugEl.style.display).toBe('none');
      }

      // Verify debug log was called appropriate number of times
      const showLogs = debug.log.mock.calls.filter(call =>
        call[0].includes('Showing debug overlay')
      );
      const hideLogs = debug.log.mock.calls.filter(call =>
        call[0].includes('Hiding debug overlay')
      );

      expect(showLogs.length).toBe(5);
      expect(hideLogs.length).toBe(5);
    });
  });
});
