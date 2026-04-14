import * as THREE from 'three';
import { debug } from './utils/debug';
import { Game } from './scenes/Game';
import { HighScoreManager } from './game/HighScoreManager';
import { isWebGLAvailable, showWebGLFallback } from './utils/webglDetect';
import { parseDevParams, getInitialHoleNumber, setupConfigHotReload } from './utils/devHoleHarness';
import '../public/style.css';

// Expose THREE for UAT (Playwright page.evaluate needs Vector3.clone in BallManager.hitBall)
if (typeof window !== 'undefined') {
  window.THREE = THREE;
}

const COURSE_NAME = 'Orbital Drift';
const COURSE_PAR = 24;

class App {
  constructor() {
    this.game = new Game();
    this.isGameRunning = false;
    this.menuScreen = document.getElementById('menu-screen');
    this._clearConfirmPending = false;
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

    // Scores button on menu screen
    const scoresButton = document.getElementById('scores-menu');
    if (scoresButton) {
      scoresButton.addEventListener('click', () => {
        this.showScoresOverlay();
      });
    }

    // Scores overlay close button
    const scoresCloseButton = document.getElementById('scores-close');
    if (scoresCloseButton) {
      scoresCloseButton.addEventListener('click', () => {
        this.hideScoresOverlay();
      });
    }

    // Scores overlay clear button
    const scoresClearButton = document.getElementById('scores-clear');
    if (scoresClearButton) {
      scoresClearButton.addEventListener('click', () => {
        this._handleClearScores();
      });
    }

    // Scores overlay keyboard and focus trap
    const scoresOverlay = document.getElementById('scores-overlay');
    if (scoresOverlay) {
      scoresOverlay.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.hideScoresOverlay();
          return;
        }
        this._trapFocus(e, scoresOverlay);
      });
    }

    // Trap focus within menu screen when visible
    if (this.menuScreen) {
      this.menuScreen.addEventListener('keydown', e => {
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
        if (spinner) {
          spinner.remove();
        }
        if (loadingText) {
          loadingText.remove();
        }
        const errorMsg = document.createElement('p');
        errorMsg.className = 'loading-error';
        errorMsg.textContent = 'Failed to load the game. Please refresh the page and try again.';
        loadingScreen.appendChild(errorMsg);
      }
    }
  }

  /**
   * Update the best score display on the menu screen.
   */
  updateBestScoreDisplay() {
    const bestScoreEl = document.getElementById('menu-best-score');
    if (!bestScoreEl) {
      return;
    }

    const bestScore = HighScoreManager.getBestScore(COURSE_NAME);
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

  showScoresOverlay() {
    const overlay = document.getElementById('scores-overlay');
    if (!overlay) {
      return;
    }
    this._clearConfirmPending = false;
    this._renderScoresBody();
    overlay.style.display = '';
    overlay.classList.add('visible');
    const closeButton = document.getElementById('scores-close');
    if (closeButton) {
      closeButton.focus();
    }
  }

  hideScoresOverlay() {
    const overlay = document.getElementById('scores-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      overlay.style.display = 'none';
    }
    this._clearConfirmPending = false;
    const clearButton = document.getElementById('scores-clear');
    if (clearButton) {
      clearButton.textContent = 'Clear Scores';
    }
    const scoresButton = document.getElementById('scores-menu');
    if (scoresButton) {
      scoresButton.focus();
    }
  }

  _renderScoresBody() {
    const body = document.getElementById('scores-body');
    if (!body) {
      return;
    }

    const scores = HighScoreManager.getScores(COURSE_NAME);

    if (scores.length === 0) {
      body.innerHTML = '<p class="scores-empty">No rounds played yet</p>';
      const clearButton = document.getElementById('scores-clear');
      if (clearButton) {
        clearButton.style.display = 'none';
      }
      return;
    }

    const clearButton = document.getElementById('scores-clear');
    if (clearButton) {
      clearButton.style.display = '';
    }

    const rows = scores
      .map((score, i) => {
        const diff = score.totalStrokes - COURSE_PAR;
        let parText;
        let parClass;
        if (diff < 0) {
          parText = `${diff}`;
          parClass = 'score-under-par';
        } else if (diff > 0) {
          parText = `+${diff}`;
          parClass = 'score-over-par';
        } else {
          parText = 'E';
          parClass = 'score-even-par';
        }
        const date = new Date(score.timestamp).toLocaleDateString();
        return (
          '<tr>' +
          `<td>${i + 1}</td>` +
          `<td>${score.totalStrokes}</td>` +
          `<td class="${parClass}">${parText}</td>` +
          `<td>${date}</td>` +
          '</tr>'
        );
      })
      .join('');

    body.innerHTML =
      '<table class="scores-table">' +
      '<thead><tr><th>#</th><th>Strokes</th><th>+/- Par</th><th>Date</th></tr></thead>' +
      `<tbody>${rows}</tbody>` +
      '</table>';
  }

  _handleClearScores() {
    const clearButton = document.getElementById('scores-clear');
    if (!clearButton) {
      return;
    }

    if (!this._clearConfirmPending) {
      this._clearConfirmPending = true;
      clearButton.textContent = 'Confirm Clear?';
      return;
    }

    HighScoreManager.clearScores(COURSE_NAME);
    this._clearConfirmPending = false;
    clearButton.textContent = 'Clear Scores';
    this._renderScoresBody();
    this.updateBestScoreDisplay();
  }

  _trapFocus(e, container) {
    if (e.key !== 'Tab') {
      return;
    }
    const focusableElements = container.querySelectorAll(
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

        // Dev harness: skip to URL-specified hole after game starts
        if (process.env.NODE_ENV === 'development') {
          const initialHole = getInitialHoleNumber();
          if (initialHole && initialHole > 1) {
            debug.log(`[App] Dev harness: skipping to hole ${initialHole}`);
            await this.game.stateManager.skipToHole(initialHole);
          }
          setupConfigHotReload(this.game);
        }
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

  // Dev harness: parse URL params early (total holes count is approximate until course loads)
  if (process.env.NODE_ENV === 'development') {
    parseDevParams(18);
  }

  window.App = new App();
  // Also expose game for easier testing access
  window.game = window.App.game;
  // Initialize visual systems immediately so the menu has a space backdrop
  await window.App.initVisuals();

  // Dev harness: auto-start game if ?hole= param is present
  if (process.env.NODE_ENV === 'development' && getInitialHoleNumber() !== null) {
    debug.log('[App] Dev harness: auto-starting game for ?hole= param');
    await window.App.startCourse();
  }
});
