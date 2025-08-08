# Developer Guide for Mini Golf Break

*Last Updated: 2025-08-08*

This guide provides comprehensive information for developers who want to understand, modify, or extend the Mini Golf Break project.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Systems](#core-systems)
3. [Game Flow](#game-flow)
4. [Key Classes and Responsibilities](#key-classes-and-responsibilities)
5. [Nine-Hole Course Status](#nine-hole-course-status)
6. [Development Workflow](#development-workflow)
7. [Testing and Debugging](#testing-and-debugging)
8. [Performance Optimization](#performance-optimization)
9. [Mobile Development](#mobile-development)
10. [Common Patterns](#common-patterns)

## Architecture Overview

Mini Golf Break follows a component-based architecture where different systems interact primarily through an `EventManager`. The main components are coordinated by the `Game` class. The system heavily relies on manager classes, each handling a specific domain.

### Core Manager Responsibilities:
*   **`EventManager`**: Central hub for publishing and subscribing to game events. Decouples managers.
*   **`GameLoopManager`**: Orchestrates the main game update loop, calling manager updates in the correct order (`physics` -> `game logic` -> `rendering/camera`).
*   **`StateManager`**: Manages the overall game state (Initializing, Aiming, Ball Moving, Hole Completed, Game Completed, Ad Inspecting).
*   **`Game` (`Game.js`)**: Top-level coordinator. Initializes all managers, sets up the core Three.js scene/renderer/lights, handles window resize, and orchestrates cleanup.
*   **`PhysicsManager`**: Manages the Cannon-es physics world, materials, and simulation step. Delegates world creation to `PhysicsWorld`.
*   **`UIManager`**: Manages all DOM-based UI elements. Delegates specific UI areas (Score/Hole Info, Debug Info) to submodules (`UIScoreOverlay`, `UIDebugOverlay`). Handles messages and power indicator directly.
*   **`DebugManager`**: Handles debug state, logging, error reporting. Delegates UI overlays (Error, Course Debug) to submodules (`DebugErrorOverlay`, `DebugCourseUI`). Manages 3D debug helpers (axes, grid).
*   **`CameraController`**: Handles camera positioning (high-angle overview, aiming view, active ball following), movement, transitions, user adjustments, and subtle ad focus blending.
*   **`InputController`**: Manages user input (mouse/touch) for aiming and hitting the ball. Also handles key presses for debug toggles (delegating to `DebugManager`) and Ad Inspect mode ('i'), and raycasting for ad banner clicks.
*   **`BallManager`**: Manages the creation, state, physics updates, and removal of the golf ball (`Ball.js`).
*   **`CourseManager` (`NineHoleCourse` / `BasicCourse`)**: Handles course generation, layout, and hole configurations. `NineHoleCourse` manages the 9-hole structure.
*   **`HoleEntity`**: Represents a single hole's geometry, physics elements, and hazards. Instantiated by the `CourseManager`.
*   **`HazardManager`**: Detects when the ball enters hazards (out of bounds, water) and triggers resets/penalties via events.
*   **`HoleCompletionManager`**: Handles logic when the ball enters the hole (`BALL_IN_HOLE` event). Triggers effects, sound, UI messages, updates score, sets state, and initiates hole transitions or game completion via events.
*   **`HoleTransitionManager`**: Manages the transition sequence between holes (cleanup, setup, camera/ball positioning).
*   **`ScoringSystem`**: Tracks strokes per hole and total strokes.
*   **`AudioManager`**: Handles sound playback using Three.js Audio.
*   **`AdShipManager`**: Manages the lifecycle, movement, ad display, collision avoidance, and interaction for `AdShip` instances. Hooks into the scene graph and update loop.
*   **`PerformanceManager`**: Tracks FPS, frame times, and component update times.
*   **`VisualEffectsManager`**: Intended for managing visual effects (currently minimal usage).

### System Interactions:
*   **Scene Graph**: `Game` owns the main `THREE.Scene`. Managers like `CourseManager`, `BallManager`, `AdShipManager`, and `DebugManager` add their respective `THREE.Group` or `THREE.Mesh` objects to this scene. `HoleEntity` adds its components to a group managed by the `CourseManager`.
*   **Update Loop (`GameLoopManager`)**: Calls the `update(deltaTime)` method on relevant managers in a specific order (e.g., Physics -> Ball -> Course -> Ads -> Camera -> UI -> Debug).
*   **Event Manager**: Most cross-manager communication uses events (e.g., `BALL_HIT`, `HOLE_COMPLETED`, `HAZARD_DETECTED`, `STATE_CHANGED`). Managers subscribe to events they care about and publish events when significant actions occur.
*   **Direct References**: Some managers hold references to others (often passed via constructor or `init`), e.g., `UIManager` references `ScoringSystem`, `DebugManager` references `Game` to access other managers or the scene. This is minimized in favor of events.

## Core Systems

### Physics System
- Uses Cannon-es via `PhysicsManager` and `PhysicsWorld`.
- Ball properties:
  - Mass: 0.45kg
  - Linear damping: 0.6
  - Angular damping: 0.6
- World configuration:
  - Gravity: -9.81 m/s²
  - Solver iterations: 10 (Adjusted)
  - Max substeps: 3 (Adjusted)
  - Fixed timestep: 1/60 second
- See `docs/technical/physics-parameters.md` for detailed material and contact properties.

#### Physics Gameplay Goals (from physics-specs.md)

*   **Ball Movement**: Aim for realistic rolling, proper friction/damping, and intuitive response to applied force. Ball should come to a complete stop reliably.
*   **Course Interactions**: Different surfaces (green, sand) should noticeably affect ball speed and behavior. Collisions with walls/obstacles should feel fair.
*   **Hole Mechanics**: Hole detection should be reliable based on proximity and low speed. Visual/audio feedback for success should be clear.

### Rendering and Visuals
- Three.js for 3D rendering managed by the `Game` class.
- **Course Geometry**: Uses Constructive Solid Geometry (CSG) via `three-csg-ts` in `HoleEntity.js` to create cutouts for the hole and sand traps in the green surface, avoiding Z-fighting.
- **Starfield**: Procedurally generated starfield background in `Game.js`.
- **Lighting**: Basic ambient and directional lighting in `Game.js`.
- **Effects**: Ball glow, success particles (`Ball.js`), hole fade-out (`HoleCompletionManager`).
- **Style Guide**: Aims for a clean, minimalist, high-contrast look. Emissive materials used for visibility (e.g., green fairway). Key colors: Green (fairway), White (ball), Dark (hole rim), Accent (UI elements). See `graphics-and-style-guide.md` for specific color codes if needed (Consider merging fully or deleting this file).

### Input System
- Managed by `InputController`.
- **Core Mechanic**: Unified drag-and-release input for both mouse and touch.
    - Click/touch and drag to aim (determines direction).
    - Drag distance determines power (linear scaling, clamped).
    - Release to shoot.
- **Touch-Specific Features**:
    - Long-press detection for mobile aiming
    - Direction arrow visualization during touch aiming
    - Touch-friendly hit zones and UI elements
    - Gesture conflict prevention with camera controls
- **Visual Feedback**:
    - Aim direction line displayed during drag.
    - Power indicator shows shot strength during drag.
    - Touch-specific visual cues for mobile users.
- **State Handling**: Input is disabled by `InputController` during ball movement, hole transitions, and potentially UI interactions based on events like `BALL_STOPPED`, `HOLE_STARTED`, `BALL_IN_HOLE`.
- Integrates with `CameraController` and `TouchCameraController` to manage control modes.

### Performance Monitoring System
- Managed by `PerformanceManager`.
- Tracks FPS, frame times, component update times, memory usage, and object counts.
- Press 'p' key during gameplay to toggle the visual performance display overlay.
- Display shows real-time metrics, often color-coded based on performance budgets (e.g., FPS target > 30).
- Provides warnings via `DebugManager` when budgets are exceeded.

### Feedback System
- Accessible through a dedicated "Feedback & Ideas?" ad ship visible in the game.
- Implementation in `public/feedback.html` with matching visual style to the main game.
- Access triggered through special URL handling in `AdShip.handleAdClick()`.
- Form collects:
  - User name and email
  - Feedback type (Bug Report, Feature Request, Game Suggestion, Other)
  - Detailed feedback message
- Current implementation simulates submission with client-side handling.
- Structure allows for future backend integration to store and process feedback.

## Game Flow

1.  **Initialization (`main.js` -> `Game.init`)**:
    *   `Game` creates and initializes all managers in dependency order.
    *   `UIManager` creates the main UI container and initializes submodules (`UIScoreOverlay`, `UIDebugOverlay`).
    *   `DebugManager` initializes submodules (`DebugErrorOverlay`, `DebugCourseUI`).
    *   `PhysicsManager` initializes `PhysicsWorld`.
    *   `AdShipManager` spawns initial ships and adds its group to the scene.
    *   `Game.createCourse()` called, which instantiates `NineHoleCourse`.
    *   `NineHoleCourse.create()` initializes hole groups, calls `initializeHole(0)`.
    *   `NineHoleCourse.initializeHole()` creates `HoleEntity` for Hole 1, placing it in `Hole_1_Group`.
    *   `BallManager.createBall()` places the ball at the hole's start position.
    *   `CameraController` positions the camera for the first hole.
    *   `StateManager` sets state to `AIMING`.
    *   `GameLoopManager` starts the main loop.
2.  **Aiming (`GameState.AIMING`)**: Player uses drag input (`InputController`).
3.  **Ball Hit**: `InputController` -> `BallManager.hitBall` -> `Ball.applyForce` -> `EventManager.publish(BALL_HIT)`. `StateManager` sets state to `BALL_MOVING`.
4.  **Ball Moving (`GameState.BALL_MOVING`)**:
    *   `GameLoopManager.update()` calls managers.
    *   `PhysicsManager.update()` steps the physics world.
    *   `BallManager.update()` updates ball position from physics body. Publishes `BALL_MOVED`.
    *   `AdShipManager.update()` moves ships, handles collisions/recycling.
    *   `CameraController.update()` actively follows the ball, potentially blending towards ad ships.
    *   `HazardManager.update()` checks ball position against hazards.
    *   `UIManager` (via `UIDebugOverlay`) updates debug info display.
5.  **Ball Stops**: `BallManager` detects low velocity -> `EventManager.publish(BALL_STOPPED)`. `StateManager` sets state to `AIMING`. `InputController` re-enables aiming.
6.  **Hazard**: `HazardManager` detects hazard -> `EventManager.publish(HAZARD_DETECTED, { type: 'water'|'oob' })`. `BallManager` subscribes, resets ball to last safe position, calls `ScoringSystem.addStroke()`. `UIManager` subscribes, shows penalty message.
7.  **Ball in Hole**: `Ball.update()` detects proximity/speed condition -> `EventManager.publish(BALL_IN_HOLE)`. `HoleCompletionManager` subscribes:
    *   Plays sound/effects via `AudioManager`/`Ball`. Shows UI message via `UIManager`.
    *   Sets `StateManager.setHoleCompleted(true)` (which sets state to `HOLE_COMPLETED`).
    *   Updates score via `ScoringSystem`.
    *   Publishes `HOLE_COMPLETED` event (includes hole number, strokes). `UIManager` subscribes to update score/stroke display.
    *   Checks if last hole (`StateManager.getCurrentHoleNumber()` vs `Course.getTotalHoles()`).
    *   If last hole -> `StateManager.setGameState(GAME_COMPLETED)`. Publishes `GAME_COMPLETED`.
    *   If not last hole -> Calls `HoleTransitionManager.transitionToNextHole()` after delay.
8.  **Hole Transition (`HoleTransitionManager`)**:
    *   Cleans previous hole (`NineHoleCourse.clearCurrentHole()` -> `HoleEntity.destroy()`).
    *   Initializes next hole (`NineHoleCourse.initializeHole(nextIndex)` -> creates new `HoleEntity`).
    *   Resets ball position via `BallManager`.
    *   Updates camera via `CameraController`.
    *   Updates UI via `UIManager` (triggered by `HOLE_STARTED` event published by `StateManager.resetForNextHole`).
    *   `StateManager.resetForNextHole()` sets state back to `AIMING`.
9.  **Game Complete (`GameState.GAME_COMPLETED`)**: `UIManager` subscribes to `GAME_COMPLETED`, calls `UIScoreOverlay.showFinalScorecard()`. Scorecard buttons publish `UI_REQUEST_MAIN_MENU` or `UI_REQUEST_RESTART_GAME`.
10. **Ad Inspecting (`GameState.AD_INSPECTING`)**: Toggled via 'i' key (`InputController`). `CameraController` enables orbit controls. `InputController` enables raycasting for banner clicks. Clicking banner opens `adData.url`. Toggling off returns state to `AIMING`.

## Key Classes and Responsibilities

*   **`Game` (`src/scenes/Game.js`)**: Main coordinator. Initializes systems, manages core Three.js objects (scene, renderer, lights), sets up starfield, handles window resize, and orchestrates cleanup. Most direct game logic has been moved to managers.
    - Manages restart functionality
    - Instantiates and cleans up major managers, including `AdShipManager`.
*   **`NineHoleCourse` (`src/objects/NineHoleCourse.js`)**: Defines the 9-hole structure. Loads hole configurations from an internal array, initializes `HoleEntity` objects placing them within pre-defined `THREE.Group` containers (`holeGroups`), manages transitions between holes by calling `initializeHole` and `clearCurrentHole`. See [Nine-Hole Course Status](#nine-hole-course-status) below.
*   **`HoleEntity` (`src/objects/HoleEntity.js`)**: Represents a single hole. Creates the green surface (using CSG), walls, hole trigger, start marker, and hazards (sand traps using CSG) based on configuration. Manages associated meshes and physics bodies.
*   **`Ball` (`src/objects/Ball.js`)**: Represents the player's ball.
    *   **Core**: Creates the visual mesh (THREE.Mesh) and physics body (CANNON.Body).
    *   **Physics**: Handles physics updates, applying damping and sleep states. Provides methods `applyForce()`/`applyImpulse()` to hit the ball, `setPosition()`, `resetVelocity()`.
    *   **Collision**: Listens for physics collisions, specifically checking for the hole trigger body (`userData.type === 'hole'`).
    *   **Events**: Publishes `BALL_IN_HOLE` upon successful hole collision.
    *   **Effects**: Manages its own visual effects like glow and `handleHoleSuccess()` (triggers particles, sound via `AudioManager`).
    *   **Cleanup**: `cleanup()` method disposes of mesh, body, geometry, material.
*   **`UIManager` (`src/managers/UIManager.js`)**: Manages all DOM elements: score display, hole info, stroke count, messages, power indicator (styling likely inline), debug info (styling likely inline), and the final scorecard overlay.
*   **`InputController` (`src/controls/InputController.js`)**: Handles mouse/touch input for aiming/hitting, calculates shot vector, manages aim/power indicators, disables/enables input based on game state.
    - Handles ad banner clicks via raycasting when in `AD_INSPECTING` state.
    - Toggles `AD_INSPECTING` state via key press ('i').
*   **`CameraController` (`src/controls/CameraController.js`)**:
    *   **Core**: Manages the Three.js `PerspectiveCamera`.
    *   **Intelligent Positioning**: Positions the camera with a high overhead angle that shows the entire hole and ensures enough space behind the ball for pull-back aiming.
    *   **User Adjustments**: Detects when the player manually adjusts the camera and respects these adjustments until the ball moves.
    *   **Active Following**: Actively follows the ball's motion by positioning the camera behind the movement direction, not just changing the orbit center.
    *   **Dynamic Following**: When the ball is moving fast, the camera positions itself behind the movement direction; when slow or stopped, it maintains a consistent position relative to the ball.
    *   **Offset Viewport**: Camera is intentionally shifted down by approximately 15% to show more of the course at the top of the screen and less starfield at the bottom.
    *   **Transitions**: Improved transitions with the camera intelligently following behind the ball's movement direction with increased responsiveness.
    *   **Orbit Controls**: Integrates `OrbitControls` for free look when the player is not aiming/hitting.
    *   **Mobile Support**: Integrates with `TouchCameraController` for touch gestures.
    *   **Initialization**: Sets initial camera position with a high angle and good framing of the course.
    *   **Cleanup**: Disposes of controls and event listeners.
    - Respects user camera adjustments until the ball moves again
    - Subtly blends camera target towards nearest ad ship while the ball is in motion.
    - Resets ad focus blend state when positioning for a new hole.
*   **`TouchCameraController` (`src/controls/TouchCameraController.js`)**:
    *   **Touch Gestures**: Handles pinch-to-zoom, two-finger rotation, and pan gestures.
    *   **Momentum**: Implements physics-based momentum for natural feeling controls.
    *   **Edge Panning**: Allows camera panning by touching screen edges.
    *   **Haptic Feedback**: Provides tactile feedback on supported devices.
*   **`CameraStateManager` (`src/controls/CameraStateManager.js`)**:
    *   **State Management**: Manages different camera view states (overview, aiming, following).
    *   **Smart Transitions**: Smooth transitions between camera states.
    *   **Context Awareness**: Automatically selects appropriate view based on game state.
    *   **User Preferences**: Tracks and applies user camera preferences.
*   **`UICameraControls` (`src/managers/ui/UICameraControls.js`)**:
    *   **Manual Controls**: Provides UI overlay for manual camera adjustment.
    *   **Preset Views**: Quick access to predefined camera positions.
    *   **Mobile Optimized**: Touch-friendly button layout and sizing.
    *   **Auto-hide**: Automatically hides after period of inactivity.
*   **`ScoringSystem` (`src/game/ScoringSystem.js`)**: Simple system to track strokes per hole and total strokes for the course.
*   **`HoleCompletionManager` (`src/managers/HoleCompletionManager.js`)**: Central handler for the `BALL_IN_HOLE` event. Triggers effects, sound, UI messages, updates score, sets state, and initiates hole transitions or game completion.
*   **`AdShipManager` (`src/ads/AdShipManager.js`)**: Manages the ad ship system.
    -   **Scene Graph**: Adds its main `THREE.Group` (`AdShipManager.group`) to the main `Game.scene`.
    -   **Update Loop**: `update(deltaTime)` method called by `GameLoopManager`. Moves ships, handles simple N^2 collision avoidance (with `distanceToSquared` optimization), recycles linear ships, rotates ads based on timers.
    -   **Communication**: Instantiated by `Game`. `CameraController` may query it for ship positions. `InputController` interacts via raycasting against `AdShip` banner meshes.
    -   **Configuration**: `maxShips` (currently 4 due to O(N^2) collision), movement parameters defined internally.
    -   **Path Optimization**: Ships at the -5 vertical level (closest to the course) follow optimized paths:
        - Restricted to horizontal paths (left-to-right or right-to-left) along the +Z axis (behind the hole)
        - Z-position confined to 30-40 units behind the hole to prevent obstruction of gameplay
        - Custom path routing in `_getLinearStartPosAndVel()` specifically for -5 level ships
        - Special recycling logic ensures paths stay behind the hole throughout gameplay
    -   **Feedback Integration**: Provides a dedicated "Feedback & Ideas?" ad ship that opens the feedback form when clicked:
        - Special URL handling in `AdShip.handleAdClick()` detects "#feedback-form" URLs
        - Opens `/feedback.html` in a new tab instead of navigating directly
        - Form designed to match game's visual theme with proper error handling
*   **`AdShip` (`src/ads/AdShip.js`)**: Represents a single ad ship instance.
    -   **Scene Graph**: Creates its own `THREE.Group` containing body mesh and banner mesh. This group is added to the `AdShipManager.group`.
    -   **Update Loop**: `update(deltaTime)` method called by `AdShipManager`, currently only used for station rotation animation.
    -   **Communication**: Instantiated by `AdShipManager`. `AdShipManager` calls `updateAd()` to change texture. `InputController` raycasts against its `bannerMesh`.
    -   Generates dynamic canvas textures. Stores `adData` in `bannerMesh.userData`.
*   **`adConfig` (`src/ads/adConfig.js`)**: Exports a `mockAds` array containing ad objects (`{ title, url, texturePath }`).
    - `texturePath` is currently unused as banners are canvas-generated.

## Nine-Hole Course Status

*(As of 2025-04-06)*

The `NineHoleCourse.js` system provides the foundation for a full 9-hole game.

*   **Structure**: It pre-creates 9 `THREE.Group` containers (e.g., `Hole_1_Group`, `Hole_2_Group`, etc.) which are permanently added to the main scene. When a hole is loaded (`initializeHole`), a `HoleEntity` is created and its contents are added to the corresponding group. When a hole is cleared (`clearCurrentHole`), the `HoleEntity`'s contents are destroyed, but the parent group remains.
*   **Hole Configurations**: Hole layouts (positions, hazards, bumpers, par, description) are currently defined within a large array (`this.holeConfigs`) inside the `NineHoleCourse.js` constructor.
*   **Current Status**:
    *   **Holes 1-9**: All 9 hole configurations *exist* in the `holeConfigs` array. These define starting positions, hole positions, basic dimensions, pars, descriptions, and some hazard/bumper layouts.
    *   **Completeness**: These configurations are functional and should load correctly via `HoleEntity`. They represent a complete 9-hole course in terms of data.
    *   **Geometry**: The geometry (green shape, walls, hazards, bumpers) is generated procedurally by `HoleEntity` based on the configuration data. There is no placeholder geometry remaining.
*   **Future Plans**:
    *   **Configuration**: Ideally, the `holeConfigs` array should be moved out of the constructor into a separate JSON file (e.g., `src/config/nineHoleLayout.json`) to make editing easier.
    *   **Hazards/Bumpers**: More complex hazard types (e.g., moving obstacles, different trigger effects) or dynamic bumper interactions could be added by extending `HazardFactory.js` or adding new logic to `HoleEntity.js`. No specific complex hazards are planned *imminently* but the system is extensible.

## Development Workflow

### Setting Up
1.  Clone repo: `git clone https://github.com/yourusername/mini-golf-break.git`
2.  Install dependencies: `npm install`
3.  Start dev server: `npm start`
4.  Open browser to `http://localhost:8080`

### Making Changes

#### 1. Feature Planning
- Identify the responsible manager(s) for the feature
- Check if existing events can be used or new ones are needed
- Plan the data flow between components
- Consider mobile/iOS implications

#### 2. Implementation
- Modify manager logic and utilize the `EventManager` for cross-component communication
- Add/modify UI elements via `UIManager` and its submodules
- Add/modify 3D objects via `HoleEntity`, `Ball`, or `Game`
- Follow existing code patterns and conventions
- Add appropriate error handling

#### 3. Testing
- Write unit tests for new components
- Add integration tests for component interactions
- Test on multiple browsers and devices
- Check performance impact with the Performance Monitor (press 'p')

#### 4. Documentation
- Update relevant documentation
- Add JSDoc comments to new functions/classes
- Update CHANGELOG.md with your changes

### Debugging

#### Debug Keys
*   **'d'** - Toggle debug mode (3D helpers, physics wireframes, course debug UI)
*   **'p'** - Toggle performance overlay (FPS, frame times, component metrics)
*   **'i'** - Toggle Ad Inspect mode (free camera, clickable ads)

#### Debug Tools
*   **CannonDebugRenderer** - Visualizes physics bodies as green wireframes
*   **DebugManager** - Centralized error tracking and reporting
*   **Performance Monitor** - Real-time performance metrics
*   **Browser DevTools** - Console logs, network monitoring, profiling

#### Common Debug Scenarios

**Ball falls through floor:**
1. Enable physics debug ('d' key)
2. Check if floor physics body exists
3. Verify collision groups and masks
4. Check physics world configuration

**Camera issues:**
1. Check CameraController state
2. Verify camera position/target calculations
3. Check for user adjustment detection
4. Review touch controller integration

**Performance problems:**
1. Enable performance overlay ('p' key)
2. Identify slow components (red metrics)
3. Check object count and memory usage
4. Review update loop efficiency

## Testing and Debugging

### Debug Mode
Press 'd' during gameplay to toggle debug mode, which:
- Shows axes helpers and grid
- Displays additional console logs
- Shows a wireframe view of the scene (TBD, might conflict with physics debugger)

## Physics Debug Renderer

The project includes `CannonDebugRenderer` (from `src/utils/CannonDebugRenderer.js`) to help visualize the Cannon.js physics bodies directly within the Three.js scene. This is invaluable for debugging collision issues.

- **Integration**: It's initialized in `Game.js` and updated in `GameLoopManager.js` before rendering.
- **Appearance**: It draws green wireframes around all active physics bodies.
- **Usage**: If collisions aren't working as expected (e.g., ball falling through floor), enable this view to see if the physics bodies are correctly positioned, oriented, and shaped.

## Common Issues & Checks
1.  **Physics**: Collision groups/masks, material properties, body positioning, sleep states, damping.
2.  **Visuals**: Camera position/target, object positions, Z-fighting (CSG helps), material transparency/opacity, lighting/shadows.
3.  **State/Flow**: Event publishing/subscriptions, manager initialization order (`Game.init`), state transitions (`StateManager`), race conditions during transitions.
4.  **CSG Issues**: Ensure correct geometry subtraction order, apply matrix transforms *before* CSG conversion, recalculate normals (`computeVertexNormals`) on the final mesh.

## Performance Optimization

### Key Optimization Areas

#### 1. Rendering
- **LOD (Level of Detail)**: Reduce complexity for distant objects
- **Frustum Culling**: Don't render objects outside camera view
- **Batch Draw Calls**: Combine similar geometries
- **Texture Atlasing**: Reduce texture switching

#### 2. Physics
- **Sleep States**: Let static bodies sleep
- **Collision Groups**: Minimize collision checks
- **Simplified Shapes**: Use primitives over trimeshes
- **Update Frequency**: Balance accuracy vs performance

#### 3. Mobile Specific
- **Dynamic Resolution**: Scale based on device capability
- **Reduced Shadows**: Lower quality or disable on weak devices
- **Touch Optimization**: Larger hit zones, gesture debouncing
- **Battery Management**: Throttle when low battery

### Performance Budgets

```javascript
// Target metrics (from PerformanceManager)
const PERFORMANCE_BUDGETS = {
    fps: { target: 60, minimum: 30 },
    frameTime: { target: 16.67, maximum: 33.33 },
    physics: { maximum: 5 },
    rendering: { maximum: 10 },
    memory: { maximum: 500 } // MB
};
```

## Mobile Development

### iOS Optimization

The game includes comprehensive iOS optimizations via `iOSOptimizations.js`:

```javascript
// Device tier detection
const deviceTier = iOSOptimizations.getDeviceTier();

// Apply optimizations
if (deviceTier === 'low') {
    iOSOptimizations.applyLowEndOptimizations(renderer, scene);
} else if (deviceTier === 'medium') {
    iOSOptimizations.applyMediumOptimizations(renderer, scene);
}
```

### Touch Controls

**TouchCameraController** features:
- Pinch-to-zoom
- Two-finger rotation
- Edge-based panning
- Momentum physics
- Haptic feedback

### Safe Area Support

CSS for notch/home indicator:
```css
.game-ui {
    padding: env(safe-area-inset-top) 
             env(safe-area-inset-right) 
             env(safe-area-inset-bottom) 
             env(safe-area-inset-left);
}
```

## Common Patterns

### Event-Driven Communication

```javascript
// Publishing events
this.eventManager.publish(EventTypes.BALL_HIT, {
    position: ball.position,
    velocity: shotVelocity,
    timestamp: Date.now()
});

// Subscribing to events
this.eventManager.subscribe(EventTypes.BALL_STOPPED, (event) => {
    this.handleBallStopped(event.data);
});
```

### Manager Initialization

```javascript
class MyManager {
    constructor(game) {
        this.game = game;
        this.isInitialized = false;
    }
    
    init() {
        if (this.isInitialized) {
            console.warn('MyManager already initialized');
            return;
        }
        
        try {
            // Initialization logic
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize MyManager:', error);
            throw error;
        }
    }
    
    cleanup() {
        // Cleanup logic
        this.isInitialized = false;
    }
}
```

### Error Handling

```javascript
// Use DebugManager for centralized error reporting
try {
    // Risky operation
} catch (error) {
    this.debugManager.reportError(
        'Component failed',
        error,
        { context: 'additional info' },
        'ComponentName'
    );
}
```

## Additional Resources
- [Architecture Standards](../technical/architecture-standards.md)
- [Physics Parameters](../technical/physics-parameters.md)
- [Event System Documentation](../technical/event-system.md)
- [Error Handling Guidelines](../technical/error-handling-guidelines.md)
- [Testing Guide](testing.md)
- [Deployment Strategy](deploy-strategy.md)
- [CHANGELOG.md](../CHANGELOG.md)

## Physics Implementation

The physics system uses Cannon-es with these key configurations:

1.  **Course Geometry**:
    -   Uses a `CANNON.Trimesh` generated directly from the visual `THREE.PlaneGeometry` for the floor.
    -   Floor bodies are correctly set to `type: CANNON.Body.STATIC`.
    -   Hole cutouts using CSG are currently disabled; hole interaction is handled separately.

2.  **Hole Interaction**:
    -   Hole detection logic resides entirely within `Ball.update()`.
    -   It checks if the ball's center is within a defined `holePhysicalRadius` of the hole's center position (`ball.currentHolePosition`).
    -   If close enough, it checks the ball's speed against `ball.holeEntryThresholds.MAX_SAFE_SPEED`.
    -   If faster than safe speed, it calculates the impact angle using `calculateImpactAngle` and checks for lip-out conditions using `isLipOut` (based on speed/angle thresholds).
    -   A static cylinder trigger body (`holeTriggerBody`) exists at the hole location but is currently unused for detection logic (could be removed or used for visual debugging).
    -   The physical `holeCupBody` has been removed.

3.  **Collision Groups**:
    -   Group 1: Course terrain (Floor/Green - Trimesh)
    -   Group 2: Holes and triggers (Unused holeTrigger body)
    -   Group 4: Ball
    -   Group 8: Triggers (e.g., Bunker Zones)

4.  **Material Properties**:
    -   `groundMaterial`: High friction (0.8) for realistic rolling. Used for the green Trimesh.
    -   `ballMaterial`: For the player's ball.
    -   `bumperMaterial`: Low friction (0.1) with high restitution (0.8). Used for course walls.
    -   `holeRimMaterial`: Currently unused.
    -   `holeCupMaterial`: Removed.

5.  **Ball Physics**:
    -   Mass: 0.45 kg
    -   Linear/Angular Damping: 0.6
    -   Sleep parameters configured.
    -   Hole entry thresholds defined in constructor (`MAX_SAFE_SPEED`, `LIP_OUT_SPEED_THRESHOLD`, `LIP_OUT_ANGLE_THRESHOLD`).

6.  **Physics World Settings**:
    -   Gravity: -9.81 m/s²
    -   Solver Iterations: 30
    -   Fixed Timestep: 1/60s

## Debug Mode

Press 'd' during gameplay to toggle debug mode, which shows:
- Axes helpers and grid helpers (via `DebugManager`).
- Physics wireframes (via `CannonDebugRenderer`, controlled by `DebugManager` state).

## Physics Debug Renderer

The project includes `CannonDebugRenderer` (`src/utils/CannonDebugRenderer.js`) to visualize Cannon.js physics bodies.

- **Integration**: Initialized in `Game.js`. Its `update()` is called conditionally in `GameLoopManager.js` based on `DebugManager.enabled`. Its meshes are cleared by `DebugManager.toggleDebugMode()` when disabling debug mode. Its `world` reference is updated by `HoleTransitionManager` after physics world reset.
- **Appearance**: Draws green wireframes around active physics bodies.
- **Usage**: Essential for debugging collision issues, body placement, and orientation.

## Animated Scorecard Implementation

The scorecard implementation is currently a static overlay. Future updates will include an animated scorecard that shows the player's progress and highlights their best shots.

## Project Structure

```
mini-golf-break/
├── src/
│   ├── assets/          # Static assets (textures, models, sounds)
│   │   └── textures/
│   │       └── ads/     # Placeholder for ad banner images (if used)
│   ├── ads/             # Ad Ship System files
│   │   ├── AdShip.js
│   │   ├── AdShipManager.js
│   │   └── adConfig.js
│   ├── config/          # Game configuration files (e.g., course layouts - if separated)
│   ├── controls/        # InputController, CameraController, TouchCameraController, CameraStateManager
│   ├── events/          # Event types and EventManager
│   ├── game/            # Game-specific logic (e.g., ScoringSystem)
│   ├── managers/        # Core game system managers (UI, Physics, Audio, State, etc.)
│   │   └── ui/          # UI submodules (UIScoreOverlay, UIDebugOverlay, UICameraControls)
│   ├── objects/         # Game objects (Ball, HoleEntity, BaseElement, Course, hazards/, etc.)
│   │   └── hazards/
│   ├── physics/         # Physics world setup and utilities
│   ├── scenes/          # Main game scene (Game.js)
│   ├── states/          # Game state definitions (GameState.js)
│   ├── styles/          # CSS styles
│   └── utils/           # Utility functions (math, helpers, debug renderers, holeShapes, iOSOptimizations)
├── docs/                # Project documentation
├── node_modules/        # NPM dependencies
├── public/              # Static files served by dev server (index.html)
├── .babelrc             # Babel configuration
├── .eslintrc.json       # ESLint configuration
├── .gitignore           # Git ignore rules
├── package.json         # Project metadata and dependencies
├── package-lock.json    # Locked dependency versions
├── PROJECT_CHECKLIST.md # Development task checklist (if used)
├── README.md            # Project overview
└── webpack.config.js    # Webpack build configuration
```

## Key Components

*   **`src/scenes/Game.js`**: Main entry point...
*   **`src/managers/`**: Various manager classes...
    *   ... (existing managers) ...
    *   `AdShipManager`: Manages the ad ship system.
*   **`src/objects/`**: Game entities...
    *   ... (existing objects) ...
*   **`src/ads/`**: Classes related to the Ad Ship system:
    *   `AdShip.js`: Represents a single ad ship instance.
    *   `AdShipManager.js`: Manages lifecycle, movement, ads.
    *   `adConfig.js`: Mock ad data.
*   **`src/physics/`**: Physics setup...
*   **`src/events/EventTypes.js`**: Event constants...
*   **`src/states/GameState.js`**: Defines game states, including `AD_INSPECTING`.

### InputController Class (`src/controls/InputController.js`)

Handles user interaction:
*   Processes mouse/touch events for aiming and hitting the ball.
*   Calculates direction and power from drag distance.
*   Manages visual feedback (direction line, power indicator).
*   Disables/enables aiming input based on game state.
*   Toggles camera orbit controls during aiming vs. free look/ad inspect.
*   **Handles ad banner clicks via raycasting when in `AD_INSPECTING` state.**
*   **Toggles `AD_INSPECTING` state via key press ('i').**

### CameraController Class (`src/controls/CameraController.js`)

Manages the camera system:
*   **Core**: Manages the Three.js `PerspectiveCamera` and `OrbitControls`.
*   **Ball Following**: Updates camera position and target smoothly based on ball movement (direction, speed) or a stable view when stopped.
*   **Hole Positioning**: Sets appropriate high-angle views when a new hole starts.
*   **User Interaction**: Respects manual camera adjustments until the ball is hit.
*   **Ad Focus Blending**: Subtly shifts the camera's look-at target towards the nearest visible ad ship while the ball is rolling, blending back when stopped.
*   **Cleanup**: Disposes of controls and event listeners.

### ScoringSystem Class (`src/game/ScoringSystem.js`)
// ... existing description ...

### HoleCompletionManager (`src/managers/HoleCompletionManager.js`)
// ... existing description ...

### AdShipManager Class (`src/ads/AdShipManager.js`)

Manages the ad ship system:
*   Spawns and manages a pool of `AdShip` instances (`maxShips`).
*   Assigns movement patterns (orbiting for stations, linear for others) and parameters.
*   Handles simple distance-based collision avoidance (slowdown) between ships.
*   Recycles linear ships when they go out of bounds.
*   Rotates ads displayed on ships based on timers.
*   Contains the main `THREE.Group` holding all ad ships, added to the main scene.

### AdShip Class (`src/ads/AdShip.js`)

Represents a single ad ship:
*   Creates procedural placeholder mesh based on type (nasa, alien, station).
*   Creates a `PlaneGeometry` banner mesh.
*   Generates dynamic banner textures using the Canvas API based on `adData.title`.
*   Updates its internal state (e.g., station rotation).
*   Provides an `updateAd` method to change the displayed ad and regenerate the texture.
*   Stores `adData` in banner mesh `userData` for click detection.

### AdConfig File (`src/ads/adConfig.js`)

*   Exports a `mockAds` array containing ad objects (`{ title, url, ... }`).
*   (Currently uses dummy URLs).

### Utility Modules

*   **`holeShapes.js` (`src/utils/holeShapes.js`)**: Provides functions for generating various geometric shapes for hole boundaries:
    *   Circle and oval shapes with configurable segments
    *   Triangle, star, hexagon, and other polygons
    *   L-shape, T-shape, and cross configurations
    *   Kidney bean and figure-8 patterns
    *   Serpentine and zigzag paths
    *   All functions return arrays of THREE.Vector2 points defining shape perimeters

*   **`iOSOptimizations.js` (`src/utils/iOSOptimizations.js`)**: Comprehensive iOS performance optimization module:
    *   Device detection and capability assessment
    *   Adaptive quality settings based on device tier
    *   Dynamic resolution scaling for performance
    *   Physics optimization (reduced iterations, simplified collisions)
    *   Rendering optimization (LOD, shadow quality, texture resolution)
    *   Memory management and cleanup utilities
    *   Battery-aware performance throttling
    *   Frame rate targeting and dynamic adjustment

*   **`VisualEffectsManager` (`src/managers/VisualEffectsManager.js`)**: Enhanced visual effects system:
    *   Trail effects for ball movement with particle systems
    *   Impact effects for collisions with walls and obstacles
    *   Environmental particles (ambient dust, sparkles)
    *   Celebration animations for hole completion
    *   Power-up visual indicators
    *   Smooth effect transitions and lifecycle management
    *   Performance-aware effect scaling

// ... rest of Key Classes ...
