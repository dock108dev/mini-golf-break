# Mini Golf Break

A 3D mini-golf game built with [Three.js](https://threejs.org/) and [Cannon-es](https://pmndrs.github.io/cannon-es/). Features the **Orbital Drift** course — 18 space-themed holes with moving obstacles, force fields, portals, timed hazards, and elevation changes. Click-and-drag to aim, release to shoot, get the ball in the hole.

## Quick Start

```bash
npm install
npm start
```

Open `http://localhost:8080`.

## How to Play

1. Click and hold on the golf ball
2. Drag backward to set direction and power (aim line shows trajectory)
3. Release to shoot
4. Get the ball in the hole in the fewest strokes
5. Complete all 18 holes for your final score

Press `d` during gameplay to toggle debug mode (physics wireframes, axes helpers).

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Dev server on port 8080 |
| `npm test` | Unit + integration tests (Jest) |
| `npm run test:uat` | End-to-end tests (Playwright) |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint check |
| `npm run quality` | Lint + format check + tests |

## Courses

The game currently ships with the **Orbital Drift** course (18 holes, par 57: front nine par 24, back nine par 33). The course is displayed on the start screen and begins when you click **Play**.

## Project Structure

```
src/
  config/         # Hole layouts (orbitalDriftConfigs), debug configuration
  controls/       # InputController, CameraController, DeviceCapabilities
  events/         # EventManager, EventTypes
  game/           # ScoringSystem, HighScoreManager
  managers/       # BallManager, UIManager, StateManager, GameLoopManager, StuckBallManager, etc.
  mechanics/      # MechanicBase, MechanicRegistry, 16 mechanic types
  objects/        # Ball, HoleEntity, OrbitalDriftCourse, hazards, GreenSurfaceBuilder
  physics/        # PhysicsWorld
  scenes/         # Game (main coordinator)
  states/         # GameState enum
  themes/         # Theme definitions (defaultTheme, spaceTheme)
  utils/          # Debug logging, holeValidator, WebGL detection
public/           # Static assets (index.html, CSS, logo)
tests/uat/        # Playwright end-to-end tests
```

## iOS Build (Capacitor)

```bash
npm run build          # Production build to dist/
npm run cap:sync       # Copy dist/ to iOS project and sync plugins
npm run cap:open:ios   # Open the Xcode project
```

In Xcode, select a target device or simulator and press Run. The `cap sync` step copies the latest `dist/` output into the native iOS project and resolves Capacitor plugin dependencies.

## Deployment

```bash
npm run build
```

Deploy the `dist/` folder to any static host. Vercel configuration is included (`vercel.json`).

## Documentation

- [Architecture](docs/architecture.md) -- system design, game loop, managers, mechanics
- [Development Guide](docs/development.md) -- setup, testing, debugging, build, deployment
- [Obstacle Taxonomy](docs/obstacle-taxonomy.md) -- all mechanic types, config shapes, parameter ranges
- [Design Reference](DESIGN.md) -- design principles, patterns, anti-patterns, hole taxonomy

## License

ISC
