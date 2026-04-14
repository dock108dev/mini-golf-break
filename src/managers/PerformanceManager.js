import { debug } from '../utils/debug';

/**
 * Configuration options for the PerformanceManager
 */
export const PERFORMANCE_CONFIG = {
  enabled: true, // Enable performance monitoring by default
  displayEnabled: false, // Performance display initially hidden
  toggleKey: 'p', // Key to toggle performance display
  sampleSize: 100, // Number of frames to keep in history
  displayUpdateInterval: 500, // Update interval for display in ms
  warningThresholds: {
    fps: 30, // Minimum acceptable FPS
    frameTime: 33.33, // Maximum acceptable frame time (ms)
    physicsTime: 10, // Maximum acceptable physics time (ms)
    renderTime: 15 // Maximum acceptable render time (ms)
  }
};

/**
 * PerformanceManager - Tracks and reports performance metrics for the game
 */
export class PerformanceManager {
  /**
   * Create a new PerformanceManager
   * @param {Object} game - Reference to the main game
   */
  constructor(game) {
    this.game = game;

    // Configuration
    this.enabled = PERFORMANCE_CONFIG.enabled;
    this.displayEnabled = PERFORMANCE_CONFIG.displayEnabled;
    this.sampleSize = PERFORMANCE_CONFIG.sampleSize;
    this.displayUpdateInterval = PERFORMANCE_CONFIG.displayUpdateInterval;

    // Performance metrics storage
    this.metrics = {
      fps: { current: 0, min: Infinity, max: 0, avg: 0, samples: [] },
      frameTime: { current: 0, min: Infinity, max: 0, avg: 0, samples: [] },

      // Component timing
      physics: { current: 0, avg: 0, min: Infinity, max: 0, samples: [] },
      render: { current: 0, avg: 0, min: Infinity, max: 0, samples: [] },
      logic: { current: 0, avg: 0, min: Infinity, max: 0, samples: [] },

      // Memory
      memory: { jsHeapSize: 0, usedJSHeapSize: 0 },
      objects: { three: 0, physics: 0 }
    };

    // UI elements
    this.performanceDisplay = null;
    this.lastDisplayUpdate = 0;

    // Timer markers for measuring specific code sections
    this.markers = {};

    // Frame tracking
    this.frameCount = 0;
    this.frameStartTime = 0;
    this.lastFpsUpdate = 0;

    // Per-frame tracking
    this.isFrameActive = false;

    // Budget warnings
    this.budgetViolations = new Map();
    this.lastWarningTimes = {};

    // Event handler reference for cleanup
    this.boundHandleKeyPress = this.handleKeyPress.bind(this);
  }

  /**
   * Safely traverses a potentially undefined object path and returns a default value if the path is invalid
   * @param {Object} obj - The root object to traverse
   * @param {string} path - The property path (e.g., 'game.physicsManager.world.bodies')
   * @param {*} defaultValue - Default value to return if path is invalid
   * @returns {*} The value at the specified path or defaultValue if path is invalid
   */
  safelyGet(obj, path, defaultValue = null) {
    if (!obj) {
      return defaultValue;
    }

    const props = path.split('.');
    let result = obj;

    for (const prop of props) {
      if (result === null || result === undefined || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[prop];
    }

    return result !== undefined ? result : defaultValue;
  }

  /**
   * Initialize the performance manager
   */
  init() {
    try {
      // Set up keyboard listener for toggling
      if (window) {
        window.addEventListener('keydown', this.boundHandleKeyPress);
      }

      // Create the performance display
      if (document) {
        this.createPerformanceDisplay();
      }
    } catch (error) {
      console.warn('PerformanceManager initialization error:', error);
      // Disable if we encounter errors during initialization
      this.enabled = false;
    }

    return this;
  }

  /**
   * Handle key press for performance display toggle
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyPress(e) {
    if (e.key === PERFORMANCE_CONFIG.toggleKey) {
      this.toggleDisplay();
    }
  }

  /**
   * Toggle the performance display
   */
  toggleDisplay() {
    this.displayEnabled = !this.displayEnabled;

    if (this.performanceDisplay) {
      this.performanceDisplay.style.display = this.displayEnabled ? 'block' : 'none';
    }

    debug.log(`Performance display: ${this.displayEnabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Start a timer for a specific section of code
   * @param {string} name - Name of the timer
   */
  startTimer(name) {
    if (!this.enabled) {
      return;
    }

    this.markers[name] = performance.now();
  }

  /**
   * End a timer and record the elapsed time
   * @param {string} name - Name of the timer
   * @returns {number} Elapsed time in milliseconds
   */
  endTimer(name) {
    if (!this.enabled || !this.markers[name]) {
      return 0;
    }

    const now = performance.now();
    const elapsed = now - this.markers[name];

    // Save into metrics if we have a container for this timer
    if (this.metrics[name]) {
      this.metrics[name].current = elapsed;

      // Update min/max
      this.metrics[name].min = Math.min(this.metrics[name].min, elapsed);
      this.metrics[name].max = Math.max(this.metrics[name].max, elapsed);

      // Add to samples
      this.metrics[name].samples.push(elapsed);
      if (this.metrics[name].samples.length > this.sampleSize) {
        this.metrics[name].samples.shift();
      }

      // Calculate average
      this.metrics[name].avg =
        this.metrics[name].samples.reduce((a, b) => a + b, 0) / this.metrics[name].samples.length;

      // Check for budget violations
      this.checkBudget(name, elapsed);
    }

    delete this.markers[name];
    return elapsed;
  }

  /**
   * Check if a metric exceeds the warning threshold
   * @param {string} name - Metric name
   * @param {number} value - Current value
   */
  checkBudget(name, value) {
    // Skip if no threshold defined
    if (!PERFORMANCE_CONFIG.warningThresholds[name]) {
      return;
    }

    const threshold = PERFORMANCE_CONFIG.warningThresholds[name];
    const isViolation = name === 'fps' ? value < threshold : value > threshold;

    if (isViolation) {
      // Don't spam warnings - limit to one per second per metric
      const now = performance.now();
      if (!this.lastWarningTimes[name] || now - this.lastWarningTimes[name] > 1000) {
        this.lastWarningTimes[name] = now;

        // Format the warning message
        const warningMessage = `${name} ${value.toFixed(2)} ${name === 'fps' ? 'below' : 'exceeds'} target of ${threshold}`;

        // Always log to console
        console.warn(`Performance warning: ${warningMessage}`);

        // Count violations
        this.budgetViolations.set(name, (this.budgetViolations.get(name) || 0) + 1);

        // Log to debug manager if available
        const debugManager = this.safelyGet(this.game, 'debugManager');
        if (debugManager && typeof debugManager.warn === 'function') {
          debugManager.warn('PerformanceManager', warningMessage);
        }
      }
    }
  }

  /**
   * Mark the beginning of a new frame
   */
  beginFrame() {
    if (!this.enabled) {
      return;
    }

    this.frameStartTime = performance.now();
    this.isFrameActive = true;

    // Start timers for this frame
    this.startTimer('physics');
    this.startTimer('logic');
  }

  /**
   * Mark the end of the current frame and update metrics
   */
  endFrame() {
    if (!this.enabled || !this.isFrameActive) {
      return;
    }

    this.isFrameActive = false;
    const now = performance.now();
    const frameTime = now - this.frameStartTime;

    // Update frame time metrics
    this.metrics.frameTime.current = frameTime;
    this.metrics.frameTime.samples.push(frameTime);
    this.metrics.frameTime.min = Math.min(this.metrics.frameTime.min, frameTime);
    this.metrics.frameTime.max = Math.max(this.metrics.frameTime.max, frameTime);

    if (this.metrics.frameTime.samples.length > this.sampleSize) {
      this.metrics.frameTime.samples.shift();
    }

    this.metrics.frameTime.avg =
      this.metrics.frameTime.samples.reduce((a, b) => a + b, 0) /
      this.metrics.frameTime.samples.length;

    // Calculate FPS
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      this.metrics.fps.current = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.metrics.fps.samples.push(this.metrics.fps.current);
      this.metrics.fps.min = Math.min(this.metrics.fps.min, this.metrics.fps.current);
      this.metrics.fps.max = Math.max(this.metrics.fps.max, this.metrics.fps.current);

      if (this.metrics.fps.samples.length > this.sampleSize) {
        this.metrics.fps.samples.shift();
      }

      this.metrics.fps.avg =
        this.metrics.fps.samples.reduce((a, b) => a + b, 0) / this.metrics.fps.samples.length;

      // Check FPS budget
      this.checkBudget('fps', this.metrics.fps.current);

      // Reset for next second
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    // Check frame time budget
    this.checkBudget('frameTime', frameTime);

    // Update memory stats occasionally (every 60 frames)
    if (this.frameCount % 60 === 0) {
      this.updateMemoryStats();
    }

    // Update the display if needed
    if (this.displayEnabled && now - this.lastDisplayUpdate > this.displayUpdateInterval) {
      this.updatePerformanceDisplay();
      this.lastDisplayUpdate = now;
    }
  }

  /**
   * Update memory statistics
   */
  updateMemoryStats() {
    try {
      // Get memory info if available
      if (this.safelyGet(window, 'performance.memory')) {
        const memoryInfo = window.performance.memory;
        this.metrics.memory.jsHeapSize = memoryInfo.jsHeapSizeLimit;
        this.metrics.memory.usedJSHeapSize = memoryInfo.usedJSHeapSize;
      }

      // Count Three.js objects
      const scene = this.safelyGet(this.game, 'scene');
      if (scene && typeof scene.traverse === 'function') {
        let objectCount = 0;
        scene.traverse(() => {
          objectCount++;
        });
        this.metrics.objects.three = objectCount;
      } else {
        this.metrics.objects.three = 0;
      }

      // Count physics bodies
      const bodies = this.safelyGet(this.game, 'physicsManager.world.bodies');
      if (Array.isArray(bodies)) {
        this.metrics.objects.physics = bodies.length;
      } else {
        this.metrics.objects.physics = 0;
      }
    } catch (error) {
      // Log error but don't crash
      console.warn('Error updating memory stats:', error);

      // Set default values
      this.metrics.objects.three = 0;
      this.metrics.objects.physics = 0;
    }
  }

  /**
   * Get a summary of performance data
   * @returns {Object} Performance summary
   */
  getPerformanceData() {
    // Helper function to safely format numbers
    const safeFormat = value => {
      return value !== undefined && value !== null && !isNaN(value)
        ? Number(value).toFixed(2)
        : '0.00';
    };

    return {
      fps: {
        current: this.metrics.fps.current || 0,
        avg: Math.round(this.metrics.fps.avg || 0),
        min: isFinite(this.metrics.fps.min) ? this.metrics.fps.min : 0,
        max: this.metrics.fps.max || 0
      },
      frameTime: {
        current: safeFormat(this.metrics.frameTime.current),
        avg: safeFormat(this.metrics.frameTime.avg),
        min: safeFormat(this.metrics.frameTime.min),
        max: safeFormat(this.metrics.frameTime.max)
      },
      physics: {
        current: safeFormat(this.metrics.physics.current),
        avg: safeFormat(this.metrics.physics.avg)
      },
      render: {
        current: safeFormat(this.metrics.render.current),
        avg: safeFormat(this.metrics.render.avg)
      },
      memory: {
        usedMB: this.metrics.memory.usedJSHeapSize
          ? (this.metrics.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2)
          : 'N/A',
        totalMB: this.metrics.memory.jsHeapSize
          ? (this.metrics.memory.jsHeapSize / (1024 * 1024)).toFixed(2)
          : 'N/A'
      },
      objects: {
        three: this.metrics.objects.three || 0,
        physics: this.metrics.objects.physics || 0
      }
    };
  }

  /**
   * Create the performance display overlay
   */
  createPerformanceDisplay() {
    try {
      if (!document || !document.body) {
        // Document not ready, disable display
        this.displayEnabled = false;
        return;
      }

      if (document.getElementById('performance-display')) {
        this.performanceDisplay = document.getElementById('performance-display');
        return;
      }

      this.performanceDisplay = document.createElement('div');
      this.performanceDisplay.id = 'performance-display';
      this.performanceDisplay.style.position = 'fixed';
      this.performanceDisplay.style.top = '10px';
      this.performanceDisplay.style.right = '10px';
      this.performanceDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      this.performanceDisplay.style.color = '#00FF00';
      this.performanceDisplay.style.padding = '10px';
      this.performanceDisplay.style.fontFamily = 'monospace';
      this.performanceDisplay.style.fontSize = '12px';
      this.performanceDisplay.style.zIndex = '1000';
      this.performanceDisplay.style.borderRadius = '5px';
      this.performanceDisplay.style.display = this.displayEnabled ? 'block' : 'none';

      document.body.appendChild(this.performanceDisplay);
    } catch (error) {
      console.warn('Error creating performance display:', error);
      this.displayEnabled = false;
    }
  }

  /**
   * Update the performance display with current metrics
   */
  updatePerformanceDisplay() {
    if (!this.performanceDisplay) {
      return;
    }

    try {
      const data = this.getPerformanceData();
      let html = `<div style="font-weight: bold; margin-bottom: 5px;">PERFORMANCE (${PERFORMANCE_CONFIG.toggleKey} to toggle)</div>`;

      // FPS with color coding
      const fpsColor =
        data.fps.current < PERFORMANCE_CONFIG.warningThresholds.fps ? '#FF5555' : '#55FF55';
      html += `<div>FPS: <span style="color: ${fpsColor}">${data.fps.current}</span> (avg: ${data.fps.avg}, min: ${data.fps.min})</div>`;

      // Frame time with color coding
      const frameTimeColor =
        data.frameTime.current > PERFORMANCE_CONFIG.warningThresholds.frameTime
          ? '#FF5555'
          : '#55FF55';
      html += `<div>Frame: <span style="color: ${frameTimeColor}">${data.frameTime.current}ms</span> (avg: ${data.frameTime.avg}ms)</div>`;

      // Timing breakdowns
      html += `<div>Physics: ${data.physics.current}ms (avg: ${data.physics.avg}ms)</div>`;
      html += `<div>Render: ${data.render.current}ms (avg: ${data.render.avg}ms)</div>`;

      // Memory usage
      html += `<div>Memory: ${data.memory.usedMB}MB / ${data.memory.totalMB}MB</div>`;

      // Object counts
      html += `<div>Objects: ${data.objects.three} (Three.js), ${data.objects.physics} (Physics)</div>`;

      this.performanceDisplay.innerHTML = html;
    } catch (error) {
      console.warn('Error updating performance display:', error);
    }
  }

  /**
   * Get the performance data as a formatted string for debug output
   * @returns {string} Formatted performance data
   */
  getDebugString() {
    const data = this.getPerformanceData();
    return `FPS: ${data.fps.current} | Frame: ${data.frameTime.current}ms | Physics: ${data.physics.current}ms | Render: ${data.render.current}ms`;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    try {
      // Remove event listener using the stored reference
      if (window && this.boundHandleKeyPress) {
        window.removeEventListener('keydown', this.boundHandleKeyPress);
      }

      // Remove UI elements
      if (this.performanceDisplay && this.performanceDisplay.parentNode) {
        this.performanceDisplay.parentNode.removeChild(this.performanceDisplay);
      }

      // Clear data
      this.markers = {};
    } catch (error) {
      console.warn('Error during PerformanceManager cleanup:', error);
    }

    return this;
  }
}
