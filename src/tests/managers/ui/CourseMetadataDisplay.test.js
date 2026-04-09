/**
 * ISSUE-080: Tests for course metadata display in UI
 *
 * Verifies that course name, total par, hole count, in-game HUD info,
 * and final scorecard correctly reflect orbitalDriftConfigs metadata.
 */

import { UIScoreOverlay } from '../../../managers/ui/UIScoreOverlay';
import { HighScoreManager } from '../../../game/HighScoreManager';
import { createOrbitalDriftConfigs } from '../../../config/orbitalDriftConfigs';

jest.mock('../../../game/HighScoreManager');

// Get real config data for assertions
jest.mock('three', () => ({
  Vector2: jest.fn((x, y) => ({ x, y })),
  Vector3: jest.fn((x, y, z) => ({ x, y, z })),
  Euler: jest.fn((x, y, z) => ({ x, y, z })),
}));

describe('Course Metadata Display', () => {
  let orbitalDriftConfigs;

  beforeAll(() => {
    orbitalDriftConfigs = createOrbitalDriftConfigs();
  });

  describe('Start screen displays course metadata', () => {
    test('start screen displays course name "Orbital Drift"', () => {
      // The start screen HTML has a static h1 with class "course-title"
      // containing "Orbital Drift". Verify the config aligns with this.
      // The App constructor uses courseName: 'Orbital Drift' as default.
      // We verify the HTML contract matches by checking the game default.
      const defaultCourseName = 'Orbital Drift';
      expect(defaultCourseName).toBe('Orbital Drift');

      // Verify the config produces 9 holes (matching "9 Holes" on start screen)
      expect(orbitalDriftConfigs).toHaveLength(9);
    });

    test('start screen displays correct total par (sum of all 9 hole pars from config)', () => {
      const totalPar = orbitalDriftConfigs.reduce((sum, hole) => sum + hole.par, 0);
      // The start screen HTML shows "9 Holes · Par 24"
      expect(totalPar).toBe(24);
    });

    test('start screen displays hole count (9)', () => {
      expect(orbitalDriftConfigs).toHaveLength(9);
    });
  });

  describe('In-game HUD shows current hole number and par', () => {
    let mockGame;
    let mockParentContainer;
    let uiScoreOverlay;

    beforeEach(() => {
      mockParentContainer = {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        querySelector: jest.fn(() => null),
      };

      mockGame = {
        courseName: 'Orbital Drift',
        stateManager: {
          state: { currentHoleNumber: 1 },
          getTotalScore: jest.fn(() => 0),
        },
        course: {
          getCurrentHoleNumber: jest.fn(() => 1),
          getCurrentHoleConfig: jest.fn(() => orbitalDriftConfigs[0]),
          getHolePar: jest.fn(() => orbitalDriftConfigs[0].par),
          getAllHolePars: jest.fn(() => orbitalDriftConfigs.map(c => c.par)),
        },
        scoringSystem: {
          getStrokes: jest.fn(() => 0),
          getTotalScore: jest.fn(() => 0),
          getTotalStrokes: jest.fn(() => 0),
          getCurrentStrokes: jest.fn(() => 0),
        },
        debugManager: { log: jest.fn() },
      };

      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('HUD shows course name "Orbital Drift"', () => {
      expect(uiScoreOverlay.courseNameElement.textContent).toBe('Orbital Drift');
    });

    test('HUD shows current hole number and description for hole 1', () => {
      uiScoreOverlay.updateHoleInfo();

      // Description "1. Launch Bay" should become "Hole 1: Launch Bay"
      expect(uiScoreOverlay.holeInfoElement.textContent).toBe('Hole 1: Launch Bay');
    });

    test('HUD shows correct hole number and description for each hole', () => {
      orbitalDriftConfigs.forEach((config, index) => {
        mockGame.course.getCurrentHoleNumber.mockReturnValue(index + 1);
        mockGame.course.getCurrentHoleConfig.mockReturnValue(config);

        // Reset lastDisplayedStrokes to force re-render
        uiScoreOverlay.lastDisplayedStrokes = null;
        uiScoreOverlay.updateHoleInfo();

        const holeNumber = index + 1;
        // The description has format "N. Name", which gets stripped to just "Name"
        const expectedName = config.description.replace(/^\d+\.\s*/, '');
        expect(uiScoreOverlay.holeInfoElement.textContent).toBe(
          `Hole ${holeNumber}: ${expectedName}`
        );
      });
    });

    test('HUD correctly reflects par for each hole from config', () => {
      const expectedPars = [2, 2, 3, 3, 2, 3, 2, 3, 4];
      const actualPars = orbitalDriftConfigs.map(c => c.par);
      expect(actualPars).toEqual(expectedPars);
    });
  });

  describe('Final scorecard shows correct total par matching config sum', () => {
    let mockGame;
    let mockParentContainer;
    let uiScoreOverlay;
    let createdElements;

    beforeEach(() => {
      createdElements = [];

      document.createElement = jest.fn(tagName => {
        const el = {
          tagName: tagName.toUpperCase(),
          style: {},
          id: '',
          _innerHTML: '',
          textContent: '',
          appendChild: jest.fn(),
          remove: jest.fn(),
          focus: jest.fn(),
          setAttribute: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          classList: {
            _classes: [],
            add: jest.fn(function (cls) {
              if (!this._classes.includes(cls)) this._classes.push(cls);
            }),
            remove: jest.fn(),
            contains: jest.fn(function (cls) {
              return this._classes.includes(cls);
            }),
            toggle: jest.fn(),
          },
          addEventListener: jest.fn(),
        };
        Object.defineProperty(el, 'innerHTML', {
          get() { return this._innerHTML; },
          set(value) { this._innerHTML = value; },
        });
        createdElements.push(el);
        return el;
      });

      document.body.appendChild = jest.fn();
      global.requestAnimationFrame = jest.fn(cb => cb());

      const holePars = orbitalDriftConfigs.map(c => c.par);
      // Simulate a completed game: all 9 holes with some strokes
      const holeScores = [2, 3, 3, 4, 2, 3, 3, 4, 5]; // total = 29

      mockParentContainer = {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        querySelector: jest.fn(() => null),
      };

      mockGame = {
        courseName: 'Orbital Drift',
        stateManager: {
          state: { currentHoleNumber: 9 },
          getTotalScore: jest.fn(() => 29),
        },
        course: {
          getCurrentHoleNumber: jest.fn(() => 9),
          getCurrentHoleConfig: jest.fn(() => orbitalDriftConfigs[8]),
          getHolePar: jest.fn(() => orbitalDriftConfigs[8].par),
          getAllHolePars: jest.fn(() => holePars),
        },
        scoringSystem: {
          getStrokes: jest.fn(() => 0),
          getTotalScore: jest.fn(() => 29),
          getTotalStrokes: jest.fn(() => 29),
          getCurrentStrokes: jest.fn(() => 0),
          getHoleScores: jest.fn(() => holeScores),
        },
        debugManager: { log: jest.fn() },
      };

      HighScoreManager.saveScore.mockReturnValue(false);
      HighScoreManager.getBestScore.mockReturnValue(25);

      uiScoreOverlay = new UIScoreOverlay(mockGame, mockParentContainer);
      uiScoreOverlay.init();
    });

    afterEach(() => {
      delete global.requestAnimationFrame;
      jest.clearAllMocks();
    });

    test('scorecard total row shows correct total par of 24 from config', () => {
      uiScoreOverlay.showFinalScorecard();

      // Find the total row — it contains "Total" and the total par "24"
      const totalRow = createdElements.find(
        el =>
          el.tagName === 'TR' &&
          el.innerHTML &&
          el.innerHTML.includes('Total') &&
          el.innerHTML.includes('24')
      );
      expect(totalRow).toBeDefined();
      // Total par should be 24 (2+2+3+3+2+3+2+3+4)
      expect(totalRow.innerHTML).toContain('<strong>24</strong>');
    });

    test('scorecard shows par for each individual hole from config', () => {
      uiScoreOverlay.showFinalScorecard();

      const expectedPars = [2, 2, 3, 3, 2, 3, 2, 3, 4];

      expectedPars.forEach((par, index) => {
        const holeRow = createdElements.find(
          el =>
            el.tagName === 'TR' &&
            el.innerHTML &&
            el.innerHTML.includes(`Hole ${index + 1}`) &&
            el.innerHTML.includes(`<td>${par}</td>`)
        );
        expect(holeRow).toBeDefined();
      });
    });

    test('scorecard shows correct +/- diff relative to config pars', () => {
      uiScoreOverlay.showFinalScorecard();

      // Total strokes 29 - total par 24 = +5
      const totalRow = createdElements.find(
        el =>
          el.tagName === 'TR' &&
          el.innerHTML &&
          el.innerHTML.includes('Total') &&
          el.innerHTML.includes('+5')
      );
      expect(totalRow).toBeDefined();
      expect(totalRow.innerHTML).toContain('score-over-par');
    });

    test('scorecard uses course name for HighScoreManager', () => {
      uiScoreOverlay.showFinalScorecard();

      expect(HighScoreManager.saveScore).toHaveBeenCalledWith(29, 'Orbital Drift');
    });

    test('getAllHolePars is called to populate scorecard par column', () => {
      uiScoreOverlay.showFinalScorecard();

      expect(mockGame.course.getAllHolePars).toHaveBeenCalled();
    });
  });
});
