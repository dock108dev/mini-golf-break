# Mini Golf Break

A 3D mini-golf game built with [Three.js](https://threejs.org/) and [Cannon-es](https://pmndrs.github.io/cannon-es/). Click-and-drag to aim, release to shoot, get the ball in the hole.

## Quick Start

```bash
npm install
npm start
```

Open `http://localhost:8080`.

## How to Play

1. Click and hold on the golf ball
2. Drag backward to set direction and power
3. Release to shoot
4. Get the ball in the hole in the fewest strokes

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start dev server on port 8080 |
| `npm test` | Run unit and integration tests |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Run ESLint |

## Tech Stack

- **Rendering**: Three.js (3D graphics, camera, lighting)
- **Physics**: Cannon-es (ball dynamics, collisions, surfaces)
- **Build**: Webpack 5 with Babel
- **Testing**: Jest + Playwright (UAT)

## Project Structure

```
src/
  controls/       # InputController, CameraController
  events/         # EventManager, EventTypes
  game/           # ScoringSystem
  managers/       # BallManager, UIManager, StateManager, etc.
  objects/        # Ball, HoleEntity, courses, hazards
  physics/        # PhysicsWorld, physics utilities
  scenes/         # Game (main coordinator)
  states/         # GameState enum
  utils/          # Debug logging, styles
public/           # Static assets (index.html, styles, textures)
tests/uat/        # Playwright end-to-end tests
```

## Architecture

The game uses a component-based architecture coordinated by `Game.js`. Managers communicate via an `EventManager` pub/sub system. The `GameLoopManager` orchestrates the update cycle: physics → ball → camera → effects → render.

## Deployment

```bash
npm run build
```

The `dist/` folder contains the production build. Deploy to any static hosting (Vercel, Netlify, GitHub Pages). See `vercel.json` for Vercel configuration.

## License

Open source.
