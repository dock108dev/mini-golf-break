# Development Guide

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
git clone https://github.com/highlyprofitable108/mini-golf-break.git
cd mini-golf-break
npm install
npm start
```

Dev server runs at `http://localhost:8080` with hot reload.

## Environment

The only environment variable used is `NODE_ENV`:

| Value | Effect |
|-------|--------|
| `development` (default) | Debug logging enabled via `debug.log()`. Course config validation runs on startup. |
| `production` | Debug logging suppressed. `console.log`/`console.debug` stripped by Terser. Config validation skipped. |
| `test` | Set automatically by Jest |

No `.env` file is needed.

## Testing

### Unit & Integration Tests (Jest)

```bash
npm test                    # All tests (unit + integration)
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:coverage       # With coverage report
```

Unit tests live in `src/tests/`. Integration tests live in `src/tests/integration/`. Jest is configured with two projects (`unit` and `integration`) and coverage thresholds at 60%.

Test setup files mock Three.js, Cannon-es, and DOM APIs. See `src/tests/setup.js` for the mock layer.

### End-to-End Tests (Playwright)

```bash
npm run test:uat            # Headless
npm run test:uat:headed     # With browser visible
npm run test:uat:debug      # Step-by-step debugger
```

Tests live in `tests/uat/`. Playwright starts the dev server automatically. Tests cover game flow, mobile devices, visual regression, and performance.

Device coverage: Desktop Chrome, Desktop Safari, iPhone 12, Pixel 5, iPad Pro.

## Pre-commit Hooks

Husky runs on every commit (`.husky/pre-commit`):

1. **lint-staged** -- ESLint fix + Prettier on staged `.js` files
2. **Security audit** -- Blocks commit on high/critical npm vulnerabilities
3. **Unit tests** -- Runs `npm run test:unit`
4. **Production build** -- Ensures `npm run build` succeeds

## Code Quality

```bash
npm run lint                # Check for errors
npm run lint:fix            # Auto-fix
npm run format              # Prettier format
npm run quality             # Lint + format check + tests
npm run quality:full        # Above + coverage + build
```

### ESLint Rules

Key rules enforced (see `.eslintrc.json`):
- `no-console`: warn (allows `console.warn` and `console.error`)
- `complexity`: max 20
- `max-depth`: 5
- `max-params`: 6
- `max-statements`: 40
- `eqeqeq`: always
- `prefer-const`, `no-var`
- Test files have relaxed rules (no-console off, max-statements off)

### Debug Logging

Production code uses `debug.log()` from `src/utils/debug.js` instead of `console.log`. This is suppressed in production builds. Import as:

```js
import { debug } from '../utils/debug';
debug.log('message');  // Only outputs when NODE_ENV !== 'production'
```

## Debug Mode

Press `d` during gameplay to toggle debug mode (only works in development):
- Axes helper and grid overlay
- Physics wireframe visualization (Cannon debug renderer)
- Ball position/velocity in debug HUD
- Press number keys `1-9` to jump to specific holes

## Build

```bash
npm run build               # Production build to dist/
npm run build:analyze       # Build with bundle analyzer
```

Production build features:
- Terser minification (strips `console.log`, `console.debug`)
- Code splitting: Three.js, Cannon-es, vendors, and app code in separate chunks
- Content-hashed filenames for cache busting
- CSS minification
- No source maps in production

## Deployment

Deploy the `dist/` folder to any static hosting provider. Vercel configuration is included:

```bash
npm run build
# dist/ is ready to deploy
```

The `vercel.json` configures:
- Static build output from `dist/`
- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- Long-lived cache headers for hashed asset filenames

## Known Limitations

- No CI/CD pipeline (GitHub Actions not configured)
- Capacitor dependencies exist in package.json but are unused (no native app build)
- UAT tests require WebGL support; may need `--use-gl=swiftshader` on headless CI
