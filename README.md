# Mini Golf Break

A 3D mini-golf game built with [Three.js](https://threejs.org/) and [Cannon-es](https://pmndrs.github.io/cannon-es/). Nine space-themed holes. Click-and-drag to aim, release to shoot, get the ball in the hole.

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
5. Complete all 9 holes for your final score

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

## Project Structure

```
src/
  config/         # Hole layouts, debug configuration
  controls/       # InputController, CameraController, DeviceCapabilities
  events/         # EventManager, EventTypes
  game/           # ScoringSystem
  managers/       # BallManager, UIManager, StateManager, GameLoopManager, etc.
  objects/        # Ball, HoleEntity, courses, hazards, GreenSurfaceBuilder
  physics/        # PhysicsWorld, physics utilities
  scenes/         # Game (main coordinator)
  states/         # GameState enum
  utils/          # Debug logging, styles
public/           # Static assets (index.html, CSS, logo)
tests/uat/        # Playwright end-to-end tests
```

## Deployment

```bash
npm run build
```

Deploy the `dist/` folder to any static host. Vercel configuration is included (`vercel.json`).

## Documentation

- [Architecture & Game Loop](docs/architecture.md)
- [Development Guide](docs/development.md)

## License

Open source.
