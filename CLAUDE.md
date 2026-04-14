Here's the CLAUDE.md content:

# CLAUDE.md — mini-golf-break

## Project Identity

**mini-golf-break** is a casual space-themed 18-hole mini golf game built with Three.js (rendering) and Cannon-es (physics), bundled with Webpack, targeting browser and iOS (via Capacitor). The entry point is `src/main.js`.

**Core libraries** (all in devDependencies except Capacitor/three-csg-ts):
- `three` — 3D rendering
- `cannon-es` — rigid-body physics
- `three-csg-ts` — constructive solid geometry for course meshes
- `@capacitor/core` + `@capacitor/ios` — native iOS wrapper

## Code Style

Formatting is enforced by **Prettier** (`.prettierrc.json`) and **ESLint** (`.eslintrc.json`). Run both before submitting code:

```bash
npm run lint:fix    # ESLint auto-fix
npm run format      # Prettier write
```

Key rules:
- **Print width**: 100 characters
- **Indent**: 2 spaces, no tabs
- **Quotes**: single quotes (`'`), avoid escape
- **Semicolons**: always
- **Trailing commas**: none
- **Arrow parens**: avoid when possible (`x => x`)
- **End of line**: LF
- **Curly braces**: always required (`curly: ["error", "all"]`)
- **Strict equality**: `===` only (`eqeqeq: always`)
- **No `var`**: use `const` (preferred) or `let`
- **No `console.log`**: use `console.warn` or `console.error`, or the project's `debug` utility (`src/utils/debug.js`)
- **Complexity limits**: max cyclomatic complexity 20, max depth 5, max params 6, max statements 40

## Naming Conventions

- **Files**: PascalCase for classes/components (`BallManager.js`, `HoleEntity.js`, `ScoringSystem.js`). camelCase for utilities and configs (`debug.js`, `debugConfig.js`, `holeValidator.js`)
- **Directories**: lowercase (`managers/`, `mechanics/`, `objects/`, `utils/`)
- **Classes**: PascalCase (`GameLoopManager`, `PhysicsManager`, `ElevatedGreen`)
- **Variables/functions**: camelCase. Prefix unused params with `_` (`_event`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Test files**: mirror source name with `.test.js` suffix (`Ball.test.js`, `PhysicsManager.test.js`)

## Project Structure

```
src/
├── main.js              # App entry point
├── config/              # Game configuration and hole definitions
├── controls/            # Camera and input controllers
├── events/              # Event system (EventTypes, GameEvent)
├── game/                # Scoring and high-score persistence
├── managers/            # Core systems (physics, audio, UI, hazards, state, etc.)
│   ├── debug/           # Debug UI overlays
│   └── ui/              # Score and debug overlays
├── mechanics/           # Reusable hole mechanics (obstacles, zones, gates)
├── objects/             # Game entities (Ball, HoleEntity, Course, decorations)
├── physics/             # Physics world setup
├── scenes/              # Main Game scene
├── states/              # Game state management
├── themes/              # Visual themes (space, default)
├── utils/               # Helpers (debug, validation, WebGL detect)
└── tests/               # Unit and integration tests
tests/
└── uat/                 # Playwright end-to-end tests
```

## Testing

Three test tiers exist. **Unit tests run in the pre-commit hook** — they must pass before any commit.

```bash
npm test              # All Jest tests (unit + integration)
npm run test:unit     # Unit tests only (fast, pre-commit)
npm run test:integration  # Integration tests
npm run test:coverage # Unit + integration with coverage report
npm run test:uat      # Playwright browser tests (requires dev server)
```

- **Framework**: Jest with jsdom environment
- **Unit tests**: `src/tests/**/*.test.js` (mirrors source structure)
- **Integration tests**: `src/tests/integration/**/*.test.js`
- **UAT tests**: `tests/uat/` using Playwright (`playwright.config.js`)
- **Setup files**: `src/tests/setup.js`, `src/tests/jest.setup.js`
- **Coverage thresholds**: 60% minimum for functions, lines, and statements
- **Mocking**: CSS modules mocked via `identity-obj-proxy`. Three.js and Cannon-es globals (`THREE`, `CANNON`) are registered as ESLint readonly globals

When adding new source files, add corresponding test files following the existing mirror structure under `src/tests/`.

## Dependencies

- **Do not add new runtime dependencies** without explicit approval. The game runs entirely client-side; bundle size directly impacts load time on mobile/iOS
- Three.js and Cannon-es are split into separate chunks in production builds — keep them as the only large dependencies
- Dev dependencies for tooling are fine to add as needed
- Run `npm audit` before committing — the pre-commit hook blocks on high/critical vulnerabilities

## Build & Dev

```bash
npm install           # Install dependencies
npm start             # Dev server at http://localhost:8080 (HMR enabled)
npm run build         # Production build to dist/
npm run build:analyze # Production build + bundle analyzer
npm run quality       # Lint + format check + tests
npm run quality:full  # Lint + format check + coverage + build
```

- Webpack resolves `@/` as alias for `src/`
- Production builds drop all `console.log`/`console.info`/`console.debug` via Terser
- Assets in `public/assets/` are copied to `dist/assets/` at build time
- **Performance budget**: Webpack enforces a 400KB (409600 bytes) main entrypoint limit. Production builds emit an error if exceeded; development builds emit a warning

## Git Conventions

**Branch model**: `develop` is the main integration branch. Feature branches merge into `develop`.

**Commit messages**: imperative mood, descriptive of the change. Examples from history:
- `Enhance game features and improve documentation`
- `Refactor course management and remove obsolete classes`
- `Add elevated green surface and enhance theme customization in HoleEntity`

**Pre-commit hook** (Husky + lint-staged) runs automatically on every commit:
1. lint-staged (ESLint + Prettier on staged files)
2. `npm audit` for high/critical vulnerabilities
3. Unit tests (`npm run test:unit`)
4. Production build (`npm run build`)

If the pre-commit hook fails, fix the issue — do not skip with `--no-verify`.

## Important Rules

1. **Gameplay physics must stay deterministic and fair.** Do not introduce random behavior in ball physics, collision, or obstacle mechanics. The player should always feel like outcomes result from their input, not RNG.

2. **Mechanics are reusable components.** New obstacles/mechanics go in `src/mechanics/` extending `MechanicBase.js` and registered via `MechanicRegistry.js`. Do not put hole-specific obstacle logic inline in hole definitions.

3. **Hole definitions are data-driven.** Course configuration lives in `src/config/`. Hole geometry is built by `HoleEntity` and `GreenSurfaceBuilder` from config data. Do not hardcode hole layouts in scene code.

4. **Separate gameplay collision from visual decoration.** Physics colliders and visual meshes serve different purposes. Decorative elements must not accidentally affect ball physics.

5. **Mobile-first performance.** The game targets iOS via Capacitor. Avoid high-poly collision meshes, excessive draw calls, or unbounded particle effects. Keep the main entrypoint under 400KB.

6. **Use the debug utility, not console.log.** Import from `src/utils/debug.js` for development logging. Production builds strip console output.

7. **Validate holes.** Use `src/utils/holeValidator.js` to verify hole configs. Every hole must have: valid spawn point, reachable cup, no collision gaps, and completable intended route.

8. **Three.js and Cannon-es stay in sync.** When modifying physics bodies or Three.js meshes, ensure the corresponding counterpart is updated. Physics/render sync patterns are documented in the research docs under `docs/research/`.

---

It looks like the file write was blocked by permissions. You can copy the content above into `CLAUDE.md` at the project root, or grant write permission and I'll save it for you.