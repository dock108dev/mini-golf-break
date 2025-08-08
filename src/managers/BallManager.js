import * as THREE from 'three';
import { Ball } from '../objects/Ball';
import { EventTypes } from '../events/EventTypes';

/**
 * BallManager - Handles ball creation, physics, and movement
 * Manages the golf ball's lifecycle and interactions
 */
export class BallManager {
  constructor(game) {
    this.game = game;
    this.ball = null;
    this.lastBallPosition = new THREE.Vector3();
    this.wasMoving = false;
    this.followLerp = 0.1; // Controls how quickly the camera follows the ball

    // Manager references
    this.physicsManager = null;

    // Initialization state tracking
    this.isInitialized = false;
    this.eventSubscriptions = [];
  }

  /**
   * Initialize the ball manager
   * @returns {BallManager} this instance for chaining
   */
  init() {
    try {
      if (this.isInitialized) {
        return this;
      }

      // Set up manager references
      this.physicsManager = this.game.physicsManager;

      // Don't create ball here - it will be created by Game.createCourse()

      this.setupEventListeners();

      this.isInitialized = true;
    } catch (error) {
      // Error handling removed for production
    }

    return this;
  }

  /**
   * Set up event subscriptions
   */
  setupEventListeners() {
    if (!this.game.eventManager) {
      return;
    }

    try {
      this.eventSubscriptions = []; // Initialize as empty array

      this.eventSubscriptions.push(
        this.game.eventManager.subscribe(
          EventTypes.HAZARD_DETECTED,
          this.handleHazardDetected,
          this
        )
      );

      this.eventSubscriptions.push(
        this.game.eventManager.subscribe(EventTypes.HOLE_STARTED, this.handleHoleStarted, this)
      );
    } catch (error) {
      // Error handling removed for production
    }
  }

  /**
   * Handle the start of a new hole
   * @param {GameEvent} event - The hole started event
   */
  handleHoleStarted(_event) {
    try {
      // Get the WORLD start position for the new hole
      const worldStartPosition = this.game.course.getHoleStartPosition(); // Now returns WORLD coords
      if (this.ball && worldStartPosition) {
        this.ball.setPosition(
          worldStartPosition.x,
          worldStartPosition.y + Ball.START_HEIGHT,
          worldStartPosition.z
        );
        this.ball.resetVelocity();

        // Publish ball reset event with the elevated position
        const resetPosition = new THREE.Vector3(
          worldStartPosition.x,
          worldStartPosition.y + Ball.START_HEIGHT,
          worldStartPosition.z
        );
        if (this.game.eventManager) {
          this.game.eventManager.publish(EventTypes.BALL_RESET, { position: resetPosition }, this);
        }
      }
    } catch (error) {
      // Error handling removed for production
    }
  }

  /**
   * Create a new ball at the correct world start position
   * @param {THREE.Vector3} worldStartPosition - The WORLD position where the ball should be created
   * @private
   */
  createBall(worldStartPosition) {
    // --- GUARD CLAUSE ---
    if (!this.game || !this.game.course || !this.game.course.currentHole) {
      return null;
    }
    // --- END GUARD CLAUSE ---

    // Validate start position (passed argument - should be world coords)
    if (!worldStartPosition || !(worldStartPosition instanceof THREE.Vector3)) {
      // Try getting from course config as fallback
      worldStartPosition = this.game.course?.getHoleStartPosition();

      if (!worldStartPosition) {
        // If fallback also fails
        worldStartPosition = new THREE.Vector3(0, 0, 0); // Use 0,0,0 base, height added later
      }
    }

    // Clean up existing ball if any
    this.removeBall();

    // Get physics world
    const physicsWorld = this.game.physicsManager.getWorld();
    if (!physicsWorld) {
      return null;
    }

    // Create the Ball instance
    this.ball = new Ball(this.game.scene, physicsWorld, this.game);

    // --- Assign current WORLD Hole Position to the Ball instance ---
    const worldHolePosition = this.game.course?.getHolePosition(); // Already returns WORLD coords

    if (worldHolePosition) {
      this.ball.currentHolePosition = worldHolePosition.clone(); // Store WORLD position
    } else {
      this.ball.currentHolePosition = null;
    }
    // --- End Assignment ---

    // Position the ball at the start position, slightly elevated
    const finalPosition = new THREE.Vector3(
      worldStartPosition.x,
      worldStartPosition.y + Ball.START_HEIGHT,
      worldStartPosition.z
    );
    this.ball.setPosition(finalPosition.x, finalPosition.y, finalPosition.z);

    // Log distance (now using world coordinates)
    if (worldHolePosition) {
      // Distance calculation removed - was unused
    }

    // Wake up the ball's physics body
    if (this.ball.body) {
      this.ball.body.wakeUp();
    } else {
      this.removeBall(); // Clean up partial creation
      return null;
    }

    // Store initial safe position
    this.lastBallPosition.copy(this.ball.mesh.position);

    // Publish the ball created event
    if (this.game.eventManager) {
      const positionClone = this.ball.mesh.position.clone
        ? this.ball.mesh.position.clone()
        : {
            x: this.ball.mesh.position.x,
            y: this.ball.mesh.position.y,
            z: this.ball.mesh.position.z
          };
      this.game.eventManager.publish(
        EventTypes.BALL_CREATED,
        { ball: this.ball, position: positionClone },
        this
      );
    }

    // Update camera to follow new ball
    if (this.game.cameraController) {
      this.game.cameraController.setBall(this.ball);
    }

    return this.ball;
  }

  /**
   * Update ball motion state
   */
  updateBallState() {
    if (!this.ball) {
      return;
    }

    // Previous state
    this.wasMoving = this.game.stateManager.isBallInMotion();

    // Update state based on ball motion
    const isMoving = this.ball.isMoving;
    this.game.stateManager.setBallInMotion(isMoving);

    // If ball is moving, publish ball moved event
    if (isMoving) {
      this.game.eventManager.publish(
        EventTypes.BALL_MOVED,
        {
          position: this.ball.mesh.position.clone(),
          velocity: this.ball.body.velocity.clone()
        },
        this
      );
    }

    // If ball has just stopped and hole not completed
    if (this.wasMoving && !isMoving) {
      // Publish ball stopped event
      this.game.eventManager.publish(
        EventTypes.BALL_STOPPED,
        { position: this.ball.mesh.position.clone() },
        this
      );

      // Update the tee marker at the current ball position
      // this.updateTeeMarker();
    }

    // Debug log for ball physics
    if (this.game.debugManager.enabled && this.ball.body) {
      const velocity = this.ball.body.velocity;
      this.game.debugManager.logBallVelocity(new THREE.Vector3(velocity.x, velocity.y, velocity.z));
    }
  }

  /**
   * Update the ball each frame
   */
  update() {
    if (!this.ball) {
      return;
    }

    // Update ball physics and rendering
    this.ball.update(this.game.deltaTime);

    // Check if ball has fallen below the course
    const outOfBoundYThreshold = -5; // Consider anything below -5 as out of bounds
    if (this.ball.mesh.position.y < outOfBoundYThreshold) {
      // Reset ball to last safe position or start position
      this.resetBall();

      // Publish out of bounds event
      if (this.game.eventManager) {
        this.game.eventManager.publish(
          EventTypes.BALL_OUT_OF_BOUNDS,
          { position: this.ball.mesh.position.clone() },
          this
        );
      }

      // Play sound for out of bounds
      if (this.game.audioManager) {
        this.game.audioManager.playSound('outOfBounds', 0.5);
      }

      return; // Skip remaining update after reset
    }

    // Store last position if ball is safely on the course
    if (this.ball.mesh.position.y > 0) {
      this.lastBallPosition.copy(this.ball.mesh.position);

      // If ball is close to the ground and not in a hazard or falling,
      // store the position as safe
      if (this.ball.mesh.position.y < 0.5) {
        // Store safe position locally
        this.lastSafePosition = this.ball.mesh.position.clone();

        // If hazard manager exists and has the method, update it too
        if (
          this.game.hazardManager &&
          typeof this.game.hazardManager.setLastSafePosition === 'function'
        ) {
          this.game.hazardManager.setLastSafePosition(this.ball.mesh.position.clone());
        }
      }
    }

    // Update UI stroke counter if game is in putting state
    if (this.game.uiManager) {
      this.game.uiManager.updateStrokes();
    }

    // Update ball motion state (moving or stopped)
    this.updateBallState();
  }

  /**
   * Handle a hit on the ball with given direction and power
   * @param {THREE.Vector3} direction - Direction vector
   * @param {number} power - Power of the hit (0-1)
   */
  hitBall(direction, power) {
    if (!this.ball) {
      return;
    }

    // Save last safe position before hitting
    this.lastBallPosition.copy(this.ball.mesh.position);

    // Hit the ball
    this.ball.applyImpulse(direction, power);

    // Increment stroke count
    this.game.scoringSystem.addStroke();

    // Update UI
    this.game.uiManager.updateStrokes();

    // Play hit sound
    this.game.audioManager.playSound('hit');

    // Set ball in motion state
    this.game.stateManager.setBallInMotion(true);

    // Publish ball hit event
    this.game.eventManager.publish(
      EventTypes.BALL_HIT,
      {
        direction: direction.clone(),
        power,
        position: this.ball.mesh.position.clone(),
        strokes: this.game.scoringSystem.getTotalStrokes()
      },
      this
    );
  }

  /**
   * Reset the ball to a specific position
   * @param {THREE.Vector3} [position] - Optional position to reset the ball to. If not provided, uses last safe position or start position.
   */
  resetBall(position) {
    if (!this.ball) {
      return;
    }

    // If no position provided, use last safe position or get world start position from course
    const startPosition = this.game.course?.getHoleStartPosition();
    const resetPosition =
      position ||
      this.lastSafePosition ||
      startPosition ||
      new THREE.Vector3(0, Ball.START_HEIGHT, 0);

    // Elevate Y if using startPosition fallback (which is base Y)
    if (!position && !this.lastSafePosition && startPosition) {
      resetPosition.y += Ball.START_HEIGHT;
    }

    // Reset ball position
    this.ball.setPosition(resetPosition.x, resetPosition.y, resetPosition.z);
    this.ball.resetVelocity();

    // Update last ball position
    this.lastBallPosition.copy(resetPosition);

    // Publish ball reset event
    if (this.game.eventManager) {
      this.game.eventManager.publish(
        EventTypes.BALL_RESET,
        { position: resetPosition.clone() },
        this
      );
    }

    // Log the reset
  }

  /**
   * Handle hazard detection
   */
  handleHazardDetected(event) {
    // const _hazardType = event.get('hazardType'); // Used for debugging
    const penalty = event.get('penalty', 1);

    // Add penalty strokes
    this.game.scoringSystem.addPenaltyStrokes(penalty);

    // Reset ball to safe position
    this.resetBall();
  }

  /**
   * Clean up resources
   */
  cleanup() {
    try {
      // Clean up event subscriptions
      if (this.eventSubscriptions) {
        this.eventSubscriptions.forEach(unsubscribe => unsubscribe());
        this.eventSubscriptions = [];
      }

      // Clean up ball
      if (this.ball) {
        this.ball.cleanup();
        this.ball = null;
      }

      // Reset properties
      this.lastBallPosition.set(0, 0, 0);
      this.wasMoving = false;

      // Reset initialization state
      this.isInitialized = false;

      // Log cleanup
      if (this.game.debugManager) {
        this.game.debugManager.log('BallManager cleaned up');
      }
    } catch (error) {
      // Log cleanup errors
      if (this.game.debugManager) {
        this.game.debugManager.error('BallManager.cleanup', 'Error during cleanup', error);
      }
    }
  }

  /**
   * Handle ball in hole event
   * @param {GameEvent} event - The ball in hole event
   */
  handleBallInHole(_event) {
    if (!this.ball) {
      return;
    }

    // Play ball success effect
    this.ball.handleHoleSuccess();

    // Notify game about ball in hole
    if (this.game.handleBallInHole) {
      this.game.handleBallInHole();
    }
  }

  /**
   * Get current score data
   * @returns {Object} Score data object
   */
  getScoreData() {
    return {
      strokes: this.game.scoringSystem.getTotalStrokes()
    };
  }

  /**
   * Remove the current ball and clean up its resources
   */
  removeBall() {
    if (this.ball) {
      // Remove from physics world
      if (this.ball.body && this.game.physicsManager) {
        this.game.physicsManager.removeBody(this.ball.body);
      }

      // Remove from scene and dispose resources
      if (this.ball.mesh) {
        if (this.ball.mesh.geometry) {
          this.ball.mesh.geometry.dispose();
        }
        if (this.ball.mesh.material) {
          if (Array.isArray(this.ball.mesh.material)) {
            this.ball.mesh.material.forEach(mat => mat.dispose());
          } else {
            this.ball.mesh.material.dispose();
          }
        }
        this.game.scene.remove(this.ball.mesh);
      }

      // --- REMOVE BALL LIGHT ---
      if (this.ball.ballLight) {
        this.game.scene.remove(this.ball.ballLight);
        // No need to dispose PointLight geometry/material usually
      }
      // --- END REMOVE BALL LIGHT ---

      // Clear the reference
      this.ball = null;
    }
  }
}
