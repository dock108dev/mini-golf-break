/**
 * Unit tests for holeValidator utility
 */

import { validateHoleConfig, validateCourse } from '../../utils/holeValidator';

// Helper to create a valid hole config
function makeValidConfig(overrides = {}) {
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
    ...overrides,
  };
}

// All 12 registered mechanic types
const ALL_MECHANIC_TYPES = [
  'moving_sweeper', 'timed_hazard', 'timed_gate', 'boost_strip',
  'suction_zone', 'low_gravity_zone', 'bowl_contour', 'portal_gate',
  'bank_wall', 'split_route', 'elevated_green', 'ricochet_bumpers',
];

describe('validateHoleConfig', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('valid config returns no issues', () => {
    const issues = validateHoleConfig(makeValidConfig());
    const errors = issues.filter(i => i.level === 'error');
    expect(errors).toHaveLength(0);
  });

  test('skips validation in production mode', () => {
    process.env.NODE_ENV = 'production';
    const issues = validateHoleConfig({});
    expect(issues).toEqual([]);
  });

  // --- Required fields ---

  test('missing index produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ index: undefined }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Missing or invalid index' }));
  });

  test('non-number index produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ index: 'a' }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Missing or invalid index' }));
  });

  test('invalid par produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ par: 0 }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('Invalid par') }));
  });

  test('non-number par produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ par: 'three' }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('Invalid par') }));
  });

  test('missing par produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ par: undefined }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('Invalid par') }));
  });

  test('missing description produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ description: undefined }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Missing or invalid description' }));
  });

  test('empty description produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ description: '' }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Missing or invalid description' }));
  });

  // --- Boundary shape ---

  test('boundaryShape with fewer than 3 points produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ boundaryShape: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'boundaryShape must have at least 3 points' }));
  });

  test('missing boundaryShape produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ boundaryShape: undefined }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'boundaryShape must have at least 3 points' }));
  });

  test('non-array boundaryShape produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ boundaryShape: 'invalid' }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'boundaryShape must have at least 3 points' }));
  });

  // --- Positions ---

  test('missing startPosition produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ startPosition: undefined }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Missing startPosition' }));
  });

  test('missing holePosition produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ holePosition: undefined }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Missing holePosition' }));
  });

  test('invalid startPosition (missing z) produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ startPosition: { x: 0, y: 0 } }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Missing startPosition' }));
  });

  // --- Position inside boundary ---

  test('startPosition outside boundary produces warning', () => {
    const issues = validateHoleConfig(makeValidConfig({ startPosition: { x: 100, y: 0.2, z: 100 } }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'warning', message: expect.stringContaining('startPosition') }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'warning', message: expect.stringContaining('outside boundary') }));
  });

  test('holePosition outside boundary produces warning', () => {
    const issues = validateHoleConfig(makeValidConfig({ holePosition: { x: 100, y: 0.2, z: 100 } }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'warning', message: expect.stringContaining('holePosition') }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'warning', message: expect.stringContaining('outside boundary') }));
  });

  test('positions inside boundary produce no warnings', () => {
    const issues = validateHoleConfig(makeValidConfig());
    const warnings = issues.filter(i => i.level === 'warning');
    expect(warnings).toHaveLength(0);
  });

  test('boundary check is skipped when boundaryShape is invalid', () => {
    const issues = validateHoleConfig(makeValidConfig({ boundaryShape: [] }));
    const warnings = issues.filter(i => i.level === 'warning');
    expect(warnings).toHaveLength(0);
  });

  // --- Hazard validation ---

  test('hazard missing type produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ hazards: [{ position: { x: 0, y: 0, z: 0 }, shape: 'circle' }] }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Hazard 0: missing type' }));
  });

  test('hazard missing position produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ hazards: [{ type: 'sand', shape: 'circle' }] }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Hazard 0: missing position' }));
  });

  test('hazard missing shape produces warning', () => {
    const issues = validateHoleConfig(makeValidConfig({ hazards: [{ type: 'sand', position: { x: 0, y: 0, z: 0 } }] }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'warning', message: 'Hazard 0: missing shape' }));
  });

  test('valid hazard produces no issues', () => {
    const issues = validateHoleConfig(makeValidConfig({ hazards: [{ type: 'sand', position: { x: 0, y: 0, z: 0 }, shape: 'circle' }] }));
    const hazardIssues = issues.filter(i => i.message.includes('Hazard'));
    expect(hazardIssues).toHaveLength(0);
  });

  test('multiple hazards validated independently', () => {
    const issues = validateHoleConfig(makeValidConfig({
      hazards: [
        { type: 'sand', position: { x: 0, y: 0, z: 0 }, shape: 'circle' },
        { position: { x: 1, y: 0, z: 1 }, shape: 'rect' },
      ],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: 'Hazard 1: missing type' }));
    const hazard0Issues = issues.filter(i => i.message.includes('Hazard 0'));
    expect(hazard0Issues).toHaveLength(0);
  });

  // --- Bumper validation ---

  test('bumper missing position produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ bumpers: [{ size: { x: 1, y: 1, z: 1 } }] }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Bumper 0: missing position' }));
  });

  test('bumper missing size produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ bumpers: [{ position: { x: 0, y: 0, z: 0 } }] }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Bumper 0: missing size' }));
  });

  test('valid bumper produces no issues', () => {
    const issues = validateHoleConfig(makeValidConfig({
      bumpers: [{ position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } }],
    }));
    const bumperIssues = issues.filter(i => i.message.includes('Bumper'));
    expect(bumperIssues).toHaveLength(0);
  });

  // --- Mechanics validation ---

  test('mechanic missing type produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ mechanics: [{}] }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('Mechanic 0: missing type') }));
  });

  test('mechanic with unknown type produces error when registeredTypes provided', () => {
    const issues = validateHoleConfig(
      makeValidConfig({ mechanics: [{ type: 'fake_mechanic' }] }),
      { registeredTypes: ALL_MECHANIC_TYPES },
    );
    expect(issues).toContainEqual(expect.objectContaining({
      level: 'error',
      message: expect.stringContaining("unknown type 'fake_mechanic'"),
    }));
  });

  test('mechanic type check is skipped when no registeredTypes provided', () => {
    const issues = validateHoleConfig(
      makeValidConfig({ mechanics: [{ type: 'fake_mechanic' }] }),
    );
    const typeErrors = issues.filter(i => i.message.includes('unknown type'));
    expect(typeErrors).toHaveLength(0);
  });

  // --- Per-mechanic-type required field validation ---

  test('portal_gate missing entryPosition produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'portal_gate', exitPosition: { x: 1, y: 0, z: 1 }, radius: 0.5 }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('missing entryPosition') }));
  });

  test('portal_gate missing exitPosition produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'portal_gate', entryPosition: { x: 0, y: 0, z: 0 }, radius: 0.5 }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('missing exitPosition') }));
  });

  test('portal_gate missing radius produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'portal_gate', entryPosition: { x: 0, y: 0, z: 0 }, exitPosition: { x: 1, y: 0, z: 1 } }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('missing radius') }));
  });

  test('valid portal_gate produces no mechanic issues', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'portal_gate', entryPosition: { x: 0, y: 0, z: 0 }, exitPosition: { x: 1, y: 0, z: 1 }, radius: 0.5 }],
    }));
    const mechanicIssues = issues.filter(i => i.message.includes('Mechanic'));
    expect(mechanicIssues).toHaveLength(0);
  });

  test('moving_sweeper missing required fields produces errors', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'moving_sweeper' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('missing pivot') }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('missing armLength') }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('missing speed') }));
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: expect.stringContaining('missing size') }));
  });

  test('valid moving_sweeper produces no mechanic issues', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'moving_sweeper', pivot: { x: 0, y: 0, z: 0 }, armLength: 3, speed: 1, size: { width: 2, height: 0.4, depth: 0.3 } }],
    }));
    const mechanicIssues = issues.filter(i => i.message.includes('Mechanic'));
    expect(mechanicIssues).toHaveLength(0);
  });

  test('boost_strip missing required fields produces errors', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'boost_strip' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing position') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing direction') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing force') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing size') }));
  });

  test('suction_zone missing required fields produces errors', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'suction_zone' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing position') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing radius') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing force') }));
  });

  test('low_gravity_zone missing required fields produces errors', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'low_gravity_zone' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing position') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing radius') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing gravityMultiplier') }));
  });

  test('bowl_contour missing required fields produces errors', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'bowl_contour' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing position') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing radius') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing force') }));
  });

  test('timed_hazard missing required fields produces errors', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'timed_hazard' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing position') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing size') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing onDuration') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing offDuration') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing hazardType') }));
  });

  test('timed_gate missing required fields produces errors', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'timed_gate' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing position') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing size') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing openDuration') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing closedDuration') }));
  });

  test('bank_wall missing segments produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'bank_wall' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing segments') }));
  });

  test('split_route missing required fields produces errors', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'split_route' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing walls') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing height') }));
  });

  test('elevated_green missing required fields produces errors', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'elevated_green' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing platform') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing elevation') }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing ramp') }));
  });

  test('ricochet_bumpers missing bumpers produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({
      mechanics: [{ type: 'ricochet_bumpers' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('missing bumpers') }));
  });

  test('error messages include hole index and mechanic type', () => {
    const issues = validateHoleConfig(makeValidConfig({
      index: 5,
      mechanics: [{ type: 'suction_zone' }],
    }));
    const mechanicErrors = issues.filter(i => i.message.includes('Mechanic'));
    expect(mechanicErrors.length).toBeGreaterThan(0);
    mechanicErrors.forEach(err => {
      expect(err.message).toContain('Hole 5');
      expect(err.message).toContain('suction_zone');
    });
  });

  // --- No hazards/bumpers/mechanics ---

  test('config without hazards, bumpers, or mechanics is valid', () => {
    const config = makeValidConfig();
    delete config.hazards;
    delete config.bumpers;
    delete config.mechanics;
    const issues = validateHoleConfig(config);
    const errors = issues.filter(i => i.level === 'error');
    expect(errors).toHaveLength(0);
  });
});

describe('validateCourse', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  test('valid course returns valid: true', () => {
    const configs = [makeValidConfig({ index: 0 }), makeValidConfig({ index: 1, description: 'Hole 2' })];
    const result = validateCourse(configs, 'Test');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('duplicate indices produce error', () => {
    const configs = [makeValidConfig({ index: 0 }), makeValidConfig({ index: 0, description: 'Hole 2' })];
    const result = validateCourse(configs, 'Test');
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ message: expect.stringContaining('duplicate index') }));
  });

  test('hole issues are prefixed with hole number', () => {
    const configs = [makeValidConfig({ index: 0, par: 0 })];
    const result = validateCourse(configs, 'Test');
    expect(result.all[0].message).toMatch(/^Hole 1:/);
    expect(result.all[0].hole).toBe(1);
  });

  test('logs errors to console.error', () => {
    const configs = [makeValidConfig({ index: undefined })];
    validateCourse(configs, 'BadCourse');
    expect(consoleSpy.error).toHaveBeenCalled();
  });

  test('logs success when all holes valid', () => {
    const configs = [makeValidConfig({ index: 0 })];
    validateCourse(configs, 'GoodCourse');
    // debug.log prefixes with '[DEBUG]' then passes the message as second arg
    const logCalls = consoleSpy.log.mock.calls;
    const found = logCalls.some(args => args.some(a => typeof a === 'string' && a.includes('All 1 holes valid')));
    expect(found).toBe(true);
  });

  test('passes registeredTypes option through to validateHoleConfig', () => {
    const configs = [makeValidConfig({
      index: 0,
      mechanics: [{ type: 'nonexistent_type' }],
    })];
    const result = validateCourse(configs, 'Test', { registeredTypes: ALL_MECHANIC_TYPES });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      message: expect.stringContaining('unknown type'),
    }));
  });
});

describe('orbitalDriftConfigs validation', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  // Dynamic import to get orbitalDriftConfigs with THREE mock in place
  let createOrbitalDriftConfigs;
  beforeAll(async () => {
    const mod = await import('../../config/orbitalDriftConfigs');
    createOrbitalDriftConfigs = mod.createOrbitalDriftConfigs;
  });

  test('all 9 orbitalDriftConfigs pass validation with no errors', () => {
    const configs = createOrbitalDriftConfigs();
    const result = validateCourse(configs, 'OrbitalDrift', { registeredTypes: ALL_MECHANIC_TYPES });
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  test('all mechanic types in orbitalDriftConfigs are in ALL_MECHANIC_TYPES', () => {
    const configs = createOrbitalDriftConfigs();
    const usedTypes = new Set();
    configs.forEach(c => (c.mechanics || []).forEach(m => usedTypes.add(m.type)));
    usedTypes.forEach(type => {
      expect(ALL_MECHANIC_TYPES).toContain(type);
    });
  });
});
