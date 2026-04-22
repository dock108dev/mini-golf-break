import { EventTypes } from '../events/EventTypes';
import { debug } from '../utils/debug';

/** Seconds of continuous motion before showing the reset button. */
const STUCK_THRESHOLD = 15;
/** Seconds at near-zero speed before showing the nudge prompt. */
const STUCK_AT_REST_SECONDS = 3;
/** Speed (m/s) below which the ball is considered at rest for nudge detection. */
const STUCK_SPEED_THRESHOLD = 0.05;

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

    /** Accumulated seconds the ball has been near-stationary (speed < 0.05). */
    this.stuckAtRestTimer = 0;

    /** Whether the nudge prompt is currently visible. */
    this.isShowingNudgePrompt = false;

    /** DOM element for the nudge button. */
    this.nudgeButton = null;
  }

  /**
   * Initialize: create UI and subscribe to events.
   */
  init() {
    this.createResetButton();
    this.createNudgeButton();
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
    this.resetButton.setAttribute(
      'aria-label',
      'Reset ball to last hit position with 1 stroke penalty'
    );
    this.resetButton.addEventListener('click', () => this.handleResetClick());

    // Append to the UI container used by UIManager
    const container =
      document.getElementById('ui-container') || document.getElementById('ui-overlay');
    if (container) {
      container.appendChild(this.resetButton);
    }
  }

  /**
   * Create the "Tap to Nudge" button and append it to the UI container.
   */
  createNudgeButton() {
    this.nudgeButton = document.createElement('button');
    this.nudgeButton.classList.add('stuck-nudge-button');
    this.nudgeButton.textContent = 'Tap to Nudge';
    this.nudgeButton.setAttribute('aria-label', 'Nudge stuck ball with a small random impulse');
    this.nudgeButton.addEventListener('click', () => this.handleNudgeClick());

    const container =
      document.getElementById('ui-container') || document.getElementById('ui-overlay');
    if (container) {
      container.appendChild(this.nudgeButton);
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
      this.eventSubscriptions.push(this.game.eventManager.subscribe(type, handler, this));
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

    // === Motion-stuck detection: ball in motion for > 15 s without stopping ===
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

    // === At-rest stuck detection: speed < 0.05 m/s for > 3 s → nudge prompt ===
    const body = ballManager.ball.body;
    if (body && body.velocity) {
      const v = body.velocity;
      const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      if (speed < STUCK_SPEED_THRESHOLD) {
        this.stuckAtRestTimer += dt;
        if (this.stuckAtRestTimer >= STUCK_AT_REST_SECONDS && !this.isShowingNudgePrompt) {
          this.showNudgePrompt();
        }
      } else {
        this.stuckAtRestTimer = 0;
        if (this.isShowingNudgePrompt) {
          this.hideNudgePrompt();
        }
      }
    }
  }

  /**
   * Reset all stuck timers and hide both the reset button and the nudge prompt.
   */
  resetTimer() {
    this.motionTimer = 0;
    this.stuckAtRestTimer = 0;
    if (this.isShowingResetButton) {
      this.hideResetButton();
    }
    this.hideNudgePrompt();
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

    this.game.eventManager?.publish(EventTypes.BALL_STUCK, { motionTime: this.motionTimer }, this);

    debug.log(`[StuckBallManager] Ball stuck — motion time ${this.motionTimer.toFixed(1)}s`);
  }

  /**
   * Show the nudge prompt.
   */
  showNudgePrompt() {
    if (!this.nudgeButton) {
      return;
    }
    this.nudgeButton.classList.add('visible');
    this.isShowingNudgePrompt = true;
    debug.log('[StuckBallManager] Ball at rest — showing nudge prompt');
  }

  /**
   * Hide the nudge prompt.
   */
  hideNudgePrompt() {
    if (!this.nudgeButton || !this.isShowingNudgePrompt) {
      return;
    }
    this.nudgeButton.classList.remove('visible');
    this.isShowingNudgePrompt = false;
  }

  /**
   * Handle the player tapping the nudge button.
   * Applies a small random impulse in ±X or ±Z and dismisses the prompt.
   */
  handleNudgeClick() {
    const ballManager = this.game.ballManager;
    if (!ballManager?.ball?.body) {
      return;
    }

    // Random axis (X or Z) with random direction, magnitude 0.5
    const useX = Math.random() < 0.5;
    const sign = Math.random() < 0.5 ? 1 : -1;
    const impulse = {
      x: useX ? sign * 0.5 : 0,
      y: 0,
      z: useX ? 0 : sign * 0.5
    };

    ballManager.ball.body.applyImpulse(impulse, ballManager.ball.body.position);
    this.stuckAtRestTimer = 0;
    this.hideNudgePrompt();

    debug.log('[StuckBallManager] Nudge applied:', impulse);
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
    this.nudgeButton?.remove();
    this.nudgeButton = null;
    this.isShowingNudgePrompt = false;

    this.eventSubscriptions.forEach(unsub => {
      try {
        unsub();
      } catch (_e) {
        /* ignore */
      }
    });
    this.eventSubscriptions = [];
  }
}
