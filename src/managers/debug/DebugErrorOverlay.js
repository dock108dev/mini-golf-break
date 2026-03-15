import { debug } from '../../utils/debug';
/**
 * DebugErrorOverlay - Manages the UI overlay for displaying critical errors.
 */
export class DebugErrorOverlay {
  constructor(parentManager, parentContainer = document.body) {
    this.parentManager = parentManager; // Reference to DebugManager (or main game)
    this.parentContainer = parentContainer;
    this.errorOverlay = null;

    // Styling constants or classes
    this.OVERLAY_ID = 'error-overlay';
    this.CLOSE_BUTTON_STYLE = `
            position: absolute;
            right: 5px;
            top: 5px;
            background: transparent;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
        `;
    this.OVERLAY_STYLE = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            right: 10px;
            background-color: rgba(255, 0, 0, 0.8);
            color: white;
            padding: 10px;
            font-family: monospace;
            font-size: 14px;
            z-index: 1000;
            display: none;
            border-radius: 5px;
            max-height: 30%;
            overflow-y: auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        `;
    this.ERROR_ITEM_STYLE = `
             margin-bottom: 5px;
             border-bottom: 1px solid rgba(255,255,255,0.3);
             padding-bottom: 5px;
        `;
  }

  /**
   * Initialize and create the error overlay DOM element.
   */
  init() {
    // Check if we're in a test environment without proper DOM support
    if (typeof document === 'undefined') {
      console.warn(
        '[DebugErrorOverlay] DOM not available, skipping initialization in test environment.'
      );
      return;
    }

    // Check if element already exists
    this.errorOverlay = document.getElementById(this.OVERLAY_ID);
    if (this.errorOverlay) {
      debug.log('[DebugErrorOverlay] Found existing error overlay.');
      return; // Already initialized
    }

    debug.log('[DebugErrorOverlay] Creating error overlay element...');
    this.errorOverlay = document.createElement('div');
    this.errorOverlay.id = this.OVERLAY_ID;
    this.errorOverlay.style.cssText = this.OVERLAY_STYLE;

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×'; // Use multiplication sign for better visuals
    closeButton.style.cssText = this.CLOSE_BUTTON_STYLE;
    closeButton.addEventListener('click', () => {
      this.hide();
    });

    this.errorOverlay.appendChild(closeButton);
    this.parentContainer.appendChild(this.errorOverlay);
    debug.log('[DebugErrorOverlay] Error overlay initialized.');
  }

  /**
   * Show an error message in the overlay.
   * @param {string} message - The error message text.
   */
  showError(message) {
    if (!this.errorOverlay) {
      console.warn('[DebugErrorOverlay] Overlay not initialized, cannot show error.');
      this.init(); // Attempt to initialize if not already
      if (!this.errorOverlay) {
        return;
      } // Still failed
    }

    // Check if we're in a test environment without proper DOM support
    if (typeof document === 'undefined' || !this.errorOverlay.appendChild) {
      console.warn(
        '[DebugErrorOverlay] DOM methods not available, skipping error display in test environment.'
      );
      return;
    }

    debug.log(`[DebugErrorOverlay] Displaying error: ${message}`);
    // Create error message element
    const errorElement = document.createElement('div');
    errorElement.textContent = message;
    errorElement.style.cssText = this.ERROR_ITEM_STYLE;

    // Insert after the close button
    if (this.errorOverlay.children && this.errorOverlay.children.length > 0) {
      this.errorOverlay.insertBefore(errorElement, this.errorOverlay.children[1]);
    } else {
      this.errorOverlay.appendChild(errorElement); // Fallback if no close button
    }

    // Make overlay visible
    this.show();

    // Auto-remove the specific error message after a delay (e.g., 15 seconds)
    const errorTimeout = 15000;
    setTimeout(() => {
      if (errorElement.parentNode === this.errorOverlay) {
        errorElement.remove();
        debug.log(
          `[DebugErrorOverlay] Auto-removed error message: ${message.substring(0, 50)}...`
        );
        // Optionally hide overlay if no more errors are present
        this.hideIfEmpty();
      }
    }, errorTimeout);
  }

  /**
   * Make the error overlay visible.
   */
  show() {
    if (this.errorOverlay) {
      this.errorOverlay.style.display = 'block';
    }
  }

  /**
   * Hide the error overlay.
   */
  hide() {
    if (this.errorOverlay) {
      this.errorOverlay.style.display = 'none';
      debug.log('[DebugErrorOverlay] Overlay hidden by user.');
    }
  }

  /**
   * Hide the overlay only if it contains no error messages (only the close button).
   */
  hideIfEmpty() {
    if (this.errorOverlay && this.errorOverlay.children && this.errorOverlay.children.length <= 1) {
      this.hide();
      debug.log('[DebugErrorOverlay] Overlay hidden automatically as it is empty.');
    }
  }

  /**
   * Clean up and remove the overlay from the DOM.
   */
  cleanup() {
    this.errorOverlay?.remove();
    this.errorOverlay = null;
    debug.log('[DebugErrorOverlay] Cleaned up.');
  }
}
