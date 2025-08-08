/**
 * Debug utility for conditional logging
 * Allows for clean production builds while maintaining debug capabilities
 */

const DEBUG_MODE = process.env.NODE_ENV !== 'production';

export const debug = {
  log: (..._args) => {
    if (DEBUG_MODE) {
      // eslint-disable-next-line no-console
    }
  },

  warn: (..._args) => {
    if (DEBUG_MODE) {
      // eslint-disable-next-line no-console
    }
  },

  error: (..._args) => {
    // Always log errors, even in production
    // eslint-disable-next-line no-console
  },

  info: (..._args) => {
    if (DEBUG_MODE) {
      // eslint-disable-next-line no-console
    }
  },

  group: label => {
    if (DEBUG_MODE && console.group) {
      // eslint-disable-next-line no-console
      console.group(label);
    }
  },

  groupEnd: () => {
    if (DEBUG_MODE && console.groupEnd) {
      // eslint-disable-next-line no-console
      console.groupEnd();
    }
  },

  time: label => {
    if (DEBUG_MODE && console.time) {
      // eslint-disable-next-line no-console
      console.time(label);
    }
  },

  timeEnd: label => {
    if (DEBUG_MODE && console.timeEnd) {
      // eslint-disable-next-line no-console
      console.timeEnd(label);
    }
  }
};

export default debug;
