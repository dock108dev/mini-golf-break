import * as THREE from 'three';
import { EventTypes } from '../events/EventTypes';
import { GameState } from '../states/GameState';
import { debug } from '../utils/debug';

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

    debug.log(
      `[HoleTransitionManager] Checking transition from hole ${currentHoleNumber} to ${targetHoleNumber} (Total holes: ${totalHoles})`
    );

    // Check if the current hole number is the last hole or beyond
    if (currentHoleNumber >= totalHoles) {
      console.warn(
        `[HoleTransitionManager] No more holes available (current: ${currentHoleNumber}, total: ${totalHoles})`
      );

      // --- PUBLISH GAME COMPLETED EVENT ---
      if (this.game.eventManager) {
        // Publish event - UIManager will fetch scores directly
        const eventData = { timestamp: Date.now() }; // Simple payload
        debug.log('[HoleTransitionManager] Publishing GAME_COMPLETED event.', eventData);
        this.game.eventManager.publish(EventTypes.GAME_COMPLETED, eventData, this);
      } else {
        console.error(
          '[HoleTransitionManager] EventManager not available to publish GAME_COMPLETED.'
        );
      }
      // --- END PUBLISH ---

      // Optionally set game state if needed, but event should trigger UI
      // this.game.stateManager.setGameState(GameState.GAME_COMPLETED);

      return false; // Stop the transition process
    }

    debug.log(
      `[HoleTransitionManager] Starting transition to hole ${targetHoleNumber} of ${totalHoles}`
    );

    // Show loading overlay during transition
    if (this.game.uiManager) {
      this.game.uiManager.showTransitionOverlay();
    }

    try {
      // First clean up the current hole completely
      await this.unloadCurrentHole();

      // Initialize physics world through the physics manager's reset method
      let newWorld = null;
      if (this.game.physicsManager?.resetWorld) {
        newWorld = await this.game.physicsManager.resetWorld(); // Capture the returned world
        if (newWorld && newWorld.world) {
          debug.log('[HoleTransitionManager] Physics world reset for new hole');
          // Update the CannonDebugRenderer with the new world instance
          if (this.game.cannonDebugRenderer) {
            // Explicitly clear old meshes from the renderer
            this.game.cannonDebugRenderer.clearMeshes();
            this.game.cannonDebugRenderer.world = newWorld.world; // Assign the inner CANNON.World
            debug.log('[HoleTransitionManager] Updated CannonDebugRenderer world reference.');
          }
        } else {
          console.error(
            '[HoleTransitionManager] Physics world reset failed or returned invalid world.'
          );
          return false; // Stop transition if physics reset failed
        }
      } else {
        console.warn('[HoleTransitionManager] Physics world reset not available');
      }

      // Load the new hole - pass the target hole number explicitly
      const success = await this.loadNewHole(targetHoleNumber);
      if (!success) {
        console.error(`[HoleTransitionManager] Failed to load hole ${targetHoleNumber}`);
        return false;
      }

      // Update state after successful hole load
      // This updates the state manager's internal hole number to match the loaded hole
      this.game.stateManager.resetForNextHole();

      // Log the actual hole number after state update
      const newHoleNumber = this.game.stateManager.getCurrentHoleNumber();
      debug.log(
        `[HoleTransitionManager] Successfully transitioned to hole ${newHoleNumber} of ${totalHoles}`
      );

      // Get hole positions for verification
      const holePosition = this.game.course.getHolePosition();
      const startPosition = this.game.course.getHoleStartPosition();

      if (!holePosition || !startPosition) {
        console.error('[HoleTransitionManager] Failed to get valid positions for new hole');
        return false;
      }

      debug.log('[HoleTransitionManager] New hole position:', holePosition);
      debug.log('[HoleTransitionManager] New start position:', startPosition);

      // --- CREATE BALL FOR NEW HOLE ---
      debug.log('[HoleTransitionManager] Creating ball for the new hole...');
      if (this.game.ballManager) {
        const ballCreated = this.game.ballManager.createBall(startPosition);
        if (!ballCreated) {
          console.error('[HoleTransitionManager] Failed to create ball for new hole!');
          // Maybe return false or throw error?
        } else {
          debug.log('[HoleTransitionManager] Ball created successfully for new hole.');
        }
      } else {
        console.error(
          '[HoleTransitionManager] BallManager not available to create ball for new hole.'
        );
      }
      // --- END CREATE BALL ---

      // --- ENABLE INPUT FOR NEW HOLE ---
      debug.log('[HoleTransitionManager] Enabling input controller for new hole...');
      if (this.game.inputController) {
        this.game.inputController.enableInput();
        debug.log('[HoleTransitionManager] Input controller enabled.');
      } else {
        console.warn(
          '[HoleTransitionManager] InputController not available to enable for new hole.'
        );
      }
      // --- END ENABLE INPUT ---

      // Preserve debug mode state
      const debugMode = this.game.stateManager.state.debugMode;
      if (debugMode) {
        debug.log('[HoleTransitionManager] Preserving debug mode state:', debugMode);
        this.game.stateManager.state.debugMode = debugMode;
      }

      // Hide loading overlay now that the new hole is ready
      if (this.game.uiManager) {
        this.game.uiManager.hideTransitionOverlay();
      }

      return true;
    } catch (error) {
      console.error('[HoleTransitionManager] Error during hole transition:', error);
      // Hide loading overlay on error as well
      if (this.game.uiManager) {
        this.game.uiManager.hideTransitionOverlay();
      }
      return false;
    }
  }

  /**
   * Completely unload the current hole and all its resources
   */
  async unloadCurrentHole() {
    debug.log('[HoleTransitionManager] Starting hole cleanup');

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

    debug.log('[HoleTransitionManager] Hole cleanup complete');
  }

  /**
   * Load a new hole
   * @param {number} targetHoleNumber - The hole number to load (1-based)
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async loadNewHole(targetHoleNumber) {
    debug.log(`[HoleTransitionManager] Loading hole #${targetHoleNumber}`);

    // Verify game and course are available
    if (!this.game || !this.game.course) {
      console.error('[HoleTransitionManager] Game or course not available');
      return false;
    }

    // Verify physics world exists and is properly initialized
    if (!this.verifyPhysicsWorld()) {
      console.error('[HoleTransitionManager] Physics world verification failed');
      return false;
    }

    try {
      // Wait for physics world to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create the new hole
      const success = await this.game.course.createCourse(targetHoleNumber);
      if (!success) {
        console.error(`[HoleTransitionManager] Failed to create hole #${targetHoleNumber}`);
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

      // Update OOB boundaries for the new hole
      if (this.game.hazardManager && this.game.course) {
        const holeConfig = this.game.course.getCurrentHoleConfig();
        this.game.hazardManager.setHoleBounds(holeConfig);
      }

      // Apply theme-variant lighting and background for the new hole
      const loadedConfig = this.game.course?.getCurrentHoleConfig();
      if (loadedConfig?.theme) {
        this.game.updateLightingForTheme(loadedConfig.theme);
        if (this.game.spaceDecorations) {
          this.game.spaceDecorations.setThemeVariant(loadedConfig.theme);
        }
      }

      // Log success
      debug.log(`[HoleTransitionManager] Successfully loaded hole #${targetHoleNumber}`);

      // Verify physics world state after loading
      if (!this.verifyPhysicsWorld()) {
        console.error(
          '[HoleTransitionManager] Physics world verification failed after loading hole'
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('[HoleTransitionManager] Error loading new hole:', error);
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
        (object.type === 'Points' && object.userData.type === 'starfield')
      ) {
        objectsToKeep.push(object);
        debug.log('[HoleTransitionManager] Keeping object:', object.type, object.userData);
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
      debug.log('[HoleTransitionManager] Recreating starfield');
      this.game.createStarfield();
    }
  }

  /**
   * Handle hole transition
   * @param {number} fromHole - The hole number we're transitioning from
   * @param {number} toHole - The hole number we're transitioning to
   */
  onHoleTransition(fromHole, toHole) {
    debug.log(`[HoleTransitionManager] Handling transition from hole ${fromHole} to ${toHole}`);

    // Store transition info
    this.fromHole = fromHole;
    this.toHole = toHole;
    this.transitionStartTime = performance.now();
    this.isTransitioning = true;

    // Reset transition state
    this.resetTransitionState();

    // Start transition effects
    this.startTransitionEffects();

    debug.log(`[HoleTransitionManager] Transition started from hole ${fromHole} to ${toHole}`);
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
  update(dt) {
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
      debug.log(`[HoleTransitionManager] Transition to hole ${this.toHole} complete`);

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
      console.error('[HoleTransitionManager] Physics world not available');
      return false;
    }

    // Get the actual CANNON.World instance
    const cannonWorld = this.game.physicsManager.world.world;
    if (!cannonWorld) {
      console.error('[HoleTransitionManager] CANNON.World instance not available');
      return false;
    }

    // Verify the world has all required methods and properties
    const requiredMethods = ['step', 'addBody', 'removeBody'];
    for (const method of requiredMethods) {
      if (typeof cannonWorld[method] !== 'function') {
        console.error(`[HoleTransitionManager] Physics world missing required method: ${method}`);
        return false;
      }
    }

    // Verify essential properties
    if (!cannonWorld.bodies || !Array.isArray(cannonWorld.bodies)) {
      console.error('[HoleTransitionManager] Physics world missing bodies array');
      return false;
    }

    // Verify solver configuration
    if (!cannonWorld.solver) {
      console.error('[HoleTransitionManager] Physics world missing solver');
      return false;
    }

    // Verify gravity
    if (!cannonWorld.gravity || typeof cannonWorld.gravity.y !== 'number') {
      console.error('[HoleTransitionManager] Physics world has invalid gravity');
      return false;
    }

    // Log current physics world state
    debug.log('[HoleTransitionManager] Physics world state:', {
      bodies: cannonWorld.bodies.length,
      gravity: cannonWorld.gravity.toString(),
      solver: {
        iterations: cannonWorld.solver.iterations,
        tolerance: cannonWorld.solver.tolerance
      },
      materials: {
        default: !!this.game.physicsManager.defaultMaterial,
        ball: !!this.game.physicsManager.ballMaterial,
        ground: !!this.game.physicsManager.groundMaterial,
        wall: !!this.game.physicsManager.wallMaterial,
        sand: !!this.game.physicsManager.sandMaterial
      }
    });

    // Log all physics bodies for debugging
    if (cannonWorld.bodies.length > 0) {
      debug.log(
        '[HoleTransitionManager] Physics bodies:',
        cannonWorld.bodies.map(body => ({
          type: body.userData?.type || 'unknown',
          position: body.position.toString(),
          sleeping: body.sleeping,
          mass: body.mass,
          material: body.material?.name || 'none'
        }))
      );
    }

    return true;
  };
}
