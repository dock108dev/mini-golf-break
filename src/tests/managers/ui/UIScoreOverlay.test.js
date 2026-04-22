import { UIScoreOverlay } from '../../../managers/ui/UIScoreOverlay';
import { HighScoreManager } from '../../../game/HighScoreManager';
import { trapFocus } from '../../../utils/domHelpers';

jest.mock('../../../game/HighScoreManager');
jest.mock('../../../utils/navigation', () => ({
  reloadPage: jest.fn()
}));

describe('UIScoreOverlay', () => {
  let mockGame;
  let mockParentContainer;
  let uiScoreOverlay;
  let mockElements;

  beforeEach(() => {
    mockElements = {
      scoreContainer: {
        style: {},
        appendChild: jest.fn(),
        removeChild: jest.fn()
      },
      currentHoleElement: {
        textContent: '',
        style: {}
      },
      parElement: {
        textContent: '',
        style: {}
      },
      strokesElement: {
        textContent: '',
        style: {}
      },
      totalScoreElement: {
        textContent: '',
        style: {}
      }
    };

    document.createElement = jest.fn(tagName => {
      switch (tagName) {
        case 'div':
          return {
            style: {},
            id: '',
            appendChild: jest.fn(),
            textContent: '',
            setAttribute: jest.fn(),
            classList: {
              add: jest.fn(),
              remove: jest.fn(),
              contains: jest.fn(),
              toggle: jest.fn()
            }
          };
        default:
          return (
            mockElements[tagName] || {
              style: {},
              textContent: '',
              setAttribute: jest.fn(),
              classList: {
                add: jest.fn(),
                remove: jest.fn(),
                contains: jest.fn(),
                toggle: jest.fn()
              }
            }
          );
      }
    });

    mockParentContainer = {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn(() => null)
    };

    mockGame = {
      stateManager: {
        state: {
          currentHoleNumber: 1
        },
        getTotalScore: jest.fn(() => 0)
      },
      course: {
        holes: [{ par: 3 }, { par: 4 }, { par: 5 }],
        getHolePar: jest.fn(hole => (hole < 3 ? hole + 3 : 5)),
        getAllHolePars: jest.fn(() => [3, 4, 5]),
        getCurrentHoleNumber: jest.fn(() => 1)
      },
      scoringSystem: {
        getStrokes: jest.fn(() => 0),
        getTotalScore: jest.fn(() => 0),
        getTotalStrokes: jest.fn(() => 0),
        getCurrentStrokes: jest.fn(() => 0),
        getHoleScores: jest.fn(() => [])
      },
      debugManager: {
        log: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with game and parent container', () => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);

      expect(uiScoreOverlay.game).toBe(mockGame);
      expect(uiScoreOverlay.parentContainer).toBe(mockParentContainer);
      expect(uiScoreOverlay.scoreElement).toBe(null);
      expect(uiScoreOverlay.strokesElement).toBe(null);
      expect(uiScoreOverlay.holeInfoElement).toBe(null);
    });
  });

  describe('init', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
    });

    test('should create score elements', () => {
      uiScoreOverlay.init();

      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(uiScoreOverlay.holeInfoElement).toBeDefined();
      expect(uiScoreOverlay.strokesElement).toBeDefined();
      expect(uiScoreOverlay.scoreElement).toBeDefined();
    });

    test('should add elements to parent container', () => {
      uiScoreOverlay.init();

      expect(mockParentContainer.appendChild).toHaveBeenCalled();
    });

    test('should update initial display', () => {
      uiScoreOverlay.init();

      expect(uiScoreOverlay.holeInfoElement.textContent).toContain('Hole');
      expect(uiScoreOverlay.strokesCountSpan.textContent).toBe('0');
      expect(uiScoreOverlay.scoreElement.textContent).toBe('Score: E');
    });
  });

  describe('updateHoleInfo', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    test('should update hole number', () => {
      mockGame.course.getCurrentHoleNumber.mockReturnValue(5);

      uiScoreOverlay.updateHoleInfo();

      expect(uiScoreOverlay.holeInfoElement.textContent).toContain('Hole 5');
    });

    test('should update hole info correctly', () => {
      mockGame.course.getCurrentHoleNumber.mockReturnValue(2);

      uiScoreOverlay.updateHoleInfo();

      expect(uiScoreOverlay.holeInfoElement.textContent).toContain('Hole 2');
    });

    test('should handle missing course gracefully', () => {
      mockGame.course = null;

      expect(() => {
        uiScoreOverlay.updateHoleInfo();
      }).not.toThrow();
    });
  });

  describe('updateScore', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    test('should show E when no holes completed', () => {
      mockGame.scoringSystem.getHoleScores.mockReturnValue([]);

      uiScoreOverlay.updateScore();

      expect(uiScoreOverlay.scoreElement.textContent).toBe('Score: E');
    });

    test('should show positive diff when over par', () => {
      mockGame.scoringSystem.getHoleScores.mockReturnValue([4]);
      mockGame.course.getAllHolePars.mockReturnValue([3]);

      uiScoreOverlay.updateScore();

      expect(uiScoreOverlay.scoreElement.textContent).toBe('Score: +1');
    });

    test('should show negative diff when under par', () => {
      mockGame.scoringSystem.getHoleScores.mockReturnValue([2]);
      mockGame.course.getAllHolePars.mockReturnValue([3]);

      uiScoreOverlay.updateScore();

      expect(uiScoreOverlay.scoreElement.textContent).toBe('Score: -1');
    });

    test('should show E when completed strokes equal par', () => {
      mockGame.scoringSystem.getHoleScores.mockReturnValue([3, 4]);
      mockGame.course.getAllHolePars.mockReturnValue([3, 4]);

      uiScoreOverlay.updateScore();

      expect(uiScoreOverlay.scoreElement.textContent).toBe('Score: E');
    });
  });

  describe('updateStrokes', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    test('should update strokes count', () => {
      mockGame.scoringSystem.getCurrentStrokes.mockReturnValue(3);

      uiScoreOverlay.updateStrokes();

      expect(uiScoreOverlay.strokesCountSpan.textContent).toBe('3');
    });

    test('should handle zero strokes', () => {
      mockGame.scoringSystem.getCurrentStrokes.mockReturnValue(0);

      uiScoreOverlay.updateStrokes();

      expect(uiScoreOverlay.strokesCountSpan.textContent).toBe('0');
    });
  });

  describe('visibility', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    test('should show overlay', () => {
      uiScoreOverlay.hide();
      uiScoreOverlay.show();

      expect(uiScoreOverlay.scoreContainer.style.display).toBe('block');
    });

    test('should hide overlay', () => {
      uiScoreOverlay.hide();

      expect(uiScoreOverlay.scoreContainer.style.display).toBe('none');
    });

    test('should toggle visibility', () => {
      uiScoreOverlay.toggle();
      const firstState = uiScoreOverlay.scoreContainer.style.display;

      uiScoreOverlay.toggle();
      const secondState = uiScoreOverlay.scoreContainer.style.display;

      expect(firstState).not.toBe(secondState);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    test('should remove score container from parent', () => {
      uiScoreOverlay.cleanup();

      expect(mockParentContainer.removeChild).toHaveBeenCalled();
    });

    test('should clear references', () => {
      uiScoreOverlay.cleanup();

      expect(uiScoreOverlay.scoreContainer).toBe(null);
      expect(uiScoreOverlay.currentHoleElement).toBe(null);
      expect(uiScoreOverlay.parElement).toBe(null);
      expect(uiScoreOverlay.strokesElement).toBe(null);
      expect(uiScoreOverlay.totalScoreElement).toBe(null);
      expect(uiScoreOverlay.nameEntryElement).toBe(null);
    });

    test('should handle cleanup without initialization', () => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);

      expect(() => {
        uiScoreOverlay.cleanup();
      }).not.toThrow();
    });
  });

  describe('trapFocus (shared utility)', () => {
    test('should ignore non-Tab keys', () => {
      const event = { key: 'Enter', preventDefault: jest.fn() };
      const container = { querySelectorAll: jest.fn() };

      trapFocus(event, container);

      expect(container.querySelectorAll).not.toHaveBeenCalled();
    });

    test('should wrap forward Tab from last to first element', () => {
      const btn1 = { focus: jest.fn() };
      const btn2 = { focus: jest.fn() };
      const event = { key: 'Tab', shiftKey: false, preventDefault: jest.fn() };
      const container = { querySelectorAll: jest.fn(() => [btn1, btn2]) };

      Object.defineProperty(document, 'activeElement', { value: btn2, configurable: true });

      trapFocus(event, container);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(btn1.focus).toHaveBeenCalled();
    });

    test('should wrap backward Shift+Tab from first to last element', () => {
      const btn1 = { focus: jest.fn() };
      const btn2 = { focus: jest.fn() };
      const event = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() };
      const container = { querySelectorAll: jest.fn(() => [btn1, btn2]) };

      Object.defineProperty(document, 'activeElement', { value: btn1, configurable: true });

      trapFocus(event, container);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(btn2.focus).toHaveBeenCalled();
    });
  });

  describe('styling', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
    });

    test('should apply proper CSS styles', () => {
      uiScoreOverlay.init();

      const containerStyle = uiScoreOverlay.scoreContainer.style;
      expect(containerStyle.position).toBe('absolute');
      expect(containerStyle.top).toBe('10px');
      expect(containerStyle.right).toBe('10px');
    });
  });

  describe('showFinalScorecard - Play Again returns to start screen', () => {
    let createdElements;
    let clickHandlers;
    let keydownHandlers;

    beforeEach(() => {
      createdElements = [];
      clickHandlers = [];
      keydownHandlers = [];

      document.createElement = jest.fn(tagName => {
        const el = {
          tagName: tagName.toUpperCase(),
          style: {},
          id: '',
          innerHTML: '',
          textContent: '',
          value: '',
          appendChild: jest.fn(),
          remove: jest.fn(),
          focus: jest.fn(),
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn()
          },
          addEventListener: jest.fn((event, handler) => {
            if (event === 'click') {
              clickHandlers.push(handler);
            }
            if (event === 'keydown') {
              keydownHandlers.push(handler);
            }
          })
        };
        createdElements.push(el);
        return el;
      });

      document.body.appendChild = jest.fn();
      global.requestAnimationFrame = jest.fn(cb => cb());

      mockGame.scoringSystem.getHoleScores = jest.fn(() => [3, 4, 2]);
      mockGame.scoringSystem.getTotalStrokes = jest.fn(() => 9);
      mockGame.course.getAllHolePars = jest.fn(() => [2, 3, 3]);

      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    afterEach(() => {
      delete global.requestAnimationFrame;
      delete window.App;
    });

    test('should call window.App.restartGame when Play Again is clicked', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);
      const mockRestartGame = jest.fn();
      window.App = { restartGame: mockRestartGame, returnToMenu: jest.fn() };

      uiScoreOverlay.showFinalScorecard();

      expect(clickHandlers.length).toBeGreaterThan(0);
      const playAgainHandler = clickHandlers[0];
      playAgainHandler();

      expect(mockRestartGame).toHaveBeenCalled();
    });

    test('should call window.App.returnToMenu when Quit is clicked', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);
      const mockReturnToMenu = jest.fn();
      window.App = { restartGame: jest.fn(), returnToMenu: mockReturnToMenu };

      uiScoreOverlay.showFinalScorecard();

      const quitHandler = clickHandlers[1];
      quitHandler();

      expect(mockReturnToMenu).toHaveBeenCalled();
    });

    test('should fallback to window.location.reload when App is not available', () => {
      const { reloadPage } = require('../../../utils/navigation');
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      const playAgainHandler = clickHandlers[0];
      playAgainHandler();

      expect(reloadPage).toHaveBeenCalled();
    });

    test('should create scorecard with Play Again button', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      const buttonEl = createdElements.find(
        el => el.tagName === 'BUTTON' && el.textContent === 'Play Again'
      );
      expect(buttonEl).toBeDefined();
      expect(buttonEl.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('should set role and aria-labelledby on scorecard overlay', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      expect(uiScoreOverlay.scorecardElement.setAttribute).toHaveBeenCalledWith('role', 'dialog');
      expect(uiScoreOverlay.scorecardElement.setAttribute).toHaveBeenCalledWith(
        'aria-labelledby',
        'scorecard-title'
      );
    });

    test('should add keydown listener for focus trapping on scorecard', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      expect(uiScoreOverlay.scorecardElement.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    test('should focus Play Again button when scorecard is shown and score is not top-10', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      const buttonEl = createdElements.find(
        el => el.tagName === 'BUTTON' && el.textContent === 'Play Again'
      );
      expect(buttonEl).toBeDefined();
      expect(buttonEl.focus).toHaveBeenCalled();
    });

    test('should append scorecard to document body', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      expect(document.body.appendChild).toHaveBeenCalled();
    });

    test('should include par and +/- columns in header', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      const headerTr = createdElements.find(
        el =>
          el.tagName === 'TR' &&
          el.innerHTML &&
          el.innerHTML.includes('Par') &&
          el.innerHTML.includes('+/-')
      );
      expect(headerTr).toBeDefined();
    });

    test('should show par values and over/under par for each hole', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      const hole1Row = createdElements.find(
        el =>
          el.tagName === 'TR' &&
          el.innerHTML &&
          el.innerHTML.includes('Hole 1') &&
          el.innerHTML.includes('+1')
      );
      expect(hole1Row).toBeDefined();
      expect(hole1Row.innerHTML).toContain('score-over-par');

      const hole3Row = createdElements.find(
        el =>
          el.tagName === 'TR' &&
          el.innerHTML &&
          el.innerHTML.includes('Hole 3') &&
          el.innerHTML.includes('-1')
      );
      expect(hole3Row).toBeDefined();
      expect(hole3Row.innerHTML).toContain('score-under-par');
    });

    test('should show total par and total over/under', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      const totalRow = createdElements.find(
        el =>
          el.tagName === 'TR' &&
          el.innerHTML &&
          el.innerHTML.includes('Total') &&
          el.innerHTML.includes('+1')
      );
      expect(totalRow).toBeDefined();
      expect(totalRow.innerHTML).toContain('8');
    });

    test('should call getAllHolePars on the course', () => {
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      expect(mockGame.course.getAllHolePars).toHaveBeenCalled();
    });

    test('should save score via HighScoreManager on game completion', () => {
      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.getBestScore.mockReturnValue(8);
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      expect(HighScoreManager.saveScore).toHaveBeenCalledWith(9, expect.any(String));
    });

    test('should show "New Best!" indicator when score is a new best', () => {
      HighScoreManager.saveScore.mockReturnValue(true);
      HighScoreManager.getBestScore.mockReturnValue(9);
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      const bestScoreEl = createdElements.find(el =>
        el.classList.add.mock.calls.some(call => call[0] === 'scorecard-best-score')
      );
      expect(bestScoreEl).toBeDefined();
      expect(bestScoreEl.innerHTML).toContain('New Best!');
    });

    test('should show personal best when score is not a new best', () => {
      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.getBestScore.mockReturnValue(7);
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      const bestScoreEl = createdElements.find(el =>
        el.classList.add.mock.calls.some(call => call[0] === 'scorecard-best-score')
      );
      expect(bestScoreEl).toBeDefined();
      expect(bestScoreEl.textContent).toContain('Personal Best: 7');
    });
  });

  describe('name entry modal', () => {
    let createdElements;
    let clickHandlers;
    let keydownHandlers;
    let inputHandlers;

    beforeEach(() => {
      createdElements = [];
      clickHandlers = [];
      keydownHandlers = [];
      inputHandlers = [];

      document.createElement = jest.fn(tagName => {
        const el = {
          tagName: tagName.toUpperCase(),
          style: {},
          id: '',
          innerHTML: '',
          textContent: '',
          value: '',
          type: '',
          maxLength: 0,
          placeholder: '',
          appendChild: jest.fn(),
          remove: jest.fn(),
          focus: jest.fn(),
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn()
          },
          addEventListener: jest.fn((event, handler) => {
            if (event === 'click') {
              clickHandlers.push({ el, handler });
            }
            if (event === 'keydown') {
              keydownHandlers.push({ el, handler });
            }
            if (event === 'input') {
              inputHandlers.push({ el, handler });
            }
          })
        };
        createdElements.push(el);
        return el;
      });

      document.body.appendChild = jest.fn();
      global.requestAnimationFrame = jest.fn(cb => cb());

      mockGame.scoringSystem.getHoleScores = jest.fn(() => [3, 4, 2]);
      mockGame.scoringSystem.getTotalStrokes = jest.fn(() => 9);
      mockGame.course.getAllHolePars = jest.fn(() => [2, 3, 3]);

      HighScoreManager.saveScore.mockReturnValue(true);
      HighScoreManager.getBestScore.mockReturnValue(9);
      HighScoreManager.isTopTen.mockReturnValue(true);
      HighScoreManager.saveNamedScore.mockReturnValue(true);

      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    afterEach(() => {
      delete global.requestAnimationFrame;
      delete window.App;
    });

    test('should show name entry modal when score is a new personal best', () => {
      uiScoreOverlay.showFinalScorecard();

      expect(uiScoreOverlay.nameEntryElement).not.toBeNull();
      const promptEl = createdElements.find(el =>
        el.classList.add.mock.calls.some(call => call[0] === 'name-entry-prompt')
      );
      expect(promptEl).toBeDefined();
      expect(promptEl.textContent).toContain('NEW PERSONAL BEST');
    });

    test('should not show name entry modal when score is not a new best', () => {
      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay.showFinalScorecard();

      expect(uiScoreOverlay.nameEntryElement).toBeNull();
    });

    test('should hide Play Again button when name entry is shown', () => {
      uiScoreOverlay.showFinalScorecard();

      const playAgainBtn = createdElements.find(
        el => el.tagName === 'BUTTON' && el.textContent === 'Play Again'
      );
      expect(playAgainBtn.style.display).toBe('none');
    });

    test('should create input with max length 12', () => {
      uiScoreOverlay.showFinalScorecard();

      const inputEl = createdElements.find(el => el.tagName === 'INPUT');
      expect(inputEl).toBeDefined();
      expect(inputEl.maxLength).toBe(12);
    });

    test('should create Save and Skip buttons', () => {
      uiScoreOverlay.showFinalScorecard();

      const saveBtn = createdElements.find(
        el => el.tagName === 'BUTTON' && el.textContent === 'Save'
      );
      const skipBtn = createdElements.find(
        el => el.tagName === 'BUTTON' && el.textContent === 'Skip'
      );
      expect(saveBtn).toBeDefined();
      expect(skipBtn).toBeDefined();
    });

    test('should call saveNamedScore with input value on Save click', () => {
      uiScoreOverlay.showFinalScorecard();

      const inputEl = createdElements.find(el => el.tagName === 'INPUT');
      inputEl.value = 'ABC';

      const saveClick = clickHandlers.find(
        h => h.el.tagName === 'BUTTON' && h.el.textContent === 'Save'
      );
      saveClick.handler();

      expect(HighScoreManager.saveNamedScore).toHaveBeenCalledWith('ABC', 9, expect.any(String));
    });

    test('should call saveNamedScore with Anonymous on Skip click', () => {
      uiScoreOverlay.showFinalScorecard();

      const skipClick = clickHandlers.find(
        h => h.el.tagName === 'BUTTON' && h.el.textContent === 'Skip'
      );
      skipClick.handler();

      expect(HighScoreManager.saveNamedScore).toHaveBeenCalledWith(
        'Anonymous',
        9,
        expect.any(String)
      );
    });

    test('should remove name entry modal after save', () => {
      uiScoreOverlay.showFinalScorecard();

      const saveClick = clickHandlers.find(
        h => h.el.tagName === 'BUTTON' && h.el.textContent === 'Save'
      );
      saveClick.handler();

      expect(uiScoreOverlay.nameEntryElement).toBeNull();
    });

    test('should show Play Again button after name entry is dismissed', () => {
      uiScoreOverlay.showFinalScorecard();

      const playAgainBtn = createdElements.find(
        el => el.tagName === 'BUTTON' && el.textContent === 'Play Again'
      );

      const skipClick = clickHandlers.find(
        h => h.el.tagName === 'BUTTON' && h.el.textContent === 'Skip'
      );
      skipClick.handler();

      expect(playAgainBtn.style.display).toBe('');
      expect(playAgainBtn.focus).toHaveBeenCalled();
    });

    test('should submit on Enter key in input field', () => {
      uiScoreOverlay.showFinalScorecard();

      const inputEl = createdElements.find(el => el.tagName === 'INPUT');
      inputEl.value = 'XYZ';

      const inputKeydown = keydownHandlers.find(h => h.el.tagName === 'INPUT');
      inputKeydown.handler({ key: 'Enter', preventDefault: jest.fn() });

      expect(HighScoreManager.saveNamedScore).toHaveBeenCalledWith('XYZ', 9, expect.any(String));
    });

    test('should not submit on non-Enter key in input field', () => {
      uiScoreOverlay.showFinalScorecard();

      const inputKeydown = keydownHandlers.find(h => h.el.tagName === 'INPUT');
      inputKeydown.handler({ key: 'a', preventDefault: jest.fn() });

      expect(HighScoreManager.saveNamedScore).not.toHaveBeenCalled();
    });

    test('should focus input field when name entry modal is shown', () => {
      uiScoreOverlay.showFinalScorecard();

      const inputEl = createdElements.find(el => el.tagName === 'INPUT');
      expect(inputEl.focus).toHaveBeenCalled();
    });

    test('should accept any characters in the name input (no uppercase stripping)', () => {
      uiScoreOverlay.showFinalScorecard();

      // No input handler is registered for character sanitization — name accepts any chars
      const inputEntry = inputHandlers.find(h => h.el.tagName === 'INPUT');
      expect(inputEntry).toBeUndefined();
    });
  });

  describe('hideFinalScorecard', () => {
    let createdElements;
    let transitionEndHandlers;

    beforeEach(() => {
      createdElements = [];
      transitionEndHandlers = [];

      document.createElement = jest.fn(tagName => {
        const el = {
          tagName: tagName.toUpperCase(),
          style: {},
          id: '',
          innerHTML: '',
          textContent: '',
          value: '',
          appendChild: jest.fn(),
          remove: jest.fn(),
          focus: jest.fn(),
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(() => false),
            toggle: jest.fn()
          },
          addEventListener: jest.fn((event, handler) => {
            if (event === 'transitionend') {
              transitionEndHandlers.push({ el, handler });
            }
          })
        };
        createdElements.push(el);
        return el;
      });

      document.body.appendChild = jest.fn();
      global.requestAnimationFrame = jest.fn(cb => cb());

      mockGame.scoringSystem.getHoleScores = jest.fn(() => [2, 3, 3]);
      mockGame.scoringSystem.getTotalStrokes = jest.fn(() => 8);
      mockGame.course.getAllHolePars = jest.fn(() => [2, 3, 3]);

      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.getBestScore.mockReturnValue(7);
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    afterEach(() => {
      delete global.requestAnimationFrame;
    });

    test('should remove visible class from scorecard', () => {
      uiScoreOverlay.showFinalScorecard();

      uiScoreOverlay.hideFinalScorecard();

      expect(uiScoreOverlay.scorecardElement.classList.remove).toHaveBeenCalledWith('visible');
    });

    test('should register transitionend listener', () => {
      uiScoreOverlay.showFinalScorecard();

      uiScoreOverlay.hideFinalScorecard();

      expect(uiScoreOverlay.scorecardElement.addEventListener).toHaveBeenCalledWith(
        'transitionend',
        expect.any(Function),
        { once: true }
      );
    });

    test('should remove scorecard from DOM after transition ends', () => {
      uiScoreOverlay.showFinalScorecard();
      const scorecardRef = uiScoreOverlay.scorecardElement;

      uiScoreOverlay.hideFinalScorecard();

      const transitionHandler = transitionEndHandlers.find(h => h.el === scorecardRef);
      expect(transitionHandler).toBeDefined();
      transitionHandler.handler();

      expect(scorecardRef.remove).toHaveBeenCalled();
      expect(uiScoreOverlay.scorecardElement).toBeNull();
    });

    test('should do nothing when no scorecard exists', () => {
      expect(() => {
        uiScoreOverlay.hideFinalScorecard();
      }).not.toThrow();
    });
  });

  describe('showFinalScorecard - under par total', () => {
    let createdElements;

    beforeEach(() => {
      createdElements = [];

      document.createElement = jest.fn(tagName => {
        const el = {
          tagName: tagName.toUpperCase(),
          style: {},
          id: '',
          innerHTML: '',
          textContent: '',
          value: '',
          appendChild: jest.fn(),
          remove: jest.fn(),
          focus: jest.fn(),
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn()
          },
          addEventListener: jest.fn()
        };
        createdElements.push(el);
        return el;
      });

      document.body.appendChild = jest.fn();
      global.requestAnimationFrame = jest.fn(cb => cb());

      mockGame.scoringSystem.getHoleScores = jest.fn(() => [1, 2, 2]);
      mockGame.scoringSystem.getTotalStrokes = jest.fn(() => 5);
      mockGame.course.getAllHolePars = jest.fn(() => [2, 3, 3]);

      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.getBestScore.mockReturnValue(5);
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    afterEach(() => {
      delete global.requestAnimationFrame;
    });

    test('should show negative diff for under-par holes', () => {
      uiScoreOverlay.showFinalScorecard();

      const hole1Row = createdElements.find(
        el => el.tagName === 'TR' && el.innerHTML.includes('Hole 1') && el.innerHTML.includes('-1')
      );
      expect(hole1Row).toBeDefined();
      expect(hole1Row.innerHTML).toContain('score-under-par');
    });

    test('should show negative total diff when total is under par', () => {
      uiScoreOverlay.showFinalScorecard();

      const totalRow = createdElements.find(
        el => el.tagName === 'TR' && el.innerHTML.includes('Total') && el.innerHTML.includes('-3')
      );
      expect(totalRow).toBeDefined();
      expect(totalRow.innerHTML).toContain('score-under-par');
    });
  });

  describe('showFinalScorecard - over par total', () => {
    let createdElements;

    beforeEach(() => {
      createdElements = [];

      document.createElement = jest.fn(tagName => {
        const el = {
          tagName: tagName.toUpperCase(),
          style: {},
          id: '',
          innerHTML: '',
          textContent: '',
          value: '',
          appendChild: jest.fn(),
          remove: jest.fn(),
          focus: jest.fn(),
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn()
          },
          addEventListener: jest.fn()
        };
        createdElements.push(el);
        return el;
      });

      document.body.appendChild = jest.fn();
      global.requestAnimationFrame = jest.fn(cb => cb());

      mockGame.scoringSystem.getHoleScores = jest.fn(() => [4, 5, 6]);
      mockGame.scoringSystem.getTotalStrokes = jest.fn(() => 15);
      mockGame.course.getAllHolePars = jest.fn(() => [2, 3, 3]);

      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.getBestScore.mockReturnValue(10);
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    afterEach(() => {
      delete global.requestAnimationFrame;
    });

    test('should show positive diff for over-par holes', () => {
      uiScoreOverlay.showFinalScorecard();

      const hole1Row = createdElements.find(
        el => el.tagName === 'TR' && el.innerHTML.includes('Hole 1') && el.innerHTML.includes('+2')
      );
      expect(hole1Row).toBeDefined();
      expect(hole1Row.innerHTML).toContain('score-over-par');
    });

    test('should show positive total diff when total is over par', () => {
      uiScoreOverlay.showFinalScorecard();

      const totalRow = createdElements.find(
        el => el.tagName === 'TR' && el.innerHTML.includes('Total') && el.innerHTML.includes('+7')
      );
      expect(totalRow).toBeDefined();
      expect(totalRow.innerHTML).toContain('score-over-par');
    });

    test('should show Personal Best when score is not a new best', () => {
      uiScoreOverlay.showFinalScorecard();

      const bestScoreEl = createdElements.find(el =>
        el.classList.add.mock.calls.some(call => call[0] === 'scorecard-best-score')
      );
      expect(bestScoreEl).toBeDefined();
      expect(bestScoreEl.textContent).toContain('Personal Best: 10');
    });
  });

  describe('showFinalScorecard - even par total', () => {
    let createdElements;

    beforeEach(() => {
      createdElements = [];

      document.createElement = jest.fn(tagName => {
        const el = {
          tagName: tagName.toUpperCase(),
          style: {},
          id: '',
          innerHTML: '',
          textContent: '',
          value: '',
          appendChild: jest.fn(),
          remove: jest.fn(),
          focus: jest.fn(),
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn()
          },
          addEventListener: jest.fn()
        };
        createdElements.push(el);
        return el;
      });

      document.body.appendChild = jest.fn();
      global.requestAnimationFrame = jest.fn(cb => cb());

      mockGame.scoringSystem.getHoleScores = jest.fn(() => [2, 3, 3]);
      mockGame.scoringSystem.getTotalStrokes = jest.fn(() => 8);
      mockGame.course.getAllHolePars = jest.fn(() => [2, 3, 3]);

      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.getBestScore.mockReturnValue(8);
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    afterEach(() => {
      delete global.requestAnimationFrame;
    });

    test('should show E for even-par holes', () => {
      uiScoreOverlay.showFinalScorecard();

      const hole1Row = createdElements.find(
        el => el.tagName === 'TR' && el.innerHTML.includes('Hole 1') && el.innerHTML.includes('>E<')
      );
      expect(hole1Row).toBeDefined();
      expect(hole1Row.innerHTML).toContain('score-even-par');
    });

    test('should show E for total when total equals par', () => {
      uiScoreOverlay.showFinalScorecard();

      const evenTotalRow = createdElements.find(
        el =>
          el.tagName === 'TR' &&
          el.innerHTML.includes('Total') &&
          el.innerHTML.includes('score-even-par')
      );
      expect(evenTotalRow).toBeDefined();
    });
  });

  describe('showFinalScorecard - new best score', () => {
    let createdElements;

    beforeEach(() => {
      createdElements = [];

      document.createElement = jest.fn(tagName => {
        const el = {
          tagName: tagName.toUpperCase(),
          style: {},
          id: '',
          innerHTML: '',
          textContent: '',
          value: '',
          appendChild: jest.fn(),
          remove: jest.fn(),
          focus: jest.fn(),
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn()
          },
          addEventListener: jest.fn()
        };
        createdElements.push(el);
        return el;
      });

      document.body.appendChild = jest.fn();
      global.requestAnimationFrame = jest.fn(cb => cb());

      mockGame.scoringSystem.getHoleScores = jest.fn(() => [1, 2, 2]);
      mockGame.scoringSystem.getTotalStrokes = jest.fn(() => 5);
      mockGame.course.getAllHolePars = jest.fn(() => [2, 3, 3]);

      HighScoreManager.saveScore.mockReturnValue(true);
      HighScoreManager.getBestScore.mockReturnValue(5);
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    afterEach(() => {
      delete global.requestAnimationFrame;
    });

    test('should show New Best! indicator when saveScore returns true', () => {
      uiScoreOverlay.showFinalScorecard();

      const bestScoreEl = createdElements.find(el =>
        el.classList.add.mock.calls.some(call => call[0] === 'scorecard-best-score')
      );
      expect(bestScoreEl).toBeDefined();
      expect(bestScoreEl.innerHTML).toContain('New Best!');
      expect(bestScoreEl.innerHTML).toContain('new-best-indicator');
    });

    test('should save score via HighScoreManager', () => {
      uiScoreOverlay.showFinalScorecard();

      expect(HighScoreManager.saveScore).toHaveBeenCalledWith(5, expect.any(String));
    });
  });

  describe('showFinalScorecard - re-show existing scorecard', () => {
    let createdElements;

    beforeEach(() => {
      createdElements = [];

      document.createElement = jest.fn(tagName => {
        const el = {
          tagName: tagName.toUpperCase(),
          style: {},
          id: '',
          innerHTML: '',
          textContent: '',
          value: '',
          appendChild: jest.fn(),
          remove: jest.fn(),
          focus: jest.fn(),
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn()
          },
          addEventListener: jest.fn()
        };
        createdElements.push(el);
        return el;
      });

      document.body.appendChild = jest.fn();
      global.requestAnimationFrame = jest.fn(cb => cb());

      mockGame.scoringSystem.getHoleScores = jest.fn(() => [2, 3, 3]);
      mockGame.scoringSystem.getTotalStrokes = jest.fn(() => 8);
      mockGame.course.getAllHolePars = jest.fn(() => [2, 3, 3]);

      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.getBestScore.mockReturnValue(8);
      HighScoreManager.isTopTen.mockReturnValue(false);

      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    afterEach(() => {
      delete global.requestAnimationFrame;
    });

    test('should make existing scorecard visible instead of creating new one', () => {
      uiScoreOverlay.showFinalScorecard();
      const firstScorecard = uiScoreOverlay.scorecardElement;

      uiScoreOverlay.showFinalScorecard();

      expect(uiScoreOverlay.scorecardElement).toBe(firstScorecard);
      expect(firstScorecard.classList.add).toHaveBeenCalledWith('visible');
    });
  });

  describe('_getScoreLabel', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
    });

    test('Eagle for diff <= -2', () => {
      expect(uiScoreOverlay._getScoreLabel(-2)).toBe('Eagle');
      expect(uiScoreOverlay._getScoreLabel(-5)).toBe('Eagle');
    });

    test('Birdie for diff === -1', () => {
      expect(uiScoreOverlay._getScoreLabel(-1)).toBe('Birdie');
    });

    test('Par for diff === 0', () => {
      expect(uiScoreOverlay._getScoreLabel(0)).toBe('Par');
    });

    test('Bogey for diff === 1', () => {
      expect(uiScoreOverlay._getScoreLabel(1)).toBe('Bogey');
    });

    test('Double for diff === 2', () => {
      expect(uiScoreOverlay._getScoreLabel(2)).toBe('Double');
    });

    test('Hole-Out for diff >= 3', () => {
      expect(uiScoreOverlay._getScoreLabel(3)).toBe('Hole-Out');
      expect(uiScoreOverlay._getScoreLabel(10)).toBe('Hole-Out');
    });
  });

  describe('showHoleScoreCard / auto-dismiss', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('card auto-dismisses after 2000 ms (via _dismissHoleScoreCard)', () => {
      const mockCard = { remove: jest.fn() };
      uiScoreOverlay.holeScoreCardElement = mockCard;
      uiScoreOverlay._holeScoreCardTimeout = setTimeout(
        () => uiScoreOverlay._dismissHoleScoreCard(),
        2000
      );

      expect(uiScoreOverlay.holeScoreCardElement).not.toBeNull();

      jest.advanceTimersByTime(2000);

      expect(uiScoreOverlay.holeScoreCardElement).toBeNull();
      expect(mockCard.remove).toHaveBeenCalled();
    });

    test('_dismissHoleScoreCard clears element and timeout immediately', () => {
      const mockCard = { remove: jest.fn() };
      uiScoreOverlay.holeScoreCardElement = mockCard;
      uiScoreOverlay._holeScoreCardTimeout = setTimeout(() => {}, 2000);

      uiScoreOverlay._dismissHoleScoreCard();

      expect(uiScoreOverlay.holeScoreCardElement).toBeNull();
      expect(uiScoreOverlay._holeScoreCardTimeout).toBeNull();
      expect(mockCard.remove).toHaveBeenCalled();
    });

    test('shows correct label via _getScoreLabel', () => {
      const overlay = new UIScoreOverlay(mockGame, mockParentContainer);
      expect(overlay._getScoreLabel(-2)).toBe('Eagle');
      expect(overlay._getScoreLabel(-1)).toBe('Birdie');
      expect(overlay._getScoreLabel(0)).toBe('Par');
      expect(overlay._getScoreLabel(1)).toBe('Bogey');
      expect(overlay._getScoreLabel(2)).toBe('Double');
      expect(overlay._getScoreLabel(3)).toBe('Hole-Out');
    });
  });

  describe('_formatDiff', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
    });

    test('should return E for even par', () => {
      expect(uiScoreOverlay._formatDiff(0)).toBe('E');
    });

    test('should return +N for over par', () => {
      expect(uiScoreOverlay._formatDiff(3)).toBe('+3');
    });

    test('should return -N for under par', () => {
      expect(uiScoreOverlay._formatDiff(-2)).toBe('-2');
    });
  });

  describe('_getDiffClass', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
    });

    test('should return score-under-par for negative diff', () => {
      expect(uiScoreOverlay._getDiffClass(-1)).toBe('score-under-par');
    });

    test('should return score-over-par for positive diff', () => {
      expect(uiScoreOverlay._getDiffClass(2)).toBe('score-over-par');
    });

    test('should return score-even-par for zero diff', () => {
      expect(uiScoreOverlay._getDiffClass(0)).toBe('score-even-par');
    });
  });
});
