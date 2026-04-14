import { ScoringSystem } from '../../game/ScoringSystem';

describe('ScoringSystem', () => {
  let mockGame;
  let scoring;

  beforeEach(() => {
    mockGame = {
      eventManager: {
        publish: jest.fn()
      }
    };
    scoring = new ScoringSystem(mockGame);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('initializes stroke counters to zero', () => {
      expect(scoring.continuousStrokeCount).toBe(0);
      expect(scoring.currentHoleStrokes).toBe(0);
    });

    test('initializes holeScores to empty array', () => {
      expect(scoring.holeScores).toEqual([]);
    });

    test('initializes maxStrokes to null', () => {
      expect(scoring.maxStrokes).toBeNull();
    });

    test('stores game reference', () => {
      expect(scoring.game).toBe(mockGame);
    });
  });

  describe('addStroke', () => {
    test('increments current hole stroke count', () => {
      scoring.addStroke();
      expect(scoring.getCurrentStrokes()).toBe(1);
    });

    test('increments continuous (total) stroke count', () => {
      scoring.addStroke();
      expect(scoring.getTotalStrokes()).toBe(1);
    });

    test('increments both counters on multiple calls', () => {
      scoring.addStroke();
      scoring.addStroke();
      scoring.addStroke();
      expect(scoring.getCurrentStrokes()).toBe(3);
      expect(scoring.getTotalStrokes()).toBe(3);
    });

    test('returns instance for chaining', () => {
      expect(scoring.addStroke()).toBe(scoring);
    });

    test('publishes STROKE_LIMIT_WARNING one stroke before max', () => {
      scoring.setMaxStrokes(2); // maxStrokes = 5
      for (let i = 0; i < 4; i++) {
        scoring.addStroke();
      }
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        'scoring:stroke_limit_warning',
        { currentStrokes: 4, maxStrokes: 5 },
        scoring
      );
    });

    test('publishes STROKE_LIMIT_REACHED at max strokes', () => {
      scoring.setMaxStrokes(2); // maxStrokes = 5
      for (let i = 0; i < 5; i++) {
        scoring.addStroke();
      }
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        'scoring:stroke_limit_reached',
        { currentStrokes: 5, maxStrokes: 5 },
        scoring
      );
    });

    test('does not publish events when maxStrokes is null', () => {
      scoring.addStroke();
      scoring.addStroke();
      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();
    });

    test('does not throw when eventManager is missing', () => {
      const ss = new ScoringSystem({});
      ss.setMaxStrokes(2);
      expect(() => {
        for (let i = 0; i < 6; i++) {
          ss.addStroke();
        }
      }).not.toThrow();
    });
  });

  describe('getTotalStrokes', () => {
    test('returns zero on fresh instance', () => {
      expect(scoring.getTotalStrokes()).toBe(0);
    });

    test('sums all strokes across holes', () => {
      scoring.addStroke().addStroke();
      scoring.completeHole();
      scoring.resetCurrentStrokes();

      scoring.addStroke().addStroke().addStroke();
      scoring.completeHole();
      scoring.resetCurrentStrokes();

      expect(scoring.getTotalStrokes()).toBe(5);
    });

    test('includes strokes from partially-played current hole', () => {
      scoring.addStroke().addStroke();
      scoring.completeHole();
      scoring.resetCurrentStrokes();

      scoring.addStroke();
      // hole not completed yet
      expect(scoring.getTotalStrokes()).toBe(3);
    });

    test('total persists across resetCurrentStrokes calls', () => {
      scoring.addStroke().addStroke();
      scoring.resetCurrentStrokes();
      scoring.addStroke();
      expect(scoring.getTotalStrokes()).toBe(3);
    });
  });

  describe('getCurrentStrokes', () => {
    test('returns zero initially', () => {
      expect(scoring.getCurrentStrokes()).toBe(0);
    });

    test('tracks strokes for current hole', () => {
      scoring.addStroke().addStroke();
      expect(scoring.getCurrentStrokes()).toBe(2);
    });
  });

  describe('resetCurrentStrokes', () => {
    test('resets current hole strokes to zero', () => {
      scoring.addStroke().addStroke().addStroke();
      scoring.resetCurrentStrokes();
      expect(scoring.getCurrentStrokes()).toBe(0);
    });

    test('does not affect total stroke count', () => {
      scoring.addStroke().addStroke();
      scoring.resetCurrentStrokes();
      expect(scoring.getTotalStrokes()).toBe(2);
    });

    test('returns instance for chaining', () => {
      expect(scoring.resetCurrentStrokes()).toBe(scoring);
    });

    test('is safe to call when strokes are already zero', () => {
      scoring.resetCurrentStrokes();
      expect(scoring.getCurrentStrokes()).toBe(0);
    });
  });

  describe('completeHole', () => {
    test('records current hole strokes in holeScores', () => {
      scoring.addStroke().addStroke();
      scoring.completeHole();
      expect(scoring.getHoleScores()).toEqual([2]);
    });

    test('records across multiple holes', () => {
      scoring.addStroke().addStroke();
      scoring.completeHole();
      scoring.resetCurrentStrokes();

      scoring.addStroke().addStroke().addStroke();
      scoring.completeHole();
      scoring.resetCurrentStrokes();

      scoring.addStroke();
      scoring.completeHole();

      expect(scoring.getHoleScores()).toEqual([2, 3, 1]);
    });

    test('returns instance for chaining', () => {
      expect(scoring.completeHole()).toBe(scoring);
    });

    test('records zero if no strokes were taken', () => {
      scoring.completeHole();
      expect(scoring.getScoreForHole(0)).toBe(0);
    });
  });

  describe('getHoleScores', () => {
    test('returns empty array initially', () => {
      expect(scoring.getHoleScores()).toEqual([]);
    });

    test('returns array of all completed hole scores', () => {
      scoring.addStroke();
      scoring.completeHole();
      scoring.resetCurrentStrokes();

      scoring.addStroke().addStroke();
      scoring.completeHole();

      expect(scoring.getHoleScores()).toEqual([1, 2]);
    });
  });

  describe('getScoreForHole', () => {
    test('returns null for index with no recorded score', () => {
      expect(scoring.getScoreForHole(0)).toBeNull();
    });

    test('returns correct score for a completed hole', () => {
      scoring.addStroke().addStroke().addStroke();
      scoring.completeHole();
      expect(scoring.getScoreForHole(0)).toBe(3);
    });

    test('returns null for out-of-range index', () => {
      scoring.addStroke();
      scoring.completeHole();
      expect(scoring.getScoreForHole(99)).toBeNull();
    });

    test('returns null for negative index', () => {
      scoring.addStroke();
      scoring.completeHole();
      expect(scoring.getScoreForHole(-1)).toBeNull();
    });
  });

  describe('hole-in-one detection', () => {
    test('hole completed with exactly 1 stroke records score of 1', () => {
      scoring.addStroke();
      scoring.completeHole();
      expect(scoring.getScoreForHole(0)).toBe(1);
    });

    test('hole completed with 2+ strokes does not record 1', () => {
      scoring.addStroke().addStroke();
      scoring.completeHole();
      expect(scoring.getScoreForHole(0)).not.toBe(1);
    });
  });

  describe('relative to par (computed from score and par)', () => {
    test('under par: 2 strokes on par 3 = -1', () => {
      scoring.addStroke().addStroke();
      scoring.completeHole();
      const par = 3;
      expect(scoring.getScoreForHole(0) - par).toBe(-1);
    });

    test('even par: 3 strokes on par 3 = 0', () => {
      scoring.addStroke().addStroke().addStroke();
      scoring.completeHole();
      const par = 3;
      expect(scoring.getScoreForHole(0) - par).toBe(0);
    });

    test('over par: 5 strokes on par 3 = +2', () => {
      for (let i = 0; i < 5; i++) {
        scoring.addStroke();
      }
      scoring.completeHole();
      const par = 3;
      expect(scoring.getScoreForHole(0) - par).toBe(2);
    });
  });

  describe('deriveMaxStrokes (static)', () => {
    test('defaults to par * 2 + 1', () => {
      expect(ScoringSystem.deriveMaxStrokes(2)).toBe(5);
      expect(ScoringSystem.deriveMaxStrokes(3)).toBe(7);
      expect(ScoringSystem.deriveMaxStrokes(4)).toBe(9);
    });

    test('uses configMaxStrokes when provided', () => {
      expect(ScoringSystem.deriveMaxStrokes(2, 6)).toBe(6);
    });

    test('clamps to minimum of 3', () => {
      expect(ScoringSystem.deriveMaxStrokes(2, 1)).toBe(3);
      expect(ScoringSystem.deriveMaxStrokes(1)).toBe(3);
    });

    test('clamps to maximum of 10', () => {
      expect(ScoringSystem.deriveMaxStrokes(2, 15)).toBe(10);
      expect(ScoringSystem.deriveMaxStrokes(5)).toBe(10);
    });

    test('treats null configMaxStrokes as absent', () => {
      expect(ScoringSystem.deriveMaxStrokes(3, null)).toBe(7);
    });

    test('treats undefined configMaxStrokes as absent', () => {
      expect(ScoringSystem.deriveMaxStrokes(3, undefined)).toBe(7);
    });
  });

  describe('setMaxStrokes', () => {
    test('sets maxStrokes derived from par', () => {
      scoring.setMaxStrokes(3);
      expect(scoring.getMaxStrokes()).toBe(7);
    });

    test('sets maxStrokes from config override', () => {
      scoring.setMaxStrokes(3, 8);
      expect(scoring.getMaxStrokes()).toBe(8);
    });

    test('returns instance for chaining', () => {
      expect(scoring.setMaxStrokes(3)).toBe(scoring);
    });
  });

  describe('isAtLimit', () => {
    test('returns false when maxStrokes is null', () => {
      scoring.addStroke();
      expect(scoring.isAtLimit()).toBe(false);
    });

    test('returns false when below limit', () => {
      scoring.setMaxStrokes(2); // maxStrokes = 5
      scoring.addStroke().addStroke();
      expect(scoring.isAtLimit()).toBe(false);
    });

    test('returns true when at limit', () => {
      scoring.setMaxStrokes(2); // maxStrokes = 5
      for (let i = 0; i < 5; i++) {
        scoring.addStroke();
      }
      expect(scoring.isAtLimit()).toBe(true);
    });

    test('returns true when above limit', () => {
      scoring.setMaxStrokes(2, 3); // maxStrokes = 3
      for (let i = 0; i < 4; i++) {
        scoring.addStroke();
      }
      expect(scoring.isAtLimit()).toBe(true);
    });
  });

  describe('getMaxStrokes', () => {
    test('returns null initially', () => {
      expect(scoring.getMaxStrokes()).toBeNull();
    });

    test('returns value after setMaxStrokes', () => {
      scoring.setMaxStrokes(3);
      expect(scoring.getMaxStrokes()).toBe(7);
    });
  });

  describe('full round simulation', () => {
    test('tracks a complete 3-hole round correctly', () => {
      // Hole 1: par 3, 2 strokes (birdie)
      scoring.setMaxStrokes(3);
      scoring.addStroke().addStroke();
      scoring.completeHole();
      scoring.resetCurrentStrokes();

      // Hole 2: par 3, 3 strokes (par)
      scoring.setMaxStrokes(3);
      scoring.addStroke().addStroke().addStroke();
      scoring.completeHole();
      scoring.resetCurrentStrokes();

      // Hole 3: par 4, 5 strokes (bogey)
      scoring.setMaxStrokes(4);
      for (let i = 0; i < 5; i++) {
        scoring.addStroke();
      }
      scoring.completeHole();
      scoring.resetCurrentStrokes();

      expect(scoring.getHoleScores()).toEqual([2, 3, 5]);
      expect(scoring.getTotalStrokes()).toBe(10);
      expect(scoring.getScoreForHole(0)).toBe(2);
      expect(scoring.getScoreForHole(1)).toBe(3);
      expect(scoring.getScoreForHole(2)).toBe(5);
      expect(scoring.getCurrentStrokes()).toBe(0);
    });

    test('handles partial round with incomplete hole', () => {
      scoring.addStroke().addStroke();
      scoring.completeHole();
      scoring.resetCurrentStrokes();

      scoring.addStroke();
      // second hole not completed

      expect(scoring.getHoleScores()).toEqual([2]);
      expect(scoring.getTotalStrokes()).toBe(3);
      expect(scoring.getCurrentStrokes()).toBe(1);
      expect(scoring.getScoreForHole(1)).toBeNull();
    });

    test('records capped score when stroke limit is reached', () => {
      scoring.setMaxStrokes(2); // maxStrokes = 5
      for (let i = 0; i < 5; i++) {
        scoring.addStroke();
      }
      scoring.completeHole();
      expect(scoring.getScoreForHole(0)).toBe(5);
      expect(scoring.isAtLimit()).toBe(true);
    });
  });
});
