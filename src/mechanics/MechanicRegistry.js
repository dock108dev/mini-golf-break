/**
 * MechanicRegistry - Maps mechanic type strings to factory functions.
 *
 * Usage:
 *   registerMechanic('moving_sweeper', (world, group, config, sh, theme) => new MovingSweeper(...));
 *   const mechanic = createMechanic('moving_sweeper', world, group, config, surfaceHeight, theme);
 *
 * Mechanic files self-register on import. The index.js barrel import triggers all registrations.
 */

const registry = {};

/**
 * Register a mechanic factory function for a given type.
 * @param {string} type - Mechanic type identifier (e.g., 'moving_sweeper')
 * @param {Function} factory - (world, group, config, surfaceHeight, theme) => MechanicBase
 */
export function registerMechanic(type, factory) {
  if (registry[type]) {
    console.error(`[MechanicRegistry] Overwriting existing mechanic type: "${type}" — this may indicate a duplicate registration bug.`);
  }
  registry[type] = factory;
}

/**
 * Create a mechanic instance from the registry.
 * @param {string} type - Mechanic type identifier
 * @param {object} world - Cannon-es physics world
 * @param {THREE.Group} group - Hole's Three.js group
 * @param {object} config - Mechanic-specific config from hole definition
 * @param {number} surfaceHeight - Y height of the green surface
 * @param {object} [theme] - Optional theme object for visual customization
 * @returns {MechanicBase|null} The created mechanic, or null if type is unknown
 */
export function createMechanic(type, world, group, config, surfaceHeight, theme) {
  const factory = registry[type];
  if (!factory) {
    console.warn(`[MechanicRegistry] Unknown mechanic type: "${type}". Available: [${Object.keys(registry).join(', ')}]`);
    return null;
  }
  return factory(world, group, config, surfaceHeight, theme);
}

/**
 * Get all registered mechanic type names.
 * @returns {string[]}
 */
export function getRegisteredTypes() {
  return Object.keys(registry);
}
