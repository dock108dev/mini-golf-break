import { debug } from '../utils/debug';

/**
 * WebGLContextManager - Handles WebGL context loss and restoration gracefully.
 * Pauses the game loop on context loss, shows an overlay, and reinitializes
 * the renderer on restoration.
 */
export class WebGLContextManager {
  constructor(game) {
    this.game = game;
    this.overlay = null;
    this.isContextLost = false;

    // Bound handlers for cleanup
    this.boundHandleContextLost = this.handleContextLost.bind(this);
    this.boundHandleContextRestored = this.handleContextRestored.bind(this);
  }

  /**
   * Initialize context loss listeners on the renderer's canvas.
   * Must be called after the renderer is created.
   */
  init() {
    const canvas = this.game.renderer?.domElement;
    if (!canvas) {
      debug.log('[WebGLContextManager] No canvas available, skipping init.');
      return this;
    }

    canvas.addEventListener('webglcontextlost', this.boundHandleContextLost);
    canvas.addEventListener('webglcontextrestored', this.boundHandleContextRestored);

    debug.log('[WebGLContextManager] Context loss listeners attached.');
    return this;
  }

  /**
   * Handle WebGL context lost event.
   * @param {WebGLContextEvent} event
   */
  handleContextLost(event) {
    event.preventDefault(); // Allow context restoration
    this.isContextLost = true;

    debug.log('[WebGLContextManager] WebGL context lost.');

    // Pause the game loop
    if (this.game.gameLoopManager) {
      this.game.gameLoopManager.stopLoop();
    }

    // Show the context loss overlay
    this.showOverlay();
  }

  /**
   * Handle WebGL context restored event.
   * @param {Event} event
   */
  handleContextRestored(_event) {
    debug.log('[WebGLContextManager] WebGL context restored.');
    this.restoreGame();
  }

  /**
   * Restore the game after context loss.
   * Reinitializes the renderer and reloads the current hole.
   */
  async restoreGame() {
    if (!this.isContextLost) {
      return;
    }

    try {
      this.isContextLost = false;

      // Reinitialize renderer state (Three.js handles internal GL state recovery)
      if (this.game.renderer) {
        this.game.renderer.setSize(window.innerWidth, window.innerHeight);
        this.game.renderer.shadowMap.enabled = true;
        this.game.renderer.shadowMap.needsUpdate = true;
      }

      // Reload the current hole to rebuild GPU resources
      await this.reloadCurrentHole();

      // Restart the game loop
      if (this.game.gameLoopManager) {
        this.game.gameLoopManager.startLoop();
      }

      // Hide the overlay
      this.hideOverlay();

      debug.log('[WebGLContextManager] Game restored successfully.');
    } catch (error) {
      console.error('[WebGLContextManager] Failed to restore game:', error);
      // Keep overlay visible so user can retry
    }
  }

  /**
   * Reload the current hole to rebuild GPU-side resources (textures, buffers).
   */
  async reloadCurrentHole() {
    if (!this.game.course) {
      return;
    }

    const currentHoleNumber = this.game.stateManager?.getCurrentHoleNumber() || 1;
    debug.log(`[WebGLContextManager] Reloading hole #${currentHoleNumber}`);

    try {
      // Clear and recreate the current hole
      this.game.course.clearCurrentHole();
      await this.game.course.createCourse(currentHoleNumber);

      // Recreate the ball at the start position
      if (this.game.ballManager) {
        this.game.ballManager.removeBall();
        const startPosition = this.game.course.getHoleStartPosition();
        if (startPosition) {
          this.game.ballManager.createBall(startPosition);
        }
      }

      // Re-enable input
      if (this.game.inputController) {
        this.game.inputController.enableInput();
      }
    } catch (error) {
      console.error('[WebGLContextManager] Failed to reload hole:', error);
      throw error;
    }
  }

  /**
   * Show the context loss overlay with a retry button.
   */
  showOverlay() {
    // Don't create duplicate overlays
    if (this.overlay) {
      return;
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'webgl-context-lost-overlay';
    this.overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:rgba(0,0,0,0.85);display:flex;flex-direction:column;' +
      'justify-content:center;align-items:center;z-index:9999;color:white;' +
      'font-family:Arial,sans-serif;';

    const message = document.createElement('div');
    message.textContent = 'Connection Lost';
    message.style.cssText = 'font-size:2em;margin-bottom:16px;';

    const detail = document.createElement('div');
    detail.textContent = 'The graphics context was lost. This can happen under memory pressure.';
    detail.style.cssText = 'font-size:1em;margin-bottom:24px;opacity:0.7;text-align:center;max-width:400px;';

    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry';
    retryButton.style.cssText =
      'padding:12px 32px;font-size:1.1em;cursor:pointer;border:none;' +
      'border-radius:6px;background:#2d8b57;color:white;';
    retryButton.addEventListener('click', () => {
      this.restoreGame();
    });

    this.overlay.appendChild(message);
    this.overlay.appendChild(detail);
    this.overlay.appendChild(retryButton);
    document.body.appendChild(this.overlay);
  }

  /**
   * Hide and remove the context loss overlay.
   */
  hideOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  /**
   * Clean up event listeners and overlay.
   */
  cleanup() {
    const canvas = this.game.renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', this.boundHandleContextLost);
      canvas.removeEventListener('webglcontextrestored', this.boundHandleContextRestored);
    }

    this.hideOverlay();
    this.isContextLost = false;
  }
}
