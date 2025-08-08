# Changelog for Mini Golf Break

All notable changes to the Mini Golf Break project will be documented in this file.

## [Unreleased] - 2025-08-07

### Added
- **Enhanced Mobile Touch Controls:** Implemented comprehensive touch gesture support with intuitive mobile-first controls:
  - Pinch-to-zoom for camera distance adjustment
  - Two-finger drag for camera rotation
  - Long-press with direction arrow for aiming
  - Improved touch target sizing for mobile devices
  - Visual feedback for all touch interactions
- **Camera State Management System:** Created `CameraStateManager` for intelligent camera behavior:
  - Multiple camera view states (overview, aiming, following, close-up)
  - Smooth transitions between camera states
  - Automatic view selection based on game context
  - Persistent user preference tracking
- **Touch Camera Controller:** New `TouchCameraController` class for mobile-specific camera handling:
  - Natural touch gestures with momentum
  - Edge-based camera panning
  - Smart zoom boundaries
  - Haptic feedback integration
- **iOS Optimizations:** Comprehensive performance improvements for iOS devices:
  - Adaptive quality settings based on device capabilities
  - Dynamic resolution scaling
  - Optimized physics and rendering
  - Memory usage optimization
  - Battery-aware performance throttling
- **Hole Shape Utilities:** New `holeShapes.js` module for generating diverse hole geometries:
  - Circle, triangle, star, hexagon shapes
  - L-shape, T-shape, cross configurations
  - Kidney bean and figure-8 patterns
  - Procedural shape generation system
- **UI Camera Controls:** New overlay for manual camera control:
  - Pan, rotate, and zoom controls
  - Reset and preset view buttons
  - Mobile-optimized button layout
  - Auto-hide functionality
- **Visual Effects Enhancements:** Expanded `VisualEffectsManager` with new effects:
  - Trail effects for ball movement
  - Impact effects for collisions
  - Environmental particle systems
  - Improved celebration animations
- **Splash Screen Integration:** Native splash screen support for iOS app
- **Safe Area Support:** UI elements now respect device safe areas (notch, home indicator)

### Changed
- **Camera System Overhaul:** Complete redesign of camera positioning and movement:
  - Higher default camera angle for better course visibility
  - Improved framing to show entire hole
  - Better ball tracking during movement
  - Respects manual user adjustments
- **UI Responsiveness:** Improved UI layout for various screen sizes:
  - Flexible button positioning
  - Scalable font sizes
  - Touch-friendly spacing
  - Viewport-based sizing
- **Score Display:** Enhanced score overlay with better mobile visibility:
  - Larger, clearer text
  - Improved contrast
  - Better positioning for small screens
- **Input System:** Unified input handling for mouse and touch:
  - Consistent aiming mechanics
  - Improved shot power calculation
  - Better visual feedback

### Fixed
- **Mobile Performance:** Resolved frame rate issues on mobile devices
- **Touch Input:** Fixed inconsistent touch detection and gesture conflicts
- **Camera Jitter:** Eliminated camera shake during rapid movements
- **UI Scaling:** Fixed UI elements being cut off on small screens
- **Memory Leaks:** Fixed several memory leaks in effects and camera systems

### Technical
- Updated dependencies including Capacitor to 7.4.2
- Added comprehensive JSDoc documentation for new modules
- Improved test coverage for camera and touch systems

## [Unreleased] - 2025-04-12

### Added
- **iOS Build Capability:** Integrated Capacitor to allow building and running the web application as a native iOS app. Includes configuration for loading the live web URL (`minigolfbreak.com`) and necessary build steps.
- Added instructions for running on iOS to `README.md`.
- Added "Play FanFrenzy!" ad to the available ad pool (`src/ads/adConfig.js`).

### Fixed
- **Ad Rendering on iOS:** Resolved an issue where 3D ad banners (`AdShip.js`) were rendering behind the tee marker in the Capacitor iOS app by setting `depthWrite: true` on the banner material.
- **Viewport Scaling on iOS:** Corrected the viewport meta tag in `index.html` (`viewport-fit=cover`, `user-scalable=no`, `maximum-scale=1`) to prevent improper zooming/scaling within the iOS webview.

### Changed
- Updated `.gitignore` to include standard Capacitor and iOS build artifacts (though entries were already present).

## [Unreleased] - 2025-04-10

### Added
- **Feedback Form Integration:** Added feedback form functionality accessible through a dedicated ad ship.

### Changed
- **AdShip Path Routing:** Modified path generation for ships at the -5 level (closest to the course) to ensure they always pass behind the hole boundary:
  - Ships at the -5 level now follow horizontal paths (left-to-right or right-to-left) along the +Z axis
  - Restricted Z-position range to 30-40 units behind the hole to prevent obstruction of gameplay
  - Added custom path recycling logic specifically for ships at the -5 level
  - Reduced Z velocity variance for top-level ships to maintain consistent background paths
- **Ad URL Updates:** Removed "www." prefix from the ToneElevate.com URL.
- **Ad Click Handling:** Fixed ad click handling to properly route special URLs (like feedback form) through the AdShip's handleAdClick method.

### Fixed
- **Ad URL Navigation:** Fixed issue where clicking the feedback ad would navigate to "#feedback-form" instead of opening the feedback form.

## [Unreleased] - 2025-04-09

### Added
- **AdSense Integration:** Added standard Google AdSense script to `index.html` and a placeholder for a bottom banner ad unit (HTML overlay, separate from 3D AdShips).

### Changed
- **Hole 6 Layout:** Removed channel bumpers and narrowed water hazards.
- **Ball Physics:** Increased default linear/angular damping and adjusted sleep/stop thresholds for faster ball stopping.
- **AdShip Banners:** 
    - Changed to a standard, flat billboard style (long/narrow 5:1 plane) positioned dynamically above each ship.
    - Implemented dynamic rotation: Banners now rotate on their Y-axis to face the ball's position for better readability.
    - Updated banner texture generation (aspect ratio, font size, color, glow).
- **Ad Configuration:** Updated mock ad content and URLs in `adConfig.js` (Mostly Sports, ToneElevate, Feedback link).
- **Ad Click Handling:** Modified `InputController` to allow clicking on ad banners during normal gameplay (not restricted to AD_INSPECTING state). Clicks now open the URL and prevent the current shot.

### Fixed
- **Hole 8 Hazards:** Corrected size (`length`) of rectangular hazards to prevent them from extending outside course boundaries.
- **AdShip Spawning:** Fixed `ReferenceError: Can't find variable: geometry` in `AdShip.js` that prevented ships from spawning.
- **AdShip Banner Rotation:** Fixed issues with previous banner rotation attempts (`lookAt`, local rotation) to correctly face the ball while tilted.

### Internal
- Reverted multiple L-shape redesign attempts for Hole 9 back to its original configuration due to rendering issues with complex shapes/holes.

## [Unreleased] - 2025-04-06

### Added
- Ad Ship System Foundation:
    - Created `src/ads/AdShipManager.js` to manage ad ship lifecycle.
    - Created `src/ads/AdShip.js` to represent individual ad ships with placeholder geometry.
    - Created `src/ads/adConfig.js` with mock ad data.
    - Integrated `AdShipManager` into `Game.js` (init, update loop, cleanup) and added its group to the scene.
    - Updated `AdShip.js` to generate distinct placeholder meshes (NASA, Alien, Station) based on `shipType`.
    - Implemented dynamic canvas texture generation for ad banners in `AdShip.js` based on `adData.title`.
    - Scaled ad ships for better visibility.
    - Adjusted banner offsets in `AdShip.js` to prevent visual obstruction.
    - Implemented distinct movement patterns: orbiting for 'station', linear fly-through/recycling for 'nasa'/'alien'.
    - Added basic distance-based collision avoidance (ship slowdown) in `AdShipManager`.
    - Assigned unique vertical offsets (`ship.verticalOffset`) to ships for better 3D separation.
    - Implemented subtle camera target blending towards closest ad ship while ball is moving (`CameraController`).
    - Added `AD_INSPECTING` state to `GameState.js`.
    - Added key listener ('i') to `InputController` to toggle `AD_INSPECTING` state and camera orbit controls.
    - Implemented raycasting in `InputController._handleAdClick` to detect clicks on ad banners when in `AD_INSPECTING` state.
    - Added `adData` to `bannerMesh.userData` in `AdShip` for click identification.
- **Ad Ship System Optimization:**
    - Optimized `AdShipManager` collision check loop using squared distance checks.
    - Added comments documenting `maxShips` limit rationale and O(N^2) complexity.
    - Added basic distance check from origin for future visibility culling.

### Changed
- Ad ships now use canvas textures instead of image files.
- Ship movement is now orbital or linear based on type, replacing simple drift.
- Ship recycling/ad updates are handled differently for linear vs. orbital ships.
- Linear ships now receive a new random vertical offset upon recycling.
- Refactored `AdShipManager` to handle ad updates via `AdShip.updateAd`.
- **Architecture Refactor:**
    - Cleaned up dead code, comments, and unused variables/imports.
    - Refactored `UIManager` into orchestrator with `UIScoreOverlay` and `UIDebugOverlay` submodules.
    - Refactored `DebugManager` into orchestrator with `DebugErrorOverlay` and `DebugCourseUI` submodules.
- **UI Updates:**
    - Reordered score display: Hole Name, Strokes, Total Strokes.
    - Cleaned hole description text in UI.
    - Reduced log spam from UI updates.

### Fixed
- Ad ships disappearing after hole transition (marked `AdShipManager.group` as permanent).
- Various `AdShipManager` logic issues (scope, parameter passing).
- `CameraController` logic errors (`lengthSq`, `deltaTime`, ad focus reset).
- `InputController` state check error (`getGameState`).
- **Refactoring Errors:** Resolved multiple runtime errors from method name changes (`getTotalScore`, `getCurrentStrokes`, `setState`, `restartGame`, `updateScorecard`).
- **Hole Cleanup:** Fixed `NineHoleCourse` parent groups being removed by overriding `HoleEntity.destroy()`.
- **UI Logging:** Reduced excessive console logs from `UIScoreOverlay.updateStrokes`.

### Features
- (Retained from original 04-06 entry if applicable) Added initial scaffolding for `NineHoleCourse.js` to support a full 9-hole course structure, including `THREE.Group` containers for each hole.

### Debugging & Fixes
- (Retained from original 04-06 entry) Integrated `CannonDebugRenderer`, diagnosed/fixed floor collision, refactored hole detection logic, fixed UI displays, fixed physics world reset.

### Documentation
- (Retained from original 04-06 entry) Updated README, Project Checklist, and Dev Guide for physics debugging.
- **Documentation Pass (Phase 4):** Updated `docs/development-guide.md` with current architecture, system interactions, game flow, manager responsibilities, and `NineHoleCourse` status.

## [0.9.3] - Camera System Overhaul

### Enhanced Camera Positioning
- Completely redesigned camera positioning algorithm for better gameplay visibility
- Implemented much higher camera angle with proper framing of the entire hole
- Added extra space behind the ball to ensure adequate room for pull-back aiming
- Significantly increased camera height to provide a better course overview
- Adjusted camera position weighting to better center both the ball and hole

### Camera Behavior Improvements
- Added user camera adjustment detection to respect manual camera positioning
- Implemented smart camera reset only when the ball is hit or moving
- Added transition detection to ensure smooth camera behavior between states
- Enhanced camera target calculation for better hole visibility during gameplay
- Increased camera stability with improved parameter tuning

### Technical Improvements
- Refactored CameraController.js with cleaner positioning calculations
- Optimized camera position updates for smoother transitions
- Added explicit user adjustment tracking with the OrbitControls 'start' event
- Fixed camera repositioning logic to prevent jarring camera movements
- Improved camera height calculations based on course dimensions

## [0.9.2] - Camera & Physics Refinements

### Camera System Improvements
- Adjusted camera target logic to look slightly ahead of the ball (based on velocity when moving, towards the hole when stopped) for better course visibility.
- Implemented automatic high-angle initial view for each hole, ensuring tee and cup are framed correctly.
- Smoothed camera follow movement (reduced lerp factors) to reduce shakiness during ricochets and fast movements.

### Physics & Visual Enhancements
- Adjusted ball and hole proportions to be more realistic (Hole Radius ≈ 2.53 * Ball Radius).
- Added specific low-restitution physics material (`holeRimMaterial`) to the hole's edge/funnel to dampen bounces off the rim.
- Fixed visual representation of the hole cup to prevent green texture showing through the inside.

### Other
- Prevented hitting the ball while it is already moving.
- Fixed minor compilation errors in InputController.
- Increased default shot power multiplier.

## [0.9.1] - Code Cleanup and CSG Implementation

### Features & Fixes
- Implemented Constructive Solid Geometry (CSG) using `three-csg-ts` to create realistic cutouts for holes and sand traps in the green surface.
- Fixed Z-fighting issues between green, hole visuals, and sand traps.
- Corrected vertex normal calculations on CSG-generated meshes to resolve lighting artifacts.
- Simplified the final scorecard UI to show only total strokes.

### Refactoring & Cleanup
- Removed dead code, including unused event types (`PHYSICS_UPDATED`, `COLLISION_DETECTED`, `UI_ACTION`, `AUDIO_PLAY`, `EFFECT_STARTED`, `EFFECT_COMPLETED`, `WINDOW_RESIZED`) and unused game states (`BALL_IN_MOTION`, `TRANSITIONING`, `PAUSED`).
- Removed unused `ScorecardComponent.js` file and logic.
- Removed redundant `TeeMarker.js` file and logic, relying solely on markers created by `HoleEntity`.
- Removed legacy/unused methods from `Game.js` (`moveToNextHole`, `resetHole`).
- Consolidated `BALL_IN_HOLE` event handling logic into `HoleCompletionManager`.
- Corrected typo `GAME_STATE_CHANGED` to `STATE_CHANGED` in `StateManager.js`.
- Removed potentially unused CSS rules (`.power-indicator-active`, `.debug-info`).
- Ensured proper cleanup of the `resize` event listener in `Game.js`.

## [0.9.0] - Hole Management System Refactor

### Architecture Improvements
- Split monolithic HoleManager into specialized components:
  - HoleStateManager for state tracking
  - HoleTransitionManager for hole transitions
  - HoleCompletionManager for completion logic
- Implemented vertical hole stacking with disappearing completed holes
- Added ball fall animation between holes
- Enhanced hole completion with fade-out animation

### Visual Enhancements
- Added hole disappearing animation with fade-out and scale
- Improved hole transition visuals with ball fall effect
- Enhanced visual feedback for hole completion
- Updated camera behavior for vertical course layout

### Technical Improvements
- Improved event system integration for hole management
- Enhanced state tracking with dedicated managers
- Added proper cleanup for completed holes
- Implemented better error handling in managers
- Updated documentation structure and organization

## [0.8.5] - Course Surface Visualization Fix

### Visual Improvements
- Fixed gray area issue appearing at the ends of each hole by implementing a unified green surface
- Corrected hole visibility and accessibility with proper alignment of hole components
- Eliminated overlap of course elements with space background for cleaner visuals
- Enhanced contrast with brighter green surface color for better visibility
- Fixed wall intersection alignment issues to create flush corners between vertical and horizontal walls
- Fixed gaps at wall intersections by ensuring side walls extend fully to match front and back walls

### Structural Changes
- Simplified course layout by replacing separate fairway and green surfaces with a single unified green
- Extended course boundaries to provide more space behind both tee and hole positions
- Adjusted hole depth and positioning for more reliable ball detection and entry
- Improved hole physics with properly aligned funnel effect and trigger zones
- Ensured course components remain within defined hole boundaries
- Fixed wall sizing to create perfectly flush corners at boundary intersections
- Precisely calculated side wall length to exactly match the distance between front and back walls

### Technical Improvements
- Reorganized course creation code with clearer component separation
- Increased course length from 16.5 to 20 units for better playability
- Created position-specific walls that properly follow tee and hole locations
- Ensured proper z-ordering of surfaces to prevent z-fighting visual artifacts
- Optimized physics body placement for better collision detection
- Added slight elevation to the green surface to ensure visibility above the space background
- Created a dedicated variable for horizontal wall width calculation to ensure consistency
- Added precise side wall center calculation to ensure perfect alignment with front and back walls

## [0.8.4] - Architectural Standardization

### Codebase Standardization
- Implemented consistent initialization patterns across all components
- Added standardized error handling in CameraController, InputController, BallManager, and Game
- Created proper isInitialized flags to prevent multiple initialization
- Implemented tiered initialization in Game.js to better handle component dependencies
- Enhanced cleanup processes with structured component teardown

### Documentation
- Created comprehensive architecture-standards.md document outlining best practices
- Documented standard initialization patterns with code examples
- Defined initialization order for components based on dependencies
- Standardized event-based communication patterns
- Detailed proper error handling strategies with severity levels
- Outlined cleanup patterns to prevent memory leaks

### Robustness Improvements
- Added proper null-checking throughout the codebase
- Enhanced error detection and reporting in key components
- Improved event listener cleanup to prevent memory leaks
- Added structured try-catch blocks in critical operations
- Implemented consistent method return values for better predictability

## [0.8.3] - Improved EventManager Error Handling

### Error Handling Enhancements
- Significantly enhanced error handling in EventManager's publish() method
- Implemented context-rich error reporting through the DebugManager
- Added intelligent UI error display for critical gameplay events
- Integrated event error reporting with system-wide error handling
- Added automatic object simplification for more readable error logs

### Developer Experience
- Improved debugging capabilities with comprehensive error context
- Added source object identification in error reporting
- Implemented error propagation through ERROR_OCCURRED events
- Created fallback console logging when DebugManager is unavailable
- Added protection against infinite error loops

### Testing & Documentation
- Added comprehensive EventManagerErrorHandlingTest.js to validate error handling
- Included tests for various error scenarios and data complexity conditions
- Added extensive documentation for new error handling methods

## [0.8.2] - Physics Parameters Standardization

### Physics Consistency Improvements
- Standardized sleep parameters across all components (Ball.js and PhysicsWorld.js) to match documented values
- Updated PhysicsWorld's default sleep parameters (sleepSpeedLimit: 0.15, sleepTimeLimit: 0.2)
- Fixed sleep parameter inconsistencies in createSphereBody() method to align with documentation
- Adjusted max sub-steps parameter from 8 to 3 to match the physics specifications
- Corrected solver iterations from 30 to 10 to align with the official physics parameters document

### Documentation Updates
- Updated Implementation Notes in physics-parameters.md to reflect consistent parameter usage
- Added explicit documentation of world configuration parameters
- Enhanced clarity about sleep parameter consistency across components

## [0.8.1] - Enhanced Error Handling in PerformanceManager

### Robustness Improvements
- Added comprehensive null checking in the `PerformanceManager` to prevent runtime errors
- Implemented a `safelyGet()` utility method for safely traversing potentially undefined object paths
- Enhanced error handling throughout the manager to gracefully handle missing dependencies
- Improved event listener cleanup to prevent memory leaks
- Added try/catch blocks in critical sections to ensure operation continuity during errors

### Performance & Stability
- Performance monitoring now properly degrades functionality when components are unavailable
- Added detailed error logging to help diagnose initialization issues
- Protected the game loop from potential errors in the performance monitoring system
- Implemented safe default values for all metrics when data sources are inaccessible

## [0.8.0] - Performance Monitoring and Optimization

### Performance Monitoring System
- Implemented dedicated `PerformanceManager` class for comprehensive performance tracking
- Added real-time metrics for FPS, frame times, and component timing
- Created visual performance display with color-coded warnings
- Implemented performance budgets with automated threshold enforcement
- Added memory usage tracking and object count monitoring

### Performance Instrumentation
- Added precise timing for physics, rendering, ball updates, effects, and camera operations
- Integrated performance tracking within the game loop
- Created circular buffer system for maintaining performance history with minimal overhead
- Added detection and reporting of performance budget violations

### Performance Visualization
- Implemented toggleable performance overlay with 'p' key
- Added color-coded metrics to easily identify performance issues
- Created comprehensive performance documentation

### Integration with Existing Systems
- Enhanced `GameLoopManager` to utilize performance timing
- Updated `DebugManager` to incorporate performance metrics in the debug display
- Added proper cleanup for performance monitoring resources

## [0.7.1] - Bug Fixes and API Consistency

### Bug Fixes
- Added missing `getTeePosition()` method to `BasicCourse` class to fix runtime error
- Fixed missing `ScorecardComponent` references in `UIManager`
- Added `applyImpulse()` method to `Ball` class as an alias for `applyForce()` for compatibility with `BallManager`
- Corrected method name reference in `UIManager` from `getTotalStrokes()` to `getTotalScore()`

### Documentation
- Created comprehensive Ball API documentation in `docs/ball-api.md`
- Updated Physics Parameters documentation to clarify force application methods
- Improved inline documentation for the Ball class methods

## [0.7.0] - Event-Driven Architecture Implementation

### Event System Core
- Designed and implemented a robust event-driven architecture to reduce component coupling
- Created `EventManager` to serve as a central message bus for component communication
- Added `EventTypes` enum for standardized event naming across the codebase
- Implemented `GameEvent` class with type, data, source, and timestamp properties
- Added thorough event logging for debugging and troubleshooting

### Component Decoupling
- Refactored key managers to communicate through events instead of direct method calls
- Updated `BallManager` to publish events for ball creation, movement, and state changes
- Modified `HazardManager` to listen for ball events and publish hazard detection events
- Converted `HoleManager` to publish hole completion events rather than directly updating UI
- Transformed `InputController` to respond to game state events for enabling/disabling input
- Updated `UIManager` to subscribe to game events for responsive UI updates

### Architectural Improvements
- Reduced tight coupling between game components for improved scalability
- Created a event subscription system with context preservation and clean-up helpers
- Implemented event history tracking for improved debugging and state reconstruction
- Added the ability to temporarily disable events during sensitive operations
- Enhanced error handling within event listeners with proper error boundaries

### Developer Experience
- Added comprehensive event debugging features to trace event flow through the system
- Improved code maintainability by standardizing component communication patterns
- Enhanced testability by allowing event interception and simulation
- Simplified adding new game features by leveraging the event-driven architecture
- Documented event types and their publishers/subscribers for future development

## [0.6.2] - Error Handling and Reporting Improvements

### Enhanced Error Handling System
- Enhanced DebugManager with explicit error, warning, and info reporting methods
- Added centralized error tracking to prevent console spam from repeated errors
- Implemented critical error UI display for gameplay-affecting issues
- Added detailed source identification for all error messages
- Created comprehensive error severity classification system

### Error Handling Implementation
- Updated Ball.js with comprehensive error handling and context-rich messages
- Enhanced BallManager hit detection with clear failure reporting
- Improved PhysicsManager with protected update method and better error context
- Added detailed error handling to UIManager for renderer attachment
- Protected cleanup methods with try-catch blocks

### Developer Tools
- Created new Error Handling Guidelines document with best practices
- Added error statistics to debug display
- Implemented auto-suppression of repeated identical errors
- Enhanced error messages with relevant parameter values
- Added fallback error handling for when DebugManager is not available

## [0.6.1] - Physics Documentation Harmonization

### Physics Parameter Documentation
- Created new `physics-parameters.md` document as a comprehensive reference for all physics values
- Updated `physics-specs.md` to include specific parameter values matching implementation
- Harmonized ball mass property in code to consistently use 0.45kg throughout
- Resolved discrepancies between documented values and actual implementation
- Improved physics documentation with detailed descriptions of all parameters
- Added explicit references between technical specifications and implementation

## [0.6.0] - Game Loop Optimization and Manager Architecture

### Game Loop Optimization
- Completely refactored the main game loop for significantly improved modularity and maintainability
- Created dedicated `GameLoopManager` to orchestrate the update sequence with clear dependencies
- Eliminated direct handling of multiple concerns in the main Game class
- Improved update sequencing with explicit ordering of manager calls
- Enhanced performance by optimizing the update flow

### New Manager Classes
- Added `BallManager` to centralize all ball-related operations
- Added `HazardManager` to handle detection and response to water and out-of-bounds situations
- Added `HoleManager` to encapsulate hole completion logic and advancement
- Implemented consistent interface across all managers (init, update, cleanup)

### Architecture Improvements
- Restructured Game.js to act as a coordinator rather than handling direct implementation
- Implemented cleaner dependency management between systems
- Improved error handling and graceful fallbacks throughout manager classes
- Enhanced resource cleanup with systematic manager shutdown sequence
- Simplified testing with better isolation of components

### Code Quality
- Improved consistency of method signatures and naming across manager classes
- Enhanced documentation with clear explanations of manager responsibilities
- Standardized event flow and state management between components
- Reduced code duplication by consolidating common functionality
- Improved debug logging with consistent patterns

## [0.5.0] - Visual Theme and Enhanced Completion Experience

### Visual Transformation
- Reimagined the game with a clean, atmospheric environment
- Added subtle background elements for improved visual depth
- Implemented accent lighting to create atmosphere
- Changed course colors to use emissive materials for better visibility
- Added contrasting bright green fairway with darker border for clear visibility
- Enhanced ball with subtle glow effect to maintain visibility

### Single-Hole Focus
- Simplified the game to focus on a single, perfectly crafted hole
- Removed multi-hole course structure to create a more focused experience
- Updated course generation to create a clean, minimalist platform for the hole
- Modified all references and UI to support the single-hole gameplay loop
- Improved hole completion flow with immediate restart option

### Enhanced Completion Experience
- Added animated scorecard that appears when completing the hole
- Implemented score counter animation with sound effects for each increment
- Created particle burst effect when the ball goes in the hole
- Added pulsing glow effect for the ball upon success
- Implemented click-to-restart functionality after hole completion
- Enhanced visual hierarchy on the scorecard with clear typography and spacing

### Audio Implementation
- Added sound system with Web Audio API integration
- Implemented hit sound with volume variation based on shot power
- Created success sound effect with rising pitch for hole completion
- Added subtle audio feedback for UI interactions
- Implemented sound functions with volume control for all game events

### Optimizations
- Removed unnecessary course elements for cleaner visual design
- Streamlined game flow for quicker restart after completion
- Enhanced ball-hole physics interaction for more reliable detection
- Improved lighting performance with optimized shadow settings
- Simplified scoring system for single-hole experience

## [0.4.1] - Code Modularization and Refactoring

### Architecture Improvements
- Modularized camera and scoring logic for better maintainability
- Created dedicated `CameraController` class to encapsulate all camera-related functionality
- Created dedicated `ScoringSystem` class to handle score tracking and display
- Improved code organization with clear separation of concerns
- Reduced complexity of Game.js by moving specialized functionality to dedicated modules
- Added comprehensive test suite to validate modularization

### Technical Debt Reduction
- Removed redundant GolfBall.js file that contained duplicate functionality already present in Ball.js
- Streamlined codebase for better readability and maintainability
- Enhanced documentation with clearer method documentation
- Improved class interfaces with fluent method chaining

## [0.4.0] - Visual and Layout Improvement

### Hole Visuals and Layout Improvements
- Simplified hole layout by removing extraneous decorative elements
- Created a minimal hole enclosure with only essential boundary walls
- Enhanced tee marker visibility with a clear blue platform and white center dot
- Ensured the ball is always white and positioned correctly on the tee
- Improved visual clarity by removing unnecessary brick elements
- Fixed course loading to ensure only the intended hole structure loads

### Ball Positioning and Appearance
- Fixed ball placement to align properly with the visible tee marker
- Ensured consistent white ball color throughout gameplay
- Added explicit material reset when positioning ball for a new hole
- Improved ball-to-tee visual coherence

### Code Refactoring
- Created new `createMinimalHoleEnclosure` method for cleaner hole boundaries
- Updated `loadHole` method to properly handle hole number selection
- Enhanced tee marker representation for better visibility
- Simplified decorative elements to reduce visual clutter
- Removed redundant GolfBall.js file that contained duplicate functionality already present in Ball.js

## [0.3.9] - Camera Positioning and First Hole Focus

### Camera System Improvements
- Fixed critical issue where camera wasn't properly positioned on first course play
- Implemented reliable camera initialization sequence with proper timing
- Added explicit camera positioning with delay to ensure everything is loaded
- Enhanced camera debugging with detailed position and target logging
- Removed dependency on TextGeometry for tee markers, using simple mesh shapes instead

### Gameplay Focus Enhancements
- Modified course loading to focus exclusively on perfecting hole 1
- Improved camera target system to balance between ball and hole visibility
- Reduced camera height and distance for better visibility during gameplay
- Enhanced ball-to-hole direction calculation for better aim assistance
- Fixed camera follow behavior to maintain better orientation toward the hole

### Technical Improvements
- Added comprehensive camera debugging system with detailed logging
- Fixed potential NaN issues in camera positioning calculations
- Implemented multi-stage camera setup process for more reliable positioning
- Added protective checks for all camera position calculations

## [0.3.8] - Hole Visibility and Ball Interaction Improvements

### Enhanced Hole Visibility
- Added visible rim around each hole with distinct darker color (0x222222)
- Implemented proper 3D hole representation with cylindrical geometry
- Added dark circular area inside hole for better visual depth perception
- Improved hole collision detection for more accurate gameplay

### Ball and Hole Interaction
- Created better ball-hole detection system with distance-based checking
- Implemented ball success state with green glow effect when in hole
- Added proper ball position validation against hole coordinates
- Fixed interaction between ball physics and hole geometry

### Course Layout Refinements
- Reduced fairway width and length for more realistic mini-golf feel
- Updated hole design parameters for proper scale (3.5-4m width instead of 5-6m)
- Made obstacles smaller and more appropriately sized for the course
- Enhanced tee marker with 3D tee post and improved visibility

### Gameplay Improvements
- Fixed issue where the hole and ball weren't properly aligned
- Improved ball reset logic to prevent collision with walls
- Enhanced shot detection with more reliable validation
- Added proper ball state tracking for current hole

## [0.3.7] - Course Rendering Alignment Fix

### Course Layout Fixes
- Fixed critical issue where hole and ball were rendering in separate areas
- Standardized hole coordinates to place all holes at origin (0,0,0)
- Updated all start positions to use consistent coordinates relative to current hole
- Ensured proper alignment between ball starting position, fairway, and hole
- Made all holes render in the same playable area for consistent gameplay

## [0.3.6] - Hole Layout and Ball Positioning Fixes

### Course Layout Improvements
- Fixed issue where ball was incorrectly starting in a position detected as water
- Reduced overall ground plane size to better match actual playable area
- Modified water hazard detection boundaries to prevent false positives
- Added opening in the front wall of each hole to allow proper tee access
- Updated ball starting positions to avoid wall collisions
- Improved console logging for out-of-bounds situations

## [0.3.5] - BasicCourse Loading Optimization

### Course Loading Improvements
- Fixed issue where BasicCourse was loading all three holes simultaneously
- Implemented dynamic hole loading system that only loads the current active hole
- Added tracking system for hole-specific objects and physics bodies for proper cleanup
- Significantly improved performance by reducing the number of objects in the scene
- Enhanced modularity to allow for more diverse hole designs without spatial constraints

## [0.3.4] - Camera and Input Timing Fixes

### Camera Improvements
- Fixed camera positioning to properly show the hole from the starting position
- Added intelligent hole position detection for different course layouts
- Implemented better target point selection between ball and hole

### Input Protection Enhancements
- Improved timing of input enabling after "Welcome to Hole" messages
- Added longer delay for hole transition messages to ensure proper setup
- Significantly improved user experience by ensuring input is only available when truly ready

## [0.3.3] - UI and Scoring Improvements

### User Interface Fixes
- Fixed overlap between pause button and score display
- Improved layout of UI elements with proper positioning
- Enhanced pointer event handling for UI overlay

### Scoring System Enhancements
- Added stroke counting for each shot
- Implemented proper score tracking that increments on each hit
- Enhanced score display to show both current hole score and running total score
- Fixed score reset when progressing to new holes while maintaining total score

## [0.3.2] - Input Handling Improvements

### Input Protection
- Added protection against accidental shots during hole transitions
- Disabled input while hole start messages are displayed
- Added a cooldown period after camera positioning to ensure full setup before allowing shots

### UI Improvements
- Added a "Ready" indicator that appears when input is enabled
- Visual feedback helps players know when they can start their shot
- Improved coordination between message display and input state

## [0.3.1] - Course and Camera Improvements

### Course Enhancements
- Fully enclosed each hole with wooden barriers to prevent the ball from falling off the course
- Added front boundary walls to complete the hole enclosures

### Camera System Improvements
- Implemented intelligent camera positioning that places the camera behind the ball looking towards the hole
- Customized camera angles for each specific hole design
- Enhanced aiming view to provide better orientation for players

## [0.3.0] - Menu Updates and 3-Hole Course Implementation

### Menu System Updates
- Updated Start Menu UI to include:
  - Renamed "Start Game" to "Start Practice" for sandbox play mode
  - Added "Play Basic Course" button to launch the 3-hole test course
  - Applied consistent UI styling following the Graphics & Visual Style Guide
  - Implemented proper button action and UI state management

### Basic Course Implementation
- Created a structured 3-hole test course:
  - Hole 1: Simple straight path to validate basic putting mechanics
  - Hole 2: Added obstacles including sand traps and barriers
  - Hole 3: Implemented elevation changes with a sloped section
- Added hole progression system with:
  - Per-hole scoring
  - Automatic advancement between holes
  - Course completion screen with total score
- Implemented fairway paths with visual distinction from rough areas
- Added tee markers at each hole's starting position
- Enhanced hole boundaries with decorative walls

### Code Architecture Updates
- Created new `BasicCourse` class extending the `Course` class
- Added game mode support to switch between practice and course play
- Implemented multi-hole navigation with proper ball positioning
- Added camera positioning specific to each hole

## [0.2.0] - UI and Physics Refinement

### Menu System
- Added start menu screen with game instructions
- Implemented pause functionality with menu overlay
- Created seamless transition between menu and gameplay
- Added resume game option during pause

### Physics Refinements
- Optimized ball physics for more natural movement
- Increased ground friction from 0.4 to 0.8 for better control
- Adjusted ball mass to 0.45kg for improved handling
- Enhanced damping system:
  - Increased linear and angular damping to 0.6
  - Added progressive damping (0.9) for final roll
  - Improved sleep detection for smoother stopping
- Fine-tuned solver parameters:
  - Increased iterations to 30 for stability
  - Enhanced precision with 0.0001 tolerance
  - Added 8 substeps for smoother motion

## [0.1.0] - Initial Development Phase

### Project Setup
- Created basic project structure following modular JavaScript architecture
- Set up Webpack for bundling and build process
- Configured Three.js and Cannon-es physics engine
- Established initial HTML/CSS layout with responsive design

### Core Systems Development
- Implemented `PhysicsWorld` class for managing physics simulation with Cannon-es
- Created `Game` class as the main controller for game state and scene management
- Developed `Ball` class with physics integration and visual representation
- Built `Course` class for terrain, obstacles, and hole placement
- Added `InputController` for handling mouse/touch input for ball striking

### Physics Implementation
- Configured collision detection between ball, course elements, and holes
- Set up material properties for proper friction and rebound behavior
- Implemented gravity and physics timestep management
- Added sleepState detection for determining when the ball has stopped moving

### Gameplay Features
- Created drag-and-release mechanic for hitting the ball
- Implemented power indicator showing shot strength
- Added visual aim line showing shot trajectory
- Developed hole detection system for recognizing successful putts
- Implemented basic scoring system
- Created water hazard detection and penalty system
- Added system for tracking and respawning at last safe position

### Camera and Controls
- Implemented orbit camera controls using Three.js OrbitControls
- Created system to follow the ball while in motion
- Added camera positioning for optimal viewing angle during shots
- Implemented camera controls toggle during shot preparation

### Visual Elements
- Designed minimalist golf course with grass texture
- Created visual representations for holes, flags, and obstacles
- Implemented shadows and lighting for better visual appeal
- Added power indicator and directional guide for shot feedback

### Bug Fixes and Refinements
- Fixed issues with hole collision detection
- Resolved camera movement conflicts during drag action
- Fixed physics integration issues with the ball
- Improved ball and camera positioning logic
- Enhanced power indicator responsiveness
- Fixed direction calculation for intuitive shot control

### Development Tools
- Added debug mode toggle (press 'd' key) for development
- Implemented debug visualization of physics bodies
- Added console logging for tracking ball velocity and position
- Created utility functions for streamlined development

## [Unreleased]

### Added
- Enhanced camera system that actively follows the ball, not just changing the orbit center
- Improved camera positioning based on ball movement direction and speed
- Adjusted viewport to shift down by 15% to show more of the course and less starfield
- More responsive and natural-feeling camera transitions between holes

### Changed
// ... existing code ... 