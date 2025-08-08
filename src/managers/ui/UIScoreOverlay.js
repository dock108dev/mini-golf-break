import { EventTypes } from '../../events/EventTypes';
import { debug } from '../../utils/debug';

/**
 * UIScoreOverlay - Handles score, strokes, hole info, and final scorecard UI.
 * Manages the display of game scoring information and end-game scorecard presentation.
 * 
 * @class UIScoreOverlay
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
    this.scoreContainer.style.position = 'relative'; // Change to relative so it doesn't create a large invisible area
    // Add display-ui class to prevent touch event interception
    this.scoreContainer.classList.add('display-ui');
    this.scoreContainer.style.pointerEvents = 'none'; // Explicitly set pointer-events

    // Create top-right container if it doesn't exist (should be handled by UIManager ideally)
    let topRightContainer = this.parentContainer.querySelector(
      `.${this.TOP_RIGHT_CONTAINER_CLASS}`
    );
    if (!topRightContainer) {
      topRightContainer = document.createElement('div');
      topRightContainer.classList.add(this.TOP_RIGHT_CONTAINER_CLASS, 'display-ui'); // Use CSS class
      this.parentContainer.appendChild(topRightContainer);
    }

    // Add score container to top-right container
    topRightContainer.appendChild(this.scoreContainer);

    // 1. Create hole info element
    this.holeInfoElement = document.createElement('div');
    this.holeInfoElement.classList.add(this.INFO_BOX_CLASS, 'display-ui'); // Add display-ui class
    this.scoreContainer.appendChild(this.holeInfoElement);

    // 2. Create strokes element
    this.strokesElement = document.createElement('div');
    this.strokesElement.classList.add(this.INFO_BOX_CLASS, 'display-ui'); // Add display-ui class
    this.scoreContainer.appendChild(this.strokesElement);

    // 3. Create score element (Total Strokes)
    this.scoreElement = document.createElement('div');
    this.scoreElement.classList.add(this.INFO_BOX_CLASS, 'display-ui'); // Add display-ui class
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
   * Updates the scorecard with current game stats
   * Called during gameplay to keep track of progress
   */
  updateScorecard() {
    if (!this.game.scoringSystem) {
      debug.warn('[UIScoreOverlay.updateScorecard] Scoring system not available.');
      return;
    }
    
    const currentHole = this.game.holeManager?.getCurrentHoleNumber() || 1;
    const totalStrokes = this.game.scoringSystem.getTotalStrokes();
    const currentHoleStrokes = this.game.scoringSystem.getCurrentHoleStrokes();
    
    debug.log(`[UIScoreOverlay.updateScorecard] Hole ${currentHole}: ${currentHoleStrokes} strokes, Total: ${totalStrokes}`);
    
    // Update score display if it exists
    if (this.scoreElement) {
      this.scoreElement.textContent = `Strokes: ${totalStrokes}`;
    }
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

    const content = document.createElement('div');
    content.classList.add(this.SCORECARD_CONTENT_CLASS);

    const title = document.createElement('h2');
    title.classList.add(this.SCORECARD_TITLE_CLASS);
    title.textContent = 'Course Complete!';
    content.appendChild(title);

    // Display final score details
    const scoreTable = document.createElement('table');
    scoreTable.classList.add(this.SCORECARD_TABLE_CLASS);
    
    // Add table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Hole</th><th>Par</th><th>Strokes</th><th>Score</th>';
    thead.appendChild(headerRow);
    scoreTable.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    // Get hole scores if available
    const holeScores = this.game.scoringSystem.getHoleScores ? 
      this.game.scoringSystem.getHoleScores() : [];
    
    let totalPar = 0;
    let totalStrokes = 0;
    
    // Add row for each hole
    if (holeScores.length > 0) {
      holeScores.forEach((score, index) => {
        const holeNum = index + 1;
        const par = score.par || 3;
        const strokes = score.strokes || 0;
        const scoreDiff = strokes - par;
        
        totalPar += par;
        totalStrokes += strokes;
        
        let scoreText = '';
        if (strokes === 1) scoreText = 'Hole in One!';
        else if (scoreDiff <= -2) scoreText = 'Eagle';
        else if (scoreDiff === -1) scoreText = 'Birdie';
        else if (scoreDiff === 0) scoreText = 'Par';
        else if (scoreDiff === 1) scoreText = 'Bogey';
        else if (scoreDiff === 2) scoreText = 'Double Bogey';
        else scoreText = `+${scoreDiff}`;
        
        const row = document.createElement('tr');
        row.innerHTML = `<td>Hole ${holeNum}</td><td>${par}</td><td>${strokes}</td><td>${scoreText}</td>`;
        tbody.appendChild(row);
      });
    }
    
    // Add separator row
    const separatorRow = document.createElement('tr');
    separatorRow.innerHTML = '<td colspan="4"><hr></td>';
    tbody.appendChild(separatorRow);
    
    // Add total score row
    const totalStrokesValue = this.game.scoringSystem.getTotalStrokes();
    const scoreRow = document.createElement('tr');
    scoreRow.style.fontWeight = 'bold';
    scoreRow.innerHTML = `<td>Total</td><td>${totalPar || 27}</td><td>${totalStrokesValue}</td><td>${totalStrokesValue - (totalPar || 27) > 0 ? '+' : ''}${totalStrokesValue - (totalPar || 27)}</td>`;
    tbody.appendChild(scoreRow);

    scoreTable.appendChild(tbody);
    content.appendChild(scoreTable);

    // Add buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '20px';

    // For simplicity, let's just have a single "Play Again" button that reloads the page
    const playAgainButton = document.createElement('button');
    playAgainButton.textContent = 'Play Again';
    playAgainButton.classList.add(this.SCORECARD_BUTTON_CLASS);
    playAgainButton.addEventListener('click', () => {
      debug.log('[UIScoreOverlay] Play Again clicked. Reloading the page.');
      // Add analytics event for debugging
      if (window.gtag) {
        window.gtag('event', 'click_play_again', {
          event_category: 'game_actions',
          event_label: 'Play Again from Scorecard'
        });
      }
      // Simplest solution - reload the page to restart
      window.location.reload();
    });
    buttonContainer.appendChild(playAgainButton);

    content.appendChild(buttonContainer);
    this.scorecardElement.appendChild(content);

    // Append to body instead of parentContainer to ensure it overlays everything
    document.body.appendChild(this.scorecardElement);

    // Add visible class with a slight delay for transition effect
    requestAnimationFrame(() => {
      this.scorecardElement.classList.add(this.SCORECARD_VISIBLE_CLASS);
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
   * Cleanup UI elements.
   */
  cleanup() {
    if (this.scoreContainer && this.parentContainer) {
      this.parentContainer.removeChild(this.scoreContainer);
    }
    this.hideFinalScorecard(); // Ensure scorecard is hidden/removed

    this.scoreContainer = null;
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
