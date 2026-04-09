import { EventTypes } from '../events/EventTypes';
import { debug } from '../utils/debug';

/** Time in seconds before the ball is considered stuck. */
const STUCK_THRESHOLD = 15;

/**
 * StuckBallManager — detects when the ball has been in motion for too long
 * without stopping or entering the hole, and offers the player a manual reset.
 */
export class StuckBallManager {
  constructor(game) {
    this.game = game;

    /** Accumulated seconds the ball has been continuously in motion. */
    this.motionTimer = 0;

    /** Whether the reset button is currently visible. */
    this.isShowingResetButton = false;

    /** DOM element for the reset button. */
    this.resetButton = null;

    /** Event subscription cleanup functions. */
    this.eventSubscriptions = [];
  }

  /**
   * Initialize: create UI and subscribe to events.
   */
  init() {
    this.createResetButton();
    this.setupEventListeners();
    return this;
  }

  /**
   * Create the "Reset Ball" button and append it to the UI container.
   */
  createResetButton() {
    this.resetButton = document.createElement('button');
    this.resetButton.classList.add('stuck-reset-button');
    this.resetButton.textContent = 'Reset Ball';
    this.resetButton.setAttribute('aria-label', 'Reset ball to last hit position with 1 stroke penalty');
    this.resetButton.addEventListener('click', () => this.handleResetClick());

    // Append to the UI container used by UIManager
    const container =
      document.getElementById('ui-container') ||
      document.getElementById('ui-overlay');
    if (container) {
      container.appendChild(this.resetButton);
    }
  }

  /**
   * Subscribe to game events that should reset the motion timer.
   */
  setupEventListeners() {
    if (!this.game.eventManager) {
      return;
    }

    const subscribe = (type, handler) => {
      this.eventSubscriptions.push(
        this.game.eventManager.subscribe(type, handler, this)
      );
    };

    // Any of these events mean the ball is no longer stuck
    subscribe(EventTypes.BALL_STOPPED, this.resetTimer);
    subscribe(EventTypes.BALL_IN_HOLE, this.resetTimer);
    subscribe(EventTypes.BALL_RESET, this.resetTimer);
    subscribe(EventTypes.HOLE_STARTED, this.resetTimer);
    subscribe(EventTypes.BALL_HIT, this.resetTimer);
  }

  /**
   * Called each frame from the game loop.
   * @param {number} dt — delta time in seconds
   */
  update(dt) {
    const ballManager = this.game.ballManager;
    if (!ballManager || !ballManager.ball) {
      return;
    }

    const isMoving = this.game.stateManager.isBallInMotion();

    if (isMoving) {
      this.motionTimer += dt;

      if (this.motionTimer >= STUCK_THRESHOLD && !this.isShowingResetButton) {
        this.showResetButton();
      }
    } else {
      // Ball is at rest — hide button if showing and reset timer
      if (this.motionTimer > 0 || this.isShowingResetButton) {
        this.resetTimer();
      }
    }
  }

  /**
   * Reset the motion timer and hide the reset button.
   */
  resetTimer() {
    this.motionTimer = 0;
    if (this.isShowingResetButton) {
      this.hideResetButton();
    }
  }

  /**
   * Show the reset button.
   */
  showResetButton() {
    if (!this.resetButton) {
      return;
    }
    this.resetButton.classList.add('visible');
    this.isShowingResetButton = true;

    this.game.eventManager?.publish(
      EventTypes.BALL_STUCK,
      { motionTime: this.motionTimer },
      this
    );

    debug.log(`[StuckBallManager] Ball stuck — motion time ${this.motionTimer.toFixed(1)}s`);
  }

  /**
   * Hide the reset button.
   */
  hideResetButton() {
    if (!this.resetButton) {
      return;
    }
    this.resetButton.classList.remove('visible');
    this.isShowingResetButton = false;
  }

  /**
   * Handle the player clicking the reset button.
   */
  handleResetClick() {
    const ballManager = this.game.ballManager;
    if (!ballManager || !ballManager.ball) {
      return;
    }

    // Add 1-stroke penalty (same as water hazard)
    this.game.scoringSystem.addPenaltyStrokes(1);

    // Reset ball to last hit position
    const resetPosition = ballManager.lastBallPosition.clone
      ? ballManager.lastBallPosition.clone()
      : { ...ballManager.lastBallPosition };
    ballManager.resetBall(resetPosition);

    // Update UI
    this.game.uiManager?.updateStrokes();
    this.game.uiManager?.showMessage('Ball reset! +1 stroke penalty.', 2000);

    // Reset timer and hide button
    this.resetTimer();

    debug.log('[StuckBallManager] Player reset stuck ball');
  }

  /**
   * Clean up DOM elements and event subscriptions.
   */
  cleanup() {
    this.resetTimer();
    this.resetButton?.remove();
    this.resetButton = null;

    this.eventSubscriptions.forEach(unsub => {
      try { unsub(); } catch (_e) { /* ignore */ }
    });
    this.eventSubscriptions = [];
  }
}
