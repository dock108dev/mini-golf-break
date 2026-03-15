import { debug } from '../utils/debug';
/**
 * ScoringSystem - Manages score for the mini-golf game
 */
export class ScoringSystem {
  constructor(game) {
    this.game = game;
    this.continuousStrokeCount = 0; // Total strokes across all holes
    this.currentHoleStrokes = 0; // Strokes for the current hole
    this.holeScores = [];
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
