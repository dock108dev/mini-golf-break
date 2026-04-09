/**
 * Unit tests for UIScoreOverlay
 */

import { UIScoreOverlay } from '../../../managers/ui/UIScoreOverlay';
import { HighScoreManager } from '../../../game/HighScoreManager';

jest.mock('../../../game/HighScoreManager');

describe('UIScoreOverlay', () => {
  let mockGame;
  let mockParentContainer;
  let uiScoreOverlay;
  let mockElements;

  beforeEach(() => {
    // Mock DOM elements
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

    // Mock document.createElement
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

    // Mock parent container
    mockParentContainer = {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn(() => null) // Returns null for top-right container query
    };

    // Mock game object
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
        getCurrentStrokes: jest.fn(() => 0)
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
      expect(uiScoreOverlay.strokesElement.textContent).toBe('Strokes: 0');
      expect(uiScoreOverlay.scoreElement.textContent).toBe('Total Strokes: 0');
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

    test('should update total strokes', () => {
      mockGame.scoringSystem.getTotalStrokes.mockReturnValue(15);

      uiScoreOverlay.updateScore();

      expect(uiScoreOverlay.scoreElement.textContent).toBe('Total Strokes: 15');
    });

    test('should display total strokes correctly', () => {
      mockGame.scoringSystem.getTotalStrokes.mockReturnValue(8);

      uiScoreOverlay.updateScore();

      expect(uiScoreOverlay.scoreElement.textContent).toBe('Total Strokes: 8');
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

      expect(uiScoreOverlay.strokesElement.textContent).toBe('Strokes: 3');
    });

    test('should handle zero strokes', () => {
      mockGame.scoringSystem.getCurrentStrokes.mockReturnValue(0);

      uiScoreOverlay.updateStrokes();

      expect(uiScoreOverlay.strokesElement.textContent).toBe('Strokes: 0');
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
    });

    test('should handle cleanup without initialization', () => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);

      expect(() => {
        uiScoreOverlay.cleanup();
      }).not.toThrow();
    });
  });

  describe('_trapFocus', () => {
    beforeEach(() => {
      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
    });

    test('should ignore non-Tab keys', () => {
      const event = { key: 'Enter', preventDefault: jest.fn() };
      const container = { querySelectorAll: jest.fn() };

      uiScoreOverlay._trapFocus(event, container);

      expect(container.querySelectorAll).not.toHaveBeenCalled();
    });

    test('should wrap forward Tab from last to first element', () => {
      const btn1 = { focus: jest.fn() };
      const btn2 = { focus: jest.fn() };
      const event = { key: 'Tab', shiftKey: false, preventDefault: jest.fn() };
      const container = { querySelectorAll: jest.fn(() => [btn1, btn2]) };

      Object.defineProperty(document, 'activeElement', { value: btn2, configurable: true });

      uiScoreOverlay._trapFocus(event, container);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(btn1.focus).toHaveBeenCalled();
    });

    test('should wrap backward Shift+Tab from first to last element', () => {
      const btn1 = { focus: jest.fn() };
      const btn2 = { focus: jest.fn() };
      const event = { key: 'Tab', shiftKey: true, preventDefault: jest.fn() };
      const container = { querySelectorAll: jest.fn(() => [btn1, btn2]) };

      Object.defineProperty(document, 'activeElement', { value: btn1, configurable: true });

      uiScoreOverlay._trapFocus(event, container);

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

    beforeEach(() => {
      createdElements = [];
      clickHandlers = [];

      // Enhanced createElement mock that tracks buttons and their click handlers
      document.createElement = jest.fn(tagName => {
        const el = {
          tagName: tagName.toUpperCase(),
          style: {},
          id: '',
          innerHTML: '',
          textContent: '',
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
          })
        };
        createdElements.push(el);
        return el;
      });

      // Mock document.body.appendChild
      document.body.appendChild = jest.fn();

      // Mock requestAnimationFrame
      global.requestAnimationFrame = jest.fn(cb => cb());

      // Mock scoring system with hole scores
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

    test('should call window.App.returnToMenu when Play Again is clicked', () => {
      const mockReturnToMenu = jest.fn();
      window.App = { returnToMenu: mockReturnToMenu };

      uiScoreOverlay.showFinalScorecard();

      // Find and click the Play Again button handler
      expect(clickHandlers.length).toBeGreaterThan(0);
      const playAgainHandler = clickHandlers[clickHandlers.length - 1];
      playAgainHandler();

      expect(mockReturnToMenu).toHaveBeenCalled();
    });

    test('should fallback to window.location.reload when App is not available', () => {
      // No window.App set
      const mockReload = jest.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
        configurable: true
      });

      uiScoreOverlay.showFinalScorecard();

      const playAgainHandler = clickHandlers[clickHandlers.length - 1];
      playAgainHandler();

      expect(mockReload).toHaveBeenCalled();
    });

    test('should create scorecard with Play Again button', () => {
      uiScoreOverlay.showFinalScorecard();

      // Find the button element
      const buttonEl = createdElements.find(
        el => el.tagName === 'BUTTON' && el.textContent === 'Play Again'
      );
      expect(buttonEl).toBeDefined();
      expect(buttonEl.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('should set role and aria-labelledby on scorecard overlay', () => {
      uiScoreOverlay.showFinalScorecard();

      expect(uiScoreOverlay.scorecardElement.setAttribute).toHaveBeenCalledWith('role', 'dialog');
      expect(uiScoreOverlay.scorecardElement.setAttribute).toHaveBeenCalledWith(
        'aria-labelledby',
        'scorecard-title'
      );
    });

    test('should add keydown listener for focus trapping on scorecard', () => {
      uiScoreOverlay.showFinalScorecard();

      expect(uiScoreOverlay.scorecardElement.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    test('should focus Play Again button when scorecard is shown', () => {
      uiScoreOverlay.showFinalScorecard();

      // Find the Play Again button
      const buttonEl = createdElements.find(
        el => el.tagName === 'BUTTON' && el.textContent === 'Play Again'
      );
      expect(buttonEl).toBeDefined();
      expect(buttonEl.focus).toHaveBeenCalled();
    });

    test('should append scorecard to document body', () => {
      uiScoreOverlay.showFinalScorecard();

      expect(document.body.appendChild).toHaveBeenCalled();
    });

    test('should include par and +/- columns in header', () => {
      uiScoreOverlay.showFinalScorecard();

      // Find the tbody element (has innerHTML set with header)
      const tbodyEl = createdElements.find(
        el => el.tagName === 'TBODY' && el.innerHTML !== undefined
      );
      // The first innerHTML set on tbody is the header row via appendChild
      // Check that a tr element has the header with Par and +/- columns
      const headerTr = createdElements.find(
        el => el.tagName === 'TR' && el.innerHTML && el.innerHTML.includes('Par') && el.innerHTML.includes('+/-')
      );
      expect(headerTr).toBeDefined();
    });

    test('should show par values and over/under par for each hole', () => {
      uiScoreOverlay.showFinalScorecard();

      // Hole 1: strokes 3, par 2 → +1 (over par)
      const hole1Row = createdElements.find(
        el => el.tagName === 'TR' && el.innerHTML && el.innerHTML.includes('Hole 1') && el.innerHTML.includes('+1')
      );
      expect(hole1Row).toBeDefined();
      expect(hole1Row.innerHTML).toContain('score-over-par');

      // Hole 3: strokes 2, par 3 → -1 (under par)
      const hole3Row = createdElements.find(
        el => el.tagName === 'TR' && el.innerHTML && el.innerHTML.includes('Hole 3') && el.innerHTML.includes('-1')
      );
      expect(hole3Row).toBeDefined();
      expect(hole3Row.innerHTML).toContain('score-under-par');
    });

    test('should show total par and total over/under', () => {
      uiScoreOverlay.showFinalScorecard();

      // Total: strokes 9, par 8 → +1
      const totalRow = createdElements.find(
        el => el.tagName === 'TR' && el.innerHTML && el.innerHTML.includes('Total') && el.innerHTML.includes('+1')
      );
      expect(totalRow).toBeDefined();
      expect(totalRow.innerHTML).toContain('8'); // total par
    });

    test('should call getAllHolePars on the course', () => {
      uiScoreOverlay.showFinalScorecard();

      expect(mockGame.course.getAllHolePars).toHaveBeenCalled();
    });

    test('should save score via HighScoreManager on game completion', () => {
      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.getBestScore.mockReturnValue(8);

      uiScoreOverlay.showFinalScorecard();

      expect(HighScoreManager.saveScore).toHaveBeenCalledWith(9, expect.any(String));
    });

    test('should show "New Best!" indicator when score is a new best', () => {
      HighScoreManager.saveScore.mockReturnValue(true);
      HighScoreManager.getBestScore.mockReturnValue(9);

      uiScoreOverlay.showFinalScorecard();

      const bestScoreEl = createdElements.find(
        el => el.classList.add.mock.calls.some(call => call[0] === 'scorecard-best-score')
      );
      expect(bestScoreEl).toBeDefined();
      expect(bestScoreEl.innerHTML).toContain('New Best!');
    });

    test('should show personal best when score is not a new best', () => {
      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.getBestScore.mockReturnValue(7);

      uiScoreOverlay.showFinalScorecard();

      const bestScoreEl = createdElements.find(
        el => el.classList.add.mock.calls.some(call => call[0] === 'scorecard-best-score')
      );
      expect(bestScoreEl).toBeDefined();
      expect(bestScoreEl.textContent).toContain('Personal Best: 7');
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
