import { InputController } from '../controls/InputController';
import { EventTypes } from '../events/EventTypes';

// Mock Three.js classes
jest.mock('three', () => ({
  Vector2: jest.fn(() => ({
    x: 0,
    y: 0,
    set: jest.fn(function (x, y) {
      this.x = x;
      this.y = y;
    }),
    length: jest.fn(() => 0.5)
  })),
  Vector3: jest.fn(() => ({
    x: 0,
    y: 0,
    z: 0,
    set: jest.fn(),
    copy: jest.fn(),
    clone: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
    add: jest.fn(),
    subVectors: jest.fn(),
    normalize: jest.fn(),
    multiplyScalar: jest.fn(),
    distanceTo: jest.fn(() => 0),
    lengthSquared: jest.fn(() => 0)
  })),
  Raycaster: jest.fn(() => ({
    setFromCamera: jest.fn(),
    intersectObjects: jest.fn(() => []),
    intersectObject: jest.fn(() => []),
    ray: {
      intersectPlane: jest.fn(() => ({ x: 0, y: 0, z: 0 }))
    }
  })),
  Plane: jest.fn(() => ({})),
  BufferGeometry: jest.fn(() => ({
    setFromPoints: jest.fn(),
    setAttribute: jest.fn(),
    dispose: jest.fn()
  })),
  LineBasicMaterial: jest.fn(() => ({
    dispose: jest.fn()
  })),
  Line: jest.fn(() => ({
    position: { y: 0 },
    visible: true,
    geometry: {
      attributes: {
        position: { needsUpdate: true }
      },
      dispose: jest.fn()
    },
    material: { dispose: jest.fn() }
  })),
  BufferAttribute: jest.fn(),
  Float32Array: jest.fn(),
  Color: jest.fn()
}));

describe('InputController', () => {
  let inputController;
  let mockGame;
  let mockRenderer;
  let mockCamera;

  beforeEach(() => {
    // Set up DOM environment
    if (!global.document) {
      global.document = {};
    }

    // Mock DOM elements
    global.document.getElementById = jest.fn().mockReturnValue({
      style: {
        display: 'none',
        setProperty: jest.fn()
      }
    });

    // Mock navigator for mobile detection
    if (!global.navigator) {
      global.navigator = {};
    }

    Object.defineProperty(global.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
    });

    Object.defineProperty(global.navigator, 'deviceMemory', {
      writable: true,
      value: 4
    });

    Object.defineProperty(global.navigator, 'vibrate', {
      writable: true,
      value: jest.fn()
    });

    // Mock canvas context
    const mockContext = {
      getParameter: jest.fn().mockReturnValue('Apple GPU'),
      canvas: { width: 512, height: 512 }
    };

    // Set up createElement mock
    global.document.createElement = jest.fn(tag => {
      if (tag === 'canvas') {
        return {
          getContext: jest.fn(() => mockContext),
          width: 512,
          height: 512
        };
      }
      return {};
    });

    // Mock window if not available
    if (!global.window) {
      global.window = {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 1,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };
    }

    mockRenderer = {
      domElement: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        getBoundingClientRect: jest.fn(() => ({
          left: 0,
          top: 0,
          right: 800,
          bottom: 600
        }))
      }
    };

    mockCamera = {
      getWorldDirection: jest.fn()
    };

    mockGame = {
      debugManager: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      eventManager: {
        publish: jest.fn(),
        subscribe: jest.fn(() => () => {}) // Return unsubscribe function
      },
      stateManager: {
        isBallInMotion: jest.fn(() => false),
        isHoleCompleted: jest.fn(() => false),
        getGameState: jest.fn(() => 'AIMING'),
        setGameState: jest.fn()
      },
      ballManager: {
        ball: {
          mesh: {
            position: {
              x: 0,
              y: 0,
              z: 0,
              clone: jest.fn(() => ({ x: 0, y: 0, z: 0 }))
            }
          },
          radius: 0.2,
          isStopped: jest.fn(() => true)
        },
        hitBall: jest.fn()
      },
      cameraController: {
        controls: {
          enabled: true
        },
        panCameraOnEdge: jest.fn(),
        adjustZoom: jest.fn(),
        optimizeForMobile: jest.fn(),
        setQualityLevel: jest.fn()
      },
      scene: {
        add: jest.fn(),
        remove: jest.fn()
      },
      renderer: mockRenderer,
      camera: mockCamera,
      physicsManager: {
        setUpdateRate: jest.fn()
      }
    };

    inputController = new InputController(mockGame);
  });

  afterEach(() => {
    if (inputController && typeof inputController.cleanup === 'function') {
      inputController.cleanup();
    }
  });

  test('should initialize with correct mobile detection', () => {
    expect(inputController.isMobileDevice).toBe(true);
    expect(inputController.supportsHaptics).toBe(true);
    expect(inputController.isHighPerformanceDevice).toBe(true);
  });

  test('should detect device performance correctly', () => {
    // Test high-performance detection
    expect(inputController.deviceCapabilities.detectPerformance()).toBe(true);

    // Test low-performance device
    Object.defineProperty(global.navigator, 'deviceMemory', {
      writable: true,
      value: 2
    });

    const lowPerfController = new InputController(mockGame);
    expect(lowPerfController.isHighPerformanceDevice).toBe(false);
  });

  test('should trigger haptic feedback', () => {
    inputController.triggerHapticFeedback('medium');
    expect(global.navigator.vibrate).toHaveBeenCalledWith(25);

    inputController.triggerHapticFeedback('heavy');
    expect(global.navigator.vibrate).toHaveBeenCalledWith(50);
  });


  test('should handle touch start events', () => {
    const mockTouchEvent = {
      preventDefault: jest.fn(),
      touches: [
        {
          clientX: 100,
          clientY: 100
        }
      ]
    };

    inputController.onTouchStart(mockTouchEvent);

    expect(mockTouchEvent.preventDefault).toHaveBeenCalled();
    expect(inputController.lastTouchPosition.x).toBe(100);
    expect(inputController.lastTouchPosition.y).toBe(100);
  });

  test('should handle multi-touch events', () => {
    const mockMultiTouchEvent = {
      preventDefault: jest.fn(),
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 }
      ]
    };

    inputController.onTouchStart(mockMultiTouchEvent);

    expect(inputController.isMultiTouch).toBe(true);
    expect(inputController.pinchDistance).toBeGreaterThan(0);
  });

  test('should enable and disable input correctly', () => {
    inputController.disableInput();
    expect(inputController.isInputEnabled).toBe(false);

    inputController.enableInput();
    expect(inputController.isInputEnabled).toBe(true);
  });


  test('should handle ball state events', () => {
    // Test ball stopped event
    inputController.handleBallStopped();
    expect(inputController.isInputEnabled).toBe(true);

    // Test ball in hole event
    inputController.handleBallInHole();
    expect(inputController.isInputEnabled).toBe(false);

    // Test hole started event
    inputController.handleHoleStarted();
    expect(inputController.isInputEnabled).toBe(true);
  });

  test('should update hit power value', () => {
    inputController.hitPower = 0.75;

    expect(inputController.hitPower).toBe(0.75);
    expect(inputController.hitPower).toBeGreaterThan(0);
    expect(inputController.hitPower).toBeLessThanOrEqual(1);
  });

  test('should cleanup event listeners', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    inputController.cleanup();

    expect(removeSpy).toHaveBeenCalled();
    removeSpy.mockRestore();
  });

  test('should have mouse coordinate tracking', () => {
    expect(inputController.pointer).toBeDefined();
    expect(inputController.pointer.x).toBeDefined();
    expect(inputController.pointer.y).toBeDefined();
  });

  test('should track input enabled state', () => {
    // Test initial state
    expect(inputController.isInputEnabled).toBe(true);

    // Test disabling input
    inputController.disableInput();
    expect(inputController.isInputEnabled).toBe(false);

    // Test enabling input
    inputController.enableInput();
    expect(inputController.isInputEnabled).toBe(true);
  });

  test('should handle renderer and camera references', () => {
    expect(inputController.renderer).toBeDefined();
    expect(inputController.camera).toBeDefined();
    expect(inputController.game).toBeDefined();
  });

  test('should have ball state event handlers', () => {
    // Test ball stopped event
    inputController.handleBallStopped();
    expect(inputController.isInputEnabled).toBe(true);

    // Test ball in hole event
    inputController.handleBallInHole();
    expect(inputController.isInputEnabled).toBe(false);

    // Test hole started event
    inputController.handleHoleStarted();
    expect(inputController.isInputEnabled).toBe(true);
  });

  test('should track touch velocity', () => {
    expect(inputController.touchVelocity).toBeDefined();
    expect(inputController.touchVelocity.x).toBeDefined();
    expect(inputController.touchVelocity.y).toBeDefined();
    expect(inputController.touchStartTime).toBeDefined();
  });

  test('should track hit power and direction', () => {
    inputController.hitPower = 0.5;
    expect(inputController.hitPower).toBe(0.5);

    expect(inputController.hitDirection).toBeDefined();
    expect(inputController.hitDirection.x).toBeDefined();
    expect(inputController.hitDirection.y).toBeDefined();
    expect(inputController.hitDirection.z).toBeDefined();
  });

  test('should handle disabled input gracefully', () => {
    inputController.isInputEnabled = false;

    const mockEvent = {
      clientX: 100,
      clientY: 100,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn()
    };

    expect(() => {
      inputController.onMouseDown(mockEvent);
      inputController.onMouseMove(mockEvent);
      inputController.onMouseUp(mockEvent);
    }).not.toThrow();
  });

  test('should handle mobile device detection', () => {
    expect(inputController.isMobileDevice).toBeDefined();
    expect(typeof inputController.isMobileDevice).toBe('boolean');

    expect(inputController.supportsHaptics).toBeDefined();
    expect(typeof inputController.supportsHaptics).toBe('boolean');
  });
});
