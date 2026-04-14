/**
 * Performance Benchmarking UAT Tests
 * Tests for game performance, memory usage, and optimization validation
 */

const { test, expect } = require('@playwright/test');
const { TestHelper } = require('./utils/TestHelper');
const { sleep } = require('./utils/sleep');

class PerformanceBenchmark {
  constructor(page) {
    this.page = page;
    this.testHelper = new TestHelper(page);
    this.metrics = {
      frameRates: [],
      memorySnapshots: [],
      renderTimes: [],
      loadingTimes: {}
    };
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring() {
    await this.page.evaluate(() => {
      window.performanceMonitor = {
        frameCount: 0,
        startTime: performance.now(),
        memoryUsage: [],
        renderTimes: []
      };
      
      // Monitor frame rate
      const trackFrameRate = () => {
        window.performanceMonitor.frameCount++;
        requestAnimationFrame(trackFrameRate);
      };
      trackFrameRate();
      
      // Monitor memory (if available)
      if (performance.memory) {
        setInterval(() => {
          window.performanceMonitor.memoryUsage.push({
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            timestamp: performance.now()
          });
        }, 1000);
      }
    });
  }

  /**
   * Get performance metrics
   */
  async getMetrics() {
    return await this.page.evaluate(() => {
      const monitor = window.performanceMonitor;
      const now = performance.now();
      const duration = (now - monitor.startTime) / 1000;
      const fps = monitor.frameCount / duration;
      
      return {
        fps: fps,
        frameCount: monitor.frameCount,
        duration: duration,
        memoryUsage: monitor.memoryUsage,
        gameMetrics: window.game ? {
          currentFPS: window.game.performanceManager?.currentFPS || 0,
          avgRenderTime: window.game.performanceManager?.avgRenderTime || 0,
          particleCount: window.game.visualEffectsManager?.particleCount || 0,
          physicsStepTime: window.game.physicsManager?.lastStepTime || 0
        } : null
      };
    });
  }

  /**
   * Measure loading performance
   */
  async measureLoadingPerformance() {
    const startTime = Date.now();
    
    await this.testHelper.waitForGameInitialization();
    
    const endTime = Date.now();
    const loadingTime = endTime - startTime;
    
    // Get detailed loading metrics
    const loadingMetrics = await this.page.evaluate(() => {
      return {
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
        resourceTimings: performance.getEntriesByType('resource').map(entry => ({
          name: entry.name,
          duration: entry.duration,
          size: entry.transferSize
        }))
      };
    });
    
    return {
      totalLoadingTime: loadingTime,
      ...loadingMetrics
    };
  }

  /**
   * Stress test with multiple balls
   */
  async stressTest(ballCount = 10) {
    await this.startMonitoring();
    
    // Create multiple balls for stress testing
    for (let i = 0; i < ballCount; i++) {
      await this.testHelper.hitBall(0.3 + i * 0.1, { 
        x: (Math.random() - 0.5) * 2, 
        y: Math.random() 
      });
      await sleep(200);
    }
    
    // Let system stabilize
    await sleep(5000);
    
    return await this.getMetrics();
  }
}

test.describe('Performance Benchmarking', () => {
  let performanceBenchmark;
  let testHelper;

  test.beforeEach(async ({ page }) => {
    performanceBenchmark = new PerformanceBenchmark(page);
    testHelper = new TestHelper(page);
    await page.goto('/');
  });

  test('should maintain acceptable frame rate during gameplay', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    await performanceBenchmark.startMonitoring();
    
    // Normal gameplay simulation
    for (let i = 0; i < 5; i++) {
      await testHelper.hitBall(0.5 + i * 0.1);
      await testHelper.waitForBallToStop();
      await sleep(1000);
    }
    
    const metrics = await performanceBenchmark.getMetrics();
    
    // Frame rate should be acceptable
    expect(metrics.fps).toBeGreaterThan(30);
    expect(metrics.gameMetrics.currentFPS).toBeGreaterThan(30);
    
    // Render time should be reasonable
    expect(metrics.gameMetrics.avgRenderTime).toBeLessThan(16); // < 16ms for 60fps
    
    console.log('Performance Metrics:', {
      fps: metrics.fps.toFixed(2),
      avgRenderTime: metrics.gameMetrics.avgRenderTime.toFixed(2),
      particleCount: metrics.gameMetrics.particleCount
    });
  });

  test('should handle memory usage efficiently', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    await performanceBenchmark.startMonitoring();
    
    // Extended gameplay to test memory management
    for (let i = 0; i < 20; i++) {
      await testHelper.hitBall(Math.random() * 0.8 + 0.2);
      await sleep(500);
    }
    
    await testHelper.waitForBallToStop();
    const metrics = await performanceBenchmark.getMetrics();
    
    if (metrics.memoryUsage.length > 0) {
      const initialMemory = metrics.memoryUsage[0].used;
      const finalMemory = metrics.memoryUsage[metrics.memoryUsage.length - 1].used;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      
      // Check for memory leaks (no excessive growth)
      const maxMemory = Math.max(...metrics.memoryUsage.map(m => m.used));
      const memoryVariance = maxMemory - initialMemory;
      expect(memoryVariance).toBeLessThan(100 * 1024 * 1024); // Less than 100MB variance
      
      console.log('Memory Usage:', {
        initial: (initialMemory / 1024 / 1024).toFixed(2) + 'MB',
        final: (finalMemory / 1024 / 1024).toFixed(2) + 'MB',
        growth: (memoryGrowth / 1024 / 1024).toFixed(2) + 'MB'
      });
    }
  });

  test('should load game within acceptable time', async ({ page }) => {
    const loadingMetrics = await performanceBenchmark.measureLoadingPerformance();
    
    // Game should load within reasonable time
    expect(loadingMetrics.totalLoadingTime).toBeLessThan(10000); // Less than 10 seconds
    expect(loadingMetrics.domContentLoaded).toBeLessThan(5000); // DOM ready in 5 seconds
    
    // Check resource loading efficiency
    const largeResources = loadingMetrics.resourceTimings.filter(r => r.size > 1024 * 1024);
    expect(largeResources.length).toBeLessThan(5); // No more than 5 large resources
    
    console.log('Loading Performance:', {
      totalTime: loadingMetrics.totalLoadingTime + 'ms',
      domReady: loadingMetrics.domContentLoaded + 'ms',
      resourceCount: loadingMetrics.resourceTimings.length
    });
  });

  test('should handle stress testing gracefully', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    const stressMetrics = await performanceBenchmark.stressTest(15);
    
    // Even under stress, performance should be acceptable
    expect(stressMetrics.fps).toBeGreaterThan(20); // Lower threshold for stress test
    expect(stressMetrics.gameMetrics.currentFPS).toBeGreaterThan(20);
    
    // Physics should still be responsive
    expect(stressMetrics.gameMetrics.physicsStepTime).toBeLessThan(10); // Less than 10ms
    
    console.log('Stress Test Results:', {
      fps: stressMetrics.fps.toFixed(2),
      physicsStepTime: stressMetrics.gameMetrics.physicsStepTime.toFixed(2),
      particleCount: stressMetrics.gameMetrics.particleCount
    });
  });

  test('should optimize performance on mobile devices', async ({ page }) => {
    // Simulate mobile device constraints
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      // Mock mobile device indicators
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4 });
      Object.defineProperty(navigator, 'deviceMemory', { value: 2 });
    });
    
    await testHelper.waitForGameInitialization();
    await performanceBenchmark.startMonitoring();
    
    // Test mobile-optimized gameplay
    await testHelper.hitBall(0.6);
    await testHelper.waitForBallToStop();
    
    const mobileMetrics = await performanceBenchmark.getMetrics();
    
    // Mobile optimization should be active
    const mobileOptimizations = await page.evaluate(() => {
      return {
        reducedParticles: window.game?.performanceManager?.isMobileOptimized || false,
        adaptiveQuality: window.game?.renderer?.getPixelRatio() <= 2,
        lowPowerMode: window.game?.performanceManager?.lowPowerMode || false
      };
    });
    
    expect(mobileOptimizations.adaptiveQuality).toBe(true);
    expect(mobileMetrics.fps).toBeGreaterThan(25); // Reasonable mobile FPS
  });

  test('should benchmark physics performance', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Test physics-intensive scenario
    await page.evaluate(() => {
      // Create multiple physics bodies for testing
      for (let i = 0; i < 20; i++) {
        if (window.game && window.game.physicsManager) {
          const body = new window.CANNON.Body({ mass: 1 });
          body.addShape(new window.CANNON.Sphere(0.1));
          body.position.set(Math.random() * 10 - 5, 5, Math.random() * 10 - 5);
          window.game.physicsManager.world.addBody(body);
        }
      }
    });
    
    await performanceBenchmark.startMonitoring();
    await sleep(5000); // Let physics settle
    
    const physicsMetrics = await performanceBenchmark.getMetrics();
    
    // Physics should remain performant
    expect(physicsMetrics.gameMetrics.physicsStepTime).toBeLessThan(5); // Less than 5ms per step
    expect(physicsMetrics.fps).toBeGreaterThan(30);
    
    console.log('Physics Performance:', {
      stepTime: physicsMetrics.gameMetrics.physicsStepTime.toFixed(2) + 'ms',
      fps: physicsMetrics.fps.toFixed(2)
    });
  });

  test('should handle background/foreground transitions efficiently', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    await performanceBenchmark.startMonitoring();
    
    // Simulate tab going to background
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        value: 'hidden'
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    await sleep(2000);
    const backgroundMetrics = await performanceBenchmark.getMetrics();
    
    // Simulate tab coming back to foreground
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible'
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    await sleep(2000);
    const foregroundMetrics = await performanceBenchmark.getMetrics();
    
    // Performance should adapt to visibility changes
    expect(foregroundMetrics.fps).toBeGreaterThanOrEqual(backgroundMetrics.fps);
    
    console.log('Visibility Performance:', {
      backgroundFPS: backgroundMetrics.fps.toFixed(2),
      foregroundFPS: foregroundMetrics.fps.toFixed(2)
    });
  });

  test('should validate WebGL performance', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    const webglMetrics = await page.evaluate(() => {
      const gl = document.querySelector('canvas')?.getContext('webgl2') || 
                  document.querySelector('canvas')?.getContext('webgl');
      
      if (!gl) return null;
      
      return {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
        extensions: gl.getSupportedExtensions().length
      };
    });
    
    expect(webglMetrics).toBeTruthy();
    expect(webglMetrics.maxTextureSize).toBeGreaterThanOrEqual(2048);
    expect(webglMetrics.extensions).toBeGreaterThan(10);
    
    console.log('WebGL Capabilities:', webglMetrics);
  });
});

test.describe('Performance Regression Detection', () => {
  let performanceBenchmark;
  let testHelper;

  test.beforeEach(async ({ page }) => {
    performanceBenchmark = new PerformanceBenchmark(page);
    testHelper = new TestHelper(page);
    await page.goto('/');
  });

  test('should maintain consistent performance across game sessions', async ({ page }) => {
    const sessions = [];
    
    // Run multiple sessions
    for (let session = 0; session < 3; session++) {
      await page.reload();
      await testHelper.waitForGameInitialization();
      await performanceBenchmark.startMonitoring();
      
      // Standard gameplay
      await testHelper.hitBall(0.5);
      await testHelper.waitForBallToStop();
      await sleep(2000);
      
      const metrics = await performanceBenchmark.getMetrics();
      sessions.push(metrics);
    }
    
    // Verify consistency across sessions
    const fpsValues = sessions.map(s => s.fps);
    const avgFPS = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
    const fpsVariance = Math.max(...fpsValues) - Math.min(...fpsValues);
    
    expect(avgFPS).toBeGreaterThan(30);
    expect(fpsVariance).toBeLessThan(15); // Less than 15fps variance
    
    console.log('Session Consistency:', {
      sessions: fpsValues.map(f => f.toFixed(2)),
      average: avgFPS.toFixed(2),
      variance: fpsVariance.toFixed(2)
    });
  });

  test('should detect performance regressions', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Baseline measurement
    await performanceBenchmark.startMonitoring();
    await testHelper.hitBall(0.5);
    await testHelper.waitForBallToStop();
    const baselineMetrics = await performanceBenchmark.getMetrics();
    
    // Simulate performance regression
    await page.evaluate(() => {
      // Add artificial load
      setInterval(() => {
        for (let i = 0; i < 10000; i++) {
          Math.random();
        }
      }, 100);
    });
    
    await page.reload();
    await testHelper.waitForGameInitialization();
    await performanceBenchmark.startMonitoring();
    await testHelper.hitBall(0.5);
    await testHelper.waitForBallToStop();
    const regressedMetrics = await performanceBenchmark.getMetrics();
    
    // Should detect significant performance drop
    const fpsDropPercent = (baselineMetrics.fps - regressedMetrics.fps) / baselineMetrics.fps * 100;
    
    if (fpsDropPercent > 20) {
      console.warn(`Performance regression detected: ${fpsDropPercent.toFixed(2)}% FPS drop`);
    }
    
    // This test is mainly for monitoring - adjust thresholds based on requirements
    expect(regressedMetrics.fps).toBeGreaterThan(15); // Minimum acceptable FPS
  });
});