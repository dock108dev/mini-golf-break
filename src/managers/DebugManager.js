import { debug } from '../utils/debug';
import * as THREE from 'three';
import { DebugErrorOverlay } from './debug/DebugErrorOverlay';
import { DebugCourseUI } from './debug/DebugCourseUI';

/**
 * Configuration for debug functionality
 */
export const DEBUG_CONFIG = {
  enabled: false, // Set to true to enable debugging in production
  enableKey: 'd', // Key to toggle debug mode
  showHelpers: true, // Show axis and grid helpers
  showLightHelpers: true, // Show light helpers
  logVelocity: true, // Log ball velocity
  showPhysicsDebug: false, // Show physics debug visualizations
  logCriticalErrors: true, // Always log critical errors, even when debug is disabled
  errorTracking: {
    maxErrors: 50, // Maximum number of errors to track
    suppressRepeated: true, // Suppress repeated identical errors
    maxRepeats: 3 // Number of times an identical error is logged before suppression
  },
  courseDebug: {
    enabled: true, // Enable course debugging features
    toggleCourseTypeKey: 'c', // Key to toggle between BasicCourse and NineHoleCourse
    loadSpecificHoleKey: 'h', // Key to trigger load specific hole prompt
    quickLoadKeys: {
      // Number keys 1-9 to quickly load specific holes
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      9: 9
    }
  }
};

/**
 * Error levels for the logging system
 */
export const ERROR_LEVELS = {
  ERROR: 'ERROR', // Critical errors that prevent proper functionality
  WARNING: 'WARNING', // Non-critical issues that may affect gameplay
  INFO: 'INFO', // General information logs
  DEBUG: 'DEBUG' // Detailed debug information
};

/**
 * DebugManager - Handles debug functionality, visualizations, and logging
 * Extracts debug management from Game.js to improve modularity
 */
export class DebugManager {
  constructor(game) {
    // Reference to the main game
    this.game = game;

    // Debug state
    this.enabled = DEBUG_CONFIG.enabled;

    // Track debug objects (3D helpers) for easy removal
    this.debugObjects = [];

    // Velocity logging data
    this.velocityHistory = [];
    this.maxHistoryLength = 10;

    // Error tracking state (kept in main manager)
    this.errorHistory = new Map(); // Maps error messages to count
    this.errorsByLevel = {
      [ERROR_LEVELS.ERROR]: 0,
      [ERROR_LEVELS.WARNING]: 0,
      [ERROR_LEVELS.INFO]: 0,
      [ERROR_LEVELS.DEBUG]: 0
    };

    // Course debug state (kept in main manager)
    this.courseDebugState = {
      active: false, // Not actively used now, state driven by UI module
      courseType: 'NineHoleCourse',
      currentHole: 1,
      previousCourseType: null,
      courseOverrideActive: false
    };

    // UI Submodules
    this.errorOverlay = null;
    this.courseDebugUI = null;

    // Bound key handler for main debug toggle
    this.boundHandleMainKey = this.handleMainDebugKey.bind(this);
  }

  /**
   * Initialize debug functionality
   */
  init() {
    debug.log('[DebugManager.init] Initializing...');
    // Listen for main debug key press
    this.addMainKeyListener();

    // Initialize UI Submodules
    debug.log('[DebugManager.init] Initializing Error Overlay...');
    this.errorOverlay = new DebugErrorOverlay(this); // Pass self
    this.errorOverlay.init();

    if (DEBUG_CONFIG.courseDebug.enabled) {
      debug.log('[DebugManager.init] Initializing Course Debug UI...');
      this.courseDebugUI = new DebugCourseUI(this); // Pass self
      this.courseDebugUI.init();
    } else {
      debug.log('[DebugManager.init] Course Debug UI disabled by config.');
    }

    // Set up initial 3D helpers if enabled by default
    if (this.enabled) {
      this.setupDebugHelpers();
    }

    debug.log('[DebugManager.init] Finished.');
    return this;
  }

  /** Add listener for the main debug toggle key */
  addMainKeyListener() {
    if (process.env.NODE_ENV !== 'production' || DEBUG_CONFIG.enabled) {
      window.addEventListener('keydown', this.boundHandleMainKey);
      debug.log(
        "[DebugManager] Debug mode available - press '" + DEBUG_CONFIG.enableKey + "' to toggle"
      );
    }
  }

  /** Remove listener for the main debug toggle key */
  removeMainKeyListener() {
    window.removeEventListener('keydown', this.boundHandleMainKey);
  }

  /** Handle only the main debug toggle key press */
  handleMainDebugKey(e) {
    if (e.key === DEBUG_CONFIG.enableKey) {
      this.toggleDebugMode();
    }
    // NOTE: Course debug keys are handled by DebugCourseUI
  }

  /**
   * Toggle debug mode on/off
   */
  toggleDebugMode() {
    this.enabled = !this.enabled;
    debug.log('Debug mode:', this.enabled ? 'ON' : 'OFF');

    // Update debug mode for components that need it
    this.game.cameraController?.setDebugMode(this.enabled);

    // Toggle 3D debug helpers
    if (this.enabled) {
      this.setupDebugHelpers();
    } else {
      this.removeDebugHelpers();
      // Explicitly clear CannonDebugRenderer meshes when turning off debug mode
      this.game.cannonDebugRenderer?.clearMeshes();
    }

    // Update visibility/state of the Course Debug UI (if it exists)
    this.courseDebugUI?.updateDisplay();

    // Inform UIManager's Debug Overlay (if it exists)
    // This might trigger showing/hiding the FPS counter etc.
    this.game.uiManager?.updateDebugDisplay(this.getDebugInfo());

    return this;
  }

  /**
   * Set up debug visual helpers
   */
  setupDebugHelpers() {
    // Only proceed if debug helpers are enabled in config
    if (!DEBUG_CONFIG.showHelpers) {
      return;
    }

    // Clear existing debug helpers
    this.removeDebugHelpers();

    // Only add helpers if we have a scene
    if (!this.game || !this.game.scene) {
      return;
    }

    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    this.game.scene.add(axesHelper);
    this.debugObjects.push(axesHelper);

    // Add grid helper
    // Reduce size to 40x40 as requested
    const gridSize = 40; // Size of the grid (e.g., 40x40)
    const gridDivisions = 40; // Number of divisions (e.g., 40 lines)
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions);
    this.game.scene.add(gridHelper);
    this.debugObjects.push(gridHelper);

    // Add light helpers if configured and lights exist
    if (DEBUG_CONFIG.showLightHelpers && this.game.lights) {
      if (this.game.lights.directionalLight) {
        const lightHelper = new THREE.DirectionalLightHelper(this.game.lights.directionalLight, 1);
        this.game.scene.add(lightHelper);
        this.debugObjects.push(lightHelper);

        // Add shadow camera helper
        const shadowHelper = new THREE.CameraHelper(
          this.game.lights.directionalLight.shadow.camera
        );
        this.game.scene.add(shadowHelper);
        this.debugObjects.push(shadowHelper);
      }
    }

    return this;
  }

  /**
   * Remove debug visual helpers
   */
  removeDebugHelpers() {
    // Only remove if we have a scene
    if (!this.game || !this.game.scene) {
      console.warn('[DebugManager] Cannot remove helpers, game or scene missing.');
      return this;
    }

    // Remove all debug objects from the scene
    this.debugObjects.forEach(obj => {
      if (obj && obj.parent) {
        this.game.scene.remove(obj);
      }
    });

    // Clear the array
    this.debugObjects = [];

    return this;
  }

  /**
   * Log ball velocity if enabled
   * @param {THREE.Vector3} velocity - Ball velocity vector
   */
  logBallVelocity(velocity) {
    if (!this.enabled || !DEBUG_CONFIG.logVelocity) {
      return;
    }

    const speed = velocity.length();

    // Add to history
    this.velocityHistory.push(speed);

    // Keep history at max length
    if (this.velocityHistory.length > this.maxHistoryLength) {
      this.velocityHistory.shift();
    }

    // Log to console
    debug.log(`Ball speed: ${speed.toFixed(2)} m/s`);

    return this;
  }

  /**
   * Log a message with a specified error level
   * @param {string} level - Error level (ERROR, WARNING, INFO, DEBUG)
   * @param {string} source - Source of the error (class or method name)
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   * @param {boolean} showInUI - Whether to show critical errors in the UI
   * @returns {DebugManager} this for chaining
   */
  logWithLevel(level, source, message, data = null, showInUI = false) {
    // Always log critical errors, otherwise respect debug mode
    if (level !== ERROR_LEVELS.ERROR && !this.enabled && !DEBUG_CONFIG.logCriticalErrors) {
      // Allow critical errors even if main debug is off, if configured
      if (level !== ERROR_LEVELS.ERROR || !DEBUG_CONFIG.logCriticalErrors) {
        return this;
      }
    }

    // Format message with source
    const formattedMessage = `[${level}] ${source}: ${message}`;

    // Track error frequency
    this.trackError(level, formattedMessage);

    // Check if we should suppress this error (repeated too many times)
    if (this.shouldSuppressError(formattedMessage)) {
      return this;
    }

    // Log to console with appropriate method
    switch (level) {
      case ERROR_LEVELS.ERROR:
        console.error(formattedMessage, data !== null ? data : '');
        break;
      case ERROR_LEVELS.WARNING:
        console.warn(formattedMessage, data !== null ? data : '');
        break;
      case ERROR_LEVELS.INFO:
      case ERROR_LEVELS.DEBUG:
      default:
        debug.log(formattedMessage, data !== null ? data : '');
        break;
    }

    // Show in UI if requested and it's a critical error
    if (showInUI && level === ERROR_LEVELS.ERROR) {
      // Delegate to the error overlay module
      this.showErrorInUI(formattedMessage);
    }

    return this;
  }

  /**
   * Track error frequency
   * @param {string} level - Error level
   * @param {string} message - Error message to track
   */
  trackError(level, message) {
    // Increment error count for this level
    this.errorsByLevel[level]++;

    // Track unique error message frequency
    const currentCount = this.errorHistory.get(message) || 0;
    this.errorHistory.set(message, currentCount + 1);

    // Prevent memory leaks by limiting the size of the error history
    if (this.errorHistory.size > DEBUG_CONFIG.errorTracking.maxErrors) {
      // Remove the oldest entries
      const iterator = this.errorHistory.keys();
      this.errorHistory.delete(iterator.next().value);
    }
  }

  /**
   * Check if an error should be suppressed (repeated too many times)
   * @param {string} message - Error message to check
   * @returns {boolean} Whether to suppress the error
   */
  shouldSuppressError(message) {
    if (!DEBUG_CONFIG.errorTracking.suppressRepeated) {
      return false;
    }

    const count = this.errorHistory.get(message) || 0;
    return count > DEBUG_CONFIG.errorTracking.maxRepeats;
  }

  /**
   * Get error statistics for the UI
   * @returns {object} Error statistics
   */
  getErrorStats() {
    return {
      totalErrors: this.errorsByLevel[ERROR_LEVELS.ERROR],
      totalWarnings: this.errorsByLevel[ERROR_LEVELS.WARNING],
      uniqueErrors: this.errorHistory.size
    };
  }

  /**
   * Get debug info object for UI display
   * @returns {object} Object with debug properties
   */
  getDebugInfo() {
    if (!this.enabled) {
      return {};
    }

    const info = {
      FPS: Math.round(1 / this.game.deltaTime),
      'Debug Mode': this.enabled ? 'ON' : 'OFF'
    };

    // Add error statistics
    const errorStats = this.getErrorStats();
    if (errorStats.totalErrors > 0 || errorStats.totalWarnings > 0) {
      info['Errors'] = errorStats.totalErrors;
      info['Warnings'] = errorStats.totalWarnings;
    }

    // Add ball info if available
    if (this.game.ballManager && this.game.ballManager.ball && this.game.ballManager.ball.body) {
      const ball = this.game.ballManager.ball;
      const velocity = ball.body.velocity;
      const position = ball.mesh.position;

      info['Ball Position'] =
        `X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}, Z: ${position.z.toFixed(2)}`;
      info['Ball Velocity'] = `${velocity.length().toFixed(2)} m/s`;
    }

    return info;
  }

  /**
   * Cleanup resources and event listeners
   */
  cleanup() {
    // Remove event listeners
    this.removeMainKeyListener();

    // Cleanup UI submodules
    this.errorOverlay?.cleanup();
    this.courseDebugUI?.cleanup();

    // Remove 3D debug objects from scene
    this.removeDebugHelpers();

    // Remove UI elements (redundant if submodules handle it, but safe)
    // document.getElementById('error-overlay')?.remove();
    // document.getElementById('course-debug-overlay')?.remove();

    // Clear references
    this.game = null;
    this.debugObjects = [];
    this.velocityHistory = [];
    this.errorHistory.clear();
    this.errorOverlay = null; // Clear submodule ref
    this.courseDebugUI = null; // Clear submodule ref

    debug.log('[DebugManager] Cleanup finished.');
    return this;
  }

  /**
   * Toggle between BasicCourse and NineHoleCourse
   */
  toggleCourseType() {
    // Toggle the course type
    const newCourseType =
      this.courseDebugState.courseType === 'BasicCourse' ? 'NineHoleCourse' : 'BasicCourse';

    debug.log(
      `[DebugManager] Toggling course type from ${this.courseDebugState.courseType} to ${newCourseType}`
    );
    this.courseDebugState.courseType = newCourseType;

    // Force reload the current course with the new type
    this.loadCourseWithType(newCourseType);

    // Update debug UI if it exists
    this.courseDebugUI?.updateDisplay();
  }

  /**
   * Prompt the user for a hole number to load
   */
  promptForHoleNumber() {
    const maxHole = this.courseDebugState.courseType === 'BasicCourse' ? 3 : 9;
    const holeNumber = prompt(
      `Enter hole number to load (1-${maxHole}):`,
      this.courseDebugState.currentHole
    );

    if (holeNumber === null) {
      return;
    } // User canceled

    const holeNum = parseInt(holeNumber, 10);
    if (isNaN(holeNum) || holeNum < 1 || holeNum > maxHole) {
      alert(`Please enter a valid hole number between 1 and ${maxHole}.`);
      return;
    }

    this.loadSpecificHole(holeNum);
  }

  /**
   * Load a specific hole number
   * @param {number} holeNumber - The hole number to load (1-based)
   */
  loadSpecificHole(holeNumber) {
    debug.log(`[DebugManager] Loading ${this.courseDebugState.courseType} hole #${holeNumber}`);

    // Store the current hole for debug UI
    this.courseDebugState.currentHole = holeNumber;

    // Set override flag
    this.courseDebugState.courseOverrideActive = true;

    // Get current game state
    const hasCourse = !!this.game.course;

    // If course type changed or no course exists, load a new course
    if (!hasCourse || this.game.course.constructor.name !== this.courseDebugState.courseType) {
      this.loadCourseWithType(this.courseDebugState.courseType, holeNumber);
    } else {
      // Use existing course but load specific hole
      this.loadHoleInExistingCourse(holeNumber);
    }

    // Update debug UI
    this.courseDebugUI?.updateDisplay();
  }

  /**
   * Load a specific course type with optional hole number
   * @param {string} courseType - 'BasicCourse' or 'NineHoleCourse'
   * @param {number} [holeNumber] - Optional hole number to load
   */
  async loadCourseWithType(courseType, holeNumber = 1) {
    debug.log(`[DebugManager] Loading course type: ${courseType}, hole: ${holeNumber}`);

    try {
      // Import the appropriate course class dynamically
      let CourseClass;
      if (courseType === 'BasicCourse') {
        const basicModule = await import('../objects/BasicCourse.js');
        CourseClass = basicModule.BasicCourse;
      } else {
        const nineHoleModule = await import('../objects/NineHoleCourse.js');
        CourseClass = nineHoleModule.NineHoleCourse;
      }

      // Clear existing course if any
      if (this.game.course) {
        // Clean up existing course
        this.game.course.clearCurrentHole();
        this.game.scene.remove(this.game.course);
        this.game.course = null;
      }

      // Create new course
      this.game.course = await CourseClass.create(this.game);

      // Load specific hole if not the first one
      if (holeNumber > 1) {
        await this.loadHoleInExistingCourse(holeNumber);
      } else {
        // Make sure ballManager is updated with the course's start position
        if (this.game.ballManager && this.game.course.startPosition) {
          await this.game.ballManager.resetBall(this.game.course.startPosition);
        }
      }

      // Update camera to focus on the new hole
      if (this.game.cameraController) {
        this.game.cameraController.setupInitialCameraPosition();
      }

      return true;
    } catch (error) {
      console.error(`[DebugManager] Error loading course ${courseType}:`, error);
      this.error('DebugManager', `Failed to load ${courseType}`, error, true);
      return false;
    }
  }

  /**
   * Load a specific hole in the existing course
   * @param {number} holeNumber - The hole number to load (1-based)
   */
  async loadHoleInExistingCourse(holeNumber) {
    if (!this.game.course) {
      console.error('[DebugManager] Cannot load hole: No course exists');
      return false;
    }

    try {
      // Use the course's own method to load a specific hole
      const success = await this.game.course.createCourse(holeNumber);

      if (!success) {
        throw new Error(`Failed to load hole ${holeNumber}`);
      }

      // Reset ball at the new hole's start position
      if (this.game.ballManager && this.game.course.startPosition) {
        await this.game.ballManager.resetBall(this.game.course.startPosition);
      }

      // Update the current hole number in the debug state
      this.courseDebugState.currentHole = holeNumber;

      // Update UI
      if (this.game.uiManager) {
        this.game.uiManager.updateHoleInfo();
        this.game.uiManager.updateScore();
        this.game.uiManager.updateStrokes();
      }

      // Update camera to focus on the new hole
      if (this.game.cameraController) {
        this.game.cameraController.setupInitialCameraPosition();
      }

      return true;
    } catch (error) {
      console.error(`[DebugManager] Error loading hole ${holeNumber}:`, error);
      this.error('DebugManager', `Failed to load hole ${holeNumber}`, error, true);
      return false;
    }
  }

  /**
   * Display a critical error in the UI error overlay (Delegated)
   * @param {string} message - Error message to display
   */
  showErrorInUI(message) {
    this.errorOverlay?.showError(message);
  }

  // RE-ADD Convenience Logging Methods

  /**
   * Log a critical error (always logged, even when debug is disabled)
   * @param {string} source - Source of the error (class or method name)
   * @param {string} message - Error message
   * @param {any} data - Optional data related to the error
   * @param {boolean} showInUI - Whether to show in the UI error overlay
   * @returns {DebugManager} this for chaining
   */
  error(source, message, data = null, showInUI = false) {
    return this.logWithLevel(ERROR_LEVELS.ERROR, source, message, data, showInUI);
  }

  /**
   * Log a warning (only when debug is enabled, unless critical errors are forced)
   * @param {string} source - Source of the warning
   * @param {string} message - Warning message
   * @param {any} data - Optional data to include
   * @returns {DebugManager} this for chaining
   */
  warn(source, message, data = null) {
    return this.logWithLevel(ERROR_LEVELS.WARNING, source, message, data);
  }

  /**
   * Log an informational message (only when debug is enabled)
   * @param {string} source - Source of the info
   * @param {string} message - Info message
   * @param {any} data - Optional data to include
   * @returns {DebugManager} this for chaining
   */
  info(source, message, data = null) {
    return this.logWithLevel(ERROR_LEVELS.INFO, source, message, data);
  }

  /**
   * Log debug message if debug mode is enabled (legacy method for compatibility)
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  log(message, data = null) {
    // Use a generic source like 'Log' or 'Debug' if source isn't provided
    return this.logWithLevel(ERROR_LEVELS.DEBUG, 'Log', message, data);
  }

  // END Convenience Logging Methods
}
