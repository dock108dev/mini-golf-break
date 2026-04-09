/**
 * ISSUE-047: Validate orbitalDriftConfigs mechanics match design spec.
 *
 * Verifies each of the 9 Orbital Drift hole configs has the correct
 * mechanics types as specified in docs/course-infrastructure.md Section 7.
 */

import { createOrbitalDriftConfigs } from '../../config/orbitalDriftConfigs';

const configs = createOrbitalDriftConfigs();

// Design spec from docs/course-infrastructure.md Section 7
const DESIGN_SPEC = {
  'H1': { index: 0, name: 'Launch Bay', requiredTypes: ['moving_sweeper'] },
  'H2': { index: 1, name: 'Crater Rim', requiredTypes: ['bowl_contour'] },
  'H3': { index: 2, name: 'Satellite Slingshot', requiredTypes: ['split_route', 'moving_sweeper'] },
  'H4': { index: 3, name: 'Asteroid Belt Bounce', requiredTypes: ['ricochet_bumpers', 'elevated_green'] },
  'H5': { index: 4, name: 'Wormhole Transfer', requiredTypes: ['portal_gate'] },
  'H6': { index: 5, name: 'Solar Flare Run', requiredTypes: ['timed_hazard'] },
  'H7': { index: 6, name: 'Zero G Lab', requiredTypes: ['low_gravity_zone', 'bank_wall'] },
  'H8': { index: 7, name: 'Event Horizon', requiredTypes: ['suction_zone', 'timed_gate'] },
  'H9': { index: 8, name: 'Station Core Finale', requiredTypes: ['split_route', 'boost_strip', 'moving_sweeper', 'elevated_green'] },
};

describe('Orbital Drift configs match design spec (ISSUE-047)', () => {
  it('has exactly 9 hole configs', () => {
    expect(configs).toHaveLength(9);
  });

  it.each(Object.entries(DESIGN_SPEC))(
    '%s (%s) has the required mechanic types',
    (hole, spec) => {
      const config = configs[spec.index];
      expect(config).toBeDefined();
      expect(config.mechanics).toBeDefined();
      expect(Array.isArray(config.mechanics)).toBe(true);

      const actualTypes = config.mechanics.map(m => m.type);
      const uniqueActualTypes = [...new Set(actualTypes)];

      // Every required type from the design spec must be present
      for (const requiredType of spec.requiredTypes) {
        expect(uniqueActualTypes).toContain(requiredType);
      }
    }
  );

  // Individual hole tests for clear acceptance criteria traceability

  it('H1 config has moving_sweeper mechanic', () => {
    const types = configs[0].mechanics.map(m => m.type);
    expect(types).toContain('moving_sweeper');
  });

  it('H2 config has bowl_contour mechanic', () => {
    const types = configs[1].mechanics.map(m => m.type);
    expect(types).toContain('bowl_contour');
  });

  it('H3 config has split_route and moving_sweeper mechanics', () => {
    const types = configs[2].mechanics.map(m => m.type);
    expect(types).toContain('split_route');
    expect(types).toContain('moving_sweeper');
  });

  it('H4 config has ricochet_bumpers and elevated_green mechanics', () => {
    const types = configs[3].mechanics.map(m => m.type);
    expect(types).toContain('ricochet_bumpers');
    expect(types).toContain('elevated_green');
  });

  it('H5 config has portal_gate mechanic', () => {
    const types = configs[4].mechanics.map(m => m.type);
    expect(types).toContain('portal_gate');
  });

  it('H6 config has timed_hazard mechanic', () => {
    const types = configs[5].mechanics.map(m => m.type);
    expect(types).toContain('timed_hazard');
  });

  it('H7 config has low_gravity_zone and bank_wall mechanics', () => {
    const types = configs[6].mechanics.map(m => m.type);
    expect(types).toContain('low_gravity_zone');
    expect(types).toContain('bank_wall');
  });

  it('H8 config has suction_zone and timed_gate mechanics', () => {
    const types = configs[7].mechanics.map(m => m.type);
    expect(types).toContain('suction_zone');
    expect(types).toContain('timed_gate');
  });

  it('H9 config has split_route, boost_strip, moving_sweeper, and elevated_green mechanics', () => {
    const types = configs[8].mechanics.map(m => m.type);
    expect(types).toContain('split_route');
    expect(types).toContain('boost_strip');
    expect(types).toContain('moving_sweeper');
    expect(types).toContain('elevated_green');
  });

  it('no config has an empty mechanics array', () => {
    configs.forEach((config, i) => {
      expect(config.mechanics.length).toBeGreaterThan(0);
    });
  });
});
