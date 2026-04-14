/**
 * Unit tests for holeValidator utility
 */

import {
  validateHoleConfig,
  validateCourse,
  MECHANIC_REQUIRED_FIELDS
} from '../../utils/holeValidator';

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
      { x: -5, y: -5 }
    ],
    startPosition: { x: 0, y: 0.2, z: 3 },
    holePosition: { x: 0, y: 0.2, z: -3 },
    outOfBounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10, minY: -10 },
    ...overrides
  };
}

// All 13 registered mechanic types
const ALL_MECHANIC_TYPES = [
  'moving_sweeper',
  'timed_hazard',
  'timed_gate',
  'boost_strip',
  'suction_zone',
  'low_gravity_zone',
  'bowl_contour',
  'portal_gate',
  'bank_wall',
  'split_route',
  'elevated_green',
  'ricochet_bumpers',
  'laser_grid',
  'gravity_funnel',
  'disappearing_platform',
  'multi_level_ramp'
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
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Missing or invalid index' })
    );
  });

  test('non-number index produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ index: 'a' }));
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Missing or invalid index' })
    );
  });

  test('invalid par produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ par: 0 }));
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('Invalid par') })
    );
  });

  test('non-number par produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ par: 'three' }));
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('Invalid par') })
    );
  });

  test('missing par produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ par: undefined }));
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('Invalid par') })
    );
  });

  test('missing description produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ description: undefined }));
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Missing or invalid description' })
    );
  });

  test('empty description produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ description: '' }));
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Missing or invalid description' })
    );
  });

  // --- Boundary shape ---

  test('boundaryShape with fewer than 3 points produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        boundaryShape: [
          { x: 0, y: 0 },
          { x: 1, y: 1 }
        ]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'boundaryShape must have at least 3 points'
      })
    );
  });

  test('missing boundaryShape produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ boundaryShape: undefined }));
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'boundaryShape must have at least 3 points'
      })
    );
  });

  test('non-array boundaryShape produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ boundaryShape: 'invalid' }));
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'boundaryShape must have at least 3 points'
      })
    );
  });

  // --- Positions ---

  test('missing startPosition produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ startPosition: undefined }));
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Missing startPosition' })
    );
  });

  test('missing holePosition produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ holePosition: undefined }));
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Missing holePosition' })
    );
  });

  test('invalid startPosition (missing z) produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ startPosition: { x: 0, y: 0 } }));
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Missing startPosition' })
    );
  });

  // --- Position inside boundary ---

  test('startPosition outside boundary produces warning', () => {
    const issues = validateHoleConfig(
      makeValidConfig({ startPosition: { x: 100, y: 0.2, z: 100 } })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('startPosition')
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('outside boundary')
      })
    );
  });

  test('holePosition outside boundary produces warning', () => {
    const issues = validateHoleConfig(
      makeValidConfig({ holePosition: { x: 100, y: 0.2, z: 100 } })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('holePosition')
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('outside boundary')
      })
    );
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
    const issues = validateHoleConfig(
      makeValidConfig({ hazards: [{ position: { x: 0, y: 0, z: 0 }, shape: 'circle' }] })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Hazard 0: missing type' })
    );
  });

  test('hazard missing position produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({ hazards: [{ type: 'sand', shape: 'circle' }] })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Hazard 0: missing position' })
    );
  });

  test('hazard missing shape produces warning', () => {
    const issues = validateHoleConfig(
      makeValidConfig({ hazards: [{ type: 'sand', position: { x: 0, y: 0, z: 0 } }] })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'warning', message: 'Hazard 0: missing shape' })
    );
  });

  test('valid hazard produces no issues', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        hazards: [{ type: 'sand', position: { x: 0, y: 0, z: 0 }, shape: 'circle' }]
      })
    );
    const hazardIssues = issues.filter(i => i.message.includes('Hazard'));
    expect(hazardIssues).toHaveLength(0);
  });

  test('multiple hazards validated independently', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        hazards: [
          { type: 'sand', position: { x: 0, y: 0, z: 0 }, shape: 'circle' },
          { position: { x: 1, y: 0, z: 1 }, shape: 'rect' }
        ]
      })
    );
    expect(issues).toContainEqual(expect.objectContaining({ message: 'Hazard 1: missing type' }));
    const hazard0Issues = issues.filter(i => i.message.includes('Hazard 0'));
    expect(hazard0Issues).toHaveLength(0);
  });

  // --- Bumper validation ---

  test('bumper missing position produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({ bumpers: [{ size: { x: 1, y: 1, z: 1 } }] })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Bumper 0: missing position' })
    );
  });

  test('bumper missing size produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({ bumpers: [{ position: { x: 0, y: 0, z: 0 } }] })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Bumper 0: missing size' })
    );
  });

  test('valid bumper produces no issues', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        bumpers: [{ position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } }]
      })
    );
    const bumperIssues = issues.filter(i => i.message.includes('Bumper'));
    expect(bumperIssues).toHaveLength(0);
  });

  // --- Mechanics validation ---

  test('mechanic missing type produces error', () => {
    const issues = validateHoleConfig(makeValidConfig({ mechanics: [{}] }));
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('Mechanic 0: missing type')
      })
    );
  });

  test('mechanic with unknown type produces error when registeredTypes provided', () => {
    const issues = validateHoleConfig(makeValidConfig({ mechanics: [{ type: 'fake_mechanic' }] }), {
      registeredTypes: ALL_MECHANIC_TYPES
    });
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining("unknown type 'fake_mechanic'")
      })
    );
  });

  test('mechanic type check is skipped when no registeredTypes provided', () => {
    const issues = validateHoleConfig(makeValidConfig({ mechanics: [{ type: 'fake_mechanic' }] }));
    const typeErrors = issues.filter(i => i.message.includes('unknown type'));
    expect(typeErrors).toHaveLength(0);
  });

  // --- Per-mechanic-type required field validation ---

  test('portal_gate missing entryPosition produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'portal_gate', exitPosition: { x: 1, y: 0, z: 1 }, radius: 0.5 }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('missing entryPosition')
      })
    );
  });

  test('portal_gate missing exitPosition produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'portal_gate', entryPosition: { x: 0, y: 0, z: 0 }, radius: 0.5 }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('missing exitPosition')
      })
    );
  });

  test('portal_gate missing radius produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [
          {
            type: 'portal_gate',
            entryPosition: { x: 0, y: 0, z: 0 },
            exitPosition: { x: 1, y: 0, z: 1 }
          }
        ]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('missing radius')
      })
    );
  });

  test('valid portal_gate produces no mechanic issues', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [
          {
            type: 'portal_gate',
            entryPosition: { x: 0, y: 0, z: 0 },
            exitPosition: { x: 1, y: 0, z: 1 },
            radius: 0.5
          }
        ]
      })
    );
    const mechanicIssues = issues.filter(i => i.message.includes('Mechanic'));
    expect(mechanicIssues).toHaveLength(0);
  });

  test('moving_sweeper missing required fields produces errors', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'moving_sweeper' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('missing pivot') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('missing armLength')
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('missing speed') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('missing size') })
    );
  });

  test('valid moving_sweeper produces no mechanic issues', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [
          {
            type: 'moving_sweeper',
            pivot: { x: 0, y: 0, z: 0 },
            armLength: 3,
            speed: 1,
            size: { width: 2, height: 0.4, depth: 0.3 }
          }
        ]
      })
    );
    const mechanicIssues = issues.filter(i => i.message.includes('Mechanic'));
    expect(mechanicIssues).toHaveLength(0);
  });

  test('boost_strip missing required fields produces errors', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'boost_strip' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing position') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing direction') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing force') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing size') })
    );
  });

  test('suction_zone missing required fields produces errors', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'suction_zone' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing position') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing radius') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing force') })
    );
  });

  test('low_gravity_zone missing required fields produces errors', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'low_gravity_zone' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing position') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing radius') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing gravityMultiplier') })
    );
  });

  test('bowl_contour missing required fields produces errors', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'bowl_contour' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing position') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing radius') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing force') })
    );
  });

  test('timed_hazard missing required fields produces errors', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'timed_hazard' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing position') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing size') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing onDuration') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing offDuration') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing hazardType') })
    );
  });

  test('timed_gate missing required fields produces errors', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'timed_gate' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing position') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing size') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing openDuration') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing closedDuration') })
    );
  });

  test('bank_wall missing segments produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'bank_wall' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing segments') })
    );
  });

  test('split_route missing required fields produces errors', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'split_route' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing walls') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing height') })
    );
  });

  test('elevated_green missing required fields produces errors', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'elevated_green' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing platform') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing elevation') })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing ramp') })
    );
  });

  test('ricochet_bumpers missing bumpers produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'ricochet_bumpers' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('missing bumpers') })
    );
  });

  test('error messages include hole index and mechanic type', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        index: 5,
        mechanics: [{ type: 'suction_zone' }]
      })
    );
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

  // --- Cup flush check ---

  test('cup embedded in floor produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        startPosition: { x: 0, y: 0.2, z: 3 },
        holePosition: { x: 0, y: -0.5, z: -3 }
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('embedded') })
    );
  });

  test('cup floating above produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        startPosition: { x: 0, y: 0.2, z: 3 },
        holePosition: { x: 0, y: 1.0, z: -3 }
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('floating') })
    );
  });

  test('cup at same height as start produces no cup flush error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        startPosition: { x: 0, y: 0.2, z: 3 },
        holePosition: { x: 0, y: 0.2, z: -3 }
      })
    );
    const cupErrors = issues.filter(
      i => i.level === 'error' && (i.message.includes('embedded') || i.message.includes('floating'))
    );
    expect(cupErrors).toHaveLength(0);
  });

  test('cup slightly above start (within 0.5) produces no error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        startPosition: { x: 0, y: 0.0, z: 3 },
        holePosition: { x: 0, y: 0.5, z: -3 }
      })
    );
    const cupErrors = issues.filter(
      i => i.level === 'error' && (i.message.includes('embedded') || i.message.includes('floating'))
    );
    expect(cupErrors).toHaveLength(0);
  });

  test('cup slightly below start (within 0.1) produces no error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        startPosition: { x: 0, y: 0.1, z: 3 },
        holePosition: { x: 0, y: 0.0, z: -3 }
      })
    );
    const cupErrors = issues.filter(
      i => i.level === 'error' && (i.message.includes('embedded') || i.message.includes('floating'))
    );
    expect(cupErrors).toHaveLength(0);
  });

  test('cup flush check works with array positions', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        startPosition: [0, 0.2, 3],
        holePosition: [0, -0.5, -3]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ level: 'error', message: expect.stringContaining('embedded') })
    );
  });

  test('cup flush allows elevated cup when elevated_green mechanic present', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        startPosition: { x: 0, y: 0, z: 3 },
        holePosition: { x: 0, y: 2, z: -3 },
        mechanics: [
          {
            type: 'elevated_green',
            platform: { position: [0, 0, -3], width: 4, length: 4 },
            elevation: 2,
            ramp: { start: [0, 0, 0], end: [0, 0, -2], width: 2 }
          }
        ]
      })
    );
    const cupErrors = issues.filter(
      i => i.level === 'error' && (i.message.includes('embedded') || i.message.includes('floating'))
    );
    expect(cupErrors).toHaveLength(0);
  });

  // --- Spawn clearance check ---

  test('spawn near boundary wall produces warning', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        startPosition: { x: 4.9, y: 0.2, z: 0 }
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('from boundary wall')
      })
    );
  });

  test('spawn well inside boundary produces no spawn clearance warning', () => {
    const issues = validateHoleConfig(makeValidConfig());
    const clearanceWarnings = issues.filter(
      i => i.level === 'warning' && i.message.includes('from boundary wall')
    );
    expect(clearanceWarnings).toHaveLength(0);
  });

  // --- Boundary closure check ---

  test('open boundary polygon produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        boundaryShape: [
          { x: -5, y: -5 },
          { x: 5, y: -5 },
          { x: 5, y: 5 },
          { x: -5, y: 5 }
        ]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('not closed')
      })
    );
  });

  test('closed boundary polygon produces no closure error', () => {
    const issues = validateHoleConfig(makeValidConfig());
    const closureErrors = issues.filter(
      i => i.level === 'error' && i.message.includes('not closed')
    );
    expect(closureErrors).toHaveLength(0);
  });

  test('boundary nearly closed (within 0.1 tolerance) produces no error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        boundaryShape: [
          { x: -5, y: -5 },
          { x: 5, y: -5 },
          { x: 5, y: 5 },
          { x: -5, y: 5 },
          { x: -5.05, y: -5.05 }
        ]
      })
    );
    const closureErrors = issues.filter(
      i => i.level === 'error' && i.message.includes('not closed')
    );
    expect(closureErrors).toHaveLength(0);
  });

  test('boundary closure check with array coordinates', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        boundaryShape: [
          [-5, -5],
          [5, -5],
          [5, 5],
          [-5, 5]
        ]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('not closed')
      })
    );
  });

  // --- Obstacle relevance check ---

  test('mechanic position outside boundary produces warning', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [
          {
            type: 'suction_zone',
            position: { x: 50, y: 0, z: 50 },
            radius: 2,
            force: 5
          }
        ]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('outside boundary + 2 unit margin')
      })
    );
  });

  test('mechanic position inside boundary produces no relevance warning', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [
          {
            type: 'suction_zone',
            position: { x: 0, y: 0, z: 0 },
            radius: 2,
            force: 5
          }
        ]
      })
    );
    const relevanceWarnings = issues.filter(
      i => i.level === 'warning' && i.message.includes('outside boundary')
    );
    expect(relevanceWarnings).toHaveLength(0);
  });

  test('mechanic with pivot field checked for relevance', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [
          {
            type: 'moving_sweeper',
            pivot: { x: 50, y: 0, z: 50 },
            armLength: 3,
            speed: 1,
            size: { width: 2, height: 0.4, depth: 0.3 }
          }
        ]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('outside boundary + 2 unit margin')
      })
    );
  });

  test('mechanic slightly outside boundary but within 2 unit margin produces no warning', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [
          {
            type: 'suction_zone',
            position: { x: 6, y: 0, z: 0 },
            radius: 2,
            force: 5
          }
        ]
      })
    );
    const relevanceWarnings = issues.filter(
      i => i.level === 'warning' && i.message.includes('outside boundary + 2 unit margin')
    );
    expect(relevanceWarnings).toHaveLength(0);
  });

  // --- Cup reachability check ---

  test('cup too far from start produces error', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        boundaryShape: [
          { x: -1, y: -1 },
          { x: 1, y: -1 },
          { x: 1, y: 1 },
          { x: -1, y: 1 },
          { x: -1, y: -1 }
        ],
        startPosition: { x: 0, y: 0.2, z: 0 },
        holePosition: { x: 0, y: 0.2, z: 100 }
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('cup unreachable')
      })
    );
  });

  test('cup within boundary diagonal produces no reachability error', () => {
    const issues = validateHoleConfig(makeValidConfig());
    const reachErrors = issues.filter(
      i => i.level === 'error' && i.message.includes('cup unreachable')
    );
    expect(reachErrors).toHaveLength(0);
  });

  // --- Mechanic required fields coverage ---

  test('mechanic type not in MECHANIC_REQUIRED_FIELDS produces warning', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [{ type: 'unknown_but_not_checked_against_registry' }]
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('no required fields defined')
      })
    );
  });

  // --- outOfBounds check ---

  test('missing outOfBounds field produces warning', () => {
    const config = makeValidConfig();
    delete config.outOfBounds;
    const issues = validateHoleConfig(config);
    expect(issues).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('missing outOfBounds')
      })
    );
  });

  test('present outOfBounds field produces no outOfBounds warning', () => {
    const issues = validateHoleConfig(makeValidConfig());
    const oobWarnings = issues.filter(
      i => i.level === 'warning' && i.message.includes('outOfBounds')
    );
    expect(oobWarnings).toHaveLength(0);
  });

  test('MECHANIC_REQUIRED_FIELDS covers all 15 mechanic types', () => {
    ALL_MECHANIC_TYPES.forEach(type => {
      expect(MECHANIC_REQUIRED_FIELDS).toHaveProperty(type);
    });
  });

  test('mechanic type in MECHANIC_REQUIRED_FIELDS produces no coverage warning', () => {
    const issues = validateHoleConfig(
      makeValidConfig({
        mechanics: [
          {
            type: 'suction_zone',
            position: { x: 0, y: 0, z: 0 },
            radius: 2,
            force: 5
          }
        ]
      })
    );
    const coverageWarnings = issues.filter(
      i => i.level === 'warning' && i.message.includes('no required fields defined')
    );
    expect(coverageWarnings).toHaveLength(0);
  });
});

describe('validateCourse', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  test('valid course returns valid: true', () => {
    const configs = [
      makeValidConfig({ index: 0 }),
      makeValidConfig({ index: 1, description: 'Hole 2' })
    ];
    const result = validateCourse(configs, 'Test');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('duplicate indices produce error', () => {
    const configs = [
      makeValidConfig({ index: 0 }),
      makeValidConfig({ index: 0, description: 'Hole 2' })
    ];
    const result = validateCourse(configs, 'Test');
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('duplicate index') })
    );
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
    const found = logCalls.some(args =>
      args.some(a => typeof a === 'string' && a.includes('All 1 holes valid'))
    );
    expect(found).toBe(true);
  });

  test('passes registeredTypes option through to validateHoleConfig', () => {
    const configs = [
      makeValidConfig({
        index: 0,
        mechanics: [{ type: 'nonexistent_type' }]
      })
    ];
    const result = validateCourse(configs, 'Test', { registeredTypes: ALL_MECHANIC_TYPES });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('unknown type')
      })
    );
  });
});

describe('orbitalDriftConfigs validation', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {})
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

  test('all 18 orbitalDriftConfigs pass validation with no errors', () => {
    const configs = createOrbitalDriftConfigs();
    expect(configs).toHaveLength(18);
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
