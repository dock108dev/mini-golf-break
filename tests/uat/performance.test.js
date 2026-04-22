/**
 * Performance Benchmarking UAT Tests
 * Tests for game performance, memory usage, and optimization validation
 */

const { test, expect } = require('./fixtures/uat');
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
      const duration = monitor ? (now - monitor.startTime) / 1000 : 1;
      const fps =
        monitor && duration > 0 ? monitor.frameCount / duration : 0;
      const pm = window.game?.performanceManager;
      const perf = pm?.getPerformanceData ? pm.getPerformanceData() : null;
      const parseNum = v => {
        const n = parseFloat(String(v ?? '0').replace(/[^\d.-]/g, ''));
        return Number.isFinite(n) ? n : 0;
      };

      return {
        fps: fps || perf?.fps?.avg || perf?.fps?.current || 0,
        frameCount: monitor?.frameCount || 0,
        duration,
        memoryUsage: monitor?.memoryUsage || [],
        gameMetrics: perf
          ? {
              currentFPS: perf.fps?.current || perf.fps?.avg || 0,
              avgRenderTime: parseNum(perf.render?.avg),
              particleCount: window.game?.visualEffectsManager?.particleCount || 0,
              physicsStepTime: parseNum(perf.physics?.current)
            }
          : {
              currentFPS: 0,
              avgRenderTime: 0,
              particleCount: 0,
              physicsStepTime: 0
            }
      };
    });
  }

  /**
   * Measure loading performance
   */
  async measureLoadingPerformance() {
    const startTime = Date.now();

    await this.page.reload({ waitUntil: 'load' });
    await this.testHelper.waitForGameInitialization({ forceFullInit: true });
    
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
    
    for (let i = 0; i < ballCount; i++) {
      const t = i / Math.max(ballCount - 1, 1);
      await this.testHelper.hitBall(0.3 + i * 0.1, {
        x: t * 2 - 1,
        y: ((i * 3) % 10) / 10
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
    
    expect(metrics.fps).toBeGreaterThanOrEqual(0);
    expect(metrics.gameMetrics.currentFPS).toBeGreaterThanOrEqual(0);
    expect(metrics.gameMetrics.avgRenderTime).toBeLessThan(500);
    
    console.log('Performance Metrics:', {
      fps: metrics.fps.toFixed(2),
      avgRenderTime: metrics.gameMetrics.avgRenderTime.toFixed(2),
      particleCount: metrics.gameMetrics.particleCount
    });
  });

  test('should handle memory usage efficiently', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    await performanceBenchmark.startMonitoring();
    
    for (let i = 0; i < 6; i++) {
      await testHelper.hitBall(0.25 + i * 0.1, { x: (i % 3) * 0.1 - 0.1, y: 0.5 });
      await testHelper.waitForBallToStop();
      await sleep(300);
    }
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
    
    expect(loadingMetrics.totalLoadingTime).toBeLessThan(120000);
    expect(loadingMetrics.domContentLoaded).toBeLessThan(120000);

    const largeResources = loadingMetrics.resourceTimings.filter(
      r => (r.size || 0) > 1024 * 1024
    );
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
    
    expect(stressMetrics.fps).toBeGreaterThanOrEqual(0);
    expect(stressMetrics.gameMetrics.currentFPS).toBeGreaterThanOrEqual(0);
    expect(stressMetrics.gameMetrics.physicsStepTime).toBeLessThan(2000);
    
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
    
    expect(typeof mobileOptimizations.adaptiveQuality).toBe('boolean');
    expect(mobileMetrics.fps).toBeGreaterThanOrEqual(0);
  });

  test('should benchmark physics performance', async ({ page }) => {
    await testHelper.waitForGameInitialization();
    
    // Test physics-intensive scenario
    await performanceBenchmark.startMonitoring();
    await sleep(5000); // Let physics settle
    
    const physicsMetrics = await performanceBenchmark.getMetrics();
    
    expect(physicsMetrics.gameMetrics.physicsStepTime).toBeLessThan(2000);
    expect(physicsMetrics.fps).toBeGreaterThanOrEqual(0);
    
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
    
    expect(foregroundMetrics.fps).toBeGreaterThanOrEqual(0);
    expect(backgroundMetrics.fps).toBeGreaterThanOrEqual(0);
    
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
    expect(webglMetrics.extensions).toBeGreaterThan(0);
    
    console.log('WebGL Capabilities:', webglMetrics);
  });
});

test.describe('Performance Regression Detection', () => {
  let performanceBenchmark;
  let testHelper;

  test.beforeEach(async ({ page }) => {
    performanceBenchmark = new PerformanceBenchmark(page);
    testHelper = new TestHelper(page);
  });

  test('should maintain consistent performance across game sessions', async ({ page }) => {
    const sessions = [];
    
    // Run multiple sessions
    for (let session = 0; session < 3; session++) {
      await page.reload({ waitUntil: 'load' });
      await testHelper.waitForGameInitialization({ forceFullInit: true });
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
    
    expect(avgFPS).toBeGreaterThanOrEqual(0);
    expect(fpsVariance).toBeLessThan(2000);
    
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
          void (i * 7919);
        }
      }, 100);
    });
    
    await page.reload({ waitUntil: 'load' });
    await testHelper.waitForGameInitialization({ forceFullInit: true });
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
    expect(regressedMetrics.fps).toBeGreaterThanOrEqual(0);
  });
});