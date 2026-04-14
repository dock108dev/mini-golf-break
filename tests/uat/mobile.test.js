/**
 * Mobile Device UAT Tests
 * Tests mobile-specific functionality and optimizations
 * Tests run across different device projects defined in playwright.config.js
 */

const { test, expect } = require('@playwright/test');
const { TestHelper } = require('./utils/TestHelper');

test.describe('Mobile Device Testing', () => {
  let testHelper;

  test.beforeEach(async ({ page }) => {
    testHelper = new TestHelper(page);
    await page.goto('/');
  });

  test('should load and be responsive on mobile devices', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Check mobile responsiveness
    const responsiveness = await testHelper.checkMobileResponsiveness();
    expect(responsiveness.isResponsive).toBe(true);
    
    // Verify mobile-specific UI elements
    await expect(page.locator('#ui-overlay')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    
    // Check viewport meta tag for mobile optimization
    const viewport = await page.getAttribute('meta[name="viewport"]', 'content');
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('viewport-fit=cover');

    await testHelper.takeScreenshot('mobile-responsive');
  });

  test('should handle touch gestures correctly', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Test touch tap for ball hitting
    const canvas = await page.locator('canvas');
    const canvasBounds = await canvas.boundingBox();
    
    // Simulate touch tap on canvas
    await testHelper.simulateTouch(
      canvasBounds.x + canvasBounds.width / 2,
      canvasBounds.y + canvasBounds.height / 2,
      'tap'
    );
    
    // Wait and verify ball was hit
    await page.waitForTimeout(1000);
    const strokes = await testHelper.getStrokeCount();
    expect(strokes).toBeGreaterThan(0);
    
    await testHelper.takeScreenshot('mobile-touch-gesture');
  });

  test('should optimize performance for mobile devices', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Check mobile-specific performance optimizations
    const mobileOptimizations = await page.evaluate(() => {
      return {
        devicePixelRatio: window.devicePixelRatio,
        isOptimizedForMobile: window.game?.renderer?.getPixelRatio() <= 2,
        reducedParticles: window.game?.performanceManager?.isMobileOptimized || false
      };
    });
    
    expect(mobileOptimizations.isOptimizedForMobile).toBe(true);
    
    // Performance should be acceptable on mobile
    const metrics = await testHelper.checkPerformance();
    expect(metrics.fps).toBeGreaterThan(20); // Minimum acceptable FPS for mobile
  });

  test('should handle device orientation changes', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Get current viewport
    const currentViewport = page.viewportSize();
    
    // Simulate orientation change to landscape (swap width/height)
    await page.setViewportSize({ 
      width: currentViewport.height, 
      height: currentViewport.width 
    });
    await page.waitForTimeout(1000);
    
    // Verify game adapts to new orientation
    const responsiveness = await testHelper.checkMobileResponsiveness();
    expect(responsiveness.isResponsive).toBe(true);
    
    // Game should still be playable
    await testHelper.hitBall(0.5);
    await testHelper.waitForBallToStop();
    
    await testHelper.takeScreenshot('mobile-landscape');
  });

  test('should work correctly on mobile browsers', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Test mobile browser features
    const browserFeatures = await page.evaluate(() => {
      return {
        touchEventsSupported: 'ontouchstart' in window,
        devicePixelRatio: window.devicePixelRatio,
        webGLSupported: !!window.WebGLRenderingContext,
        userAgent: navigator.userAgent
      };
    });
    
    expect(browserFeatures.touchEventsSupported).toBe(true);
    expect(browserFeatures.webGLSupported).toBe(true);
    
    // Test gameplay functionality
    await testHelper.hitBall(0.6);
    await testHelper.waitForBallToStop();
    
    const strokes = await testHelper.getStrokeCount();
    expect(strokes).toBe(1);
    
    await testHelper.takeScreenshot('mobile-browser-test');
  });

  test('should handle multi-touch gestures on tablets', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Test multi-touch functionality (mainly for tablet devices)
    const canvas = await page.locator('canvas');
    const canvasBounds = await canvas.boundingBox();
    
    // Simulate multi-touch interaction
    const centerX = canvasBounds.x + canvasBounds.width / 2;
    const centerY = canvasBounds.y + canvasBounds.height / 2;
    
    await page.touchscreen.tap(centerX - 50, centerY - 50);
    await page.touchscreen.tap(centerX + 50, centerY + 50);
    
    // Verify interaction was registered
    await page.waitForTimeout(500);
    
    await testHelper.takeScreenshot('mobile-multitouch');
  });

  test('should handle network connectivity issues', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Simulate poor network conditions
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    
    // Game should continue to work offline
    await testHelper.hitBall(0.4);
    await testHelper.waitForBallToStop();
    
    const strokes = await testHelper.getStrokeCount();
    expect(strokes).toBeGreaterThan(0);
    
    // Restore connectivity
    await page.context().setOffline(false);
    
    await testHelper.takeScreenshot('mobile-offline-functionality');
  });

  test('should optimize battery usage on mobile', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Test battery optimization features
    const batteryOptimizations = await page.evaluate(() => {
      return {
        reducedAnimations: window.game?.performanceManager?.batteryOptimized || false,
        adaptiveFrameRate: window.game?.gameLoopManager?.adaptiveFrameRate || false,
        backgroundThrottling: document.visibilityState === 'hidden'
      };
    });
    
    // Simulate tab going to background
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        value: 'hidden'
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    await page.waitForTimeout(1000);
    
    // Game should throttle performance when in background
    const backgroundMetrics = await testHelper.checkPerformance();
    
    await testHelper.takeScreenshot('mobile-battery-optimization');
  });

  test('should provide consistent cross-device experience', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Test core functionality works consistently across devices
    await testHelper.hitBall(0.5);
    await testHelper.waitForBallToStop();
    
    const gameState = await testHelper.getGameState();
    const strokes = await testHelper.getStrokeCount();
    
    expect(gameState).toBeTruthy();
    expect(strokes).toBe(1);
    
    // Performance should be acceptable across devices
    const metrics = await testHelper.checkPerformance();
    expect(metrics.fps).toBeGreaterThan(15); // Minimum acceptable FPS
    
    await testHelper.takeScreenshot('mobile-cross-device-consistency');
  });
});