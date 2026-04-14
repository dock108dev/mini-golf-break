import { debug } from '../utils/debug';
import { EventTypes } from '../events/EventTypes';

const DEFAULT_MAX_STROKES_MULTIPLIER = 2;
const DEFAULT_MAX_STROKES_OFFSET = 1;
const MIN_MAX_STROKES = 3;
const MAX_MAX_STROKES = 10;

/**
 * ScoringSystem - Manages score for the mini-golf game
 */
export class ScoringSystem {
  constructor(game) {
    this.game = game;
    this.continuousStrokeCount = 0;
    this.currentHoleStrokes = 0;
    this.holeScores = [];
    this.maxStrokes = null;
  }

  /**
   * Derive maxStrokes from a hole config, applying defaults and clamping.
   */
  static deriveMaxStrokes(par, configMaxStrokes) {
    if (configMaxStrokes !== undefined && configMaxStrokes !== null) {
      return Math.max(MIN_MAX_STROKES, Math.min(MAX_MAX_STROKES, configMaxStrokes));
    }
    const derived = par * DEFAULT_MAX_STROKES_MULTIPLIER + DEFAULT_MAX_STROKES_OFFSET;
    return Math.max(MIN_MAX_STROKES, Math.min(MAX_MAX_STROKES, derived));
  }

  /**
   * Set the max strokes for the current hole.
   */
  setMaxStrokes(par, configMaxStrokes) {
    this.maxStrokes = ScoringSystem.deriveMaxStrokes(par, configMaxStrokes);
    debug.log(`[ScoringSystem] Max strokes set to ${this.maxStrokes} (par: ${par})`);
    return this;
  }

  /**
   * Check if the player has reached the stroke limit for the current hole.
   */
  isAtLimit() {
    return this.maxStrokes !== null && this.currentHoleStrokes >= this.maxStrokes;
  }

  /**
   * Get the max strokes for the current hole.
   */
  getMaxStrokes() {
    return this.maxStrokes;
  }

  /**
   * Add a stroke to the continuous counter and current hole counter
   */
  addStroke() {
    this.continuousStrokeCount++;
    this.currentHoleStrokes++;
    debug.log(
      `[ScoringSystem] Stroke Added. Current Hole: ${this.currentHoleStrokes}, Total: ${this.continuousStrokeCount}`
    );

    if (this.maxStrokes !== null && this.game.eventManager) {
      if (this.currentHoleStrokes === this.maxStrokes - 1) {
        this.game.eventManager.publish(
          EventTypes.STROKE_LIMIT_WARNING,
          { currentStrokes: this.currentHoleStrokes, maxStrokes: this.maxStrokes },
          this
        );
      } else if (this.currentHoleStrokes === this.maxStrokes) {
        this.game.eventManager.publish(
          EventTypes.STROKE_LIMIT_REACHED,
          { currentStrokes: this.currentHoleStrokes, maxStrokes: this.maxStrokes },
          this
        );
      }
    }

    return this;
  }

  /**
   * Get total strokes across all holes
   */
  getTotalStrokes() {
    return this.continuousStrokeCount;
  }

  /**
   * Get current strokes for the current hole
   */
  getCurrentStrokes() {
    return this.currentHoleStrokes;
  }

  /**
   * Resets the stroke count for the current hole.
   */
  resetCurrentStrokes() {
    debug.log(
      `[ScoringSystem] Resetting current hole strokes from ${this.currentHoleStrokes} to 0.`
    );
    this.currentHoleStrokes = 0;
    return this;
  }

  /**
   * Complete the current hole (placeholder - might be used later for per-hole score saving)
   */
  completeHole() {
    this.holeScores.push(this.currentHoleStrokes);
    return this;
  }

  getHoleScores() {
    return this.holeScores;
  }

  getScoreForHole(index) {
    return this.holeScores[index] !== undefined ? this.holeScores[index] : null;
  }
}
