/**
 * Global setup for UAT tests
 * Runs once before all tests
 */

const { chromium } = require('@playwright/test');
const { resolveUatBaseUrl } = require('./resolve-base-url');

async function globalSetup() {
  console.log('[Global Setup] Starting UAT test environment setup...');
  
  try {
    // Verify server is accessible before running tests
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    console.log('[Global Setup] Testing server connectivity...');
    
    // Wait for server to be ready with multiple attempts
    let serverReady = false;
    const maxAttempts = 10;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await page.goto(resolveUatBaseUrl(), {
          waitUntil: 'load',
          timeout: 30000
        });
        
        // Check if basic page elements are present
        const hasBasicElements = await page.evaluate(() => {
          return document.body && document.head && document.title;
        });
        
        if (hasBasicElements) {
          serverReady = true;
          console.log(`[Global Setup] Server ready after ${attempt} attempt(s)`);
          break;
        }
      } catch (error) {
        console.log(`[Global Setup] Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!serverReady) {
      throw new Error('Server failed to become ready after maximum attempts');
    }
    
    // Capture server info for debugging
    const serverInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        hasCanvas: !!document.querySelector('canvas'),
        hasGame: !!window.game
      };
    });
    
    console.log('[Global Setup] Server info:', JSON.stringify(serverInfo, null, 2));
    
    await browser.close();
    console.log('[Global Setup] Environment setup complete');
    
  } catch (error) {
    console.error('[Global Setup] Setup failed:', error.message);
    throw error;
  }
}

module.exports = globalSetup;