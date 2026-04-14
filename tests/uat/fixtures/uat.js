/**
 * UAT Playwright fixture: one browser page per worker with a single full game bootstrap.
 * Tests must not call page.goto('/') in beforeEach — use resetUatGameState via afterEach instead.
 */

const { test: baseTest, expect } = require('@playwright/test');
const { TestHelper } = require('../utils/TestHelper');
const { resolveUatBaseUrl } = require('../utils/resolve-base-url');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** @param {import('@playwright/test').Page} page */
async function resetUatGameState(page) {
  try {
    const ok = await page.evaluate(async () => {
      const g = window.game;
      if (!g?.stateManager?.skipToHole) {
        return false;
      }
      await g.stateManager.skipToHole(1);
      return true;
    });
    if (ok) {
      await sleep(200);
    }
  } catch {
    // Next test will run full waitForGameInitialization if needed
  }
}

const test = baseTest.extend({
  // One browser context + game bootstrap per worker (not per test).
  uatPage: [
    async ({ browser }, use) => {
      const baseURL = `${resolveUatBaseUrl()}/`;
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(baseURL);
      const helper = new TestHelper(page);
      await helper.waitForGameInitialization();
      await use(page);
      await context.close();
    },
    { scope: 'worker' }
  ],
  // Test-scoped alias so specs can keep using `page` in signatures.
  page: async ({ uatPage }, use) => {
    await use(uatPage);
  }
});

test.afterEach(async ({ page }) => {
  await resetUatGameState(page);
});

module.exports = { test, expect, resetUatGameState };
