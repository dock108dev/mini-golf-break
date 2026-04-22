import { CameraController } from '../controls/CameraController';

// Mock Three.js classes
jest.mock('three', () => ({
  PerspectiveCamera: jest.fn(() => ({
    position: {
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      }),
      copy: jest.fn(function (v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
      }),
      add: jest.fn(function (v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
      }),
      distanceTo: jest.fn(() => 10),
      lerp: jest.fn(function (_v, _t) {
        return this;
      }),
      x: 0,
      y: 0,
      z: 0
    },
    lookAt: jest.fn(),
    aspect: 1,
    updateProjectionMatrix: jest.fn(),
    fov: 60,
    far: 5000,
    getWorldDirection: jest.fn()
  })),
  Vector3: jest.fn(() => {
    const createVector3Mock = (x = 0, y = 0, z = 0) => ({
      x,
      y,
      z,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      }),
      copy: jest.fn(function (v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
      }),
      clone: jest.fn(function () {
        return createVector3Mock(this.x, this.y, this.z);
      }),
      add: jest.fn(function (v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
      }),
      addVectors: jest.fn(function (a, b) {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        this.z = a.z + b.z;
        return this;
      }),
      subVectors: jest.fn(function (a, b) {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        this.z = a.z - b.z;
        return this;
      }),
      lerpVectors: jest.fn(function (a, b, t) {
        this.x = a.x + (b.x - a.x) * t;
        this.y = a.y + (b.y - a.y) * t;
        this.z = a.z + (b.z - a.z) * t;
        return this;
      }),
      multiplyScalar: jest.fn(function (s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
      }),
      normalize: jest.fn(function () {
        return this;
      }),
      addScaledVector: jest.fn(function (v, s) {
        this.x += v.x * s;
        this.y += v.y * s;
        this.z += v.z * s;
        return this;
      }),
      distanceTo: jest.fn(() => 5),
      distanceToSquared: jest.fn(() => 25),
      toArray: jest.fn(() => [this.x, this.y, this.z]),
      setY: jest.fn(function (y) {
        this.y = y;
        return this;
      })
    });
    return createVector3Mock();
  }),
  MathUtils: {
    degToRad: jest.fn(deg => (deg * Math.PI) / 180),
    lerp: jest.fn((a, b, t) => a + (b - a) * t)
  }
}));

// Mock OrbitControls
jest.mock('three/examples/jsm/controls/OrbitControls', () => ({
  OrbitControls: jest.fn(() => ({
    enableDamping: true,
    dampingFactor: 0.1,
    rotateSpeed: 0.7,
    zoomSpeed: 1.2,
    minDistance: 2,
    maxDistance: 30,
    maxPolarAngle: Math.PI / 2,
    enablePan: true,
    panSpeed: 0.8,
    screenSpacePanning: true,
    enableZoom: true,
    enableRotate: true,
    enabled: true,
    target: {
      copy: jest.fn(function (v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
      }),
      lerp: jest.fn(function (_v, _t) {
        return this;
      }),
      add: jest.fn(function (v) {
        this.x = (this.x || 0) + v.x;
        this.y = (this.y || 0) + v.y;
        this.z = (this.z || 0) + v.z;
        return this;
      }),
      distanceTo: jest.fn(() => 5),
      x: 0,
      y: 0,
      z: 0
    },
    addEventListener: jest.fn(),
    update: jest.fn(),
    dispose: jest.fn()
  }))
}));

describe('CameraController', () => {
  let cameraController;
  let mockGame;
  let mockRenderer;
  let mockScene;

  beforeEach(() => {
    // Set up DOM environment
    if (!global.document) {
      global.document = {};
    }

    // Mock DOM elements
    global.document.createElement = jest.fn(tag => {
      if (tag === 'canvas') {
        return {
          width: 800,
          height: 600,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          getBoundingClientRect: jest.fn(() => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600
          }))
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
      domElement: global.document.createElement('canvas')
    };

    mockScene = {
      add: jest.fn(),
      remove: jest.fn(),
      children: []
    };

    mockGame = {
      scene: mockScene,
      debugManager: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      eventManager: {
        subscribe: jest.fn(() => () => {}), // Return unsubscribe function
        publish: jest.fn()
      },
      ballManager: {
        ball: {
          mesh: {
            position: {
              x: 0,
              y: 0,
              z: 0,
              clone: jest.fn(function () {
                return {
                  x: this.x,
                  y: this.y,
                  z: this.z,
                  clone: jest.fn(function () {
                    return {
                      x: this.x,
                      y: this.y,
                      z: this.z,
                      add: jest.fn(function (v) {
                        return {
                          x: this.x + v.x,
                          y: this.y + v.y,
                          z: this.z + v.z
                        };
                      })
                    };
                  }),
                  add: jest.fn(function (v) {
                    return {
                      x: this.x + v.x,
                      y: this.y + v.y,
                      z: this.z + v.z,
                      clone: jest.fn(function () {
                        return {
                          x: this.x,
                          y: this.y,
                          z: this.z,
                          add: jest.fn(function (v) {
                            return {
                              x: this.x + v.x,
                              y: this.y + v.y,
                              z: this.z + v.z
                            };
                          })
                        };
                      })
                    };
                  }),
                  setY: jest.fn(function (newY) {
                    this.y = newY;
                    return this;
                  })
                };
              })
            }
          },
          body: {
            velocity: {
              x: 0,
              y: 0,
              z: 0,
              length: jest.fn(() => 0),
              lengthSquared: jest.fn(() => 0)
            }
          }
        }
      },
      stateManager: {
        isBallInMotion: jest.fn(() => false)
      }
    };

    cameraController = new CameraController(mockGame);
    cameraController.setRenderer(mockRenderer);
  });

  afterEach(() => {
    if (cameraController && typeof cameraController.cleanup === 'function') {
      cameraController.cleanup();
    }
  });

  test('should initialize with correct default settings', () => {
    expect(cameraController.camera).toBeDefined();
    expect(cameraController.game).toBe(mockGame);
    expect(cameraController.scene).toBe(mockScene);
    expect(cameraController.debugMode).toBe(false);
  });

  test('should set renderer correctly', () => {
    const result = cameraController.setRenderer(mockRenderer);
    expect(cameraController.renderer).toBe(mockRenderer);
    expect(result).toBe(cameraController); // Should return this for chaining
  });

  test('should initialize controls and setup', () => {
    cameraController.init();

    expect(cameraController.controls).toBeDefined();
    expect(cameraController.isInitialized).toBe(true);
  });

  test('should handle resize events', () => {
    cameraController.handleResize();

    expect(cameraController.camera.updateProjectionMatrix).toHaveBeenCalled();
  });

  test('should enable debug mode correctly', () => {
    cameraController.init(); // Initialize first to create controls
    cameraController.setDebugMode(true);

    expect(cameraController.debugMode).toBe(true);
    expect(cameraController.controls.maxPolarAngle).toBe(Math.PI);
    expect(cameraController.controls.minDistance).toBe(0.5);
  });

  test('should optimize for mobile devices', () => {
    cameraController.init(); // Need controls to be initialized
    cameraController.optimizeForMobile();

    expect(cameraController.controls.dampingFactor).toBe(0.05);
    expect(cameraController.controls.zoomSpeed).toBe(0.5);
    expect(cameraController.controls.panSpeed).toBe(0.3);
    expect(cameraController.controls.rotateSpeed).toBe(0.3);
    expect(cameraController.controls.maxPolarAngle).toBe(Math.PI * 0.8);
  });

  test('should adjust zoom correctly', () => {
    cameraController.init();
    const zoomFactor = 1.5;

    cameraController.adjustZoom(zoomFactor);

    expect(cameraController.controls.update).toHaveBeenCalled();
  });

  test('should set quality level based on performance', () => {
    // Test high performance settings
    cameraController.setQualityLevel(true);
    expect(cameraController.camera.fov).toBe(60);
    expect(cameraController.camera.far).toBe(5000);

    // Test low performance settings
    cameraController.setQualityLevel(false);
    expect(cameraController.camera.fov).toBe(65);
    expect(cameraController.camera.far).toBe(2000);

    expect(cameraController.camera.updateProjectionMatrix).toHaveBeenCalled();
  });

  test('should handle ball creation events', () => {
    const mockBall = { id: 'test-ball' };
    const mockEvent = {
      get: jest.fn(() => mockBall)
    };

    cameraController.handleBallCreated(mockEvent);

    expect(cameraController.ball).toBe(mockBall);
  });

  test('should handle ball hit events', () => {
    cameraController._userAdjustedCamera = true;
    cameraController.handleBallHit({});

    expect(cameraController._userAdjustedCamera).toBe(false);
  });

  test('should position camera for hole correctly', () => {
    const mockCourse = {
      getHolePosition: jest.fn(() => ({ x: 10, y: 0, z: 10, toArray: () => [10, 0, 10] })),
      getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0, z: 0, toArray: () => [0, 0, 0] }))
    };

    cameraController.setCourse(mockCourse);
    cameraController.init();

    const result = cameraController.positionCameraForHole();

    expect(mockCourse.getHolePosition).toHaveBeenCalled();
    expect(mockCourse.getHoleStartPosition).toHaveBeenCalled();
    expect(cameraController.camera.position.copy).toHaveBeenCalled();
    expect(result).toBe(cameraController); // Should return this for chaining
  });

  test('should set transition mode correctly', () => {
    cameraController.setTransitionMode(true);
    expect(cameraController.isTransitioning).toBe(true);

    cameraController.setTransitionMode(false);
    expect(cameraController.isTransitioning).toBe(false);
  });

  test('should handle pan camera on edge correctly', () => {
    const direction = { x: 1, y: 0, z: 0 };
    const amount = 0.5;

    cameraController.init();
    cameraController.panCameraOnEdge(direction, amount);

    // Should not crash and should handle the pan logic
    expect(cameraController.controls.update).toHaveBeenCalled();
  });

  test('should update camera correctly', () => {
    const deltaTime = 0.016; // 60fps

    cameraController.init();
    // Stop menu orbit so update reaches controls.update()
    cameraController.stopMenuOrbit();
    cameraController.update(deltaTime);

    expect(cameraController.controls.update).toHaveBeenCalled();
  });

  test('should orbit camera during menu mode', () => {
    const deltaTime = 0.016;

    cameraController.init();
    const initialAngle = cameraController._menuOrbitAngle;
    cameraController.update(deltaTime);

    expect(cameraController._menuOrbitAngle).toBeGreaterThan(initialAngle);
    // Controls should NOT be updated during menu orbit
    expect(cameraController.controls.update).not.toHaveBeenCalled();
  });

  test('should stop menu orbit when stopMenuOrbit is called', () => {
    cameraController.init();
    expect(cameraController._menuOrbitActive).toBe(true);

    cameraController.stopMenuOrbit();
    expect(cameraController._menuOrbitActive).toBe(false);
  });

  test('should cleanup resources properly', () => {
    cameraController.init();
    const disposeSpy = jest.spyOn(cameraController.controls, 'dispose');

    cameraController.cleanup();

    expect(disposeSpy).toHaveBeenCalled();
    expect(cameraController.controls).toBeNull();
    expect(cameraController.isInitialized).toBe(false);
  });

  test('should start a tween when camera hint provided to positionCameraForHole', () => {
    const mockCourse = {
      getHolePosition: jest.fn(() => ({ x: 10, y: 0, z: 10, toArray: () => [10, 0, 10] })),
      getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0, z: 0, toArray: () => [0, 0, 0] })),
      getCameraHint: jest.fn(() => null)
    };

    cameraController.setCourse(mockCourse);
    cameraController.init();

    const cameraHint = {
      position: { x: 5, y: 20, z: 15, clone: jest.fn(() => ({ x: 5, y: 20, z: 15 })) },
      target: { x: 0, y: 0, z: -2, clone: jest.fn(() => ({ x: 0, y: 0, z: -2 })) }
    };

    cameraController.positionCameraForHole(cameraHint);

    expect(cameraController._hintTween).not.toBeNull();
    expect(cameraController._hintTween.endPos).toMatchObject({ x: 5, y: 20, z: 15 });
    expect(cameraController._hintTween.endLookAt).toMatchObject({ x: 0, y: 0, z: -2 });
    expect(cameraController._hintTween.duration).toBe(0.5);
  });

  test('should tween camera to hint position over 0.5 s cumulative dt', () => {
    const mockCourse = {
      getHolePosition: jest.fn(() => ({ x: 10, y: 0, z: 10, toArray: () => [10, 0, 10] })),
      getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0, z: 0, toArray: () => [0, 0, 0] })),
      getCameraHint: jest.fn(() => null)
    };

    cameraController.setCourse(mockCourse);
    cameraController.init();
    cameraController.stopMenuOrbit();

    // Force a known start position
    cameraController.camera.position.x = 0;
    cameraController.camera.position.y = 15;
    cameraController.camera.position.z = 10;

    const cameraHint = {
      position: { x: 0, y: 20, z: 12, clone: jest.fn(() => ({ x: 0, y: 20, z: 12 })) },
      target: { x: 0, y: 0, z: 0, clone: jest.fn(() => ({ x: 0, y: 0, z: 0 })) }
    };
    cameraController.positionCameraForHole(cameraHint);

    // Advance tween to completion (0.5 s)
    cameraController.update(0.25);
    expect(cameraController._hintTween).not.toBeNull(); // still in progress
    cameraController.update(0.25);
    expect(cameraController._hintTween).toBeNull(); // tween done

    expect(cameraController.camera.position.y).toBe(20);
    expect(cameraController.camera.position.z).toBe(12);
  });

  test('should fall back to default positioning when no camera hint is provided', () => {
    const mockCourse = {
      getHolePosition: jest.fn(() => ({ x: 10, y: 0, z: 10, toArray: () => [10, 0, 10] })),
      getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0, z: 0, toArray: () => [0, 0, 0] })),
      getCameraHint: jest.fn(() => null)
    };

    cameraController.setCourse(mockCourse);
    cameraController.init();

    const result = cameraController.positionCameraForHole();

    // Should still position camera (default calculation)
    expect(cameraController.camera.position.copy).toHaveBeenCalled();
    expect(cameraController.camera.lookAt).toHaveBeenCalled();
    expect(result).toBe(cameraController);
  });

  test('should read camera hint from course when no explicit hint passed', () => {
    const courseHint = {
      position: { x: 3, y: 18, z: 10, clone: jest.fn(() => ({ x: 3, y: 18, z: 10 })) },
      target: { x: 1, y: 0, z: -3, clone: jest.fn(() => ({ x: 1, y: 0, z: -3 })) }
    };

    const mockCourse = {
      getHolePosition: jest.fn(() => ({ x: 10, y: 0, z: 10, toArray: () => [10, 0, 10] })),
      getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0, z: 0, toArray: () => [0, 0, 0] })),
      getCameraHint: jest.fn(() => courseHint)
    };

    cameraController.setCourse(mockCourse);
    cameraController.init();

    cameraController.positionCameraForHole();

    expect(mockCourse.getCameraHint).toHaveBeenCalled();
    expect(cameraController._hintTween).not.toBeNull();
    expect(cameraController._hintTween.endPos).toMatchObject({ x: 3, y: 18, z: 10 });
    expect(cameraController._hintTween.endLookAt).toMatchObject({ x: 1, y: 0, z: -3 });
  });

  test('should provide updateCameraForHole method for hole transitions', () => {
    const mockCourse = {
      getHolePosition: jest.fn(() => ({ x: 10, y: 0, z: 10, toArray: () => [10, 0, 10] })),
      getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0, z: 0, toArray: () => [0, 0, 0] })),
      getCameraHint: jest.fn(() => null)
    };

    cameraController.setCourse(mockCourse);
    cameraController.init();
    cameraController._userAdjustedCamera = true;

    cameraController.updateCameraForHole();

    // Should reset user adjustment flag
    expect(cameraController._userAdjustedCamera).toBe(false);
    // Should call through to positionCameraForHole
    expect(cameraController.camera.position.copy).toHaveBeenCalled();
  });

  test('should clamp camera Y above floor after tween completes (floor-clip guard)', () => {
    const mockCourse = {
      getHolePosition: jest.fn(() => ({ x: 0, y: 0, z: -5, toArray: () => [0, 0, -5] })),
      getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0, z: 5, toArray: () => [0, 0, 5] })),
      getCameraHint: jest.fn(() => null)
    };

    cameraController.setCourse(mockCourse);
    cameraController.init();
    cameraController.stopMenuOrbit();

    // Hint with camera Y = 0 (below floor + 0.5 = 0.5)
    const cameraHint = {
      position: { x: 0, y: 0, z: 10, clone: jest.fn(() => ({ x: 0, y: 0, z: 10 })) },
      target: { x: 0, y: 0, z: 0, clone: jest.fn(() => ({ x: 0, y: 0, z: 0 })) }
    };
    cameraController.camera.position.x = 0;
    cameraController.camera.position.y = 15;
    cameraController.camera.position.z = 10;

    cameraController.positionCameraForHole(cameraHint);
    cameraController.update(0.5); // complete tween

    expect(cameraController.camera.position.y).toBeGreaterThanOrEqual(0.5);
  });

  test('should handle window resize listener', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    cameraController.init();
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    cameraController.cleanup();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
