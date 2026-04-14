/**
 * Debug utility for conditional logging
 * Allows for clean production builds while maintaining debug capabilities
 */

const DEBUG_MODE = process.env.NODE_ENV !== 'production';

export const debug = {
  log: (...args) => {
    if (DEBUG_MODE) {
      // eslint-disable-next-line no-console
      console.log('[DEBUG]', ...args);
    }
  },

  warn: (...args) => {
    if (DEBUG_MODE) {
      // eslint-disable-next-line no-console
      console.warn('[WARN]', ...args);
    }
  },

  error: (...args) => {
    // Always log errors, even in production
    // eslint-disable-next-line no-console
    console.error('[ERROR]', ...args);
  },

  info: (...args) => {
    if (DEBUG_MODE) {
      // eslint-disable-next-line no-console
      console.info('[INFO]', ...args);
    }
  },

  group: label => {
    if (!DEBUG_MODE) {
      return;
    }
    /* eslint-disable no-console -- dev-only console.group API */
    if (typeof console.group === 'function') {
      console.group(label);
    }
    /* eslint-enable no-console */
  },

  groupEnd: () => {
    if (!DEBUG_MODE) {
      return;
    }
    /* eslint-disable no-console -- dev-only console.groupEnd API */
    if (typeof console.groupEnd === 'function') {
      console.groupEnd();
    }
    /* eslint-enable no-console */
  },

  time: label => {
    if (!DEBUG_MODE) {
      return;
    }
    /* eslint-disable no-console -- dev-only console.time API */
    if (typeof console.time === 'function') {
      console.time(label);
    }
    /* eslint-enable no-console */
  },

  timeEnd: label => {
    if (!DEBUG_MODE) {
      return;
    }
    /* eslint-disable no-console -- dev-only console.timeEnd API */
    if (typeof console.timeEnd === 'function') {
      console.timeEnd(label);
    }
    /* eslint-enable no-console */
  }
};

export default debug;
