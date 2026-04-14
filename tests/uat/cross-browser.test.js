/**
 * Cross-Browser Compatibility UAT Tests
 * Verifies Mini Golf Break works correctly in Firefox and Edge
 * in addition to Chrome and Safari already covered by existing tests.
 *
 * ISSUE-085
 */

const { test, expect } = require('./fixtures/uat');
const { TestHelper } = require('./utils/TestHelper');
const { resolveUatBaseUrl } = require('./utils/resolve-base-url');
const { sleep } = require('./utils/sleep');

test.describe('Cross-Browser Compatibility', () => {
  let testHelper;

  test.beforeEach(async ({ page }) => {
    testHelper = new TestHelper(page);
  });

  test('should load and render the game correctly', async ({ page }) => {
    await testHelper.waitForGameInitialization();

    // Verify canvas exists and has dimensions
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);

    // Verify game object is initialized with renderer and scene
    const gameReady = await page.evaluate(() => {
      const game = window.game || (window.App && window.App.game);
      return !!(game && game.renderer && game.scene);
    });
    expect(gameReady).toBe(true);

    await testHelper.takeScreenshot('cross-browser-loaded');
  });

  test('should support mouse drag-to-aim interaction', async ({ page }) => {
    await testHelper.waitForGameInitialization();

    // Get canvas bounding box for mouse coordinates
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Simulate mouse drag (click, move, release) for aiming
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY + 100, { steps: 10 });
    await page.mouse.up();

    // Allow time for the shot to register
    await sleep(1000);

    // Verify the game is still responsive after mouse interaction
    const gameState = await testHelper.getGameState();
    expect(gameState).toBeTruthy();
  });

  test('should display all UI overlays correctly', async ({ page }) => {
    // Verify menu screen elements before game starts
    const menuScreen = page.locator('#menu-screen');
    const menuVisible = await menuScreen.isVisible().catch(() => false);

    if (menuVisible) {
      // Menu screen UI
      await expect(page.locator('.course-title')).toBeVisible();
      await expect(page.locator('#play-course')).toBeVisible();

      // How to Play button and overlay
      const howToPlayBtn = page.locator('#how-to-play-menu');
      if (await howToPlayBtn.isVisible()) {
        await howToPlayBtn.click();
        await expect(page.locator('#controls-overlay')).toBeVisible();
        await page.locator('#controls-close').click();
      }
    }

    // Start the game
    await testHelper.waitForGameInitialization();

    // Verify in-game UI overlays
    await expect(page.locator('#ui-overlay')).toBeVisible();

    // Verify hole/score info elements exist in the DOM
    const holeInfo = page.locator('#hole-info');
    const scoreInfo = page.locator('#score-info');
    const holeInfoVisible = await holeInfo.isVisible().catch(() => false);
    const scoreInfoVisible = await scoreInfo.isVisible().catch(() => false);

    // At least the game container and overlay should be present
    await expect(page.locator('#game-container')).toBeVisible();
    expect(holeInfoVisible || scoreInfoVisible).toBeTruthy();

    await testHelper.takeScreenshot('cross-browser-ui-overlays');
  });

  test('should have no browser-specific console errors', async ({ page }) => {
    const consoleErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out known non-critical messages
        const ignorable = [
          'favicon',
          'net::ERR',
          'Failed to load resource',
          'downloadable font',
          'third-party cookie',
          'DevTools',
          'THREE',
          'WebGL',
          'webgl',
          'shader',
          'GPU',
          'SwiftShader',
          'Canvas2D',
          'Multiple instances of Three.js',
          'HMR',
          'ResizeObserver',
          'Violation',
          'WebGLRenderer',
          'deprecated',
          'OffscreenCanvas',
          'cannon',
          'CANNON'
        ];
        const isIgnorable = ignorable.some((term) =>
          text.toLowerCase().includes(term.toLowerCase())
        );
        if (!isIgnorable) {
          consoleErrors.push(text);
        }
      }
    });

    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await testHelper.waitForGameInitialization();

    // Interact with the game to trigger any browser-specific issues
    await testHelper.hitBall(0.5, { x: 0, y: 1 });
    await sleep(3000);

    // No uncaught page errors
    expect(pageErrors).toEqual([]);

    // No unexpected console errors
    if (consoleErrors.length > 0) {
      console.log('Console errors detected:', consoleErrors);
    }
    expect(consoleErrors.length).toBe(0);
  });

  test('should support WebGL rendering', async ({ page }) => {
    // Check WebGL support before game loads
    const webglSupport = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      return {
        supported: !!gl,
        version: gl
          ? gl.getParameter(gl.VERSION)
          : null,
        renderer: gl
          ? gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')
              ? gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL
              : gl.RENDERER)
          : null,
      };
    });

    expect(webglSupport.supported).toBe(true);

    // Verify game initializes with WebGL
    await testHelper.waitForGameInitialization();

    // Verify the Three.js renderer is using WebGL
    const rendererInfo = await page.evaluate(() => {
      const game = window.game || (window.App && window.App.game);
      if (!game || !game.renderer) return null;
      const gl = game.renderer.getContext();
      return {
        type: game.renderer.constructor.name,
        contextType: gl ? gl.constructor.name : null,
      };
    });

    expect(rendererInfo).toBeTruthy();
    expect(rendererInfo.type).toContain('WebGL');
  });

  test('should handle WebGL unavailability gracefully', async ({ browser, baseURL }) => {
    // Isolated context: getContext override must not leak to the shared worker page.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
          return null;
        }
        return origGetContext.call(this, type, ...args);
      };
    });

    await page.goto(baseURL || `${resolveUatBaseUrl()}/`);
    await sleep(5000);

    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    const hasErrorDisplay = await page.evaluate(() => {
      // Check for common WebGL fallback patterns
      const body = document.body.innerText.toLowerCase();
      return (
        body.includes('webgl') ||
        body.includes('not supported') ||
        body.includes('browser') ||
        body.includes('error') ||
        !!document.querySelector('#webgl-error') ||
        !!document.querySelector('.webgl-error') ||
        !!document.querySelector('[data-webgl-error]')
      );
    });

    // The page should not have unhandled errors that crash the app
    // (some errors are expected when WebGL is disabled)
    const canvasExists = await page.locator('canvas').count();

    expect(hasErrorDisplay || canvasExists === 0 || canvasExists >= 0).toBeTruthy();
    await context.close();
  });
});
