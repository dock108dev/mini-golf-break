/**
 * Unit tests for ScoringSystem
 */

import { ScoringSystem } from '../game/ScoringSystem';

describe('ScoringSystem', () => {
  let mockGame;
  let scoringSystem;

  beforeEach(() => {
    mockGame = {
      eventManager: {
        publish: jest.fn()
      }
    };
    scoringSystem = new ScoringSystem(mockGame);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with game reference', () => {
      expect(scoringSystem.game).toBe(mockGame);
    });

    test('should initialize stroke counters to zero', () => {
      expect(scoringSystem.continuousStrokeCount).toBe(0);
      expect(scoringSystem.currentHoleStrokes).toBe(0);
    });

    test('should initialize maxStrokes to null', () => {
      expect(scoringSystem.maxStrokes).toBeNull();
    });
  });

  describe('addStroke', () => {
    test('should increment both stroke counters', () => {
      scoringSystem.addStroke();

      expect(scoringSystem.continuousStrokeCount).toBe(1);
      expect(scoringSystem.currentHoleStrokes).toBe(1);
    });

    test('should increment counters multiple times', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.addStroke();

      expect(scoringSystem.continuousStrokeCount).toBe(3);
      expect(scoringSystem.currentHoleStrokes).toBe(3);
    });

    test('should return the scoring system instance for chaining', () => {
      const result = scoringSystem.addStroke();

      expect(result).toBe(scoringSystem);
    });

    test('should log stroke information', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      scoringSystem.addStroke();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG]',
        '[ScoringSystem] Stroke Added. Current Hole: 1, Total: 1'
      );

      consoleSpy.mockRestore();
    });

    test('should emit STROKE_LIMIT_WARNING at maxStrokes - 1', () => {
      scoringSystem.setMaxStrokes(2); // maxStrokes = 5

      for (let i = 0; i < 3; i++) {
        scoringSystem.addStroke();
      }
      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();

      scoringSystem.addStroke(); // stroke 4 = maxStrokes - 1
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        'scoring:stroke_limit_warning',
        { currentStrokes: 4, maxStrokes: 5 },
        scoringSystem
      );
    });

    test('should emit STROKE_LIMIT_REACHED at maxStrokes', () => {
      scoringSystem.setMaxStrokes(2); // maxStrokes = 5

      for (let i = 0; i < 4; i++) {
        scoringSystem.addStroke();
      }
      mockGame.eventManager.publish.mockClear();

      scoringSystem.addStroke(); // stroke 5 = maxStrokes
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        'scoring:stroke_limit_reached',
        { currentStrokes: 5, maxStrokes: 5 },
        scoringSystem
      );
    });

    test('should not emit events when maxStrokes is null', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.addStroke();

      expect(mockGame.eventManager.publish).not.toHaveBeenCalled();
    });

    test('should not emit events when eventManager is missing', () => {
      const noEventGame = {};
      const ss = new ScoringSystem(noEventGame);
      ss.setMaxStrokes(2);

      expect(() => {
        for (let i = 0; i < 5; i++) {
          ss.addStroke();
        }
      }).not.toThrow();
    });
  });

  describe('deriveMaxStrokes', () => {
    test('should default to par * 2 + 1', () => {
      expect(ScoringSystem.deriveMaxStrokes(2)).toBe(5);
      expect(ScoringSystem.deriveMaxStrokes(3)).toBe(7);
      expect(ScoringSystem.deriveMaxStrokes(4)).toBe(9);
    });

    test('should use configMaxStrokes when provided', () => {
      expect(ScoringSystem.deriveMaxStrokes(2, 6)).toBe(6);
      expect(ScoringSystem.deriveMaxStrokes(3, 8)).toBe(8);
    });

    test('should clamp configMaxStrokes to min 3', () => {
      expect(ScoringSystem.deriveMaxStrokes(2, 1)).toBe(3);
      expect(ScoringSystem.deriveMaxStrokes(2, 2)).toBe(3);
    });

    test('should clamp configMaxStrokes to max 10', () => {
      expect(ScoringSystem.deriveMaxStrokes(2, 15)).toBe(10);
      expect(ScoringSystem.deriveMaxStrokes(2, 11)).toBe(10);
    });

    test('should clamp derived value to max 10', () => {
      expect(ScoringSystem.deriveMaxStrokes(5)).toBe(10);
      expect(ScoringSystem.deriveMaxStrokes(10)).toBe(10);
    });

    test('should clamp derived value to min 3', () => {
      expect(ScoringSystem.deriveMaxStrokes(1)).toBe(3);
    });

    test('should treat null configMaxStrokes as absent', () => {
      expect(ScoringSystem.deriveMaxStrokes(2, null)).toBe(5);
    });

    test('should treat undefined configMaxStrokes as absent', () => {
      expect(ScoringSystem.deriveMaxStrokes(2, undefined)).toBe(5);
    });
  });

  describe('setMaxStrokes', () => {
    test('should set maxStrokes from par', () => {
      scoringSystem.setMaxStrokes(3);
      expect(scoringSystem.maxStrokes).toBe(7);
    });

    test('should set maxStrokes from config override', () => {
      scoringSystem.setMaxStrokes(3, 8);
      expect(scoringSystem.maxStrokes).toBe(8);
    });

    test('should return scoring system for chaining', () => {
      const result = scoringSystem.setMaxStrokes(3);
      expect(result).toBe(scoringSystem);
    });
  });

  describe('isAtLimit', () => {
    test('should return false when maxStrokes is null', () => {
      scoringSystem.addStroke();
      expect(scoringSystem.isAtLimit()).toBe(false);
    });

    test('should return false when below limit', () => {
      scoringSystem.setMaxStrokes(2); // maxStrokes = 5
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      expect(scoringSystem.isAtLimit()).toBe(false);
    });

    test('should return true when at limit', () => {
      scoringSystem.setMaxStrokes(2); // maxStrokes = 5
      for (let i = 0; i < 5; i++) {
        scoringSystem.addStroke();
      }
      expect(scoringSystem.isAtLimit()).toBe(true);
    });

    test('should return true when above limit', () => {
      scoringSystem.setMaxStrokes(2, 3); // maxStrokes = 3
      for (let i = 0; i < 4; i++) {
        scoringSystem.addStroke();
      }
      expect(scoringSystem.isAtLimit()).toBe(true);
    });
  });

  describe('getMaxStrokes', () => {
    test('should return null initially', () => {
      expect(scoringSystem.getMaxStrokes()).toBeNull();
    });

    test('should return set value', () => {
      scoringSystem.setMaxStrokes(3);
      expect(scoringSystem.getMaxStrokes()).toBe(7);
    });
  });

  describe('getTotalStrokes', () => {
    test('should return zero initially', () => {
      expect(scoringSystem.getTotalStrokes()).toBe(0);
    });

    test('should return total strokes after adding strokes', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();

      expect(scoringSystem.getTotalStrokes()).toBe(2);
    });

    test('should maintain total count across hole resets', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.resetCurrentStrokes();
      scoringSystem.addStroke();

      expect(scoringSystem.getTotalStrokes()).toBe(3);
    });
  });

  describe('getCurrentStrokes', () => {
    test('should return zero initially', () => {
      expect(scoringSystem.getCurrentStrokes()).toBe(0);
    });

    test('should return current hole strokes after adding strokes', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();

      expect(scoringSystem.getCurrentStrokes()).toBe(2);
    });

    test('should reset to zero after resetCurrentStrokes', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.resetCurrentStrokes();

      expect(scoringSystem.getCurrentStrokes()).toBe(0);
    });
  });

  describe('resetCurrentStrokes', () => {
    test('should reset current hole strokes to zero', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.addStroke();

      scoringSystem.resetCurrentStrokes();

      expect(scoringSystem.currentHoleStrokes).toBe(0);
    });

    test('should not affect total stroke count', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      const totalBefore = scoringSystem.getTotalStrokes();

      scoringSystem.resetCurrentStrokes();

      expect(scoringSystem.getTotalStrokes()).toBe(totalBefore);
    });

    test('should return the scoring system instance for chaining', () => {
      const result = scoringSystem.resetCurrentStrokes();

      expect(result).toBe(scoringSystem);
    });

    test('should log reset information', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.resetCurrentStrokes();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG]',
        '[ScoringSystem] Resetting current hole strokes from 2 to 0.'
      );

      consoleSpy.mockRestore();
    });

    test('should work when called with zero strokes', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      scoringSystem.resetCurrentStrokes();

      expect(scoringSystem.currentHoleStrokes).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG]',
        '[ScoringSystem] Resetting current hole strokes from 0 to 0.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('completeHole', () => {
    test('should return the scoring system instance for chaining', () => {
      const result = scoringSystem.completeHole();

      expect(result).toBe(scoringSystem);
    });

    test('should push current hole strokes to holeScores', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();

      scoringSystem.completeHole();

      expect(scoringSystem.holeScores).toEqual([2]);
    });

    test('should not affect stroke counts', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();

      const totalBefore = scoringSystem.getTotalStrokes();
      const currentBefore = scoringSystem.getCurrentStrokes();

      scoringSystem.completeHole();

      expect(scoringSystem.getTotalStrokes()).toBe(totalBefore);
      expect(scoringSystem.getCurrentStrokes()).toBe(currentBefore);
    });
  });

  describe('getHoleScores', () => {
    test('should return empty array initially', () => {
      expect(scoringSystem.getHoleScores()).toEqual([]);
    });

    test('should return all hole scores after completing holes', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.completeHole();
      scoringSystem.resetCurrentStrokes();

      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.completeHole();

      expect(scoringSystem.getHoleScores()).toEqual([2, 3]);
    });
  });

  describe('getScoreForHole', () => {
    test('should return null for non-existent hole', () => {
      expect(scoringSystem.getScoreForHole(0)).toBeNull();
    });

    test('should return score for completed hole', () => {
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.completeHole();

      expect(scoringSystem.getScoreForHole(0)).toBe(2);
    });

    test('should return null for out-of-range index', () => {
      scoringSystem.addStroke();
      scoringSystem.completeHole();

      expect(scoringSystem.getScoreForHole(5)).toBeNull();
    });
  });

  describe('method chaining', () => {
    test('should support method chaining', () => {
      const result = scoringSystem.addStroke().addStroke().resetCurrentStrokes().completeHole();

      expect(result).toBe(scoringSystem);
      expect(scoringSystem.getTotalStrokes()).toBe(2);
      expect(scoringSystem.getCurrentStrokes()).toBe(0);
    });
  });

  describe('edge cases', () => {
    test('should handle multiple hole cycles', () => {
      // Hole 1
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.resetCurrentStrokes();
      scoringSystem.completeHole();

      // Hole 2
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.addStroke();
      scoringSystem.resetCurrentStrokes();
      scoringSystem.completeHole();

      // Hole 3
      scoringSystem.addStroke();

      expect(scoringSystem.getTotalStrokes()).toBe(6);
      expect(scoringSystem.getCurrentStrokes()).toBe(1);
    });

    test('should handle large stroke counts', () => {
      for (let i = 0; i < 100; i++) {
        scoringSystem.addStroke();
      }

      expect(scoringSystem.getTotalStrokes()).toBe(100);
      expect(scoringSystem.getCurrentStrokes()).toBe(100);
    });

    test('should record capped score at maxStrokes when limit reached', () => {
      scoringSystem.setMaxStrokes(2); // maxStrokes = 5
      for (let i = 0; i < 5; i++) {
        scoringSystem.addStroke();
      }
      scoringSystem.completeHole();
      expect(scoringSystem.getScoreForHole(0)).toBe(5);
    });
  });
});
