/** Maximum delta time in seconds — frames exceeding this are clamped. */
export const MAX_DELTA_TIME = 1 / 30; // ~33ms

/**
 * GameLoopManager - Orchestrates the main game update loop
 * Centralized control of the update sequence to improve modularity
 */
export class GameLoopManager {
  constructor(game) {
    // Reference to the main game
    this.game = game;

    // Animation frame ID for cleanup
    this.animationFrameId = null;

    // Performance tracking
    this.lastFrameTime = performance.now();
    this.deltaTime = 0;

    this.isRunning = false;

    // Pause state
    this.isPaused = false;

    // True when the current frame's raw dt exceeded MAX_DELTA_TIME (dt spike)
    this.dtWasClamped = false;

    // Visibility change handler — pause loop when tab is hidden to prevent
    // large dt accumulation, resume when tab becomes visible again.
    this._onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (this.isRunning && !this.isPaused) {
          this._pausedByVisibility = true;
          this.pause();
        }
      } else if (document.visibilityState === 'visible') {
        if (this._pausedByVisibility) {
          this._pausedByVisibility = false;
          this.resume();
        }
      }
    };
    this._pausedByVisibility = false;
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  /**
   * Initialize the game loop manager
   */
  init() {
    // Nothing specific to initialize
    return this;
  }

  /**
   * Start the animation loop
   */
  startLoop() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.animate();

    return this;
  }

  /**
   * Stop the animation loop
   */
  stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.isRunning = false;
    return this;
  }

  /**
   * Pause the game loop (stops updates but maintains state for resume)
   */
  pause() {
    if (!this.isRunning || this.isPaused) {
      return this;
    }
    this.isPaused = true;
    this.stopLoop();
    return this;
  }

  /**
   * Resume the game loop after a pause
   */
  resume() {
    if (!this.isPaused) {
      return this;
    }
    this.isPaused = false;
    this.startLoop();
    return this;
  }

  /**
   * Main animation loop
   */
  animate() {
    if (this.isRunning) {
      this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    }

    // Calculate delta time for smooth animations
    const now = performance.now();
    this.deltaTime = (now - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = now;

    // Clamp dt to prevent physics explosions after tab switches or long pauses
    this.dtWasClamped = this.deltaTime > MAX_DELTA_TIME;
    if (this.dtWasClamped) {
      this.deltaTime = MAX_DELTA_TIME;
    }

    // Update game deltaTime if using clock
    if (this.game.clock && typeof this.game.clock.getDelta === 'function') {
      this.game.deltaTime = this.game.clock.getDelta();
    }

    // Run the update logic with error handling
    try {
      if (this.game.performanceManager) {
        this.game.performanceManager.beginFrame();

        this.update();

        if (typeof this.game.performanceManager.endFrame === 'function') {
          this.game.performanceManager.endFrame();
        }
      } else {
        this.update();
      }
    } catch (error) {
      console.error('Error in game loop:', error);
      // Continue rendering even if update fails
      if (this.game.renderer && this.game.scene && this.game.camera) {
        this.game.renderer.render(this.game.scene, this.game.camera);
      }
    }
  }

  /**
   * Update game state for a single frame
   * This is the central orchestrator of the update sequence
   */
  update() {
    // Skip update if core components aren't initialized
    if (!this.game.renderer || !this.game.scene || !this.game.camera) {
      return;
    }

    // 1. Update managers in sequence

    // 1.1 Update physics - must come first to update physical world
    if (this.game.physicsManager) {
      if (this.game.performanceManager) {
        this.game.performanceManager.startTimer('physics');
      }
      this.game.physicsManager.update(this.deltaTime);
      if (this.game.performanceManager) {
        this.game.performanceManager.endTimer('physics');
      }
    }

    // 1.2 Update ball - depends on physics, must come after physics
    if (this.game.ballManager) {
      if (this.game.performanceManager) {
        this.game.performanceManager.startTimer('ballUpdate');
      }
      this.game.ballManager.update();
      if (this.game.performanceManager) {
        this.game.performanceManager.endTimer('ballUpdate');
      }
    }

    // 1.2.5 Update hazards if present (for test compatibility)
    if (this.game.hazardManager) {
      this.game.hazardManager.update();
    }

    // 1.2.6 Update stuck ball detection
    if (this.game.stuckBallManager) {
      this.game.stuckBallManager.update(this.deltaTime);
    }

    // 1.3 Check for hole completion - depends on ball position
    if (this.game.holeManager) {
      this.game.holeManager.checkBallInHole();
    }

    // 1.4 Update camera - depends on ball position
    if (this.game.cameraController) {
      if (this.game.performanceManager) {
        this.game.performanceManager.startTimer('camera');
      }
      this.game.cameraController.update(this.deltaTime);
      if (this.game.performanceManager) {
        this.game.performanceManager.endTimer('camera');
      }
    }

    // 1.5 Update visual effects - depends on ball state
    if (this.game.visualEffectsManager) {
      if (this.game.performanceManager) {
        this.game.performanceManager.startTimer('effects');
      }
      this.game.visualEffectsManager.update(
        this.game.ballManager ? this.game.ballManager.ball : null
      );
      if (this.game.performanceManager) {
        this.game.performanceManager.endTimer('effects');
      }
    }

    // 1.6 Update CannonDebugRenderer - must be after physics update
    // Only update if the main debug mode AND the cannon renderer exist
    if (this.game.debugManager?.enabled && this.game.cannonDebugRenderer) {
      // Optional: Add performance tracking if needed
      this.game.cannonDebugRenderer.update();
    }

    // 1.8 Mobile performance monitoring (every few seconds)
    if (this.game.adaptiveFrameRate) {
      this.game.adaptiveFrameRate();
    }

    // Memory management check (run every 5 seconds)
    if (this.game.manageMemoryUsage && this.lastFrameTime % 5000 < this.deltaTime * 1000) {
      this.game.manageMemoryUsage();
    }

    // 1.9 Update space decorations (planet rotation, shooting stars)
    if (this.game.spaceDecorations) {
      this.game.spaceDecorations.update(this.deltaTime);
    }

    // 2. Render the scene with updated positions
    if (this.game.performanceManager) {
      this.game.performanceManager.startTimer('render');
    }
    this.game.renderer.render(this.game.scene, this.game.camera);
    if (this.game.performanceManager) {
      this.game.performanceManager.endTimer('render');
    }

    // 3. Update debug display if enabled - should be last to show final state
    if (this.game.debugManager && this.game.debugManager.enabled) {
      if (this.game.uiManager) {
        // Include performance metrics in debug display if available
        if (this.game.performanceManager) {
          const debugInfo = this.game.debugManager.getDebugInfo();
          debugInfo.performance = this.game.performanceManager.getDebugString();
          this.game.uiManager.updateDebugDisplay(debugInfo);
        } else {
          this.game.uiManager.updateDebugDisplay(this.game.debugManager.getDebugInfo());
        }
      }
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopLoop();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  }
}
