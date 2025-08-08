# Quick Start Guide - Mini Golf Break

Get up and running with Mini Golf Break in under 5 minutes!

## Prerequisites

- **Node.js** (v16 or higher)
- **npm** (v7 or higher)
- **Git**
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 1. Clone and Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/yourusername/mini-golf-break.git
cd mini-golf-break

# Install dependencies
npm install
```

## 2. Start Development Server (30 seconds)

```bash
npm start
```

Open your browser to: **http://localhost:8080**

## 3. Play the Game!

### Desktop Controls
- **Click and drag** on the ball to aim
- **Drag distance** determines shot power
- **Release** to shoot
- **Mouse wheel** to zoom camera
- **Click and drag** (when not aiming) to rotate camera

### Mobile Controls
- **Long press** on ball to start aiming
- **Drag** to set direction and power
- **Release** to shoot
- **Pinch** to zoom
- **Two-finger drag** to rotate camera

### Debug Keys
- **'d'** - Toggle debug mode
- **'p'** - Toggle performance monitor
- **'i'** - Toggle ad inspect mode

## Common Commands

```bash
# Development
npm start              # Start dev server
npm run build          # Build for production
npm test              # Run tests
npm run lint          # Check code style

# iOS Development
npm run ios:build     # Build iOS app
npm run ios:run       # Run on simulator
npx cap open ios      # Open in Xcode

# Testing
npm run test:unit     # Unit tests only
npm run test:coverage # With coverage report
```

## Project Structure Overview

```
mini-golf-break/
├── src/               # Game source code
│   ├── scenes/       # Main game scene
│   ├── managers/     # Game systems
│   ├── objects/      # Game entities
│   └── controls/     # Input handling
├── public/           # Static assets
├── docs/             # Documentation
└── tests/            # Test suites
```

## Next Steps

1. **Read the Docs**
   - [Development Guide](docs/development-guide.md) - Architecture and development workflow
   - [API Reference](docs/api-reference.md) - Component APIs
   - [Testing Guide](docs/testing.md) - Testing strategies

2. **Make Changes**
   - Edit files in `src/`
   - Changes auto-reload in browser
   - Press F12 for browser DevTools

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Build for Production**
   ```bash
   npm run build
   # Output in dist/ folder
   ```

## Troubleshooting

### Port 8080 is already in use
```bash
# Use a different port
PORT=3000 npm start
```

### Module not found errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build fails
```bash
# Check Node version
node --version  # Should be v16+

# Clear build cache
rm -rf dist/
npm run build
```

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/yourusername/mini-golf-break/issues)
- **Docs**: [Full Documentation](docs/)
- **Discord**: [Community Discord](https://discord.gg/yourinvite)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Happy Golfing! ⛳**