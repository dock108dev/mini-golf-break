'use strict';

/**
 * Single source of truth for UAT base URL (must match playwright.config.js webServer port).
 * Set PLAYWRIGHT_TEST_BASE_URL in CI if the dev server is not on localhost:8080.
 */
function resolveUatBaseUrl() {
  return process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:8080';
}

module.exports = { resolveUatBaseUrl };
