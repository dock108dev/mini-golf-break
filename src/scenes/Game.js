import * as THREE from 'three';
import { InputController } from '../controls/InputController';
import { CameraController } from '../controls/CameraController';
import { ScoringSystem } from '../game/ScoringSystem';
import { SpaceDecorations } from '../objects/SpaceDecorations';
import { StarField } from '../objects/StarField';
import { EventTypes } from '../events/EventTypes';
import { GameState } from '../states/GameState';
import { CannonDebugRenderer } from '../utils/CannonDebugRenderer';
import { debug } from '../utils/debug';
import { reloadPage } from '../utils/navigation';
import { validateCourse } from '../utils/holeValidator';
import {
  initCalibration,
  isCalibrationActive,
  recordHoleStrokes,
  showCalibrationOverlay
} from '../utils/parCalibration';

// Import managers
import { StateManager } from '../managers/StateManager';
import { UIManager } from '../managers/UIManager';
import { PhysicsManager } from '../managers/PhysicsManager';
import { DebugManager } from '../managers/DebugManager';
import { AudioManager } from '../managers/AudioManager';
import { VisualEffectsManager } from '../managers/VisualEffectsManager';
import { BallManager } from '../managers/BallManager';
import { HazardManager } from '../managers/HazardManager';
import { HoleStateManager } from '../managers/HoleStateManager';
import { HoleTransitionManager } from '../managers/HoleTransitionManager';
import { HoleCompletionManager } from '../managers/HoleCompletionManager';
import { GameLoopManager } from '../managers/GameLoopManager';
import { EventManager } from '../managers/EventManager';
import { PerformanceManager } from '../managers/PerformanceManager';
import { WebGLContextManager } from '../managers/WebGLContextManager';
import { StuckBallManager } from '../managers/StuckBallManager';
import { HoleFlyoverManager } from '../managers/HoleFlyoverManager';

/**
 * Game - Main class that orchestrates the mini-golf game
 * Uses a component-based architecture with dedicated managers for different concerns
 */
export class Game {
  constructor(options = {}) {
    this.CourseClass = options.courseClass || null;
    this.courseName = options.courseName || 'Orbital Drift';

    // Core Three.js components
    this.scene = new THREE.Scene();
    this.renderer = null; // Will be initialized in init()

    // Create managers
    this.debugManager = new DebugManager(this);
    this.eventManager = new EventManager(this);
    this.performanceManager = new PerformanceManager(this);
    this.stateManager = new StateManager(this);
    this.uiManager = new UIManager(this);
    this.physicsManager = new PhysicsManager(this);
    this.audioManager = new AudioManager(this);
    this.visualEffectsManager = new VisualEffectsManager(this);
    this.ballManager = new BallManager(this);
    this.hazardManager = new HazardManager(this);
    this.holeStateManager = new HoleStateManager(this);
    this.holeTransitionManager = new HoleTransitionManager(this);
    this.holeCompletionManager = new HoleCompletionManager(this);
    this.gameLoopManager = new GameLoopManager(this);
    this.stuckBallManager = new StuckBallManager(this);
    this.holeFlyoverManager = new HoleFlyoverManager(this);
    this.webGLContextManager = new WebGLContextManager(this);

    this.cannonDebugRenderer = null;
    this.composer = null;

    // Create camera controller
    this.cameraController = new CameraController(this);
    this.camera = this.cameraController.camera;

    // Create scoring system
    this.scoringSystem = new ScoringSystem(this);

    // Game objects (these aren't managers but specific game elements)
    this.course = null;
    this.spaceDecorations = null;
    this.starField = null;

    // Pause state
    this.prePauseState = null;
    this.boundHandlePauseKey = null;

    // Lighting
    this.lights = {
      ambient: null,
      directionalLight: null
    };

    // Performance tracking
    this.clock = new THREE.Clock();
    this.deltaTime = 0;

    // Store bound event handlers
    this.boundHandleResize = null;
  }

  /**
   * Initialize visual systems only (renderer, scene, lights, starfield, decorations).
   * Called on page load so the welcome screen has a visual backdrop.
   */
  async initVisuals() {
    try {
      // Setup renderer first
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setClearColor(0x000000); // Black background for space

      // Initialize WebGL context loss handling
      this.webGLContextManager.init();

      // First tier - Core systems that don't depend on others
      this.debugManager.init();
      this.eventManager.init();

      // Second tier - Systems that depend only on core systems
      this.performanceManager.init();
      this.stateManager.resetState();

      // Attach renderer to DOM via UI manager
      this.uiManager.init();
      this.uiManager.attachRenderer(this.renderer);

      // Set the scene background to black for space environment
      this.scene.background = new THREE.Color(0x000000);

      // Create starfield for space environment
      this.createStarfield();

      // Initialize camera controller after renderer is created
      this.cameraController.setRenderer(this.renderer);
      this.cameraController.init();

      // Setup lights
      this.setupLights();

      // Add space decorations
      this.spaceDecorations = new SpaceDecorations(this.scene);
      this.spaceDecorations.init();

      // Add window resize listener
      try {
        this.boundHandleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.boundHandleResize);
      } catch (error) {
        this.debugManager.warn('Game.init', 'Failed to add resize event listener', error);
      }

      // Bloom post-processing (non-blocking — falls back to direct render if unavailable)
      await this._initBloom();

      // Start the render loop so the backdrop is visible behind the menu
      this.gameLoopManager.init();
      this.gameLoopManager.startLoop();

      debug.log('[Game.initVisuals] Visual systems initialized.');
    } catch (error) {
      this.debugManager.error('Game.initVisuals', 'Failed to initialize visuals', error, true);
      console.error('CRITICAL: Failed to initialize visuals:', error);
      throw error; // Propagate so App.initVisuals() can show error UI
    }
  }

  /**
   * Initialize gameplay systems (physics, course, ball, input) and start the game.
   * Called when the player clicks Play/Start.
   */
  async startGame() {
    try {
      // Stop the menu backdrop camera orbit
      this.cameraController.stopMenuOrbit();

      // Initialize game systems that depend on UI and rendering
      this.visualEffectsManager.init();
      this.physicsManager.init();
      this.audioManager.init();

      // Initialize the CannonDebugRenderer after physics manager
      this.cannonDebugRenderer = new CannonDebugRenderer(
        this.scene,
        this.physicsManager.cannonWorld
      );

      // Game object managers that depend on physics and scene
      this.holeCompletionManager.init();
      this.hazardManager.init();
      this.visualEffectsManager.init();

      debug.log('[Game.startGame] Awaiting createCourse...');
      await this.createCourse();
      debug.log('[Game.startGame] createCourse finished.');

      // Set max strokes and OOB bounds for the first hole
      if (this.course) {
        const config = this.course.getCurrentHoleConfig();
        if (config) {
          if (this.scoringSystem) {
            this.scoringSystem.setMaxStrokes(config.par, config.maxStrokes);
          }
          this.hazardManager.setHoleBounds(config);
        }
        this.updateLightingForTheme(config?.theme);
        if (this.spaceDecorations && config?.theme) {
          this.spaceDecorations.setThemeVariant(config.theme);
        }
      }

      // Initialize the ball manager after the course is created
      this.ballManager.init();

      // Initialize stuck ball detection
      this.stuckBallManager.init();

      // Initialize hole flyover and hole-level state machine
      this.holeFlyoverManager.init();

      // Create input controller - depends on camera and ball
      this.inputController = new InputController(this);
      this.inputController.init();

      // Update UI with initial state
      this.uiManager.updateHoleInfo();
      this.uiManager.updateScore();
      this.uiManager.updateStrokes();

      // Initialize par calibration harness (dev-mode only, URL-param gated)
      initCalibration(this.courseName.toLowerCase().replace(/\s+/g, '_'));

      this.eventManager.publish(EventTypes.GAME_STARTED, { timestamp: Date.now() }, this);
      this.debugManager.log('Game initialized');
      this.setupEventListeners();

      this.stateManager.setGameState(GameState.PLAYING);
      this.eventManager.publish(EventTypes.GAME_INITIALIZED, { timestamp: Date.now() }, this);
    } catch (error) {
      this.debugManager.error('Game.startGame', 'Failed to start game', error, true);
      console.error('CRITICAL: Failed to start game:', error);
      this.eventManager?.publish(EventTypes.ERROR_OCCURRED, {
        source: 'Game.startGame',
        error: error.message,
        fatal: true
      });
    }
  }

  /**
   * Set up UnrealBloomPass via EffectComposer. Falls back silently if unavailable.
   * Bloom threshold 0.7 ensures only bright emissives (cup, hazards) bloom; the
   * ambient-lit floor stays below that threshold at default lighting levels.
   */
  async _initBloom() {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer'),
        import('three/examples/jsm/postprocessing/RenderPass'),
        import('three/examples/jsm/postprocessing/UnrealBloomPass')
      ]);
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.6, // strength
        0.4, // radius
        0.7 // luminance threshold — floor ambient stays below this
      );
      this.composer.addPass(bloomPass);
    } catch (_e) {
      // Post-processing unavailable; renderer.render() used directly instead
    }
  }

  /**
   * Initialize the game (convenience method that runs both phases).
   */
  async init() {
    await this.initVisuals();
    await this.startGame();
  }

  /**
   * Enable game input, used after unpausing
   */
  enableGameInput() {
    if (this.inputController) {
      this.inputController.enableInput();
    }
  }

  /**
   * Pause the game. Stops the game loop and shows the pause overlay.
   */
  pauseGame() {
    const currentState = this.stateManager.getGameState();
    if (currentState !== GameState.PLAYING && currentState !== GameState.AIMING) {
      return;
    }

    this.prePauseState = currentState;
    this.stateManager.setGameState(GameState.PAUSED);
    this.gameLoopManager.pause();

    if (this.inputController) {
      this.inputController.disableInput();
    }

    if (this.uiManager) {
      this.uiManager.showPauseOverlay();
    }

    this.eventManager.publish(EventTypes.GAME_PAUSED, { timestamp: Date.now() }, this);
    debug.log('[Game] Game paused');
  }

  /**
   * Resume the game from a paused state.
   */
  resumeGame() {
    if (!this.stateManager.isInState(GameState.PAUSED)) {
      return;
    }

    const resumeState = this.prePauseState || GameState.PLAYING;
    this.prePauseState = null;
    this.stateManager.setGameState(resumeState);
    this.gameLoopManager.resume();

    if (this.inputController) {
      this.inputController.enableInput();
    }

    if (this.uiManager) {
      this.uiManager.hidePauseOverlay();
    }

    this.eventManager.publish(EventTypes.GAME_RESUMED, { timestamp: Date.now() }, this);
    debug.log('[Game] Game resumed');
  }

  /**
   * Restart the current hole from the tee, cancelling strokes taken so far.
   */
  restartHole() {
    if (!this.stateManager.isInState(GameState.PAUSED)) {
      return;
    }

    if (this.uiManager) {
      this.uiManager.hidePauseOverlay();
    }

    this.scoringSystem.cancelCurrentHoleStrokes();

    const startPos = this.course?.getHoleStartPosition?.();
    if (this.ballManager) {
      this.ballManager.resetBall(startPos ? startPos.clone() : undefined);
    }

    const resumeState = this.prePauseState || GameState.PLAYING;
    this.prePauseState = null;
    this.stateManager.setGameState(resumeState);
    this.gameLoopManager.resume();

    if (this.inputController) {
      this.inputController.enableInput();
    }

    this.eventManager.publish(EventTypes.GAME_RESUMED, { timestamp: Date.now() }, this);
    debug.log('[Game] Hole restarted');
  }

  /**
   * Restart the entire course from hole 1.
   */
  restartCourse() {
    this.prePauseState = null;
    if (this.uiManager) {
      this.uiManager.hidePauseOverlay();
    }
    reloadPage();
  }

  /**
   * Quit the game and return to the main menu.
   */
  quitToMenu() {
    if (this.stateManager.isInState(GameState.PAUSED)) {
      this.uiManager.hidePauseOverlay();
    }
    this.prePauseState = null;

    if (window.App && typeof window.App.returnToMenu === 'function') {
      window.App.returnToMenu();
    } else {
      reloadPage();
    }
  }

  /**
   * Handle Escape key for pause/resume toggle
   */
  handlePauseKey(event) {
    if (event.key !== 'Escape') {
      return;
    }

    // If paused, always resume
    if (this.stateManager.isInState(GameState.PAUSED)) {
      this.resumeGame();
      return;
    }

    // Don't pause if input controller is in keyboard aiming mode (Escape cancels aiming there)
    if (this.inputController?.isKeyboardAiming) {
      return;
    }

    // Pause if in a pauseable state
    const currentState = this.stateManager.getGameState();
    if (currentState === GameState.PLAYING || currentState === GameState.AIMING) {
      this.pauseGame();
    }
  }

  /**
   * Create three-layer parallax starfield background.
   */
  createStarfield() {
    this.starField = new StarField(this.scene);
    this.starField.init();
  }

  /**
   * Set up scene lights
   */
  setupLights() {
    // Add ambient light
    this.lights.ambient = new THREE.AmbientLight(0x1a1a2e, 0.6);
    this.scene.add(this.lights.ambient);

    // Add directional light for shadows
    this.lights.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    this.lights.directionalLight.position.set(10, 20, 15);
    this.lights.directionalLight.castShadow = true;

    // Configure shadow settings
    this.lights.directionalLight.shadow.mapSize.width = 2048;
    this.lights.directionalLight.shadow.mapSize.height = 2048;
    this.lights.directionalLight.shadow.camera.near = 0.5;
    this.lights.directionalLight.shadow.camera.far = 50;
    this.lights.directionalLight.shadow.camera.left = -20;
    this.lights.directionalLight.shadow.camera.right = 20;
    this.lights.directionalLight.shadow.camera.top = 20;
    this.lights.directionalLight.shadow.camera.bottom = -20;

    this.scene.add(this.lights.directionalLight);
  }

  updateLightingForTheme(theme) {
    if (!theme?.lighting) {
      return;
    }
    const { ambientColor, ambientIntensity, keyLightColor } = theme.lighting;
    if (this.lights.ambient) {
      this.lights.ambient.color.set(ambientColor);
      this.lights.ambient.intensity = ambientIntensity;
    }
    if (this.lights.directionalLight) {
      this.lights.directionalLight.color.set(keyLightColor);
    }
  }

  /**
   * Create the golf course environment
   */
  async createCourse() {
    try {
      debug.log('[Game.createCourse] Attempting to create the course...');

      // Ensure PhysicsManager is ready before creating the course
      if (!this.physicsManager || !this.physicsManager.getWorld()) {
        console.error('[Game.createCourse] PhysicsManager not ready. Aborting course creation.');
        throw new Error('PhysicsManager must be initialized before creating the course.');
      }

      if (!this.CourseClass) {
        const { OrbitalDriftCourse } = await import(
          /* webpackChunkName: "course" */ '../objects/OrbitalDriftCourse'
        );
        this.CourseClass = OrbitalDriftCourse;
      }

      this.course = await this.CourseClass.create(this);

      if (!this.course || !this.course.currentHoleEntity) {
        throw new Error('Course or initial HoleEntity failed to initialize.');
      }

      if (process.env.NODE_ENV !== 'production' && this.course.holeConfigs) {
        const { getRegisteredTypes } = await import(
          /* webpackChunkName: "course" */ '../mechanics/MechanicRegistry'
        );
        validateCourse(this.course.holeConfigs, this.courseName || 'Course', {
          registeredTypes: getRegisteredTypes()
        });
      }

      // Set course ref in CameraController
      if (this.cameraController) {
        this.cameraController.setCourse(this.course);
      }

      // Create ball using WORLD start position from course config
      const worldStartPosition = this.course.getHoleStartPosition(); // Returns WORLD coords now
      if (worldStartPosition) {
        this.ballManager.createBall(worldStartPosition);
      } else {
        throw new Error('Failed to get world start position for ball creation.');
      }

      // Position camera for the initial hole
      if (this.cameraController) {
        this.cameraController.positionCameraForHole();
      }
    } catch (error) {
      this.debugManager.error('Game.createCourse', 'Failed to create course', error, true);
      console.error('CRITICAL: Failed to create course:', error);
      throw error; // Propagate so startGame() caller can show error UI
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    if (this.renderer && this.camera) {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.composer) {
        this.composer.setSize(window.innerWidth, window.innerHeight);
      }
      // The camera aspect ratio update is handled by the CameraController
    }
  }

  /**
   * Cleanup the game and all its components
   */
  /**
   * Helper method to cleanup a manager safely
   */
  cleanupManager(manager) {
    if (manager && typeof manager.cleanup === 'function') {
      manager.cleanup();
    }
  }

  /**
   * Helper method to dispose Three.js objects
   */
  disposeThreeObject(object) {
    if (object.geometry) {
      object.geometry.dispose();
    }
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(material => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  }

  cleanup() {
    try {
      // Stop the game loop first
      if (this.gameLoopManager) {
        this.gameLoopManager.stopLoop();
        this.cleanupManager(this.gameLoopManager);
      }

      // Clean up WebGL context manager
      this.cleanupManager(this.webGLContextManager);

      // Remove event listeners
      if (this.boundHandleResize) {
        window.removeEventListener('resize', this.boundHandleResize);
        this.boundHandleResize = null;
      }
      if (this.boundHandlePauseKey) {
        window.removeEventListener('keydown', this.boundHandlePauseKey);
        this.boundHandlePauseKey = null;
      }
      if (this.backButtonListener && typeof this.backButtonListener.remove === 'function') {
        this.backButtonListener.remove();
        this.backButtonListener = null;
      }

      // Clean up managers in reverse order of initialization
      const managers = [
        'inputController',
        'stuckBallManager',
        'ballManager',
        'holeCompletionManager',
        'holeTransitionManager',
        'holeStateManager',
        'hazardManager',
        'audioManager',
        'physicsManager',
        'visualEffectsManager',
        'cameraController',
        'uiManager',
        'stateManager',
        'performanceManager'
      ];

      managers.forEach(managerName => {
        this.cleanupManager(this[managerName]);
      });

      // Core systems last
      this.cleanupManager(this.eventManager);
      this.cleanupManager(this.debugManager);

      // Clean up parallax star field
      if (this.starField) {
        this.starField.cleanup();
        this.starField = null;
      }

      // Remove objects from scene
      if (this.scene) {
        while (this.scene.children.length > 0) {
          const object = this.scene.children[0];
          this.scene.remove(object);
          this.disposeThreeObject(object);
        }
      }

      // Dispose of composer before renderer
      if (this.composer) {
        this.composer.dispose?.();
        this.composer = null;
      }

      // Dispose of renderer
      if (this.renderer) {
        this.renderer.dispose();
        this.renderer = null;
      }

      // Clear references
      this.camera = null;
      this.scene = null;
      this.clock = null;

      debug.log('Game cleaned up');
    } catch (error) {
      if (this.debugManager) {
        this.debugManager.error('Game.cleanup', 'Error during cleanup', error);
      } else {
        console.error('Error during cleanup:', error);
      }
    }
  }

  /**
   * Set up event listeners (resize is handled in init via boundHandleResize)
   */
  setupEventListeners() {
    // Pause/resume via Escape key
    this.boundHandlePauseKey = this.handlePauseKey.bind(this);
    window.addEventListener('keydown', this.boundHandlePauseKey);

    // Par calibration stroke recording (dev-mode only)
    if (isCalibrationActive()) {
      this.eventManager.subscribe(EventTypes.HOLE_COMPLETED, data => {
        const strokes = this.scoringSystem.getCurrentStrokes();
        if (strokes > 0) {
          recordHoleStrokes(data.holeNumber, strokes);
        }
      });

      this.eventManager.subscribe(EventTypes.GAME_COMPLETED, () => {
        const parValues = this.course.getAllHolePars();
        showCalibrationOverlay(parValues);
      });
    }

    // iOS hardware back button via Capacitor
    this.setupBackButtonListener();
  }

  /**
   * Set up Capacitor back button listener for iOS/Android pause.
   */
  async setupBackButtonListener() {
    try {
      const { App: CapApp } = await import('@capacitor/core');
      if (CapApp && typeof CapApp.addListener === 'function') {
        this.backButtonListener = CapApp.addListener('backButton', () => {
          this.handlePauseKey({ key: 'Escape' });
        });
      }
    } catch (_e) {
      // Capacitor not available (browser environment) — no-op
    }
  }
}
