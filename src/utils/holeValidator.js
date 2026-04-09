import { debug } from './debug';

/**
 * Required fields per mechanic type (from docs/course-infrastructure.md Section 4).
 * Fields ending with '?' are optional and excluded from validation.
 */
const MECHANIC_REQUIRED_FIELDS = {
  moving_sweeper: ['pivot', 'armLength', 'speed', 'size'],
  timed_hazard: ['position', 'size', 'onDuration', 'offDuration', 'hazardType'],
  timed_gate: ['position', 'size', 'openDuration', 'closedDuration'],
  boost_strip: ['position', 'direction', 'force', 'size'],
  suction_zone: ['position', 'radius', 'force'],
  low_gravity_zone: ['position', 'radius', 'gravityMultiplier'],
  bowl_contour: ['position', 'radius', 'force'],
  portal_gate: ['entryPosition', 'exitPosition', 'radius'],
  bank_wall: ['segments'],
  split_route: ['walls', 'height'],
  elevated_green: ['platform', 'elevation', 'ramp'],
  ricochet_bumpers: ['bumpers'],
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

  // Required fields
  if (typeof config.index !== 'number') {issues.push({ level: 'error', message: 'Missing or invalid index' });}
  if (typeof config.par !== 'number' || config.par < 1) {issues.push({ level: 'error', message: `Invalid par: ${config.par}` });}
  if (typeof config.description !== 'string' || !config.description) {issues.push({ level: 'error', message: 'Missing or invalid description' });}

  // Boundary shape
  if (!Array.isArray(config.boundaryShape) || config.boundaryShape.length < 3) {
    issues.push({ level: 'error', message: 'boundaryShape must have at least 3 points' });
  }

  // Positions
  if (!isVector3Like(config.startPosition)) {
    issues.push({ level: 'error', message: 'Missing startPosition' });
  }
  if (!isVector3Like(config.holePosition)) {
    issues.push({ level: 'error', message: 'Missing holePosition' });
  }

  // Check positions are inside boundary
  if (config.boundaryShape?.length >= 3 && isVector3Like(config.startPosition)) {
    if (!isPointInsideBoundary(config.startPosition, config.boundaryShape)) {
      issues.push({ level: 'warning', message: `startPosition (${config.startPosition.x}, ${config.startPosition.z}) is outside boundary` });
    }
  }
  if (config.boundaryShape?.length >= 3 && isVector3Like(config.holePosition)) {
    if (!isPointInsideBoundary(config.holePosition, config.boundaryShape)) {
      issues.push({ level: 'warning', message: `holePosition (${config.holePosition.x}, ${config.holePosition.z}) is outside boundary` });
    }
  }

  // Hazards
  (config.hazards || []).forEach((h, i) => {
    if (!h.type) {issues.push({ level: 'error', message: `Hazard ${i}: missing type` });}
    if (!h.position) {issues.push({ level: 'error', message: `Hazard ${i}: missing position` });}
    if (!h.shape) {issues.push({ level: 'warning', message: `Hazard ${i}: missing shape` });}
  });

  // Bumpers
  (config.bumpers || []).forEach((b, i) => {
    if (!b.position) {issues.push({ level: 'error', message: `Bumper ${i}: missing position` });}
    if (!b.size) {issues.push({ level: 'error', message: `Bumper ${i}: missing size` });}
  });

  // Mechanics
  const registeredTypes = options.registeredTypes || null;

  (config.mechanics || []).forEach((m, i) => {
    if (!m.type) {
      issues.push({ level: 'error', message: `${holeLabel} Mechanic ${i}: missing type` });
      return;
    }

    // Check type exists in registry (if registry types provided)
    if (registeredTypes && !registeredTypes.includes(m.type)) {
      issues.push({ level: 'error', message: `${holeLabel} Mechanic ${i}: unknown type '${m.type}'` });
    }

    // Validate required fields per mechanic type
    const requiredFields = MECHANIC_REQUIRED_FIELDS[m.type];
    if (requiredFields) {
      requiredFields.forEach(field => {
        if (m[field] === undefined || m[field] === null) {
          issues.push({ level: 'error', message: `${holeLabel} Mechanic ${i} (${m.type}): missing ${field}` });
        }
      });
    }
  });

  return issues;
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
      allIssues.push({ level: 'error', hole: i + 1, message: `Hole ${i + 1}: duplicate index ${config.index}` });
    }
    indices.add(config.index);
  });

  const errors = allIssues.filter(i => i.level === 'error');
  const warnings = allIssues.filter(i => i.level === 'warning');

  if (errors.length > 0) {
    console.error(`[Validator] ${courseName}: ${errors.length} errors, ${warnings.length} warnings`);
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

/**
 * Checks if an object has x, y, z numeric properties (Vector3-like).
 */
function isVector3Like(obj) {
  return obj !== null && obj !== undefined && typeof obj.x === 'number' && typeof obj.y === 'number' && typeof obj.z === 'number';
}

/**
 * Point-in-polygon check using ray casting algorithm.
 * Works with Vector2 boundary (x, y where y=world z) and Vector3 point (x, z).
 */
function isPointInsideBoundary(point, boundary) {
  const px = point.x;
  const pz = point.z !== undefined ? point.z : point.y;
  let inside = false;

  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = boundary[i].x, zi = boundary[i].y;
    const xj = boundary[j].x, zj = boundary[j].y;

    const intersect = ((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi);
    if (intersect) {inside = !inside;}
  }

  return inside;
}
