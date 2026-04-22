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
  BALL_WALL_IMPACT: 'ball:wall_impact',
  BALL_OUT_OF_BOUNDS: 'ball:out_of_bounds',

  // Game state events
  HOLE_COMPLETED: 'hole:completed',
  HOLE_STARTED: 'hole:started',
  HOLE_STATE_UPDATED: 'hole:state_updated',
  GAME_COMPLETED: 'game:completed',
  GAME_STARTED: 'game:started',
  GAME_INITIALIZED: 'game:initialized',
  STATE_CHANGED: 'state:changed',

  // Scoring events
  STROKE_LIMIT_WARNING: 'scoring:stroke_limit_warning',
  STROKE_LIMIT_REACHED: 'scoring:stroke_limit_reached',

  // Hazard events
  HAZARD_DETECTED: 'hazard:detected',

  // Stuck ball events
  BALL_STUCK: 'ball:stuck',

  // Pause events
  GAME_PAUSED: 'game:paused',
  GAME_RESUMED: 'game:resumed',

  // UI events
  UI_REQUEST_RESTART_GAME: 'ui:request_restart_game',

  // Mechanic events
  GATE_STATE_CHANGED: 'mechanic:gate_state_changed',
  LASER_GRID_STATE_CHANGE: 'mechanic:laser_grid_state_change',

  // Hole flyover / flow events
  HOLE_FLYOVER_START: 'hole:flyover_start',
  HOLE_FLYOVER_END: 'hole:flyover_end',
  HOLE_STATE_CHANGED: 'hole:state_changed',

  // System events
  ERROR_OCCURRED: 'system:error'
};
