import { HighScoreManager } from '../../game/HighScoreManager';

describe('HighScoreManager', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(key => {
      return mockStorage[key] || null;
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(key => {
      delete mockStorage[key];
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('saveScore', () => {
    test('should save score to localStorage with correct key and JSON format', () => {
      HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'miniGolfBreak_highScores',
        expect.any(String)
      );
      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved).toHaveLength(1);
      expect(saved[0].totalStrokes).toBe(24);
      expect(saved[0].courseName).toBe('Orbital Drift');
      expect(saved[0].timestamp).toBeDefined();
    });

    test('should return true when no previous score exists (first play)', () => {
      const result = HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(result).toBe(true);
    });

    test('should return true when score beats previous best (lower strokes)', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000 }
      ]);

      const result = HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(result).toBe(true);
    });

    test('should return false when score does not beat previous best', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 20, courseName: 'Orbital Drift', timestamp: 1000 }
      ]);

      const result = HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(result).toBe(false);
    });

    test('should return false when score ties previous best', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 24, courseName: 'Orbital Drift', timestamp: 1000 }
      ]);

      const result = HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(result).toBe(false);
    });

    test('should append to existing scores without overwriting', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000 }
      ]);

      HighScoreManager.saveScore(24, 'Orbital Drift');

      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved).toHaveLength(2);
      expect(saved[0].totalStrokes).toBe(30);
      expect(saved[1].totalStrokes).toBe(24);
    });

    test('should handle QuotaExceededError without throwing', () => {
      Storage.prototype.setItem.mockImplementation(() => {
        const err = new DOMException('quota exceeded', 'QuotaExceededError');
        throw err;
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        HighScoreManager.saveScore(24, 'Orbital Drift');
      }).not.toThrow();

      expect(warnSpy).toHaveBeenCalledWith(
        '[HighScoreManager] Failed to save score to localStorage.'
      );
      warnSpy.mockRestore();
    });

    test('should still return isNewBest even when save fails', () => {
      Storage.prototype.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(result).toBe(true);
      console.warn.mockRestore();
    });

    test('should handle private browsing mode (localStorage throws on access)', () => {
      Storage.prototype.getItem.mockImplementation(() => {
        throw new DOMException('access denied', 'SecurityError');
      });
      Storage.prototype.setItem.mockImplementation(() => {
        throw new DOMException('access denied', 'SecurityError');
      });
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        HighScoreManager.saveScore(24, 'Orbital Drift');
      }).not.toThrow();

      console.warn.mockRestore();
    });

    test('should store scores for different courses independently', () => {
      HighScoreManager.saveScore(24, 'Orbital Drift');
      HighScoreManager.saveScore(18, 'Other Course');

      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved).toHaveLength(2);
      expect(saved[0].courseName).toBe('Orbital Drift');
      expect(saved[1].courseName).toBe('Other Course');
    });
  });

  describe('getBestScore', () => {
    test('should return null when no scores exist', () => {
      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });

    test('should return null when localStorage key is absent', () => {
      delete mockStorage['miniGolfBreak_highScores'];

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });

    test('should return the lowest score for a course', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000 },
        { totalStrokes: 22, courseName: 'Orbital Drift', timestamp: 2000 },
        { totalStrokes: 28, courseName: 'Orbital Drift', timestamp: 3000 }
      ]);

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBe(22);
    });

    test('should only consider scores for the specified course', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 10, courseName: 'Other Course', timestamp: 1000 },
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 2000 }
      ]);

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBe(30);
    });

    test('should return null for a course with no scores among mixed data', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 10, courseName: 'Other Course', timestamp: 1000 }
      ]);

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });

    test('should handle corrupted localStorage data (invalid JSON) gracefully', () => {
      mockStorage['miniGolfBreak_highScores'] = 'not valid json{{{';

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });

    test('should handle non-array localStorage data gracefully', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify({ foo: 'bar' });

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });

    test('should handle localStorage getItem throwing (private browsing)', () => {
      Storage.prototype.getItem.mockImplementation(() => {
        throw new DOMException('access denied', 'SecurityError');
      });

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });

    test('should return single score when only one exists for course', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 25, courseName: 'Orbital Drift', timestamp: 1000 }
      ]);

      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBe(25);
    });
  });

  describe('_loadScores', () => {
    test('should return empty array when localStorage is empty', () => {
      const result = HighScoreManager._loadScores();

      expect(result).toEqual([]);
    });

    test('should return parsed array from valid localStorage data', () => {
      const scores = [{ totalStrokes: 24, courseName: 'Orbital Drift', timestamp: 1000 }];
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify(scores);

      const result = HighScoreManager._loadScores();

      expect(result).toEqual(scores);
    });

    test('should return empty array for invalid JSON', () => {
      mockStorage['miniGolfBreak_highScores'] = '{{invalid';

      const result = HighScoreManager._loadScores();

      expect(result).toEqual([]);
    });

    test('should return empty array when stored value is not an array', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify('just a string');

      const result = HighScoreManager._loadScores();

      expect(result).toEqual([]);
    });

    test('should return empty array when stored value is null JSON', () => {
      mockStorage['miniGolfBreak_highScores'] = 'null';

      const result = HighScoreManager._loadScores();

      expect(result).toEqual([]);
    });

    test('should return empty array when localStorage throws', () => {
      Storage.prototype.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const result = HighScoreManager._loadScores();

      expect(result).toEqual([]);
    });
  });

  describe('new best detection (isNewBest via saveScore return value)', () => {
    test('should detect new best when first score for course', () => {
      const isNewBest = HighScoreManager.saveScore(30, 'Orbital Drift');

      expect(isNewBest).toBe(true);
    });

    test('should detect new best when lower than all previous scores', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000 },
        { totalStrokes: 28, courseName: 'Orbital Drift', timestamp: 2000 }
      ]);

      const isNewBest = HighScoreManager.saveScore(25, 'Orbital Drift');

      expect(isNewBest).toBe(true);
    });

    test('should not detect new best when higher than previous best', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 20, courseName: 'Orbital Drift', timestamp: 1000 }
      ]);

      const isNewBest = HighScoreManager.saveScore(25, 'Orbital Drift');

      expect(isNewBest).toBe(false);
    });

    test('should not detect new best when equal to previous best', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 25, courseName: 'Orbital Drift', timestamp: 1000 }
      ]);

      const isNewBest = HighScoreManager.saveScore(25, 'Orbital Drift');

      expect(isNewBest).toBe(false);
    });

    test('should evaluate new best per course independently', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 20, courseName: 'Other Course', timestamp: 1000 }
      ]);

      const isNewBest = HighScoreManager.saveScore(25, 'Orbital Drift');

      expect(isNewBest).toBe(true);
    });
  });

  describe('getScores', () => {
    test('should return empty array when no scores exist', () => {
      const result = HighScoreManager.getScores('Orbital Drift');

      expect(result).toEqual([]);
    });

    test('should return scores sorted best-first (ascending by strokes)', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000 },
        { totalStrokes: 22, courseName: 'Orbital Drift', timestamp: 2000 },
        { totalStrokes: 28, courseName: 'Orbital Drift', timestamp: 3000 }
      ]);

      const result = HighScoreManager.getScores('Orbital Drift');

      expect(result).toHaveLength(3);
      expect(result[0].totalStrokes).toBe(22);
      expect(result[1].totalStrokes).toBe(28);
      expect(result[2].totalStrokes).toBe(30);
    });

    test('should only return scores for the specified course', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 10, courseName: 'Other Course', timestamp: 1000 },
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 2000 }
      ]);

      const result = HighScoreManager.getScores('Orbital Drift');

      expect(result).toHaveLength(1);
      expect(result[0].totalStrokes).toBe(30);
    });
  });

  describe('clearScores', () => {
    test('should clear scores for a specific course', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000 },
        { totalStrokes: 10, courseName: 'Other Course', timestamp: 2000 }
      ]);

      HighScoreManager.clearScores('Orbital Drift');

      const remaining = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].courseName).toBe('Other Course');
    });

    test('should remove storage key when clearing all scores', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000 }
      ]);

      HighScoreManager.clearScores();

      expect(mockStorage['miniGolfBreak_highScores']).toBeUndefined();
    });

    test('should handle localStorage failure gracefully', () => {
      Storage.prototype.getItem.mockImplementation(() => {
        throw new Error('access denied');
      });
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        HighScoreManager.clearScores('Orbital Drift');
      }).not.toThrow();

      console.warn.mockRestore();
    });
  });

  describe('private browsing / full localStorage failure', () => {
    beforeEach(() => {
      Storage.prototype.getItem.mockImplementation(() => {
        throw new DOMException('access denied', 'SecurityError');
      });
      Storage.prototype.setItem.mockImplementation(() => {
        throw new DOMException('access denied', 'SecurityError');
      });
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      console.warn.mockRestore();
    });

    test('saveScore degrades gracefully', () => {
      expect(() => {
        HighScoreManager.saveScore(24, 'Orbital Drift');
      }).not.toThrow();
    });

    test('getBestScore returns null', () => {
      const result = HighScoreManager.getBestScore('Orbital Drift');

      expect(result).toBeNull();
    });

    test('_loadScores returns empty array', () => {
      const result = HighScoreManager._loadScores();

      expect(result).toEqual([]);
    });

    test('saveScore still returns isNewBest=true when no prior data accessible', () => {
      const result = HighScoreManager.saveScore(24, 'Orbital Drift');

      expect(result).toBe(true);
    });
  });

  describe('isTopTen', () => {
    test('should return true when no scores exist', () => {
      const result = HighScoreManager.isTopTen(30, 'Orbital Drift');

      expect(result).toBe(true);
    });

    test('should return true when fewer than 10 scores stored', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 20, courseName: 'Orbital Drift', timestamp: 1000 },
        { totalStrokes: 22, courseName: 'Orbital Drift', timestamp: 2000 }
      ]);

      const result = HighScoreManager.isTopTen(50, 'Orbital Drift');

      expect(result).toBe(true);
    });

    test('should return true when score beats the 10th entry', () => {
      const scores = [];
      for (let i = 0; i < 10; i++) {
        scores.push({
          totalStrokes: 20 + i,
          courseName: 'Orbital Drift',
          timestamp: 1000 + i
        });
      }
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify(scores);

      const result = HighScoreManager.isTopTen(25, 'Orbital Drift');

      expect(result).toBe(true);
    });

    test('should return false when score is worse than all 10 stored scores', () => {
      const scores = [];
      for (let i = 0; i < 10; i++) {
        scores.push({
          totalStrokes: 20 + i,
          courseName: 'Orbital Drift',
          timestamp: 1000 + i
        });
      }
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify(scores);

      const result = HighScoreManager.isTopTen(30, 'Orbital Drift');

      expect(result).toBe(false);
    });

    test('should return false when score ties the worst of 10', () => {
      const scores = [];
      for (let i = 0; i < 10; i++) {
        scores.push({
          totalStrokes: 20 + i,
          courseName: 'Orbital Drift',
          timestamp: 1000 + i
        });
      }
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify(scores);

      const result = HighScoreManager.isTopTen(29, 'Orbital Drift');

      expect(result).toBe(false);
    });

    test('should only consider scores for the specified course', () => {
      const scores = [];
      for (let i = 0; i < 10; i++) {
        scores.push({
          totalStrokes: 20 + i,
          courseName: 'Other Course',
          timestamp: 1000 + i
        });
      }
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify(scores);

      const result = HighScoreManager.isTopTen(50, 'Orbital Drift');

      expect(result).toBe(true);
    });
  });

  describe('saveNamedScore', () => {
    test('should save score with initials to localStorage', () => {
      HighScoreManager.saveNamedScore('ABC', 24, 'Orbital Drift');

      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved).toHaveLength(1);
      expect(saved[0].initials).toBe('ABC');
      expect(saved[0].totalStrokes).toBe(24);
      expect(saved[0].courseName).toBe('Orbital Drift');
      expect(saved[0].date).toBeDefined();
    });

    test('should uppercase and sanitize initials', () => {
      HighScoreManager.saveNamedScore('a1b', 24, 'Orbital Drift');

      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved[0].initials).toBe('AB-');
    });

    test('should truncate initials to 3 characters', () => {
      HighScoreManager.saveNamedScore('ABCDEF', 24, 'Orbital Drift');

      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved[0].initials).toBe('ABC');
    });

    test('should pad short initials with dashes', () => {
      HighScoreManager.saveNamedScore('A', 24, 'Orbital Drift');

      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved[0].initials).toBe('A--');
    });

    test('should default to --- when initials are empty', () => {
      HighScoreManager.saveNamedScore('', 24, 'Orbital Drift');

      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved[0].initials).toBe('---');
    });

    test('should default to --- when initials are null', () => {
      HighScoreManager.saveNamedScore(null, 24, 'Orbital Drift');

      const saved = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(saved[0].initials).toBe('---');
    });

    test('should handle localStorage failure gracefully', () => {
      Storage.prototype.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        HighScoreManager.saveNamedScore('ABC', 24, 'Orbital Drift');
      }).not.toThrow();

      console.warn.mockRestore();
    });
  });

  describe('loadScores', () => {
    test('should return empty array when no scores exist', () => {
      const result = HighScoreManager.loadScores('Orbital Drift');

      expect(result).toEqual([]);
    });

    test('should return objects with initials, score, date fields', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        {
          totalStrokes: 24,
          courseName: 'Orbital Drift',
          timestamp: 1000,
          initials: 'ABC',
          date: '2026-04-11'
        }
      ]);

      const result = HighScoreManager.loadScores('Orbital Drift');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        initials: 'ABC',
        score: 24,
        date: '2026-04-11'
      });
    });

    test('should return sorted best-first', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000, initials: 'CCC' },
        { totalStrokes: 20, courseName: 'Orbital Drift', timestamp: 2000, initials: 'AAA' },
        { totalStrokes: 25, courseName: 'Orbital Drift', timestamp: 3000, initials: 'BBB' }
      ]);

      const result = HighScoreManager.loadScores('Orbital Drift');

      expect(result[0].score).toBe(20);
      expect(result[1].score).toBe(25);
      expect(result[2].score).toBe(30);
    });

    test('should limit to 10 entries', () => {
      const scores = [];
      for (let i = 0; i < 15; i++) {
        scores.push({
          totalStrokes: 20 + i,
          courseName: 'Orbital Drift',
          timestamp: 1000 + i,
          initials: 'TST'
        });
      }
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify(scores);

      const result = HighScoreManager.loadScores('Orbital Drift');

      expect(result).toHaveLength(10);
    });

    test('should default initials to --- for old entries without initials', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 24, courseName: 'Orbital Drift', timestamp: 1000 }
      ]);

      const result = HighScoreManager.loadScores('Orbital Drift');

      expect(result[0].initials).toBe('---');
    });

    test('should default date to null for old entries without date', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 24, courseName: 'Orbital Drift', timestamp: 1000 }
      ]);

      const result = HighScoreManager.loadScores('Orbital Drift');

      expect(result[0].date).toBeNull();
    });

    test('should only return scores for specified course', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        { totalStrokes: 24, courseName: 'Orbital Drift', timestamp: 1000 },
        { totalStrokes: 18, courseName: 'Other Course', timestamp: 2000 }
      ]);

      const result = HighScoreManager.loadScores('Orbital Drift');

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(24);
    });
  });

  describe('_migrateIfNeeded', () => {
    test('should migrate raw numbers to object format', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([24, 30, 18]);

      const result = HighScoreManager._loadScores();

      expect(result).toHaveLength(3);
      result.forEach(entry => {
        expect(entry).toHaveProperty('totalStrokes');
        expect(entry).toHaveProperty('courseName', 'default');
        expect(entry).toHaveProperty('initials', '---');
        expect(entry).toHaveProperty('date', null);
      });
      expect(result[0].totalStrokes).toBe(24);
      expect(result[1].totalStrokes).toBe(30);
      expect(result[2].totalStrokes).toBe(18);
    });

    test('should persist migrated data to localStorage', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([24]);

      HighScoreManager._loadScores();

      const stored = JSON.parse(mockStorage['miniGolfBreak_highScores']);
      expect(stored[0].initials).toBe('---');
      expect(stored[0].totalStrokes).toBe(24);
    });

    test('should not modify already-migrated entries', () => {
      const existing = [
        { totalStrokes: 24, courseName: 'Orbital Drift', timestamp: 1000, initials: 'ABC' }
      ];
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify(existing);

      const result = HighScoreManager._loadScores();

      expect(result[0].initials).toBe('ABC');
    });

    test('should handle mixed old and new format entries', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
        24,
        { totalStrokes: 30, courseName: 'Orbital Drift', timestamp: 1000, initials: 'XYZ' }
      ]);

      const result = HighScoreManager._loadScores();

      expect(result[0].totalStrokes).toBe(24);
      expect(result[0].initials).toBe('---');
      expect(result[1].totalStrokes).toBe(30);
      expect(result[1].initials).toBe('XYZ');
    });

    test('should handle migration localStorage write failure gracefully', () => {
      mockStorage['miniGolfBreak_highScores'] = JSON.stringify([24]);
      let callCount = 0;
      Storage.prototype.setItem.mockImplementation(() => {
        callCount++;
        throw new Error('quota exceeded');
      });
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = HighScoreManager._loadScores();

      expect(result[0].totalStrokes).toBe(24);
      expect(result[0].initials).toBe('---');
      console.warn.mockRestore();
    });
  });
});
