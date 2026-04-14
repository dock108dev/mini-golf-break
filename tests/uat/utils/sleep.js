/**
 * Replaces deprecated page.waitForTimeout (Playwright).
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { sleep };
