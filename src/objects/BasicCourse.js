import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CoursesManager } from '../managers/CoursesManager.js';
import { HoleEntity } from './HoleEntity';
import { debug } from '../utils/debug';

/**
 * BasicCourse - A mini golf course in space with support for multiple holes
 */
export class BasicCourse extends CoursesManager {
  /**
   * Create a new BasicCourse instance
   * @param {object} game - Reference to the main game object
   * @param {object} options - Additional options for initialization
   */
  constructor(game, options = {}) {
    // Call parent constructor first with provided options or defaults
    super(game.scene, options.physicsWorld, {
      game,
      startPosition: new THREE.Vector3(0, 0, 8),
      autoCreate: false,
      ...options
    });

    // Now we can safely access this
    this.game = game;
    this.scene = game.scene;

    // Add hole completion state tracking
    this.isHoleComplete = false;
    this.pendingHoleTransition = false;
    this.isTransitioning = false;

    // Define hole configurations - flat layout
    this.holeConfigs = [
      // Hole 1 - Straight shot
      {
        index: 0,
        holePosition: new THREE.Vector3(0, 0, -8),
        startPosition: new THREE.Vector3(0, 0, 8),
        courseWidth: 4,
        courseLength: 20,
        par: 3,
        description: 'Straight Shot'
      },
      // Hole 2 - Dogleg right with snowman bunker
      {
        index: 1,
        holePosition: new THREE.Vector3(4, 0, 8),
        startPosition: new THREE.Vector3(0, 0, -8),
        courseWidth: 6,
        courseLength: 24,
        par: 4,
        description: 'Dogleg Right with Snowman Bunker',
        hazards: [
          {
            type: 'sand',
            shape: 'compound',
            depth: 0.25,
            position: new THREE.Vector3(2, 0, 0), // Centered in the dogleg
            subShapes: [
              // Head (smaller circle)
              { position: { x: 0, z: 1.2 }, radius: 1.0 },
              // Body (larger circle)
              { position: { x: 0, z: -0.8 }, radius: 1.5 }
            ]
          }
        ]
      },
      // Hole 3 - L-Shape using Boundary Walls - RENAME to Copy of Hole 2 w/ Water
      {
        index: 2,
        // Copy layout details from Hole 2 (Dogleg Right)
        holePosition: new THREE.Vector3(4, 0, 8), // Same as Hole 2
        startPosition: new THREE.Vector3(0, 0, -8), // Same as Hole 2
        courseWidth: 6, // Same as Hole 2
        courseLength: 24, // Same as Hole 2
        par: 4, // Same as Hole 2
        description: 'Dogleg Right with Water Hazard', // Updated description
        // Remove boundaryWalls if they exist from previous attempts
        // boundaryWalls: [ ... ],
        hazards: [
          {
            // Change type to 'water', keep shape and position
            type: 'water',
            shape: 'compound',
            // Depth might be less relevant for water visuals/triggers, but keep for consistency?
            depth: 0.15, // Shallow water depth visual/trigger height
            position: new THREE.Vector3(2, 0, 0), // Same position as Hole 2 bunker
            subShapes: [
              // Same snowman shape
              { position: { x: 0, z: 1.2 }, radius: 1.0 },
              { position: { x: 0, z: -0.8 }, radius: 1.5 }
            ]
          }
        ]
      }
    ];

    // Set total holes from configs
    this.totalHoles = this.holeConfigs.length;
    debug.log(`[BasicCourse] Configured ${this.totalHoles} holes`);

    // Initialize tracking - start at first hole (index 0)
    this.currentHoleIndex = 0;
    this.currentHole = null;
  }

  /**
   * Static factory method to create and initialize a new BasicCourse instance
   * @param {object} game - Reference to the main game object
   * @returns {Promise<BasicCourse>} The initialized course instance
   */
  static async create(game) {
    debug.log('[BasicCourse.create] Start');
    const physicsWorld = game.physicsManager.getWorld();
    if (!physicsWorld) {
      throw new Error('Physics world not available');
    }

    const course = new BasicCourse(game, { physicsWorld });
    debug.log('[BasicCourse.create] Instance created');

    debug.log('[BasicCourse.create] Awaiting initializeHole(0)...');
    const success = await course.initializeHole(0);
    debug.log(`[BasicCourse.create] initializeHole(0) returned: ${success}`);

    // --- CRITICAL CHECK ---
    debug.log('[BasicCourse.create] Checking state AFTER initializeHole:');
    debug.log(`  - course.currentHoleIndex: ${course.currentHoleIndex}`);
    debug.log(`  - course.currentHole: ${course.currentHole ? 'Exists' : 'NULL'}`);
    debug.log(
      `  - course.startPosition: ${course.startPosition ? course.startPosition.toArray().join(',') : 'UNDEFINED'}`
    );
    // --- END CRITICAL CHECK ---

    if (!success || !course.startPosition || !course.currentHole) {
      console.error('[BasicCourse.create] Initialization failed or state not set correctly!');
      throw new Error('Failed to initialize first hole or required state missing');
    }

    debug.log('[BasicCourse.create] End');
    return course;
  }

  /**
   * Initialize a specific hole
   * @param {number} holeIndex - The index of the hole to initialize (0-based)
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async initializeHole(holeIndex) {
    debug.log(`[BasicCourse.initializeHole] Start (Index: ${holeIndex})`);
    if (
      typeof holeIndex !== 'number' ||
      isNaN(holeIndex) ||
      holeIndex < 0 ||
      holeIndex >= this.holeConfigs.length
    ) {
      console.error(`[BasicCourse.initializeHole] Invalid index: ${holeIndex}`);
      return false;
    }

    try {
      const holeConfig = this.holeConfigs[holeIndex];
      if (!holeConfig) {
        console.error(`[BasicCourse.initializeHole] No config for index ${holeIndex}`);
        return false;
      }
      debug.log(`[BasicCourse.initializeHole] Found config for hole ${holeIndex + 1}`);

      debug.log('[BasicCourse.initializeHole] Creating HoleEntity...');
      this.currentHole = new HoleEntity(this.physicsWorld, holeConfig, this.scene);

      // Call init() after construction to set up geometry, physics, etc.
      this.currentHole.init();
      debug.log('[BasicCourse.initializeHole] Called HoleEntity.init()');

      // Assume init() is synchronous and successful if no error is thrown
      // We could add error handling in init() if needed
      const initializationSuccess = true;

      if (!initializationSuccess) {
        // Check if init was successful
        console.error('[BasicCourse.initializeHole] Failed to initialize HoleEntity');
        this.currentHole = null; // Ensure it's null if initialization failed
        return false;
      }

      this.currentHoleIndex = holeIndex;
      debug.log(`[BasicCourse.initializeHole] Set currentHoleIndex: ${this.currentHoleIndex}`);

      debug.log('[BasicCourse.initializeHole] Calling setStartPosition...');
      this.setStartPosition(holeConfig.startPosition);
      debug.log('[BasicCourse.initializeHole] Returned from setStartPosition.');

      debug.log('[BasicCourse.initializeHole] End (Success: true)');
      return true;
    } catch (error) {
      console.error(`[BasicCourse.initializeHole] Error for index ${holeIndex}:`, error);
      this.currentHole = null; // Ensure null on error
      this.startPosition = undefined; // Ensure undefined on error
      return false;
    }
  }

  /**
   * Set the start position for the current hole
   * @param {THREE.Vector3} position - The start position
   */
  setStartPosition(position) {
    debug.log('[BasicCourse.setStartPosition] Start');
    if (!position || !(position instanceof THREE.Vector3)) {
      console.error('[BasicCourse.setStartPosition] Invalid position received:', position);
      // Do NOT set this.startPosition if invalid
      debug.log('[BasicCourse.setStartPosition] End (Invalid)');
      return;
    }
    this.startPosition = position;
    debug.log(
      '[BasicCourse.setStartPosition] Set this.startPosition to:',
      this.startPosition.toArray().join(',')
    );
    debug.log('[BasicCourse.setStartPosition] End (Success)');
  }

  /**
   * Create a course with the specified hole number
   * @param {number} targetHoleNumber - The hole number to create (1-based)
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async createCourse(targetHoleNumber) {
    debug.log(`[BasicCourse] Creating course for hole #${targetHoleNumber}`);

    // Validate hole number
    if (!targetHoleNumber || targetHoleNumber < 1 || targetHoleNumber > this.holeConfigs.length) {
      console.error(`[BasicCourse] Invalid hole number: ${targetHoleNumber}`);
      return false;
    }

    try {
      // Clear existing hole resources
      await this.clearCurrentHole();

      // Get physics world reference from the manager
      const currentCannonWorld = this.game.physicsManager.getWorld();

      // Simplified Check: Trust getWorld() to return valid world or null
      if (!currentCannonWorld) {
        console.error(
          '[BasicCourse] Failed to get valid physics world from manager. Aborting hole creation.'
        );
        throw new Error('Physics world is unavailable even after check.');
      }

      // Update the instance's physics world reference *before* initializing hole
      this.physicsWorld = currentCannonWorld;
      debug.log('[BasicCourse] Updated instance physicsWorld reference.');

      // Initialize the new hole (HoleEntity constructor uses this.physicsWorld)
      const holeIndex = targetHoleNumber - 1;
      const success = await this.initializeHole(holeIndex);

      if (!success) {
        console.error(`[BasicCourse] Failed to initialize hole #${targetHoleNumber}`);
        return false;
      }

      debug.log(`[BasicCourse] Successfully created hole #${targetHoleNumber}`);
      return true;
    } catch (error) {
      console.error('[BasicCourse] Error creating course:', error);
      return false;
    }
  }

  /**
   * Handle ball entering hole
   * @param {number} holeIndex - The index of the hole the ball entered
   */
  onBallInHole(holeIndex) {
    debug.log(`[BasicCourse] Ball entered hole ${holeIndex + 1}`);

    // Only process if this is the current hole and we're not already transitioning
    if (holeIndex === this.currentHoleIndex && !this.isTransitioning) {
      debug.log('[BasicCourse] Setting hole completion flag');
      this.isHoleComplete = true;
    } else {
      debug.log('[BasicCourse] Ignoring ball in hole - already transitioning or wrong hole', {
        currentHole: this.currentHoleIndex,
        ballHole: holeIndex,
        isTransitioning: this.isTransitioning
      });
    }
  }

  /**
   * Load the next hole
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async loadNextHole() {
    // Check if we're already transitioning
    if (this.isTransitioning) {
      console.warn('[BasicCourse] Already transitioning to next hole, ignoring request');
      return false;
    }

    debug.log('[BasicCourse] Attempting to load next hole');
    this.isTransitioning = true;

    try {
      // Check if we have more holes
      const nextHoleIndex = this.currentHoleIndex + 1;
      if (nextHoleIndex >= this.totalHoles) {
        console.warn('[BasicCourse] No more holes available');
        return false;
      }

      debug.log(
        `[BasicCourse] Transitioning from hole ${this.currentHoleIndex + 1} to ${nextHoleIndex + 1}`
      );

      // Clear current hole and initialize new one
      await this.clearCurrentHole();
      const success = await this.initializeHole(nextHoleIndex);

      if (!success) {
        throw new Error(`Failed to initialize hole ${nextHoleIndex + 1}`);
      }

      // Get the start position from the newly initialized course
      const startPosition = this.startPosition;
      if (!startPosition) {
        console.error(
          `[BasicCourse] Start position not set after initializing hole ${nextHoleIndex + 1}`
        );
        throw new Error('Failed to get start position for ball creation');
      }

      // Create new ball *after* course is ready, passing the verified start position
      await this.game.ballManager.createBall(startPosition);

      debug.log(`[BasicCourse] Successfully loaded hole ${nextHoleIndex + 1}`);
      return true;
    } catch (error) {
      console.error('[BasicCourse] Failed to load next hole:', error);
      return false;
    } finally {
      // Always reset flags
      this.isTransitioning = false;
      this.isHoleComplete = false;
    }
  }

  /**
   * Clear the current hole and its resources
   */
  clearCurrentHole() {
    debug.log('[BasicCourse] Clearing current hole resources');

    if (this.currentHole) {
      this.currentHole.destroy();
      this.currentHole = null;
    }

    debug.log('[BasicCourse] Cleanup complete');
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
   * @returns {Object} The current hole configuration
   */
  getCurrentHoleConfig() {
    if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holeConfigs.length) {
      console.warn(`[BasicCourse] Invalid hole index: ${this.currentHoleIndex}`);
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
      `[BasicCourse] Checking for next hole: ${hasNext} (current: ${this.currentHoleIndex + 1}, total: ${this.totalHoles})`
    );
    return hasNext;
  }

  /**
   * Update loop for the course. Called every frame.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Handle deferred hole completion
    if (this.isHoleComplete && !this.pendingHoleTransition) {
      debug.log('[BasicCourse] Processing deferred hole completion');
      this.pendingHoleTransition = true;

      // Schedule the transition for the next frame
      requestAnimationFrame(async () => {
        try {
          await this.loadNextHole();
        } catch (error) {
          console.error('[BasicCourse] Failed to transition to next hole:', error);
        } finally {
          this.isHoleComplete = false;
          this.pendingHoleTransition = false;
        }
      });
    }
  }

  // --- Overrides for CoursesManager methods ---

  /**
   * Get the current hole position (using holeConfigs)
   * @returns {THREE.Vector3 | null} The current hole's position or null if unavailable
   */
  getHolePosition() {
    if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holeConfigs.length) {
      console.warn(
        `[BasicCourse] Invalid hole index (${this.currentHoleIndex}) for getting position.`
      );
      return null;
    }
    const config = this.holeConfigs[this.currentHoleIndex];
    if (!config || !config.holePosition) {
      console.warn(
        `[BasicCourse] Config or holePosition missing for index ${this.currentHoleIndex}.`
      );
      return null;
    }
    return config.holePosition;
  }

  /**
   * Get the current hole's start position (using holeConfigs)
   * @returns {THREE.Vector3 | null} The current hole's start position or null if unavailable
   */
  getHoleStartPosition() {
    if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holeConfigs.length) {
      console.warn(
        `[BasicCourse] Invalid hole index (${this.currentHoleIndex}) for getting start position.`
      );
      return null;
    }
    const config = this.holeConfigs[this.currentHoleIndex];
    if (!config || !config.startPosition) {
      console.warn(
        `[BasicCourse] Config or startPosition missing for index ${this.currentHoleIndex}.`
      );
      return null;
    }
    // Return the specific start position stored in the config for the current hole
    return config.startPosition;
  }

  /**
   * Get the current hole's par (using holeConfigs)
   * @returns {number} The current hole's par or 0 if unavailable
   */
  getHolePar() {
    if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holeConfigs.length) {
      console.warn(`[BasicCourse] Invalid hole index (${this.currentHoleIndex}) for getting par.`);
      return 0;
    }
    const config = this.holeConfigs[this.currentHoleIndex];
    if (!config || typeof config.par !== 'number') {
      console.warn(
        `[BasicCourse] Config or par missing/invalid for index ${this.currentHoleIndex}.`
      );
      return 0;
    }
    return config.par;
  }

  // --- End Overrides ---
}
