import * as THREE from 'three';
import { CoursesManager } from '../managers/CoursesManager.js';
import { HoleEntity } from './HoleEntity';
import { debug } from '../utils/debug';
import {
  createCircularShape,
  createKidneyShape,
  createLShape,
  createTriangleShape,
  createFigure8Shape,
  createStarShape,
  createSpiralShape,
  createCrossShape,
  createDiamondShape,
  createSnakeShape
} from '../utils/holeShapes';

/**
 * NineHoleCourse - A mini golf course with 9 distinct holes.
 * Each hole has unique space-themed challenges and obstacles.
 *
 * @class NineHoleCourse
 * @extends CoursesManager
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

    // Define hole configurations for 9 holes - Space Theme with VARIED SIZES and SHAPES
    this.holeConfigs = [
      // 🚀 1. Launch Pad - Simple circular shape for beginners
      {
        index: 0,
        description: '1. Launch Pad - Circular',
        par: 2,
        // Perfect circle for a gentle introduction
        shapeType: 'circle',
        shapeParams: { radiusX: 5, radiusZ: 5 },
        startPosition: new THREE.Vector3(0, 0, 3.5), // World
        holePosition: new THREE.Vector3(0, 0, -3.5), // World
        hazards: [], // Clean launch!
        bumpers: []
      },
      // 🌙 2. Lunar Bend - Kidney/bean shape for gentle curves
      {
        index: 1,
        description: '2. Lunar Bend - Kidney Shape',
        par: 3,
        // Kidney/bean shape for flowing curves
        shapeType: 'kidney',
        shapeParams: { width: 6, height: 8 },
        startPosition: new THREE.Vector3(-4, 0, 5), // World
        holePosition: new THREE.Vector3(4, 0, -5), // World
        hazards: [
          {
            type: 'sand',
            shape: 'circle',
            position: new THREE.Vector3(0, 0, 0), // World
            size: { radius: 1.5 },
            depth: 0.1
          }
        ],
        bumpers: []
      },
      // ☄️ 3. Asteroid Belt - L-shape for strategic corners
      {
        index: 2,
        description: '3. Asteroid Belt - L-Shape',
        par: 3,
        // L-shaped boundary for corner navigation
        shapeType: 'lshape',
        shapeParams: { width: 12, height: 12, thickness: 4 },
        startPosition: new THREE.Vector3(-5, 0, -5), // World - bottom left corner
        holePosition: new THREE.Vector3(5, 0, 5), // World - top right corner
        hazards: [
          {
            type: 'water', // Space void at the corner
            shape: 'rectangle',
            position: new THREE.Vector3(-2, 0, 2), // World
            size: { width: 3, length: 3 },
            depth: 0.15
          }
        ],
        bumpers: [
          // Asteroid obstacles at strategic points
          {
            position: new THREE.Vector3(-5, 0.25, 0),
            size: new THREE.Vector3(1, 0.5, 1),
            rotation: new THREE.Euler(0, 0, 0)
          },
          {
            position: new THREE.Vector3(0, 0.25, -5),
            size: new THREE.Vector3(1, 0.5, 1),
            rotation: new THREE.Euler(0, 0, 0)
          }
        ]
      },
      // 🔴 4. Olympus Mons - Triangle mountain challenge
      {
        index: 3,
        description: '4. Olympus Mons - Triangle',
        par: 3,
        // Triangle shaped boundary for angular challenge
        shapeType: 'triangle',
        shapeParams: { size: 8 },
        startPosition: new THREE.Vector3(0, 0, 6), // World - bottom center
        holePosition: new THREE.Vector3(0, 0, -6), // World - top center
        hazards: [
          {
            type: 'sand', // Martian dust at corners
            shape: 'circle',
            position: new THREE.Vector3(-4, 0, 2), // World - left corner
            size: { radius: 1.2 },
            depth: 0.1
          },
          {
            type: 'sand',
            shape: 'circle',
            position: new THREE.Vector3(4, 0, 2), // World - right corner
            size: { radius: 1.2 },
            depth: 0.1
          }
        ],
        bumpers: [
          // Central mountain obstacle
          {
            position: new THREE.Vector3(0, 0.35, 0),
            size: new THREE.Vector3(2, 0.7, 2),
            rotation: new THREE.Euler(0, 0, 0)
          }
        ]
      },
      // 💫 5. Saturn's Rings - Figure-8 dual loop challenge
      {
        index: 4,
        description: "5. Saturn's Rings - Figure-8",
        par: 4,
        // Figure-8/lemniscate shape for dual loops
        shapeType: 'figure8',
        shapeParams: { width: 4, height: 6 }, // Smaller for clearer paths
        startPosition: new THREE.Vector3(-4, 0, 0), // World - left side
        holePosition: new THREE.Vector3(4, 0, 0), // World - right side
        hazards: [],
        bumpers: [
          // Ring obstacles at crossing points
          {
            position: new THREE.Vector3(0, 0.25, 3),
            size: new THREE.Vector3(2, 0.5, 0.3),
            rotation: new THREE.Euler(0, Math.PI / 2, 0)
          },
          {
            position: new THREE.Vector3(0, 0.25, -3),
            size: new THREE.Vector3(2, 0.5, 0.3),
            rotation: new THREE.Euler(0, Math.PI / 2, 0)
          },
          // Central crossing obstacle
          {
            position: new THREE.Vector3(0, 0.25, 0),
            size: new THREE.Vector3(1, 0.5, 1),
            rotation: new THREE.Euler(0, Math.PI / 4, 0)
          }
        ]
      },

      // 🌌 6. Cosmic Rapids - Star shape with multiple paths
      {
        index: 5,
        description: '6. Cosmic Rapids - Star',
        par: 4,
        // Star shape offering multiple path choices
        shapeType: 'star',
        shapeParams: { outerRadius: 8, innerRadius: 4, points: 5 }, // Slightly smaller for better control
        startPosition: new THREE.Vector3(0, 0, 9), // World - bottom center
        holePosition: new THREE.Vector3(0, 0, 0), // World - center
        hazards: [
          {
            type: 'water', // Nebula gas at star points
            shape: 'circle',
            position: new THREE.Vector3(0, 0, -7),
            size: { radius: 1.5 },
            depth: 0.15
          },
          {
            type: 'water',
            shape: 'circle',
            position: new THREE.Vector3(-6, 0, 4),
            size: { radius: 1.5 },
            depth: 0.15
          },
          {
            type: 'water',
            shape: 'circle',
            position: new THREE.Vector3(6, 0, 4),
            size: { radius: 1.5 },
            depth: 0.15
          }
        ],
        bumpers: [
          // Bumpers at inner vertices
          {
            position: new THREE.Vector3(0, 0.25, -3),
            size: new THREE.Vector3(0.8, 0.5, 0.8),
            rotation: new THREE.Euler(0, 0, 0)
          },
          {
            position: new THREE.Vector3(-2.5, 0.25, 1.5),
            size: new THREE.Vector3(0.8, 0.5, 0.8),
            rotation: new THREE.Euler(0, 0, 0)
          },
          {
            position: new THREE.Vector3(2.5, 0.25, 1.5),
            size: new THREE.Vector3(0.8, 0.5, 0.8),
            rotation: new THREE.Euler(0, 0, 0)
          }
        ]
      },

      // 🌀 7. Wormhole Tunnel - Spiral winding passage
      {
        index: 6,
        description: '7. Wormhole Tunnel - Spiral',
        par: 5,
        // Spiral shape that winds inward
        shapeType: 'spiral',
        shapeParams: { innerRadius: 2, outerRadius: 8, turns: 2 }, // Reduced size for better playability
        startPosition: new THREE.Vector3(7, 0, 0), // World - outer edge (adjusted for smaller radius)
        holePosition: new THREE.Vector3(0, 0, 0), // World - center
        hazards: [],
        bumpers: [
          // Obstacles along the spiral path
          {
            position: new THREE.Vector3(5, 0.25, 0),
            size: new THREE.Vector3(0.8, 0.5, 0.8),
            rotation: new THREE.Euler(0, 0, 0)
          },
          {
            position: new THREE.Vector3(0, 0.25, 5),
            size: new THREE.Vector3(0.8, 0.5, 0.8),
            rotation: new THREE.Euler(0, 0, 0)
          },
          {
            position: new THREE.Vector3(-5, 0.25, 0),
            size: new THREE.Vector3(0.8, 0.5, 0.8),
            rotation: new THREE.Euler(0, 0, 0)
          },
          {
            position: new THREE.Vector3(0, 0.25, -5),
            size: new THREE.Vector3(0.8, 0.5, 0.8),
            rotation: new THREE.Euler(0, 0, 0)
          }
        ]
      },

      // ⚫ 8. Gravity Well - Cross shape intersection
      {
        index: 7,
        description: '8. Gravity Well - Cross',
        par: 3,
        // Cross/plus shape offering intersection choices
        shapeType: 'cross',
        shapeParams: { armLength: 7, armWidth: 3 }, // Slightly shorter arms
        startPosition: new THREE.Vector3(0, 0, 7), // World - bottom arm
        holePosition: new THREE.Vector3(0, 0, 0), // World - center intersection
        hazards: [
          {
            type: 'water', // Event horizon at center
            shape: 'circle',
            position: new THREE.Vector3(0, 0, 0),
            size: { radius: 2 },
            depth: 0.2
          }
        ],
        bumpers: [
          // Corner bumpers to guide toward center
          {
            position: new THREE.Vector3(-4, 0.25, 4),
            size: new THREE.Vector3(1, 0.5, 1),
            rotation: new THREE.Euler(0, Math.PI / 4, 0)
          },
          {
            position: new THREE.Vector3(4, 0.25, 4),
            size: new THREE.Vector3(1, 0.5, 1),
            rotation: new THREE.Euler(0, -Math.PI / 4, 0)
          },
          {
            position: new THREE.Vector3(4, 0.25, -4),
            size: new THREE.Vector3(1, 0.5, 1),
            rotation: new THREE.Euler(0, Math.PI / 4, 0)
          },
          {
            position: new THREE.Vector3(-4, 0.25, -4),
            size: new THREE.Vector3(1, 0.5, 1),
            rotation: new THREE.Euler(0, -Math.PI / 4, 0)
          }
        ]
      },

      // ⭐ 9. Galactic Core - Diamond with circular center (compound shape)
      {
        index: 8,
        description: '9. Galactic Core - Diamond',
        par: 5,
        // Diamond shape with circular hole in center - compound shape
        shapeType: 'diamond',
        shapeParams: { width: 10, height: 12 },
        // Keep the compound shape definition for now
        boundaryShapeDef: {
          outer: createDiamondShape(10, 12), // outer diamond
          holes: [createCircularShape(3, 3)] // circular hole in center
        },
        startPosition: new THREE.Vector3(0, 0, 10), // World - bottom tip
        holePosition: new THREE.Vector3(0, 0, 0), // World - center
        hazards: [
          {
            type: 'sand', // Stardust corners
            shape: 'circle',
            position: new THREE.Vector3(-7, 0, 0),
            size: { radius: 1.5 },
            depth: 0.1
          },
          {
            type: 'sand',
            shape: 'circle',
            position: new THREE.Vector3(7, 0, 0),
            size: { radius: 1.5 },
            depth: 0.1
          }
        ],
        bumpers: [
          // Orbiting obstacles around the central hole
          {
            position: new THREE.Vector3(-5, 0.25, 5),
            size: new THREE.Vector3(1.2, 0.5, 1.2),
            rotation: new THREE.Euler(0, Math.PI / 4, 0)
          },
          {
            position: new THREE.Vector3(5, 0.25, 5),
            size: new THREE.Vector3(1.2, 0.5, 1.2),
            rotation: new THREE.Euler(0, -Math.PI / 4, 0)
          },
          {
            position: new THREE.Vector3(5, 0.25, -5),
            size: new THREE.Vector3(1.2, 0.5, 1.2),
            rotation: new THREE.Euler(0, Math.PI / 4, 0)
          },
          {
            position: new THREE.Vector3(-5, 0.25, -5),
            size: new THREE.Vector3(1.2, 0.5, 1.2),
            rotation: new THREE.Euler(0, -Math.PI / 4, 0)
          },
          // Center ring bumpers
          {
            position: new THREE.Vector3(0, 0.25, 4),
            size: new THREE.Vector3(2, 0.5, 0.3),
            rotation: new THREE.Euler(0, 0, 0)
          },
          {
            position: new THREE.Vector3(0, 0.25, -4),
            size: new THREE.Vector3(2, 0.5, 0.3),
            rotation: new THREE.Euler(0, 0, 0)
          }
        ]
      }
    ];
    // Ensure totalHoles matches the number of configs provided
    if (this.holeConfigs.length !== this.totalHoles) {
      this.totalHoles = this.holeConfigs.length;
    }
    debug.log(`[NineHoleCourse] Configured ${this.totalHoles} holes.`);

    // Initialize tracking - start at first hole (index 0)
    this.currentHoleIndex = 0;
    this.currentHoleEntity = null; // Renamed from currentHole to avoid confusion with groups
  }

  /**
   * Generate boundary shape from hole configuration
   * Provides a unified pipeline for shape generation
   *
   * @param {Object} config - Hole configuration object
   * @returns {THREE.Vector2[]|Object} Shape boundary or compound shape definition
   * @private
   */
  generateBoundaryShape(config) {
    // First check if we already have a boundaryShape
    if (config.boundaryShape) {
      return config.boundaryShape;
    }

    // Check for compound shapes (like hole 9)
    if (config.boundaryShapeDef) {
      return config.boundaryShapeDef;
    }

    // Generate from shapeType and shapeParams
    if (!config.shapeType || !config.shapeParams) {
      return null;
    }

    const params = config.shapeParams;
    switch (config.shapeType) {
      case 'circle':
        return createCircularShape(params.radiusX, params.radiusZ, params.segments || 32);
      case 'triangle':
        return createTriangleShape(params.size);
      case 'star':
        return createStarShape(params.outerRadius, params.innerRadius, params.points);
      case 'cross':
        return createCrossShape(params.armLength, params.armWidth);
      case 'kidney':
        return createKidneyShape(params.width, params.height);
      case 'figure8':
        return createFigure8Shape(params.width, params.height);
      case 'spiral':
        return createSpiralShape(params.innerRadius, params.outerRadius, params.turns);
      case 'snake':
        return createSnakeShape(params.length, params.width, params.curves);
      case 'diamond':
        return createDiamondShape(params.width, params.height);
      case 'lshape':
        return createLShape(params.width, params.height, params.thickness);
      default:
        return null;
    }
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
      throw new Error('Failed to initialize first hole or required state missing');
    }

    debug.log('[NineHoleCourse.create] End');
    return course;
  }

  /**
   * Initialize a specific hole by index
   * Creates the HoleEntity for the specified hole and sets up its visual/physics elements
   *
   * @param {number} holeIndex - Index of the hole to initialize (0-based)
   * @returns {Promise<boolean>} True if successful, false otherwise
   * @async
   */
  async initializeHole(holeIndex) {
    debug.log(`[NineHoleCourse.initializeHole] Start (Index: ${holeIndex})`);
    try {
      // Validate index
      if (holeIndex < 0 || holeIndex >= this.totalHoles) {
        return false;
      }

      // Get hole group and config
      const holeGroup = this.holeGroups[holeIndex];
      const holeConfig = this.holeConfigs[holeIndex];

      // Check if we have a valid configuration
      if (!holeConfig) {
        return false;
      }

      // Verify that the holeGroup is a valid THREE.Group and connected to the scene
      if (!holeGroup || !(holeGroup instanceof THREE.Group)) {
        return false;
      }

      // Verify that the holeGroup has a valid parent (the scene)
      if (!holeGroup.parent) {
        // Try to re-add it to the scene
        this.scene.add(holeGroup);
        if (!holeGroup.parent) {
          return false;
        }
      }

      // Get scene and physical world
      const scene = holeGroup; // Use the group as the "scene"
      const physicsWorld = this.game.physicsManager.getWorld();

      // If we already have a hole entity for this hole, just make it visible
      // This optimization avoids recreating holes that were previously initialized
      if (this.currentHoleEntity && this.currentHoleEntity.config.index === holeIndex) {
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

      // Generate boundary shape if needed
      const configWithShape = { ...holeConfig };
      if (!configWithShape.boundaryShape && !configWithShape.boundaryShapeDef) {
        const generatedShape = this.generateBoundaryShape(configWithShape);
        if (generatedShape) {
          configWithShape.boundaryShape = generatedShape;
        } else {
          return false;
        }
      }

      try {
        this.currentHoleEntity = new HoleEntity(physicsWorld, configWithShape, scene);

        // Initialize the hole (create visual and physics elements)
        await this.currentHoleEntity.init();
      } catch (error) {
        return false;
      }

      // Make the current hole group visible
      holeGroup.visible = true;

      // Set current hole
      this.currentHoleIndex = holeIndex;
      this.currentHole = this.currentHoleEntity; // Set currentHole for BallManager compatibility

      // Set start position for the ball

      this.setStartPosition(holeConfig.startPosition);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Set the start position for the current hole
   * @param {THREE.Vector3} position - The start position
   */
  setStartPosition(position) {
    if (!position || !(position instanceof THREE.Vector3)) {
      return;
    }
    // This sets the *course's* overall start position, used by BallManager
    this.startPosition = position.clone();
  }

  /**
   * Creates or loads the specified hole. (Currently just calls initializeHole)
   * @param {number} targetHoleNumber - The hole number to create (1-based)
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async createCourse(targetHoleNumber) {
    if (!targetHoleNumber || targetHoleNumber < 1 || targetHoleNumber > this.totalHoles) {
      return false;
    }

    try {
      // Clear existing hole resources before initializing new one
      await this.clearCurrentHole();

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
   * Handle ball entering hole - Sets completion flag for deferred transition
   * @param {number} holeIndex - The index of the hole the ball entered
   * @public
   */
  onBallInHole(holeIndex) {
    // Only process if this is the current hole and we're not already transitioning
    if (holeIndex === this.currentHoleIndex && !this.isTransitioning) {
      this.isHoleComplete = true;
    }
  }

  /**
   * Load the next hole in the 9-hole sequence.
   * Clears the current hole and initializes the next one with proper ball positioning
   *
   * @returns {Promise<boolean>} True if next hole was loaded, false if at end of course
   * @async
   */
  async loadNextHole() {
    if (this.isTransitioning) {
      return false;
    }

    this.isTransitioning = true;

    try {
      const nextHoleIndex = this.currentHoleIndex + 1;
      if (nextHoleIndex >= this.totalHoles) {
        // Handle end of game scenario here - trigger game completion event
        // The event will be handled by managers to show final scorecard
        this.game.stateManager.setState('GAME_OVER'); // Example state
        return false; // Indicate no *new* hole was loaded
      }

      // Clear current hole and initialize new one
      await this.clearCurrentHole();
      const success = await this.initializeHole(nextHoleIndex);

      if (!success) {
        throw new Error(`Failed to initialize hole ${nextHoleIndex + 1}`);
      }

      // Get the start position from the newly initialized course/hole config
      const startPosition = this.startPosition; // Reads the position set by initializeHole
      if (!startPosition) {
        throw new Error('Failed to get start position for ball creation');
      }

      // Reset ball using BallManager, which should use this.startPosition
      await this.game.ballManager.resetBall(startPosition);

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
   * Clear the current hole's resources (visuals, physics).
   * Makes the corresponding THREE.Group invisible and destroys the HoleEntity.
   *
   * @returns {Promise<void>}
   * @private
   */
  clearCurrentHole() {
    // Destroy the HoleEntity (which should clean up its CANNON bodies)
    if (this.currentHoleEntity) {
      this.currentHoleEntity.destroy();
      this.currentHoleEntity = null;
      this.currentHole = null; // Also clear the currentHole reference
    }

    // Hide the THREE.Group associated with the hole
    if (this.currentHoleIndex >= 0 && this.currentHoleIndex < this.holeGroups.length) {
      const holeGroup = this.holeGroups[this.currentHoleIndex];
      if (holeGroup) {
        holeGroup.visible = false;
        // Don't remove the group from the scene - just make it invisible
        // This keeps the parent references intact
      }
    }

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
   * Update loop for the course. Handles deferred hole transitions.
   * Called every frame to check for pending hole completions and update hole entities
   *
   * @param {number} dt - Delta time in seconds
   * @public
   */
  update(dt) {
    // Handle deferred hole completion transition
    // This deferred approach prevents race conditions with physics updates
    if (this.isHoleComplete && !this.pendingHoleTransition && !this.isTransitioning) {
      this.pendingHoleTransition = true; // Prevents re-triggering

      // Schedule the transition for the next frame/tick to avoid issues during physics step
      // This ensures physics has settled and prevents conflicts with ongoing updates
      requestAnimationFrame(async () => {
        try {
          await this.loadNextHole();
        } catch (error) {
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
      return 0; // Default par
    }
    return config.par;
  }

  // --- End Overrides ---
}
