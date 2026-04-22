import { debug } from '../utils/debug';

const STORAGE_KEY = 'miniGolfBreak_highScores';
const MAX_LEADERBOARD_SIZE = 10;
const GAME_RECORD_KEY = 'orbital-drift-scores';
const MAX_GAME_RECORDS = 3;

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
        timestamp: Date.now()
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
   * Save a named score entry for the leaderboard.
   * @param {string} initials - Player initials (max 3 chars)
   * @param {number} score - Total strokes
   * @param {string} courseName - Name of the course
   * @returns {boolean} Whether this score made the top 10
   */
  static saveNamedScore(name, score, courseName) {
    const sanitizedName =
      String(name || '')
        .trim()
        .slice(0, 12) || 'Anonymous';
    const sanitizedInitials = String(name || '---')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 3)
      .padEnd(3, '-');

    const qualifies = HighScoreManager.isTopTen(score, courseName);

    try {
      const scores = HighScoreManager._loadScores();
      scores.push({
        totalStrokes: score,
        courseName,
        timestamp: Date.now(),
        name: sanitizedName,
        initials: sanitizedInitials,
        date: new Date().toISOString().split('T')[0]
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
      debug.log(
        `[HighScoreManager] Saved named score: ${sanitizedName} ${score} for ${courseName}`
      );
    } catch {
      console.warn('[HighScoreManager] Failed to save named score to localStorage.');
    }

    return qualifies;
  }

  /**
   * Check if a score is in the top 3 of the leaderboard (call after saveScore).
   * @param {number} score - Total strokes to check
   * @param {string} courseName - Name of the course
   * @returns {boolean} True if score ranks in the top 3
   */
  static isTopThree(score, courseName) {
    const entries = HighScoreManager.loadScores(courseName);
    if (entries.length < 3) {
      return true;
    }
    return score <= entries[2].score;
  }

  /**
   * Check if a score qualifies for the top-10 leaderboard.
   * @param {number} score - Total strokes to check
   * @param {string} courseName - Name of the course
   * @returns {boolean} True if score would make top 10
   */
  static isTopTen(score, courseName) {
    const entries = HighScoreManager.loadScores(courseName);
    if (entries.length < MAX_LEADERBOARD_SIZE) {
      return true;
    }
    const worst = entries[entries.length - 1];
    return score < worst.score;
  }

  /**
   * Load leaderboard entries for a course, sorted best-first.
   * @param {string} courseName - Name of the course
   * @returns {Array<{initials: string, score: number, date: string|null}>}
   */
  static loadScores(courseName) {
    const raw = HighScoreManager._loadScores();
    return raw
      .filter(s => s.courseName === courseName)
      .map(s => ({
        name: s.name || s.initials || '---',
        initials: s.initials || '---',
        score: s.totalStrokes,
        date: s.date || null
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_LEADERBOARD_SIZE);
  }

  /**
   * Get the best (lowest) score for a course.
   * @param {string} courseName - Name of the course
   * @returns {number|null} Best score or null if no scores exist
   */
  static getBestScore(courseName) {
    const scores = HighScoreManager._loadScores();
    const courseScores = scores.filter(s => s.courseName === courseName);

    if (courseScores.length === 0) {
      return null;
    }

    return Math.min(...courseScores.map(s => s.totalStrokes));
  }

  /**
   * Get all scores for a course, sorted best-first (ascending by strokes).
   * @param {string} courseName - Name of the course
   * @returns {Array} Sorted array of score objects
   */
  static getScores(courseName) {
    const scores = HighScoreManager._loadScores();
    return scores
      .filter(s => s.courseName === courseName)
      .sort((a, b) => a.totalStrokes - b.totalStrokes);
  }

  /**
   * Clear all scores for a course (or all scores if no course specified).
   * @param {string} [courseName] - Optional course name to filter
   */
  static clearScores(courseName) {
    try {
      if (courseName) {
        const scores = HighScoreManager._loadScores().filter(s => s.courseName !== courseName);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      debug.log(`[HighScoreManager] Cleared scores${courseName ? ` for ${courseName}` : ''}`);
    } catch {
      console.warn('[HighScoreManager] Failed to clear scores from localStorage.');
    }
  }

  /**
   * Save a completed game record to the orbital-drift-scores store (top 3 retained).
   * @param {number} totalStrokes - Total strokes for the game
   * @param {number[]} holeSplits - Strokes per hole
   * @param {string} [courseName] - Optional course label
   * @returns {Array} The updated records array (up to 3 entries)
   */
  static saveGameRecord(totalStrokes, holeSplits, courseName = 'Orbital Drift') {
    try {
      let records = HighScoreManager.loadGameRecords();
      records.push({
        date: new Date().toISOString().split('T')[0],
        totalStrokes,
        holeSplits: holeSplits ?? [],
        courseName
      });
      records.sort((a, b) => a.totalStrokes - b.totalStrokes);
      records = records.slice(0, MAX_GAME_RECORDS);
      localStorage.setItem(GAME_RECORD_KEY, JSON.stringify(records));
      debug.log(`[HighScoreManager] Saved game record: ${totalStrokes} strokes`);
      return records;
    } catch {
      console.warn('[HighScoreManager] Failed to save game record to localStorage.');
      return [];
    }
  }

  /**
   * Load top-3 game records from the orbital-drift-scores store.
   * @returns {Array<{date: string, totalStrokes: number, holeSplits: number[], courseName: string}>}
   */
  static loadGameRecords() {
    try {
      const raw = localStorage.getItem(GAME_RECORD_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[HighScoreManager] Corrupt game records — clearing:', e.message);
      try {
        localStorage.removeItem(GAME_RECORD_KEY);
      } catch {
        /* storage unavailable */
      }
      return [];
    }
  }

  static _loadScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[HighScoreManager] Corrupt score data — clearing:', e.message);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* storage unavailable */
      }
      return [];
    }
  }
}
