import { debug } from '../utils/debug';
import * as THREE from 'three';
import { DebugErrorOverlay } from './debug/DebugErrorOverlay';
import { DebugCourseUI } from './debug/DebugCourseUI';
import { DEBUG_CONFIG, ERROR_LEVELS } from '../config/debugConfig';

export { DEBUG_CONFIG, ERROR_LEVELS };

/** Handles debug functionality, visualizations, and logging. */
export class DebugManager {
  constructor(game) {
    this.game = game;
    this.enabled = DEBUG_CONFIG.enabled;
    this.debugObjects = [];
    this.velocityHistory = [];
    this.maxHistoryLength = 10;
    this.errorHistory = new Map();
    this.errorsByLevel = {
      [ERROR_LEVELS.ERROR]: 0,
      [ERROR_LEVELS.WARNING]: 0,
      [ERROR_LEVELS.INFO]: 0,
      [ERROR_LEVELS.DEBUG]: 0
    };
    this.courseDebugState = {
      active: false,
      courseType: 'OrbitalDriftCourse',
      currentHole: 1,
      previousCourseType: null,
      courseOverrideActive: false
    };
    this.forceFieldsVisible = true;
    this.errorOverlay = null;
    this.courseDebugUI = null;
    this.boundHandleMainKey = this.handleMainDebugKey.bind(this);
    this.boundHandleForceFieldKey = this.handleForceFieldKey.bind(this);
  }

  init() {
    this.addMainKeyListener();
    this.errorOverlay = new DebugErrorOverlay(this);
    this.errorOverlay.init();

    if (DEBUG_CONFIG.courseDebug.enabled) {
      this.courseDebugUI = new DebugCourseUI(this);
      this.courseDebugUI.init();
    }

    if (this.enabled) {
      this.setupDebugHelpers();
    }
    return this;
  }

  addMainKeyListener() {
    if (process.env.NODE_ENV !== 'production' || DEBUG_CONFIG.enabled) {
      window.addEventListener('keydown', this.boundHandleMainKey);
      window.addEventListener('keydown', this.boundHandleForceFieldKey);
      debug.log(
        "[DebugManager] Debug mode available - press '" + DEBUG_CONFIG.enableKey + "' to toggle"
      );
    }
  }

  removeMainKeyListener() {
    window.removeEventListener('keydown', this.boundHandleMainKey);
    window.removeEventListener('keydown', this.boundHandleForceFieldKey);
  }

  handleMainDebugKey(e) {
    if (e.key === DEBUG_CONFIG.enableKey) {
      this.toggleDebugMode();
    }
  }

  handleForceFieldKey(e) {
    if (e.key === DEBUG_CONFIG.forceFieldToggleKey) {
      this.toggleForceFieldVisibility();
    }
  }

  toggleForceFieldVisibility() {
    this.forceFieldsVisible = !this.forceFieldsVisible;
    debug.log('Force field visibility:', this.forceFieldsVisible ? 'ON' : 'OFF');
    this.applyForceFieldVisibility();
    if (this.enabled) {
      this.game.uiManager?.updateDebugDisplay(this.getDebugInfo());
    }
    return this;
  }

  applyForceFieldVisibility() {
    const course = this.game?.course;
    if (!course) {
      return;
    }
    const holeEntity = course.currentHoleEntity;
    if (!holeEntity?.mechanics) {
      return;
    }
    for (const mechanic of holeEntity.mechanics) {
      if (mechanic.isForceField) {
        mechanic.setMeshVisibility(this.forceFieldsVisible);
      }
    }
  }

  toggleDebugMode() {
    this.enabled = !this.enabled;
    debug.log('Debug mode:', this.enabled ? 'ON' : 'OFF');
    this.game.cameraController?.setDebugMode(this.enabled);

    if (this.enabled) {
      this.setupDebugHelpers();
    } else {
      this.removeDebugHelpers();
      this.game.cannonDebugRenderer?.clearMeshes();
    }

    this.courseDebugUI?.updateDisplay();
    this.game.uiManager?.updateDebugDisplay(this.getDebugInfo());
    return this;
  }

  setupDebugHelpers() {
    if (!DEBUG_CONFIG.showHelpers) {
      return;
    }
    this.removeDebugHelpers();
    if (!this.game?.scene) {
      return;
    }

    const axesHelper = new THREE.AxesHelper(5);
    this.game.scene.add(axesHelper);
    this.debugObjects.push(axesHelper);

    const gridHelper = new THREE.GridHelper(40, 40);
    this.game.scene.add(gridHelper);
    this.debugObjects.push(gridHelper);

    if (DEBUG_CONFIG.showLightHelpers && this.game.lights?.directionalLight) {
      const lightHelper = new THREE.DirectionalLightHelper(this.game.lights.directionalLight, 1);
      this.game.scene.add(lightHelper);
      this.debugObjects.push(lightHelper);

      const shadowHelper = new THREE.CameraHelper(this.game.lights.directionalLight.shadow.camera);
      this.game.scene.add(shadowHelper);
      this.debugObjects.push(shadowHelper);
    }
    return this;
  }

  removeDebugHelpers() {
    if (!this.game?.scene) {
      console.warn('[DebugManager] Cannot remove helpers, game or scene missing.');
      return this;
    }
    this.debugObjects.forEach(obj => {
      if (obj?.parent) {
        this.game.scene.remove(obj);
      }
    });
    this.debugObjects = [];
    return this;
  }

  logBallVelocity(velocity) {
    if (!this.enabled || !DEBUG_CONFIG.logVelocity) {
      return;
    }
    const speed = velocity.length();
    this.velocityHistory.push(speed);
    if (this.velocityHistory.length > this.maxHistoryLength) {
      this.velocityHistory.shift();
    }
    debug.log(`Ball speed: ${speed.toFixed(2)} m/s`);
    return this;
  }

  logWithLevel(level, source, message, data = null, showInUI = false) {
    if (level !== ERROR_LEVELS.ERROR && !this.enabled && !DEBUG_CONFIG.logCriticalErrors) {
      if (level !== ERROR_LEVELS.ERROR || !DEBUG_CONFIG.logCriticalErrors) {
        return this;
      }
    }

    const formattedMessage = `[${level}] ${source}: ${message}`;
    this.trackError(level, formattedMessage);
    if (this.shouldSuppressError(formattedMessage)) {
      return this;
    }

    switch (level) {
      case ERROR_LEVELS.ERROR:
        console.error(formattedMessage, data !== null ? data : '');
        break;
      case ERROR_LEVELS.WARNING:
        console.warn(formattedMessage, data !== null ? data : '');
        break;
      default:
        debug.log(formattedMessage, data !== null ? data : '');
        break;
    }

    if (showInUI && level === ERROR_LEVELS.ERROR) {
      this.showErrorInUI(formattedMessage);
    }
    return this;
  }

  trackError(level, message) {
    this.errorsByLevel[level]++;
    const currentCount = this.errorHistory.get(message) || 0;
    this.errorHistory.set(message, currentCount + 1);
    if (this.errorHistory.size > DEBUG_CONFIG.errorTracking.maxErrors) {
      this.errorHistory.delete(this.errorHistory.keys().next().value);
    }
  }

  shouldSuppressError(message) {
    if (!DEBUG_CONFIG.errorTracking.suppressRepeated) {
      return false;
    }
    return (this.errorHistory.get(message) || 0) > DEBUG_CONFIG.errorTracking.maxRepeats;
  }

  getErrorStats() {
    return {
      totalErrors: this.errorsByLevel[ERROR_LEVELS.ERROR],
      totalWarnings: this.errorsByLevel[ERROR_LEVELS.WARNING],
      uniqueErrors: this.errorHistory.size
    };
  }

  getDebugInfo() {
    if (!this.enabled) {
      return {};
    }
    const info = {
      FPS: Math.round(1 / this.game.deltaTime),
      'Debug Mode': 'ON',
      'Force Fields': this.forceFieldsVisible ? 'Visible' : 'Hidden'
    };
    const errorStats = this.getErrorStats();
    if (errorStats.totalErrors > 0 || errorStats.totalWarnings > 0) {
      info['Errors'] = errorStats.totalErrors;
      info['Warnings'] = errorStats.totalWarnings;
    }
    if (this.game.ballManager?.ball?.body) {
      const ball = this.game.ballManager.ball;
      const pos = ball.mesh.position;
      info['Ball Position'] =
        `X: ${pos.x.toFixed(2)}, Y: ${pos.y.toFixed(2)}, Z: ${pos.z.toFixed(2)}`;
      info['Ball Velocity'] = `${ball.body.velocity.length().toFixed(2)} m/s`;
    }
    return info;
  }

  cleanup() {
    this.removeMainKeyListener();
    this.errorOverlay?.cleanup();
    this.courseDebugUI?.cleanup();
    this.removeDebugHelpers();
    this.game = null;
    this.debugObjects = [];
    this.velocityHistory = [];
    this.errorHistory.clear();
    this.forceFieldsVisible = true;
    this.errorOverlay = null;
    this.courseDebugUI = null;
    debug.log('[DebugManager] Cleanup finished.');
    return this;
  }

  promptForHoleNumber() {
    const maxHole = 9;
    /* eslint-disable no-alert -- debug-only course UI; browser prompts are intentional */
    const holeNumber = prompt(
      `Enter hole number to load (1-${maxHole}):`,
      this.courseDebugState.currentHole
    );
    if (holeNumber === null) {
      return;
    }
    const holeNum = parseInt(holeNumber, 10);
    if (isNaN(holeNum) || holeNum < 1 || holeNum > maxHole) {
      alert(`Please enter a valid hole number between 1 and ${maxHole}.`);
      return;
    }
    /* eslint-enable no-alert */
    this.loadSpecificHole(holeNum);
  }

  loadSpecificHole(holeNumber) {
    debug.log(`[DebugManager] Loading ${this.courseDebugState.courseType} hole #${holeNumber}`);
    this.courseDebugState.currentHole = holeNumber;
    this.courseDebugState.courseOverrideActive = true;

    if (
      !this.game.course ||
      this.game.course.constructor.name !== this.courseDebugState.courseType
    ) {
      this.loadCourseWithType(this.courseDebugState.courseType, holeNumber);
    } else {
      this.loadHoleInExistingCourse(holeNumber);
    }
    this.courseDebugUI?.updateDisplay();
  }

  async loadCourseWithType(courseType, holeNumber = 1) {
    debug.log(`[DebugManager] Loading course type: ${courseType}, hole: ${holeNumber}`);
    try {
      const CourseClass = (await import('../objects/OrbitalDriftCourse.js')).OrbitalDriftCourse;

      if (this.game.course) {
        this.game.course.clearCurrentHole();
        this.game.scene.remove(this.game.course);
        this.game.course = null;
      }

      this.game.course = await CourseClass.create(this.game);
      if (holeNumber > 1) {
        await this.loadHoleInExistingCourse(holeNumber);
      } else if (this.game.ballManager && this.game.course.startPosition) {
        await this.game.ballManager.resetBall(this.game.course.startPosition);
      }
      this.game.cameraController?.setupInitialCameraPosition();
      return true;
    } catch (error) {
      console.error(`[DebugManager] Error loading course ${courseType}:`, error);
      this.error('DebugManager', `Failed to load ${courseType}`, error, true);
      return false;
    }
  }

  async loadHoleInExistingCourse(holeNumber) {
    if (!this.game.course) {
      console.error('[DebugManager] Cannot load hole: No course exists');
      return false;
    }
    try {
      const success = await this.game.course.createCourse(holeNumber);
      if (!success) {
        throw new Error(`Failed to load hole ${holeNumber}`);
      }

      if (this.game.ballManager && this.game.course.startPosition) {
        await this.game.ballManager.resetBall(this.game.course.startPosition);
      }
      this.courseDebugState.currentHole = holeNumber;
      if (this.game.uiManager) {
        this.game.uiManager.updateHoleInfo();
        this.game.uiManager.updateScore();
        this.game.uiManager.updateStrokes();
      }
      this.game.cameraController?.setupInitialCameraPosition();
      return true;
    } catch (error) {
      console.error(`[DebugManager] Error loading hole ${holeNumber}:`, error);
      this.error('DebugManager', `Failed to load hole ${holeNumber}`, error, true);
      return false;
    }
  }

  showErrorInUI(message) {
    this.errorOverlay?.showError(message);
  }

  error(source, message, data = null, showInUI = false) {
    return this.logWithLevel(ERROR_LEVELS.ERROR, source, message, data, showInUI);
  }

  warn(source, message, data = null) {
    return this.logWithLevel(ERROR_LEVELS.WARNING, source, message, data);
  }

  info(source, message, data = null) {
    return this.logWithLevel(ERROR_LEVELS.INFO, source, message, data);
  }

  log(message, data = null) {
    return this.logWithLevel(ERROR_LEVELS.DEBUG, 'Log', message, data);
  }
}
