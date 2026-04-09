import { HighScoreManager } from '../../game/HighScoreManager';

describe('HighScoreManager', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      return mockStorage[key] || null;
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('saveScore', () => {
    test('should save score to localStorage', () => {
      HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(localStorage.setItem).toHaveBeenCalled();
      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved).toHaveLength(1);
      expect(saved[0].totalStrokes).toBe(24);
      expect(saved[0].courseName).toBe('Orbital Drift');
      expect(saved[0].timestamp).toBeDefined();
    });

    test('should return true when score is a new personal best', () => {
      const result = HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(result).toBe(true);
    });

    test('should return true when score beats previous best', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000 },
      ]);

      const result = HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(result).toBe(true);
    });

    test('should return false when score does not beat previous best', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 20, courseName: 'Orbital Drift', timestamp: 1000 },
      ]);

      const result = HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(result).toBe(false);
    });

    test('should return false when score ties previous best', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 24, courseName: 'Orbital Drift', timestamp: 1000 },
      ]);

      const result = HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(result).toBe(false);
    });

    test('should handle localStorage failure gracefully', () => {
      Storage.prototype.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => {
        HighScoreManager.saveScore(24, 'Orbital Drift');
      }).not.toThrow();
    });

    test('should append to existing scores', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000 },
      ]);

      HighScoreManager.saveScore(24, 'Orbital Drift');

      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved).toHaveLength(2);
    });
  });

  describe('getBestScore', () => {
    test('should return null when no scores exist', () => {
      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });

    test('should return the lowest score for a course', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000 },
        { totalStrokes: 22, courseName: 'Orbital Drift', timestamp: 2000 },
        { totalStrokes: 28, courseName: 'Orbital Drift', timestamp: 3000 },
      ]);

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBe(22);
    });

    test('should only consider scores for the specified course', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 10, courseName: 'Other Course', timestamp: 1000 },
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 2000 },
      ]);

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBe(30);
    });

    test('should handle corrupted localStorage data gracefully', () => {
      mockStorage['miniGolfBreak_highScores'] = 'not valid json{{{';

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });

    test('should handle non-array localStorage data gracefully', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify({ foo: 'bar' });

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });

    test('should handle localStorage getItem failure gracefully', () => {
      Storage.prototype.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });
  });
});
