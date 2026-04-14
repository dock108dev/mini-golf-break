import * as THREE from 'three';
import { EventTypes } from '../events/EventTypes';

/**
 * HazardManager - Handles hazard detection and responses (water, out-of-bounds)
 * Extracts hazard management from Game.js to improve modularity
 */
export class HazardManager {
  constructor(game) {
    // Reference to the main game
    this.game = game;

    // Safe position reference
    this.lastSafePosition = new THREE.Vector3();
    this.defaultBounds = {
      minX: -50,
      maxX: 50,
      minZ: -50,
      maxZ: 50,
      minY: -10
    };
    this.boundaryLimits = { ...this.defaultBounds };

    // Hazard tracking
    this.hazards = [];
    this.eventSubscriptions = [];

    // Performance optimization
    this.checkFrequency = 5; // Check every 5 frames
    this.frameCount = 0;

    // Double-penalty guard (500ms debounce)
    this.lastOobTime = 0;
    this.oobCooldownMs = 500;

    // State tracking
    this.isInitialized = false;
  }

  /**
   * Initialize the hazard manager
   */
  init() {
    // Initialize last safe position with a default value
    this.lastSafePosition = new THREE.Vector3(0, 0, 0);
    this.lastOobTime = 0;
    this.setupEventListeners();
    this.isInitialized = true;
    return this;
  }

  /**
   * Set per-hole OOB boundaries from hole config.
   * Falls back to default ±50 / -10 when outOfBounds is absent.
   */
  setHoleBounds(holeConfig) {
    if (holeConfig?.outOfBounds) {
      const oob = holeConfig.outOfBounds;
      this.boundaryLimits = {
        minX: typeof oob.minX === 'number' ? oob.minX : this.defaultBounds.minX,
        maxX: typeof oob.maxX === 'number' ? oob.maxX : this.defaultBounds.maxX,
        minZ: typeof oob.minZ === 'number' ? oob.minZ : this.defaultBounds.minZ,
        maxZ: typeof oob.maxZ === 'number' ? oob.maxZ : this.defaultBounds.maxZ,
        minY: typeof oob.minY === 'number' ? oob.minY : this.defaultBounds.minY
      };
    } else {
      this.boundaryLimits = { ...this.defaultBounds };
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Prevent duplicate subscriptions
    if (this.eventSubscriptions.length > 0) {
      return;
    }

    // Listen for ball hit events to update the last safe position
    const sub1 = this.game.eventManager.subscribe(
      EventTypes.BALL_STOPPED,
      this.handleBallStopped,
      this
    );
    this.eventSubscriptions.push(sub1);

    // Listen for ball created events
    const sub2 = this.game.eventManager.subscribe(
      EventTypes.BALL_CREATED,
      this.handleBallCreated,
      this
    );
    this.eventSubscriptions.push(sub2);

    // Listen for ball moved events to check hazards
    const sub3 = this.game.eventManager.subscribe(
      EventTypes.BALL_MOVED,
      this.handleBallMoved,
      this
    );
    this.eventSubscriptions.push(sub3);
  }

  /**
   * Handle ball stopped event
   * @param {GameEvent} event - Ball stopped event
   */
  handleBallStopped(event) {
    const position = event.get('position');
    if (position) {
      this.updateLastSafePosition(position);
    }
  }

  /**
   * Handle ball created event
   * @param {GameEvent} event - Ball created event
   */
  handleBallCreated(event) {
    const position = event.get('position');
    if (position) {
      this.updateLastSafePosition(position);
    }
  }

  /**
   * Handle ball moved event
   * @param {GameEvent} event - Ball moved event
   */
  handleBallMoved(_event) {
    // Check if the ball is in a hazard
    this.checkHazards();
  }

  /**
   * Update the last safe position
   * @param {THREE.Vector3} position - Safe position to store
   */
  updateLastSafePosition(position) {
    // Don't update if position is in a hazard
    if (this.isPositionInHazard(position)) {
      return;
    }

    this.lastSafePosition.copy(position);
  }

  /**
   * Check if the position is in any hazard
   * @param {THREE.Vector3} position - Position to check
   * @returns {boolean} True if in a hazard
   */
  isPositionInHazard(position) {
    return this.isPositionOutOfBounds(position);
  }

  /**
   * Check if the ball is in any hazards
   */
  checkHazards() {
    if (!this.game.ballManager || !this.game.ballManager.ball) {
      return false;
    }

    const ball = this.game.ballManager.ball;
    const position = ball.mesh.position;

    // Check if ball is below minimum height (lost ball)
    if (position.y < this.boundaryLimits.minY) {
      this.handleBallOutOfBounds();
      return true;
    }

    // Check if ball is out of bounds
    if (this.isPositionOutOfBounds(position)) {
      this.handleBallOutOfBounds();
      return true;
    }

    return false;
  }

  /**
   * Check if position is outside the course boundaries
   * @param {THREE.Vector3} position - Position to check
   * @returns {boolean} True if out of bounds
   */
  isPositionOutOfBounds(position) {
    return (
      position.x < this.boundaryLimits.minX ||
      position.x > this.boundaryLimits.maxX ||
      position.z < this.boundaryLimits.minZ ||
      position.z > this.boundaryLimits.maxZ
    );
  }

  /**
   * Handle the ball going out of bounds
   */
  handleBallOutOfBounds() {
    const now = Date.now();
    if (now - this.lastOobTime < this.oobCooldownMs) {
      return;
    }
    this.lastOobTime = now;

    this.game.debugManager.log('Ball out of bounds - applying penalty');

    // Show message to player
    this.game.uiManager.showMessage('Out of bounds! +1 stroke penalty.', 2000);

    // Publish hazard detected event
    this.game.eventManager.publish(
      EventTypes.HAZARD_DETECTED,
      {
        hazardType: 'outOfBounds',
        penalty: 1,
        lastSafePosition: this.lastSafePosition.clone()
      },
      this
    );
  }

  /**
   * Clear all hazards from the manager
   */
  clearHazards() {
    this.hazards = [];
  }

  /**
   * Update method called by game loop
   */
  update() {
    // Only check hazards if initialized and ball exists
    if (!this.isInitialized || !this.game.ballManager?.ball) {
      return;
    }

    // Increment frame counter
    this.frameCount++;

    // Only check hazards at specified frequency
    if (this.frameCount >= this.checkFrequency) {
      this.checkHazards();
      this.frameCount = 0;
    }
  }

  /**
   * Publish hazard detected event
   * @param {Object} hazardData - Hazard information
   */
  publishHazardDetected(hazardData) {
    this.game.eventManager.publish(EventTypes.HAZARD_DETECTED, hazardData, this);
  }

  /**
   * Publish out of bounds event
   * @param {Object} position - Position where ball went out of bounds
   */
  publishOutOfBounds(position) {
    this.game.eventManager.publish(
      EventTypes.HAZARD_DETECTED,
      { hazardType: 'outOfBounds', position },
      this
    );
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Unsubscribe from events
    this.eventSubscriptions.forEach(unsubscribe => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.eventSubscriptions = [];

    // Clear hazards
    this.clearHazards();

    // Reset state
    this.lastOobTime = 0;
    this.isInitialized = false;
  }
}
