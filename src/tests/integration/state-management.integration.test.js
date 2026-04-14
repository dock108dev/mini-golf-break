/**
 * Integration tests for State Management
 * Tests how state changes propagate across different managers
 */

import { StateManager } from '../../managers/StateManager';
import { EventManager } from '../../managers/EventManager';
import { BallManager } from '../../managers/BallManager';
import { InputController } from '../../controls/InputController';
import { UIManager } from '../../managers/UIManager';
import { GameState } from '../../states/GameState';
import * as THREE from 'three';

describe('State Management Integration', () => {
  let stateManager;
  let eventManager;
  let ballManager;
  let inputController;
  let uiManager;
  let game;

  beforeEach(() => {
    // Create renderer with event handling
    const eventListeners = new Map();
    const mockDomElement = {
      addEventListener: jest.fn((event, handler) => {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, []);
        }
        eventListeners.get(event).push(handler);
      }),
      removeEventListener: jest.fn((event, handler) => {
        if (eventListeners.has(event)) {
          const handlers = eventListeners.get(event);
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      }),
      dispatchEvent: jest.fn(event => {
        const handlers = eventListeners.get(event.type) || [];
        handlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            console.error(`Error in event handler for ${event.type}:`, error);
          }
        });
        return true;
      }),
      style: {}
    };

    // Create game mock first
    game = {
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      renderer: {
        setSize: jest.fn(),
        render: jest.fn(),
        dispose: jest.fn(),
        domElement: mockDomElement
      },
      physicsManager: {
        world: { world: { bodies: [] } },
        update: jest.fn()
      },
      debugManager: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        enabled: false
      }
    };

    // Initialize event system with game reference
    eventManager = new EventManager(game);
    eventManager.init();

    // Add eventManager to game object
    game.eventManager = eventManager;

    // Initialize state manager first
    stateManager = new StateManager(game);
    game.stateManager = stateManager;

    // Initialize ball manager
    ballManager = new BallManager(game);
    ballManager.init(game.physicsManager);

    // Initialize input controller
    inputController = new InputController(game);

    // Initialize UI manager - it will subscribe to events in init()
    uiManager = new UIManager(game);
    uiManager.init();
    uiManager.attachRenderer(game.renderer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should coordinate state changes between managers', () => {
    // Track state changes
    const stateChanges = [];
    eventManager.subscribe('STATE_CHANGED', data => {
      stateChanges.push(data);
    });

    // Change to aiming state
    stateManager.setGameState(GameState.AIMING);

    // Verify state change was published
    expect(stateChanges).toHaveLength(1);
    expect(stateChanges[0]).toEqual({
      previousState: GameState.INITIALIZING,
      newState: GameState.AIMING
    });
  });

  test('should update UI based on state changes', () => {
    // Verify UIManager has subscribed to state changes during init
    expect(uiManager.init).toHaveBeenCalled();

    // Track all state change events
    const stateChanges = [];
    eventManager.subscribe('STATE_CHANGED', data => {
      stateChanges.push(data);
    });

    // Clear any previous calls from init
    uiManager.showMessage.mockClear();
    uiManager.hideMessage.mockClear();

    // Test AIMING state
    stateManager.setGameState(GameState.AIMING);
    expect(uiManager.showMessage).toHaveBeenCalledWith('Aim and click to shoot');
    expect(uiManager.showMessage).toHaveBeenCalledTimes(1);

    // Test PLAYING state
    stateManager.setGameState(GameState.PLAYING);
    expect(uiManager.hideMessage).toHaveBeenCalled();
    expect(uiManager.hideMessage).toHaveBeenCalledTimes(1);

    // Test HOLE_COMPLETED state
    stateManager.setGameState(GameState.HOLE_COMPLETED);

    // Verify state was actually changed
    expect(stateManager.getGameState()).toBe(GameState.HOLE_COMPLETED);
    expect(stateChanges).toContainEqual({
      previousState: GameState.PLAYING,
      newState: GameState.HOLE_COMPLETED
    });

    // Check UI updates
    expect(uiManager.showMessage).toHaveBeenCalledTimes(2);
    expect(uiManager.showMessage).toHaveBeenLastCalledWith('Hole Complete!');
  });

  test('should handle ball motion state correctly', async () => {
    // Create ball
    await ballManager.createBall({ x: 0, y: 1, z: 0 });

    // Track ball state changes
    const ballStates = [];
    eventManager.subscribe('BALL_STATE_CHANGED', data => {
      ballStates.push(data);
    });

    // Start ball motion
    stateManager.setBallInMotion(true);
    stateManager.setGameState(GameState.PLAYING);

    // Simulate ball hit event
    eventManager.publish('BALL_HIT', { power: 0.5, direction: { x: 1, y: 0, z: 0 } });

    // Verify state
    expect(stateManager.isBallInMotion()).toBe(true);
    expect(stateManager.getGameState()).toBe(GameState.PLAYING);

    // Stop ball motion
    stateManager.setBallInMotion(false);
    eventManager.publish('BALL_STOPPED');

    // Verify state changed back
    expect(stateManager.isBallInMotion()).toBe(false);
  });

  test('should coordinate hole completion state', () => {
    // Track events
    const events = [];
    eventManager.subscribe('HOLE_COMPLETED', data => events.push({ type: 'HOLE_COMPLETED', data }));
    eventManager.subscribe('STATE_CHANGED', data => events.push({ type: 'STATE_CHANGED', data }));

    // Complete hole
    stateManager.setHoleCompleted(true);
    stateManager.setGameState(GameState.HOLE_COMPLETED);

    // Publish hole completed event
    eventManager.publish('HOLE_COMPLETED', {
      hole: 1,
      strokes: 3,
      par: 3
    });

    // Verify state
    expect(stateManager.isHoleCompleted()).toBe(true);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'STATE_CHANGED',
        data: expect.objectContaining({ newState: GameState.HOLE_COMPLETED })
      })
    );
  });

  test('should handle reset ball state across components', () => {
    // Set up reset tracking
    const resetCalls = [];
    ballManager.resetBallPosition = jest.fn(pos => {
      resetCalls.push(pos);
    });

    // Request ball reset
    stateManager.setResetBall(true);
    eventManager.publish('RESET_BALL', { position: { x: 0, y: 1, z: -5 } });

    // Process reset
    if (stateManager.shouldResetBall()) {
      ballManager.resetBallPosition({ x: 0, y: 1, z: -5 });
      stateManager.clearResetBall();
    }

    // Verify reset was processed
    expect(resetCalls).toHaveLength(1);
    expect(resetCalls[0]).toEqual({ x: 0, y: 1, z: -5 });
    expect(stateManager.shouldResetBall()).toBe(false);
  });

  test('should maintain state consistency during rapid changes', () => {
    // Rapid state changes
    const states = [
      GameState.AIMING,
      GameState.PLAYING,
      GameState.AIMING,
      GameState.PLAYING,
      GameState.HOLE_COMPLETED
    ];

    states.forEach(state => {
      stateManager.setGameState(state);
    });

    // Final state should be correct
    expect(stateManager.getGameState()).toBe(GameState.HOLE_COMPLETED);

    // State history should be consistent
    expect(stateManager.state.currentGameState).toBe(GameState.HOLE_COMPLETED);
  });

  test('should handle concurrent state updates', () => {
    // Simulate concurrent updates
    const updates = [];

    // Subscribe to all state changes
    eventManager.subscribe('STATE_CHANGED', data => {
      updates.push(data);
    });

    // Trigger multiple state changes rapidly
    stateManager.setBallInMotion(true);
    stateManager.setGameState(GameState.PLAYING);
    stateManager.setHoleCompleted(false);
    stateManager.setBallInMotion(false);
    stateManager.setGameState(GameState.AIMING);

    // All updates should be processed
    expect(updates.length).toBeGreaterThan(0);

    // Final state should be consistent
    expect(stateManager.getGameState()).toBe(GameState.AIMING);
    expect(stateManager.isBallInMotion()).toBe(false);
    expect(stateManager.isHoleCompleted()).toBe(false);
  });
});
