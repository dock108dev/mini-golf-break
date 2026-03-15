import * as THREE from 'three';

/**
 * Validates a hole configuration for common errors.
 * Returns an array of { level: 'error'|'warning', message } objects.
 */
export function validateHoleConfig(config) {
  const issues = [];

  // Required fields
  if (typeof config.index !== 'number') {issues.push({ level: 'error', message: 'Missing or invalid index' });}
  if (typeof config.par !== 'number' || config.par < 1) {issues.push({ level: 'error', message: `Invalid par: ${config.par}` });}
  if (!config.description) {issues.push({ level: 'warning', message: 'Missing description' });}

  // Boundary shape
  if (!Array.isArray(config.boundaryShape) || config.boundaryShape.length < 3) {
    issues.push({ level: 'error', message: 'boundaryShape must have at least 3 points' });
  }

  // Positions
  if (!config.startPosition) {
    issues.push({ level: 'error', message: 'Missing startPosition' });
  }
  if (!config.holePosition) {
    issues.push({ level: 'error', message: 'Missing holePosition' });
  }

  // Check positions are inside boundary
  if (config.boundaryShape?.length >= 3 && config.startPosition) {
    if (!isPointInsideBoundary(config.startPosition, config.boundaryShape)) {
      issues.push({ level: 'error', message: `startPosition (${config.startPosition.x}, ${config.startPosition.z}) is outside boundary` });
    }
  }
  if (config.boundaryShape?.length >= 3 && config.holePosition) {
    if (!isPointInsideBoundary(config.holePosition, config.boundaryShape)) {
      issues.push({ level: 'error', message: `holePosition (${config.holePosition.x}, ${config.holePosition.z}) is outside boundary` });
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
  (config.mechanics || []).forEach((m, i) => {
    if (!m.type) {issues.push({ level: 'error', message: `Mechanic ${i}: missing type` });}
    // Portal validation
    if (m.type === 'portal_gate') {
      if (!m.entryPosition) {issues.push({ level: 'error', message: `Mechanic ${i} (portal): missing entryPosition` });}
      if (!m.exitPosition) {issues.push({ level: 'error', message: `Mechanic ${i} (portal): missing exitPosition` });}
    }
  });

  return issues;
}

/**
 * Validates an entire course (array of hole configs).
 */
export function validateCourse(holeConfigs, courseName = 'Course') {
  const allIssues = [];
  const indices = new Set();

  holeConfigs.forEach((config, i) => {
    const holeIssues = validateHoleConfig(config);
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
    console.log(`[Validator] ${courseName}: All ${holeConfigs.length} holes valid`);
  }

  return { valid: errors.length === 0, errors, warnings, all: allIssues };
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
