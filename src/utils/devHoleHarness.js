/**
 * Dev Hole Harness — skip-to-hole, isolation mode, and config hot-reload for development.
 * All behavior is gated behind process.env.NODE_ENV === 'development'.
 */

const DEV_MODE = process.env.NODE_ENV === 'development';

let isolationMode = false;
let initialHoleIndex = null;

/**
 * Parse URL search params for dev harness options.
 * - ?hole=N  → jump to hole N (1-based)
 * - ?isolate=true → stay on current hole after cup sink
 *
 * @param {number} totalHoles - Total number of holes on the course
 * @returns {{ holeNumber: number | null, isolate: boolean }}
 */
export function parseDevParams(totalHoles) {
  if (!DEV_MODE) {
    return { holeNumber: null, isolate: false };
  }

  const params = new URLSearchParams(window.location.search);
  const holeRaw = params.get('hole');
  const isolateRaw = params.get('isolate');

  let holeNumber = null;

  if (holeRaw !== null) {
    const parsed = Number(holeRaw);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= totalHoles) {
      holeNumber = parsed;
    } else {
      console.warn(
        `[DevHoleHarness] Invalid ?hole=${holeRaw} (must be integer 1-${totalHoles}). Falling back to hole 1.`
      );
      holeNumber = 1;
    }
  }

  const isolate = isolateRaw === 'true';

  initialHoleIndex = holeNumber;
  isolationMode = isolate;

  return { holeNumber, isolate };
}

/**
 * Whether isolation mode is active (prevents auto-advance to next hole).
 * @returns {boolean}
 */
export function isIsolationMode() {
  return DEV_MODE && isolationMode;
}

/**
 * Set isolation mode programmatically (e.g. from debug UI).
 * @param {boolean} enabled
 */
export function setIsolationMode(enabled) {
  if (DEV_MODE) {
    isolationMode = enabled;
  }
}

/**
 * Get the initial hole number parsed from URL params (or null if none).
 * @returns {number | null}
 */
export function getInitialHoleNumber() {
  return DEV_MODE ? initialHoleIndex : null;
}

/**
 * Whether the dev harness is available (dev mode only).
 * @returns {boolean}
 */
export function isDevHarnessActive() {
  return DEV_MODE;
}

/**
 * Set up Webpack HMR for hole config hot-reload.
 * When the config module changes, re-destroys and re-constructs the current hole.
 *
 * @param {object} game - The Game instance
 */
export function setupConfigHotReload(game) {
  if (!DEV_MODE || !module.hot) {
    return;
  }

  module.hot.accept('../config/orbitalDriftConfigs', async () => {
    console.warn('[DevHoleHarness] Hole config changed — hot-reloading current hole...');
    try {
      const { createOrbitalDriftConfigs } = await import('../config/orbitalDriftConfigs');
      const { hydrateHoleConfig } = await import('../config/hydrateHoleConfig');

      const newConfigs = createOrbitalDriftConfigs().map(hydrateHoleConfig);

      if (game.course) {
        game.course.holeConfigs = newConfigs;
        game.course.totalHoles = newConfigs.length;

        const currentHoleNumber = game.stateManager.getCurrentHoleNumber();
        await game.stateManager.skipToHole(currentHoleNumber);
      }
    } catch (error) {
      console.error('[DevHoleHarness] Config hot-reload failed:', error);
    }
  });
}
