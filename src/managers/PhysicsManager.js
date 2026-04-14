import { PhysicsWorld } from '../physics/PhysicsWorld';
import { debug } from '../utils/debug';

/**
 * PhysicsManager - Handles physics setup, updates, and debugging
 * Extracts physics management from Game.js to improve modularity
 */
export class PhysicsManager {
  constructor(game) {
    // Reference to the main game
    this.game = game;

    // Physics world instance
    this.world = null;
    this.cannonWorld = null;

    // Debug visualization
    this.debugEnabled = false;

    // Flag to track if world is being reset
    this.isResetting = false;

    // Reference to the ball's physics body
    this.ballBody = null;
    this.isInBunker = false;
  }

  /**
   * Initialize the physics system
   */
  async init() {
    // Create physics world
    this.world = new PhysicsWorld();
    this.cannonWorld = this.world.world; // Access the inner CANNON.World instance

    // Set up collision event handling
    this.setupCollisionEvents();

    debug.log('[PhysicsManager] Physics world created and initialized.');

    // Additional setup (e.g., debug renderer)
    if (this.game.debugManager && this.game.debugManager.physicsDebuggerEnabled) {
      debug.log('[PhysicsManager] Physics debugger enabled by DebugManager.');
      // Assuming DebugManager handles the renderer creation and update
    }

    // Get reference to ball body AFTER ball is created
    // This assumes BallManager.init() runs before this listener setup
    // Or we might need a dedicated method called later
    this.ballBody = this.game.ballManager?.ball?.body;

    if (this.ballBody) {
      this.setupContactListeners();
    } else {
      console.warn('[PhysicsManager] Could not get ball body during init. Listeners not set up.');
      // Consider setting up listeners later, e.g., after course creation
    }

    return this.world;
  }

  /**
   * Get the underlying physics world
   * @returns {PhysicsWorld} The physics world instance
   */
  getWorld() {
    debug.log(`DEBUG PhysicsManager.getWorld: World exists: ${!!this.world}`);
    if (this.world) {
      debug.log(`DEBUG PhysicsManager.getWorld: World has cannonWorld: ${!!this.world.world}`);
      debug.log(
        `DEBUG PhysicsManager.getWorld: World has ballMaterial: ${!!this.world.ballMaterial}`
      );
    }
    return this.world;
  }

  /**
   * Set up collision event handling
   */
  setupCollisionEvents() {
    if (!this.cannonWorld) {
      return this;
    }

    // Store bound handlers
    this.boundCollisionStart = this.handleCollisionStart.bind(this);
    this.boundCollisionEnd = this.handleCollisionEnd.bind(this);

    // Add collision event handlers and store them in the physics world
    this.world.setCollisionCallback(this.boundCollisionStart);
    this.cannonWorld.addEventListener('endContact', this.boundCollisionEnd);

    return this;
  }

  /**
   * Handle collision start events
   * @param {object} event - Collision event
   */
  handleCollisionStart(event) {
    // Only handle events if game exists
    if (!this.game) {
      return;
    }

    // Check what objects are colliding using userData
    const bodyA = event.bodyA;
    const bodyB = event.bodyB;

    // Delegate collision handling to game if needed
    if (this.game.handleCollision) {
      this.game.handleCollision(bodyA, bodyB);
    }
  }

  /**
   * Handle collision end events
   * @param {object} event - Collision event
   */
  handleCollisionEnd(_event) {
    // Handle end of collision if needed
  }

  /**
   * Update the physics simulation
   * @param {number} _deltaTime - Time since last update in seconds
   */
  update(_deltaTime) {
    // Skip update if we're in the middle of resetting
    if (this.isResetting) {
      return this;
    }

    // Safety check for world and bodies
    if (!this.cannonWorld || !this.cannonWorld.bodies) {
      if (this.game && this.game.debugManager) {
        this.game.debugManager.warn('[PhysicsManager] Physics world or bodies not ready');
      }
      return this;
    }

    // Update the physics world
    try {
      if (!this.isResetting) {
        this.world.update();
      }
    } catch (error) {
      if (this.game && this.game.debugManager) {
        this.game.debugManager.error(
          'PhysicsManager.update',
          'Error updating physics world',
          error,
          true // Show in UI
        );
      } else {
        console.error('ERROR: PhysicsManager.update: Error updating physics world', error);
      }
    }

    return this;
  }

  /**
   * Disable physics debug visualization
   */
  disableDebug() {
    if (!this.debugEnabled) {
      return this;
    }

    this.debugEnabled = false;

    // NOTE: The actual debug renderer is managed elsewhere (e.g., GameLoopManager)
    // This method might just signal the state change now.

    return this;
  }

  /**
   * Clean up physics resources
   */
  cleanup() {
    // Disable debug visualization
    this.disableDebug();

    // Clean up physics world
    if (this.cannonWorld) {
      // Remove event listeners
      this.cannonWorld.removeEventListener('beginContact', this.boundCollisionStart);
      this.cannonWorld.removeEventListener('endContact', this.boundCollisionEnd);
    }

    this.world = null;
    this.cannonWorld = null;

    return this;
  }

  /**
   * Remove a body from the physics world
   * @param {CANNON.Body} body - The physics body to remove
   */
  removeBody(body) {
    if (!this.cannonWorld || !body) {
      return this;
    }

    // Check if body is still in the world before removing
    if (this.cannonWorld.bodies.includes(body)) {
      // Remove from world
      this.cannonWorld.removeBody(body);

      // Log removal for debugging
      if (this.game && this.game.debugManager) {
        this.game.debugManager.log(`[PhysicsManager] Removed body: ${body.id}`);
      }
    }

    return this;
  }

  /**
   * Resets the entire physics world. Clears all bodies and recreates the world.
   * @returns {Promise<PhysicsWorld>} The new physics world instance.
   */
  async resetWorld() {
    debug.log('[PhysicsManager] Starting physics world reset');
    this.isResetting = true;

    try {
      // Log current state
      debug.log('[PhysicsManager] Current world state:', {
        hasWorld: !!this.world,
        hasCannonWorld: !!this.cannonWorld,
        bodyCount: this.cannonWorld?.bodies?.length ?? 'N/A'
      });

      // Cleanup existing world if it exists
      if (this.world) {
        this.world.cleanup();
      }
      if (this.cannonWorld) {
        // Remove event listeners properly
        if (this.boundCollisionStart) {
          this.cannonWorld.removeEventListener('beginContact', this.boundCollisionStart);
        }
        if (this.boundCollisionEnd) {
          this.cannonWorld.removeEventListener('endContact', this.boundCollisionEnd);
        }
        // Clear bodies (optional, cleanup should handle this)
        while (this.cannonWorld.bodies.length > 0) {
          this.cannonWorld.removeBody(this.cannonWorld.bodies[0]);
        }
      }
      this.world = null;
      this.cannonWorld = null;

      // Create a new world
      this.world = new PhysicsWorld(); // Re-create the wrapper
      this.cannonWorld = this.world.world; // Get the new inner CANNON.World

      // Set up collision event handling for the new world
      this.setupCollisionEvents();

      // Re-acquire ball body reference (might be null if ball is recreated later)
      this.ballBody = this.game.ballManager?.ball?.body;
      if (this.ballBody) {
        this.setupContactListeners();
      } else {
        debug.log(
          '[PhysicsManager] Ball body not available after world reset. Listeners not set up.'
        );
      }

      debug.log('[PhysicsManager] New world created:', {
        hasWorld: !!this.world,
        hasCannonWorld: !!this.cannonWorld,
        hasStep: !!this.world.step,
        bodyCount: this.cannonWorld?.bodies?.length
      });

      return this.world; // Return the new world instance
    } catch (error) {
      console.error('[PhysicsManager] Error during physics world reset:', error);
      return null; // Return null on error
    } finally {
      this.isResetting = false;
      debug.log('[PhysicsManager] Finished physics world reset');
    }
  }

  // Method to set up listeners, can be called later if ball isn't ready during init
  setupContactListeners() {
    if (!this.ballBody) {
      console.error('[PhysicsManager] Cannot set up listeners: ballBody is null.');
      return;
    }

    debug.log('[PhysicsManager] Setting up beginContact/endContact listeners for ball.');

    // Use bound functions to maintain 'this' context
    this.handleBeginContact = this.handleBeginContact.bind(this);
    this.handleEndContact = this.handleEndContact.bind(this);

    this.ballBody.addEventListener('beginContact', this.handleBeginContact);
    this.ballBody.addEventListener('endContact', this.handleEndContact);
  }

  // Handler for when contact begins
  handleBeginContact(event) {
    const otherBody = event.body;
    if (otherBody.userData?.isBunkerZone && !this.isInBunker) {
      const ball = this.game.ballManager?.ball;
      if (ball && this.ballBody) {
        this.isInBunker = true;
        this.ballBody.linearDamping = ball.bunkerLinearDamping;
        debug.log(
          `%c[PhysicsManager] Ball entered bunker zone. Damping increased to ${this.ballBody.linearDamping}`,
          'color: orange;'
        );
        // Optional: Add sound effect
        // this.game.audioManager?.playSound('sand_enter');
      }
    }
  }

  // Handler for when contact ends
  handleEndContact(event) {
    const otherBody = event.body;
    // Check if we are ending contact with a bunker *while* we thought we were in one
    if (otherBody.userData?.isBunkerZone && this.isInBunker) {
      const ball = this.game.ballManager?.ball;
      if (ball && this.ballBody) {
        this.isInBunker = false;
        this.ballBody.linearDamping = ball.defaultLinearDamping;
        debug.log(
          `%c[PhysicsManager] Ball exited bunker zone. Damping restored to ${this.ballBody.linearDamping}`,
          'color: green;'
        );
        // Optional: Add sound effect
        // this.game.audioManager?.playSound('sand_exit');
      }
    }
  }
}
