import { debug } from './debug';

/** Wall thickness must match HoleEntity.wallThickness. */
const WALL_THICKNESS = 0.2;

/** Minimum overlap (units) required at each wall corner to prevent physics gaps. */
const MIN_CORNER_OVERLAP = 0.05;

/**
 * Required fields per mechanic type (from docs/course-infrastructure.md Section 4).
 * Fields ending with '?' are optional and excluded from validation.
 */
export const MECHANIC_REQUIRED_FIELDS = {
  moving_sweeper: ['pivot', 'armLength', 'speed', 'size'],
  timed_hazard: ['position', 'size', 'onDuration', 'offDuration', 'hazardType'],
  timed_gate: ['position', 'size', 'openDuration', 'closedDuration'],
  boost_strip: ['position', 'boost_direction', 'boost_magnitude', 'size'],
  suction_zone: ['position', 'radius', 'force'],
  low_gravity_zone: ['position', 'radius'],
  bowl_contour: ['position', 'radius', 'force'],
  portal_gate: ['entryPosition', 'exitPosition', 'radius'],
  bank_wall: ['segments'],
  split_route: ['walls', 'height'],
  elevated_green: ['platform', 'elevation', 'ramp'],
  ricochet_bumpers: ['bumpers'],
  laser_grid: ['beams', 'onDuration', 'offDuration'],
  disappearing_platform: ['platforms'],
  gravity_funnel: ['position', 'radius', 'exitPoint', 'force'],
  multi_level_ramp: ['startPosition', 'endPosition', 'width']
};

/**
 * Validates a hole configuration for common errors.
 * Returns an array of { level: 'error'|'warning', message } objects.
 * In production mode, skips validation and returns an empty array.
 *
 * @param {object} config - Hole configuration object
 * @param {object} [options] - Validation options
 * @param {string[]} [options.registeredTypes] - Known mechanic types from MechanicRegistry
 */
export function validateHoleConfig(config, options = {}) {
  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  const issues = [];
  const holeLabel = typeof config.index === 'number' ? `Hole ${config.index}` : 'Hole ?';

  _checkRequiredFields(config, issues);
  _checkPositionsInsideBoundary(config, issues);
  _checkHazards(config, issues);
  _checkBumpers(config, issues);
  _checkMechanics(config, holeLabel, options, issues);
  _checkCupFlush(config, holeLabel, issues);
  _checkSpawnClearance(config, holeLabel, issues);
  _checkBoundaryClosure(config, holeLabel, issues);
  _checkObstacleRelevance(config, holeLabel, issues);
  _checkCupReachability(config, holeLabel, issues);
  _checkMechanicRequiredFields(config, holeLabel, issues);
  _checkOutOfBounds(config, holeLabel, issues);
  _checkObstaclePhysicsSubsteps(config, holeLabel, issues);
  _checkWallCornerOverlap(config, holeLabel, issues);

  return issues;
}

function _checkRequiredFields(config, issues) {
  if (typeof config.index !== 'number') {
    issues.push({ level: 'error', message: 'Missing or invalid index' });
  }
  if (typeof config.par !== 'number' || config.par < 1) {
    issues.push({ level: 'error', message: `Invalid par: ${config.par}` });
  }
  if (typeof config.description !== 'string' || !config.description) {
    issues.push({ level: 'error', message: 'Missing or invalid description' });
  }
  if (!Array.isArray(config.boundaryShape) || config.boundaryShape.length < 3) {
    issues.push({ level: 'error', message: 'boundaryShape must have at least 3 points' });
  }
  if (!isVector3Like(config.startPosition)) {
    issues.push({ level: 'error', message: 'Missing startPosition' });
  }
  if (!isVector3Like(config.holePosition)) {
    issues.push({ level: 'error', message: 'Missing holePosition' });
  }
}

function _checkPositionsInsideBoundary(config, issues) {
  if (!config.boundaryShape?.length || config.boundaryShape.length < 3) {
    return;
  }
  if (isVector3Like(config.startPosition)) {
    if (!isPointInsideBoundary(config.startPosition, config.boundaryShape)) {
      const sp = config.startPosition;
      issues.push({
        level: 'warning',
        message: `startPosition (${getX(sp)}, ${getZ(sp)}) is outside boundary`
      });
    }
  }
  if (isVector3Like(config.holePosition)) {
    if (!isPointInsideBoundary(config.holePosition, config.boundaryShape)) {
      const hp = config.holePosition;
      issues.push({
        level: 'warning',
        message: `holePosition (${getX(hp)}, ${getZ(hp)}) is outside boundary`
      });
    }
  }
}

function _checkHazards(config, issues) {
  (config.hazards || []).forEach((h, i) => {
    if (!h.type) {
      issues.push({ level: 'error', message: `Hazard ${i}: missing type` });
    }
    if (!h.position) {
      issues.push({ level: 'error', message: `Hazard ${i}: missing position` });
    }
    if (!h.shape) {
      issues.push({ level: 'warning', message: `Hazard ${i}: missing shape` });
    }
  });
}

function _checkBumpers(config, issues) {
  (config.bumpers || []).forEach((b, i) => {
    if (!b.position) {
      issues.push({ level: 'error', message: `Bumper ${i}: missing position` });
    }
    if (!b.size) {
      issues.push({ level: 'error', message: `Bumper ${i}: missing size` });
    }
  });
}

function _checkMechanics(config, holeLabel, options, issues) {
  const registeredTypes = options.registeredTypes || null;

  (config.mechanics || []).forEach((m, i) => {
    if (!m.type) {
      issues.push({ level: 'error', message: `${holeLabel} Mechanic ${i}: missing type` });
      return;
    }
    if (registeredTypes && !registeredTypes.includes(m.type)) {
      issues.push({
        level: 'error',
        message: `${holeLabel} Mechanic ${i}: unknown type '${m.type}'`
      });
    }
    const requiredFields = MECHANIC_REQUIRED_FIELDS[m.type];
    if (requiredFields) {
      requiredFields.forEach(field => {
        if (m[field] === undefined || m[field] === null) {
          issues.push({
            level: 'error',
            message: `${holeLabel} Mechanic ${i} (${m.type}): missing ${field}`
          });
        }
      });
    }
  });
}

/**
 * Validates an entire course (array of hole configs).
 * @param {object[]} holeConfigs - Array of hole configurations
 * @param {string} [courseName] - Course name for log messages
 * @param {object} [options] - Validation options passed to validateHoleConfig
 * @param {string[]} [options.registeredTypes] - Known mechanic types from MechanicRegistry
 */
export function validateCourse(holeConfigs, courseName = 'Course', options = {}) {
  const allIssues = [];
  const indices = new Set();

  holeConfigs.forEach((config, i) => {
    const holeIssues = validateHoleConfig(config, options);
    holeIssues.forEach(issue => {
      allIssues.push({ ...issue, hole: i + 1, message: `Hole ${i + 1}: ${issue.message}` });
    });

    if (indices.has(config.index)) {
      allIssues.push({
        level: 'error',
        hole: i + 1,
        message: `Hole ${i + 1}: duplicate index ${config.index}`
      });
    }
    indices.add(config.index);
  });

  const errors = allIssues.filter(i => i.level === 'error');
  const warnings = allIssues.filter(i => i.level === 'warning');

  if (errors.length > 0) {
    console.error(
      `[Validator] ${courseName}: ${errors.length} errors, ${warnings.length} warnings`
    );
    errors.forEach(e => console.error(`  ERROR: ${e.message}`));
  }
  if (warnings.length > 0) {
    warnings.forEach(w => console.warn(`  WARN: ${w.message}`));
  }
  if (errors.length === 0 && warnings.length === 0) {
    debug.log(`[Validator] ${courseName}: All ${holeConfigs.length} holes valid`);
  }

  return { valid: errors.length === 0, errors, warnings, all: allIssues };
}

function _checkCupFlush(config, holeLabel, issues) {
  if (!isVector3Like(config.startPosition) || !isVector3Like(config.holePosition)) {
    return;
  }
  const startY = getY3D(config.startPosition);
  const holeY = getY3D(config.holePosition);
  const maxElevation = getMaxElevation(config);
  const minY = Math.min(startY, 0) - 0.1;
  const maxY = startY + maxElevation + 0.5;
  if (holeY < minY) {
    issues.push({
      level: 'error',
      message:
        `${holeLabel}: cup is embedded in floor ` +
        `(holePosition.y=${holeY}, startPosition.y=${startY})`
    });
  }
  if (holeY > maxY) {
    issues.push({
      level: 'error',
      message: `${holeLabel}: cup is floating ` + `(holePosition.y=${holeY}, max=${maxY})`
    });
  }
}

function getMaxElevation(config) {
  let maxElev = 0;
  (config.mechanics || []).forEach(m => {
    if (m.type === 'elevated_green' && typeof m.elevation === 'number') {
      maxElev = Math.max(maxElev, m.elevation);
    }
    if (m.type === 'multi_level_ramp') {
      const startY = getY3D(m.startPosition);
      const endY = getY3D(m.endPosition);
      maxElev = Math.max(maxElev, startY, endY);
    }
  });
  return maxElev;
}

function _checkSpawnClearance(config, holeLabel, issues) {
  if (!isVector3Like(config.startPosition) || !Array.isArray(config.boundaryShape)) {
    return;
  }
  if (config.boundaryShape.length < 3) {
    return;
  }
  const px = getX(config.startPosition);
  const pz = getZ(config.startPosition);
  const minDist = distanceToPolygonEdge(px, pz, config.boundaryShape);

  if (minDist < 0.2) {
    issues.push({
      level: 'warning',
      message:
        `${holeLabel}: startPosition is only ${minDist.toFixed(2)} units from boundary wall ` +
        '(recommend >= 0.4)'
    });
  }
}

function _checkBoundaryClosure(config, holeLabel, issues) {
  if (!Array.isArray(config.boundaryShape) || config.boundaryShape.length < 3) {
    return;
  }
  const first = config.boundaryShape[0];
  const last = config.boundaryShape[config.boundaryShape.length - 1];
  const dx = getX(first) - getX(last);
  const dy = getY(first) - getY(last);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 0.1) {
    issues.push({
      level: 'error',
      message:
        `${holeLabel}: boundaryShape is not closed ` +
        `(gap of ${dist.toFixed(2)} units between first and last vertex)`
    });
  }
}

function _checkObstacleRelevance(config, holeLabel, issues) {
  if (!Array.isArray(config.boundaryShape) || config.boundaryShape.length < 3) {
    return;
  }
  (config.mechanics || []).forEach((m, i) => {
    const pos = getMechanicPosition(m);
    if (!pos) {
      return;
    }
    if (!isPointInsideExpandedBoundary(pos, config.boundaryShape, 2.0)) {
      issues.push({
        level: 'warning',
        message: `${holeLabel} Mechanic ${i} (${m.type}): position is outside boundary + 2 unit margin`
      });
    }
  });
}

function _checkCupReachability(config, holeLabel, issues) {
  if (!isVector3Like(config.startPosition) || !isVector3Like(config.holePosition)) {
    return;
  }
  if (!Array.isArray(config.boundaryShape) || config.boundaryShape.length < 3) {
    return;
  }
  const dx = getX(config.startPosition) - getX(config.holePosition);
  const dz = getZ(config.startPosition) - getZ(config.holePosition);
  const dist = Math.sqrt(dx * dx + dz * dz);
  const maxDiag = longestBoundaryDiagonal(config.boundaryShape);

  if (dist > maxDiag) {
    issues.push({
      level: 'error',
      message:
        `${holeLabel}: cup unreachable ` +
        `(start-to-hole distance ${dist.toFixed(2)} > boundary diagonal ${maxDiag.toFixed(2)})`
    });
  }
}

function _checkMechanicRequiredFields(config, holeLabel, issues) {
  (config.mechanics || []).forEach((m, i) => {
    if (!m.type) {
      return;
    }
    if (!MECHANIC_REQUIRED_FIELDS[m.type]) {
      issues.push({
        level: 'warning',
        message:
          `${holeLabel} Mechanic ${i} (${m.type}): ` +
          'no required fields defined in MECHANIC_REQUIRED_FIELDS'
      });
    }
  });
}

function _checkOutOfBounds(config, holeLabel, issues) {
  if (!config.outOfBounds) {
    issues.push({
      level: 'warning',
      message: `${holeLabel}: missing outOfBounds field — will use default ±50 boundary`
    });
  }
}

const KINEMATIC_OBSTACLE_TYPES = new Set(['moving_sweeper', 'timed_gate']);
const RECOMMENDED_OBSTACLE_SUBSTEPS = 8;

function _checkObstaclePhysicsSubsteps(config, holeLabel, issues) {
  const hasMovingObstacle = (config.mechanics || []).some(m =>
    KINEMATIC_OBSTACLE_TYPES.has(m.type)
  );
  if (
    hasMovingObstacle &&
    (!config.physicsSubsteps || config.physicsSubsteps < RECOMMENDED_OBSTACLE_SUBSTEPS)
  ) {
    issues.push({
      level: 'warning',
      message:
        `${holeLabel}: has moving obstacles (moving_sweeper/timed_gate) but ` +
        `physicsSubsteps=${config.physicsSubsteps ?? 'unset'} ` +
        `(recommended: ${RECOMMENDED_OBSTACLE_SUBSTEPS})`
    });
  }
}

/**
 * Checks that each pair of adjacent wall segments in the boundary polygon overlaps
 * sufficiently at their shared corner.  When two wall Box bodies meet at nearly the
 * same angle (collinear segments), the physics coverage gap at the corner can exceed
 * the ball radius and allow the ball to escape.
 *
 * Overlap formula (2D): overlap = (wallThickness / 2) × |cross(d1, d2)|
 * where d1, d2 are normalised unit vectors along each wall.
 */
function _checkWallCornerOverlap(config, holeLabel, issues) {
  if (!Array.isArray(config.boundaryShape) || config.boundaryShape.length < 4) {
    return;
  }
  const shape = config.boundaryShape;
  const n = shape.length;

  for (let i = 0; i < n - 2; i++) {
    _checkOneCorner(shape[i], shape[i + 1], shape[i + 2], i + 1, holeLabel, issues);
  }

  // Closed polygon: also check the corner where the last wall meets the first wall.
  const dxClose = getX(shape[0]) - getX(shape[n - 1]);
  const dyClose = getY(shape[0]) - getY(shape[n - 1]);
  if (Math.sqrt(dxClose * dxClose + dyClose * dyClose) < 0.1) {
    _checkOneCorner(shape[n - 2], shape[n - 1], shape[1], 0, holeLabel, issues);
  }
}

function _checkOneCorner(prev, corner, next, idx, holeLabel, issues) {
  const d1x = getX(corner) - getX(prev);
  const d1y = getY(corner) - getY(prev);
  const d1len = Math.sqrt(d1x * d1x + d1y * d1y);
  if (d1len < 0.01) {
    return;
  }

  const d2x = getX(next) - getX(corner);
  const d2y = getY(next) - getY(corner);
  const d2len = Math.sqrt(d2x * d2x + d2y * d2y);
  if (d2len < 0.01) {
    return;
  }

  const e1x = d1x / d1len;
  const e1y = d1y / d1len;
  const e2x = d2x / d2len;
  const e2y = d2y / d2len;
  const sinAngle = Math.abs(e1x * e2y - e1y * e2x);
  const overlap = (WALL_THICKNESS / 2) * sinAngle;

  if (overlap < MIN_CORNER_OVERLAP) {
    issues.push({
      level: 'error',
      message:
        `${holeLabel}: wall corner at boundary index ${idx} has insufficient overlap ` +
        `(${overlap.toFixed(3)} < ${MIN_CORNER_OVERLAP}); adjacent segments nearly collinear`
    });
  }
}

function getMechanicPosition(mechanic) {
  if (mechanic.position) {
    return mechanic.position;
  }
  if (mechanic.pivot) {
    return mechanic.pivot;
  }
  if (mechanic.entryPosition) {
    return mechanic.entryPosition;
  }
  return null;
}

function getY3D(v) {
  return Array.isArray(v) ? v[1] : v.y;
}

function distanceToPolygonEdge(px, pz, boundary) {
  let minDist = Infinity;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const ax = getX(boundary[i]),
      ay = getY(boundary[i]);
    const bx = getX(boundary[j]),
      by = getY(boundary[j]);
    const dist = pointToSegmentDistance(px, pz, ax, ay, bx, by);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

function isPointInsideExpandedBoundary(point, boundary, margin) {
  const px = getX(point);
  const pz = Array.isArray(point) ? (point.length >= 3 ? point[2] : point[1]) : point.z;
  if (isPointInsideBoundary(point, boundary)) {
    return true;
  }
  const dist = distanceToPolygonEdge(px, pz, boundary);
  return dist <= margin;
}

function longestBoundaryDiagonal(boundary) {
  let maxDist = 0;
  for (let i = 0; i < boundary.length; i++) {
    for (let j = i + 1; j < boundary.length; j++) {
      const dx = getX(boundary[i]) - getX(boundary[j]);
      const dy = getY(boundary[i]) - getY(boundary[j]);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDist) {
        maxDist = dist;
      }
    }
  }
  return maxDist;
}

/**
 * Checks if a value is a valid 3D position: either an object with x, y, z numeric properties
 * (Vector3-like) or a plain array of 3 numbers ([x, y, z]).
 */
function isVector3Like(obj) {
  if (obj === null || obj === undefined) {
    return false;
  }
  if (Array.isArray(obj)) {
    return (
      obj.length >= 3 &&
      typeof obj[0] === 'number' &&
      typeof obj[1] === 'number' &&
      typeof obj[2] === 'number'
    );
  }
  return typeof obj.x === 'number' && typeof obj.y === 'number' && typeof obj.z === 'number';
}

/**
 * Extract x from a position value (array or object).
 */
function getX(v) {
  return Array.isArray(v) ? v[0] : v.x;
}

/**
 * Extract y from a 2D value (array or object).
 */
function getY(v) {
  return Array.isArray(v) ? v[1] : v.y;
}

/**
 * Extract z from a 3D value (array [x,y,z] or object {x,y,z}).
 * Falls back to y for 2D values.
 */
function getZ(v) {
  if (Array.isArray(v)) {
    return v.length >= 3 ? v[2] : v[1];
  }
  return v.z !== undefined ? v.z : v.y;
}

/**
 * Point-in-polygon check using ray casting algorithm.
 * Works with Vector2/[x,y] boundary and Vector3/[x,y,z] point.
 */
function isPointInsideBoundary(point, boundary) {
  const px = getX(point);
  const pz = getZ(point);
  let inside = false;

  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = getX(boundary[i]),
      zi = getY(boundary[i]);
    const xj = getX(boundary[j]),
      zj = getY(boundary[j]);

    const intersect = zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}
