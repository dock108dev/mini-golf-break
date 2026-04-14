/**
 * Core Game Flow UAT Tests
 * Tests the complete user journey through the mini-golf game
 */

const { test, expect } = require('@playwright/test');
const { TestHelper } = require('./utils/TestHelper');
const { sleep } = require('./utils/sleep');

test.describe('Core Game Flow', () => {
  let testHelper;

  test.beforeEach(async ({ page }) => {
    testHelper = new TestHelper(page);
    await page.goto('/');
  });

  test('should load game and initialize successfully', async ({ page }) => {
    // Test game initialization
    await testHelper.waitForGameInitialization();
    
    // Verify game state
    const gameState = await testHelper.getGameState();
    expect(gameState).toBeTruthy();
    
    // Verify UI elements are present
    await expect(page.locator('#hole-info')).toBeVisible();
    await expect(page.locator('#score-info')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    
    // Take screenshot for visual regression
    await testHelper.takeScreenshot('game-initialized');
  });

  test('should complete a full hole playthrough', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Get initial state
    const initialHole = await testHelper.getCurrentHole();
    const initialStrokes = await testHelper.getStrokeCount();
    
    expect(initialHole).toBe(1);
    expect(initialStrokes).toBe(0);
    
    // Hit the ball
    await testHelper.hitBall(0.7, { x: 0, y: 1 });
    
    // Wait for ball to stop
    await testHelper.waitForBallToStop();
    
    // Verify stroke count increased
    const strokesAfterHit = await testHelper.getStrokeCount();
    expect(strokesAfterHit).toBe(1);
    
    // Take screenshot after first hit
    await testHelper.takeScreenshot('after-first-hit');
  });

  test('should handle multiple strokes per hole', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Hit ball multiple times
    for (let i = 1; i <= 3; i++) {
      await testHelper.hitBall(0.3, { x: 0.1 * i, y: 0.5 });
      await testHelper.waitForBallToStop();
      
      const strokes = await testHelper.getStrokeCount();
      expect(strokes).toBe(i);
      
      // Small delay between shots
      await sleep(500);
    }
    
    await testHelper.takeScreenshot('multiple-strokes');
  });

  test('should transition between holes', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Simulate hole completion by hitting ball into hole
    await page.evaluate(() => {
      if (window.game && window.game.ballManager) {
        // Force ball into hole position for testing
        window.game.ballManager.ball.body.position.set(0, 0, 0);
        window.game.ballManager.checkHoleCompletion();
      }
    });
    
    // Wait for hole transition
    await sleep(2000);
    
    // Verify hole number increased
    const newHole = await testHelper.getCurrentHole();
    expect(newHole).toBeGreaterThan(1);
    
    await testHelper.takeScreenshot('hole-transition');
  });

  test('should display accurate scoring', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Hit ball and verify score updates
    await testHelper.hitBall(0.5);
    await testHelper.waitForBallToStop();
    
    // Check UI reflects correct score
    const strokeDisplay = await page.locator('#stroke-count').textContent();
    const strokeCount = await testHelper.getStrokeCount();
    
    expect(parseInt(strokeDisplay)).toBe(strokeCount);
    expect(strokeCount).toBeGreaterThan(0);
  });

  test('should handle game completion', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Simulate completing all holes
    await page.evaluate(() => {
      if (window.game && window.game.stateManager) {
        // Force game completion for testing
        window.game.stateManager.currentHole = 9;
        window.game.stateManager.completeHole();
      }
    });
    
    // Wait for game completion UI
    await sleep(3000);
    
    // Verify game completion state
    const gameState = await testHelper.getGameState();
    expect(gameState).toBe('game_completed');
    
    await testHelper.takeScreenshot('game-completed');
  });

  test('should maintain performance during gameplay', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Monitor performance during gameplay
    const initialMetrics = await testHelper.checkPerformance();
    
    // Simulate intensive gameplay
    for (let i = 0; i < 5; i++) {
      await testHelper.hitBall(0.8, { x: Math.random() - 0.5, y: Math.random() });
      await sleep(1000);
    }
    
    const finalMetrics = await testHelper.checkPerformance();
    
    // Verify performance remains acceptable
    expect(finalMetrics.fps).toBeGreaterThan(30);
    expect(finalMetrics.renderTime).toBeLessThan(16); // < 16ms for 60fps
    
    // Memory shouldn't grow excessively
    if (initialMetrics.memoryUsage > 0) {
      const memoryGrowth = finalMetrics.memoryUsage - initialMetrics.memoryUsage;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
    }
  });

  test('should handle errors gracefully', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Inject a potential error scenario
    await page.evaluate(() => {
      // Temporarily break physics to test error handling
      if (window.game && window.game.physicsManager) {
        const originalStep = window.game.physicsManager.step;
        window.game.physicsManager.step = function() {
          try {
            originalStep.call(this);
          } catch (error) {
            console.warn('Physics step error handled:', error);
          }
        };
      }
    });
    
    // Verify game continues to function
    await testHelper.hitBall(0.5);
    await sleep(2000);
    
    // Game should still be responsive
    const gameState = await testHelper.getGameState();
    expect(gameState).toBeTruthy();
  });
});

test.describe('Game State Management', () => {
  let testHelper;

  test.beforeEach(async ({ page }) => {
    testHelper = new TestHelper(page);
    await page.goto('/');
    await testHelper.waitForGameInitialization();
  });

  test('should handle pause and resume', async ({ page }) => {
    // Simulate pause
    await page.evaluate(() => {
      if (window.game && window.game.stateManager) {
        window.game.stateManager.setState('paused');
      }
    });
    
    const pausedState = await testHelper.getGameState();
    expect(pausedState).toBe('paused');
    
    // Resume game
    await page.evaluate(() => {
      if (window.game && window.game.stateManager) {
        window.game.stateManager.setState('aiming');
      }
    });
    
    const resumedState = await testHelper.getGameState();
    expect(resumedState).toBe('aiming');
  });

  test('should maintain state consistency', async ({ page }) => {
    const initialState = await testHelper.getGameState();
    const initialHole = await testHelper.getCurrentHole();
    const initialStrokes = await testHelper.getStrokeCount();
    
    // Perform actions and verify state remains consistent
    await testHelper.hitBall(0.3);
    await testHelper.waitForBallToStop();
    
    const newStrokes = await testHelper.getStrokeCount();
    const newHole = await testHelper.getCurrentHole();
    
    expect(newHole).toBe(initialHole); // Same hole
    expect(newStrokes).toBe(initialStrokes + 1); // Incremented strokes
  });
});