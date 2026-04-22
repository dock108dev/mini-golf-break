/**
 * UAT: wireframe toggle via URL param and d+c chord.
 * Verifies CannonDebugRenderer overlay activates correctly.
 * ISSUE-006
 */

const { test, expect } = require('./fixtures/uat');
const { TestHelper } = require('./utils/TestHelper');

test.describe('Wireframe toggle (CannonDebugRenderer)', () => {
  let testHelper;

  test.beforeEach(async ({ page }) => {
    testHelper = new TestHelper(page);
  });

  test('?wireframe=true URL param enables wireframe on startup', async ({ page }) => {
    // Navigate with both debug and wireframe params
    const url = new URL(page.url());
    url.searchParams.set('wireframe', 'true');
    url.searchParams.set('debug', 'true');
    await page.goto(url.toString());

    await testHelper.waitForGameInitialization();

    // Start the game (dismiss welcome screen if present)
    const startBtn = page.locator('#start-button, [data-testid="start-button"]');
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await testHelper.waitForGameInitialization();
    }

    const wireframeEnabled = await page.evaluate(() => {
      return window.game?.debugManager?.wireframeEnabled ?? null;
    });

    expect(wireframeEnabled).toBe(true);
  });

  test('d then c chord toggles wireframeEnabled on debugManager', async ({ page }) => {
    await testHelper.waitForGameInitialization();

    const startBtn = page.locator('#start-button, [data-testid="start-button"]');
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await testHelper.waitForGameInitialization();
    }

    // Initial state
    const before = await page.evaluate(() => window.game?.debugManager?.wireframeEnabled ?? false);

    // Press d then c within chord window
    await page.keyboard.press('d');
    await page.waitForTimeout(100);
    await page.keyboard.press('c');
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => window.game?.debugManager?.wireframeEnabled ?? false);

    // Toggle must have fired
    expect(after).toBe(!before);
  });

  test('pressing d+c twice returns to original wireframe state', async ({ page }) => {
    await testHelper.waitForGameInitialization();

    const startBtn = page.locator('#start-button, [data-testid="start-button"]');
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await testHelper.waitForGameInitialization();
    }

    const initial = await page.evaluate(() => window.game?.debugManager?.wireframeEnabled ?? false);

    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('d');
      await page.waitForTimeout(100);
      await page.keyboard.press('c');
      await page.waitForTimeout(200);
    }

    const final = await page.evaluate(() => window.game?.debugManager?.wireframeEnabled ?? false);
    expect(final).toBe(initial);
  });
});
