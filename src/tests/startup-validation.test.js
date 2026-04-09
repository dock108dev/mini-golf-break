/**
 * Tests for dev-mode startup validation of mechanic types in Game.createCourse()
 * ISSUE-065: Validate all mechanic types in configs are registered on game init
 */

import { validateCourse } from '../utils/holeValidator';
import { getRegisteredTypes } from '../mechanics/MechanicRegistry';

// Import mechanics barrel to trigger all registrations
import '../mechanics/index';

// Helper to create a minimal valid hole config
function makeHoleConfig(overrides = {}) {
  return {
    index: 0,
    par: 3,
    description: 'Test Hole',
    boundaryShape: [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 },
    ],
    startPosition: { x: 0, y: 0.2, z: 3 },
    holePosition: { x: 0, y: 0.2, z: -3 },
    mechanics: [],
    ...overrides,
  };
}

describe('Dev-mode startup validation (ISSUE-065)', () => {
  const originalEnv = process.env.NODE_ENV;
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  test('getRegisteredTypes returns all 12 mechanic types', () => {
    const types = getRegisteredTypes();
    expect(types).toContain('moving_sweeper');
    expect(types).toContain('portal_gate');
    expect(types).toContain('boost_strip');
    expect(types).toContain('suction_zone');
    expect(types).toContain('low_gravity_zone');
    expect(types).toContain('bowl_contour');
    expect(types).toContain('timed_hazard');
    expect(types).toContain('timed_gate');
    expect(types).toContain('bank_wall');
    expect(types).toContain('split_route');
    expect(types).toContain('elevated_green');
    expect(types).toContain('ricochet_bumpers');
    expect(types.length).toBe(12);
  });

  test('unregistered mechanic type produces console.error with hole index and type', () => {
    process.env.NODE_ENV = 'test';
    const configs = [
      makeHoleConfig({
        index: 3,
        mechanics: [{ type: 'nonexistent_laser_beam' }],
      }),
    ];

    const result = validateCourse(configs, 'Orbital Drift', {
      registeredTypes: getRegisteredTypes(),
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(consoleSpy.error).toHaveBeenCalled();

    // Error message should include hole index and missing type
    const errorMessages = result.errors.map(e => e.message);
    expect(errorMessages.some(m => m.includes('nonexistent_laser_beam'))).toBe(true);
    expect(errorMessages.some(m => m.includes('unknown type'))).toBe(true);
  });

  test('valid mechanic types produce no errors', () => {
    process.env.NODE_ENV = 'test';
    const configs = [
      makeHoleConfig({
        index: 0,
        mechanics: [
          { type: 'moving_sweeper', pivot: { x: 0, y: 0, z: 0 }, armLength: 3, speed: 1, size: { width: 2, height: 0.4, depth: 0.3 } },
          { type: 'boost_strip', position: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 }, force: 5, size: { width: 2, length: 1 } },
        ],
      }),
    ];

    const result = validateCourse(configs, 'Orbital Drift', {
      registeredTypes: getRegisteredTypes(),
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('validation does not run in production mode', () => {
    process.env.NODE_ENV = 'production';
    const configs = [
      makeHoleConfig({
        index: 0,
        mechanics: [{ type: 'totally_fake_type' }],
      }),
    ];

    const result = validateCourse(configs, 'Orbital Drift', {
      registeredTypes: getRegisteredTypes(),
    });

    // In production, validateHoleConfig returns [] so no errors
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('validation logs errors but does not throw', () => {
    process.env.NODE_ENV = 'test';
    const configs = [
      makeHoleConfig({
        index: 0,
        mechanics: [{ type: 'fake_type_1' }, { type: 'fake_type_2' }],
      }),
    ];

    // Should not throw — just logs and returns
    expect(() => {
      validateCourse(configs, 'Orbital Drift', {
        registeredTypes: getRegisteredTypes(),
      });
    }).not.toThrow();

    expect(consoleSpy.error).toHaveBeenCalled();
  });

  test('multiple holes with unregistered types all produce errors', () => {
    process.env.NODE_ENV = 'test';
    const configs = [
      makeHoleConfig({
        index: 0,
        mechanics: [{ type: 'bad_type_a' }],
      }),
      makeHoleConfig({
        index: 1,
        description: 'Hole 2',
        mechanics: [{ type: 'bad_type_b' }],
      }),
    ];

    const result = validateCourse(configs, 'Test', {
      registeredTypes: getRegisteredTypes(),
    });

    expect(result.valid).toBe(false);
    const unknownTypeErrors = result.errors.filter(e => e.message.includes('unknown type'));
    expect(unknownTypeErrors.length).toBe(2);
    expect(unknownTypeErrors.some(e => e.message.includes('bad_type_a'))).toBe(true);
    expect(unknownTypeErrors.some(e => e.message.includes('bad_type_b'))).toBe(true);
  });
});
