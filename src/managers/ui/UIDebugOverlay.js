import { debug } from '../../utils/debug';

/**
 * UIDebugOverlay - Handles the debug information overlay UI.
 */
export class UIDebugOverlay {
  constructor(game, parentContainer) {
    this.game = game;
    this.parentContainer = parentContainer;

    // UI Element
    this.debugElement = null;

    // Styling constant
    this.DEBUG_OVERLAY_CLASS = 'debug-overlay';
  }

  /**
   * Initialize and create the debug overlay element.
   */
  init() {
    // Create debug display element if it doesn't exist
    this.debugElement = this.parentContainer.querySelector(`.${this.DEBUG_OVERLAY_CLASS}`);
    if (!this.debugElement) {
      this.debugElement = document.createElement('div');
      this.debugElement.classList.add(this.DEBUG_OVERLAY_CLASS);
      this.parentContainer.appendChild(this.debugElement);
    }
    this.debugElement.style.display = 'none'; // Hidden by default
    debug.log('[UIDebugOverlay] Initialized.');
  }

  /**
   * Update the debug display with new information.
   * @param {object} debugInfo - Object containing debug data (e.g., fps, ballPos, etc.)
   */
  updateDebugDisplay(debugInfo) {
    if (!this.debugElement) {
      return;
    }

    // Only update if debug mode is enabled in DebugManager
    if (!this.game.debugManager?.enabled) {
      if (this.debugElement.style.display !== 'none') {
        this.debugElement.style.display = 'none'; // Ensure hidden
        debug.log('[UIDebugOverlay] Hiding debug overlay.');
      }
      return;
    }

    // Make visible if it wasn't already
    if (this.debugElement.style.display === 'none') {
      this.debugElement.style.display = 'block';
      debug.log('[UIDebugOverlay] Showing debug overlay.');
    }

    // Format the debug information using safe DOM construction
    this.debugElement.textContent = '';
    for (const key in debugInfo) {
      let value = debugInfo[key];
      // Format vectors/objects nicely
      if (typeof value === 'object' && value !== null) {
        if (value.x !== undefined && value.y !== undefined && value.z !== undefined) {
          // Vector3 like
          value = `(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)})`;
        } else {
          value = JSON.stringify(value); // Fallback for other objects
        }
      }
      // Format numbers
      if (typeof value === 'number') {
        value = value.toFixed(2);
      }
      const row = document.createElement('div');
      const label = document.createElement('strong');
      label.textContent = `${key}: `;
      row.appendChild(label);
      row.appendChild(document.createTextNode(value));
      this.debugElement.appendChild(row);
    }
  }

  /**
   * Cleanup the debug element.
   */
  cleanup() {
    this.debugElement?.remove();
    this.debugElement = null;
    debug.log('[UIDebugOverlay] Cleaned up.');
  }
}
