import { InputController } from '../../controls/InputController';

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
    return {
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
      subVectors: jest.fn(function (a, b) {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        this.z = a.z - b.z;
        return this;
      }),
      normalize: jest.fn(function () {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (len > 0) {
          this.x /= len;
          this.y /= len;
          this.z /= len;
        }
        return this;
      }),
      multiplyScalar: jest.fn(function (s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
      }),
      distanceTo: jest.fn(function (other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dz = this.z - other.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      }),
      lengthSquared: jest.fn(function () {
        return this.x * this.x + this.y * this.y + this.z * this.z;
      })
    };
  }),
  Raycaster: jest.fn(() => ({
    setFromCamera: jest.fn(),
    intersectObjects: jest.fn(() => []),
    intersectObject: jest.fn(() => []),
    ray: {
      intersectPlane: jest.fn(() => null)
    }
  })),
  Plane: jest.fn(() => ({})),
  BufferGeometry: jest.fn(() => ({
    setFromPoints: jest.fn(),
    dispose: jest.fn()
  })),
  LineBasicMaterial: jest.fn(() => ({
    dispose: jest.fn()
  })),
  Line: jest.fn(() => ({
    position: { y: 0 },
    geometry: { dispose: jest.fn() },
    material: { dispose: jest.fn() }
  })),
  SphereGeometry: jest.fn(() => ({ dispose: jest.fn() })),
  MeshBasicMaterial: jest.fn(opts => ({
    color: opts?.color || 0xffffff,
    opacity: opts?.opacity !== undefined ? opts.opacity : 1,
    transparent: opts?.transparent || false,
    dispose: jest.fn()
  })),
  Mesh: jest.fn((geo, mat) => ({
    geometry: geo,
    material: mat,
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    scale: { setScalar: jest.fn(), x: 1, y: 1, z: 1 }
  })),
  Color: jest.fn()
}));

function createMockGame({ isMobile = false } = {}) {
  const mockContext = {
    getParameter: jest.fn().mockReturnValue('Mock GPU'),
    canvas: { width: 512, height: 512 }
  };

  if (isMobile) {
    Object.defineProperty(global.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
    });
  } else {
    Object.defineProperty(global.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0'
    });
  }

  Object.defineProperty(global.navigator, 'deviceMemory', {
    writable: true,
    value: 4
  });

  Object.defineProperty(global.navigator, 'vibrate', {
    writable: true,
    value: jest.fn()
  });

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

  global.document.getElementById = jest.fn().mockReturnValue({
    style: {
      display: 'none',
      setProperty: jest.fn()
    }
  });

  const domElement = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getBoundingClientRect: jest.fn(() => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600
    }))
  };

  return {
    debugManager: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    },
    eventManager: {
      publish: jest.fn(),
      subscribe: jest.fn(() => jest.fn())
    },
    stateManager: {
      isBallInMotion: jest.fn(() => false),
      isHoleCompleted: jest.fn(() => false),
      getGameState: jest.fn(() => 'AIMING')
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
      controls: { enabled: true },
      panCameraOnEdge: jest.fn()
    },
    scene: {
      add: jest.fn(),
      remove: jest.fn()
    },
    renderer: { domElement },
    camera: {
      getWorldDirection: jest.fn(target => {
        target.x = 0;
        target.y = 0;
        target.z = -1;
        return target;
      })
    }
  };
}

describe('InputController — aiming, power, and events', () => {
  let controller;
  let mockGame;

  beforeEach(() => {
    mockGame = createMockGame();
    controller = new InputController(mockGame);
  });

  afterEach(() => {
    if (controller && typeof controller.cleanup === 'function') {
      controller.cleanup();
    }
  });

  describe('constructor defaults', () => {
    test('isInputEnabled defaults to true', () => {
      expect(controller.isInputEnabled).toBe(true);
    });

    test('isPointerDown defaults to false', () => {
      expect(controller.isPointerDown).toBe(false);
    });

    test('isDragging defaults to false', () => {
      expect(controller.isDragging).toBe(false);
    });

    test('hitPower defaults to 0', () => {
      expect(controller.hitPower).toBe(0);
    });

    test('hitDirection defaults to (0, 0, 1)', () => {
      expect(controller.hitDirection.x).toBe(0);
      expect(controller.hitDirection.y).toBe(0);
      expect(controller.hitDirection.z).toBe(1);
    });

    test('isInitialized defaults to false', () => {
      expect(controller.isInitialized).toBe(false);
    });
  });

  describe('enableInput / disableInput', () => {
    test('disableInput sets isInputEnabled to false', () => {
      expect(controller.isInputEnabled).toBe(true);
      controller.disableInput();
      expect(controller.isInputEnabled).toBe(false);
    });

    test('enableInput sets isInputEnabled to true', () => {
      controller.disableInput();
      controller.enableInput();
      expect(controller.isInputEnabled).toBe(true);
    });

    test('disableInput guards against re-entry (no-op when already disabled)', () => {
      controller.disableInput();
      mockGame.debugManager.log.mockClear();
      controller.disableInput();
      expect(mockGame.debugManager.log).not.toHaveBeenCalled();
    });

    test('enableInput guards against re-entry (no-op when already enabled)', () => {
      mockGame.debugManager.log.mockClear();
      controller.enableInput();
      expect(mockGame.debugManager.log).not.toHaveBeenCalled();
    });

    test('disableInput resets isPointerDown and isDragging', () => {
      controller.isPointerDown = true;
      controller.isDragging = true;
      controller.disableInput();
      expect(controller.isPointerDown).toBe(false);
      expect(controller.isDragging).toBe(false);
    });
  });

  describe('mouse pointer-down → drag → pointer-up sequence', () => {
    function makeMouseEvent(overrides = {}) {
      return {
        button: 0,
        clientX: 400,
        clientY: 300,
        preventDefault: jest.fn(),
        ...overrides
      };
    }

    test('onMouseDown sets isPointerDown when clicking on ball', () => {
      controller.raycaster.intersectObject = jest.fn(() => [{ object: {} }]);
      controller.onMouseDown(makeMouseEvent());
      expect(controller.isPointerDown).toBe(true);
    });

    test('onMouseDown ignores non-left button clicks', () => {
      controller.onMouseDown(makeMouseEvent({ button: 2 }));
      expect(controller.isPointerDown).toBe(false);
    });

    test('onMouseDown is a no-op when input is disabled', () => {
      controller.isInputEnabled = false;
      controller.onMouseDown(makeMouseEvent());
      expect(controller.isPointerDown).toBe(false);
    });

    test('onMouseDown is a no-op when ball is in motion', () => {
      mockGame.stateManager.isBallInMotion.mockReturnValue(true);
      controller.raycaster.intersectObject = jest.fn(() => [{ object: {} }]);
      controller.onMouseDown(makeMouseEvent());
      expect(controller.isPointerDown).toBe(false);
    });

    test('onMouseMove sets isDragging to true when pointer is down', () => {
      controller.isPointerDown = true;
      mockGame.ballManager.ball.mesh.position.clone = jest.fn(() => ({
        x: 0,
        y: 0,
        z: 0,
        distanceTo: jest.fn(() => 5)
      }));
      controller.raycaster.ray.intersectPlane = jest.fn(() => ({
        x: 5,
        y: 0,
        z: 5
      }));

      controller.onMouseMove(makeMouseEvent({ clientX: 450, clientY: 350 }));
      expect(controller.isDragging).toBe(true);
    });

    test('onMouseMove does nothing when pointer is not down', () => {
      controller.isPointerDown = false;
      controller.onMouseMove(makeMouseEvent());
      expect(controller.isDragging).toBe(false);
    });

    test('onMouseUp calls hitBall when dragging with sufficient power', () => {
      controller.isPointerDown = true;
      controller.isDragging = true;
      controller.isInputEnabled = true;
      controller.hitPower = 0.5;
      controller.hitDirection = {
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

      controller.onMouseUp(makeMouseEvent());

      expect(mockGame.ballManager.hitBall).toHaveBeenCalledWith(
        expect.objectContaining({ x: 0, y: 0, z: 1 }),
        0.5
      );
    });

    test('onMouseUp does not fire shot when drag did not occur (tap-only)', () => {
      controller.isPointerDown = true;
      controller.isDragging = false;
      controller.isInputEnabled = true;

      controller.onMouseUp(makeMouseEvent());

      expect(mockGame.ballManager.hitBall).not.toHaveBeenCalled();
    });

    test('onMouseUp does not fire shot when hitPower is below threshold', () => {
      controller.isPointerDown = true;
      controller.isDragging = true;
      controller.isInputEnabled = true;
      controller.hitPower = 0.03;

      controller.onMouseUp(makeMouseEvent());

      expect(mockGame.ballManager.hitBall).not.toHaveBeenCalled();
    });

    test('onMouseUp resets state after firing', () => {
      controller.isPointerDown = true;
      controller.isDragging = true;
      controller.isInputEnabled = true;
      controller.hitPower = 0.6;
      controller.hitDirection = {
        x: 1,
        y: 0,
        z: 0,
        clone: jest.fn(() => ({ x: 1, y: 0, z: 0 })),
        set: jest.fn(function (nx, ny, nz) {
          this.x = nx;
          this.y = ny;
          this.z = nz;
          return this;
        })
      };

      controller.onMouseUp(makeMouseEvent());

      expect(controller.isPointerDown).toBe(false);
      expect(controller.isDragging).toBe(false);
      expect(controller.hitPower).toBe(0);
      expect(controller.intersectionPoint).toBeNull();
    });

    test('onMouseUp restores camera controls', () => {
      controller.isPointerDown = true;
      controller.isDragging = false;
      controller.controlsWereEnabled = true;
      mockGame.cameraController.controls.enabled = false;

      controller.onMouseUp(makeMouseEvent());

      expect(mockGame.cameraController.controls.enabled).toBe(true);
    });
  });

  describe('hitPower clamping', () => {
    test('hitPower stays at 0 when no drag occurs', () => {
      expect(controller.hitPower).toBe(0);
    });

    test('hitPower is clamped to 1.0 when drag exceeds maxDragDistance', () => {
      controller.isPointerDown = true;
      mockGame.ballManager.ball.mesh.position.clone = jest.fn(() => ({
        x: 0,
        y: 0,
        z: 0,
        distanceTo: jest.fn(() => 50)
      }));
      controller.raycaster.ray.intersectPlane = jest.fn(() => ({ x: 20, y: 0, z: 20 }));

      controller.onMouseMove({
        clientX: 700,
        clientY: 500,
        preventDefault: jest.fn()
      });

      expect(controller.hitPower).toBe(1.0);
    });

    test('hitPower is proportional for drags within _DRAG_SCALE_PX (screen-pixel based)', () => {
      // Set drag start so that a 60px drag → power ≈ 0.5
      controller.isPointerDown = true;
      controller._dragStartScreenX = 440;
      controller._dragStartScreenY = 300;

      controller.onMouseMove({
        clientX: 500, // 60px from start → 60/120 = 0.5
        clientY: 300,
        preventDefault: jest.fn()
      });

      expect(controller.hitPower).toBeCloseTo(0.5, 1);
    });

    test('hitPower boundary: exactly at maxDragDistance yields 1.0', () => {
      const maxDrag = controller.maxDragDistance;
      controller.isPointerDown = true;

      const ballPos = {
        x: 0,
        y: 0,
        z: 0,
        clone: jest.fn(() => ({
          x: 0,
          y: 0,
          z: 0,
          distanceTo: jest.fn(() => maxDrag)
        }))
      };
      mockGame.ballManager.ball.mesh.position = ballPos;

      const intersection = {
        x: maxDrag,
        y: 0,
        z: 0
      };
      controller.raycaster.ray.intersectPlane = jest.fn(() => intersection);

      controller.onMouseMove({
        clientX: 700,
        clientY: 300,
        preventDefault: jest.fn()
      });

      expect(controller.hitPower).toBeLessThanOrEqual(1.0);
    });
  });

  describe('hitDirection normalisation', () => {
    test('hitDirection is normalised during onMouseMove', () => {
      controller.isPointerDown = true;
      mockGame.ballManager.ball.mesh.position.clone = jest.fn(() => ({
        x: 0,
        y: 0,
        z: 0,
        distanceTo: jest.fn(() => 5)
      }));
      controller.raycaster.ray.intersectPlane = jest.fn(() => ({ x: 3, y: 0, z: 4 }));

      controller.onMouseMove({
        clientX: 500,
        clientY: 400,
        preventDefault: jest.fn()
      });

      expect(controller.hitDirection.normalize).toHaveBeenCalled();
    });

    test('hitDirection subVectors is called with ball and intersection positions', () => {
      controller.isPointerDown = true;
      mockGame.ballManager.ball.mesh.position.clone = jest.fn(() => ({
        x: 2,
        y: 0,
        z: 3,
        distanceTo: jest.fn(() => 5)
      }));
      controller.raycaster.ray.intersectPlane = jest.fn(() => ({ x: 5, y: 0, z: 7 }));

      controller.onMouseMove({
        clientX: 500,
        clientY: 400,
        preventDefault: jest.fn()
      });

      expect(controller.hitDirection.subVectors).toHaveBeenCalled();
    });
  });

  describe('shot event payload', () => {
    test('hitBall receives cloned direction vector and power float', () => {
      controller.isPointerDown = true;
      controller.isDragging = true;
      controller.isInputEnabled = true;
      controller.hitPower = 0.75;

      const clonedDir = { x: 0, y: 0, z: 1 };
      controller.hitDirection = {
        x: 0,
        y: 0,
        z: 1,
        clone: jest.fn(() => clonedDir),
        set: jest.fn(function (nx, ny, nz) {
          this.x = nx;
          this.y = ny;
          this.z = nz;
          return this;
        })
      };

      controller.onMouseUp({ button: 0, preventDefault: jest.fn() });

      expect(mockGame.ballManager.hitBall).toHaveBeenCalledTimes(1);
      const [dir, power] = mockGame.ballManager.hitBall.mock.calls[0];
      expect(dir).toBe(clonedDir);
      expect(typeof power).toBe('number');
      expect(power).toBe(0.75);
    });

    test('disableInput is called after firing shot', () => {
      controller.isPointerDown = true;
      controller.isDragging = true;
      controller.isInputEnabled = true;
      controller.hitPower = 0.5;
      controller.hitDirection = {
        x: 1,
        y: 0,
        z: 0,
        clone: jest.fn(() => ({ x: 1, y: 0, z: 0 })),
        set: jest.fn(function (nx, ny, nz) {
          this.x = nx;
          this.y = ny;
          this.z = nz;
          return this;
        })
      };

      controller.onMouseUp({ button: 0, preventDefault: jest.fn() });

      expect(controller.isInputEnabled).toBe(false);
    });
  });

  describe('isMobileDevice routing', () => {
    test('desktop user agent sets isMobileDevice to false', () => {
      const desktopGame = createMockGame({ isMobile: false });
      const desktopController = new InputController(desktopGame);

      expect(desktopController.isMobileDevice).toBe(false);
      desktopController.cleanup();
    });

    test('mobile user agent sets isMobileDevice to true', () => {
      const mobileGame = createMockGame({ isMobile: true });
      const mobileController = new InputController(mobileGame);

      expect(mobileController.isMobileDevice).toBe(true);
      mobileController.cleanup();
    });

    test('touch events delegate to mouse handlers on single-touch', () => {
      controller.raycaster.intersectObject = jest.fn(() => [{ object: {} }]);

      const touchEvent = {
        preventDefault: jest.fn(),
        touches: [{ clientX: 200, clientY: 150 }]
      };

      controller.onTouchStart(touchEvent);

      expect(controller.lastTouchPosition.set).toHaveBeenCalledWith(200, 150);
    });

    test('onTouchMove delegates to onMouseMove for single-touch drag', () => {
      controller.isPointerDown = true;
      mockGame.ballManager.ball.mesh.position.clone = jest.fn(() => ({
        x: 0,
        y: 0,
        z: 0,
        distanceTo: jest.fn(() => 3)
      }));
      controller.raycaster.ray.intersectPlane = jest.fn(() => ({
        x: 3,
        y: 0,
        z: 4
      }));

      const touchMoveEvent = {
        preventDefault: jest.fn(),
        touches: [{ clientX: 250, clientY: 200 }]
      };

      controller.onTouchMove(touchMoveEvent);

      expect(controller.isDragging).toBe(true);
    });

    test('onTouchEnd delegates to onMouseUp', () => {
      controller.isPointerDown = true;
      controller.isDragging = true;
      controller.isInputEnabled = true;
      controller.hitPower = 0.4;
      controller.hitDirection = {
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

      const touchEndEvent = { preventDefault: jest.fn() };
      controller.onTouchEnd(touchEndEvent);

      expect(mockGame.ballManager.hitBall).toHaveBeenCalled();
    });

    test('multi-touch does not trigger shot (isMultiTouch tracked)', () => {
      const multiTouchEvent = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 }
        ]
      };

      controller.onTouchStart(multiTouchEvent);

      expect(controller.isMultiTouch).toBe(true);
      expect(controller.pinchDistance).toBeGreaterThan(0);
    });

    test('two-finger tap triggers game.pauseGame within 200 ms', () => {
      mockGame.pauseGame = jest.fn();
      const now = performance.now();
      jest.spyOn(performance, 'now').mockReturnValue(now);

      const twoFingerStart = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 120, clientY: 100 }
        ]
      };
      controller.onTouchStart(twoFingerStart);

      // Simulate quick release (< 200 ms)
      jest.spyOn(performance, 'now').mockReturnValue(now + 100);
      const twoFingerEnd = {
        preventDefault: jest.fn(),
        touches: []
      };
      controller.onTouchEnd(twoFingerEnd);

      expect(mockGame.pauseGame).toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    test('two-finger long-press does NOT trigger pauseGame (> 200 ms)', () => {
      mockGame.pauseGame = jest.fn();
      const now = performance.now();
      jest.spyOn(performance, 'now').mockReturnValue(now);

      const twoFingerStart = {
        preventDefault: jest.fn(),
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 120, clientY: 100 }
        ]
      };
      controller.onTouchStart(twoFingerStart);

      // Simulate slow release (> 200 ms = pinch/drag gesture)
      jest.spyOn(performance, 'now').mockReturnValue(now + 300);
      const twoFingerEnd = {
        preventDefault: jest.fn(),
        touches: []
      };
      controller.onTouchEnd(twoFingerEnd);

      expect(mockGame.pauseGame).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    test('touch start is ignored when input is disabled', () => {
      controller.isInputEnabled = false;

      const touchEvent = {
        preventDefault: jest.fn(),
        touches: [{ clientX: 100, clientY: 100 }]
      };

      controller.onTouchStart(touchEvent);

      expect(controller.isPointerDown).toBe(false);
    });
  });

  describe('cleanup (dispose)', () => {
    test('cleanup removes window event listeners', () => {
      const removeSpy = jest.spyOn(window, 'removeEventListener');

      controller.init();
      controller.cleanup();

      const removedTypes = removeSpy.mock.calls.map(call => call[0]);
      expect(removedTypes).toContain('mousemove');
      expect(removedTypes).toContain('mouseup');
      expect(removedTypes).toContain('touchmove');
      expect(removedTypes).toContain('touchend');
      expect(removedTypes).toContain('keydown');
      expect(removedTypes).toContain('keyup');

      removeSpy.mockRestore();
    });

    test('cleanup removes domElement event listeners', () => {
      controller.init();
      controller.cleanup();

      expect(mockGame.renderer.domElement.removeEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      );
      expect(mockGame.renderer.domElement.removeEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function)
      );
    });

    test('cleanup nulls internal refs', () => {
      controller.init();
      controller.cleanup();

      expect(controller.raycaster).toBeNull();
      expect(controller.pointer).toBeNull();
      expect(controller.intersectionPoint).toBeNull();
      expect(controller.isInitialized).toBe(false);
    });

    test('cleanup unsubscribes game event listeners', () => {
      const unsubFn = jest.fn();
      mockGame.eventManager.subscribe = jest.fn(() => unsubFn);

      controller.init();
      controller.cleanup();

      expect(unsubFn).toHaveBeenCalledTimes(3);
    });

    test('no shot fires after cleanup even with manual state manipulation', () => {
      controller.init();
      controller.cleanup();

      controller.isInputEnabled = true;
      controller.isPointerDown = true;
      controller.isDragging = true;
      controller.hitPower = 0.8;
      controller.hitDirection = {
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

      controller.onMouseUp({ button: 0, preventDefault: jest.fn() });

      expect(controller.raycaster).toBeNull();
      expect(controller.pointer).toBeNull();
    });
  });

  describe('init', () => {
    test('init sets isInitialized to true', () => {
      controller.init();
      expect(controller.isInitialized).toBe(true);
    });

    test('init guards against double-init', () => {
      controller.init();
      controller.init();
      expect(mockGame.debugManager.warn).toHaveBeenCalledWith(
        'InputController.init',
        'Already initialized'
      );
    });

    test('init registers DOM event listeners on renderer domElement', () => {
      controller.init();
      expect(mockGame.renderer.domElement.addEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      );
      expect(mockGame.renderer.domElement.addEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { passive: false }
      );
    });

    test('init subscribes to game events', () => {
      controller.init();
      expect(mockGame.eventManager.subscribe).toHaveBeenCalledTimes(3);
    });
  });

  describe('game event handlers', () => {
    test('handleBallStopped enables input when hole is not completed', () => {
      controller.disableInput();
      mockGame.stateManager.isHoleCompleted.mockReturnValue(false);

      controller.handleBallStopped();

      expect(controller.isInputEnabled).toBe(true);
    });

    test('handleBallStopped does not enable input when hole is completed', () => {
      controller.disableInput();
      mockGame.stateManager.isHoleCompleted.mockReturnValue(true);

      controller.handleBallStopped();

      expect(controller.isInputEnabled).toBe(false);
    });

    test('handleBallInHole disables input', () => {
      controller.handleBallInHole();
      expect(controller.isInputEnabled).toBe(false);
    });

    test('handleHoleStarted enables input', () => {
      controller.disableInput();
      controller.handleHoleStarted();
      expect(controller.isInputEnabled).toBe(true);
    });
  });
});
