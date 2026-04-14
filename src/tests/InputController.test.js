import { InputController } from '../controls/InputController';

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
  Vector3: jest.fn(function (x = 0, y = 0, z = 0) {
    const v = {
      x,
      y,
      z,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
        return this;
      }),
      copy: jest.fn(function (other) {
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
        return this;
      }),
      clone: jest.fn(function () {
        return { x: this.x, y: this.y, z: this.z };
      }),
      add: jest.fn(function () {
        return this;
      }),
      subVectors: jest.fn(function () {
        return this;
      }),
      normalize: jest.fn(function () {
        return this;
      }),
      multiplyScalar: jest.fn(function () {
        return this;
      }),
      distanceTo: jest.fn(() => 0),
      lengthSquared: jest.fn(() => 0)
    };
    return v;
  }),
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

  // --- Keyboard aiming tests ---

  describe('keyboard controls', () => {
    beforeEach(() => {
      // Ensure input is enabled and ball is stopped
      inputController.isInputEnabled = true;
      inputController.isPointerDown = false;

      // Mock camera.getWorldDirection for keyboard aiming init
      mockCamera.getWorldDirection = jest.fn(target => {
        target.x = 0;
        target.y = 0;
        target.z = -1;
        return target;
      });

      // Mock requestAnimationFrame / cancelAnimationFrame
      jest.spyOn(global, 'requestAnimationFrame').mockImplementation(_cb => {
        return 42; // Return a fake ID
      });
      jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
    });

    afterEach(() => {
      global.requestAnimationFrame.mockRestore?.();
      global.cancelAnimationFrame.mockRestore?.();
    });

    test('should initialize keyboard aiming state', () => {
      expect(inputController.isKeyboardAiming).toBe(false);
      expect(inputController.isKeyboardCharging).toBe(false);
      expect(inputController.keyboardPower).toBe(0);
      expect(inputController.keyboardAimAngle).toBe(0);
      expect(inputController.keysPressed).toEqual({});
    });

    test('should start keyboard aiming on ArrowLeft', () => {
      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(true);
      expect(inputController.keysPressed['ArrowLeft']).toBe(true);
    });

    test('should start keyboard aiming on ArrowRight', () => {
      inputController.onKeyDown({ key: 'ArrowRight', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(true);
      expect(inputController.keysPressed['ArrowRight']).toBe(true);
    });

    test('should clear arrow key on keyup', () => {
      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });
      expect(inputController.keysPressed['ArrowLeft']).toBe(true);

      inputController.onKeyUp({ key: 'ArrowLeft', preventDefault: jest.fn() });
      expect(inputController.keysPressed['ArrowLeft']).toBeUndefined();
    });

    test('should start power charging on Space', () => {
      inputController.onKeyDown({ key: ' ', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(true);
      expect(inputController.isKeyboardCharging).toBe(true);
      expect(inputController.keyboardPower).toBe(0);
    });

    test('should start power charging on Enter', () => {
      inputController.onKeyDown({ key: 'Enter', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(true);
      expect(inputController.isKeyboardCharging).toBe(true);
    });

    test('should show power indicator when charging starts', () => {
      inputController.onKeyDown({ key: ' ', preventDefault: jest.fn() });

      expect(inputController.powerIndicator.style.display).toBe('block');
    });

    test('should not start keyboard aiming when input is disabled', () => {
      inputController.isInputEnabled = false;

      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(false);
    });

    test('should not start keyboard aiming when pointer is down (mouse active)', () => {
      inputController.isPointerDown = true;

      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(false);
    });

    test('should not start keyboard aiming when ball is in motion', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);

      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(false);
    });

    test('should fire shot on Space keyup when charging', () => {
      // Start charging
      inputController.onKeyDown({ key: ' ', preventDefault: jest.fn() });
      inputController.keyboardPower = 0.5; // Simulate charged power

      // Release to fire
      inputController.onKeyUp({ key: ' ', preventDefault: jest.fn() });

      expect(mockGame.ballManager.hitBall).toHaveBeenCalled();
      expect(inputController.isKeyboardAiming).toBe(false);
      expect(inputController.isKeyboardCharging).toBe(false);
    });

    test('should fire shot on Enter keyup when charging', () => {
      inputController.onKeyDown({ key: 'Enter', preventDefault: jest.fn() });
      inputController.keyboardPower = 0.7;

      inputController.onKeyUp({ key: 'Enter', preventDefault: jest.fn() });

      expect(mockGame.ballManager.hitBall).toHaveBeenCalled();
    });

    test('should cancel shot if power is too low on release', () => {
      inputController.onKeyDown({ key: ' ', preventDefault: jest.fn() });
      inputController.keyboardPower = 0.01; // Below 0.05 threshold

      inputController.onKeyUp({ key: ' ', preventDefault: jest.fn() });

      expect(mockGame.ballManager.hitBall).not.toHaveBeenCalled();
      expect(inputController.isKeyboardAiming).toBe(false);
    });

    test('should cancel aiming on Escape', () => {
      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });
      expect(inputController.isKeyboardAiming).toBe(true);

      inputController.onKeyUp({ key: 'Escape', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(false);
      expect(inputController.keyboardPower).toBe(0);
    });

    test('should update aim angle in updateKeyboardAiming', () => {
      inputController.startKeyboardAiming();
      const initialAngle = inputController.keyboardAimAngle;

      inputController.keysPressed['ArrowLeft'] = true;
      inputController.updateKeyboardAiming(0.1);

      expect(inputController.keyboardAimAngle).toBeGreaterThan(initialAngle);
    });

    test('should decrease aim angle for ArrowRight', () => {
      inputController.startKeyboardAiming();
      const initialAngle = inputController.keyboardAimAngle;

      inputController.keysPressed['ArrowRight'] = true;
      inputController.updateKeyboardAiming(0.1);

      expect(inputController.keyboardAimAngle).toBeLessThan(initialAngle);
    });

    test('should charge power during updateKeyboardAiming', () => {
      inputController.startKeyboardAiming();
      inputController.isKeyboardCharging = true;
      inputController.keyboardPower = 0;

      inputController.updateKeyboardAiming(0.5);

      expect(inputController.keyboardPower).toBeGreaterThan(0);
      expect(inputController.keyboardPower).toBeLessThanOrEqual(1.0);
    });

    test('should cap power at 1.0', () => {
      inputController.startKeyboardAiming();
      inputController.isKeyboardCharging = true;
      inputController.keyboardPower = 0.95;

      inputController.updateKeyboardAiming(10); // Large dt to exceed cap

      expect(inputController.keyboardPower).toBe(1.0);
    });

    test('should disable input after firing keyboard shot', () => {
      inputController.onKeyDown({ key: ' ', preventDefault: jest.fn() });
      inputController.keyboardPower = 0.5;

      inputController.onKeyUp({ key: ' ', preventDefault: jest.fn() });

      expect(inputController.isInputEnabled).toBe(false);
    });

    test('should reset keyboard state on disableInput', () => {
      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });
      expect(inputController.isKeyboardAiming).toBe(true);

      inputController.disableInput();

      expect(inputController.isKeyboardAiming).toBe(false);
      expect(inputController.isKeyboardCharging).toBe(false);
      expect(inputController.keyboardPower).toBe(0);
      expect(inputController.keysPressed).toEqual({});
    });

    test('should not double-charge if Space pressed twice', () => {
      inputController.onKeyDown({ key: ' ', preventDefault: jest.fn() });
      inputController.keyboardPower = 0.3;

      // Second press should be ignored
      inputController.onKeyDown({ key: ' ', preventDefault: jest.fn() });

      expect(inputController.keyboardPower).toBe(0.3);
    });

    test('should pass direction vector to hitBall based on aim angle', () => {
      inputController.onKeyDown({ key: ' ', preventDefault: jest.fn() });
      inputController.keyboardAimAngle = Math.PI / 2; // 90 degrees
      inputController.keyboardPower = 0.6;

      inputController.onKeyUp({ key: ' ', preventDefault: jest.fn() });

      const callArgs = mockGame.ballManager.hitBall.mock.calls[0];
      const direction = callArgs[0];
      // At angle PI/2, sin=1, cos=0 -> direction should be (1, 0, 0)
      expect(direction.x).toBeCloseTo(1, 1);
      expect(direction.z).toBeCloseTo(0, 1);
      expect(callArgs[1]).toBe(0.6);
    });

    test('should cleanup keyboard listeners', () => {
      const removeSpy = jest.spyOn(window, 'removeEventListener');

      inputController.cleanup();

      const keydownRemoved = removeSpy.mock.calls.some(call => call[0] === 'keydown');
      const keyupRemoved = removeSpy.mock.calls.some(call => call[0] === 'keyup');
      expect(keydownRemoved).toBe(true);
      expect(keyupRemoved).toBe(true);

      removeSpy.mockRestore();
    });

    test('should ignore non-aiming keys', () => {
      inputController.onKeyDown({ key: 'a', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(false);
    });

    test('should not start keyboard aiming when ball is not stopped', () => {
      mockGame.ballManager.ball.isStopped.mockReturnValue(false);

      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(false);
    });

    test('should not start keyboard aiming when ball is null', () => {
      mockGame.ballManager.ball = null;

      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(false);
    });

    test('should update power indicator during keyboard power charge', () => {
      const setPropertySpy = inputController.powerIndicator.style.setProperty;

      inputController.startKeyboardAiming();
      inputController.isKeyboardCharging = true;
      inputController.keyboardPower = 0;

      inputController.updateKeyboardAiming(0.5);

      // Power should have increased and indicator updated
      expect(inputController.keyboardPower).toBeGreaterThan(0);
      expect(setPropertySpy).toHaveBeenCalledWith(
        '--power-width',
        expect.stringMatching(/^\d+(\.\d+)?%$/)
      );
    });

    test('should update power indicator progressively as power increases', () => {
      const setPropertySpy = inputController.powerIndicator.style.setProperty;

      inputController.startKeyboardAiming();
      inputController.isKeyboardCharging = true;
      inputController.keyboardPower = 0;

      // First update
      inputController.updateKeyboardAiming(0.25);
      const firstPower = inputController.keyboardPower;

      // Second update
      inputController.updateKeyboardAiming(0.25);
      const secondPower = inputController.keyboardPower;

      expect(secondPower).toBeGreaterThan(firstPower);
      // Verify indicator was called at least twice (once per update)
      expect(setPropertySpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    test('should show aim line visual during keyboard aiming', () => {
      inputController.startKeyboardAiming();

      // updateKeyboardAimVisual is called during startKeyboardAiming
      // which calls updateAimLine, which adds a direction line to the scene
      expect(mockGame.scene.add).toHaveBeenCalled();
    });

    test('should update aim line visual on each keyboard aiming update', () => {
      inputController.startKeyboardAiming();
      mockGame.scene.add.mockClear();

      inputController.keysPressed['ArrowLeft'] = true;
      inputController.updateKeyboardAiming(0.1);

      // updateKeyboardAimVisual calls updateAimLine which adds to scene
      expect(mockGame.scene.add).toHaveBeenCalled();
    });

    test('should remove aim line when keyboard aiming is cancelled', () => {
      inputController.startKeyboardAiming();

      inputController.cancelKeyboardAiming();

      // directionLine should be removed
      expect(inputController.directionLine).toBeNull();
    });

    test('mouse drag-to-aim still works after keyboard input', () => {
      // First do keyboard aiming and cancel
      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });
      expect(inputController.isKeyboardAiming).toBe(true);

      inputController.onKeyUp({ key: 'Escape', preventDefault: jest.fn() });
      expect(inputController.isKeyboardAiming).toBe(false);

      // After keyboard cancel, verify mouse input state is clean
      inputController.enableInput();
      expect(inputController.isInputEnabled).toBe(true);
      expect(inputController.isKeyboardAiming).toBe(false);
      expect(inputController.isPointerDown).toBe(false);

      // Simulate a complete mouse drag-to-aim cycle by setting state directly
      // (mouse down sets isPointerDown, drag sets direction/power, mouse up fires)
      inputController.raycaster.intersectObject = jest.fn(() => [{ object: {} }]);
      inputController.onMouseDown({
        button: 0,
        clientX: 400,
        clientY: 300,
        preventDefault: jest.fn()
      });
      expect(inputController.isPointerDown).toBe(true);

      // Set drag state and fire via mouse up
      inputController.isDragging = true;
      inputController.hitPower = 0.5;
      inputController.hitDirection = {
        x: 0,
        y: 0,
        z: 1,
        clone: jest.fn(() => ({ x: 0, y: 0, z: 1 })),
        set: jest.fn(function (nx, ny, nz) {
          this.x = nx;
          this.y = ny;
          this.z = nz;
          return this;
        })
      };
      inputController.onMouseUp({ button: 0, preventDefault: jest.fn() });

      expect(mockGame.ballManager.hitBall).toHaveBeenCalled();
    });

    test('keyboard input is blocked while mouse is actively dragging', () => {
      // Start mouse drag
      inputController.isPointerDown = true;
      inputController.isDragging = true;

      // Try keyboard input while mouse is active
      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });

      expect(inputController.isKeyboardAiming).toBe(false);
      expect(inputController.keysPressed['ArrowLeft']).toBeUndefined();
    });

    test('mouse input cancels active keyboard aiming via pointer down guard', () => {
      // Start keyboard aiming
      inputController.onKeyDown({ key: 'ArrowLeft', preventDefault: jest.fn() });
      expect(inputController.isKeyboardAiming).toBe(true);

      // Simulate mouse down (sets isPointerDown)
      inputController.raycaster.intersectObject = jest.fn(() => [{ object: {} }]);
      inputController.onMouseDown({
        button: 0,
        clientX: 400,
        clientY: 300,
        preventDefault: jest.fn()
      });

      // Further keyboard input should be blocked since pointer is now down
      inputController.onKeyDown({ key: 'ArrowRight', preventDefault: jest.fn() });
      expect(inputController.keysPressed['ArrowRight']).toBeUndefined();
    });

    test('space key does not interfere with mouse aim direction', () => {
      // Set up mouse-based aim
      inputController.isPointerDown = true;
      inputController.isDragging = true;
      inputController.hitDirection = {
        x: 1,
        y: 0,
        z: 0,
        clone: jest.fn(() => ({ x: 1, y: 0, z: 0 }))
      };
      inputController.hitPower = 0.7;

      // Try space while mouse is active — should be rejected
      inputController.onKeyDown({ key: ' ', preventDefault: jest.fn() });
      expect(inputController.isKeyboardCharging).toBe(false);

      // Mouse aim direction should be unchanged
      expect(inputController.hitDirection.x).toBe(1);
      expect(inputController.hitPower).toBe(0.7);
    });
  });
});
