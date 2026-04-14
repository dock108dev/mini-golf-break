import { debug } from '../../utils/debug';
import { DEBUG_CONFIG } from '../DebugManager';
import { isIsolationMode, setIsolationMode, isDevHarnessActive } from '../../utils/devHoleHarness';

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
      debug.log('[DebugCourseUI] Found existing course debug overlay.');
      // Ensure event listener is attached even if UI exists
      this.removeInputListener(); // Remove first to prevent duplicates
      this.addInputListener();
      this.updateDisplay(); // Update display on init
      return;
    }

    debug.log('[DebugCourseUI] Creating course debug overlay element...');
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
            Load Hole #: [${DEBUG_CONFIG.courseDebug.loadSpecificHoleKey}] <br>
            Quick Load: [1-9]
        `;
    this.courseDebugUI.appendChild(keyInfo);

    // Add hole selector dropdown (dev harness)
    if (isDevHarnessActive()) {
      this.createHoleDropdown();
    }

    document.body.appendChild(this.courseDebugUI);

    // Add listener for key presses
    this.addInputListener();

    // Update initial display state
    this.updateDisplay();
    debug.log('[DebugCourseUI] Initialized.');
  }

  /**
   * Add the keydown event listener.
   */
  addInputListener() {
    // Only add if course debug is enabled in config
    if (DEBUG_CONFIG.courseDebug.enabled) {
      window.addEventListener('keydown', this.boundHandleKeyPress);
      debug.log('[DebugCourseUI] Added keydown listener.');
    }
  }

  /**
   * Remove the keydown event listener.
   */
  removeInputListener() {
    window.removeEventListener('keydown', this.boundHandleKeyPress);
    debug.log('[DebugCourseUI] Removed keydown listener.');
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

    // Load specific hole (h key)
    if (e.key === courseDebugConfig.loadSpecificHoleKey) {
      debug.log('[DebugCourseUI] Load Specific Hole key pressed.');
      this.debugManager.promptForHoleNumber(); // Delegate to parent manager
      e.preventDefault();
    }

    // Quick load specific hole (number keys 1-9)
    if (Object.keys(courseDebugConfig.quickLoadKeys).includes(e.key)) {
      const holeNumber = courseDebugConfig.quickLoadKeys[e.key];
      debug.log(`[DebugCourseUI] Quick Load key pressed: ${holeNumber}`);
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
        typeElement.textContent = 'Course: Orbital Drift';
      }
      if (holeElement) {
        holeElement.textContent = `Current Hole: ${state.currentHole}`;
      }
      if (this.holeDropdown) {
        this.holeDropdown.value = state.currentHole;
      }
    }
  }

  /**
   * Create hole selector dropdown and isolation toggle for dev harness.
   */
  createHoleDropdown() {
    const container = document.createElement('div');
    container.style.marginTop = '8px';
    container.style.borderTop = '1px solid #00FF00';
    container.style.paddingTop = '6px';

    const label = document.createElement('div');
    label.style.fontSize = '11px';
    label.style.marginBottom = '4px';
    label.textContent = 'SKIP TO HOLE:';
    container.appendChild(label);

    this.holeDropdown = document.createElement('select');
    this.holeDropdown.id = 'dev-hole-select';
    this.holeDropdown.style.cssText =
      'width: 100%; background: #111; color: #0f0; border: 1px solid #0f0; ' +
      'font-family: monospace; font-size: 12px; padding: 2px;';

    this.populateHoleDropdown();

    this.holeDropdown.addEventListener('change', () => {
      const holeNumber = parseInt(this.holeDropdown.value, 10);
      if (holeNumber > 0 && this.game.stateManager) {
        debug.log(`[DebugCourseUI] Dropdown: skipping to hole ${holeNumber}`);
        this.game.stateManager.skipToHole(holeNumber);
      }
    });
    container.appendChild(this.holeDropdown);

    const isolateLabel = document.createElement('label');
    isolateLabel.style.cssText =
      'display: flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 11px;';

    this.isolateCheckbox = document.createElement('input');
    this.isolateCheckbox.type = 'checkbox';
    this.isolateCheckbox.checked = isIsolationMode();
    this.isolateCheckbox.addEventListener('change', () => {
      setIsolationMode(this.isolateCheckbox.checked);
      debug.log(`[DebugCourseUI] Isolation mode: ${this.isolateCheckbox.checked}`);
    });
    isolateLabel.appendChild(this.isolateCheckbox);
    isolateLabel.appendChild(document.createTextNode('Isolation mode'));
    container.appendChild(isolateLabel);

    this.courseDebugUI.appendChild(container);
  }

  /**
   * Populate hole dropdown with hole names from course configs.
   */
  populateHoleDropdown() {
    if (!this.holeDropdown) {
      return;
    }
    this.holeDropdown.innerHTML = '';

    const configs = this.game.course?.holeConfigs;
    if (!configs) {
      return;
    }

    for (let i = 0; i < configs.length; i++) {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = configs[i].description || `Hole ${i + 1}`;
      this.holeDropdown.appendChild(opt);
    }

    const currentHole = this.game.stateManager?.getCurrentHoleNumber() || 1;
    this.holeDropdown.value = currentHole;
  }

  /**
   * Clean up UI elements and event listeners.
   */
  cleanup() {
    this.removeInputListener();
    this.courseDebugUI?.remove();
    this.courseDebugUI = null;
    debug.log('[DebugCourseUI] Cleaned up.');
  }
}
