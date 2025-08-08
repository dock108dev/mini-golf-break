# Mini Golf Break - A 3D Mini Golf Game

**Mini Golf Break** is an immersive 3D mini-golf game that combines realistic physics simulation with beautiful graphics to deliver an engaging gaming experience. Built with Three.js for rendering and Cannon-es for physics, it offers cross-platform gameplay with special optimizations for mobile and iOS devices.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/mini-golf-break.git
cd mini-golf-break

# Install dependencies
npm install

# Start development server
npm start
# Open http://localhost:8080

# Build for production
npm run build

# Run tests
npm test
```

## Features

### Core Gameplay
*   **3D Graphics:** Clean and simple low-poly aesthetics using Three.js.
*   **Realistic Physics:** Accurate ball rolling, bouncing, and interactions powered by Cannon-es.
*   **Multiple Holes:** Includes a basic 3-hole test course (`BasicCourse`) and scaffolding for a full 9-hole course (`NineHoleCourse`).
*   **Scoring System:** Tracks strokes per hole and total score.
*   **Custom Hole Layouts:** Supports standard rectangular holes and custom shapes (L-shapes, T-shapes, crosses, etc.) using boundary wall definitions.
*   **Diverse Hole Shapes:** Procedural generation of various hole geometries (circles, triangles, stars, hexagons, kidney beans, figure-8s).

### Controls & Camera
*   **Intuitive Controls:** Simple click-and-drag aiming and power control for desktop, enhanced touch controls for mobile.
*   **Mobile Optimized:** Full touch gesture support with pinch-to-zoom, rotation, and intuitive aiming.
*   **Dynamic Camera System:** Intelligent camera with multiple states (overview, aiming, following, close-up) that adapts to game context.
*   **Manual Camera Controls:** Optional UI overlay for manual camera pan, rotate, zoom with preset views.
*   **Touch Camera Controller:** Dedicated mobile camera handling with natural gestures, momentum, and edge-based panning.

### Mobile & iOS Features
*   **iOS Optimization:** Comprehensive performance improvements including adaptive quality, dynamic resolution scaling, and battery-aware throttling.
*   **Native iOS App:** Full Capacitor integration for building and running as a native iOS application.
*   **Splash Screen:** Native splash screen support for iOS app launch.
*   **Safe Area Support:** UI elements respect device safe areas (notch, home indicator).
*   **Haptic Feedback:** Touch interactions enhanced with haptic feedback on supported devices.

### Hazards & Effects
*   **Configurable Hazards:** Easily define sand traps and water hazards with various shapes (circles, rectangles, compound shapes!) via configuration.
*   **Hazard Penalties:** Water hazards apply a one-stroke penalty and reset the ball to the last hit position.
*   **Bunker Effects:** Ball experiences increased drag when rolling through sand traps.
*   **Visual Effects:** Trail effects for ball movement, impact effects for collisions, environmental particles, and enhanced celebration animations.
*   **Improved Hole Physics:** Ball entry logic considers speed and overlap for more realistic interactions (including high-speed rejections).

### UI & Advertising
*   **Responsive UI:** Adaptive layout for various screen sizes with scalable fonts and touch-friendly spacing.
*   **Enhanced Score Display:** Clear, high-contrast score overlay optimized for mobile visibility.
*   **In-World Ad System:** Features dynamic ad ships (NASA, Alien, Station types) flying beneath the course, displaying dynamically generated, clickable banners that rotate to face the player.
*   **User Feedback System:** Provides easy access to a dedicated feedback form through an in-game ad ship.
*   **Optimized Ad Ship Paths:** Ensures ad ships at the level closest to the course pass behind the hole boundary for unobstructed gameplay.
*   **AdSense Integration:** Includes standard Google AdSense script and placeholder for HTML overlay ads (e.g., bottom banner) separate from the in-game AdShips.

### Development & Debug
*   **Debug Mode:** Includes physics debugging visuals (toggle with 'd') and Ad Inspect mode (toggle with 'i').
*   **Performance Monitoring:** Real-time FPS and performance metrics overlay (toggle with 'p').

## Project Structure

```
mini-golf-break/
├── src/                 # Source code
│   ├── scenes/         # Main game scene
│   ├── managers/       # Core system managers
│   ├── objects/        # Game entities (Ball, Course, etc.)
│   ├── controls/       # Input and camera controllers
│   ├── physics/        # Physics configuration
│   ├── events/         # Event system
│   └── utils/          # Utility functions
├── public/             # Static files and index.html
├── docs/               # Documentation
├── ios/                # iOS native app (Capacitor)
└── tests/              # Test suites
```

## How to Play

### Desktop Controls
1.  **Aim:** Click and hold the left mouse button on the golf ball.
2.  **Set Power:** Drag the mouse backward away from the direction you want to shoot. The further you drag, the more power you apply (indicated by the aiming line).
3.  **Shoot:** Release the mouse button to hit the ball.
4.  **Camera:** Use mouse to rotate view, scroll wheel to zoom.

### Mobile/Touch Controls
1.  **Aim:** Long-press on the golf ball to enter aiming mode.
2.  **Set Power:** Drag your finger away from the desired direction. A direction arrow will appear to help you aim.
3.  **Shoot:** Release your finger to hit the ball.
4.  **Camera Controls:**
    - **Pinch:** Zoom in/out
    - **Two-finger drag:** Rotate camera view
    - **Single-finger drag:** Pan camera (when not aiming)
    - **Edge touch:** Pan camera by touching screen edges

### General Gameplay
1.  **Goal:** Get the ball into the hole in the fewest strokes possible.
2.  Navigate through the different holes using the UI prompts after completing each hole.
3.  **Ad Interaction:** Click/tap on an ad ship's banner to open its linked content in a new tab.
4.  **Submit Feedback:** Click/tap on the "Feedback & Ideas?" ad ship to access the feedback form.
5.  **Ad Inspect Mode:** Press the 'i' key (desktop) to toggle Ad Inspect mode with free camera controls. Press 'i' again to return to gameplay.

## Running on iOS (via Capacitor)

This web application can be run as a native iOS app using Capacitor.

1.  **Prerequisites:**
    *   Ensure you have Xcode installed.
    *   Ensure you have CocoaPods installed (`sudo gem install cocoapods`).
    *   An Apple Developer account added to Xcode (for running on a physical device).

2.  **Build the Web App:**
    ```bash
    npm run build
    ```

3.  **Sync with Capacitor:**
    ```bash
    npx cap sync ios
    ```

4.  **Open in Xcode:**
    ```bash
    npx cap open ios
    ```

5.  **Run in Xcode:**
    *   Inside Xcode, select the `App` target.
    *   Go to the `Signing & Capabilities` tab and select your development team.
    *   Choose your target device (physical iPhone or Simulator).
    *   Click the Run button (or press Cmd+R).

## Development

### Available Scripts

```bash
# Development
npm start              # Start dev server with hot reload
npm run build          # Build for production
npm run lint           # Run ESLint
npm run format         # Format code with Prettier

# Testing
npm test               # Run all tests
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests
npm run test:coverage  # Generate coverage report

# iOS Development
npm run ios:build      # Build and sync iOS app
npm run ios:run        # Run on iOS simulator
npm run ios:open       # Open in Xcode
```

### Key Documentation

- [Development Guide](docs/development-guide.md) - Architecture, components, and development workflow
- [Testing Guide](docs/testing.md) - Testing strategy and best practices
- [Deployment Guide](docs/deploy-strategy.md) - Build and deployment procedures

## Browser Support

| Browser | Minimum Version | Status |
|---------|-----------------|--------|
| Chrome | 90+ | ✅ Fully Supported |
| Firefox | 88+ | ✅ Fully Supported |
| Safari | 14+ | ✅ Fully Supported |
| Edge | 90+ | ✅ Fully Supported |
| iOS Safari | 14+ | ✅ Optimized |
| Chrome Mobile | 90+ | ✅ Optimized |

## Performance Targets

- **Frame Rate**: 60 FPS (desktop), 30+ FPS (mobile)
- **Load Time**: < 2 seconds on 4G
- **Memory Usage**: < 500MB peak
- **Bundle Size**: < 1MB gzipped

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use ESLint configuration (`.eslintrc.json`)
- Format with Prettier
- Follow existing patterns in codebase
- Write tests for new features

## Troubleshooting

### Common Issues

**Build fails with "Cannot find module"**
```bash
rm -rf node_modules package-lock.json
npm install
```

**iOS app won't build**
```bash
cd ios/App
pod install
cd ../..
npx cap sync ios
```

**Performance issues on mobile**
- Check that hardware acceleration is enabled
- Verify device meets minimum requirements
- Try reducing quality settings in game options

## Support

- **Bug Reports**: [GitHub Issues](https://github.com/yourusername/mini-golf-break/issues)
- **Feature Requests**: Use the in-game feedback system
- **Documentation**: [Wiki](https://github.com/yourusername/mini-golf-break/wiki)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Three.js team for the amazing 3D library
- Cannon-es maintainers for the physics engine
- Capacitor team for iOS integration
- All contributors and testers

---

**Made with ❤️ for golf enthusiasts everywhere**