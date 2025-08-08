import { EventTypes } from '../events/EventTypes';
import { GameState } from '../states/GameState';

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
  }

  /**
   * Reset the grace period timer
   */
  resetGracePeriod() {
    this.holeCreationTime = Date.now();
    this.isTransitioning = false;
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

    // Prevent multiple triggers
    if (this.game.stateManager.isHoleCompleted() || this.isTransitioning) {
      return;
    }

    // Mark that we're starting a transition (or completion)
    this.isTransitioning = true;

    // --- Add Immediate Feedback Actions ---
    try {
      if (this.game.ballManager && this.game.ballManager.ball) {
        const ball = this.game.ballManager.ball;
        // Play success sound
        if (this.game.audioManager) {
          this.game.audioManager.playSound('success', 0.7);
        }
        // Trigger ball's success effect
        if (ball.handleHoleSuccess) {
          ball.handleHoleSuccess();
        }
        // Trigger visual celebration effect
        if (this.game.visualEffectsManager) {
          const holePosition = this.game.holeManager.currentHole.position;
          const strokes = this.game.scoringSystem.getCurrentHoleStrokes();
          if (strokes === 1) {
            this.game.visualEffectsManager.triggerHoleInOneEffect(holePosition);
            this.game.uiManager.showMessage('HOLE IN ONE!', 3000);
          } else {
            this.game.visualEffectsManager.triggerHoleCompleteEffect(holePosition);
            this.game.uiManager.showMessage('Great Shot!', 2000);
          }
        } else {
          // Fallback if no visual effects manager
          this.game.uiManager.showMessage('Great Shot!', 2000);
        }
      } else {
        // Show UI message (moved from Game.js)
        setTimeout(() => {
          this.game.uiManager.showMessage('Great Shot!', 2000);
        }, 500); // Small delay still seems appropriate
      }
      // eslint-disable-next-line no-empty
    } catch (error) {}
    // --- End Immediate Feedback Actions ---

    // Set game state to hole completed
    this.game.stateManager.setHoleCompleted(true);

    // Get score data
    const totalStrokes = this.game.scoringSystem.getTotalStrokes();

    // Save hole score
    this.game.scoringSystem.completeHole(currentHoleNumber, 3);

    // Update score
    this.updateScore(currentHoleNumber, totalStrokes);

    // Check if this was the last hole
    if (currentHoleNumber >= totalHoles) {
      this.game.stateManager.setGameState(GameState.GAME_COMPLETED);
      this.isTransitioning = false;
      return;
    }

    // Add a delay before transitioning to allow for visual feedback
    setTimeout(() => {
      if (!this.isTransitioning) {
        return;
      }

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
   * Update loop for the hole completion manager
   * @param {number} dt - Delta time in seconds
   */
  update(_dt) {
    // Currently no update logic needed
  }
}
