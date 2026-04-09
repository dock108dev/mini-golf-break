import { HighScoreManager } from '../../game/HighScoreManager';
import { debug } from '../../utils/debug';

/**
 * UIScoreOverlay - Handles score, strokes, hole info, and final scorecard UI.
 */
export class UIScoreOverlay {
  constructor(game, parentContainer) {
    this.game = game;
    this.parentContainer = parentContainer;

    // UI Elements
    this.scoreElement = null;
    this.strokesElement = null;
    this.holeInfoElement = null;
    this.scorecardElement = null; // For final scorecard

    // Add state to track last displayed value to reduce log spam
    this.lastDisplayedStrokes = null;

    // Styling constants
    this.INFO_BOX_CLASS = 'info-box';
    this.TOP_RIGHT_CONTAINER_CLASS = 'top-right-container';
    this.SCORECARD_CLASS = 'scorecard-overlay';
    this.SCORECARD_VISIBLE_CLASS = 'visible';
    this.SCORECARD_CONTENT_CLASS = 'scorecard-content';
    this.SCORECARD_TITLE_CLASS = 'scorecard-title';
    this.SCORECARD_TABLE_CLASS = 'scorecard-table';
    this.SCORECARD_BUTTON_CLASS = 'scorecard-button';
  }

  /**
   * Initialize and create UI elements.
   */
  init() {
    // Create score container
    this.scoreContainer = document.createElement('div');
    this.scoreContainer.style.position = 'absolute';
    this.scoreContainer.style.top = '10px';
    this.scoreContainer.style.right = '10px';

    // Create top-right container if it doesn't exist (should be handled by UIManager ideally)
    let topRightContainer = this.parentContainer.querySelector(
      `.${this.TOP_RIGHT_CONTAINER_CLASS}`
    );
    if (!topRightContainer) {
      topRightContainer = document.createElement('div');
      topRightContainer.classList.add(this.TOP_RIGHT_CONTAINER_CLASS);
      this.parentContainer.appendChild(topRightContainer);
    }

    // Add score container to top-right container
    topRightContainer.appendChild(this.scoreContainer);

    // 0. Create course name element
    this.courseNameElement = document.createElement('div');
    this.courseNameElement.classList.add('course-name-box');
    this.courseNameElement.textContent = this.game.courseName || '';
    this.scoreContainer.appendChild(this.courseNameElement);

    // 1. Create hole info element
    this.holeInfoElement = document.createElement('div');
    this.holeInfoElement.classList.add(this.INFO_BOX_CLASS);
    this.scoreContainer.appendChild(this.holeInfoElement);

    // 2. Create strokes element
    this.strokesElement = document.createElement('div');
    this.strokesElement.classList.add(this.INFO_BOX_CLASS);
    this.strokesElement.setAttribute('aria-live', 'polite');
    this.scoreContainer.appendChild(this.strokesElement);

    // 3. Create score element (Total Strokes)
    this.scoreElement = document.createElement('div');
    this.scoreElement.classList.add(this.INFO_BOX_CLASS);
    this.scoreElement.setAttribute('aria-live', 'polite');
    this.scoreContainer.appendChild(this.scoreElement);

    this.updateScore();
    this.updateStrokes();
    this.updateHoleInfo();

    debug.log('[UIScoreOverlay] Initialized.');
  }

  /**
   * Update the score display.
   */
  updateScore() {
    if (!this.scoreElement || !this.game.scoringSystem) {
      return;
    }
    const totalStrokes = this.game.scoringSystem.getTotalStrokes();
    this.scoreElement.textContent = `Total Strokes: ${totalStrokes}`;
    debug.log(`[UIScoreOverlay.updateScore] Updated to: ${totalStrokes}`);
  }

  /**
   * Update the strokes display for the current hole.
   */
  updateStrokes() {
    if (!this.strokesElement || !this.game.scoringSystem) {
      return;
    }

    const currentStrokes = this.game.scoringSystem.getCurrentStrokes();

    // OPTIMIZATION: Only update DOM and log if the value has changed
    if (currentStrokes !== this.lastDisplayedStrokes) {
      this.strokesElement.textContent = `Strokes: ${currentStrokes}`;
      // Build descriptive aria-label with hole context
      const holeNumber = this.game.course?.getCurrentHoleNumber
        ? this.game.course.getCurrentHoleNumber()
        : '';
      if (holeNumber) {
        this.strokesElement.setAttribute('aria-label', `Stroke ${currentStrokes} on Hole ${holeNumber}`);
      }
      debug.log(`[UIScoreOverlay.updateStrokes] Updated to: ${currentStrokes}`);
      this.lastDisplayedStrokes = currentStrokes; // Update the last displayed value
    }
  }

  /**
   * Update the hole information display.
   */
  updateHoleInfo() {
    if (!this.holeInfoElement || !this.game.course) {
      return;
    }
    const holeNumber = this.game.course.getCurrentHoleNumber
      ? this.game.course.getCurrentHoleNumber()
      : '-';
    let description = this.game.course.getCurrentHoleConfig
      ? this.game.course.getCurrentHoleConfig()?.description
      : 'Loading...';

    // Use regex to remove leading number, period, and space (e.g., "1. ")
    const match = description.match(/^\d+\.\s*(.*)$/);
    if (match && match[1]) {
      description = match[1]; // Use the captured group
    }
    // If no match, use the original description (fallback)

    this.holeInfoElement.textContent = `Hole ${holeNumber}: ${description}`;
    debug.log(`[UIScoreOverlay.updateHoleInfo] Updated to: Hole ${holeNumber}: ${description}`);
  }

  /**
   * Show the final scorecard overlay.
   */
  showFinalScorecard() {
    if (this.scorecardElement) {
      debug.log('[UIScoreOverlay] Final scorecard already exists. Making visible.');
      this.scorecardElement.classList.add(this.SCORECARD_VISIBLE_CLASS);
      return;
    }

    debug.log('[UIScoreOverlay] Creating and showing final scorecard...');
    this.scorecardElement = document.createElement('div');
    this.scorecardElement.id = 'scorecard-overlay';
    this.scorecardElement.classList.add(this.SCORECARD_CLASS);
    this.scorecardElement.setAttribute('role', 'dialog');
    this.scorecardElement.setAttribute('aria-labelledby', 'scorecard-title');

    const content = document.createElement('div');
    content.classList.add(this.SCORECARD_CONTENT_CLASS);

    const title = document.createElement('h2');
    title.id = 'scorecard-title';
    title.classList.add(this.SCORECARD_TITLE_CLASS);
    title.textContent = 'Course Complete!';
    content.appendChild(title);

    // Display final score details
    const scoreTable = document.createElement('table');
    scoreTable.classList.add(this.SCORECARD_TABLE_CLASS);
    const tbody = document.createElement('tbody');

    // Add header row
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Hole</th><th>Par</th><th>Strokes</th><th>+/-</th>';
    tbody.appendChild(headerRow);

    // Get par values for all holes
    const holePars = this.game.course?.getAllHolePars
      ? this.game.course.getAllHolePars()
      : [];

    // Add per-hole score rows
    const holeScores = this.game.scoringSystem.getHoleScores();
    let totalPar = 0;
    holeScores.forEach((strokes, index) => {
      const par = holePars[index] || 0;
      totalPar += par;
      const diff = strokes - par;
      const diffText = this._formatDiff(diff);
      const diffClass = this._getDiffClass(diff);
      const row = document.createElement('tr');
      row.innerHTML = `<td>Hole ${index + 1}</td><td>${par}</td><td>${strokes}</td><td class="${diffClass}">${diffText}</td>`;
      tbody.appendChild(row);
    });

    // Add total score row
    const totalStrokesValue = this.game.scoringSystem.getTotalStrokes();
    const totalDiff = totalStrokesValue - totalPar;
    const totalDiffText = this._formatDiff(totalDiff);
    const totalDiffClass = this._getDiffClass(totalDiff);
    const scoreRow = document.createElement('tr');
    scoreRow.innerHTML = `<td><strong>Total</strong></td><td><strong>${totalPar}</strong></td><td><strong>${totalStrokesValue}</strong></td><td class="${totalDiffClass}"><strong>${totalDiffText}</strong></td>`;
    tbody.appendChild(scoreRow);

    scoreTable.appendChild(tbody);
    content.appendChild(scoreTable);

    // Save score and check for new best
    const courseName = this.game.courseName || 'default';
    const isNewBest = HighScoreManager.saveScore(totalStrokesValue, courseName);
    const previousBest = HighScoreManager.getBestScore(courseName);

    // Show personal best info
    const bestScoreInfo = document.createElement('div');
    bestScoreInfo.classList.add('scorecard-best-score');
    if (isNewBest) {
      bestScoreInfo.innerHTML = '<span class="new-best-indicator">New Best!</span>';
    } else if (previousBest !== null) {
      bestScoreInfo.textContent = `Personal Best: ${previousBest}`;
    }
    content.appendChild(bestScoreInfo);

    // Add buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '20px';

    const playAgainButton = document.createElement('button');
    playAgainButton.textContent = 'Play Again';
    playAgainButton.classList.add(this.SCORECARD_BUTTON_CLASS);
    playAgainButton.addEventListener('click', () => {
      debug.log('[UIScoreOverlay] Play Again clicked. Returning to start screen.');
      if (window.gtag) {
        window.gtag('event', 'click_play_again', {
          event_category: 'game_actions',
          event_label: 'Play Again from Scorecard'
        });
      }
      // Return to the start/welcome screen
      if (window.App && typeof window.App.returnToMenu === 'function') {
        window.App.returnToMenu();
      } else {
        // Fallback: reload the page to show the start screen
        window.location.reload();
      }
    });
    buttonContainer.appendChild(playAgainButton);

    content.appendChild(buttonContainer);
    this.scorecardElement.appendChild(content);

    // Trap focus within scorecard overlay
    this.scorecardElement.addEventListener('keydown', (e) => {
      this._trapFocus(e, this.scorecardElement);
    });

    // Append to body instead of parentContainer to ensure it overlays everything
    document.body.appendChild(this.scorecardElement);

    // Add visible class with a slight delay for transition effect
    requestAnimationFrame(() => {
      this.scorecardElement.classList.add(this.SCORECARD_VISIBLE_CLASS);
      // Focus the Play Again button for keyboard accessibility
      playAgainButton.focus();
    });

    debug.log('[UIScoreOverlay] Final scorecard shown.');
  }

  /**
   * Hide the final scorecard overlay.
   */
  hideFinalScorecard() {
    if (this.scorecardElement) {
      this.scorecardElement.classList.remove(this.SCORECARD_VISIBLE_CLASS);
      // Optionally remove the element after transition
      this.scorecardElement.addEventListener(
        'transitionend',
        () => {
          if (
            this.scorecardElement &&
            !this.scorecardElement.classList.contains(this.SCORECARD_VISIBLE_CLASS)
          ) {
            this.scorecardElement.remove();
            this.scorecardElement = null;
            debug.log('[UIScoreOverlay] Final scorecard removed from DOM.');
          }
        },
        { once: true }
      );
    }
  }

  /**
   * Show the overlay
   */
  show() {
    if (this.scoreContainer) {
      this.scoreContainer.style.display = 'block';
    }
  }

  /**
   * Hide the overlay
   */
  hide() {
    if (this.scoreContainer) {
      this.scoreContainer.style.display = 'none';
    }
  }

  /**
   * Toggle the overlay visibility
   */
  toggle() {
    if (this.scoreContainer) {
      const isVisible = this.scoreContainer.style.display !== 'none';
      this.scoreContainer.style.display = isVisible ? 'none' : 'block';
    }
  }

  /**
   * Trap focus within a container element.
   * @param {KeyboardEvent} e - The keydown event
   * @param {HTMLElement} container - The container to trap focus within
   */
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

  /**
   * Format a score difference as +N, -N, or E (even).
   */
  _formatDiff(diff) {
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  }

  /**
   * Get the CSS class for a score difference.
   */
  _getDiffClass(diff) {
    if (diff < 0) return 'score-under-par';
    if (diff > 0) return 'score-over-par';
    return 'score-even-par';
  }

  /**
   * Cleanup UI elements.
   */
  cleanup() {
    if (this.scoreContainer && this.parentContainer) {
      this.parentContainer.removeChild(this.scoreContainer);
    }
    this.hideFinalScorecard(); // Ensure scorecard is hidden/removed

    this.scoreContainer = null;
    this.courseNameElement = null;
    this.currentHoleElement = null;
    this.parElement = null;
    this.scoreElement = null;
    this.strokesElement = null;
    this.holeInfoElement = null;
    this.totalScoreElement = null;
    this.scorecardElement = null;

    debug.log('[UIScoreOverlay] Cleaned up.');
  }
}
