# API Reference - Mini Golf Break

*Last Updated: 2025-08-08*

This document provides a comprehensive API reference for the main components and systems in Mini Golf Break.

## Table of Contents

1. [Core Classes](#core-classes)
2. [Manager APIs](#manager-apis)
3. [Event System](#event-system)
4. [Game Objects](#game-objects)
5. [Physics System](#physics-system)
6. [UI Components](#ui-components)

## Core Classes

### Game

**Location**: `src/scenes/Game.js`

The main game coordinator that initializes and manages all game systems.

```javascript
class Game {
    constructor()
    
    // Initialization
    async init(): Promise<void>
    
    // Scene management
    createScene(): void
    createLighting(): void
    createStarfield(): void
    
    // Course management
    async createCourse(): Promise<void>
    
    // Game loop
    update(deltaTime: number): void
    render(): void
    
    // Cleanup
    cleanup(): void
    
    // Restart
    restartGame(): void
}
```

### Ball

**Location**: `src/objects/Ball.js`

Represents the golf ball with physics and visual components.

```javascript
class Ball {
    constructor(scene: THREE.Scene, physicsWorld: CANNON.World, eventManager: EventManager)
    
    // Properties
    mesh: THREE.Mesh
    body: CANNON.Body
    radius: number
    mass: number
    
    // Movement
    applyForce(force: CANNON.Vec3): void
    applyImpulse(impulse: CANNON.Vec3): void  // Alias for applyForce
    setPosition(x: number, y: number, z: number): void
    getPosition(): THREE.Vector3
    resetVelocity(): void
    
    // State
    isMoving(): boolean
    getVelocity(): number
    
    // Effects
    showSuccessEffect(): void
    handleHoleSuccess(): void
    
    // Update
    update(deltaTime: number): void
    updateMeshFromBody(): void
    
    // Cleanup
    cleanup(): void
}
```

## Manager APIs

### EventManager

**Location**: `src/events/EventManager.js`

Central event bus for component communication.

```javascript
class EventManager {
    // Publishing
    publish(eventType: string, data?: any, source?: string): void
    
    // Subscription
    subscribe(eventType: string, callback: Function): Function
    subscribeOnce(eventType: string, callback: Function): Function
    
    // Management
    unsubscribe(eventType: string, callback: Function): void
    clearEventType(eventType: string): void
    clearAll(): void
    
    // Debugging
    getEventHistory(): Array<GameEvent>
    getSubscriberCount(eventType: string): number
}
```

### StateManager

**Location**: `src/managers/StateManager.js`

Manages game state transitions.

```javascript
class StateManager {
    constructor(eventManager: EventManager)
    
    // State management
    getState(): string
    setState(newState: string): void
    
    // Game flow
    getCurrentHoleNumber(): number
    setCurrentHoleNumber(hole: number): void
    getTotalHoles(): number
    setTotalHoles(total: number): void
    
    // Completion tracking
    isHoleCompleted(): boolean
    setHoleCompleted(completed: boolean): void
    
    // Restart
    resetForNextHole(): void
    resetGame(): void
}
```

### BallManager

**Location**: `src/managers/BallManager.js`

Manages ball lifecycle and interactions.

```javascript
class BallManager {
    constructor(game: Game)
    
    // Ball management
    createBall(position: Vector3): Ball
    getBall(): Ball
    removeBall(): void
    
    // Actions
    hitBall(direction: Vector3, power: number): void
    resetBallPosition(position: Vector3): void
    
    // State
    isBallMoving(): boolean
    getBallPosition(): Vector3
    
    // Update
    update(deltaTime: number): void
    
    // Cleanup
    cleanup(): void
}
```

### UIManager

**Location**: `src/managers/UIManager.js`

Manages all UI elements and displays.

```javascript
class UIManager {
    constructor(game: Game)
    
    // Initialization
    init(): void
    
    // Messages
    showMessage(text: string, duration?: number): void
    hideMessage(): void
    
    // Power indicator
    showPowerIndicator(power: number): void
    hidePowerIndicator(): void
    
    // Score display
    updateScore(strokes: number, total: number): void
    showFinalScorecard(score: number): void
    
    // Debug
    updateDebugInfo(info: object): void
    
    // Cleanup
    cleanup(): void
}
```

### CameraController

**Location**: `src/controls/CameraController.js`

Manages camera positioning and movement.

```javascript
class CameraController {
    constructor(camera: THREE.Camera, domElement: HTMLElement)
    
    // Initialization
    init(eventManager: EventManager): void
    
    // Camera control
    positionForHole(ballPos: Vector3, holePos: Vector3): void
    followBall(ballPos: Vector3, velocity?: Vector3): void
    setTarget(target: Vector3): void
    
    // User interaction
    enableControls(): void
    disableControls(): void
    detectUserAdjustment(): boolean
    
    // Update
    update(deltaTime: number): void
    
    // Cleanup
    cleanup(): void
}
```

### PhysicsManager

**Location**: `src/managers/PhysicsManager.js`

Manages the physics simulation.

```javascript
class PhysicsManager {
    constructor(game: Game)
    
    // Properties
    world: CANNON.World
    materials: object
    
    // Initialization
    init(): void
    
    // Materials
    createMaterials(): void
    getGroundMaterial(): CANNON.Material
    getBallMaterial(): CANNON.Material
    
    // Bodies
    addBody(body: CANNON.Body): void
    removeBody(body: CANNON.Body): void
    
    // Update
    update(deltaTime: number): void
    
    // Cleanup
    cleanup(): void
}
```

## Event System

### Event Types

**Location**: `src/events/EventTypes.js`

```javascript
const EventTypes = {
    // Game state
    GAME_INITIALIZED: 'game_initialized',
    STATE_CHANGED: 'state_changed',
    GAME_COMPLETED: 'game_completed',
    
    // Ball events
    BALL_HIT: 'ball_hit',
    BALL_MOVED: 'ball_moved',
    BALL_STOPPED: 'ball_stopped',
    BALL_IN_HOLE: 'ball_in_hole',
    BALL_RESET: 'ball_reset',
    
    // Hole events
    HOLE_STARTED: 'hole_started',
    HOLE_COMPLETED: 'hole_completed',
    
    // Hazard events
    HAZARD_DETECTED: 'hazard_detected',
    
    // UI events
    UI_REQUEST_RESTART_GAME: 'ui_request_restart_game',
    UI_REQUEST_MAIN_MENU: 'ui_request_main_menu',
    
    // System events
    ERROR_OCCURRED: 'error_occurred',
    PERFORMANCE_WARNING: 'performance_warning'
};
```

### GameEvent

**Location**: `src/events/GameEvent.js`

```javascript
class GameEvent {
    constructor(type: string, data?: any, source?: string)
    
    // Properties
    type: string
    data: any
    source: string
    timestamp: number
    
    // Methods
    toString(): string
    toJSON(): object
}
```

## Game Objects

### HoleEntity

**Location**: `src/objects/HoleEntity.js`

Represents a single golf hole with all its components.

```javascript
class HoleEntity {
    constructor(scene: THREE.Scene, physicsWorld: CANNON.World, config: object)
    
    // Properties
    group: THREE.Group
    config: object
    meshes: Array<THREE.Mesh>
    bodies: Array<CANNON.Body>
    
    // Creation
    create(): void
    createGreen(): void
    createWalls(): void
    createHole(): void
    createHazards(): void
    
    // Getters
    getStartPosition(): Vector3
    getHolePosition(): Vector3
    getBounds(): object
    
    // Cleanup
    destroy(): void
}
```

### Course

**Location**: `src/objects/Course.js`

Base class for golf courses.

```javascript
class Course {
    constructor(scene: THREE.Scene, physicsWorld: CANNON.World)
    
    // Abstract methods (to be implemented by subclasses)
    create(): void
    getCurrentHole(): HoleEntity
    moveToNextHole(): boolean
    reset(): void
    
    // Common methods
    getTotalHoles(): number
    getCurrentHoleNumber(): number
    getHoleConfig(index: number): object
    
    // Cleanup
    cleanup(): void
}
```

### NineHoleCourse

**Location**: `src/objects/NineHoleCourse.js`

Full 9-hole golf course implementation.

```javascript
class NineHoleCourse extends Course {
    constructor(scene: THREE.Scene, physicsWorld: CANNON.World)
    
    // Hole management
    initializeHole(holeIndex: number): void
    clearCurrentHole(): void
    
    // Navigation
    moveToNextHole(): boolean
    moveToHole(holeNumber: number): void
    
    // Getters
    getCurrentHoleEntity(): HoleEntity
    getHoleGroup(index: number): THREE.Group
}
```

## Physics System

### PhysicsWorld

**Location**: `src/physics/PhysicsWorld.js`

Wrapper for CANNON physics world configuration.

```javascript
class PhysicsWorld {
    constructor()
    
    // Properties
    world: CANNON.World
    
    // Configuration
    static GRAVITY: number = -9.81
    static TIMESTEP: number = 1/60
    static MAX_SUBSTEPS: number = 3
    
    // Methods
    createWorld(): CANNON.World
    createGroundMaterial(): CANNON.Material
    createBallMaterial(): CANNON.Material
    createContactMaterial(mat1: CANNON.Material, mat2: CANNON.Material): CANNON.ContactMaterial
    
    // Body creation
    createSphereBody(radius: number, mass: number): CANNON.Body
    createBoxBody(size: Vector3, mass: number): CANNON.Body
    createTrimeshBody(geometry: THREE.Geometry): CANNON.Body
}
```

## UI Components

### UIScoreOverlay

**Location**: `src/managers/ui/UIScoreOverlay.js`

Manages score display overlay.

```javascript
class UIScoreOverlay {
    constructor(container: HTMLElement)
    
    // Display methods
    updateHoleName(name: string): void
    updateStrokes(strokes: number): void
    updateTotalStrokes(total: number): void
    showFinalScorecard(score: number, onRestart: Function, onMenu: Function): void
    hideFinalScorecard(): void
    
    // Visibility
    show(): void
    hide(): void
    
    // Cleanup
    cleanup(): void
}
```

### UIDebugOverlay

**Location**: `src/managers/ui/UIDebugOverlay.js`

Manages debug information overlay.

```javascript
class UIDebugOverlay {
    constructor(container: HTMLElement)
    
    // Update methods
    updateBallInfo(position: Vector3, velocity: number): void
    updatePhysicsInfo(bodies: number, constraints: number): void
    updatePerformanceInfo(fps: number, frameTime: number): void
    
    // Visibility
    show(): void
    hide(): void
    toggle(): void
    
    // Cleanup
    cleanup(): void
}
```

## Input System

### InputController

**Location**: `src/controls/InputController.js`

Handles user input for gameplay.

```javascript
class InputController {
    constructor(domElement: HTMLElement, camera: THREE.Camera)
    
    // Initialization
    init(ballManager: BallManager, cameraController: CameraController): void
    
    // Input state
    enable(): void
    disable(): void
    isEnabled(): boolean
    
    // Aiming
    startAiming(event: MouseEvent | TouchEvent): void
    updateAim(event: MouseEvent | TouchEvent): void
    endAiming(event: MouseEvent | TouchEvent): void
    
    // Power calculation
    calculatePower(distance: number): number
    
    // Visual feedback
    showAimLine(direction: Vector3, power: number): void
    hideAimLine(): void
    
    // Cleanup
    cleanup(): void
}
```

## Utility Functions

### Physics Utils

**Location**: `src/physics/utils.js`

```javascript
// Vector conversion
function cannonToThree(cannonVec: CANNON.Vec3): THREE.Vector3
function threeToCANNON(threeVec: THREE.Vector3): CANNON.Vec3

// Quaternion conversion
function cannonQuatToThree(cannonQuat: CANNON.Quaternion): THREE.Quaternion
function threeQuatToCannon(threeQuat: THREE.Quaternion): CANNON.Quaternion

// Physics calculations
function calculateDamping(velocity: number): number
function shouldSleep(velocity: number, angularVelocity: number): boolean
```

### Debug Utils

**Location**: `src/utils/debug.js`

```javascript
// Logging
function debugLog(message: string, data?: any): void
function debugWarn(message: string, data?: any): void
function debugError(message: string, error?: Error): void

// Performance
function measurePerformance(fn: Function, label: string): any
function startTimer(label: string): void
function endTimer(label: string): number

// Validation
function validateConfig(config: object, schema: object): boolean
function assertDefined(value: any, name: string): void
```

## Constants and Configuration

### Game Configuration

```javascript
// Game settings
const GAME_CONFIG = {
    physics: {
        gravity: -9.81,
        timestep: 1/60,
        maxSubSteps: 3,
        sleepSpeedLimit: 0.15,
        sleepTimeLimit: 0.2
    },
    ball: {
        radius: 0.5,
        mass: 0.45,
        linearDamping: 0.6,
        angularDamping: 0.6
    },
    camera: {
        fov: 75,
        near: 0.1,
        far: 1000,
        defaultHeight: 15,
        defaultDistance: 20
    },
    ui: {
        messageTimeout: 3000,
        scorecardAnimationDuration: 500
    }
};
```

### Collision Groups

```javascript
const CollisionGroups = {
    GROUND: 1,
    HOLE: 2,
    BALL: 4,
    WALLS: 8,
    HAZARDS: 16,
    TRIGGERS: 32
};
```

## Error Codes

```javascript
const ErrorCodes = {
    INITIALIZATION_FAILED: 'E001',
    PHYSICS_ERROR: 'E002',
    RENDERING_ERROR: 'E003',
    RESOURCE_LOAD_FAILED: 'E004',
    STATE_TRANSITION_ERROR: 'E005',
    INVALID_CONFIGURATION: 'E006'
};
```

## Usage Examples

### Creating and hitting a ball

```javascript
// Create ball
const ballManager = new BallManager(game);
const ball = ballManager.createBall({ x: 0, y: 1, z: -5 });

// Hit the ball
const direction = new THREE.Vector3(0, 0, 1).normalize();
const power = 0.7;
ballManager.hitBall(direction, power);
```

### Subscribing to events

```javascript
// Subscribe to ball events
eventManager.subscribe(EventTypes.BALL_STOPPED, (event) => {
    console.log('Ball stopped at:', event.data.position);
});

eventManager.subscribe(EventTypes.BALL_IN_HOLE, (event) => {
    console.log('Hole completed in', event.data.strokes, 'strokes');
});
```

### Managing camera

```javascript
// Position camera for hole
const ballPos = new THREE.Vector3(0, 0, -5);
const holePos = new THREE.Vector3(0, 0, 5);
cameraController.positionForHole(ballPos, holePos);

// Follow ball during movement
cameraController.followBall(ball.getPosition(), ball.getVelocityVector());
```

## Best Practices

1. **Always clean up resources** - Call `cleanup()` methods when destroying components
2. **Use events for cross-component communication** - Avoid direct coupling between managers
3. **Check initialization state** - Verify components are initialized before use
4. **Handle errors gracefully** - Use try-catch blocks and report errors via DebugManager
5. **Optimize update loops** - Only update what's necessary each frame
6. **Test on target devices** - Especially important for mobile/iOS features

---

For more detailed implementation examples, see the [Development Guide](development-guide.md).