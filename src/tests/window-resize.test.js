// Mock Three.js classes before any imports
jest.mock('three', () => ({
  Scene: jest.fn(() => ({
    add: jest.fn(),
    remove: jest.fn(),
    background: null,
    children: []
  })),
  WebGLRenderer: jest.fn(() => ({
    setSize: jest.fn(),
    setPixelRatio: jest.fn(),
    getPixelRatio: jest.fn(() => 1),
    setClearColor: jest.fn(),
    render: jest.fn(),
    dispose: jest.fn(),
    info: { reset: jest.fn() },
    shadowMap: {
      enabled: false,
      type: 'BasicShadowMap'
    },
    toneMapping: null,
    toneMappingExposure: 1.0,
    outputColorSpace: null
  })),
  Clock: jest.fn(() => ({})),
  Color: jest.fn(),
  ACESFilmicToneMapping: 'ACESFilmicToneMapping',
  PCFSoftShadowMap: 'PCFSoftShadowMap',
  BasicShadowMap: 'BasicShadowMap',
  SRGBColorSpace: 'SRGBColorSpace',
  MeshBasicMaterial: jest.fn(() => ({
    color: 0xffffff,
    wireframe: false,
    transparent: false,
    opacity: 1,
    dispose: jest.fn()
  })),
  MeshStandardMaterial: jest.fn(() => ({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.0,
    dispose: jest.fn()
  })),
  LineBasicMaterial: jest.fn(() => ({
    color: 0xffffff,
    dispose: jest.fn()
  })),
  AudioListener: jest.fn(() => ({
    context: { state: 'running' },
    getInput: jest.fn(),
    removeFilter: jest.fn(),
    setFilter: jest.fn()
  })),
  Audio: jest.fn(() => ({
    setVolume: jest.fn().mockReturnThis(),
    setBuffer: jest.fn().mockReturnThis(),
    play: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    isPlaying: false
  })),
  Group: jest.fn(() => ({
    add: jest.fn(),
    remove: jest.fn(),
    children: [],
    name: '',
    userData: {},
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0, set: jest.fn() },
    scale: { x: 1, y: 1, z: 1, set: jest.fn() }
  })),
  Vector3: jest.fn(() => ({
    x: 0,
    y: 0,
    z: 0,
    set: jest.fn(),
    copy: jest.fn(),
    clone: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
    add: jest.fn(),
    normalize: jest.fn()
  })),
  PerspectiveCamera: jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0, set: jest.fn() },
    lookAt: jest.fn(),
    updateProjectionMatrix: jest.fn(),
    aspect: 1,
    fov: 60,
    near: 0.1,
    far: 1000
  })),
  AmbientLight: jest.fn(() => ({
    intensity: 1
  })),
  DirectionalLight: jest.fn(() => ({
    position: { set: jest.fn() },
    castShadow: false,
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: {
        near: 0.5,
        far: 50,
        left: -20,
        right: 20,
        top: 20,
        bottom: -20
      }
    }
  })),
  BufferGeometry: jest.fn(() => ({
    setAttribute: jest.fn()
  })),
  Float32BufferAttribute: jest.fn(),
  PointsMaterial: jest.fn(() => ({
    color: 0xffffff,
    size: 0.1,
    transparent: true
  })),
  Points: jest.fn(() => ({
    userData: {}
  })),
  SphereGeometry: jest.fn(() => ({
    dispose: jest.fn()
  })),
  BoxGeometry: jest.fn(() => ({
    dispose: jest.fn()
  })),
  CylinderGeometry: jest.fn(() => ({
    dispose: jest.fn()
  })),
  PlaneGeometry: jest.fn(() => ({
    dispose: jest.fn()
  })),
  Mesh: jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() },
    rotation: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, copy: jest.fn() },
    scale: { x: 1, y: 1, z: 1, set: jest.fn() },
    visible: true,
    castShadow: false,
    receiveShadow: false,
    geometry: { dispose: jest.fn() },
    material: { dispose: jest.fn() }
  })),
  Line: jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0, set: jest.fn() },
    scale: { x: 1, y: 1, z: 1, set: jest.fn() },
    visible: true,
    geometry: { dispose: jest.fn() },
    material: { dispose: jest.fn() }
  }))
}));

// Mock performance API
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1048576,
      jsHeapSizeLimit: 100 * 1048576
    }
  }
});

describe('Window Resize Handling During Gameplay', () => {
  let game;
  let mockCamera;

  beforeEach(() => {
    // Set up window dimensions
    global.window.innerWidth = 1024;
    global.window.innerHeight = 768;

    // Mock all managers
    jest.doMock('../managers/DebugManager', () => ({
      DebugManager: jest.fn(() => ({
        init: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }))
    }));

    jest.doMock('../managers/EventManager', () => ({
      EventManager: jest.fn(() => ({
        init: jest.fn(),
        publish: jest.fn(),
        subscribe: jest.fn(() => () => {})
      }))
    }));

    jest.doMock('../managers/PerformanceManager', () => ({
      PerformanceManager: jest.fn(() => ({
        init: jest.fn(),
        beginFrame: jest.fn(),
        endFrame: jest.fn()
      }))
    }));

    jest.doMock('../managers/StateManager', () => ({
      StateManager: jest.fn(() => ({
        resetState: jest.fn(),
        getGameState: jest.fn(() => 'PLAYING')
      }))
    }));

    jest.doMock('../managers/UIManager', () => ({
      UIManager: jest.fn(() => ({
        init: jest.fn(),
        attachRenderer: jest.fn(),
        updateHoleInfo: jest.fn(),
        updateScore: jest.fn(),
        updateStrokes: jest.fn()
      }))
    }));

    jest.doMock('../managers/PhysicsManager', () => ({
      PhysicsManager: jest.fn(() => ({
        init: jest.fn(),
        getWorld: jest.fn(() => ({
          add: jest.fn(),
          step: jest.fn()
        }))
      }))
    }));

    jest.doMock('../managers/AudioManager', () => ({
      AudioManager: jest.fn(() => ({
        init: jest.fn(),
        sounds: {
          hit: { play: jest.fn(), stop: jest.fn() },
          success: { play: jest.fn(), stop: jest.fn() }
        },
        audioListener: {}
      }))
    }));

    jest.doMock('../managers/VisualEffectsManager', () => ({
      VisualEffectsManager: jest.fn(() => ({
        init: jest.fn()
      }))
    }));

    jest.doMock('../managers/BallManager', () => ({
      BallManager: jest.fn(() => ({
        init: jest.fn(),
        createBall: jest.fn()
      }))
    }));

    jest.doMock('../managers/HazardManager', () => ({
      HazardManager: jest.fn(() => ({
        init: jest.fn()
      }))
    }));

    jest.doMock('../managers/HoleStateManager', () => ({
      HoleStateManager: jest.fn(() => ({
        init: jest.fn()
      }))
    }));

    jest.doMock('../managers/HoleTransitionManager', () => ({
      HoleTransitionManager: jest.fn(() => ({
        init: jest.fn()
      }))
    }));

    jest.doMock('../managers/HoleCompletionManager', () => ({
      HoleCompletionManager: jest.fn(() => ({
        init: jest.fn()
      }))
    }));

    jest.doMock('../managers/GameLoopManager', () => ({
      GameLoopManager: jest.fn(() => ({
        init: jest.fn(),
        startLoop: jest.fn()
      }))
    }));

    jest.doMock('../objects/OrbitalDriftCourse', () => ({
      OrbitalDriftCourse: {
        create: jest.fn(async () => ({
          totalHoles: 9,
          currentHoleEntity: { config: { index: 0 } },
          getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0, z: 0 }))
        }))
      }
    }));

    jest.doMock('../objects/SpaceDecorations', () => ({
      SpaceDecorations: jest.fn(() => ({
        init: jest.fn()
      }))
    }));

    jest.doMock('../controls/InputController', () => ({
      InputController: jest.fn(() => ({
        init: jest.fn()
      }))
    }));

    mockCamera = {
      position: { x: 0, y: 0, z: 0, set: jest.fn() },
      rotation: { x: 0, y: 0, z: 0, set: jest.fn() },
      lookAt: jest.fn(),
      updateProjectionMatrix: jest.fn(),
      aspect: 1024 / 768,
      fov: 60,
      near: 0.1,
      far: 1000
    };

    jest.doMock('../controls/CameraController', () => ({
      CameraController: jest.fn(() => ({
        init: jest.fn(),
        camera: mockCamera,
        setRenderer: jest.fn(),
        setCourse: jest.fn(),
        positionCameraForHole: jest.fn(),
        handleResize: jest.fn(function () {
          if (mockCamera) {
            mockCamera.aspect = window.innerWidth / window.innerHeight;
            mockCamera.updateProjectionMatrix();
          }
        })
      }))
    }));

    jest.doMock('../game/ScoringSystem', () => ({
      ScoringSystem: jest.fn(() => ({}))
    }));

    // Create game instance
    const Game = require('../scenes/Game').Game;
    game = new Game();
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
  });

  test('renderer.setSize is called with new dimensions on window resize event', () => {
    const mockRenderer = { setSize: jest.fn() };
    game.renderer = mockRenderer;
    game.camera = mockCamera;

    // Simulate resize
    global.window.innerWidth = 1920;
    global.window.innerHeight = 1080;

    game.handleResize();

    expect(mockRenderer.setSize).toHaveBeenCalledWith(1920, 1080);
  });

  test('camera.aspect is updated and camera.updateProjectionMatrix is called on resize', () => {
    game.renderer = { setSize: jest.fn() };
    game.camera = mockCamera;

    // Simulate resize
    global.window.innerWidth = 1920;
    global.window.innerHeight = 1080;

    // Game.handleResize updates renderer; CameraController.handleResize updates camera
    game.handleResize();
    game.cameraController.handleResize();

    expect(mockCamera.aspect).toBe(1920 / 1080);
    expect(mockCamera.updateProjectionMatrix).toHaveBeenCalled();
  });

  test('no console errors when resize occurs during AIMING state', () => {
    game.renderer = { setSize: jest.fn() };
    game.camera = mockCamera;
    game.stateManager.getGameState.mockReturnValue('AIMING');

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    global.window.innerWidth = 800;
    global.window.innerHeight = 600;

    // Both resize handlers should execute without errors
    game.handleResize();
    game.cameraController.handleResize();

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test('no console errors when resize occurs during hole transition', () => {
    game.renderer = { setSize: jest.fn() };
    game.camera = mockCamera;
    game.stateManager.getGameState.mockReturnValue('HOLE_COMPLETED');

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    global.window.innerWidth = 1440;
    global.window.innerHeight = 900;

    game.handleResize();
    game.cameraController.handleResize();

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test('handleResize is safe when renderer is null', () => {
    game.renderer = null;
    game.camera = mockCamera;

    expect(() => game.handleResize()).not.toThrow();
  });

  test('handleResize is safe when camera is null', () => {
    game.renderer = { setSize: jest.fn() };
    game.camera = null;

    expect(() => game.handleResize()).not.toThrow();
    expect(game.renderer.setSize).not.toHaveBeenCalled();
  });
});
