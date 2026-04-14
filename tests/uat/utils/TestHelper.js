/**
 * UAT Test Helper Utilities
 * Provides common functionality for user acceptance testing
 */

/** @param {number} ms */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export class TestHelper {
  constructor(page) {
    this.page = page;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.debugMode = process.env.DEBUG_UAT === 'true';
  }

  /**
   * Retry mechanism for flaky operations
   */
  async withRetry(operation, maxRetries = this.maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.log(`[TestHelper] Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[TestHelper] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  /**
   * Enhanced debugging method
   */
  async captureDebugInfo(context = 'general') {
    try {
      const debugInfo = await this.page.evaluate(() => {
        return {
          url: window.location.href,
          readyState: document.readyState,
          gameExists: !!window.game,
          gameProps: window.game ? Object.keys(window.game) : [],
          canvasExists: !!document.querySelector('canvas'),
          canvasCount: document.querySelectorAll('canvas').length,
          bodyChildCount: document.body.children.length,
          errors: window.onerror ? window.errors || [] : ['No error handler'],
          performance: {
            navigation: performance.navigation,
            timing: performance.timing
          },
          windowSize: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        };
      });

      if (this.debugMode) {
        console.log(`[TestHelper] Debug info (${context}):`, JSON.stringify(debugInfo, null, 2));
      }

      return debugInfo;
    } catch (error) {
      console.error('[TestHelper] Failed to capture debug info:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Remove webpack-dev-server's full-page overlay iframe if present (blocks pointer events).
   * Needed when reuseExistingServer runs a dev server started without NODE_ENV=test.
   */
  async dismissWebpackDevServerOverlay() {
    await this.page.evaluate(() => {
      const id = 'webpack-dev-server-client-overlay';
      const el = document.getElementById(id);
      if (el) {
        el.style.pointerEvents = 'none';
        el.style.display = 'none';
        el.remove();
      }
      document.querySelectorAll(`iframe#${id}`).forEach(node => {
        node.style.pointerEvents = 'none';
        node.remove();
      });
    });
  }

  /**
   * Wait for game initialization to complete with robust error handling
   */
  async waitForGameInitialization() {
    return await this.withRetry(async () => {
      console.log('[TestHelper] Starting game initialization wait...');
      
      // Capture initial debug info
      await this.captureDebugInfo('initialization-start');
      
      try {
        // Phase 1: Wait for page to load completely
        await this.page.waitForLoadState('networkidle', { timeout: 30000 });
        console.log('[TestHelper] Page network idle achieved');
        
        // Phase 2: Wait for loading overlay to disappear (optional - may not exist)
        try {
          await this.page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 15000 });
          console.log('[TestHelper] Loading overlay hidden');
        } catch (e) {
          console.log('[TestHelper] No loading overlay found, continuing...');
        }
        
        // Phase 3: Check if we need to click Play Course button first
        console.log('[TestHelper] Checking for menu screen...');
        const playButton = await this.page.locator('#play-course');
        if (await playButton.isVisible()) {
          console.log('[TestHelper] Menu screen detected, clicking Play Course button...');
          await this.dismissWebpackDevServerOverlay();
          // force: true — overlay can reappear before click; webpack may still inject iframe when reuseExistingServer
          await playButton.click({ force: true });
          await sleep(1000);
        }
        
        // Phase 4: Wait for canvas to be created with extended timeout
        console.log('[TestHelper] Waiting for canvas element...');
        await this.page.waitForSelector('canvas', { timeout: 30000 });
        console.log('[TestHelper] Canvas element found');
        
        // Phase 5: Wait for game object to exist
        console.log('[TestHelper] Waiting for game object...');
        await this.page.waitForFunction(() => {
          return window.game !== undefined || window.App !== undefined;
        }, { timeout: 30000 });
        console.log('[TestHelper] Game/App object exists');
        
        // Phase 6: Wait for basic game components
        console.log('[TestHelper] Waiting for game components...');
        await this.page.waitForFunction(() => {
          // Check both window.game and window.App patterns
          return (window.game && window.game.renderer && window.game.scene) ||
                 (window.App && window.App.game && window.App.game.renderer);
        }, { timeout: 30000 });
        console.log('[TestHelper] Game renderer and scene ready');
        
        // Phase 7: Wait for game to be fully initialized
        console.log('[TestHelper] Waiting for full game initialization...');
        await this.page.waitForFunction(() => {
          // Check multiple possible ready states
          const game = window.game || (window.App && window.App.game);
          return game && (
            game.isInitialized || 
            game.ready || 
            game.gameState === 'ready' ||
            game.gameState === 'playing' ||
            game.gameState === 'aiming' ||
            (game.ballManager && game.ballManager.ball)
          );
        }, { timeout: 30000 });
        console.log('[TestHelper] Game fully initialized');
        
        // Phase 8: Small delay for final setup
        await sleep(2000);
        console.log('[TestHelper] Game initialization complete');
        
        // Final validation
        const finalDebugInfo = await this.captureDebugInfo('initialization-complete');
        if (!finalDebugInfo.gameExists || !finalDebugInfo.canvasExists) {
          throw new Error('Final validation failed - game or canvas missing after initialization');
        }
        
      } catch (error) {
        // Enhanced error reporting
        console.error('[TestHelper] Game initialization failed:', error.message);
        
        // Capture comprehensive debug information
        const debugInfo = await this.captureDebugInfo('initialization-failed');
        
        // Take screenshot for debugging
        try {
          await this.page.screenshot({ 
            path: `tests/uat/screenshots/debug-initialization-failure-${Date.now()}.png`,
            fullPage: true 
          });
          console.log('[TestHelper] Debug screenshot saved');
        } catch (screenshotError) {
          console.error('[TestHelper] Failed to save debug screenshot:', screenshotError.message);
        }
        
        throw new Error(`Game initialization failed: ${error.message}. Debug info: ${JSON.stringify(debugInfo)}`);
      }
    });
  }

  /**
   * Simulate ball hit with power and direction
   */
  async hitBall(power = 0.5, direction = { x: 0, y: 0 }) {
    await this.page.evaluate(({ power, direction }) => {
      if (window.game && window.game.ballManager) {
        window.game.ballManager.hitBall(power, direction);
      }
    }, { power, direction });
  }

  /**
   * Wait for ball to stop moving with enhanced validation
   */
  async waitForBallToStop() {
    console.log('[TestHelper] Waiting for ball to stop...');
    
    try {
      await this.page.waitForFunction(() => {
        if (!window.game || !window.game.ballManager || !window.game.ballManager.ball) {
          return false;
        }
        
        const velocity = window.game.ballManager.ball.body.velocity;
        const speed = velocity.lengthSquared();
        
        return speed < 0.01;
      }, { timeout: 20000 });
      
      // Debug log ball velocity if debug mode is enabled
      if (this.debugMode) {
        const ballState = await this.page.evaluate(() => {
          if (!window.game || !window.game.ballManager || !window.game.ballManager.ball) {
            return null;
          }
          const velocity = window.game.ballManager.ball.body.velocity;
          return {
            velocityX: velocity.x,
            velocityY: velocity.y,
            velocityZ: velocity.z,
            speed: velocity.lengthSquared()
          };
        });
        
        if (ballState) {
          console.log('[TestHelper][DEBUG] Ball stopped with final velocity:', ballState);
        }
      }
      
      console.log('[TestHelper] Ball has stopped moving');
    } catch (error) {
      console.error('[TestHelper] Ball stop timeout:', error.message);
      
      // Get ball state for debugging
      const ballState = await this.page.evaluate(() => {
        if (!window.game || !window.game.ballManager) {
          return { error: 'No ball manager' };
        }
        
        const ball = window.game.ballManager.ball;
        if (!ball) {
          return { error: 'No ball object' };
        }
        
        return {
          velocity: ball.body.velocity,
          position: ball.body.position,
          velocityLength: ball.body.velocity.lengthSquared()
        };
      });
      
      console.error('[TestHelper] Ball state:', ballState);
      throw new Error(`Ball failed to stop within timeout. Ball state: ${JSON.stringify(ballState)}`);
    }
  }

  /**
   * Get current game state
   */
  async getGameState() {
    return await this.page.evaluate(() => {
      return window.game ? window.game.gameState : null;
    });
  }

  /**
   * Get current hole number
   */
  async getCurrentHole() {
    return await this.page.evaluate(() => {
      return window.game && window.game.stateManager ? 
             window.game.stateManager.currentHole : null;
    });
  }

  /**
   * Get current stroke count
   */
  async getStrokeCount() {
    return await this.page.evaluate(() => {
      return window.game && window.game.scoringSystem ? 
             window.game.scoringSystem.getCurrentHoleStrokes() : null;
    });
  }

  /**
   * Get total score
   */
  async getTotalScore() {
    return await this.page.evaluate(() => {
      return window.game && window.game.scoringSystem ? 
             window.game.scoringSystem.getTotalScore() : null;
    });
  }

  /**
   * Simulate touch gesture for mobile testing
   */
  async simulateTouch(x, y, action = 'tap') {
    if (action === 'tap') {
      await this.page.touchscreen.tap(x, y);
    } else if (action === 'swipe') {
      await this.page.touchscreen.tap(x, y);
      await this.page.touchscreen.tap(x + 100, y + 100);
    }
  }

  /**
   * Check for performance issues
   */
  async checkPerformance() {
    const metrics = await this.page.evaluate(() => {
      return {
        fps: window.game?.performanceManager?.currentFPS || 0,
        memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 0,
        renderTime: window.game?.performanceManager?.lastRenderTime || 0
      };
    });
    return metrics;
  }

  /**
   * Take screenshot for visual regression testing
   */
  async takeScreenshot(name) {
    return await this.page.screenshot({
      path: `tests/uat/screenshots/${name}.png`,
      fullPage: true
    });
  }

  /**
   * Check if game is responsive on mobile
   */
  async checkMobileResponsiveness() {
    const viewport = this.page.viewportSize();
    const canvas = await this.page.locator('canvas').boundingBox();
    
    return {
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      isResponsive: canvas.width <= viewport.width && canvas.height <= viewport.height
    };
  }
}