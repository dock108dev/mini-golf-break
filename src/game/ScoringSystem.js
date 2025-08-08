/**
 * ScoringSystem - Manages score for the mini-golf game
 */
export class ScoringSystem {
  constructor(game) {
    this.game = game;
    this.continuousStrokeCount = 0; // Total strokes across all holes
    this.currentHoleStrokes = 0; // Strokes for the current hole
    this.holeScores = []; // Track scores for each completed hole
  }

  /**
   * Add a stroke to the continuous counter and current hole counter
   */
  addStroke() {
    this.continuousStrokeCount++;
    this.currentHoleStrokes++;

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
   * Alias for getCurrentStrokes for consistency
   */
  getCurrentHoleStrokes() {
    return this.currentHoleStrokes;
  }

  /**
   * Resets the stroke count for the current hole.
   */
  resetCurrentStrokes() {
    this.currentHoleStrokes = 0;
    return this;
  }

  /**
   * Complete the current hole and save the score
   */
  completeHole(holeNumber, par = 3) {
    const score = {
      hole: holeNumber,
      strokes: this.currentHoleStrokes,
      par,
      score: this.currentHoleStrokes - par
    };

    this.holeScores.push(score);

    return this;
  }

  /**
   * Get scores for all completed holes
   */
  getHoleScores() {
    return this.holeScores;
  }

  /**
   * Reset all scores (for new game)
   */
  resetAllScores() {
    this.continuousStrokeCount = 0;
    this.currentHoleStrokes = 0;
    this.holeScores = [];

    return this;
  }
}
