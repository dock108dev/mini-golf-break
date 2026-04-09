import { debug } from './utils/debug';
import { Game } from './scenes/Game';
import { HighScoreManager } from './game/HighScoreManager';
import { isWebGLAvailable, showWebGLFallback } from './utils/webglDetect';
import '../public/style.css';

class App {
  constructor() {
    this.game = new Game();
    this.isGameRunning = false;
    this.menuScreen = document.getElementById('menu-screen');
    this.setupEventListeners();
    this.updateBestScoreDisplay();
  }

  setupEventListeners() {
    // Add click event for the play course button
    const playCourseButton = document.getElementById('play-course');
    if (playCourseButton) {
      debug.log('[App] Adding click listener to Play Course button.');
      playCourseButton.addEventListener('click', () => {
        debug.log('[App] Play Course button CLICKED.');
        this.startCourse();
      });
    }

    // How to Play button on menu screen
    const howToPlayButton = document.getElementById('how-to-play-menu');
    if (howToPlayButton) {
      howToPlayButton.addEventListener('click', () => {
        this.showControlsOverlay();
      });
    }

    // Controls overlay close button
    const controlsCloseButton = document.getElementById('controls-close');
    if (controlsCloseButton) {
      controlsCloseButton.addEventListener('click', () => {
        this.hideControlsOverlay();
      });
    }

    // Trap focus within menu screen when visible
    if (this.menuScreen) {
      this.menuScreen.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') {
          return;
        }
        const focusableElements = this.menuScreen.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) {
          return;
        }
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      });
    }
  }

  /**
   * Initialize visual systems on page load so the menu has a backdrop.
   */
  async initVisuals() {
    debug.log('[App.initVisuals] Starting...');
    const loadingScreen = document.getElementById('loading-screen');
    try {
      await this.game.initVisuals();
      debug.log('[App.initVisuals] Finished successfully.');
      // Dismiss loading screen and show menu
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
      }
      if (this.menuScreen) {
        this.menuScreen.style.display = '';
      }
    } catch (error) {
      console.error('[App.initVisuals] CRITICAL: Failed to initialize visuals:', error);
      // Replace loading indicator with error message
      if (loadingScreen) {
        const spinner = document.getElementById('loading-spinner');
        const loadingText = document.getElementById('loading-text');
        if (spinner) spinner.remove();
        if (loadingText) loadingText.remove();
        const errorMsg = document.createElement('p');
        errorMsg.className = 'loading-error';
        errorMsg.textContent =
          'Failed to load the game. Please refresh the page and try again.';
        loadingScreen.appendChild(errorMsg);
      }
    }
  }

  /**
   * Update the best score display on the menu screen.
   */
  updateBestScoreDisplay() {
    const bestScoreEl = document.getElementById('menu-best-score');
    if (!bestScoreEl) return;

    const bestScore = HighScoreManager.getBestScore('Orbital Drift');
    if (bestScore !== null) {
      bestScoreEl.textContent = `Personal Best: ${bestScore} strokes`;
      bestScoreEl.style.display = '';
    } else {
      bestScoreEl.style.display = 'none';
    }
  }

  /**
   * Return to the menu/welcome screen after game completion.
   * Cleans up the current game and shows the start screen.
   */
  returnToMenu() {
    debug.log('[App] returnToMenu called. Returning to start screen.');

    // Hide the scorecard overlay if visible
    const scorecard = document.getElementById('scorecard-overlay');
    if (scorecard) {
      scorecard.remove();
    }

    // Clean up the current game
    if (this.game) {
      this.game.cleanup();
    }

    // Create a fresh game instance and re-initialize visuals
    this.game = new Game();
    window.game = this.game;
    this.isGameRunning = false;

    // Show the menu screen
    if (this.menuScreen) {
      this.menuScreen.style.display = '';
      // Focus the Play button for keyboard accessibility
      const playButton = document.getElementById('play-course');
      if (playButton) {
        playButton.focus();
      }
    }

    // Update best score display (may have changed after game completion)
    this.updateBestScoreDisplay();

    // Re-initialize visuals so the menu has a backdrop
    this.game.initVisuals();
  }

  showControlsOverlay() {
    const overlay = document.getElementById('controls-overlay');
    if (overlay) {
      overlay.style.display = '';
      overlay.classList.add('visible');
      const closeButton = document.getElementById('controls-close');
      if (closeButton) {
        closeButton.focus();
      }
    }
  }

  hideControlsOverlay() {
    const overlay = document.getElementById('controls-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      overlay.style.display = 'none';
    }
  }

  async startCourse() {
    debug.log('[App] startCourse called.');
    // Hide the menu screen
    if (this.menuScreen) {
      debug.log('[App] Hiding menu screen.');
      this.menuScreen.style.display = 'none';
    }

    // Start the game if not already running
    if (!this.isGameRunning) {
      debug.log('[App] Game not running, calling game.startGame()...');
      try {
        await this.game.startGame();
        debug.log('[App] game.startGame() finished.');
        this.isGameRunning = true;
      } catch (error) {
        console.error('[App] CRITICAL: Failed to start game:', error);
        // Show error message to user
        if (this.menuScreen) {
          this.menuScreen.style.display = 'block';
          const errorMessage = document.createElement('div');
          errorMessage.style.color = 'red';
          errorMessage.style.marginTop = '20px';
          errorMessage.textContent = 'Failed to start game. Please refresh the page.';
          this.menuScreen.appendChild(errorMessage);
        }
        return;
      }
    } else {
      debug.log('[App] Game already running.');
    }

    // Enable game input
    debug.log('[App] Enabling game input...');
    this.game.enableGameInput();
    debug.log('[App] startCourse finished.');
  }
}

// Start the application when the window loads
window.addEventListener('load', async () => {
  if (!isWebGLAvailable()) {
    showWebGLFallback();
    return;
  }

  window.App = new App();
  // Also expose game for easier testing access
  window.game = window.App.game;
  // Initialize visual systems immediately so the menu has a space backdrop
  await window.App.initVisuals();
});
