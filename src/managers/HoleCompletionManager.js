import { debug } from '../utils/debug';
import { EventTypes } from '../events/EventTypes';
import { GameState } from '../states/GameState';
import { isIsolationMode } from '../utils/devHoleHarness';

/**
 * HoleCompletionManager - Handles hole completion logic and effects
 */
export class HoleCompletionManager {
  constructor(game) {
    this.game = game;
    this.completionDelay = 1500; // Delay before showing continue button
    this.detectionGracePeriod = 2000; // Grace period after hole creation (ms) - increased from 1000
    this.holeCreationTime = Date.now(); // Track when the hole was created
    this.isTransitioning = false; // Track if we're currently transitioning

    // Cup sink detection state
    this._prevInsideTrigger = false;
    this._prevSpeed = 0;
    this._approachSpeedThreshold = 0.5;
    this._minSpeedGuard = 0.2; // sleepSpeedLimit * 2 — blocks rim-bounce false triggers
  }

  /**
   * Initialize the hole completion manager
   */
  init() {
    this.setupEventListeners();
    this.resetGracePeriod(); // Reset the grace period on init
    return this;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for ball in hole events
    this.game.eventManager.subscribe(EventTypes.BALL_IN_HOLE, this.handleBallInHole, this);
    // Listen for stroke limit reached events
    this.game.eventManager.subscribe(
      EventTypes.STROKE_LIMIT_REACHED,
      this.handleStrokeLimitReached,
      this
    );
  }

  /**
   * Reset the grace period timer
   */
  resetGracePeriod() {
    this.holeCreationTime = Date.now();
    this.isTransitioning = false;
    this._prevInsideTrigger = false;
    this._prevSpeed = 0;
    this.game.debugManager.log(
      `[DEBUG] Hole detection grace period reset at ${this.holeCreationTime}`
    );
  }

  /**
   * Handle the ball going in the hole (triggered by BALL_IN_HOLE event)
   */
  handleBallInHole() {
    // Get current state
    const currentHoleNumber = this.game.stateManager.getCurrentHoleNumber();
    const totalHoles = this.game.course.getTotalHoles();

    debug.log(
      `[HoleCompletionManager] Ball in hole for hole ${currentHoleNumber} of ${totalHoles}`
    );

    // Prevent multiple triggers
    if (this.game.stateManager.isHoleCompleted() || this.isTransitioning) {
      debug.log(
        '[HoleCompletionManager] Hole already completed or transitioning, ignoring ball in hole event'
      );
      return;
    }

    this.isTransitioning = true;

    try {
      if (this.game.ballManager && this.game.ballManager.ball) {
        const ball = this.game.ballManager.ball;
        if (this.game.audioManager) {
          this.game.audioManager.playSound('success', 0.7);
        }
        if (ball.handleHoleSuccess) {
          ball.handleHoleSuccess();
        }
      }
      // Delay so the ball-sink animation finishes before the overlay appears
      setTimeout(() => {
        this.game.uiManager.showMessage('Great Shot!', 2000);
      }, 500);
    } catch (error) {
      console.error('[HoleCompletionManager] Error during immediate feedback actions:', error);
    }

    this.game.stateManager.setHoleCompleted(true);

    const totalStrokes = this.game.scoringSystem.getTotalStrokes();
    this.updateScore(currentHoleNumber, totalStrokes);

    // In isolation mode, stay on the current hole
    if (isIsolationMode()) {
      debug.log('[HoleCompletionManager] Isolation mode — staying on current hole');
      this.isTransitioning = false;
      return;
    }

    // Check if this was the last hole
    if (currentHoleNumber >= totalHoles) {
      debug.log(`[HoleCompletionManager] Final hole ${currentHoleNumber} completed`);
      this.game.stateManager.setGameState(GameState.GAME_COMPLETED);
      this.isTransitioning = false;
      return;
    }

    // Add a delay before transitioning to allow for visual feedback
    setTimeout(() => {
      if (!this.isTransitioning) {
        debug.log('[HoleCompletionManager] Transition already handled, skipping');
        return;
      }

      debug.log('[HoleCompletionManager] Scheduling transition to next hole');
      this.game.holeTransitionManager.transitionToNextHole();
      this.isTransitioning = false;
    }, 1500);
  }

  /**
   * Handle stroke limit reached — auto-advance after delay
   */
  handleStrokeLimitReached() {
    const currentHoleNumber = this.game.stateManager.getCurrentHoleNumber();
    const totalHoles = this.game.course.getTotalHoles();

    debug.log(
      `[HoleCompletionManager] Stroke limit reached on hole ${currentHoleNumber} of ${totalHoles}`
    );

    if (this.game.stateManager.isHoleCompleted() || this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;

    this.game.uiManager.showMessage('Max strokes reached', 2000);

    this.game.stateManager.setHoleCompleted(true);

    const totalStrokes = this.game.scoringSystem.getTotalStrokes();
    this.updateScore(currentHoleNumber, totalStrokes);

    if (isIsolationMode()) {
      debug.log('[HoleCompletionManager] Isolation mode — staying on current hole (stroke limit)');
      this.isTransitioning = false;
      return;
    }

    if (currentHoleNumber >= totalHoles) {
      debug.log(`[HoleCompletionManager] Final hole ${currentHoleNumber} — stroke limit`);
      this.game.stateManager.setGameState(GameState.GAME_COMPLETED);
      this.isTransitioning = false;
      return;
    }

    setTimeout(() => {
      if (!this.isTransitioning) {
        return;
      }
      debug.log('[HoleCompletionManager] Stroke limit — transitioning to next hole');
      this.game.holeTransitionManager.transitionToNextHole();
      this.isTransitioning = false;
    }, 1500);
  }

  /**
   * Show completion effects
   */
  showCompletionEffects() {
    // Get current hole mesh
    const currentHole = this.game.course.getCurrentHoleMesh();
    if (!currentHole) {
      return;
    }

    // Animate hole disappearing
    const duration = 1000; // 1 second
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Fade out opacity
      if (currentHole.material) {
        currentHole.material.opacity = 1 - progress;
        currentHole.material.transparent = true;
      }

      // Scale down
      const scale = 1 - progress;
      currentHole.scale.set(scale, scale, scale);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Remove hole from scene
        this.game.scene.remove(currentHole);
      }
    };

    animate();
  }

  /**
   * Update score for the completed hole
   * @param {number} holeNumber - Number of the completed hole
   * @param {number} totalStrokes - Total strokes taken
   */
  updateScore(holeNumber, totalStrokes) {
    // Publish hole completed event
    this.game.eventManager.publish(
      EventTypes.HOLE_COMPLETED,
      {
        holeNumber,
        totalStrokes
      },
      this
    );

    // Update UI
    this.game.uiManager.updateScore();
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Nothing specific to clean up
  }

  /**
   * Handle hole transition
   * @param {number} fromHole - The hole number we're transitioning from
   * @param {number} toHole - The hole number we're transitioning to
   */
  onHoleTransition(fromHole, toHole) {
    debug.log(`[HoleCompletionManager] Handling transition from hole ${fromHole} to ${toHole}`);

    // Reset completion state
    this.resetCompletionState();

    // Update current hole number
    this.currentHoleNumber = toHole;

    // Update par for new hole
    if (this.game.course) {
      this.currentPar = this.game.course.getHolePar(toHole);
    }

    // Update UI
    if (this.game.uiManager) {
      this.game.uiManager.updateHoleNumber(toHole);
      this.game.uiManager.updatePar(this.currentPar);
    }

    debug.log(`[HoleCompletionManager] Transition to hole ${toHole} complete`);
  }

  /**
   * Reset completion state
   * @private
   */
  resetCompletionState() {
    this.isHoleComplete = false;
    this.completionTime = 0;
    this.strokes = 0;
    this.currentPar = 0;
  }

  /**
   * Update loop — runs cup sink detection each frame.
   * @param {number} _dt - Delta time in seconds (unused)
   */
  update(_dt) {
    this._checkCupSinkDetection();
  }

  /**
   * Position + speed based cup sink detection.
   * Fires BALL_IN_HOLE when ball center is within cupRadius of the hole and
   * approach speed is below the threshold. A min-speed guard suppresses the
   * event on the tick immediately following a fast entry (rim-bounce guard).
   * @private
   */
  _checkCupSinkDetection() {
    if (this.isTransitioning || this.game.stateManager.isHoleCompleted()) {
      this._prevInsideTrigger = false;
      this._prevSpeed = 0;
      return;
    }

    if (Date.now() - this.holeCreationTime < this.detectionGracePeriod) {
      return;
    }

    const hole = this.game.course?.currentHole;
    const ballBody = this.game.ballManager?.ball?.body;
    if (!hole?.worldHolePosition || !ballBody) {
      return;
    }

    const hp = hole.worldHolePosition;
    const bp = ballBody.position;
    const cupRadius = hole.cupRadius ?? 0.3;

    const dx = bp.x - hp.x;
    const dz = bp.z - hp.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const vel = ballBody.velocity;
    const speed =
      typeof vel.length === 'function'
        ? vel.length()
        : Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    if (dist < cupRadius) {
      // Rim-bounce guard: skip detection if ball was inside and moving fast on the previous tick.
      if (this._prevInsideTrigger && this._prevSpeed > this._minSpeedGuard) {
        this._prevInsideTrigger = true;
        this._prevSpeed = speed;
        return;
      }

      if (speed < this._approachSpeedThreshold) {
        this.game.eventManager.publish(EventTypes.BALL_IN_HOLE, {}, this);
      }

      this._prevInsideTrigger = true;
      this._prevSpeed = speed;
    } else {
      this._prevInsideTrigger = false;
      this._prevSpeed = speed;
    }
  }
}
