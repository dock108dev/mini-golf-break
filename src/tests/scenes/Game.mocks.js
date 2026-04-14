const createMockManager = (extraMethods = {}) => ({
  init: jest.fn(),
  cleanup: jest.fn(),
  ...extraMethods
});

let mockGameState = 'playing';

const mocks = {
  debugManager: createMockManager({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }),
  eventManager: createMockManager({
    publish: jest.fn(),
    subscribe: jest.fn(() => () => {})
  }),
  performanceManager: createMockManager({
    beginFrame: jest.fn(),
    endFrame: jest.fn()
  }),
  stateManager: createMockManager({
    resetState: jest.fn(),
    getGameState: jest.fn(() => mockGameState),
    setGameState: jest.fn(state => {
      mockGameState = state;
    }),
    isInState: jest.fn(state => mockGameState === state)
  }),
  uiManager: createMockManager({
    attachRenderer: jest.fn(),
    updateHoleInfo: jest.fn(),
    updateScore: jest.fn(),
    updateStrokes: jest.fn(),
    showPauseOverlay: jest.fn(),
    hidePauseOverlay: jest.fn()
  }),
  physicsManager: createMockManager({
    getWorld: jest.fn(() => ({ add: jest.fn(), step: jest.fn() }))
  }),
  audioManager: createMockManager(),
  visualEffectsManager: createMockManager(),
  ballManager: createMockManager({ createBall: jest.fn() }),
  hazardManager: createMockManager({ setHoleBounds: jest.fn() }),
  holeStateManager: createMockManager(),
  holeTransitionManager: createMockManager(),
  holeCompletionManager: createMockManager(),
  gameLoopManager: createMockManager({
    startLoop: jest.fn(),
    stopLoop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn()
  }),
  stuckBallManager: createMockManager(),
  webGLContextManager: createMockManager(),
  cameraController: {
    init: jest.fn(),
    camera: { aspect: 1, updateProjectionMatrix: jest.fn() },
    setRenderer: jest.fn(),
    setCourse: jest.fn(),
    positionCameraForHole: jest.fn(),
    stopMenuOrbit: jest.fn(),
    cleanup: jest.fn()
  },
  inputController: {
    init: jest.fn(),
    enableInput: jest.fn(),
    disableInput: jest.fn(),
    cleanup: jest.fn(),
    isKeyboardAiming: false
  },
  scoringSystem: {
    setMaxStrokes: jest.fn(),
    getCurrentStrokes: jest.fn(() => 0)
  },
  course: {
    totalHoles: 9,
    currentHoleEntity: { config: { index: 0 } },
    getHoleStartPosition: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
    getCurrentHoleConfig: jest.fn(() => ({ par: 3, maxStrokes: 10 })),
    holeConfigs: [],
    getAllHolePars: jest.fn(() => [])
  }
};

function setMockGameState(state) {
  mockGameState = state;
}

function getMockGameState() {
  return mockGameState;
}

module.exports = { mocks, setMockGameState, getMockGameState };
