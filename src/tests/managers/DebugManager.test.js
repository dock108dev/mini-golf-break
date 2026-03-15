/**
 * Unit tests for DebugManager
 */

import { DebugManager, DEBUG_CONFIG, ERROR_LEVELS } from '../../managers/DebugManager';
import * as THREE from 'three';

// Mock THREE.js constructors
jest.mock('three', () => ({
  ...jest.requireActual('three'),
  AxesHelper: jest.fn(() => ({ type: 'AxesHelper' })),
  GridHelper: jest.fn(() => ({ type: 'GridHelper' })),
  DirectionalLightHelper: jest.fn(() => ({ type: 'DirectionalLightHelper' })),
  CameraHelper: jest.fn(() => ({ type: 'CameraHelper' }))
}));

// Mock dependencies
jest.mock('../../managers/debug/DebugErrorOverlay', () => ({
  DebugErrorOverlay: jest.fn(() => ({
    init: jest.fn(),
    cleanup: jest.fn(),
    showError: jest.fn()
  }))
}));

jest.mock('../../managers/debug/DebugCourseUI', () => ({
  DebugCourseUI: jest.fn(() => ({
    init: jest.fn(),
    cleanup: jest.fn(),
    updateDisplay: jest.fn()
  }))
}));

describe('DebugManager', () => {
  let debugManager;
  let mockGame;

  beforeEach(() => {
    // Mock game object with all necessary properties
    mockGame = {
      scene: {
        add: jest.fn(),
        remove: jest.fn()
      },
      cameraController: {
        setDebugMode: jest.fn(),
        setupInitialCameraPosition: jest.fn()
      },
      cannonDebugRenderer: {
        clearMeshes: jest.fn()
      },
      uiManager: {
        updateDebugDisplay: jest.fn(),
        updateHoleInfo: jest.fn(),
        updateScore: jest.fn(),
        updateStrokes: jest.fn()
      },
      ballManager: {
        ball: {
          body: {
            velocity: { length: jest.fn(() => 5.5) }
          },
          mesh: {
            position: { x: 1, y: 2, z: 3 }
          }
        },
        resetBall: jest.fn()
      },
      lights: {
        directionalLight: {
          updateWorldMatrix: jest.fn(),
          matrixWorld: { elements: new Array(16).fill(0) },
          matrix: { elements: new Array(16).fill(0) },
          matrixAutoUpdate: true,
          visible: true,
          type: 'DirectionalLight',
          isObject3D: true,
          isDirectionalLight: true,
          position: { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          quaternion: { x: 0, y: 0, z: 0, w: 1 },
          parent: null,
          children: [],
          up: { x: 0, y: 1, z: 0 },
          target: { position: { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() } },
          color: { r: 1, g: 1, b: 1 },
          intensity: 1,
          shadow: {
            camera: {
              position: { copy: jest.fn() },
              lookAt: jest.fn(),
              updateProjectionMatrix: jest.fn(),
              updateMatrixWorld: jest.fn()
            }
          }
        }
      },
      deltaTime: 0.016, // ~60 FPS
      course: {
        clearCurrentHole: jest.fn(),
        createCourse: jest.fn().mockResolvedValue(true),
        startPosition: { x: 0, y: 0, z: 0 },
        constructor: { name: 'NineHoleCourse' }
      }
    };

    debugManager = new DebugManager(mockGame);

    // Clear all mocks
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Mock DOM methods - ensure window is properly set up
    Object.defineProperty(global, 'window', {
      value: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      },
      writable: true,
      configurable: true
    });

    global.alert = jest.fn();
    global.prompt = jest.fn();

    // Reset DEBUG_CONFIG to defaults for each test
    DEBUG_CONFIG.enabled = false;
    DEBUG_CONFIG.showHelpers = true;
    DEBUG_CONFIG.showLightHelpers = true;
    DEBUG_CONFIG.logVelocity = true;
    DEBUG_CONFIG.logCriticalErrors = true;
    DEBUG_CONFIG.courseDebug.enabled = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with game reference and default state', () => {
      expect(debugManager.game).toBe(mockGame);
      expect(debugManager.enabled).toBe(DEBUG_CONFIG.enabled);
      expect(debugManager.debugObjects).toEqual([]);
      expect(debugManager.velocityHistory).toEqual([]);
      expect(debugManager.errorHistory).toBeInstanceOf(Map);
      expect(debugManager.errorsByLevel).toEqual({
        ERROR: 0,
        WARNING: 0,
        INFO: 0,
        DEBUG: 0
      });
    });

    test('should initialize course debug state', () => {
      expect(debugManager.courseDebugState).toEqual({
        active: false,
        courseType: 'NineHoleCourse',
        currentHole: 1,
        previousCourseType: null,
        courseOverrideActive: false
      });
    });

    test('should bind key handler', () => {
      expect(debugManager.boundHandleMainKey).toBeDefined();
      expect(typeof debugManager.boundHandleMainKey).toBe('function');
    });
  });

  describe('init', () => {
    test('should initialize all components', () => {
      const result = debugManager.init();

      expect(debugManager.errorOverlay).toBeDefined();
      expect(debugManager.courseDebugUI).toBeDefined();
      expect(result).toBe(debugManager); // Returns self for chaining
    });

    test('should set up debug helpers when enabled by default', () => {
      debugManager.enabled = true;
      const setupSpy = jest.spyOn(debugManager, 'setupDebugHelpers');

      debugManager.init();

      expect(setupSpy).toHaveBeenCalled();
    });

    test('should not initialize course debug UI when disabled', () => {
      DEBUG_CONFIG.courseDebug.enabled = false;

      debugManager.init();

      expect(debugManager.courseDebugUI).toBeNull();
    });
  });

  describe('addMainKeyListener / removeMainKeyListener', () => {
    test('should add event listener in non-production environment', () => {
      process.env.NODE_ENV = 'development';

      debugManager.addMainKeyListener();

      expect(window.addEventListener).toHaveBeenCalledWith(
        'keydown',
        debugManager.boundHandleMainKey
      );
    });

    test('should add event listener when debug is enabled in config', () => {
      process.env.NODE_ENV = 'production';
      DEBUG_CONFIG.enabled = true;

      debugManager.addMainKeyListener();

      expect(window.addEventListener).toHaveBeenCalledWith(
        'keydown',
        debugManager.boundHandleMainKey
      );
    });

    test('should remove event listener', () => {
      debugManager.removeMainKeyListener();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        debugManager.boundHandleMainKey
      );
    });
  });

  describe('handleMainDebugKey', () => {
    test('should toggle debug mode on correct key press', () => {
      const toggleSpy = jest.spyOn(debugManager, 'toggleDebugMode');
      const event = { key: DEBUG_CONFIG.enableKey };

      debugManager.handleMainDebugKey(event);

      expect(toggleSpy).toHaveBeenCalled();
    });

    test('should not toggle debug mode on incorrect key press', () => {
      const toggleSpy = jest.spyOn(debugManager, 'toggleDebugMode');
      const event = { key: 'x' };

      debugManager.handleMainDebugKey(event);

      expect(toggleSpy).not.toHaveBeenCalled();
    });
  });

  describe('toggleDebugMode', () => {
    test('should toggle enabled state from false to true', () => {
      debugManager.enabled = false;
      const setupSpy = jest.spyOn(debugManager, 'setupDebugHelpers');

      const result = debugManager.toggleDebugMode();

      expect(debugManager.enabled).toBe(true);
      expect(setupSpy).toHaveBeenCalled();
      expect(result).toBe(debugManager);
    });

    test('should toggle enabled state from true to false', () => {
      debugManager.enabled = true;
      const removeSpy = jest.spyOn(debugManager, 'removeDebugHelpers');

      debugManager.toggleDebugMode();

      expect(debugManager.enabled).toBe(false);
      expect(removeSpy).toHaveBeenCalled();
      expect(mockGame.cannonDebugRenderer.clearMeshes).toHaveBeenCalled();
    });

    test('should update camera controller debug mode', () => {
      debugManager.toggleDebugMode();

      expect(mockGame.cameraController.setDebugMode).toHaveBeenCalledWith(debugManager.enabled);
    });

    test('should update UI components', () => {
      debugManager.init(); // Initialize UI components

      debugManager.toggleDebugMode();

      expect(mockGame.uiManager.updateDebugDisplay).toHaveBeenCalled();
    });
  });

  describe('setupDebugHelpers', () => {
    test('should create and add debug helpers when enabled', () => {
      DEBUG_CONFIG.showHelpers = true;
      DEBUG_CONFIG.showLightHelpers = false; // Disable light helpers for this test

      debugManager.setupDebugHelpers();

      expect(THREE.AxesHelper).toHaveBeenCalledWith(5);
      expect(THREE.GridHelper).toHaveBeenCalledWith(40, 40);
      expect(mockGame.scene.add).toHaveBeenCalledTimes(2);
      expect(debugManager.debugObjects).toHaveLength(2);
    });

    test('should create light helpers when enabled', () => {
      DEBUG_CONFIG.showHelpers = true;
      DEBUG_CONFIG.showLightHelpers = true;

      debugManager.setupDebugHelpers();

      expect(THREE.DirectionalLightHelper).toHaveBeenCalled();
      expect(THREE.CameraHelper).toHaveBeenCalled();
      expect(mockGame.scene.add).toHaveBeenCalledTimes(4); // axes, grid, light, shadow
    });

    test('should not create helpers when disabled in config', () => {
      DEBUG_CONFIG.showHelpers = false;
      const axesHelperSpy = jest.spyOn(THREE, 'AxesHelper');
      const gridHelperSpy = jest.spyOn(THREE, 'GridHelper');

      debugManager.setupDebugHelpers();

      expect(axesHelperSpy).not.toHaveBeenCalled();
      expect(gridHelperSpy).not.toHaveBeenCalled();
      expect(mockGame.scene.add).not.toHaveBeenCalled();

      axesHelperSpy.mockRestore();
      gridHelperSpy.mockRestore();
    });

    test('should handle missing scene gracefully', () => {
      mockGame.scene = null;

      expect(() => {
        debugManager.setupDebugHelpers();
      }).not.toThrow();
    });

    test('should remove existing helpers before adding new ones', () => {
      const removeSpy = jest.spyOn(debugManager, 'removeDebugHelpers');

      debugManager.setupDebugHelpers();

      expect(removeSpy).toHaveBeenCalled();
    });
  });

  describe('removeDebugHelpers', () => {
    beforeEach(() => {
      // Set up some debug objects
      const mockObject1 = { parent: mockGame.scene };
      const mockObject2 = { parent: mockGame.scene };
      debugManager.debugObjects = [mockObject1, mockObject2];
    });

    test('should remove all debug objects from scene', () => {
      debugManager.removeDebugHelpers();

      expect(mockGame.scene.remove).toHaveBeenCalledTimes(2);
      expect(debugManager.debugObjects).toEqual([]);
    });

    test('should handle objects without parent gracefully', () => {
      debugManager.debugObjects = [{ parent: null }, null];

      expect(() => {
        debugManager.removeDebugHelpers();
      }).not.toThrow();
    });

    test('should handle missing scene gracefully', () => {
      mockGame.scene = null;

      debugManager.removeDebugHelpers();

      expect(console.warn).toHaveBeenCalledWith(
        '[DebugManager] Cannot remove helpers, game or scene missing.'
      );
    });
  });

  describe('logBallVelocity', () => {
    const mockVelocity = { length: jest.fn(() => 7.5) };

    test('should log velocity when enabled', () => {
      debugManager.enabled = true;
      DEBUG_CONFIG.logVelocity = true;

      debugManager.logBallVelocity(mockVelocity);

      expect(mockVelocity.length).toHaveBeenCalled();
      expect(debugManager.velocityHistory).toContain(7.5);
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', 'Ball speed: 7.50 m/s');
    });

    test('should not log velocity when disabled', () => {
      debugManager.enabled = false;

      debugManager.logBallVelocity(mockVelocity);

      expect(mockVelocity.length).not.toHaveBeenCalled();
      expect(debugManager.velocityHistory).toEqual([]);
    });

    test('should limit velocity history length', () => {
      debugManager.enabled = true;
      debugManager.maxHistoryLength = 3;

      // Add more velocities than the max
      for (let i = 0; i < 5; i++) {
        debugManager.logBallVelocity({ length: () => i });
      }

      expect(debugManager.velocityHistory).toHaveLength(3);
      expect(debugManager.velocityHistory).toEqual([2, 3, 4]);
    });
  });

  describe('logWithLevel', () => {
    test('should log error with correct formatting', () => {
      debugManager.logWithLevel(ERROR_LEVELS.ERROR, 'TestSource', 'Test message');

      expect(console.error).toHaveBeenCalledWith('[ERROR] TestSource: Test message', '');
    });

    test('should log warning with data', () => {
      const testData = { detail: 'test' };
      debugManager.logWithLevel(ERROR_LEVELS.WARNING, 'TestSource', 'Test warning', testData);

      expect(console.warn).toHaveBeenCalledWith('[WARNING] TestSource: Test warning', testData);
    });

    test('should track error statistics', () => {
      debugManager.logWithLevel(ERROR_LEVELS.ERROR, 'TestSource', 'Error 1');
      debugManager.logWithLevel(ERROR_LEVELS.ERROR, 'TestSource', 'Error 2');
      debugManager.logWithLevel(ERROR_LEVELS.WARNING, 'TestSource', 'Warning 1');

      expect(debugManager.errorsByLevel[ERROR_LEVELS.ERROR]).toBe(2);
      expect(debugManager.errorsByLevel[ERROR_LEVELS.WARNING]).toBe(1);
    });

    test('should show critical errors in UI when requested', () => {
      debugManager.init(); // Initialize error overlay

      debugManager.logWithLevel(ERROR_LEVELS.ERROR, 'TestSource', 'Critical error', null, true);

      expect(debugManager.errorOverlay.showError).toHaveBeenCalledWith(
        '[ERROR] TestSource: Critical error'
      );
    });

    test('should suppress repeated errors when configured', () => {
      DEBUG_CONFIG.errorTracking.suppressRepeated = true;
      DEBUG_CONFIG.errorTracking.maxRepeats = 2;

      const message = 'Repeated error';

      // Log the same error multiple times
      for (let i = 0; i < 5; i++) {
        debugManager.logWithLevel(ERROR_LEVELS.ERROR, 'TestSource', message);
      }

      // Should only log 2 times (initial + maxRepeats-1 because maxRepeats=2 means 2 total logs max)
      expect(console.error).toHaveBeenCalledTimes(2);
    });
  });

  describe('trackError', () => {
    test('should increment error count by level', () => {
      debugManager.trackError(ERROR_LEVELS.ERROR, 'Test error');
      debugManager.trackError(ERROR_LEVELS.WARNING, 'Test warning');
      debugManager.trackError(ERROR_LEVELS.ERROR, 'Another error');

      expect(debugManager.errorsByLevel[ERROR_LEVELS.ERROR]).toBe(2);
      expect(debugManager.errorsByLevel[ERROR_LEVELS.WARNING]).toBe(1);
    });

    test('should track unique error message frequency', () => {
      debugManager.trackError(ERROR_LEVELS.ERROR, 'Error A');
      debugManager.trackError(ERROR_LEVELS.ERROR, 'Error A');
      debugManager.trackError(ERROR_LEVELS.ERROR, 'Error B');

      expect(debugManager.errorHistory.get('Error A')).toBe(2);
      expect(debugManager.errorHistory.get('Error B')).toBe(1);
    });

    test('should limit error history size', () => {
      DEBUG_CONFIG.errorTracking.maxErrors = 2;

      debugManager.trackError(ERROR_LEVELS.ERROR, 'Error 1');
      debugManager.trackError(ERROR_LEVELS.ERROR, 'Error 2');
      debugManager.trackError(ERROR_LEVELS.ERROR, 'Error 3');

      expect(debugManager.errorHistory.size).toBe(2);
      expect(debugManager.errorHistory.has('Error 1')).toBe(false); // Should be removed
    });
  });

  describe('shouldSuppressError', () => {
    test('should not suppress when suppression is disabled', () => {
      DEBUG_CONFIG.errorTracking.suppressRepeated = false;
      debugManager.errorHistory.set('Test error', 10);

      expect(debugManager.shouldSuppressError('Test error')).toBe(false);
    });

    test('should suppress when error count exceeds max repeats', () => {
      DEBUG_CONFIG.errorTracking.suppressRepeated = true;
      DEBUG_CONFIG.errorTracking.maxRepeats = 3;
      debugManager.errorHistory.set('Test error', 5);

      expect(debugManager.shouldSuppressError('Test error')).toBe(true);
    });

    test('should not suppress when error count is within limit', () => {
      DEBUG_CONFIG.errorTracking.suppressRepeated = true;
      DEBUG_CONFIG.errorTracking.maxRepeats = 3;
      debugManager.errorHistory.set('Test error', 2);

      expect(debugManager.shouldSuppressError('Test error')).toBe(false);
    });
  });

  describe('getErrorStats', () => {
    test('should return correct error statistics', () => {
      debugManager.errorsByLevel[ERROR_LEVELS.ERROR] = 5;
      debugManager.errorsByLevel[ERROR_LEVELS.WARNING] = 3;
      debugManager.errorHistory.set('Error 1', 1);
      debugManager.errorHistory.set('Error 2', 1);

      const stats = debugManager.getErrorStats();

      expect(stats).toEqual({
        totalErrors: 5,
        totalWarnings: 3,
        uniqueErrors: 2
      });
    });
  });

  describe('getDebugInfo', () => {
    test('should return empty object when debug is disabled', () => {
      debugManager.enabled = false;

      const info = debugManager.getDebugInfo();

      expect(info).toEqual({});
    });

    test('should return basic debug info when enabled', () => {
      debugManager.enabled = true;

      const info = debugManager.getDebugInfo();

      expect(info).toEqual({
        FPS: 63, // Math.round(1 / 0.016)
        'Debug Mode': 'ON',
        'Ball Position': 'X: 1.00, Y: 2.00, Z: 3.00',
        'Ball Velocity': '5.50 m/s'
      });
    });

    test('should include error statistics when errors exist', () => {
      debugManager.enabled = true;
      debugManager.errorsByLevel[ERROR_LEVELS.ERROR] = 2;
      debugManager.errorsByLevel[ERROR_LEVELS.WARNING] = 1;

      const info = debugManager.getDebugInfo();

      expect(info.Errors).toBe(2);
      expect(info.Warnings).toBe(1);
    });

    test('should include ball information when available', () => {
      debugManager.enabled = true;

      const info = debugManager.getDebugInfo();

      expect(info['Ball Position']).toBe('X: 1.00, Y: 2.00, Z: 3.00');
      expect(info['Ball Velocity']).toBe('5.50 m/s');
    });

    test('should handle missing ball manager gracefully', () => {
      debugManager.enabled = true;
      mockGame.ballManager = null;

      const info = debugManager.getDebugInfo();

      expect(info['Ball Position']).toBeUndefined();
      expect(info['Ball Velocity']).toBeUndefined();
    });
  });

  describe('convenience logging methods', () => {
    test('error method should call logWithLevel with ERROR level', () => {
      const logSpy = jest.spyOn(debugManager, 'logWithLevel');

      debugManager.error('TestSource', 'Test error', { data: 'test' }, true);

      expect(logSpy).toHaveBeenCalledWith(
        ERROR_LEVELS.ERROR,
        'TestSource',
        'Test error',
        { data: 'test' },
        true
      );
    });

    test('warn method should call logWithLevel with WARNING level', () => {
      const logSpy = jest.spyOn(debugManager, 'logWithLevel');

      debugManager.warn('TestSource', 'Test warning', { data: 'test' });

      expect(logSpy).toHaveBeenCalledWith(ERROR_LEVELS.WARNING, 'TestSource', 'Test warning', {
        data: 'test'
      });
    });

    test('info method should call logWithLevel with INFO level', () => {
      const logSpy = jest.spyOn(debugManager, 'logWithLevel');

      debugManager.info('TestSource', 'Test info', { data: 'test' });

      expect(logSpy).toHaveBeenCalledWith(ERROR_LEVELS.INFO, 'TestSource', 'Test info', {
        data: 'test'
      });
    });

    test('log method should call logWithLevel with DEBUG level', () => {
      const logSpy = jest.spyOn(debugManager, 'logWithLevel');

      debugManager.log('Test debug message', { data: 'test' });

      expect(logSpy).toHaveBeenCalledWith(ERROR_LEVELS.DEBUG, 'Log', 'Test debug message', {
        data: 'test'
      });
    });
  });

  describe('course debugging features', () => {
    describe('toggleCourseType', () => {
      test('should toggle from NineHoleCourse to BasicCourse', () => {
        debugManager.courseDebugState.courseType = 'NineHoleCourse';
        const loadSpy = jest.spyOn(debugManager, 'loadCourseWithType').mockImplementation();

        debugManager.toggleCourseType();

        expect(debugManager.courseDebugState.courseType).toBe('BasicCourse');
        expect(loadSpy).toHaveBeenCalledWith('BasicCourse');
      });

      test('should toggle from BasicCourse to NineHoleCourse', () => {
        debugManager.courseDebugState.courseType = 'BasicCourse';
        const loadSpy = jest.spyOn(debugManager, 'loadCourseWithType').mockImplementation();

        debugManager.toggleCourseType();

        expect(debugManager.courseDebugState.courseType).toBe('NineHoleCourse');
        expect(loadSpy).toHaveBeenCalledWith('NineHoleCourse');
      });
    });

    describe('promptForHoleNumber', () => {
      test('should prompt for valid hole number and load it', () => {
        debugManager.courseDebugState.courseType = 'BasicCourse';
        global.prompt.mockReturnValue('2');
        const loadSpy = jest.spyOn(debugManager, 'loadSpecificHole').mockImplementation();

        debugManager.promptForHoleNumber();

        expect(global.prompt).toHaveBeenCalledWith('Enter hole number to load (1-3):', 1);
        expect(loadSpy).toHaveBeenCalledWith(2);
      });

      test('should handle invalid hole number', () => {
        debugManager.courseDebugState.courseType = 'BasicCourse';
        global.prompt.mockReturnValue('10'); // Invalid for BasicCourse
        const loadSpy = jest.spyOn(debugManager, 'loadSpecificHole');

        debugManager.promptForHoleNumber();

        expect(global.alert).toHaveBeenCalledWith(
          'Please enter a valid hole number between 1 and 3.'
        );
        expect(loadSpy).not.toHaveBeenCalled();
      });

      test('should handle user cancellation', () => {
        global.prompt.mockReturnValue(null);
        const loadSpy = jest.spyOn(debugManager, 'loadSpecificHole');

        debugManager.promptForHoleNumber();

        expect(loadSpy).not.toHaveBeenCalled();
      });

      test('should handle different max holes for NineHoleCourse', () => {
        debugManager.courseDebugState.courseType = 'NineHoleCourse';
        global.prompt.mockReturnValue('5');

        debugManager.promptForHoleNumber();

        expect(global.prompt).toHaveBeenCalledWith('Enter hole number to load (1-9):', 1);
      });
    });

    describe('loadSpecificHole', () => {
      test('should update course debug state', () => {
        const loadInExistingSpy = jest
          .spyOn(debugManager, 'loadHoleInExistingCourse')
          .mockResolvedValue(true);

        debugManager.loadSpecificHole(3);

        expect(debugManager.courseDebugState.currentHole).toBe(3);
        expect(debugManager.courseDebugState.courseOverrideActive).toBe(true);
        expect(loadInExistingSpy).toHaveBeenCalledWith(3);
      });

      test('should load new course when course type changed', () => {
        mockGame.course.constructor.name = 'BasicCourse';
        debugManager.courseDebugState.courseType = 'NineHoleCourse';
        const loadCourseTypeSpy = jest
          .spyOn(debugManager, 'loadCourseWithType')
          .mockImplementation();

        debugManager.loadSpecificHole(2);

        expect(loadCourseTypeSpy).toHaveBeenCalledWith('NineHoleCourse', 2);
      });

      test('should load new course when no course exists', () => {
        mockGame.course = null;
        const loadCourseTypeSpy = jest
          .spyOn(debugManager, 'loadCourseWithType')
          .mockImplementation();

        debugManager.loadSpecificHole(1);

        expect(loadCourseTypeSpy).toHaveBeenCalledWith('NineHoleCourse', 1);
      });
    });
  });

  describe('cleanup', () => {
    test('should cleanup all resources', () => {
      debugManager.init(); // Initialize components
      const removeSpy = jest.spyOn(debugManager, 'removeDebugHelpers');
      const errorOverlay = debugManager.errorOverlay;
      const courseDebugUI = debugManager.courseDebugUI;

      debugManager.cleanup();

      expect(debugManager.removeMainKeyListener).toBeDefined();
      expect(errorOverlay.cleanup).toHaveBeenCalled();
      expect(courseDebugUI.cleanup).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      expect(debugManager.game).toBeNull();
      expect(debugManager.debugObjects).toEqual([]);
      expect(debugManager.velocityHistory).toEqual([]);
      expect(debugManager.errorHistory.size).toBe(0);
    });

    test('should handle missing components gracefully', () => {
      debugManager.errorOverlay = null;
      debugManager.courseDebugUI = null;

      expect(() => {
        debugManager.cleanup();
      }).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete debug session lifecycle', () => {
      // Initialize
      debugManager.init();
      expect(debugManager.errorOverlay).toBeDefined();

      // Toggle debug mode
      debugManager.toggleDebugMode();
      expect(debugManager.enabled).toBe(true);

      // Log some messages
      debugManager.error('Test', 'Test error');
      debugManager.warn('Test', 'Test warning');

      // Get debug info
      const info = debugManager.getDebugInfo();
      expect(info['Debug Mode']).toBe('ON');
      expect(info.Errors).toBe(1);
      expect(info.Warnings).toBe(1);

      // Cleanup
      debugManager.cleanup();
      expect(debugManager.game).toBeNull();
    });

    test('should handle error suppression correctly', () => {
      DEBUG_CONFIG.errorTracking.suppressRepeated = true;
      DEBUG_CONFIG.errorTracking.maxRepeats = 1;

      // Log the same error multiple times
      debugManager.error('Test', 'Repeated error');
      debugManager.error('Test', 'Repeated error');
      debugManager.error('Test', 'Repeated error');

      expect(console.error).toHaveBeenCalledTimes(1); // Initial only, then suppressed
    });

    test('should properly manage debug objects lifecycle', () => {
      // Setup helpers
      debugManager.setupDebugHelpers();
      expect(debugManager.debugObjects.length).toBeGreaterThan(0);

      // Remove helpers
      debugManager.removeDebugHelpers();
      expect(debugManager.debugObjects).toEqual([]);

      // Setup again
      debugManager.setupDebugHelpers();
      expect(debugManager.debugObjects.length).toBeGreaterThan(0);
    });
  });
});
