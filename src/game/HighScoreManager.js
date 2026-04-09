import { debug } from '../utils/debug';

const STORAGE_KEY = 'miniGolfBreak_highScores';

/**
 * HighScoreManager - Persists and retrieves high scores from localStorage.
 */
export class HighScoreManager {
  /**
   * Save a completed game score.
   * @param {number} totalStrokes - Total strokes for the game
   * @param {string} courseName - Name of the course played
   * @returns {boolean} Whether this score is a new personal best
   */
  static saveScore(totalStrokes, courseName) {
    const previousBest = HighScoreManager.getBestScore(courseName);
    const isNewBest = previousBest === null || totalStrokes < previousBest;

    try {
      const scores = HighScoreManager._loadScores();
      scores.push({
        totalStrokes,
        courseName,
        timestamp: Date.now(),
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
      debug.log(
        `[HighScoreManager] Saved score: ${totalStrokes} for ${courseName}. New best: ${isNewBest}`
      );
    } catch {
      console.warn('[HighScoreManager] Failed to save score to localStorage.');
    }

    return isNewBest;
  }

  /**
   * Get the best (lowest) score for a course.
   * @param {string} courseName - Name of the course
   * @returns {number|null} Best score or null if no scores exist
   */
  static getBestScore(courseName) {
    const scores = HighScoreManager._loadScores();
    const courseScores = scores.filter((s) => s.courseName === courseName);

    if (courseScores.length === 0) {
      return null;
    }

    return Math.min(...courseScores.map((s) => s.totalStrokes));
  }

  /**
   * Load all scores from localStorage.
   * @returns {Array} Array of score objects
   * @private
   */
  static _loadScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
