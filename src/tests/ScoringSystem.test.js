/**
 * Unit tests for ScoringSystem
 */

import { ScoringSystem } from '../game/ScoringSystem';

describe('ScoringSystem', () => {
  let mockGame;
  let scoringSystem;

  beforeEach(() => {
    mockGame = {
      // Mock game object
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
        '[DEBUG]', '[ScoringSystem] Stroke Added. Current Hole: 1, Total: 1'
      );

      consoleSpy.mockRestore();
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
        '[DEBUG]', '[ScoringSystem] Resetting current hole strokes from 2 to 0.'
      );

      consoleSpy.mockRestore();
    });

    test('should work when called with zero strokes', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      scoringSystem.resetCurrentStrokes();

      expect(scoringSystem.currentHoleStrokes).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG]', '[ScoringSystem] Resetting current hole strokes from 0 to 0.'
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
  });
});
