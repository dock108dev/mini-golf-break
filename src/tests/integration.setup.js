// Jest setup file specifically for integration tests
// This file contains mocks that should only be used in integration tests

// Import the base setup
import './setup.js';

// Create EventManager mock that actually publishes events
jest.mock('../managers/EventManager', () => {
  return {
    EventManager: jest.fn(function (game) {
      this.game = game;
      this.subscribers = new Map();
      this.enabled = true;

      this.init = jest.fn(() => {
        this.enabled = true;
        return this;
      });

      this.subscribe = jest.fn((eventType, callback, context = null) => {
        if (!this.subscribers.has(eventType)) {
          this.subscribers.set(eventType, []);
        }
        const subscriber = { callback, context };
        this.subscribers.get(eventType).push(subscriber);
        return () => this.unsubscribe(eventType, callback, context);
      });

      this.publish = jest.fn((eventType, data = {}) => {
        if (!this.enabled) {
          return;
        }

        const subscribers = this.subscribers.get(eventType) || [];
        subscribers.forEach(({ callback, context }) => {
          try {
            // Pass data directly as it's what the handlers expect
            callback.call(context, data);
          } catch (error) {
            console.error(`Error in event handler for ${eventType}:`, error);
          }
        });
      });

      this.unsubscribe = jest.fn((eventType, callback, context) => {
        const subscribers = this.subscribers.get(eventType);
        if (!subscribers) {
          return;
        }

        const index = subscribers.findIndex(
          sub => sub.callback === callback && sub.context === context
        );
        if (index > -1) {
          subscribers.splice(index, 1);
        }
      });

      this.cleanup = jest.fn(() => {
        this.subscribers.clear();
        this.enabled = false;
      });
    })
  };
});

// Mock StateManager to publish events
jest.mock('../managers/StateManager', () => {
  const { GameState } = require('../states/GameState');

  return {
    StateManager: jest.fn(function (game) {
      this.game = game;
      this.state = {
        currentGameState: GameState.INITIALIZING,
        previousGameState: null,
        ballInMotion: false,
        holeCompleted: false,
        resetBall: false
      };

      this.setGameState = jest.fn(newState => {
        const previousState = this.state.currentGameState;
        this.state.previousGameState = previousState;
        this.state.currentGameState = newState;

        // Publish state change event
        if (this.game && this.game.eventManager) {
          this.game.eventManager.publish('STATE_CHANGED', {
            previousState,
            newState
          });
        }
      });

      this.getGameState = jest.fn(() => this.state.currentGameState);
      this.setBallInMotion = jest.fn(inMotion => {
        this.state.ballInMotion = inMotion;
      });
      this.isBallInMotion = jest.fn(() => this.state.ballInMotion);
      this.setHoleCompleted = jest.fn(completed => {
        this.state.holeCompleted = completed;
      });
      this.isHoleCompleted = jest.fn(() => this.state.holeCompleted);
      this.setResetBall = jest.fn(reset => {
        this.state.resetBall = reset;
      });
      this.shouldResetBall = jest.fn(() => this.state.resetBall);
      this.clearResetBall = jest.fn(() => {
        this.state.resetBall = false;
      });
      this.resetState = jest.fn(() => {
        this.state = {
          currentGameState: GameState.INITIALIZING,
          previousGameState: null,
          ballInMotion: false,
          holeCompleted: false,
          resetBall: false
        };
      });
    })
  };
});

// Mock UIManager to handle state-based UI updates
jest.mock('../managers/UIManager', () => {
  const { GameState } = require('../states/GameState');

  return {
    UIManager: jest.fn(function (game) {
      this.game = game;
      this.renderer = null;

      // Define methods first so they exist when init is called
      this.showMessage = jest.fn();
      this.hideMessage = jest.fn();

      this.init = jest.fn(() => {
        // Create main container
        this.createMainContainer();

        // Create UI elements
        this.createMessageUI();
        this.createPowerIndicatorUI();

        // Initialize overlays
        this.scoreOverlay = {
          init: jest.fn(),
          updateHoleInfo: jest.fn(),
          updateScore: jest.fn(),
          updateStrokes: jest.fn(),
          showFinalScorecard: jest.fn(),
          hideFinalScorecard: jest.fn(),
          cleanup: jest.fn()
        };
        this.scoreOverlay.init();

        this.debugOverlay = {
          init: jest.fn(),
          updateDebugDisplay: jest.fn(),
          cleanup: jest.fn()
        };
        this.debugOverlay.init();

        // Subscribe to state changes
        const self = this; // Capture the correct 'this' context
        if (this.game && this.game.eventManager) {
          this.game.eventManager.subscribe('STATE_CHANGED', data => {
            // data is passed directly, not wrapped in event object
            const { newState } = data;
            switch (newState) {
              case GameState.AIMING:
                self.showMessage('Aim and click to shoot');
                break;
              case GameState.PLAYING:
                self.hideMessage();
                break;
              case GameState.HOLE_COMPLETED:
                self.showMessage('Hole Complete!');
                break;
            }
          });
        }

        return this;
      });

      this.attachRenderer = jest.fn(renderer => {
        if (!renderer || !renderer.domElement) {
          if (this.game && this.game.debugManager) {
            this.game.debugManager.warn(
              'UIManager.attachRenderer',
              'Invalid renderer or domElement'
            );
          }
          return;
        }

        this.renderer = renderer;

        // Find or create game container
        let gameContainer = global.document.getElementById('game-container');
        if (!gameContainer) {
          gameContainer = global.document.createElement('div');
          gameContainer.id = 'game-container';
          gameContainer.style.position = 'absolute';
          gameContainer.style.top = '0';
          gameContainer.style.left = '0';
          gameContainer.style.width = '100%';
          gameContainer.style.height = '100%';
          gameContainer.style.overflow = 'hidden';
          global.document.body.insertBefore(gameContainer, global.document.body.firstChild);
        }

        // Move renderer if it has a parent
        if (renderer.domElement.parentNode && renderer.domElement.parentNode !== gameContainer) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }

        // Append if not already a child
        if (renderer.domElement.parentNode !== gameContainer) {
          gameContainer.appendChild(renderer.domElement);
        }
      });
      this.updateHoleInfo = jest.fn();
      this.resetStrokes = jest.fn();
      this.createMessageUI = jest.fn(() => {
        if (this.uiContainer) {
          this.messageElement = global.document.createElement('div');
          this.messageElement.id = 'message-container';
          this.messageElement.classList.add('message-container');
          this.uiContainer.appendChild(this.messageElement);
        }
      });
      this.createPowerIndicatorUI = jest.fn(() => {
        if (this.uiContainer) {
          this.powerIndicator = global.document.createElement('div');
          this.powerIndicator.classList.add('power-indicator');
          const powerFill = global.document.createElement('div');
          powerFill.classList.add('power-indicator-fill');
          this.powerIndicator.appendChild(powerFill);
          this.uiContainer.appendChild(this.powerIndicator);
        }
      });
      this.createMainContainer = jest.fn(() => {
        // Check for existing containers
        this.uiContainer =
          global.document.getElementById('ui-container') ||
          global.document.getElementById('ui-overlay');

        if (!this.uiContainer) {
          // Create new container
          this.uiContainer = global.document.createElement('div');
          this.uiContainer.id = 'ui-container';
          this.uiContainer.classList.add('ui-container');
          global.document.body.appendChild(this.uiContainer);
        } else {
          // Clear existing contents
          this.uiContainer.innerHTML = '';
          while (this.uiContainer.firstChild) {
            this.uiContainer.removeChild(this.uiContainer.firstChild);
          }
        }
        return this.uiContainer;
      });
      this.cleanup = jest.fn(() => {
        // Remove DOM elements
        if (this.messageElement) {
          this.messageElement.remove();
        }
        if (this.powerIndicator) {
          this.powerIndicator.remove();
        }
        if (this.uiContainer) {
          this.uiContainer.remove();
        }

        // Nullify references
        this.messageElement = null;
        this.powerIndicator = null;
        this.uiContainer = null;
        this.scoreOverlay = null;
        this.debugOverlay = null;
      });
      this.uiContainer = null;
    })
  };
});
