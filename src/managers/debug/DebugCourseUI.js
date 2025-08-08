import { DEBUG_CONFIG } from '../DebugManager'; // Need config for keys

/**
 * DebugCourseUI - Manages the UI overlay and input for course debugging.
 */
export class DebugCourseUI {
  constructor(debugManager) {
    this.debugManager = debugManager; // Reference to the parent manager
    this.game = debugManager.game; // Convenience reference
    this.courseDebugUI = null;

    // Styling constants
    this.OVERLAY_ID = 'course-debug-overlay';
    this.STYLE = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background-color: rgba(0, 0, 0, 0.7);
            color: #00FF00; /* Green text */
            padding: 10px;
            font-family: monospace;
            font-size: 14px;
            z-index: 1000;
            border-radius: 5px;
            display: none; /* Hidden by default */
            min-width: 200px;
            border: 1px solid #00FF00;
        `;
    this.HEADER_STYLE = `
            font-weight: bold;
            margin-bottom: 5px;
            border-bottom: 1px solid #00FF00;
            padding-bottom: 3px;
            text-align: center;
        `;
    this.INFO_STYLE = 'margin-bottom: 5px;';

    // Bound event handler
    this.boundHandleKeyPress = this.handleKeyPress.bind(this);
  }

  /**
   * Initialize UI elements and event listeners.
   */
  init() {
    // Check if UI already exists
    this.courseDebugUI = document.getElementById(this.OVERLAY_ID);
    if (this.courseDebugUI) {
      // Ensure event listener is attached even if UI exists
      this.removeInputListener(); // Remove first to prevent duplicates
      this.addInputListener();
      this.updateDisplay(); // Update display on init
      return;
    }

    this.courseDebugUI = document.createElement('div');
    this.courseDebugUI.id = this.OVERLAY_ID;
    this.courseDebugUI.style.cssText = this.STYLE;

    // Add header
    const header = document.createElement('div');
    header.textContent = 'COURSE DEBUG';
    header.style.cssText = this.HEADER_STYLE;
    this.courseDebugUI.appendChild(header);

    // Add course type info container
    const courseTypeContainer = document.createElement('div');
    courseTypeContainer.id = 'course-debug-type';
    courseTypeContainer.style.cssText = this.INFO_STYLE;
    this.courseDebugUI.appendChild(courseTypeContainer);

    // Add current hole info container
    const holeContainer = document.createElement('div');
    holeContainer.id = 'course-debug-hole';
    holeContainer.style.cssText = this.INFO_STYLE;
    this.courseDebugUI.appendChild(holeContainer);

    // Add key info
    const keyInfo = document.createElement('div');
    keyInfo.style.marginTop = '8px';
    keyInfo.style.fontSize = '12px';
    keyInfo.innerHTML = `
            Toggle Type: [${DEBUG_CONFIG.courseDebug.toggleCourseTypeKey}] <br>
            Load Hole #: [${DEBUG_CONFIG.courseDebug.loadSpecificHoleKey}] <br>
            Quick Load: [1-9]
        `;
    this.courseDebugUI.appendChild(keyInfo);

    document.body.appendChild(this.courseDebugUI);

    // Add listener for key presses
    this.addInputListener();

    // Update initial display state
    this.updateDisplay();
  }

  /**
   * Add the keydown event listener.
   */
  addInputListener() {
    // Only add if course debug is enabled in config
    if (DEBUG_CONFIG.courseDebug.enabled) {
      window.addEventListener('keydown', this.boundHandleKeyPress);
    }
  }

  /**
   * Remove the keydown event listener.
   */
  removeInputListener() {
    window.removeEventListener('keydown', this.boundHandleKeyPress);
  }

  /**
   * Handle key presses for course debug actions.
   * @param {KeyboardEvent} e
   */
  handleKeyPress(e) {
    // IMPORTANT: Only process keys if the main debug mode is enabled
    if (!this.debugManager.enabled) {
      return;
    }

    const courseDebugConfig = DEBUG_CONFIG.courseDebug;

    // Toggle course type (c key)
    if (e.key === courseDebugConfig.toggleCourseTypeKey) {
      this.debugManager.toggleCourseType(); // Delegate to parent manager
      e.preventDefault(); // Prevent potential browser shortcuts
    }

    // Load specific hole (h key)
    if (e.key === courseDebugConfig.loadSpecificHoleKey) {
      this.debugManager.promptForHoleNumber(); // Delegate to parent manager
      e.preventDefault();
    }

    // Quick load specific hole (number keys 1-9)
    if (Object.keys(courseDebugConfig.quickLoadKeys).includes(e.key)) {
      const holeNumber = courseDebugConfig.quickLoadKeys[e.key];

      this.debugManager.loadSpecificHole(holeNumber); // Delegate to parent manager
      e.preventDefault();
    }
  }

  /**
   * Update the displayed information in the course debug UI.
   */
  updateDisplay() {
    if (!this.courseDebugUI) {
      return;
    }

    // Show/hide based on main debug manager state
    this.courseDebugUI.style.display = this.debugManager.enabled ? 'block' : 'none';

    if (this.debugManager.enabled) {
      const state = this.debugManager.courseDebugState;
      const typeElement = this.courseDebugUI.querySelector('#course-debug-type');
      const holeElement = this.courseDebugUI.querySelector('#course-debug-hole');

      if (typeElement) {
        typeElement.textContent = `Course Type: ${state.courseType}`;
      }
      if (holeElement) {
        holeElement.textContent = `Current Hole: ${state.currentHole}`;
      }
    }
  }

  /**
   * Clean up UI elements and event listeners.
   */
  cleanup() {
    this.removeInputListener();
    this.courseDebugUI?.remove();
    this.courseDebugUI = null;
  }
}
