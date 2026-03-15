import { EventTypes } from '../events/EventTypes';
import { UIScoreOverlay } from './ui/UIScoreOverlay';
import { UIDebugOverlay } from './ui/UIDebugOverlay';
import { debug } from '../utils/debug';

/**
 * UIManager - Handles all UI elements and interactions for the game
 * Extracts UI management from Game.js to improve modularity
 * Acts as an orchestrator for UI submodules.
 */
export class UIManager {
  constructor(game) {
    // Reference to the main game
    this.game = game;

    // Main UI container
    this.uiContainer = null;

    // Renderer reference
    this.renderer = null;

    // UI Submodules
    this.scoreOverlay = null;
    this.debugOverlay = null;

    // Message Display (still managed here for simplicity)
    this.isShowingMessage = false;
    this.messageTimeoutId = null;
    this.messageTimeout = null;
    this.messageElement = null;

    // Power Indicator (still managed here)
    this.powerIndicator = null;

    // Event subscriptions list
    this.eventSubscriptions = [];
  }

  /**
   * Initialize the UI manager and its submodules.
   */
  init() {
    debug.log('[UIManager.init] Starting...');
    try {
      // Ensure the main UI container exists
      this.createMainContainer();

      debug.log('[UIManager.init] Initializing UI submodules...');
      this.scoreOverlay = new UIScoreOverlay(this.game, this.uiContainer);
      this.scoreOverlay.init();

      this.debugOverlay = new UIDebugOverlay(this.game, this.uiContainer);
      this.debugOverlay.init();
      debug.log('[UIManager.init] Submodules initialized.');

      debug.log('[UIManager.init] Creating remaining UI elements (Message, Power)...');
      this.createMessageUI();
      this.createPowerIndicatorUI();
      debug.log('[UIManager.init] Remaining UI elements created.');

      debug.log('[UIManager.init] Setting up event listeners...');
      this.setupEventListeners();
      debug.log('[UIManager.init] Event listeners setup finished.');
      debug.log('[UIManager.init] Finished.');
    } catch (error) {
      console.error('[UIManager.init] Failed:', error);
      this.game.debugManager?.error('UIManager.init', 'Initialization failed', error, true);
    }
    return this;
  }

  /**
   * Create the main UI container if it doesn't exist.
   */
  createMainContainer() {
    // Clean up any existing UI elements first (including old container)
    this.cleanup();

    // First check for an existing UI container with either ID
    this.uiContainer =
      document.getElementById('ui-container') || document.getElementById('ui-overlay');

    if (!this.uiContainer) {
      debug.log('[UIManager.createMainContainer] No UI container found. Creating new container.');
      this.uiContainer = document.createElement('div');
      this.uiContainer.id = 'ui-container';
      this.uiContainer.classList.add('ui-container');
      document.body.appendChild(this.uiContainer);
      debug.log('[UIManager.createMainContainer] Created #ui-container and added to body.');
    } else {
      debug.log(
        `[UIManager.createMainContainer] Found existing UI container: #${this.uiContainer.id}`
      );
      // Ensure it's empty to avoid duplication
      while (this.uiContainer.firstChild) {
        this.uiContainer.removeChild(this.uiContainer.firstChild);
      }
    }
  }

  /**
   * Create message display elements.
   */
  createMessageUI() {
    // Create message container (center)
    this.messageElement = document.createElement('div');
    this.messageElement.id = 'message-container';
    this.messageElement.classList.add('message-container');
    this.uiContainer.appendChild(this.messageElement);
  }

  /**
   * Create power indicator elements.
   */
  createPowerIndicatorUI() {
    // Create power indicator
    this.powerIndicator = document.createElement('div');
    this.powerIndicator.classList.add('power-indicator');
    const powerFill = document.createElement('div');
    powerFill.classList.add('power-indicator-fill');
    this.powerIndicator.appendChild(powerFill);
    this.uiContainer.appendChild(this.powerIndicator);
  }

  /**
   * Set up event listeners - Delegates some updates to submodules.
   */
  setupEventListeners() {
    debug.log('[UIManager.setupEventListeners] Starting...');
    if (!this.game.eventManager) {
      console.warn('[UIManager.setupEventListeners] EventManager not available, skipping.');
      return;
    }
    try {
      // Clear existing subscriptions before adding new ones
      this.eventSubscriptions.forEach(unsub => unsub());
      this.eventSubscriptions = [];

      const subscribe = (type, handler) => {
        this.eventSubscriptions.push(this.game.eventManager.subscribe(type, handler, this));
      };

      debug.log('[UIManager.setupEventListeners] Subscribing to HOLE_COMPLETED...');
      subscribe(EventTypes.HOLE_COMPLETED, this.handleHoleCompleted);

      debug.log('[UIManager.setupEventListeners] Subscribing to HOLE_STARTED...');
      subscribe(EventTypes.HOLE_STARTED, this.handleHoleStarted);

      debug.log('[UIManager.setupEventListeners] Subscribing to GAME_COMPLETED...');
      subscribe(EventTypes.GAME_COMPLETED, this.handleGameCompleted);

      debug.log('[UIManager.setupEventListeners] Subscribing to BALL_HIT...');
      subscribe(EventTypes.BALL_HIT, this.handleBallHit);

      debug.log('[UIManager.setupEventListeners] Subscribing to BALL_IN_HOLE...');
      subscribe(EventTypes.BALL_IN_HOLE, this.handleBallInHole);

      debug.log('[UIManager.setupEventListeners] Subscribing to HAZARD_DETECTED...');
      subscribe(EventTypes.HAZARD_DETECTED, this.handleHazardDetected);

      subscribe(EventTypes.UI_REQUEST_RESTART_GAME, () => {
        debug.log('[UIManager] Received UI_REQUEST_RESTART_GAME');
        window.location.reload();
      });

      debug.log('[UIManager.setupEventListeners] Finished.');
    } catch (error) {
      console.error('[UIManager.setupEventListeners] Failed:', error);
      this.game.debugManager?.error('UIManager.setupEventListeners', 'Failed', error, true);
    }
  }

  /**
   * Handle hole completed event - Updates score overlay.
   * @param {GameEvent} event - Hole completed event
   */
  handleHoleCompleted(event) {
    const holeNumber = event.get('holeNumber');
    const totalStrokes = this.game.scoringSystem.getTotalStrokes();

    const message = `Hole ${holeNumber} completed! Total strokes so far: ${totalStrokes}`;
    this.showMessage(message, 3000);

    // Delegate updates to score overlay
    this.scoreOverlay?.updateHoleInfo();
    this.scoreOverlay?.updateScorecard(); // Maybe update final score preview?
    this.scoreOverlay?.updateScore();
  }

  /**
   * Handle hole started event - Updates score overlay.
   * @param {GameEvent} event - Hole started event
   */
  handleHoleStarted(event) {
    debug.log('[UIManager.handleHoleStarted] Event received.');
    const holeNumber = event.get('holeNumber');

    this.showMessage(`Hole ${holeNumber}`, 2000);

    // Delegate updates to score overlay
    debug.log('[UIManager.handleHoleStarted] Updating score overlay elements...');
    this.scoreOverlay?.updateHoleInfo();
    this.scoreOverlay?.updateScorecard(); // Placeholder call
    this.scoreOverlay?.updateScore();
    this.scoreOverlay?.updateStrokes(); // Reset strokes for new hole
    debug.log('[UIManager.handleHoleStarted] Finished updating score overlay.');
  }

  /**
   * Handle game completed event - Shows final scorecard via overlay.
   * @param {GameEvent} event - Game completed event
   */
  handleGameCompleted(_event) {
    debug.log('[UIManager.handleGameCompleted] Event received!');

    // Extra debug info
    debug.log(
      `[UIManager.handleGameCompleted] DEBUG: scoreOverlay exists: ${Boolean(this.scoreOverlay)}`
    );
    debug.log(
      `[UIManager.handleGameCompleted] DEBUG: this.scoreOverlay?.showFinalScorecard is function: ${typeof this.scoreOverlay?.showFinalScorecard === 'function'}`
    );

    // Delegate to score overlay
    if (this.scoreOverlay && typeof this.scoreOverlay.showFinalScorecard === 'function') {
      debug.log('[UIManager.handleGameCompleted] Calling scoreOverlay.showFinalScorecard()');
      this.scoreOverlay.showFinalScorecard();
    } else {
      console.error(
        `[UIManager.handleGameCompleted] ERROR: Cannot show scorecard - scoreOverlay is ${this.scoreOverlay ? 'missing showFinalScorecard method' : 'not initialized'}`
      );
      // Alert as a last resort to show something
      // eslint-disable-next-line no-alert
      alert('Game Complete! Total strokes: ' + this.game.scoringSystem.getTotalStrokes());
    }
  }

  /**
   * Handle ball hit event - Updates score overlay.
   * @param {GameEvent} event - Ball hit event
   */
  handleBallHit(_event) {
    // Delegate updates to score overlay
    this.scoreOverlay?.updateScore();
    this.scoreOverlay?.updateStrokes();
  }

  /**
   * Handle ball in hole event
   * @param {GameEvent} event - Ball in hole event
   */
  handleBallInHole(_event) {
    // Currently no specific UI action needed here besides what HoleCompleted handles.
  }

  /**
   * Handle hazard detected event - Updates message and score overlay.
   * @param {GameEvent} event - Hazard detected event
   */
  handleHazardDetected(event) {
    const hazardType = event.get('hazardType');
    let message = 'Hazard!';

    // Determine message based on hazard type
    if (hazardType === 'water') {
      message = 'Water hazard! +1 stroke penalty.';
    } else if (hazardType === 'sand') {
      // Optional: Show a message for sand, or just let the physics handle it
      // message = "In the bunker!";
    } else if (hazardType === 'outOfBounds') {
      message = 'Out of bounds! +1 stroke penalty.';
    }

    if (message !== 'Hazard!') {
      // Only show message for penalty hazards or OOB
      this.showMessage(message, 2000);
    }

    // Delegate stroke update to score overlay
    this.scoreOverlay?.updateStrokes();
  }

  /**
   * Attach WebGL renderer to DOM
   * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
   */
  attachRenderer(renderer) {
    if (!renderer || !renderer.domElement) {
      this.game.debugManager?.warn('UIManager.attachRenderer', 'Invalid renderer or domElement');
      return;
    }

    // Store renderer reference
    this.renderer = renderer;

    // Prefer a specific container if it exists
    let container = document.getElementById('game-container');
    if (!container) {
      // Fallback to creating a default container if none exists
      debug.log('[UIManager.attachRenderer] #game-container not found, creating one.');
      container = document.createElement('div');
      container.id = 'game-container';
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.overflow = 'hidden';
      document.body.insertBefore(container, document.body.firstChild);
    }

    // Ensure renderer DOM element isn't already attached elsewhere
    if (renderer.domElement.parentNode && renderer.domElement.parentNode !== container) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }

    // Append if not already a child
    if (renderer.domElement.parentNode !== container) {
      container.appendChild(renderer.domElement);
      debug.log('[UIManager.attachRenderer] Renderer attached to container.');
    } else {
      debug.log('[UIManager.attachRenderer] Renderer already attached to container.');
    }
  }

  /**
   * Show a message to the player (managed directly by UIManager).
   * @param {string} message - Message to show
   * @param {number} duration - Duration in milliseconds
   */
  showMessage(message, duration = 2000) {
    if (!this.messageElement) {
      return;
    }

    // Clear existing timeout
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
      this.messageTimeout = null;
    }

    // Set message
    this.messageElement.textContent = message;
    this.messageElement.style.opacity = '1'; // Use opacity for fade
    this.messageElement.style.visibility = 'visible';
    this.messageElement.classList.add('visible'); // Add class if needed for complex styles
    this.isShowingMessage = true;

    // Set timeout to hide
    this.messageTimeout = setTimeout(() => {
      this.hideMessage();
    }, duration);
  }

  /**
   * Hide the message element.
   */
  hideMessage() {
    if (!this.messageElement || !this.isShowingMessage) {
      return;
    }

    this.messageElement.style.opacity = '0';
    // Use transitionend event to set visibility hidden after fade
    this.messageElement.addEventListener(
      'transitionend',
      () => {
        if (this.messageElement && this.messageElement.style.opacity === '0') {
          this.messageElement.style.visibility = 'hidden';
          this.messageElement.classList.remove('visible');
        }
      },
      { once: true }
    );

    this.isShowingMessage = false;
    this.messageTimeout = null; // Clear timeout reference
  }

  // --- Delegated Methods ---

  updateScore() {
    this.scoreOverlay?.updateScore();
  }

  updateHoleInfo() {
    this.scoreOverlay?.updateHoleInfo();
  }

  updateStrokes() {
    this.scoreOverlay?.updateStrokes();
  }

  updateDebugDisplay(debugInfo) {
    this.debugOverlay?.updateDebugDisplay(debugInfo);
  }

  showFinalScorecard() {
    this.scoreOverlay?.showFinalScorecard();
  }

  hideFinalScorecard() {
    this.scoreOverlay?.hideFinalScorecard();
  }

  /**
   * Cleanup UI elements and unsubscribe from events.
   */
  cleanup() {
    debug.log('[UIManager.cleanup] Cleaning up UI elements and subscriptions...');
    // Cleanup submodules
    this.scoreOverlay?.cleanup();
    this.debugOverlay?.cleanup();

    // Cleanup elements managed directly by UIManager
    this.messageElement?.remove();
    this.powerIndicator?.remove();
    this.uiContainer?.remove(); // Remove the main container

    this.messageElement = null;
    this.powerIndicator = null;
    this.scoreOverlay = null;
    this.debugOverlay = null;
    this.uiContainer = null;

    // Clear message timeout
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
      this.messageTimeout = null;
    }

    // Unsubscribe from all events
    debug.log(`[UIManager.cleanup] Unsubscribing from ${this.eventSubscriptions.length} events.`);
    this.eventSubscriptions.forEach(unsub => {
      try {
        unsub();
      } catch (error) {
        console.warn('[UIManager.cleanup] Error unsubscribing from an event:', error);
      }
    });
    this.eventSubscriptions = []; // Clear the array

    debug.log('[UIManager.cleanup] Finished.');
  }
}
