# CLAUDE.md — mini-golf-break

## Project Identity

**mini-golf-break** is a browser-based mini-golf game built with Three.js (rendering) and Cannon-es (physics). It ships as both a web app (Vercel) and an iOS native app (Capacitor). The game features an 18-hole space-themed course with composable gameplay mechanics driven entirely by data configs.

**Core stack:**
- Three.js 0.174 — 3D rendering
- Cannon-es 0.20 — physics simulation
- Webpack 5 — bundling (entry: `src/main.js`, output: `dist/`)
- Babel — ES2021 → browser-compatible JS (no TypeScript — plain `.js` throughout)
- Jest 29 — unit + integration tests
- Playwright — end-to-end UAT
- Capacitor 7 — iOS native wrapper

---

## Dev Setup

```bash
# Requires Node 20 (see .nvmrc)
nvm use
npm install
npm start          # webpack-dev-server on http://localhost:8080
npm run build      # production build → dist/
```

**URL params for development:**
- `?hole=3` — jump directly to hole 3 (via `devHoleHarness.js`)
- `?debug=true` — enable debug overlay

`window.game` and `window.App` are exposed on `window` for browser console access and Playwright tests.

---

## Architecture

The game uses an **event-driven manager pattern**. `src/scenes/Game.js` owns ~18 manager instances and a shared Three.js scene/renderer/camera. Managers never hold direct references to each other — all cross-system communication goes through `EventManager` (pub/sub). Typed event names live in `src/events/EventTypes.js`.

**Key directories:**
- `src/managers/` — one manager per subsystem (physics, UI, audio, state, etc.)
- `src/mechanics/` — 16 composable gameplay plugins (`MechanicBase` subclasses)
- `src/objects/` — Three.js + Cannon entities (Ball, HoleEntity, hazards)
- `src/config/` — 18-hole course definition arrays + JSON Schema validation
- `src/physics/` — Cannon-es world setup and material definitions
- `src/controls/` — input, camera, device detection

**Mechanics plugin system:** Each mechanic in `src/mechanics/` self-registers via `MechanicRegistry`. The barrel export at `src/mechanics/index.js` triggers registration — import order matters. New mechanics must extend `MechanicBase` and implement `update(dt, ballBody)` and `destroy()`.

**Hole lifecycle:** create HoleEntity → spawn ball → game loop (physics + mechanics + collision) → hazard/scoring → ball-in-hole → full cleanup → next hole. Full teardown (meshes, Cannon bodies, mechanic instances) between holes is mandatory to prevent memory leaks.

---

## Style

- **Language:** JavaScript (ES2021), no TypeScript
- **Line length:** 100 characters (Prettier `printWidth`)
- **Indentation:** 2 spaces
- **Quotes:** single quotes, avoid escape
- **Semicolons:** always
- **Trailing commas:** never
- **Arrow parens:** omit when single param (`x => x`)
- **Line endings:** LF

Prettier and ESLint are both enforced. Pre-commit hooks (lint-staged) auto-fix `src/**/*.js` before every commit.

Run manually:
```bash
npm run lint        # ESLint check
npm run lint:fix    # ESLint auto-fix
npm run format      # Prettier write
```

**ESLint key rules:**
- `no-var` — always use `const` or `let`
- `prefer-const` — warn on `let` that could be `const`
- `no-console` — warn; `console.warn` and `console.error` are allowed
- `max-params: 6`, `max-depth: 5`, `max-statements: 40`
- `THREE` and `CANNON` are declared globals (read-only)

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Source files | `PascalCase.js` | `BallManager.js`, `HoleEntity.js` |
| Test files | `PascalCase.test.js` | `BallManager.test.js` |
| Config files | `camelCase.js` | `orbitalDriftConfigs.js` |
| Classes | `PascalCase` | `class MovingSweeper extends MechanicBase` |
| Manager methods | `camelCase` verbs | `initVisuals()`, `startGame()`, `update(dt)` |
| Event constants | `SCREAMING_SNAKE_CASE` | `BALL_HIT`, `HOLE_COMPLETED` |
| Private-ish fields | `_prefixedCamelCase` | `_ballBody`, `_listeners` |
| Unused params | `_prefix` | `_event`, `_dt` |
| Test helpers | `camelCase` | `waitForGameInitialization()` |

Hole configs use array format (not objects) for compact storage; `hydrateHoleConfig.js` converts arrays to `THREE.Vector3`/`THREE.Euler` at runtime.

---

## Testing

### Unit & Integration Tests (Jest)

```bash
npm test                   # all Jest tests
npm run test:unit          # src/tests/**/*.test.js only
npm run test:integration   # src/tests/integration/**/*.test.js only
npm run test:coverage      # with lcov/html report
```

- **Environment:** jsdom
- **Setup:** `src/tests/setup.js`, `src/tests/jest.setup.js`
- **Coverage threshold:** 60% lines/statements/functions (enforced)
- **Timeout:** 10,000 ms per test

Three.js and Cannon-es must be mocked in unit tests — they cannot run in jsdom. Use `jest.fn()` for renderer, camera, and physics bodies. See existing tests for mock patterns.

Test files live alongside source in `src/tests/` mirroring the `src/` structure. Integration tests go in `src/tests/integration/`.

### UAT Tests (Playwright)

```bash
npm run test:uat           # headless, all browsers
npm run test:uat:headed    # with visible browser
npm run test:uat:ci        # CI mode (Chromium only)
```

- **Config:** `tests/uat/playwright.config.js`
- **Timeout:** 120,000 ms (game init is slow)
- **Browsers:** Chromium, WebKit, Firefox, Mobile Chrome, Mobile Safari, iPad
- **Retries:** 3 in CI, 1 locally
- **Helpers:** `tests/uat/helpers/TestHelper.js` — use `waitForGameInitialization()` before any game interaction
- Access game state via `page.evaluate(() => window.game.stateManager.getState())`

Playwright tests require the dev server to be running (`npm start`) or use `webServer` config in playwright.config.js.

---

## Dependencies

### Adding dependencies

- Physics: only `cannon-es` — do not introduce alternative physics engines
- Rendering: only `three` — do not introduce alternative 3D libraries
- Add runtime deps to `dependencies`, tooling to `devDependencies`
- Run `npm audit` after adding; CI enforces `npm run security`
- **Bundle budget:** main entry must stay under 400KB (webpack enforces as error). Check with `npm run build:analyze`

### Banned patterns

- No TypeScript (`.ts`, `.tsx`) — project is plain JS
- No `var` declarations — ESLint blocks it
- No direct `console.log` in `src/` — use `src/utils/debug.js` utilities or `console.warn`/`console.error`
- No direct manager-to-manager references — route through `EventManager`
- No importing mechanics directly into `Game.js` — use `MechanicRegistry`

---

## Git

### Commit messages

Use imperative present tense, 50-char subject line, optional body:

```
Add DisappearingPlatform mechanic

Implements timed platform with configurable cycle duration.
Registers automatically via MechanicRegistry barrel import.
```

### Branch naming

```
feature/mechanic-laser-grid
fix/ball-stuck-detection
chore/update-playwright
```

### PR conventions

- PRs must pass CI (lint → unit/integration tests → build) before merge
- UAT job is `continue-on-error: true` — a UAT failure does not block merge but must be investigated
- Include a test plan in the PR description for gameplay-affecting changes
- Keep PRs focused; avoid mixing mechanic additions with refactors

---

## Important Rules

1. **Event bus is the only cross-manager communication channel.** If you need Manager A to react to Manager B, emit an event from B and subscribe in A. No direct `this.game.someManager.method()` calls between peer managers.

2. **Always clean up in `destroy()`.** Every manager, mechanic, and entity that adds event listeners, Cannon bodies, or Three.js objects must remove/dispose them in its `destroy()` method. Leaking bodies or listeners between holes will accumulate silently.

3. **Physics timestep is fixed at 1/60 s.** Do not change `PhysicsWorld` timestep or substep settings without understanding the downstream effect on all mechanics. DT clamping logic in `GameLoopManager` exists for a reason — do not remove it.

4. **Hole configs are validated against JSON Schema.** Changes to the config shape in `orbitalDriftConfigs.js` must be reflected in `holeConfigSchema.json`. Use `holeValidator.js` to validate programmatically.

5. **The 400KB main bundle budget is a hard limit.** Webpack is configured to error (not warn) in production if exceeded. Any new dependency must be evaluated for size impact first (`npm run build:analyze`).

6. **New mechanics must extend `MechanicBase` and self-register.** Add the `import './YourMechanic.js'` line to `src/mechanics/index.js`. The mechanic's constructor must call `MechanicRegistry.register(...)`.

7. **`window.game` must remain stable for Playwright.** UAT tests access `window.game.stateManager`, `window.game.scoringSystem`, etc. Do not rename or restructure these without updating `TestHelper.js`.

8. **Capacitor public path must stay `'./'`.** The Webpack `publicPath: './'` setting is required for iOS Capacitor builds. Do not change it to an absolute path.

9. **No `--no-verify` on commits.** Pre-commit hooks run ESLint and Prettier. Fix lint errors; don't bypass the hooks.

10. **Three.js objects need `.dispose()`.** Geometries, materials, and textures must be disposed when removing meshes from the scene to avoid GPU memory leaks.
