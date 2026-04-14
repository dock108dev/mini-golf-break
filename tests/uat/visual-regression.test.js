/**
 * Visual Regression UAT Tests
 * Tests for visual consistency and regression detection
 */

const { test, expect } = require('@playwright/test');
const { TestHelper } = require('./utils/TestHelper');
const { sleep } = require('./utils/sleep');
const fs = require('fs');
const path = require('path');

class VisualRegressionHelper {
  constructor(page) {
    this.page = page;
    this.testHelper = new TestHelper(page);
    this.baselineDir = path.join(__dirname, 'screenshots', 'baseline');
    this.currentDir = path.join(__dirname, 'screenshots', 'current');
  }

  /**
   * Take a screenshot and compare with baseline
   */
  async compareVisual(name, options = {}) {
    const screenshotOptions = {
      fullPage: false,
      clip: options.clip,
      threshold: options.threshold || 0.2,
      ...options
    };

    // Take current screenshot
    const currentPath = path.join(this.currentDir, `${name}.png`);
    await this.page.screenshot({
      path: currentPath,
      ...screenshotOptions
    });

    // Compare with baseline if it exists
    const baselinePath = path.join(this.baselineDir, `${name}.png`);
    
    if (fs.existsSync(baselinePath)) {
      // Use Playwright's built-in visual comparison
      await expect(this.page).toHaveScreenshot(`${name}.png`, {
        threshold: screenshotOptions.threshold,
        maxDiffPixels: options.maxDiffPixels || 1000
      });
    } else {
      // Create baseline if it doesn't exist
      fs.copyFileSync(currentPath, baselinePath);
      console.log(`Created baseline image: ${baselinePath}`);
    }

    return currentPath;
  }

  /**
   * Wait for animations to complete before screenshot
   */
  async waitForStableVisuals() {
    // Wait for any animations or transitions to complete
    await this.page.waitForLoadState('networkidle');
    await sleep(1000); // Additional stability wait
    
    // Wait for any CSS animations to complete
    await this.page.waitForFunction(() => {
      return document.getAnimations().length === 0;
    }, { timeout: 5000 }).catch(() => {
      // Ignore timeout - some animations might be continuous
    });
  }
}

test.describe('Visual Regression Testing', () => {
  let visualHelper;
  let testHelper;

  test.beforeEach(async ({ page }) => {
    visualHelper = new VisualRegressionHelper(page);
    testHelper = new TestHelper(page);
    await page.goto('/');
  });

  test('should match game initialization visuals', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    await visualHelper.waitForStableVisuals();
    
    // Compare main game view
    await visualHelper.compareVisual('game-init-full', {
      fullPage: true,
      threshold: 0.1
    });
    
    // Compare specific UI elements
    await visualHelper.compareVisual('game-init-ui', {
      clip: { x: 0, y: 0, width: 400, height: 200 }
    });
  });

  test('should detect visual changes in game elements', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Take screenshot of initial state
    await visualHelper.waitForStableVisuals();
    await visualHelper.compareVisual('pre-shot-state');
    
    // Hit ball and wait for movement
    await testHelper.hitBall(0.5);
    await sleep(2000); // Allow for ball movement
    await testHelper.waitForBallToStop();
    
    // Compare post-shot state
    await visualHelper.waitForStableVisuals();
    await visualHelper.compareVisual('post-shot-state');
  });

  test('should maintain visual consistency across UI states', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Test different game states visually
    const states = ['aiming', 'paused'];
    
    for (const state of states) {
      await page.evaluate((stateName) => {
        if (window.game && window.game.stateManager) {
          window.game.stateManager.setState(stateName);
        }
      }, state);
      
      await visualHelper.waitForStableVisuals();
      await visualHelper.compareVisual(`state-${state}`, {
        threshold: 0.15
      });
    }
  });

  test('should detect UI element positioning issues', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    await visualHelper.waitForStableVisuals();
    
    // Test individual UI components
    const uiElements = [
      { name: 'hole-info', selector: '#hole-info' },
      { name: 'score-info', selector: '#score-info' },
      { name: 'power-indicator', selector: '#power-indicator-container' }
    ];
    
    for (const element of uiElements) {
      const locator = page.locator(element.selector);
      await expect(locator).toBeVisible();
      
      const boundingBox = await locator.boundingBox();
      if (boundingBox) {
        await visualHelper.compareVisual(`ui-${element.name}`, {
          clip: boundingBox,
          threshold: 0.05
        });
      }
    }
  });

  test('should handle viewport size changes visually', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    const viewportSizes = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];
    
    for (const viewport of viewportSizes) {
      await page.setViewportSize(viewport);
      await sleep(1000); // Allow for responsive adjustments
      await visualHelper.waitForStableVisuals();
      
      await visualHelper.compareVisual(`responsive-${viewport.name}`, {
        fullPage: true,
        threshold: 0.2 // Higher threshold for responsive changes
      });
    }
  });

  test('should detect canvas rendering differences', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    await visualHelper.waitForStableVisuals();
    
    // Focus on just the game canvas
    const canvas = await page.locator('canvas').boundingBox();
    if (canvas) {
      await visualHelper.compareVisual('canvas-rendering', {
        clip: canvas,
        threshold: 0.1,
        maxDiffPixels: 2000 // Allow for minor rendering differences
      });
    }
    
    // Test canvas after interaction
    await testHelper.hitBall(0.3);
    await testHelper.waitForBallToStop();
    await visualHelper.waitForStableVisuals();
    
    if (canvas) {
      await visualHelper.compareVisual('canvas-post-interaction', {
        clip: canvas,
        threshold: 0.15,
        maxDiffPixels: 3000
      });
    }
  });

  test('should validate visual accessibility', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    await visualHelper.waitForStableVisuals();
    
    // Test high contrast mode simulation
    await page.addStyleTag({
      content: `
        * {
          filter: contrast(200%) !important;
        }
      `
    });
    
    await sleep(500);
    await visualHelper.compareVisual('high-contrast', {
      threshold: 0.3 // Higher threshold for contrast changes
    });
    
    // Remove high contrast
    await page.reload();
    await testHelper.waitForGameInitialization();
  });

  test('should detect performance-related visual issues', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Simulate performance stress
    await page.evaluate(() => {
      // Create artificial load to test visual degradation
      for (let i = 0; i < 10; i++) {
        if (window.game && window.game.ballManager) {
          window.game.ballManager.hitBall(0.1 + i * 0.05, { x: Math.random(), y: Math.random() });
        }
      }
    });
    
    await sleep(3000); // Let performance stabilize
    await visualHelper.waitForStableVisuals();
    
    await visualHelper.compareVisual('performance-stress', {
      threshold: 0.25,
      maxDiffPixels: 5000
    });
  });

  test('should compare visual states across game progression', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Capture visual progression through multiple holes
    for (let hole = 1; hole <= 3; hole++) {
      await visualHelper.waitForStableVisuals();
      await visualHelper.compareVisual(`hole-${hole}-start`);
      
      // Complete hole simulation
      await testHelper.hitBall(0.6);
      await testHelper.waitForBallToStop();
      
      await visualHelper.compareVisual(`hole-${hole}-post-shot`);
      
      // Simulate hole completion if not at last hole
      if (hole < 3) {
        await page.evaluate(() => {
          if (window.game && window.game.stateManager) {
            window.game.stateManager.completeHole();
          }
        });
        await sleep(2000); // Transition time
      }
    }
  });
});

test.describe('Visual Regression - Error States', () => {
  let visualHelper;
  let testHelper;

  test.beforeEach(async ({ page }) => {
    visualHelper = new VisualRegressionHelper(page);
    testHelper = new TestHelper(page);
    await page.goto('/');
  });

  test('should capture error state visuals', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Simulate error state
    await page.evaluate(() => {
      if (window.game && window.game.eventManager) {
        window.game.eventManager.emit('system:error', {
          message: 'Test error for visual regression',
          type: 'warning'
        });
      }
    });
    
    await sleep(1000);
    await visualHelper.waitForStableVisuals();
    
    await visualHelper.compareVisual('error-state', {
      threshold: 0.1
    });
  });

  test('should handle loading state visuals', async ({ page }) => {
    // Capture loading state before initialization
    await visualHelper.compareVisual('loading-state', {
      threshold: 0.05
    });
    
    await testHelper.waitForGameInitialization();
    await visualHelper.waitForStableVisuals();
    
    await visualHelper.compareVisual('loaded-state', {
      threshold: 0.1
    });
  });
});