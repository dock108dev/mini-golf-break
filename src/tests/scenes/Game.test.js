const { mocks, setMockGameState } = require('./Game.mocks');

jest.mock('three', () => ({
  Scene: jest.fn(() => ({ add: jest.fn(), remove: jest.fn(), background: null, children: [] })),
  WebGLRenderer: jest.fn(() => ({
    setSize: jest.fn(),
    setPixelRatio: jest.fn(),
    getPixelRatio: jest.fn(() => 1),
    setClearColor: jest.fn(),
    render: jest.fn(),
    dispose: jest.fn(),
    info: { reset: jest.fn() },
    shadowMap: { enabled: false, type: 'BasicShadowMap' }
  })),
  Clock: jest.fn(() => ({})),
  Color: jest.fn(),
  PCFSoftShadowMap: 'PCFSoftShadowMap',
  AmbientLight: jest.fn(() => ({ intensity: 1 })),
  DirectionalLight: jest.fn(() => ({
    position: { set: jest.fn() },
    castShadow: false,
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: { near: 0.5, far: 50, left: -20, right: 20, top: 20, bottom: -20 }
    }
  })),
  BufferGeometry: jest.fn(() => ({ setAttribute: jest.fn() })),
  Float32BufferAttribute: jest.fn(),
  PointsMaterial: jest.fn(() => ({})),
  Points: jest.fn(() => ({ userData: {} })),
  PerspectiveCamera: jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    lookAt: jest.fn(),
    updateProjectionMatrix: jest.fn(),
    aspect: 1
  })),
  Vector3: jest.fn(() => ({ x: 0, y: 0, z: 0, set: jest.fn() }))
}));

jest.mock('../../utils/debug', () => ({ debug: { log: jest.fn() } }));
jest.mock('../../utils/CannonDebugRenderer', () => ({ CannonDebugRenderer: jest.fn(() => ({})) }));
jest.mock('../../utils/holeValidator', () => ({ validateCourse: jest.fn() }));
jest.mock('../../mechanics/MechanicRegistry', () => ({ getRegisteredTypes: jest.fn(() => []) }));
jest.mock('../../utils/parCalibration', () => ({
  initCalibration: jest.fn(),
  isCalibrationActive: jest.fn(() => false),
  recordHoleStrokes: jest.fn(),
  showCalibrationOverlay: jest.fn()
}));

jest.mock('../../managers/DebugManager', () => ({
  DebugManager: jest.fn(() => mocks.debugManager)
}));
jest.mock('../../managers/EventManager', () => ({
  EventManager: jest.fn(() => mocks.eventManager)
}));
jest.mock('../../managers/PerformanceManager', () => ({
  PerformanceManager: jest.fn(() => mocks.performanceManager)
}));
jest.mock('../../managers/StateManager', () => ({
  StateManager: jest.fn(() => mocks.stateManager)
}));
jest.mock('../../managers/UIManager', () => ({ UIManager: jest.fn(() => mocks.uiManager) }));
jest.mock('../../managers/PhysicsManager', () => ({
  PhysicsManager: jest.fn(() => mocks.physicsManager)
}));
jest.mock('../../managers/AudioManager', () => ({
  AudioManager: jest.fn(() => mocks.audioManager)
}));
jest.mock('../../managers/VisualEffectsManager', () => ({
  VisualEffectsManager: jest.fn(() => mocks.visualEffectsManager)
}));
jest.mock('../../managers/BallManager', () => ({ BallManager: jest.fn(() => mocks.ballManager) }));
jest.mock('../../managers/HazardManager', () => ({
  HazardManager: jest.fn(() => mocks.hazardManager)
}));
jest.mock('../../managers/HoleStateManager', () => ({
  HoleStateManager: jest.fn(() => mocks.holeStateManager)
}));
jest.mock('../../managers/HoleTransitionManager', () => ({
  HoleTransitionManager: jest.fn(() => mocks.holeTransitionManager)
}));
jest.mock('../../managers/HoleCompletionManager', () => ({
  HoleCompletionManager: jest.fn(() => mocks.holeCompletionManager)
}));
jest.mock('../../managers/GameLoopManager', () => ({
  GameLoopManager: jest.fn(() => mocks.gameLoopManager)
}));
jest.mock('../../managers/StuckBallManager', () => ({
  StuckBallManager: jest.fn(() => mocks.stuckBallManager)
}));
jest.mock('../../managers/WebGLContextManager', () => ({
  WebGLContextManager: jest.fn(() => mocks.webGLContextManager)
}));
jest.mock('../../controls/CameraController', () => ({
  CameraController: jest.fn(() => mocks.cameraController)
}));
jest.mock('../../controls/InputController', () => ({
  InputController: jest.fn(() => mocks.inputController)
}));
jest.mock('../../game/ScoringSystem', () => ({
  ScoringSystem: jest.fn(() => mocks.scoringSystem)
}));
jest.mock('../../objects/OrbitalDriftCourse', () => ({
  OrbitalDriftCourse: { create: jest.fn(async () => mocks.course) }
}));
jest.mock('../../objects/SpaceDecorations', () => ({
  SpaceDecorations: jest.fn(() => ({ init: jest.fn() }))
}));

const { Game } = require('../../scenes/Game');
const { EventTypes } = require('../../events/EventTypes');
const { GameState } = require('../../states/GameState');

describe('Game — orchestrator lifecycle and pause/resume', () => {
  let game;

  beforeEach(() => {
    jest.clearAllMocks();
    setMockGameState(GameState.PLAYING);
    mocks.inputController.isKeyboardAiming = false;
    global.window.addEventListener = jest.fn();
    global.window.removeEventListener = jest.fn();
    global.window.innerWidth = 800;
    global.window.innerHeight = 600;
    game = new Game();
  });

  describe('initVisuals()', () => {
    it('creates renderer and configures shadow map', async () => {
      await game.initVisuals();
      expect(game.renderer).toBeDefined();
      expect(game.renderer.setSize).toHaveBeenCalledWith(800, 600);
      expect(game.renderer.shadowMap.enabled).toBe(true);
      expect(game.renderer.setClearColor).toHaveBeenCalledWith(0x000000);
    });

    it('initializes managers in correct order', async () => {
      const order = [];
      mocks.webGLContextManager.init.mockImplementation(() => order.push('webgl'));
      mocks.debugManager.init.mockImplementation(() => order.push('debug'));
      mocks.eventManager.init.mockImplementation(() => order.push('event'));
      mocks.performanceManager.init.mockImplementation(() => order.push('perf'));
      mocks.stateManager.resetState.mockImplementation(() => order.push('state'));
      mocks.uiManager.init.mockImplementation(() => order.push('ui'));
      mocks.uiManager.attachRenderer.mockImplementation(() => order.push('uiAttach'));
      mocks.cameraController.init.mockImplementation(() => order.push('camInit'));
      mocks.gameLoopManager.init.mockImplementation(() => order.push('loopInit'));
      mocks.gameLoopManager.startLoop.mockImplementation(() => order.push('loopStart'));

      await game.initVisuals();

      expect(order.indexOf('webgl')).toBeLessThan(order.indexOf('debug'));
      expect(order.indexOf('debug')).toBeLessThan(order.indexOf('perf'));
      expect(order.indexOf('event')).toBeLessThan(order.indexOf('perf'));
      expect(order.indexOf('state')).toBeLessThan(order.indexOf('ui'));
      expect(order.indexOf('ui')).toBeLessThan(order.indexOf('uiAttach'));
      expect(order.indexOf('camInit')).toBeLessThan(order.indexOf('loopInit'));
      expect(order.indexOf('loopInit')).toBeLessThan(order.indexOf('loopStart'));
    });

    it('calls setupLights and createStarfield', async () => {
      await game.initVisuals();
      const THREE = require('three');
      expect(THREE.AmbientLight).toHaveBeenCalled();
      expect(THREE.DirectionalLight).toHaveBeenCalled();
      expect(THREE.BufferGeometry).toHaveBeenCalled();
      expect(THREE.Points).toHaveBeenCalled();
      expect(game.scene.add).toHaveBeenCalled();
    });

    it('starts game loop for menu backdrop', async () => {
      await game.initVisuals();
      expect(mocks.gameLoopManager.init).toHaveBeenCalled();
      expect(mocks.gameLoopManager.startLoop).toHaveBeenCalled();
    });

    it('registers window resize listener', async () => {
      await game.initVisuals();
      expect(global.window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('propagates error if renderer creation fails', async () => {
      require('three').WebGLRenderer.mockImplementationOnce(() => {
        throw new Error('WebGL not supported');
      });
      await expect(game.initVisuals()).rejects.toThrow('WebGL not supported');
    });
  });

  describe('startGame()', () => {
    beforeEach(async () => {
      await game.initVisuals();
      jest.clearAllMocks();
      setMockGameState(GameState.PLAYING);
    });

    it('initializes physics before ball and input', async () => {
      const order = [];
      mocks.physicsManager.init.mockImplementation(() => order.push('physics'));
      mocks.ballManager.init.mockImplementation(() => order.push('ball'));
      await game.startGame();
      expect(order.indexOf('physics')).toBeLessThan(order.indexOf('ball'));
      expect(game.inputController).toBeDefined();
    });

    it('stops menu orbit before gameplay init', async () => {
      await game.startGame();
      expect(mocks.cameraController.stopMenuOrbit).toHaveBeenCalled();
    });

    it('initializes managers in correct order', async () => {
      const order = [];
      mocks.physicsManager.init.mockImplementation(() => order.push('physics'));
      mocks.holeCompletionManager.init.mockImplementation(() => order.push('holeCompletion'));
      mocks.ballManager.init.mockImplementation(() => order.push('ball'));
      mocks.stuckBallManager.init.mockImplementation(() => order.push('stuckBall'));
      await game.startGame();
      expect(order.indexOf('physics')).toBeLessThan(order.indexOf('ball'));
      expect(order.indexOf('holeCompletion')).toBeLessThan(order.indexOf('ball'));
      expect(order.indexOf('ball')).toBeLessThan(order.indexOf('stuckBall'));
    });

    it('emits GAME_STARTED and GAME_INITIALIZED events', async () => {
      await game.startGame();
      expect(mocks.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.GAME_STARTED,
        expect.objectContaining({ timestamp: expect.any(Number) }),
        game
      );
      expect(mocks.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.GAME_INITIALIZED,
        expect.objectContaining({ timestamp: expect.any(Number) }),
        game
      );
    });

    it('emits GAME_STARTED before GAME_INITIALIZED', async () => {
      const events = [];
      mocks.eventManager.publish.mockImplementation(type => events.push(type));
      await game.startGame();
      expect(events.indexOf(EventTypes.GAME_STARTED)).toBeLessThan(
        events.indexOf(EventTypes.GAME_INITIALIZED)
      );
    });

    it('sets game state to PLAYING', async () => {
      await game.startGame();
      expect(mocks.stateManager.setGameState).toHaveBeenCalledWith(GameState.PLAYING);
    });

    it('does not throw on manager init failure and logs error', async () => {
      mocks.physicsManager.init.mockImplementation(() => {
        throw new Error('Physics init failed');
      });
      await expect(game.startGame()).resolves.toBeUndefined();
      expect(mocks.debugManager.error).toHaveBeenCalledWith(
        'Game.startGame',
        'Failed to start game',
        expect.any(Error),
        true
      );
    });
  });

  describe('init()', () => {
    it('calls initVisuals then startGame in order', async () => {
      const order = [];
      const origVisuals = game.initVisuals.bind(game);
      const origStart = game.startGame.bind(game);
      game.initVisuals = jest.fn(async () => {
        order.push('initVisuals');
        await origVisuals();
      });
      game.startGame = jest.fn(async () => {
        order.push('startGame');
        await origStart();
      });
      await game.init();
      expect(order).toEqual(['initVisuals', 'startGame']);
    });
  });

  describe('pauseGame()', () => {
    beforeEach(() => {
      game.inputController = mocks.inputController;
      setMockGameState(GameState.PLAYING);
    });

    it('sets state to PAUSED and stops game loop', () => {
      game.pauseGame();
      expect(mocks.stateManager.setGameState).toHaveBeenCalledWith(GameState.PAUSED);
      expect(mocks.gameLoopManager.pause).toHaveBeenCalled();
    });

    it('emits GAME_PAUSED event with source', () => {
      game.pauseGame();
      expect(mocks.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.GAME_PAUSED,
        expect.objectContaining({ timestamp: expect.any(Number) }),
        game
      );
    });

    it('disables input and shows pause overlay', () => {
      game.pauseGame();
      expect(mocks.inputController.disableInput).toHaveBeenCalled();
      expect(mocks.uiManager.showPauseOverlay).toHaveBeenCalled();
    });

    it('stores pre-pause state for resume', () => {
      game.pauseGame();
      expect(game.prePauseState).toBe(GameState.PLAYING);
    });

    it('works when in AIMING state', () => {
      setMockGameState(GameState.AIMING);
      game.pauseGame();
      expect(mocks.stateManager.setGameState).toHaveBeenCalledWith(GameState.PAUSED);
      expect(game.prePauseState).toBe(GameState.AIMING);
    });

    it('is a no-op if already paused', () => {
      setMockGameState(GameState.PAUSED);
      game.pauseGame();
      expect(mocks.stateManager.setGameState).not.toHaveBeenCalled();
      expect(mocks.gameLoopManager.pause).not.toHaveBeenCalled();
    });

    it('is a no-op if game is completed', () => {
      setMockGameState(GameState.GAME_COMPLETED);
      game.pauseGame();
      expect(mocks.stateManager.setGameState).not.toHaveBeenCalled();
    });

    it('calling pauseGame twice only pauses once', () => {
      game.pauseGame();
      jest.clearAllMocks();
      game.pauseGame();
      expect(mocks.stateManager.setGameState).not.toHaveBeenCalled();
    });
  });

  describe('resumeGame()', () => {
    beforeEach(() => {
      game.inputController = mocks.inputController;
      setMockGameState(GameState.PAUSED);
      game.prePauseState = GameState.PLAYING;
    });

    it('restores pre-pause state and resumes loop', () => {
      game.resumeGame();
      expect(mocks.stateManager.setGameState).toHaveBeenCalledWith(GameState.PLAYING);
      expect(mocks.gameLoopManager.resume).toHaveBeenCalled();
    });

    it('emits GAME_RESUMED event with source', () => {
      game.resumeGame();
      expect(mocks.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.GAME_RESUMED,
        expect.objectContaining({ timestamp: expect.any(Number) }),
        game
      );
    });

    it('enables input and hides pause overlay', () => {
      game.resumeGame();
      expect(mocks.inputController.enableInput).toHaveBeenCalled();
      expect(mocks.uiManager.hidePauseOverlay).toHaveBeenCalled();
    });

    it('is a no-op if not paused', () => {
      setMockGameState(GameState.PLAYING);
      game.resumeGame();
      expect(mocks.stateManager.setGameState).not.toHaveBeenCalled();
    });

    it('restores AIMING state if paused during aiming', () => {
      game.prePauseState = GameState.AIMING;
      game.resumeGame();
      expect(mocks.stateManager.setGameState).toHaveBeenCalledWith(GameState.AIMING);
    });

    it('clears prePauseState after resume', () => {
      game.resumeGame();
      expect(game.prePauseState).toBeNull();
    });

    it('defaults to PLAYING if prePauseState is null', () => {
      game.prePauseState = null;
      game.resumeGame();
      expect(mocks.stateManager.setGameState).toHaveBeenCalledWith(GameState.PLAYING);
    });
  });

  describe('handlePauseKey()', () => {
    beforeEach(() => {
      game.inputController = mocks.inputController;
      setMockGameState(GameState.PLAYING);
    });

    it('pauses game on Escape key when PLAYING', () => {
      game.handlePauseKey({ key: 'Escape' });
      expect(mocks.stateManager.setGameState).toHaveBeenCalledWith(GameState.PAUSED);
    });

    it('resumes game on Escape key when PAUSED', () => {
      setMockGameState(GameState.PAUSED);
      game.prePauseState = GameState.PLAYING;
      game.handlePauseKey({ key: 'Escape' });
      expect(mocks.stateManager.setGameState).toHaveBeenCalledWith(GameState.PLAYING);
    });

    it('ignores non-Escape keys', () => {
      game.handlePauseKey({ key: 'Enter' });
      game.handlePauseKey({ key: ' ' });
      expect(mocks.stateManager.setGameState).not.toHaveBeenCalled();
    });

    it('does not pause when in keyboard aiming mode', () => {
      mocks.inputController.isKeyboardAiming = true;
      game.handlePauseKey({ key: 'Escape' });
      expect(mocks.gameLoopManager.pause).not.toHaveBeenCalled();
    });

    it('pauses when in AIMING state', () => {
      setMockGameState(GameState.AIMING);
      game.handlePauseKey({ key: 'Escape' });
      expect(mocks.stateManager.setGameState).toHaveBeenCalledWith(GameState.PAUSED);
    });
  });

  describe('handleResize()', () => {
    it('updates renderer size', async () => {
      await game.initVisuals();
      jest.clearAllMocks();
      global.window.innerWidth = 1024;
      global.window.innerHeight = 768;
      game.handleResize();
      expect(game.renderer.setSize).toHaveBeenCalledWith(1024, 768);
    });

    it('is safe when renderer is null', () => {
      game.renderer = null;
      game.camera = null;
      expect(() => game.handleResize()).not.toThrow();
    });
  });

  describe('cleanup()', () => {
    beforeEach(() => {
      game.inputController = mocks.inputController;
      game.renderer = { setSize: jest.fn(), dispose: jest.fn() };
      game.boundHandleResize = jest.fn();
      game.boundHandlePauseKey = jest.fn();
    });

    it('stops game loop first', () => {
      game.cleanup();
      expect(mocks.gameLoopManager.stopLoop).toHaveBeenCalled();
    });

    it('cleans up all managers', () => {
      game.cleanup();
      [
        'gameLoopManager',
        'webGLContextManager',
        'ballManager',
        'holeCompletionManager',
        'hazardManager',
        'audioManager',
        'physicsManager',
        'visualEffectsManager',
        'cameraController',
        'uiManager',
        'stateManager',
        'performanceManager',
        'stuckBallManager',
        'eventManager',
        'debugManager'
      ].forEach(name => expect(mocks[name].cleanup).toHaveBeenCalled());
    });

    it('removes window event listeners', () => {
      game.cleanup();
      expect(global.window.removeEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      );
      expect(global.window.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('disposes renderer and nulls references', () => {
      game.cleanup();
      expect(game.renderer).toBeNull();
      expect(game.camera).toBeNull();
      expect(game.scene).toBeNull();
    });

    it('does not throw when called twice', () => {
      game.cleanup();
      expect(() => game.cleanup()).not.toThrow();
    });

    it('cleans up event and debug managers last', () => {
      const order = [];
      mocks.ballManager.cleanup.mockImplementation(() => order.push('ball'));
      mocks.physicsManager.cleanup.mockImplementation(() => order.push('physics'));
      mocks.eventManager.cleanup.mockImplementation(() => order.push('event'));
      mocks.debugManager.cleanup.mockImplementation(() => order.push('debug'));
      game.cleanup();
      expect(order.indexOf('event')).toBeGreaterThan(order.indexOf('ball'));
      expect(order.indexOf('event')).toBeGreaterThan(order.indexOf('physics'));
      expect(order.indexOf('debug')).toBeGreaterThan(order.indexOf('event'));
    });
  });
});
