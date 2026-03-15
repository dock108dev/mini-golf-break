/**
 * Playwright configuration for UAT testing
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = {
  testDir: '.',
  timeout: 120000, // Increased to 2 minutes for game initialization
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1, // Increased retries for flaky game loading
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'coverage/uat-results' }],
    ['junit', { outputFile: 'coverage/uat-results.xml' }],
    ['list'] // Add list reporter for better console output
  ],
  use: {
    baseURL: 'http://localhost:8080',
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
    }
  ],
  webServer: {
    command: 'npm start',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // Increased timeout for webpack dev server startup
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  },
  
  // Global test configuration
  globalSetup: require.resolve('./utils/global-setup.js'),
  globalTeardown: require.resolve('./utils/global-teardown.js'),
};