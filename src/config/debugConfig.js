/**
 * Configuration for debug functionality
 */
export const DEBUG_CONFIG = {
  enabled: false, // Set to true to enable debugging in production
  enableKey: 'd', // Key to toggle debug mode
  showHelpers: true, // Show axis and grid helpers
  showLightHelpers: true, // Show light helpers
  logVelocity: true, // Log ball velocity
  showPhysicsDebug: false, // Show physics debug visualizations
  logCriticalErrors: true, // Always log critical errors, even when debug is disabled
  errorTracking: {
    maxErrors: 50, // Maximum number of errors to track
    suppressRepeated: true, // Suppress repeated identical errors
    maxRepeats: 3 // Number of times an identical error is logged before suppression
  },
  courseDebug: {
    enabled: true, // Enable course debugging features
    toggleCourseTypeKey: 'c', // Key to reload course
    loadSpecificHoleKey: 'h', // Key to trigger load specific hole prompt
    quickLoadKeys: {
      // Number keys 1-9 to quickly load specific holes
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      9: 9
    }
  }
};

/**
 * Error levels for the logging system
 */
export const ERROR_LEVELS = {
  ERROR: 'ERROR', // Critical errors that prevent proper functionality
  WARNING: 'WARNING', // Non-critical issues that may affect gameplay
  INFO: 'INFO', // General information logs
  DEBUG: 'DEBUG' // Detailed debug information
};
