import * as THREE from 'three';

/**
 * Converts a plain [x, y, z] array to a THREE.Vector3.
 * Returns the value unchanged if it is already a Vector3 or not an array.
 */
function toVector3(arr) {
  if (Array.isArray(arr) && arr.length >= 3) {
    return new THREE.Vector3(arr[0], arr[1], arr[2]);
  }
  return arr;
}

/**
 * Converts a plain [x, y] array to a THREE.Vector2.
 * Returns the value unchanged if it is already a Vector2 or not an array.
 */
function toVector2(arr) {
  if (Array.isArray(arr) && arr.length >= 2) {
    return new THREE.Vector2(arr[0], arr[1]);
  }
  return arr;
}

/**
 * Converts a plain [x, y, z] array to a THREE.Euler.
 * Returns the value unchanged if it is already an Euler or not an array.
 */
function toEuler(arr) {
  if (Array.isArray(arr) && arr.length >= 3) {
    return new THREE.Euler(arr[0], arr[1], arr[2]);
  }
  return arr;
}

/**
 * Hydrate an array of items that each have start/end Vector3 fields.
 */
function hydrateStartEndArray(items) {
  if (!Array.isArray(items)) {
    return items;
  }
  return items.map(item => ({
    ...item,
    start: toVector3(item.start),
    end: toVector3(item.end)
  }));
}

/**
 * Mechanic hydration handlers keyed by type.
 * Each handler receives a shallow copy of the mechanic config and mutates it in place.
 */
const MECHANIC_HYDRATORS = {
  moving_sweeper(m) {
    if (m.pivot) {
      m.pivot = toVector3(m.pivot);
    }
  },
  portal_gate(m) {
    if (m.entryPosition) {
      m.entryPosition = toVector3(m.entryPosition);
    }
    if (m.exitPosition) {
      m.exitPosition = toVector3(m.exitPosition);
    }
  },
  split_route(m) {
    m.walls = hydrateStartEndArray(m.walls);
  },
  bank_wall(m) {
    m.segments = hydrateStartEndArray(m.segments);
  },
  ricochet_bumpers(m) {
    if (Array.isArray(m.bumpers)) {
      m.bumpers = m.bumpers.map(b => ({
        ...b,
        position: toVector3(b.position),
        ...(b.size ? { size: toVector3(b.size) } : {})
      }));
    }
  },
  elevated_green(m) {
    if (m.platform) {
      m.platform = { ...m.platform, position: toVector3(m.platform.position) };
    }
    if (m.ramp) {
      m.ramp = { ...m.ramp, start: toVector3(m.ramp.start), end: toVector3(m.ramp.end) };
    }
  },
  boost_strip(m) {
    if (m.position) {
      m.position = toVector3(m.position);
    }
    if (m.direction) {
      m.direction = toVector3(m.direction);
    }
  },
  multi_level_ramp(m) {
    if (m.startPosition) {
      m.startPosition = toVector3(m.startPosition);
    }
    if (m.endPosition) {
      m.endPosition = toVector3(m.endPosition);
    }
  }
};

/**
 * Hydrate a single mechanic config's position fields from arrays to Vector3.
 */
function hydrateMechanic(mechanic) {
  const m = { ...mechanic };
  const handler = MECHANIC_HYDRATORS[m.type];
  if (handler) {
    handler(m);
  } else if (m.position) {
    m.position = toVector3(m.position);
  }
  return m;
}

// Types that only have a position field — handled by the else branch in hydrateMechanic.
// Listed here for documentation: bowl_contour, suction_zone, low_gravity_zone,
// timed_hazard, timed_gate.

/**
 * Converts a hole config with plain-array coordinates into one with
 * Three.js Vector3, Vector2, and Euler objects.
 *
 * Accepts configs that already use Three.js objects (idempotent).
 *
 * @param {object} config - Raw hole config with array coordinates
 * @returns {object} Hydrated config with Three.js objects
 */
export function hydrateHoleConfig(config) {
  const hydrated = { ...config };

  // Top-level positions
  hydrated.startPosition = toVector3(config.startPosition);
  hydrated.holePosition = toVector3(config.holePosition);

  // Boundary shape: [x, y] arrays → Vector2
  if (Array.isArray(config.boundaryShape)) {
    hydrated.boundaryShape = config.boundaryShape.map(toVector2);
  }

  // Bumpers
  if (Array.isArray(config.bumpers)) {
    hydrated.bumpers = config.bumpers.map(b => ({
      ...b,
      position: toVector3(b.position),
      size: toVector3(b.size),
      ...(b.rotation ? { rotation: toEuler(b.rotation) } : {})
    }));
  }

  // Hazards
  if (Array.isArray(config.hazards)) {
    hydrated.hazards = config.hazards.map(h => ({
      ...h,
      position: toVector3(h.position)
    }));
  }

  // Mechanics
  if (Array.isArray(config.mechanics)) {
    hydrated.mechanics = config.mechanics.map(hydrateMechanic);
  }

  // Hero props
  if (Array.isArray(config.heroProps)) {
    hydrated.heroProps = config.heroProps.map(p => ({
      ...p,
      position: toVector3(p.position),
      ...(p.rotation ? { rotation: toEuler(p.rotation) } : {})
    }));
  }

  return hydrated;
}
