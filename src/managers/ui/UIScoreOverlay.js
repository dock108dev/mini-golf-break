import { HighScoreManager } from '../../game/HighScoreManager';
import { debug } from '../../utils/debug';
import { reloadPage } from '../../utils/navigation';
import { trapFocus } from '../../utils/domHelpers';

export class UIScoreOverlay {
  constructor(game, parentContainer) {
    this.game = game;
    this.parentContainer = parentContainer;

    this.scoreElement = null;
    this.strokesElement = null;
    this.strokesCountSpan = null;
    this.holeInfoElement = null;
    this.scorecardElement = null;
    this.nameEntryElement = null;

    this.lastDisplayedStrokes = null;
    this.holeScoreCardElement = null;
    this._holeScoreCardTimeout = null;

    this.INFO_BOX_CLASS = 'info-box';
    this.TOP_RIGHT_CONTAINER_CLASS = 'top-right-container';
    this.SCORECARD_CLASS = 'scorecard-overlay';
    this.SCORECARD_VISIBLE_CLASS = 'visible';
    this.SCORECARD_CONTENT_CLASS = 'scorecard-content';
    this.SCORECARD_TITLE_CLASS = 'scorecard-title';
    this.SCORECARD_TABLE_CLASS = 'scorecard-table';
    this.SCORECARD_BUTTON_CLASS = 'scorecard-button';
  }

  init() {
    this.scoreContainer = document.createElement('div');
    this.scoreContainer.style.position = 'absolute';
    this.scoreContainer.style.top = '10px';
    this.scoreContainer.style.right = '10px';

    let topRightContainer = this.parentContainer.querySelector(
      `.${this.TOP_RIGHT_CONTAINER_CLASS}`
    );
    if (!topRightContainer) {
      topRightContainer = document.createElement('div');
      topRightContainer.classList.add(this.TOP_RIGHT_CONTAINER_CLASS);
      this.parentContainer.appendChild(topRightContainer);
    }

    topRightContainer.appendChild(this.scoreContainer);

    this.courseNameElement = document.createElement('div');
    this.courseNameElement.classList.add('course-name-box');
    this.courseNameElement.textContent = this.game.courseName || '';
    this.scoreContainer.appendChild(this.courseNameElement);

    this.holeInfoElement = document.createElement('div');
    this.holeInfoElement.id = 'hole-info';
    this.holeInfoElement.classList.add(this.INFO_BOX_CLASS);
    this.scoreContainer.appendChild(this.holeInfoElement);

    this.strokesElement = document.createElement('div');
    this.strokesElement.classList.add(this.INFO_BOX_CLASS);
    this.strokesElement.setAttribute('aria-live', 'polite');
    this.strokesCountSpan = document.createElement('span');
    this.strokesCountSpan.id = 'stroke-count';
    this.strokesElement.appendChild(document.createTextNode('Strokes: '));
    this.strokesElement.appendChild(this.strokesCountSpan);
    this.scoreContainer.appendChild(this.strokesElement);

    this.scoreElement = document.createElement('div');
    this.scoreElement.id = 'score-info';
    this.scoreElement.classList.add(this.INFO_BOX_CLASS);
    this.scoreElement.setAttribute('aria-live', 'polite');
    this.scoreContainer.appendChild(this.scoreElement);

    this.updateScore();
    this.updateStrokes();
    this.updateHoleInfo();

    debug.log('[UIScoreOverlay] Initialized.');
  }

  updateScore() {
    if (!this.scoreElement || !this.game.scoringSystem) {
      return;
    }
    const holeScores = this.game.scoringSystem.getHoleScores?.() ?? [];
    const holePars = this.game.course?.getAllHolePars?.() ?? [];
    const completedPar = holePars.slice(0, holeScores.length).reduce((s, p) => s + p, 0);
    const completedStrokes = holeScores.reduce((s, n) => s + n, 0);
    if (holeScores.length === 0) {
      this.scoreElement.textContent = 'Score: E';
    } else {
      const diff = completedStrokes - completedPar;
      this.scoreElement.textContent = `Score: ${this._formatDiff(diff)}`;
    }
    debug.log('[UIScoreOverlay.updateScore] Updated score display');
  }

  updateStrokes() {
    if (!this.strokesElement || !this.game.scoringSystem) {
      return;
    }

    const currentStrokes = this.game.scoringSystem.getCurrentStrokes();

    if (currentStrokes !== this.lastDisplayedStrokes) {
      if (this.strokesCountSpan) {
        this.strokesCountSpan.textContent = String(currentStrokes);
      }
      const holeNumber = this.game.course?.getCurrentHoleNumber
        ? this.game.course.getCurrentHoleNumber()
        : '';
      if (holeNumber) {
        this.strokesElement.setAttribute(
          'aria-label',
          `Stroke ${currentStrokes} on Hole ${holeNumber}`
        );
      }
      debug.log(`[UIScoreOverlay.updateStrokes] Updated to: ${currentStrokes}`);
      this.lastDisplayedStrokes = currentStrokes;
    }
  }

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

    const match = description.match(/^\d+\.\s*(.*)$/);
    if (match && match[1]) {
      description = match[1];
    }

    this.holeInfoElement.textContent = `Hole ${holeNumber}: ${description}`;
    debug.log(`[UIScoreOverlay.updateHoleInfo] Updated to: Hole ${holeNumber}: ${description}`);
  }

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

    const scoreTable = document.createElement('table');
    scoreTable.classList.add(this.SCORECARD_TABLE_CLASS);
    const tbody = document.createElement('tbody');

    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Hole</th><th>Par</th><th>Strokes</th><th>+/-</th>';
    tbody.appendChild(headerRow);

    const holePars = this.game.course?.getAllHolePars ? this.game.course.getAllHolePars() : [];

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

    const totalStrokesValue = this.game.scoringSystem.getTotalStrokes();
    const totalDiff = totalStrokesValue - totalPar;
    const totalDiffText = this._formatDiff(totalDiff);
    const totalDiffClass = this._getDiffClass(totalDiff);
    const scoreRow = document.createElement('tr');
    scoreRow.innerHTML = `<td><strong>Total</strong></td><td><strong>${totalPar}</strong></td><td><strong>${totalStrokesValue}</strong></td><td class="${totalDiffClass}"><strong>${totalDiffText}</strong></td>`;
    tbody.appendChild(scoreRow);

    scoreTable.appendChild(tbody);
    content.appendChild(scoreTable);

    const courseName = this.game.courseName || 'default';
    const isNewBest = HighScoreManager.saveScore(totalStrokesValue, courseName);
    const previousBest = HighScoreManager.getBestScore(courseName);

    const bestScoreInfo = document.createElement('div');
    bestScoreInfo.classList.add('scorecard-best-score');
    if (isNewBest) {
      bestScoreInfo.innerHTML = '<span class="new-best-indicator">New Best!</span>';
    } else if (previousBest !== null) {
      bestScoreInfo.textContent = `Personal Best: ${previousBest}`;
    }
    content.appendChild(bestScoreInfo);

    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('scorecard-button-row');

    const playAgainButton = document.createElement('button');
    playAgainButton.textContent = 'Play Again';
    playAgainButton.classList.add(this.SCORECARD_BUTTON_CLASS);
    playAgainButton.addEventListener('click', () => {
      debug.log('[UIScoreOverlay] Play Again clicked. Restarting game.');
      if (window.gtag) {
        window.gtag('event', 'click_play_again', {
          event_category: 'game_actions',
          event_label: 'Play Again from Scorecard'
        });
      }
      if (window.App && typeof window.App.restartGame === 'function') {
        window.App.restartGame();
      } else {
        reloadPage();
      }
    });
    buttonContainer.appendChild(playAgainButton);

    const quitButton = document.createElement('button');
    quitButton.textContent = 'Quit';
    quitButton.classList.add(this.SCORECARD_BUTTON_CLASS, 'scorecard-quit-button');
    quitButton.setAttribute('aria-label', 'Quit to title screen');
    quitButton.addEventListener('click', () => {
      debug.log('[UIScoreOverlay] Quit clicked. Returning to title screen.');
      if (window.App && typeof window.App.returnToMenu === 'function') {
        window.App.returnToMenu();
      } else {
        reloadPage();
      }
    });
    buttonContainer.appendChild(quitButton);

    content.appendChild(buttonContainer);
    this.scorecardElement.appendChild(content);

    this.scorecardElement.addEventListener('keydown', e => {
      trapFocus(e, this.scorecardElement);
    });

    document.body.appendChild(this.scorecardElement);

    const isTopThree = HighScoreManager.isTopThree(totalStrokesValue, courseName);

    requestAnimationFrame(() => {
      this.scorecardElement.classList.add(this.SCORECARD_VISIBLE_CLASS);

      // Particle burst for top-3 scores
      if (isTopThree) {
        this.game?.visualEffectsManager?.triggerHighScoreCelebration?.();
      }

      if (isNewBest) {
        playAgainButton.style.display = 'none';
        quitButton.style.display = 'none';
        this._showNameEntryModal(
          content,
          totalStrokesValue,
          courseName,
          playAgainButton,
          quitButton
        );
      } else {
        playAgainButton.focus();
      }
    });

    debug.log('[UIScoreOverlay] Final scorecard shown.');
  }

  _showNameEntryModal(contentParent, score, courseName, playAgainButton, quitButton) {
    this.nameEntryElement = document.createElement('div');
    this.nameEntryElement.classList.add('name-entry-modal');
    this.nameEntryElement.setAttribute('role', 'dialog');
    this.nameEntryElement.setAttribute('aria-label', 'Enter your name for the leaderboard');

    const prompt = document.createElement('div');
    prompt.classList.add('name-entry-prompt');
    prompt.textContent = 'NEW PERSONAL BEST! Enter your name:';
    this.nameEntryElement.appendChild(prompt);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 12;
    input.classList.add('name-entry-input');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', 'Enter your name (max 12 characters)');
    input.placeholder = 'Your name';
    this.nameEntryElement.appendChild(input);

    const buttonRow = document.createElement('div');
    buttonRow.classList.add('name-entry-buttons');

    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Save';
    submitBtn.classList.add(this.SCORECARD_BUTTON_CLASS);
    submitBtn.addEventListener('click', () => {
      const name = input.value.trim() || 'Anonymous';
      this._saveAndDismissNameEntry(name, score, courseName, playAgainButton, quitButton);
    });
    buttonRow.appendChild(submitBtn);

    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip';
    skipBtn.classList.add(this.SCORECARD_BUTTON_CLASS, 'name-entry-skip');
    skipBtn.addEventListener('click', () => {
      this._saveAndDismissNameEntry('Anonymous', score, courseName, playAgainButton, quitButton);
    });
    buttonRow.appendChild(skipBtn);

    this.nameEntryElement.appendChild(buttonRow);

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const name = input.value.trim() || 'Anonymous';
        this._saveAndDismissNameEntry(name, score, courseName, playAgainButton, quitButton);
      }
    });

    contentParent.appendChild(this.nameEntryElement);

    this._setupViewportAdjustment();

    input.focus();
    debug.log('[UIScoreOverlay] Name entry modal shown.');
  }

  _saveAndDismissNameEntry(name, score, courseName, playAgainButton, quitButton) {
    HighScoreManager.saveNamedScore(name, score, courseName);

    if (this.nameEntryElement) {
      this.nameEntryElement.remove();
      this.nameEntryElement = null;
    }

    this._teardownViewportAdjustment();

    playAgainButton.style.display = '';
    if (quitButton) {
      quitButton.style.display = '';
    }
    playAgainButton.focus();

    debug.log(`[UIScoreOverlay] Name entry saved: ${name}`);
  }

  _setupViewportAdjustment() {
    if (typeof window !== 'undefined' && window.visualViewport) {
      this._viewportHandler = () => {
        if (!this.nameEntryElement) {
          return;
        }
        const viewport = window.visualViewport;
        const offset = window.innerHeight - viewport.height;
        if (offset > 0 && this.scorecardElement) {
          this.scorecardElement.style.transform = `translateY(-${offset / 2}px)`;
        } else if (this.scorecardElement) {
          this.scorecardElement.style.transform = '';
        }
      };
      window.visualViewport.addEventListener('resize', this._viewportHandler);
    }
  }

  _teardownViewportAdjustment() {
    if (this._viewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._viewportHandler);
      this._viewportHandler = null;
    }
    if (this.scorecardElement) {
      this.scorecardElement.style.transform = '';
    }
  }

  hideFinalScorecard() {
    if (this.scorecardElement) {
      this.scorecardElement.classList.remove(this.SCORECARD_VISIBLE_CLASS);
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

  show() {
    if (this.scoreContainer) {
      this.scoreContainer.style.display = 'block';
    }
  }

  hide() {
    if (this.scoreContainer) {
      this.scoreContainer.style.display = 'none';
    }
  }

  toggle() {
    if (this.scoreContainer) {
      const isVisible = this.scoreContainer.style.display !== 'none';
      this.scoreContainer.style.display = isVisible ? 'none' : 'block';
    }
  }

  _getScoreLabel(diff) {
    if (diff <= -2) {
      return 'Eagle';
    }
    if (diff === -1) {
      return 'Birdie';
    }
    if (diff === 0) {
      return 'Par';
    }
    if (diff === 1) {
      return 'Bogey';
    }
    if (diff === 2) {
      return 'Double';
    }
    return 'Hole-Out';
  }

  showHoleScoreCard(holeNumber, par, strokes) {
    this._dismissHoleScoreCard();

    const diff = strokes - par;
    const label = this._getScoreLabel(diff);

    const card = document.createElement('div');
    card.classList.add('hole-score-card');
    card.setAttribute('aria-live', 'polite');
    card.setAttribute('role', 'status');

    const title = document.createElement('div');
    title.classList.add('hole-score-card-title');
    title.textContent = label;
    card.appendChild(title);

    const detail = document.createElement('div');
    detail.classList.add('hole-score-card-detail');
    detail.textContent = `Hole ${holeNumber} — ${strokes} stroke${strokes !== 1 ? 's' : ''} (Par ${par})`;
    card.appendChild(detail);

    card.addEventListener('click', () => this._dismissHoleScoreCard());

    this.holeScoreCardElement = card;
    document.body.appendChild(card);

    this._holeScoreCardTimeout = setTimeout(() => this._dismissHoleScoreCard(), 2000);
    debug.log(`[UIScoreOverlay] Hole score card shown: ${label} (Hole ${holeNumber})`);
  }

  _dismissHoleScoreCard() {
    if (this._holeScoreCardTimeout) {
      clearTimeout(this._holeScoreCardTimeout);
      this._holeScoreCardTimeout = null;
    }
    if (this.holeScoreCardElement) {
      this.holeScoreCardElement.remove();
      this.holeScoreCardElement = null;
    }
  }

  _formatDiff(diff) {
    if (diff === 0) {
      return 'E';
    }
    return diff > 0 ? `+${diff}` : `${diff}`;
  }

  _getDiffClass(diff) {
    if (diff < 0) {
      return 'score-under-par';
    }
    if (diff > 0) {
      return 'score-over-par';
    }
    return 'score-even-par';
  }

  cleanup() {
    if (this.scoreContainer && this.parentContainer) {
      this.parentContainer.removeChild(this.scoreContainer);
    }
    this.hideFinalScorecard();
    this._dismissHoleScoreCard();
    this._teardownViewportAdjustment();

    this.scoreContainer = null;
    this.courseNameElement = null;
    this.currentHoleElement = null;
    this.parElement = null;
    this.scoreElement = null;
    this.strokesElement = null;
    this.strokesCountSpan = null;
    this.holeInfoElement = null;
    this.totalScoreElement = null;
    this.scorecardElement = null;
    this.nameEntryElement = null;

    debug.log('[UIScoreOverlay] Cleaned up.');
  }
}
