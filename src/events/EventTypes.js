/**
 * EventTypes - Enumeration of all game events
 * Used to maintain consistency in event naming across the codebase
 */
export const EventTypes = {
  // Ball events
  BALL_CREATED: 'ball:created',
  BALL_HIT: 'ball:hit',
  BALL_MOVED: 'ball:moved',
  BALL_STOPPED: 'ball:stopped',
  BALL_RESET: 'ball:reset',
  BALL_IN_HOLE: 'ball:in_hole',

  // Game state events
  HOLE_COMPLETED: 'hole:completed',
  HOLE_STARTED: 'hole:started',
  GAME_COMPLETED: 'game:completed',
  GAME_STARTED: 'game:started',
  GAME_INITIALIZED: 'game:initialized',
  STATE_CHANGED: 'state:changed',

  // Hazard events
  HAZARD_DETECTED: 'hazard:detected',

  // UI events
  UI_REQUEST_RESTART_GAME: 'ui:request_restart_game',

  // System events
  ERROR_OCCURRED: 'system:error'
};
