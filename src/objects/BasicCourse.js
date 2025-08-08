import * as THREE from 'three';

import { CoursesManager } from '../managers/CoursesManager.js';
import { HoleEntity } from './HoleEntity';

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
    const physicsWorld = game.physicsManager.getWorld();
    if (!physicsWorld) {
      throw new Error('Physics world not available');
    }

    const course = new BasicCourse(game, { physicsWorld });

    const success = await course.initializeHole(0);

    // --- CRITICAL CHECK ---

    // --- END CRITICAL CHECK ---

    if (!success || !course.startPosition || !course.currentHole) {
      throw new Error('Failed to initialize first hole or required state missing');
    }

    return course;
  }

  /**
   * Initialize a specific hole
   * @param {number} holeIndex - The index of the hole to initialize (0-based)
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async initializeHole(holeIndex) {
    if (
      typeof holeIndex !== 'number' ||
      isNaN(holeIndex) ||
      holeIndex < 0 ||
      holeIndex >= this.holeConfigs.length
    ) {
      return false;
    }

    try {
      const holeConfig = this.holeConfigs[holeIndex];
      if (!holeConfig) {
        return false;
      }

      this.currentHole = new HoleEntity(this.physicsWorld, holeConfig, this.scene);

      // Call init() after construction to set up geometry, physics, etc.
      this.currentHole.init();

      // Assume init() is synchronous and successful if no error is thrown
      // We could add error handling in init() if needed
      const initializationSuccess = true;

      if (!initializationSuccess) {
        // Check if init was successful

        this.currentHole = null; // Ensure it's null if initialization failed
        return false;
      }

      this.currentHoleIndex = holeIndex;

      this.setStartPosition(holeConfig.startPosition);

      return true;
    } catch (error) {
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
    if (!position || !(position instanceof THREE.Vector3)) {
      // Do NOT set this.startPosition if invalid
      return;
    }
    this.startPosition = position;
  }

  /**
   * Create a course with the specified hole number
   * @param {number} targetHoleNumber - The hole number to create (1-based)
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async createCourse(targetHoleNumber) {
    // Validate hole number
    if (!targetHoleNumber || targetHoleNumber < 1 || targetHoleNumber > this.holeConfigs.length) {
      return false;
    }

    try {
      // Clear existing hole resources
      await this.clearCurrentHole();

      // Get physics world reference from the manager
      const currentCannonWorld = this.game.physicsManager.getWorld();

      // Simplified Check: Trust getWorld() to return valid world or null
      if (!currentCannonWorld) {
        throw new Error('Physics world is unavailable even after check.');
      }

      // Update the instance's physics world reference *before* initializing hole
      this.physicsWorld = currentCannonWorld;

      // Initialize the new hole (HoleEntity constructor uses this.physicsWorld)
      const holeIndex = targetHoleNumber - 1;
      const success = await this.initializeHole(holeIndex);

      if (!success) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle ball entering hole
   * @param {number} holeIndex - The index of the hole the ball entered
   */
  onBallInHole(holeIndex) {
    // Only process if this is the current hole and we're not already transitioning
    if (holeIndex === this.currentHoleIndex && !this.isTransitioning) {
      this.isHoleComplete = true;
    }
  }

  /**
   * Load the next hole
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async loadNextHole() {
    // Check if we're already transitioning
    if (this.isTransitioning) {
      return false;
    }

    this.isTransitioning = true;

    try {
      // Check if we have more holes
      const nextHoleIndex = this.currentHoleIndex + 1;
      if (nextHoleIndex >= this.totalHoles) {
        return false;
      }

      // Clear current hole and initialize new one
      await this.clearCurrentHole();
      const success = await this.initializeHole(nextHoleIndex);

      if (!success) {
        throw new Error(`Failed to initialize hole ${nextHoleIndex + 1}`);
      }

      // Get the start position from the newly initialized course
      const startPosition = this.startPosition;
      if (!startPosition) {
        throw new Error('Failed to get start position for ball creation');
      }

      // Create new ball *after* course is ready, passing the verified start position
      await this.game.ballManager.createBall(startPosition);

      return true;
    } catch (error) {
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
    if (this.currentHole) {
      this.currentHole.destroy();
      this.currentHole = null;
    }
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
    return hasNext;
  }

  /**
   * Update loop for the course. Called every frame.
   * @param {number} dt - Delta time in seconds
   */
  update(_dt) {
    // Handle deferred hole completion
    if (this.isHoleComplete && !this.pendingHoleTransition) {
      this.pendingHoleTransition = true;

      // Schedule the transition for the next frame
      requestAnimationFrame(async () => {
        try {
          await this.loadNextHole();
        } catch (error) {
          // Error handling removed for production
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
      return null;
    }
    const config = this.holeConfigs[this.currentHoleIndex];
    if (!config || !config.holePosition) {
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
      return null;
    }
    const config = this.holeConfigs[this.currentHoleIndex];
    if (!config || !config.startPosition) {
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
      return 0;
    }
    const config = this.holeConfigs[this.currentHoleIndex];
    if (!config || typeof config.par !== 'number') {
      return 0;
    }
    return config.par;
  }

  // --- End Overrides ---
}
