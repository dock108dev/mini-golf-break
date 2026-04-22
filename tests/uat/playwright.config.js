/**
 * Playwright configuration for UAT testing
 * @see https://playwright.dev/docs/test-configuration
 */
const { resolveUatBaseUrl } = require('./utils/resolve-base-url');

module.exports = {
  testDir: '.',
  timeout: 120000, // Increased to 2 minutes for game initialization
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // CI: single retry — full game bootstrap is expensive; job is continue-on-error in GitHub Actions.
  retries: process.env.CI ? 1 : 2,
  // One worker avoids webpack-dev-server + WebGL contention (parallel UAT pages stalled each other's init in CI).
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'coverage/uat-results' }],
    ['junit', { outputFile: 'coverage/uat-results.xml' }],
    ['list'] // Add list reporter for better console output
  ],
  use: {
    baseURL: resolveUatBaseUrl(),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Enhanced browser context for better game compatibility
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    acceptDownloads: false,
    // Add longer navigation timeout for game loading
    navigationTimeout: 60000,
    // Add longer action timeout for game interactions
    actionTimeout: 30000
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Enhanced Chrome flags for better WebGL support
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-gpu',
            '--use-gl=swiftshader',
            '--enable-features=VaapiVideoDecoder',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--no-sandbox', // For CI environments
            '--disable-setuid-sandbox'
          ]
        }
      },
    },
    {
      name: 'webkit-desktop',
      use: {
        ...require('@playwright/test').devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
        // WebKit optimizations
        launchOptions: {
          args: [
            '--enable-webgl'
          ]
        }
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...require('@playwright/test').devices['Pixel 5'],
        // Mobile-specific optimizations
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-gpu',
            '--use-gl=swiftshader',
            '--disable-background-timer-throttling',
            '--no-sandbox'
          ]
        }
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...require('@playwright/test').devices['iPhone 12'],
        // iOS Safari optimizations
        launchOptions: {
          args: [
            '--enable-webgl'
          ]
        }
      },
    },
    {
      name: 'tablet-ipad',
      use: {
        ...require('@playwright/test').devices['iPad Pro'],
        // iPad optimizations
        launchOptions: {
          args: [
            '--enable-webgl'
          ]
        }
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        ...require('@playwright/test').devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          firefoxUserPrefs: {
            'webgl.force-enabled': true,
            'webgl.disabled': false
          }
        }
      },
    },
  ],
  webServer: {
    command: 'npm start',
    url: resolveUatBaseUrl(),
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // Increased timeout for webpack dev server startup
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // webpack-cli forces NODE_ENV=development when resolving webpack.config.js; this flag
      // disables the dev-server error overlay iframe that blocks Playwright clicks.
      DISABLE_WDS_OVERLAY: '1'
    }
  },
  
  // Global test configuration
  globalSetup: require.resolve('./utils/global-setup.js'),
  globalTeardown: require.resolve('./utils/global-teardown.js'),
};