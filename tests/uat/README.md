# UAT Tests

End-to-end tests for Mini Golf Break using Playwright.

## Running

```bash
npm run test:uat              # Headless
npm run test:uat:headed       # With browser visible
npm run test:uat:debug        # Step-by-step debugger
```

The dev server starts automatically via the Playwright config.

## Test Files

| File | Coverage |
|------|----------|
| `game-flow.test.js` | Game init, hole playthrough, scoring, transitions, completion |
| `mobile.test.js` | Touch input, device orientation, multi-touch, cross-device |
| `mobile-mechanics.test.js` | Touch compatibility with mechanics (force fields, portals, sweepers) |
| `orbital-drift.test.js` | Orbital Drift course loading, all 9 holes, mechanics presence |
| `cross-browser.test.js` | Firefox, Edge compatibility, WebGL rendering, input |
| `visual-regression.test.js` | UI layout, canvas rendering, responsive design |
| `performance.test.js` | FPS, memory, load times, WebGL performance |

## Devices

Configured in `playwright.config.js`:

- Desktop Chrome (1920x1080)
- Desktop Safari (1920x1080)
- Mobile Chrome / Pixel 5
- Mobile Safari / iPhone 12
- Tablet / iPad Pro

## Test Helper

`utils/TestHelper.js` provides common operations:

```js
const helper = new TestHelper(page);
await helper.waitForGameInitialization();
await helper.hitBall(0.7, { x: 0, y: 1 });
await helper.waitForBallToStop();
const state = await helper.getGameState();
```

## Configuration Notes

- Timeout: 120s (game initialization can be slow)
- Retries: 3 on CI, 1 locally
- WebGL: Uses `--use-gl=swiftshader` for headless environments
- Reports: HTML + JUnit output to `coverage/uat-results/`
