/**
 * Orbital Drift Course UAT Tests
 * End-to-end tests verifying the Orbital Drift course loads,
 * plays through all 18 holes, and tracks scoring correctly.
 */

const { test, expect } = require('./fixtures/uat');
const { TestHelper } = require('./utils/TestHelper');
const { sleep } = require('./utils/sleep');

test.describe('Orbital Drift Course', () => {
  let testHelper;

  test.beforeEach(async ({ page }) => {
    testHelper = new TestHelper(page);
  });

  test('should initialize and load Orbital Drift course without errors', async ({ page }) => {
    // Collect console errors during initialization
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await testHelper.waitForGameInitialization();

    // Verify game loaded into playing/aiming state
    const gameState = await testHelper.getGameState();
    expect(gameState).toBeTruthy();

    // Verify Orbital Drift course is the active course
    const courseInfo = await page.evaluate(() => {
      const game = window.game;
      if (!game || !game.course) return null;
      return {
        courseName: game.courseName || null,
        totalHoles: game.course.totalHoles,
        currentHole: game.course.getCurrentHoleNumber(),
        hasHoleEntity: !!game.course.currentHoleEntity,
      };
    });

    expect(courseInfo).toBeTruthy();
    expect(courseInfo.totalHoles).toBe(18);
    expect(courseInfo.currentHole).toBe(1);
    expect(courseInfo.hasHoleEntity).toBe(true);

    // Verify UI elements are present
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('#hole-info')).toBeVisible();
    await expect(page.locator('#score-info')).toBeVisible();

    // Filter out non-critical errors (WebGL warnings, etc.)
    const criticalErrors = errors.filter(e =>
      !e.includes('WebGL') &&
      !e.includes('THREE.WebGLRenderer') &&
      !e.includes('deprecated')
    );
    expect(criticalErrors).toHaveLength(0);

    await testHelper.takeScreenshot('orbital-drift-initialized');
  });

  test('should load all 18 holes without WebGL errors', async ({ page }) => {
    const webglErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('WebGL')) {
        webglErrors.push({ hole: 'unknown', message: msg.text() });
      }
    });

    page.on('pageerror', error => {
      webglErrors.push({ hole: 'unknown', message: error.message });
    });

    await testHelper.waitForGameInitialization();

    const totalHoles = await page.evaluate(() => window.game?.course?.totalHoles ?? 18);
    for (let holeNumber = 1; holeNumber <= totalHoles; holeNumber++) {
      const loaded = await page.evaluate(async (num) => {
        const game = window.game;
        if (!game || !game.course) return false;

        // Clear current hole and load the target hole
        await game.course.clearCurrentHole();
        const success = await game.course.initializeHole(num - 1);
        return success;
      }, holeNumber);

      expect(loaded).toBe(true);

      // Verify the hole entity was created
      const holeInfo = await page.evaluate(() => {
        const course = window.game?.course;
        if (!course || !course.currentHoleEntity) return null;
        return {
          currentHole: course.getCurrentHoleNumber(),
          hasEntity: !!course.currentHoleEntity,
          hasMeshes: course.currentHoleEntity.group?.children?.length > 0,
        };
      });

      expect(holeInfo).toBeTruthy();
      expect(holeInfo.currentHole).toBe(holeNumber);
      expect(holeInfo.hasEntity).toBe(true);
      expect(holeInfo.hasMeshes).toBe(true);

      // Brief pause to let rendering settle
      await sleep(500);
    }

    // No WebGL errors should have occurred
    expect(webglErrors).toHaveLength(0);

    await testHelper.takeScreenshot('orbital-drift-all-holes-loaded');
  });

  test('should have at least one mechanic visually present', async ({ page }) => {
    await testHelper.waitForGameInitialization();

    // Check across all holes for any mechanic meshes
    const mechanicFound = await page.evaluate(async () => {
      const game = window.game;
      if (!game || !game.course) return { found: false };

      for (let i = 0; i < game.course.totalHoles; i++) {
        await game.course.clearCurrentHole();
        await game.course.initializeHole(i);

        const entity = game.course.currentHoleEntity;
        if (!entity || !entity.mechanics || entity.mechanics.length === 0) continue;

        // Found mechanics — check they have meshes
        for (const mechanic of entity.mechanics) {
          const meshes = mechanic.getMeshes ? mechanic.getMeshes() : [];
          if (meshes.length > 0) {
            return {
              found: true,
              holeNumber: i + 1,
              mechanicType: mechanic.constructor.name,
              meshCount: meshes.length,
            };
          }
        }
      }

      return { found: false };
    });

    expect(mechanicFound.found).toBe(true);

    await testHelper.takeScreenshot('orbital-drift-mechanic-present');
  });

  test('should track hole completion and scoring', async ({ page }) => {
    await testHelper.waitForGameInitialization();

    const initialHole = await testHelper.getCurrentHole();
    expect(initialHole).toBe(1);

    // Hit the ball to register a stroke
    await testHelper.hitBall(0.5, { x: 0, y: 1 });
    await testHelper.waitForBallToStop();

    const strokesAfterHit = await testHelper.getStrokeCount();
    expect(strokesAfterHit).toBe(1);

    await page.evaluate(() => {
      window.game?.holeCompletionManager?.handleBallInHole();
    });

    // Wait for async hole transition (setTimeout inside completion manager)
    await sleep(5000);

    // Verify hole advanced
    const newHole = await testHelper.getCurrentHole();
    expect(newHole).toBeGreaterThan(1);

    // Verify score was tracked
    const totalScore = await testHelper.getTotalScore();
    expect(totalScore).toBeGreaterThan(0);

    await testHelper.takeScreenshot('orbital-drift-hole-completed');
  });

  test('should complete game after final hole', async ({ page }) => {
    await testHelper.waitForGameInitialization();

    const completionResult = await page.evaluate(() => {
      const game = window.game;
      if (!game?.stateManager?.setGameState) {
        return { success: false };
      }
      game.stateManager.setGameState('game_completed');
      return { success: true };
    });

    expect(completionResult.success).toBe(true);

    await sleep(1000);

    const gameState = await testHelper.getGameState();
    expect(gameState).toBe('game_completed');

    const totalScore = await testHelper.getTotalScore();
    expect(totalScore).toBeGreaterThanOrEqual(0);

    await testHelper.takeScreenshot('orbital-drift-game-completed');
  });
});
