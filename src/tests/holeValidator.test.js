/**
 * Unit tests for holeValidator.js — focusing on wall-corner overlap check.
 * ISSUE-006
 */

jest.mock('../utils/debug', () => ({
  debug: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { validateHoleConfig } from '../utils/holeValidator';

// Minimal valid config used as a base for focused tests
const BASE_CONFIG = {
  index: 0,
  par: 2,
  description: 'Test Hole',
  startPosition: [0, 0, 1],
  holePosition: [0, 0, -1],
  outOfBounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10, minY: -10 },
  hazards: [],
  bumpers: [],
  mechanics: []
};

function configWith(boundaryShape) {
  return { ...BASE_CONFIG, boundaryShape };
}

function cornerErrors(issues) {
  return issues.filter(i => i.level === 'error' && i.message.includes('wall corner'));
}

describe('holeValidator — wall corner overlap (_checkWallCornerOverlap)', () => {
  describe('passing cases', () => {
    test('rectangle with all 90-degree corners has no corner errors', () => {
      const cfg = configWith([
        [-2, -5],
        [-2, 5],
        [2, 5],
        [2, -5],
        [-2, -5]
      ]);
      const issues = validateHoleConfig(cfg);
      expect(cornerErrors(issues)).toHaveLength(0);
    });

    test('closure corner of rectangle is also validated and passes', () => {
      // The closure corner at vertex 0 (between last wall and first wall) is 90°
      const cfg = configWith([
        [-3, -3],
        [-3, 3],
        [3, 3],
        [3, -3],
        [-3, -3]
      ]);
      const issues = validateHoleConfig(cfg);
      expect(cornerErrors(issues)).toHaveLength(0);
    });

    test('hexagon with 60-degree interior turns passes', () => {
      // Regular-ish hexagon — all turns are 60° exterior → sin(60°) = 0.866 → overlap 0.087
      const r = 5;
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        pts.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      const cfg = configWith(pts);
      const issues = validateHoleConfig(cfg);
      expect(cornerErrors(issues)).toHaveLength(0);
    });
  });

  describe('failing cases', () => {
    test('collinear inline vertex (0-degree turn) reports insufficient-overlap error', () => {
      // shape[2] = (0, 0) lies exactly on the segment (-5,0)→(5,0): collinear → cross = 0
      const cfg = configWith([
        [-5, 0],
        [0, 0], // inline — zero deflection between walls
        [5, 0],
        [5, -5],
        [-5, -5],
        [-5, 0]
      ]);
      const issues = validateHoleConfig(cfg);
      const errs = cornerErrors(issues);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs[0].message).toMatch(/wall corner/);
      expect(errs[0].message).toMatch(/insufficient overlap/);
      expect(errs[0].level).toBe('error');
    });

    test('very-shallow turn (~5-degree deflection) reports error', () => {
      // Segment 1: (-5,0)→(0,0) direction (1,0)
      // Segment 2: (0,0)→(10,0.9) — deflection ≈ 5° → overlap ≈ 0.009 < 0.05
      const cfg = configWith([
        [-5, 0],
        [0, 0],
        [10, 0.9],
        [10, -5],
        [-5, -5],
        [-5, 0]
      ]);
      const issues = validateHoleConfig(cfg);
      const errs = cornerErrors(issues);
      expect(errs.length).toBeGreaterThan(0);
    });

    test('reports the correct boundary index in the error message', () => {
      // Corner index 2 (shape[2]) is collinear
      const cfg = configWith([
        [-5, -5],
        [-5, 0], // corner index 1 — 90° turn, OK
        [0, 0], // corner index 2 — collinear next segment, FAIL
        [5, 0],
        [5, -5],
        [-5, -5]
      ]);
      const issues = validateHoleConfig(cfg);
      const errs = cornerErrors(issues);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.some(e => e.message.includes('index 2'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('boundary with fewer than 4 points is skipped (no crash)', () => {
      const cfg = configWith([
        [0, 0],
        [1, 0],
        [1, 1]
      ]);
      expect(() => validateHoleConfig(cfg)).not.toThrow();
    });

    test('boundary with duplicate adjacent points is skipped (zero-length segment)', () => {
      const cfg = configWith([
        [-2, -5],
        [-2, -5],
        [-2, 5],
        [2, 5],
        [2, -5],
        [-2, -5]
      ]);
      expect(() => validateHoleConfig(cfg)).not.toThrow();
    });

    test('open polygon (no closure match) does not check closure corner', () => {
      // First and last points differ by more than 0.1 — no closure corner check
      const cfg = configWith([
        [-2, -5],
        [-2, 5],
        [2, 5],
        [2, -5],
        [0, -6]
      ]);
      const issues = validateHoleConfig(cfg);
      // No crash; standard interior corners still checked
      expect(Array.isArray(issues)).toBe(true);
    });
  });
});
