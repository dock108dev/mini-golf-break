import { EventTypes } from '../events/EventTypes';

/** Maximum delta time in seconds — frames exceeding this are clamped. */
export const MAX_DELTA_TIME = 1 / 30; // ~33ms

/** Stop the loop after this many consecutive frame errors to prevent console flooding. */
const MAX_LOOP_ERRORS = 3;

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
      this._loopErrorCount = 0;
    } catch (error) {
      this._loopErrorCount = (this._loopErrorCount || 0) + 1;
      console.error(`Error in game loop (occurrence #${this._loopErrorCount}):`, error);
      if (this._loopErrorCount >= MAX_LOOP_ERRORS) {
        console.error('GameLoopManager: too many consecutive errors — stopping loop');
        this.stop();
        this.game.eventManager?.publish(EventTypes.ERROR_OCCURRED, {
          source: 'GameLoopManager',
          error: error.message,
          fatal: true
        });
        return;
      }
      // Continue rendering so the scene stays visible while we wait for recovery
      if (this.game.renderer && this.game.scene && this.game.camera) {
        this.game.renderer.render(this.game.scene, this.game.camera);
      }
    }
  }

  _updatePhysicsBallAndHazards() {
    if (this.game.physicsManager) {
      if (this.game.performanceManager) {
        this.game.performanceManager.startTimer('physics');
      }
      this.game.physicsManager.update(this.deltaTime);
      if (this.game.performanceManager) {
        this.game.performanceManager.endTimer('physics');
      }
    }

    if (this.game.ballManager) {
      if (this.game.performanceManager) {
        this.game.performanceManager.startTimer('ballUpdate');
      }
      this.game.ballManager.update();
      if (this.game.performanceManager) {
        this.game.performanceManager.endTimer('ballUpdate');
      }
    }

    if (this.game.hazardManager) {
      this.game.hazardManager.update();
    }

    if (this.game.stuckBallManager) {
      this.game.stuckBallManager.update(this.deltaTime);
    }
  }

  _updateHoleCameraEffectsAndDecorations() {
    if (this.game.holeManager) {
      this.game.holeManager.checkBallInHole();
    }

    if (this.game.holeFlyoverManager) {
      this.game.holeFlyoverManager.update(this.deltaTime);
    }

    if (this.game.cameraController) {
      if (this.game.performanceManager) {
        this.game.performanceManager.startTimer('camera');
      }
      this.game.cameraController.update(this.deltaTime);
      if (this.game.performanceManager) {
        this.game.performanceManager.endTimer('camera');
      }
    }

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

    const dm = this.game.debugManager;
    if ((dm?.enabled || dm?.wireframeEnabled) && this.game.cannonDebugRenderer) {
      this.game.cannonDebugRenderer.update();
    }

    if (this.game.adaptiveFrameRate) {
      this.game.adaptiveFrameRate();
    }

    if (this.game.manageMemoryUsage && this.lastFrameTime % 5000 < this.deltaTime * 1000) {
      this.game.manageMemoryUsage();
    }

    if (this.game.spaceDecorations) {
      this.game.spaceDecorations.update(this.deltaTime);
    }

    if (this.game.starField) {
      this.game.starField.update(this.game.camera);
    }

    if (this.game.inputController) {
      this.game.inputController.update(this.deltaTime);
    }
  }

  _renderScene() {
    if (this.game.performanceManager) {
      this.game.performanceManager.startTimer('render');
    }
    if (this.game.composer) {
      this.game.composer.render();
    } else {
      this.game.renderer.render(this.game.scene, this.game.camera);
    }
    if (this.game.performanceManager) {
      this.game.performanceManager.endTimer('render');
    }
  }

  _updateDebugUI() {
    if (!this.game.debugManager || !this.game.debugManager.enabled || !this.game.uiManager) {
      return;
    }
    if (this.game.performanceManager) {
      const debugInfo = this.game.debugManager.getDebugInfo();
      debugInfo.performance = this.game.performanceManager.getDebugString();
      this.game.uiManager.updateDebugDisplay(debugInfo);
    } else {
      this.game.uiManager.updateDebugDisplay(this.game.debugManager.getDebugInfo());
    }
  }

  /**
   * Update game state for a single frame
   * This is the central orchestrator of the update sequence
   */
  update() {
    if (!this.game.renderer || !this.game.scene || !this.game.camera) {
      return;
    }

    this._updatePhysicsBallAndHazards();
    this._updateHoleCameraEffectsAndDecorations();
    this._renderScene();
    this._updateDebugUI();
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopLoop();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  }
}
