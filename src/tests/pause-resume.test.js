/**
 * Tests for pause/resume functionality (ISSUE-059)
 */

import { GameState } from '../states/GameState';
import { EventTypes } from '../events/EventTypes';
import { GameLoopManager } from '../managers/GameLoopManager';

jest.mock('../utils/navigation', () => ({
  reloadPage: jest.fn()
}));

describe('Pause/Resume Functionality', () => {
  describe('GameState', () => {
    test('should include PAUSED state', () => {
      expect(GameState.PAUSED).toBe('paused');
    });
  });

  describe('EventTypes', () => {
    test('should include GAME_PAUSED event', () => {
      expect(EventTypes.GAME_PAUSED).toBe('game:paused');
    });

    test('should include GAME_RESUMED event', () => {
      expect(EventTypes.GAME_RESUMED).toBe('game:resumed');
    });
  });

  describe('GameLoopManager pause/resume', () => {
    let mockGame;
    let gameLoopManager;

    beforeEach(() => {
      global.requestAnimationFrame = jest.fn(() => 1);
      global.cancelAnimationFrame = jest.fn();

      mockGame = {
        renderer: { render: jest.fn() },
        scene: {},
        camera: {},
        clock: { getDelta: jest.fn(() => 0.016) },
        performanceManager: {
          beginFrame: jest.fn(),
          endFrame: jest.fn(),
          startTimer: jest.fn(),
          endTimer: jest.fn()
        }
      };

      gameLoopManager = new GameLoopManager(mockGame);
      gameLoopManager.init();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should initialize with isPaused false', () => {
      expect(gameLoopManager.isPaused).toBe(false);
    });

    test('pause should stop the loop and set isPaused', () => {
      gameLoopManager.startLoop();
      expect(gameLoopManager.isRunning).toBe(true);

      gameLoopManager.pause();

      expect(gameLoopManager.isPaused).toBe(true);
      expect(gameLoopManager.isRunning).toBe(false);
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    test('resume should restart the loop and clear isPaused', () => {
      gameLoopManager.startLoop();
      gameLoopManager.pause();

      global.requestAnimationFrame.mockClear();
      gameLoopManager.resume();

      expect(gameLoopManager.isPaused).toBe(false);
      expect(gameLoopManager.isRunning).toBe(true);
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    test('pause should not do anything if loop is not running', () => {
      gameLoopManager.pause();
      expect(gameLoopManager.isPaused).toBe(false);
    });

    test('pause should not double-pause', () => {
      gameLoopManager.startLoop();
      gameLoopManager.pause();

      const cancelCount = global.cancelAnimationFrame.mock.calls.length;
      gameLoopManager.pause();

      expect(global.cancelAnimationFrame.mock.calls.length).toBe(cancelCount);
    });

    test('resume should not do anything if not paused', () => {
      gameLoopManager.startLoop();
      const rafCount = global.requestAnimationFrame.mock.calls.length;

      gameLoopManager.resume();

      // Should not call requestAnimationFrame again
      expect(global.requestAnimationFrame.mock.calls.length).toBe(rafCount);
    });

    test('pause should return the manager instance', () => {
      gameLoopManager.startLoop();
      const result = gameLoopManager.pause();
      expect(result).toBe(gameLoopManager);
    });

    test('resume should return the manager instance', () => {
      gameLoopManager.startLoop();
      gameLoopManager.pause();
      const result = gameLoopManager.resume();
      expect(result).toBe(gameLoopManager);
    });
  });

  describe('Game pause/resume integration', () => {
    let mockGame;

    function createMockGame(initialState = GameState.PLAYING) {
      let currentState = initialState;
      const eventLog = [];

      const game = {
        stateManager: {
          getGameState: jest.fn(() => currentState),
          setGameState: jest.fn(state => {
            currentState = state;
          }),
          isInState: jest.fn(state => currentState === state)
        },
        gameLoopManager: {
          pause: jest.fn(),
          resume: jest.fn()
        },
        inputController: {
          enableInput: jest.fn(),
          disableInput: jest.fn(),
          isKeyboardAiming: false
        },
        uiManager: {
          showPauseOverlay: jest.fn(),
          hidePauseOverlay: jest.fn()
        },
        eventManager: {
          publish: jest.fn((type, data) => eventLog.push({ type, data }))
        },
        debugManager: {
          log: jest.fn()
        },
        prePauseState: null,
        eventLog
      };

      // Import and bind the methods from Game class
      const { Game } = require('../scenes/Game');
      game.pauseGame = Game.prototype.pauseGame.bind(game);
      game.resumeGame = Game.prototype.resumeGame.bind(game);
      game.handlePauseKey = Game.prototype.handlePauseKey.bind(game);
      game.quitToMenu = Game.prototype.quitToMenu.bind(game);

      return game;
    }

    test('pauseGame should transition from PLAYING to PAUSED', () => {
      mockGame = createMockGame(GameState.PLAYING);
      mockGame.pauseGame();

      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.PAUSED);
      expect(mockGame.gameLoopManager.pause).toHaveBeenCalled();
      expect(mockGame.inputController.disableInput).toHaveBeenCalled();
      expect(mockGame.uiManager.showPauseOverlay).toHaveBeenCalled();
      expect(mockGame.prePauseState).toBe(GameState.PLAYING);
    });

    test('pauseGame should transition from AIMING to PAUSED', () => {
      mockGame = createMockGame(GameState.AIMING);
      mockGame.pauseGame();

      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.PAUSED);
      expect(mockGame.prePauseState).toBe(GameState.AIMING);
    });

    test('pauseGame should not pause during HOLE_COMPLETED', () => {
      mockGame = createMockGame(GameState.HOLE_COMPLETED);
      mockGame.pauseGame();

      expect(mockGame.stateManager.setGameState).not.toHaveBeenCalled();
    });

    test('pauseGame should not pause during GAME_COMPLETED', () => {
      mockGame = createMockGame(GameState.GAME_COMPLETED);
      mockGame.pauseGame();

      expect(mockGame.stateManager.setGameState).not.toHaveBeenCalled();
    });

    test('pauseGame should not pause during INITIALIZING', () => {
      mockGame = createMockGame(GameState.INITIALIZING);
      mockGame.pauseGame();

      expect(mockGame.stateManager.setGameState).not.toHaveBeenCalled();
    });

    test('pauseGame should publish GAME_PAUSED event', () => {
      mockGame = createMockGame(GameState.PLAYING);
      mockGame.pauseGame();

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.GAME_PAUSED,
        expect.objectContaining({ timestamp: expect.any(Number) }),
        mockGame
      );
    });

    test('resumeGame should restore previous state', () => {
      mockGame = createMockGame(GameState.PLAYING);
      mockGame.pauseGame();

      // Now state is PAUSED
      mockGame.stateManager.isInState.mockImplementation(state => state === GameState.PAUSED);
      mockGame.resumeGame();

      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.PLAYING);
      expect(mockGame.gameLoopManager.resume).toHaveBeenCalled();
      expect(mockGame.inputController.enableInput).toHaveBeenCalled();
      expect(mockGame.uiManager.hidePauseOverlay).toHaveBeenCalled();
    });

    test('resumeGame should restore AIMING state if paused from AIMING', () => {
      mockGame = createMockGame(GameState.AIMING);
      mockGame.pauseGame();

      mockGame.stateManager.isInState.mockImplementation(state => state === GameState.PAUSED);
      mockGame.resumeGame();

      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.AIMING);
    });

    test('resumeGame should not do anything if not paused', () => {
      mockGame = createMockGame(GameState.PLAYING);
      mockGame.resumeGame();

      expect(mockGame.gameLoopManager.resume).not.toHaveBeenCalled();
    });

    test('resumeGame should publish GAME_RESUMED event', () => {
      mockGame = createMockGame(GameState.PLAYING);
      mockGame.pauseGame();

      mockGame.stateManager.isInState.mockImplementation(state => state === GameState.PAUSED);
      mockGame.eventManager.publish.mockClear();
      mockGame.resumeGame();

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.GAME_RESUMED,
        expect.objectContaining({ timestamp: expect.any(Number) }),
        mockGame
      );
    });

    test('resumeGame should clear prePauseState', () => {
      mockGame = createMockGame(GameState.PLAYING);
      mockGame.pauseGame();

      mockGame.stateManager.isInState.mockImplementation(state => state === GameState.PAUSED);
      mockGame.resumeGame();

      expect(mockGame.prePauseState).toBeNull();
    });

    describe('handlePauseKey', () => {
      test('Escape key should pause when PLAYING', () => {
        mockGame = createMockGame(GameState.PLAYING);
        mockGame.handlePauseKey({ key: 'Escape' });

        expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.PAUSED);
      });

      test('Escape key should pause when AIMING', () => {
        mockGame = createMockGame(GameState.AIMING);
        mockGame.handlePauseKey({ key: 'Escape' });

        expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.PAUSED);
      });

      test('Escape key should resume when PAUSED', () => {
        mockGame = createMockGame(GameState.PLAYING);
        mockGame.pauseGame();

        mockGame.stateManager.isInState.mockImplementation(state => state === GameState.PAUSED);
        mockGame.stateManager.getGameState.mockReturnValue(GameState.PAUSED);
        mockGame.handlePauseKey({ key: 'Escape' });

        expect(mockGame.gameLoopManager.resume).toHaveBeenCalled();
      });

      test('should not pause when keyboard aiming is active', () => {
        mockGame = createMockGame(GameState.PLAYING);
        mockGame.inputController.isKeyboardAiming = true;
        mockGame.handlePauseKey({ key: 'Escape' });

        expect(mockGame.stateManager.setGameState).not.toHaveBeenCalled();
      });

      test('should ignore non-Escape keys', () => {
        mockGame = createMockGame(GameState.PLAYING);
        mockGame.handlePauseKey({ key: 'p' });

        expect(mockGame.stateManager.setGameState).not.toHaveBeenCalled();
      });

      test('should not pause during HOLE_COMPLETED', () => {
        mockGame = createMockGame(GameState.HOLE_COMPLETED);
        mockGame.handlePauseKey({ key: 'Escape' });

        expect(mockGame.stateManager.setGameState).not.toHaveBeenCalled();
      });
    });

    describe('quitToMenu', () => {
      afterEach(() => {
        delete window.App;
      });

      test('should hide pause overlay and call App.returnToMenu', () => {
        mockGame = createMockGame(GameState.PLAYING);
        mockGame.pauseGame();
        mockGame.stateManager.isInState.mockImplementation(state => state === GameState.PAUSED);

        const mockReturnToMenu = jest.fn();
        window.App = { returnToMenu: mockReturnToMenu };

        mockGame.quitToMenu();

        expect(mockGame.uiManager.hidePauseOverlay).toHaveBeenCalled();
        expect(mockReturnToMenu).toHaveBeenCalled();
        expect(mockGame.prePauseState).toBeNull();
      });

      test('should fallback to reload when App is not available', () => {
        const { reloadPage } = require('../utils/navigation');
        mockGame = createMockGame(GameState.PLAYING);

        mockGame.quitToMenu();

        expect(reloadPage).toHaveBeenCalled();
      });

      test('should clear prePauseState', () => {
        mockGame = createMockGame(GameState.PLAYING);
        mockGame.pauseGame();
        mockGame.stateManager.isInState.mockImplementation(state => state === GameState.PAUSED);

        window.App = { returnToMenu: jest.fn() };
        mockGame.quitToMenu();

        expect(mockGame.prePauseState).toBeNull();
      });
    });
  });

  describe('UIManager pause overlay', () => {
    let uiManager;
    let mockGame;

    beforeEach(() => {
      // Set up DOM
      document.body.innerHTML = '';

      mockGame = {
        eventManager: {
          subscribe: jest.fn(() => jest.fn()),
          publish: jest.fn()
        },
        debugManager: {
          log: jest.fn(),
          warn: jest.fn(),
          error: jest.fn()
        },
        scoringSystem: {
          getTotalStrokes: jest.fn(() => 0),
          getCurrentStrokes: jest.fn(() => 0),
          getHoleScores: jest.fn(() => [])
        },
        course: {
          getCurrentHoleNumber: jest.fn(() => 1),
          getCurrentHoleConfig: jest.fn(() => ({ description: 'Test Hole' }))
        },
        courseName: 'Test Course',
        pauseGame: jest.fn(),
        resumeGame: jest.fn(),
        quitToMenu: jest.fn()
      };

      const { UIManager } = require('../managers/UIManager');
      uiManager = new UIManager(mockGame);
      uiManager.init();
    });

    afterEach(() => {
      uiManager.cleanup();
      document.body.innerHTML = '';
    });

    test('should create pause overlay element', () => {
      expect(uiManager.pauseOverlay).toBeTruthy();
      expect(uiManager.pauseOverlay.classList.contains('pause-overlay')).toBe(true);
    });

    test('should create pause overlay with content children', () => {
      const overlay = uiManager.pauseOverlay;
      expect(overlay).toBeTruthy();
      // overlay -> content div -> [title, button]
      const content = overlay.children[0];
      expect(content).toBeTruthy();
      expect(content.classList.contains('pause-content')).toBe(true);
      // Title
      const title = content.children[0];
      expect(title.textContent).toBe('Paused');
      expect(title.classList.contains('pause-title')).toBe(true);
      // Resume button
      const button = content.children[1];
      expect(button.textContent).toBe('Resume');
      expect(button.classList.contains('pause-resume-button')).toBe(true);
    });

    test('Resume button click should call game.resumeGame', () => {
      // Navigate: overlay -> content -> button (index 1)
      const content = uiManager.pauseOverlay.children[0];
      const button = content.children[1];
      button.click();
      expect(mockGame.resumeGame).toHaveBeenCalled();
    });

    test('should create Quit to Menu button in pause overlay', () => {
      const content = uiManager.pauseOverlay.children[0];
      const quitButton = content.children[2];
      expect(quitButton.textContent).toBe('Quit to Menu');
      expect(quitButton.classList.contains('pause-quit-button')).toBe(true);
    });

    test('Quit to Menu button click should call game.quitToMenu', () => {
      const content = uiManager.pauseOverlay.children[0];
      const quitButton = content.children[2];
      quitButton.click();
      expect(mockGame.quitToMenu).toHaveBeenCalled();
    });

    test('should create mobile pause button', () => {
      expect(uiManager.pauseButton).toBeTruthy();
      expect(uiManager.pauseButton.classList.contains('pause-button')).toBe(true);
    });

    test('mobile pause button should call game.pauseGame', () => {
      uiManager.pauseButton.click();
      expect(mockGame.pauseGame).toHaveBeenCalled();
    });

    test('showPauseOverlay should add visible class', () => {
      uiManager.showPauseOverlay();
      expect(uiManager.pauseOverlay.classList.contains('visible')).toBe(true);
    });

    test('showPauseOverlay should hide pause button', () => {
      uiManager.showPauseOverlay();
      expect(uiManager.pauseButton.style.display).toBe('none');
    });

    test('hidePauseOverlay should remove visible class', () => {
      uiManager.showPauseOverlay();
      expect(uiManager.pauseOverlay.classList.add).toHaveBeenCalledWith('visible');

      uiManager.hidePauseOverlay();
      expect(uiManager.pauseOverlay.classList.remove).toHaveBeenCalledWith('visible');
    });

    test('hidePauseOverlay should restore pause button', () => {
      uiManager.showPauseOverlay();
      uiManager.hidePauseOverlay();
      expect(uiManager.pauseButton.style.display).toBe('');
    });

    test('cleanup should remove pause overlay', () => {
      const overlay = uiManager.pauseOverlay;
      uiManager.cleanup();
      expect(uiManager.pauseOverlay).toBeNull();
      expect(overlay.parentNode).toBeNull();
    });

    test('cleanup should remove pause button', () => {
      const button = uiManager.pauseButton;
      uiManager.cleanup();
      expect(uiManager.pauseButton).toBeNull();
      expect(button.parentNode).toBeNull();
    });

    test('cleanup should clear quitButton reference', () => {
      uiManager.cleanup();
      expect(uiManager.quitButton).toBeNull();
    });

    test('showPauseOverlay should handle missing overlay gracefully', () => {
      uiManager.pauseOverlay = null;
      expect(() => uiManager.showPauseOverlay()).not.toThrow();
    });

    test('hidePauseOverlay should handle missing overlay gracefully', () => {
      uiManager.pauseOverlay = null;
      expect(() => uiManager.hidePauseOverlay()).not.toThrow();
    });
  });
});
