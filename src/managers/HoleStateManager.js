import { EventTypes } from '../events/EventTypes';

/**
 * HoleStateManager - Handles state tracking for individual holes
 */
export class HoleStateManager {
  constructor(game) {
    this.game = game;
    this.holeStates = new Map(); // Track state for each hole
  }

  /**
   * Initialize the hole state manager
   */
  init() {
    this.setupEventListeners();
    this.initializeHoleStates();
    return this;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for hole started events
    this.game.eventManager.subscribe(EventTypes.HOLE_STARTED, this.handleHoleStarted, this);

    // Listen for hole completed events
    this.game.eventManager.subscribe(EventTypes.HOLE_COMPLETED, this.handleHoleCompleted, this);
  }

  /**
   * Initialize states for all holes
   */
  initializeHoleStates() {
    const totalHoles = this.game.course.getTotalHoles();
    for (let i = 0; i < totalHoles; i++) {
      this.holeStates.set(i, {
        completed: false,
        strokes: 0,
        par: this.game.course.getHolePar(i + 1),
        hazards: [],
        startTime: null,
        endTime: null
      });
    }
  }

  /**
   * Get all hole states
   * @returns {Map} Map of all hole states
   */
  getAllHoleStates() {
    return this.holeStates;
  }

  /**
   * Get the state for a specific hole
   * @param {number} holeIndex - Index of the hole
   * @returns {Object} Hole state object
   */
  getHoleState(holeIndex) {
    return this.holeStates.get(holeIndex);
  }

  /**
   * Update the state for a specific hole
   * @param {number} holeIndex - Index of the hole
   * @param {Object} updates - State updates to apply
   */
  updateHoleState(holeIndex, updates) {
    const currentState = this.getHoleState(holeIndex);
    if (!currentState) {
      return;
    }

    const newState = { ...currentState, ...updates };
    this.holeStates.set(holeIndex, newState);

    // Publish state update event
    this.game.eventManager.publish(
      EventTypes.HOLE_STATE_UPDATED,
      {
        holeIndex,
        state: newState
      },
      this
    );
  }

  /**
   * Check if a hole is completed
   * @param {number} holeIndex - Index of the hole
   * @returns {boolean} Whether the hole is completed
   */
  isHoleCompleted(holeIndex) {
    const state = this.getHoleState(holeIndex);
    return state ? state.completed : false;
  }

  /**
   * Get the par value for a hole
   * @param {number} holeIndex - Index of the hole
   * @returns {number} Par value for the hole
   */
  getHolePar(holeIndex) {
    const state = this.getHoleState(holeIndex);
    return state ? state.par : 3; // Default to 3 if not found
  }

  /**
   * Get hazards for a hole
   * @param {number} holeIndex - Index of the hole
   * @returns {Array} Array of hazards
   */
  getHoleHazards(holeIndex) {
    const state = this.getHoleState(holeIndex);
    return state ? state.hazards : [];
  }

  /**
   * Handle hole started event
   * @param {GameEvent} event - Hole started event
   */
  handleHoleStarted(_event) {
    const holeIndex = this.game.stateManager.getCurrentHoleNumber() - 1;
    this.updateHoleState(holeIndex, {
      startTime: Date.now(),
      strokes: 0,
      completed: false
    });
  }

  /**
   * Handle hole completed event
   * @param {GameEvent} event - Hole completed event
   */
  handleHoleCompleted(_event) {
    const holeIndex = this.game.stateManager.getCurrentHoleNumber() - 1;
    const totalStrokes = this.game.scoringSystem.getTotalStrokes();

    this.updateHoleState(holeIndex, {
      completed: true,
      strokes: totalStrokes,
      endTime: Date.now()
    });
  }

  /**
   * Reset all hole states
   */
  reset() {
    this.initializeHoleStates();
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.holeStates.clear();
  }
}
