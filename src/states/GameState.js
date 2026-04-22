/**
 * Enum for different game states
 */
export const GameState = {
  /** Initial state when game starts */
  INITIALIZING: 'initializing',

  /** Game is actively being played */
  PLAYING: 'playing',

  /** Player is aiming their shot */
  AIMING: 'aiming',

  /** Current hole is completed */
  HOLE_COMPLETED: 'hole_completed',

  /** Game is completed */
  GAME_COMPLETED: 'game_completed',

  /** Game is paused */
  PAUSED: 'paused',

  /** Hole intro flyover is playing */
  FLYOVER: 'flyover'
};
