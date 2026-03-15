import * as THREE from 'three';
import { CoursesManager } from '../managers/CoursesManager.js';
import { HoleEntity } from './HoleEntity';
import { createNineHoleConfigs } from '../config/nineHoleConfigs';
import { debug } from '../utils/debug';

/**
 * NineHoleCourse - A mini golf course with 9 distinct holes.
 */
export class NineHoleCourse extends CoursesManager {
  /**
   * Create a new NineHoleCourse instance
   * @param {object} game - Reference to the main game object
   * @param {object} options - Additional options for initialization
   */
  constructor(game, options = {}) {
    // Call parent constructor first
    super();

    debug.log('[NineHoleCourse] Constructor called.');

    this.game = game;

    // Default options with overrides
    this.options = {
      debug: options.debug || false
      // Note: Any additional options would be merged here
    };

    // Get references to game components
    this.scene = game.scene;
    this.physicsWorld = game.physicsWorld;
    this.debugMode = game.debugMode;

    // NineHoleCourse state setup
    // --- Begin 9 Hole Setup ---
    this.totalHoles = 9; // Restored from 1 to 9 for full course
    debug.log(`[NineHoleCourse] Set totalHoles to ${this.totalHoles}`);

    // Organize geometry and entities using group hierarchy
    this.holeGroups = [];
    this.holeEntities = [];

    for (let i = 0; i < this.totalHoles; i++) {
      const holeGroup = new THREE.Group();
      holeGroup.name = `Hole_${i + 1}_Group`; // Naming for clarity
      // Optionally add metadata
      holeGroup.userData = { holeIndex: i };
      this.scene.add(holeGroup); // Add group to the main scene
      this.holeGroups.push(holeGroup); // Store reference
      debug.log(`[NineHoleCourse] Created and added ${holeGroup.name} to scene.`);
    }
    // --- End 9 Hole Setup ---

    // Define hole configurations for 9 holes - Space Theme
    this.holeConfigs = createNineHoleConfigs();
    // Ensure totalHoles matches the number of configs provided
    if (this.holeConfigs.length !== this.totalHoles) {
      console.warn(
        `[NineHoleCourse] Mismatch between totalHoles (${this.totalHoles}) and provided holeConfigs (${this.holeConfigs.length}). Adjusting totalHoles.`
      );
      this.totalHoles = this.holeConfigs.length;
    }
    debug.log(`[NineHoleCourse] Configured ${this.totalHoles} holes.`);

    // Initialize tracking - start at first hole (index 0)
    this.currentHoleIndex = 0;
    this.currentHoleEntity = null; // Renamed from currentHole to avoid confusion with groups
  }

  /**
   * Static factory method to create and initialize a new NineHoleCourse instance
   * @param {object} game - Reference to the main game object
   * @returns {Promise<NineHoleCourse>} The initialized course instance
   */
  static async create(game) {
    debug.log('[NineHoleCourse.create] Start');
    const physicsWorld = game.physicsManager.getWorld();
    if (!physicsWorld) {
      throw new Error('Physics world not available');
    }

    const course = new NineHoleCourse(game, { physicsWorld });
    debug.log('[NineHoleCourse.create] Instance created with 9 hole groups.');

    debug.log('[NineHoleCourse.create] Awaiting initializeHole(0)...');
    const success = await course.initializeHole(0); // Initialize the first hole
    debug.log(`[NineHoleCourse.create] initializeHole(0) returned: ${success}`);

    // --- CRITICAL CHECK ---
    debug.log('[NineHoleCourse.create] Checking state AFTER initializeHole:');
    debug.log(`  - course.currentHoleIndex: ${course.currentHoleIndex}`);
    debug.log(`  - course.currentHoleEntity: ${course.currentHoleEntity ? 'Exists' : 'NULL'}`);
    debug.log(
      `  - course.startPosition: ${course.startPosition ? course.startPosition.toArray().join(',') : 'UNDEFINED'}`
    );
    // --- END CRITICAL CHECK ---

    if (!success || !course.startPosition || !course.currentHoleEntity) {
      console.error('[NineHoleCourse.create] Initialization failed or state not set correctly!');
      throw new Error('Failed to initialize first hole or required state missing');
    }

    debug.log('[NineHoleCourse.create] End');
    return course;
  }

  /**
   * Initialize a specific hole by index
   * @param {number} holeIndex - Index of the hole to initialize
   * @returns {boolean} Success
   */
  async initializeHole(holeIndex) {
    debug.log(`[NineHoleCourse.initializeHole] Start (Index: ${holeIndex})`);
    try {
      // Validate index
      if (holeIndex < 0 || holeIndex >= this.totalHoles) {
        console.error(`[NineHoleCourse.initializeHole] Invalid hole index: ${holeIndex}`);
        return false;
      }

      // Get hole group and config
      const holeGroup = this.holeGroups[holeIndex];
      const holeConfig = this.holeConfigs[holeIndex];

      // Check if we have a valid configuration
      if (!holeConfig) {
        console.error(
          `[NineHoleCourse.initializeHole] No configuration found for hole ${holeIndex + 1}`
        );
        return false;
      }

      // Verify that the holeGroup is a valid THREE.Group and connected to the scene
      if (!holeGroup || !(holeGroup instanceof THREE.Group)) {
        console.error(`[NineHoleCourse.initializeHole] Invalid holeGroup for index ${holeIndex}`);
        return false;
      }

      // Verify that the holeGroup has a valid parent (the scene)
      if (!holeGroup.parent) {
        console.error(
          '[NineHoleCourse.initializeHole] holeGroup has no parent! Re-adding to scene...'
        );
        // Try to re-add it to the scene
        this.scene.add(holeGroup);
        if (!holeGroup.parent) {
          console.error('[NineHoleCourse.initializeHole] Failed to re-add holeGroup to scene!');
          return false;
        }
      }

      // Get scene and physical world
      const scene = holeGroup; // Use the group as the "scene"
      const physicsWorld = this.game.physicsManager.getWorld();

      debug.log(
        `[NineHoleCourse.initializeHole] Found config for hole ${holeIndex + 1}: ${holeConfig.description}`
      );

      // If we already have a hole entity for this hole, just make it visible
      if (this.currentHoleEntity && this.currentHoleEntity.config.index === holeIndex) {
        debug.log(
          `[NineHoleCourse.initializeHole] Hole ${holeIndex + 1} already initialized, making visible.`
        );
        // Just ensure it's visible
        this.holeGroups[holeIndex].visible = true;

        // Set as current hole index
        this.currentHoleIndex = holeIndex;
        this.currentHole = this.currentHoleEntity; // Set currentHole for BallManager compatibility
        return true;
      }

      // Hide all hole groups first
      this.holeGroups.forEach(group => {
        group.visible = false;
      });

      // Create a new HoleEntity for this hole
      debug.log(
        `[NineHoleCourse.initializeHole] Creating HoleEntity for hole ${holeIndex + 1}...`
      );
      try {
        this.currentHoleEntity = new HoleEntity(physicsWorld, holeConfig, scene);

        // Initialize the hole (create visual and physics elements)
        await this.currentHoleEntity.init();

        debug.log(
          `[NineHoleCourse.initializeHole] Called HoleEntity.init() for hole ${holeIndex + 1}`
        );
      } catch (error) {
        console.error(
          `[NineHoleCourse.initializeHole] Failed to create or initialize HoleEntity: ${error.message}`
        );
        return false;
      }

      // Make the current hole group visible
      holeGroup.visible = true;
      debug.log(`[NineHoleCourse.initializeHole] Made ${holeGroup.name} visible.`);

      // Set current hole
      this.currentHoleIndex = holeIndex;
      this.currentHole = this.currentHoleEntity; // Set currentHole for BallManager compatibility
      debug.log(`[NineHoleCourse.initializeHole] Set currentHoleIndex: ${holeIndex}`);

      // Set start position for the ball
      debug.log('[NineHoleCourse.initializeHole] Calling setStartPosition...');
      this.setStartPosition(holeConfig.startPosition);
      debug.log('[NineHoleCourse.initializeHole] Returned from setStartPosition.');

      debug.log('[NineHoleCourse.initializeHole] End (Success: true)');
      return true;
    } catch (error) {
      console.error(
        `[NineHoleCourse.initializeHole] Error initializing hole ${holeIndex + 1}:`,
        error
      );
      debug.log('[NineHoleCourse.initializeHole] End (Success: false)');
      return false;
    }
  }

  /**
   * Set the start position for the current hole
   * @param {THREE.Vector3} position - The start position
   */
  setStartPosition(position) {
    debug.log('[NineHoleCourse.setStartPosition] Start');
    if (!position || !(position instanceof THREE.Vector3)) {
      console.error('[NineHoleCourse.setStartPosition] Invalid position received:', position);
      debug.log('[NineHoleCourse.setStartPosition] End (Invalid)');
      return;
    }
    // This sets the *course's* overall start position, used by BallManager
    this.startPosition = position.clone();
    debug.log(
      '[NineHoleCourse.setStartPosition] Set course startPosition to:',
      this.startPosition.toArray().join(',')
    );
    debug.log('[NineHoleCourse.setStartPosition] End (Success)');
  }

  /**
   * Creates or loads the specified hole. (Currently just calls initializeHole)
   * @param {number} targetHoleNumber - The hole number to create (1-based)
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async createCourse(targetHoleNumber) {
    debug.log(`[NineHoleCourse] Creating course for hole #${targetHoleNumber}`);

    if (!targetHoleNumber || targetHoleNumber < 1 || targetHoleNumber > this.totalHoles) {
      console.error(`[NineHoleCourse] Invalid hole number: ${targetHoleNumber}`);
      return false;
    }

    try {
      // Clear existing hole resources before initializing new one
      await this.clearCurrentHole();

      const holeIndex = targetHoleNumber - 1;
      const success = await this.initializeHole(holeIndex);

      if (!success) {
        console.error(`[NineHoleCourse] Failed to initialize hole #${targetHoleNumber}`);
        return false;
      }

      debug.log(`[NineHoleCourse] Successfully prepared hole #${targetHoleNumber}`);
      return true;
    } catch (error) {
      console.error('[NineHoleCourse] Error creating course:', error);
      return false;
    }
  }

  /**
   * Handle ball entering hole
   * @param {number} holeIndex - The index of the hole the ball entered
   */
  onBallInHole(holeIndex) {
    debug.log(`[NineHoleCourse] Ball entered hole ${holeIndex + 1}`);

    // Only process if this is the current hole and we're not already transitioning
    if (holeIndex === this.currentHoleIndex && !this.isTransitioning) {
      debug.log('[NineHoleCourse] Setting hole completion flag');
      this.isHoleComplete = true;
    } else {
      debug.log('[NineHoleCourse] Ignoring ball in hole - already transitioning or wrong hole', {
        currentHole: this.currentHoleIndex,
        ballHole: holeIndex,
        isTransitioning: this.isTransitioning
      });
    }
  }

  /**
   * Load the next hole in the 9-hole sequence.
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async loadNextHole() {
    if (this.isTransitioning) {
      console.warn('[NineHoleCourse] Already transitioning to next hole, ignoring request');
      return false;
    }

    debug.log('[NineHoleCourse] Attempting to load next hole');
    this.isTransitioning = true;

    try {
      const nextHoleIndex = this.currentHoleIndex + 1;
      if (nextHoleIndex >= this.totalHoles) {
        console.warn('[NineHoleCourse] No more holes available. End of course.');
        // Handle end of game scenario here? e.g., show final scorecard
        this.game.stateManager.setState('GAME_OVER'); // Example state
        return false; // Indicate no *new* hole was loaded
      }

      debug.log(
        `[NineHoleCourse] Transitioning from hole ${this.currentHoleIndex + 1} to ${nextHoleIndex + 1}`
      );

      // Clear current hole and initialize new one
      await this.clearCurrentHole();
      const success = await this.initializeHole(nextHoleIndex);

      if (!success) {
        throw new Error(`Failed to initialize hole ${nextHoleIndex + 1}`);
      }

      // Get the start position from the newly initialized course/hole config
      const startPosition = this.startPosition; // Reads the position set by initializeHole
      if (!startPosition) {
        console.error(
          `[NineHoleCourse] Start position not set after initializing hole ${nextHoleIndex + 1}`
        );
        throw new Error('Failed to get start position for ball creation');
      }

      // Reset ball using BallManager, which should use this.startPosition
      await this.game.ballManager.resetBall(startPosition);
      debug.log('[NineHoleCourse] Ball reset to start position for new hole.');

      debug.log(`[NineHoleCourse] Successfully loaded hole ${nextHoleIndex + 1}`);
      return true;
    } catch (error) {
      console.error('[NineHoleCourse] Failed to load next hole:', error);
      return false;
    } finally {
      // Always reset flags
      this.isTransitioning = false;
      this.isHoleComplete = false;
    }
  }

  /**
   * Clear the current hole's resources (visuals, physics).
   * Makes the corresponding THREE.Group invisible.
   */
  clearCurrentHole() {
    debug.log(`[NineHoleCourse] Clearing resources for hole ${this.currentHoleIndex + 1}`);

    // Destroy the HoleEntity (which should clean up its CANNON bodies)
    if (this.currentHoleEntity) {
      this.currentHoleEntity.destroy();
      this.currentHoleEntity = null;
      this.currentHole = null; // Also clear the currentHole reference
      debug.log('[NineHoleCourse] Destroyed current HoleEntity.');
    } else {
      console.warn('[NineHoleCourse] No current HoleEntity to destroy.');
    }

    // Hide the THREE.Group associated with the hole
    if (this.currentHoleIndex >= 0 && this.currentHoleIndex < this.holeGroups.length) {
      const holeGroup = this.holeGroups[this.currentHoleIndex];
      if (holeGroup) {
        holeGroup.visible = false;
        // Don't remove the group from the scene - just make it invisible
        // This keeps the parent references intact
        debug.log(`[NineHoleCourse] Made ${holeGroup.name} invisible.`);
      } else {
        console.warn(
          `[NineHoleCourse] No THREE.Group found for index ${this.currentHoleIndex} to hide.`
        );
      }
    } else {
      console.warn(
        `[NineHoleCourse] Invalid currentHoleIndex (${this.currentHoleIndex}) for hiding group.`
      );
    }

    debug.log('[NineHoleCourse] Hole resource cleanup complete');
    // Note: We resolve immediately, actual async cleanup might need Promises
    return Promise.resolve();
  }

  /**
   * Get the current hole number (1-based index for display)
   * @returns {number} The current hole number
   */
  getCurrentHoleNumber() {
    return this.currentHoleIndex + 1;
  }

  /**
   * Get the current hole configuration
   * @returns {Object | null} The current hole configuration or null
   */
  getCurrentHoleConfig() {
    if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holeConfigs.length) {
      console.warn(`[NineHoleCourse] Invalid hole index: ${this.currentHoleIndex}`);
      return null;
    }
    return this.holeConfigs[this.currentHoleIndex];
  }

  /**
   * Check if there is a next hole available
   * @returns {boolean} True if there is a next hole, false otherwise
   */
  hasNextHole() {
    const hasNext = this.currentHoleIndex < this.totalHoles - 1;
    debug.log(
      `[NineHoleCourse] Checking for next hole: ${hasNext} (current: ${this.currentHoleIndex + 1}, total: ${this.totalHoles})`
    );
    return hasNext;
  }

  /**
   * Update loop for the course. Handles deferred hole transitions.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Handle deferred hole completion transition
    if (this.isHoleComplete && !this.pendingHoleTransition && !this.isTransitioning) {
      debug.log('[NineHoleCourse] Processing deferred hole completion');
      this.pendingHoleTransition = true; // Prevents re-triggering

      // Schedule the transition for the next frame/tick to avoid issues during physics step etc.
      requestAnimationFrame(async () => {
        try {
          await this.loadNextHole();
        } catch (error) {
          console.error('[NineHoleCourse] Failed to transition to next hole:', error);
          // Consider resetting state or showing an error message
        } finally {
          // Reset flags whether successful or not, managed within loadNextHole now
          this.pendingHoleTransition = false; // Allow completion processing again
        }
      });
    }

    // Update the current HoleEntity if it exists and has an update method
    if (this.currentHoleEntity && typeof this.currentHoleEntity.update === 'function') {
      this.currentHoleEntity.update(dt);
    }
  }

  // --- Overrides/Implementations for CoursesManager methods ---

  /**
   * Get the current hole position (WORLD coordinates) from the config
   * @returns {THREE.Vector3 | null}
   */
  getHolePosition() {
    const config = this.getCurrentHoleConfig();
    if (!config || !config.holePosition) {
      console.warn(
        `[NineHoleCourse] Config or holePosition missing for index ${this.currentHoleIndex}.`
      );
      return null;
    }
    return config.holePosition;
  }

  /**
   * Get the current hole's start position from the config
   * @returns {THREE.Vector3 | null}
   */
  getHoleStartPosition() {
    const config = this.getCurrentHoleConfig();
    if (!config || !config.startPosition) {
      console.warn(
        `[NineHoleCourse] Config or startPosition missing for index ${this.currentHoleIndex}.`
      );
      return null;
    }
    return config.startPosition;
  }

  /**
   * Get the current hole's par from the config
   * @returns {number} Par or 0 if unavailable
   */
  getHolePar() {
    const config = this.getCurrentHoleConfig();
    if (!config || typeof config.par !== 'number') {
      console.warn(
        `[NineHoleCourse] Config or par missing/invalid for index ${this.currentHoleIndex}.`
      );
      return 0; // Default par
    }
    return config.par;
  }

  // --- End Overrides ---
}
