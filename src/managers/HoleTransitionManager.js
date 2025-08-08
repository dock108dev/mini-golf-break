import { EventTypes } from '../events/EventTypes';

/**
 * HoleTransitionManager - Handles loading and unloading of holes
 */
export class HoleTransitionManager {
  constructor(game) {
    this.game = game;
    this.transitionDuration = 2000; // Assuming a default transition duration
  }

  /**
   * Initialize the manager
   */
  init() {
    return this;
  }

  /**
   * Load the next hole
   */
  async transitionToNextHole() {
    // Get current hole number from state manager BEFORE unloading
    const currentHoleNumber = this.game.stateManager.getCurrentHoleNumber();
    const totalHoles = this.game.course.getTotalHoles();
    const targetHoleNumber = currentHoleNumber + 1;

    // Check if the current hole number is the last hole or beyond
    if (currentHoleNumber >= totalHoles) {
      // --- PUBLISH GAME COMPLETED EVENT ---
      if (this.game.eventManager) {
        // Publish event - UIManager will fetch scores directly
        const eventData = { timestamp: Date.now() }; // Simple payload

        this.game.eventManager.publish(EventTypes.GAME_COMPLETED, eventData, this);
      }
      // --- END PUBLISH ---

      // Optionally set game state if needed, but event should trigger UI
      // this.game.stateManager.setGameState(GameState.GAME_COMPLETED);

      return false; // Stop the transition process
    }

    try {
      // First clean up the current hole completely
      await this.unloadCurrentHole();

      // Initialize physics world through the physics manager's reset method
      let newWorld = null;
      if (this.game.physicsManager?.resetWorld) {
        newWorld = await this.game.physicsManager.resetWorld(); // Capture the returned world
        if (newWorld && newWorld.world) {
          // Update the CannonDebugRenderer with the new world instance
          if (this.game.cannonDebugRenderer) {
            // Explicitly clear old meshes from the renderer
            this.game.cannonDebugRenderer.clearMeshes();
            this.game.cannonDebugRenderer.world = newWorld.world; // Assign the inner CANNON.World
          }
        } else {
          return false; // Stop transition if physics reset failed
        }
      }

      // Load the new hole - pass the target hole number explicitly
      const success = await this.loadNewHole(targetHoleNumber);
      if (!success) {
        return false;
      }

      // Update state after successful hole load
      // This updates the state manager's internal hole number to match the loaded hole
      this.game.stateManager.resetForNextHole();

      // Log the actual hole number after state update
      // const newHoleNumber = this.game.stateManager.getCurrentHoleNumber();

      // Get hole positions for verification
      const holePosition = this.game.course.getHolePosition();
      const startPosition = this.game.course.getHoleStartPosition();

      if (!holePosition || !startPosition) {
        return false;
      }

      // --- CREATE BALL FOR NEW HOLE ---

      if (this.game.ballManager) {
        const ballCreated = this.game.ballManager.createBall(startPosition);
        if (!ballCreated) {
          // Maybe return false or throw error?
        }
      }
      // --- END CREATE BALL ---

      // --- ENABLE INPUT FOR NEW HOLE ---

      if (this.game.inputController) {
        this.game.inputController.enableInput();
      }
      // --- END ENABLE INPUT ---

      // Preserve debug mode state
      const debugMode = this.game.stateManager.state.debugMode;
      if (debugMode) {
        this.game.stateManager.state.debugMode = debugMode;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Completely unload the current hole and all its resources
   */
  async unloadCurrentHole() {
    // Remove all meshes and physics objects
    if (this.game.course) {
      this.game.course.clearCurrentHole();
    }

    // Remove the ball
    if (this.game.ballManager?.ball) {
      this.game.ballManager.removeBall();
    }

    // Clear the scene except for lights and camera
    this.cleanScene();
  }

  /**
   * Load a new hole
   * @param {number} targetHoleNumber - The hole number to load (1-based)
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async loadNewHole(targetHoleNumber) {
    // Verify game and course are available
    if (!this.game || !this.game.course) {
      return false;
    }

    // Verify physics world exists and is properly initialized
    if (!this.verifyPhysicsWorld()) {
      return false;
    }

    try {
      // Wait for physics world to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create the new hole
      const success = await this.game.course.createCourse(targetHoleNumber);
      if (!success) {
        return false;
      }

      // Wait for a frame to ensure physics bodies are created
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Reset grace period in HoleCompletionManager
      if (this.game.holeCompletionManager) {
        this.game.holeCompletionManager.resetGracePeriod();
      }

      // Update UI with new hole information
      if (this.game.uiManager) {
        this.game.uiManager.updateHoleInfo(targetHoleNumber);
        this.game.uiManager.showMessage(`Hole ${targetHoleNumber}`);
      }

      // Log success

      // Verify physics world state after loading
      if (!this.verifyPhysicsWorld()) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean the scene except for essential objects
   */
  cleanScene() {
    const scene = this.game.scene;
    const objectsToKeep = [];

    // Keep track of essential objects (lights, camera, starfield, etc)
    scene.traverse(object => {
      if (
        object.isLight ||
        object.isCamera ||
        object.userData.permanent || // Keep objects marked as permanent
        (object.type === 'Points' && object.userData.type === 'starfield') ||
        (object.type === 'Group' && object.userData.type === 'AdShipContainer')
      ) {
        // Keep the AdShip container
        objectsToKeep.push(object);
      }
    });

    // Clear the scene
    scene.clear();

    // Add back essential objects
    objectsToKeep.forEach(obj => scene.add(obj));

    // Recreate starfield if it's missing
    const hasStarfield = scene.children.some(
      child => child.type === 'Points' && child.userData.type === 'starfield'
    );

    if (!hasStarfield) {
      this.game.createStarfield();
    }
  }

  /**
   * Handle hole transition
   * @param {number} fromHole - The hole number we're transitioning from
   * @param {number} toHole - The hole number we're transitioning to
   */
  onHoleTransition(fromHole, toHole) {
    // Store transition info
    this.fromHole = fromHole;
    this.toHole = toHole;
    this.transitionStartTime = performance.now();
    this.isTransitioning = true;

    // Reset transition state
    this.resetTransitionState();

    // Start transition effects
    this.startTransitionEffects();
  }

  /**
   * Start transition effects
   * @private
   */
  startTransitionEffects() {
    // Fade out current hole
    if (this.game.course) {
      const currentHole = this.game.course.getCurrentHoleMesh();
      if (currentHole && currentHole.userData.material) {
        currentHole.userData.material.transparent = true;
        currentHole.userData.material.opacity = 1.0;
      }
    }

    // Reset ball position
    if (this.game.ballManager) {
      this.game.ballManager.resetBall();
    }

    // Update camera for new hole
    if (this.game.cameraController) {
      this.game.cameraController.updateCameraForHole();
    }
  }

  /**
   * Reset transition state
   * @private
   */
  resetTransitionState() {
    this.isTransitioning = false;
    this.transitionStartTime = 0;
    this.fromHole = 0;
    this.toHole = 0;
  }

  /**
   * Update loop for the transition manager
   * @param {number} dt - Delta time in seconds
   */
  update(_dt) {
    if (!this.isTransitioning) {
      return;
    }

    const currentTime = performance.now();
    const elapsed = (currentTime - this.transitionStartTime) / 1000;

    // Handle fade out
    if (elapsed < this.transitionDuration) {
      const progress = elapsed / this.transitionDuration;
      if (this.game.course) {
        const currentHole = this.game.course.getCurrentHoleMesh();
        if (currentHole && currentHole.userData.material) {
          currentHole.userData.material.opacity = 1.0 - progress;
        }
      }
    } else {
      // Transition complete
      this.isTransitioning = false;

      // Reset material opacity
      if (this.game.course) {
        const currentHole = this.game.course.getCurrentHoleMesh();
        if (currentHole && currentHole.userData.material) {
          currentHole.userData.material.transparent = false;
          currentHole.userData.material.opacity = 1.0;
        }
      }
    }
  }

  // Verify physics world exists and is properly initialized
  verifyPhysicsWorld = () => {
    if (!this.game.physicsManager?.world) {
      return false;
    }

    // Get the actual CANNON.World instance
    const cannonWorld = this.game.physicsManager.world.world;
    if (!cannonWorld) {
      return false;
    }

    // Verify the world has all required methods and properties
    const requiredMethods = ['step', 'addBody', 'removeBody'];
    for (const method of requiredMethods) {
      if (typeof cannonWorld[method] !== 'function') {
        return false;
      }
    }

    // Verify essential properties
    if (!cannonWorld.bodies || !Array.isArray(cannonWorld.bodies)) {
      return false;
    }

    // Verify solver configuration
    if (!cannonWorld.solver) {
      return false;
    }

    // Verify gravity
    if (!cannonWorld.gravity || typeof cannonWorld.gravity.y !== 'number') {
      return false;
    }

    // Log current physics world state

    // Log all physics bodies for debugging

    return true;
  };
}
