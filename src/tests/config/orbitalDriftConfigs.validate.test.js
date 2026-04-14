/**
 * Validate orbitalDriftConfigs mechanics match design spec.
 *
 * Verifies each Orbital Drift hole config has the correct
 * mechanics types as specified in docs/course-infrastructure.md Section 7.
 */

import { createOrbitalDriftConfigs } from '../../config/orbitalDriftConfigs';

const configs = createOrbitalDriftConfigs();

// Design spec from docs/course-infrastructure.md Section 7
const DESIGN_SPEC = {
  H1: { index: 0, name: 'Launch Bay', requiredTypes: ['moving_sweeper'] },
  H2: { index: 1, name: 'Crater Rim', requiredTypes: ['bowl_contour'] },
  H3: { index: 2, name: 'Satellite Slingshot', requiredTypes: ['split_route', 'moving_sweeper'] },
  H4: {
    index: 3,
    name: 'Asteroid Belt Bounce',
    requiredTypes: ['ricochet_bumpers', 'elevated_green']
  },
  H5: { index: 4, name: 'Wormhole Transfer', requiredTypes: ['portal_gate'] },
  H6: { index: 5, name: 'Solar Flare Run', requiredTypes: ['timed_hazard'] },
  H7: { index: 6, name: 'Zero G Lab', requiredTypes: ['low_gravity_zone', 'bank_wall'] },
  H8: { index: 7, name: 'Event Horizon', requiredTypes: ['suction_zone', 'timed_gate'] },
  H9: {
    index: 8,
    name: 'Station Core Finale',
    requiredTypes: ['split_route', 'boost_strip', 'moving_sweeper', 'elevated_green']
  },
  H10: {
    index: 9,
    name: 'Laser Grid',
    requiredTypes: ['laser_grid']
  },
  H11: {
    index: 10,
    name: 'Blackout Corridor',
    requiredTypes: ['disappearing_platform', 'bank_wall']
  },
  H12: {
    index: 11,
    name: 'Gravity Well',
    requiredTypes: ['gravity_funnel']
  },
  H13: {
    index: 12,
    name: 'Debris Field',
    requiredTypes: ['ricochet_bumpers', 'timed_hazard']
  },
  H14: {
    index: 13,
    name: 'Reactor Bypass',
    requiredTypes: ['timed_hazard', 'boost_strip']
  },
  H15: {
    index: 14,
    name: 'Wormhole Relay',
    requiredTypes: ['portal_gate', 'timed_gate']
  },
  H16: {
    index: 15,
    name: 'Eclipse Steps',
    requiredTypes: ['multi_level_ramp', 'timed_gate']
  },
  H17: {
    index: 16,
    name: 'Comet Run',
    requiredTypes: ['boost_strip', 'moving_sweeper']
  },
  H18: {
    index: 17,
    name: 'Starforge Finale',
    requiredTypes: ['split_route', 'boost_strip', 'gravity_funnel', 'elevated_green']
  }
};

describe('Orbital Drift configs match design spec', () => {
  it('has exactly 18 hole configs', () => {
    expect(configs).toHaveLength(18);
  });

  it.each(Object.entries(DESIGN_SPEC))('%s (%s) has the required mechanic types', (hole, spec) => {
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
  });

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

  it('H3 config has name Satellite Slingshot and par 3', () => {
    expect(configs[2].description).toBe('3. Satellite Slingshot');
    expect(configs[2].par).toBe(3);
  });

  it('H3 split_route creates two distinct lanes from a fork point', () => {
    const splitRoute = configs[2].mechanics.find(m => m.type === 'split_route');
    expect(splitRoute).toBeDefined();
    expect(splitRoute.walls).toHaveLength(1);
    const wall = splitRoute.walls[0];
    expect(wall.start[2]).toBeGreaterThan(wall.end[2]);
    const wallLength = Math.abs(wall.start[2] - wall.end[2]);
    expect(wallLength).toBeGreaterThanOrEqual(6);
  });

  it('H3 moving_sweeper is on the direct (right) branch', () => {
    const sweeper = configs[2].mechanics.find(m => m.type === 'moving_sweeper');
    expect(sweeper).toBeDefined();
    expect(sweeper.pivot[0]).toBeGreaterThan(0);
  });

  it('H3 moving_sweeper has >= 2 second open window', () => {
    const sweeper = configs[2].mechanics.find(m => m.type === 'moving_sweeper');
    const speed = Math.abs(sweeper.speed);
    const armWidth = sweeper.size?.width || sweeper.armLength;
    const r = sweeper.armLength * 0.75;
    const angularArc = armWidth / r;
    const period = (2 * Math.PI) / speed;
    const gapTime = period - angularArc / speed;
    expect(gapTime).toBeGreaterThanOrEqual(2.0);
  });

  it('H3 both branches converge (cup is centered, reachable from both sides)', () => {
    const splitRoute = configs[2].mechanics.find(m => m.type === 'split_route');
    const wallEndZ = splitRoute.walls[0].end[2];
    const cupZ = configs[2].holePosition[2];
    expect(cupZ).toBeLessThan(wallEndZ);
  });

  it('H3 has satellite_dish hero prop near the route fork', () => {
    const dish = configs[2].heroProps.find(p => p.type === 'satellite_dish');
    expect(dish).toBeDefined();
    const splitRoute = configs[2].mechanics.find(m => m.type === 'split_route');
    const forkZ = splitRoute.walls[0].start[2];
    expect(Math.abs(dish.position[2] - forkZ)).toBeLessThanOrEqual(3);
  });

  it('H3 layout is approximately 18x10 units', () => {
    const xs = configs[2].boundaryShape.map(p => p[0]);
    const zs = configs[2].boundaryShape.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    expect(width).toBeGreaterThanOrEqual(10);
    expect(depth).toBeGreaterThanOrEqual(16);
  });

  it('H3 holeValidator reports 0 errors and 0 warnings', () => {
    const { validateHoleConfig } = require('../../utils/holeValidator');
    const issues = validateHoleConfig(configs[2]);
    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('H4 config has name Asteroid Belt Bounce and par 3', () => {
    expect(configs[3].description).toBe('4. Asteroid Belt Bounce');
    expect(configs[3].par).toBe(3);
  });

  it('H4 config has ricochet_bumpers and elevated_green mechanics', () => {
    const types = configs[3].mechanics.map(m => m.type);
    expect(types).toContain('ricochet_bumpers');
    expect(types).toContain('elevated_green');
  });

  it('H4 has 4-6 ricochet_bumper bodies', () => {
    const rb = configs[3].mechanics.find(m => m.type === 'ricochet_bumpers');
    expect(rb.bumpers.length).toBeGreaterThanOrEqual(4);
    expect(rb.bumpers.length).toBeLessThanOrEqual(6);
  });

  it('H4 bumpers are at least 1 unit from walls and from each other', () => {
    const rb = configs[3].mechanics.find(m => m.type === 'ricochet_bumpers');
    const xs = configs[3].boundaryShape.map(p => p[0]);
    const zs = configs[3].boundaryShape.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    for (const b of rb.bumpers) {
      const r = b.radius || 0.4;
      expect(b.position[0] - r - minX).toBeGreaterThanOrEqual(1);
      expect(maxX - b.position[0] - r).toBeGreaterThanOrEqual(1);
      expect(b.position[2] - r - minZ).toBeGreaterThanOrEqual(1);
      expect(maxZ - b.position[2] - r).toBeGreaterThanOrEqual(1);
    }

    for (let i = 0; i < rb.bumpers.length; i++) {
      for (let j = i + 1; j < rb.bumpers.length; j++) {
        const a = rb.bumpers[i];
        const bmp = rb.bumpers[j];
        const dx = a.position[0] - bmp.position[0];
        const dz = a.position[2] - bmp.position[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        expect(dist).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('H4 elevated_green raises cup platform above flat fairway', () => {
    const eg = configs[3].mechanics.find(m => m.type === 'elevated_green');
    expect(eg.elevation).toBeGreaterThan(0);
    expect(configs[3].holePosition[1]).toBe(eg.elevation);
  });

  it('H4 ramp connects flat section to elevated platform', () => {
    const eg = configs[3].mechanics.find(m => m.type === 'elevated_green');
    const rampStartZ = eg.ramp.start[2];
    const rampEndZ = eg.ramp.end[2];
    const platZ = eg.platform.position[2];
    const platHalfLen = eg.platform.length / 2;
    expect(rampEndZ).toBeGreaterThanOrEqual(platZ - platHalfLen);
    expect(rampEndZ).toBeLessThanOrEqual(platZ + platHalfLen);
    expect(rampStartZ).toBeGreaterThan(rampEndZ);
  });

  it('H4 cup is on the elevated platform', () => {
    const eg = configs[3].mechanics.find(m => m.type === 'elevated_green');
    const cupX = configs[3].holePosition[0];
    const cupZ = configs[3].holePosition[2];
    const platX = eg.platform.position[0];
    const platZ = eg.platform.position[2];
    expect(Math.abs(cupX - platX)).toBeLessThanOrEqual(eg.platform.width / 2);
    expect(Math.abs(cupZ - platZ)).toBeLessThanOrEqual(eg.platform.length / 2);
  });

  it('H4 layout is approximately 18x10 units', () => {
    const xs = configs[3].boundaryShape.map(p => p[0]);
    const zs = configs[3].boundaryShape.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    expect(width).toBeGreaterThanOrEqual(16);
    expect(width).toBeLessThanOrEqual(20);
    expect(depth).toBeGreaterThanOrEqual(8);
    expect(depth).toBeLessThanOrEqual(12);
  });

  it('H4 has asteroid_cluster hero props near bumper area', () => {
    const asteroids = configs[3].heroProps.filter(p => p.type === 'asteroid_cluster');
    expect(asteroids.length).toBeGreaterThanOrEqual(2);
    for (const a of asteroids) {
      expect(a.position).toBeDefined();
      expect(a.scale).toBeGreaterThan(0);
    }
  });

  it('H4 holeValidator reports 0 errors and 0 warnings', () => {
    const { validateHoleConfig } = require('../../utils/holeValidator');
    const issues = validateHoleConfig(configs[3]);
    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('H5 config has portal_gate mechanic', () => {
    const types = configs[4].mechanics.map(m => m.type);
    expect(types).toContain('portal_gate');
  });

  it('H6 config has timed_hazard mechanic', () => {
    const types = configs[5].mechanics.map(m => m.type);
    expect(types).toContain('timed_hazard');
  });

  it('H7 config has name Zero G Lab and par 2', () => {
    expect(configs[6].description).toBe('7. Zero G Lab');
    expect(configs[6].par).toBe(2);
  });

  it('H7 config has low_gravity_zone and bank_wall mechanics', () => {
    const types = configs[6].mechanics.map(m => m.type);
    expect(types).toContain('low_gravity_zone');
    expect(types).toContain('bank_wall');
  });

  it('H7 low_gravity_zone covers mid-section of fairway', () => {
    const lgz = configs[6].mechanics.find(m => m.type === 'low_gravity_zone');
    expect(lgz).toBeDefined();
    expect(lgz.radius).toBeGreaterThanOrEqual(3);
    expect(lgz.gravityMultiplier).toBeLessThan(0.5);
    const startZ = configs[6].startPosition[2];
    const holeZ = configs[6].holePosition[2];
    const midZ = (startZ + holeZ) / 2;
    expect(Math.abs(lgz.position[2] - midZ)).toBeLessThanOrEqual(2);
  });

  it('H7 has at least one bank_wall on an adjacent side', () => {
    const bw = configs[6].mechanics.find(m => m.type === 'bank_wall');
    expect(bw).toBeDefined();
    expect(bw.segments.length).toBeGreaterThanOrEqual(1);
    expect(bw.restitution).toBeGreaterThanOrEqual(0.7);
  });

  it('H7 layout is approximately 14x8 units', () => {
    const xs = configs[6].boundaryShape.map(p => p[0]);
    const zs = configs[6].boundaryShape.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    expect(width).toBeGreaterThanOrEqual(6);
    expect(width).toBeLessThanOrEqual(10);
    expect(depth).toBeGreaterThanOrEqual(12);
    expect(depth).toBeLessThanOrEqual(16);
  });

  it('H7 has floating particle hero props in zone area', () => {
    const zoneProps = configs[6].heroProps.filter(p => p.type === 'gravity_vortex');
    expect(zoneProps.length).toBeGreaterThanOrEqual(2);
    const lgz = configs[6].mechanics.find(m => m.type === 'low_gravity_zone');
    for (const prop of zoneProps) {
      const dx = prop.position[0] - lgz.position[0];
      const dz = prop.position[2] - lgz.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist).toBeLessThanOrEqual(lgz.radius + 1);
    }
  });

  it('H7 has glowing lab props on perimeter', () => {
    const labProps = configs[6].heroProps.filter(
      p => p.type === 'lab_equipment' || p.type === 'energy_collector'
    );
    expect(labProps.length).toBeGreaterThanOrEqual(2);
    const xs = configs[6].boundaryShape.map(p => p[0]);
    const maxX = Math.max(...xs);
    for (const prop of labProps) {
      expect(Math.abs(prop.position[0])).toBeGreaterThanOrEqual(maxX);
    }
  });

  it('H7 direct route through zone is short enough for par', () => {
    const start = configs[6].startPosition;
    const hole = configs[6].holePosition;
    const dx = start[0] - hole[0];
    const dz = start[2] - hole[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    expect(dist).toBeLessThanOrEqual(14);
  });

  it('H7 holeValidator reports 0 errors and 0 warnings', () => {
    const { validateHoleConfig } = require('../../utils/holeValidator');
    const issues = validateHoleConfig(configs[6]);
    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
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

  it('H10 config has laser_grid mechanic', () => {
    const types = configs[9].mechanics.map(m => m.type);
    expect(types).toContain('laser_grid');
  });

  it('H10 config has two laser_grid entries with different offsets', () => {
    const laserMechanics = configs[9].mechanics.filter(m => m.type === 'laser_grid');
    expect(laserMechanics).toHaveLength(2);
    const offsets = laserMechanics.map(m => m.offset);
    expect(offsets).toContain(0);
    expect(offsets).toContain(0.5);
  });

  it('H10 config has par 3 and name Laser Grid', () => {
    expect(configs[9].par).toBe(3);
    expect(configs[9].description).toBe('10. Laser Grid');
  });

  // H11: Blackout Corridor acceptance criteria

  it('H11 config has index 10, par 3, and name Blackout Corridor', () => {
    expect(configs[10].index).toBe(10);
    expect(configs[10].par).toBe(3);
    expect(configs[10].description).toBe('11. Blackout Corridor');
  });

  it('H11 config has disappearing_platform and bank_wall mechanics', () => {
    const types = configs[10].mechanics.map(m => m.type);
    expect(types).toContain('disappearing_platform');
    expect(types).toContain('bank_wall');
  });

  it('H11 has two disappearing_platform mechanics with different offsets', () => {
    const platforms = configs[10].mechanics.filter(m => m.type === 'disappearing_platform');
    expect(platforms).toHaveLength(2);
    const offset1 = platforms[0].platforms[0].offset;
    const offset2 = platforms[1].platforms[0].offset;
    expect(offset1).not.toBe(offset2);
  });

  it('H11 disappearing_platform timings match spec (1.5s on / 1.0s off)', () => {
    const platforms = configs[10].mechanics.filter(m => m.type === 'disappearing_platform');
    for (const dp of platforms) {
      expect(dp.platforms[0].onDuration).toBe(1.5);
      expect(dp.platforms[0].offDuration).toBe(1.0);
    }
  });

  it('H11 platforms are at ~8u and ~14u from spawn', () => {
    const spawnZ = configs[10].startPosition[2];
    const platforms = configs[10].mechanics.filter(m => m.type === 'disappearing_platform');
    const dists = platforms.map(dp => Math.abs(spawnZ - dp.platforms[0].position[2]));
    dists.sort((a, b) => a - b);
    expect(dists[0]).toBeGreaterThanOrEqual(6);
    expect(dists[0]).toBeLessThanOrEqual(10);
    expect(dists[1]).toBeGreaterThanOrEqual(12);
    expect(dists[1]).toBeLessThanOrEqual(16);
  });

  it('H11 has two bank_wall mechanics at the S-curve bends', () => {
    const bankWalls = configs[10].mechanics.filter(m => m.type === 'bank_wall');
    expect(bankWalls).toHaveLength(2);
    for (const bw of bankWalls) {
      expect(bw.segments.length).toBeGreaterThanOrEqual(1);
      expect(bw.restitution).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('H11 cup is ~18 units from spawn', () => {
    const start = configs[10].startPosition;
    const hole = configs[10].holePosition;
    const dist = Math.abs(start[2] - hole[2]);
    expect(dist).toBeGreaterThanOrEqual(16);
    expect(dist).toBeLessThanOrEqual(20);
  });

  it('H11 boundary forms an S-curve (not a simple rectangle)', () => {
    const xs = configs[10].boundaryShape.map(p => p[0]);
    const uniqueXs = [...new Set(xs)];
    // An S-curve has more than 2 unique x values (unlike a rectangle)
    expect(uniqueXs.length).toBeGreaterThan(2);
  });

  it('H11 holeValidator reports 0 errors and 0 warnings', () => {
    const { validateHoleConfig } = require('../../utils/holeValidator');
    const issues = validateHoleConfig(configs[10]);
    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  // H13: Debris Field acceptance criteria

  it('H13 config has index 12, par 4, and name Debris Field', () => {
    expect(configs[12].index).toBe(12);
    expect(configs[12].par).toBe(4);
    expect(configs[12].description).toBe('13. Debris Field');
  });

  it('H13 config has ricochet_bumpers and timed_hazard mechanics', () => {
    const types = configs[12].mechanics.map(m => m.type);
    expect(types).toContain('ricochet_bumpers');
    expect(types).toContain('timed_hazard');
  });

  it('H13 has 6-8 ricochet_bumper entries with asymmetric non-grid positioning', () => {
    const rb = configs[12].mechanics.find(m => m.type === 'ricochet_bumpers');
    expect(rb.bumpers.length).toBeGreaterThanOrEqual(6);
    expect(rb.bumpers.length).toBeLessThanOrEqual(8);

    const xs = rb.bumpers.map(b => b.position[0]);
    const zs = rb.bumpers.map(b => b.position[2]);
    const uniqueXs = [...new Set(xs)];
    const uniqueZs = [...new Set(zs)];
    expect(uniqueXs.length).toBeGreaterThanOrEqual(5);
    expect(uniqueZs.length).toBeGreaterThanOrEqual(5);
  });

  it('H13 bumpers use mixed geometry types (non-uniform asteroid aesthetic)', () => {
    const rb = configs[12].mechanics.find(m => m.type === 'ricochet_bumpers');
    const geometries = [...new Set(rb.bumpers.map(b => b.geometry))];
    expect(geometries.length).toBeGreaterThanOrEqual(2);
  });

  it('H13 bumpers have varied radii', () => {
    const rb = configs[12].mechanics.find(m => m.type === 'ricochet_bumpers');
    const radii = [...new Set(rb.bumpers.map(b => b.radius))];
    expect(radii.length).toBeGreaterThanOrEqual(3);
  });

  it('H13 has two timed_hazard zones near the cup approach corridor', () => {
    const hazards = configs[12].mechanics.filter(m => m.type === 'timed_hazard');
    expect(hazards).toHaveLength(2);

    const cupZ = configs[12].holePosition[2];
    for (const h of hazards) {
      const dist = Math.abs(h.position[2] - cupZ);
      expect(dist).toBeLessThanOrEqual(3);
    }
  });

  it('H13 timed_hazards have correct durations and staggered phases', () => {
    const hazards = configs[12].mechanics.filter(m => m.type === 'timed_hazard');
    for (const h of hazards) {
      expect(h.onDuration).toBe(1.8);
      expect(h.offDuration).toBe(1.2);
    }
    expect(hazards[0].phase).not.toBe(hazards[1].phase);
  });

  it('H13 bumpers are at least 1 unit from walls and from each other', () => {
    const rb = configs[12].mechanics.find(m => m.type === 'ricochet_bumpers');
    const xs = configs[12].boundaryShape.map(p => p[0]);
    const zs = configs[12].boundaryShape.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    for (const b of rb.bumpers) {
      const r = b.radius || 0.4;
      expect(b.position[0] - r - minX).toBeGreaterThanOrEqual(1);
      expect(maxX - b.position[0] - r).toBeGreaterThanOrEqual(1);
      expect(b.position[2] - r - minZ).toBeGreaterThanOrEqual(1);
      expect(maxZ - b.position[2] - r).toBeGreaterThanOrEqual(1);
    }

    for (let i = 0; i < rb.bumpers.length; i++) {
      for (let j = i + 1; j < rb.bumpers.length; j++) {
        const a = rb.bumpers[i];
        const bmp = rb.bumpers[j];
        const dx = a.position[0] - bmp.position[0];
        const dz = a.position[2] - bmp.position[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        expect(dist).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('H13 layout is approximately 22x16 units', () => {
    const xs = configs[12].boundaryShape.map(p => p[0]);
    const zs = configs[12].boundaryShape.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    expect(width).toBeGreaterThanOrEqual(20);
    expect(width).toBeLessThanOrEqual(24);
    expect(depth).toBeGreaterThanOrEqual(14);
    expect(depth).toBeLessThanOrEqual(18);
  });

  it('H13 cup is reachable in 3-4 strokes (distance ~14 units from start)', () => {
    const start = configs[12].startPosition;
    const hole = configs[12].holePosition;
    const dx = start[0] - hole[0];
    const dz = start[2] - hole[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    expect(dist).toBeGreaterThanOrEqual(12);
    expect(dist).toBeLessThanOrEqual(16);
  });

  it('H13 holeValidator reports 0 errors and 0 warnings', () => {
    const { validateHoleConfig } = require('../../utils/holeValidator');
    const issues = validateHoleConfig(configs[12]);
    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('H12 config has gravity_funnel mechanic', () => {
    const types = configs[11].mechanics.map(m => m.type);
    expect(types).toContain('gravity_funnel');
  });

  it('H12 config has par 4 and name Gravity Well', () => {
    expect(configs[11].par).toBe(4);
    expect(configs[11].description).toBe('12. Gravity Well');
  });

  it('H12 gravity_funnel has force >= 5.0 and radius 6', () => {
    const funnel = configs[11].mechanics.find(m => m.type === 'gravity_funnel');
    expect(funnel).toBeDefined();
    expect(funnel.force).toBeGreaterThanOrEqual(5.0);
    expect(funnel.radius).toBe(6);
  });

  it('H12 layout is at least 20 units wide', () => {
    const xs = configs[11].boundaryShape.map(p => p[0]);
    const zs = configs[11].boundaryShape.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    expect(width).toBeGreaterThanOrEqual(20);
    expect(depth).toBeGreaterThanOrEqual(20);
  });

  it('H15 config has par 4 and name Wormhole Relay', () => {
    expect(configs[14].par).toBe(4);
    expect(configs[14].description).toBe('15. Wormhole Relay');
  });

  it('H15 config has index 14', () => {
    expect(configs[14].index).toBe(14);
  });

  it('H15 config has two portal_gate mechanics', () => {
    const portalMechanics = configs[14].mechanics.filter(m => m.type === 'portal_gate');
    expect(portalMechanics).toHaveLength(2);
  });

  it('H15 portal_gate pairs have sequential entry/exit positions', () => {
    const portals = configs[14].mechanics.filter(m => m.type === 'portal_gate');
    // Portal A entry z > Portal A exit z (teleports forward)
    expect(portals[0].entryPosition[2]).toBeGreaterThan(portals[0].exitPosition[2]);
    // Portal C entry z > Portal C exit z (teleports forward)
    expect(portals[1].entryPosition[2]).toBeGreaterThan(portals[1].exitPosition[2]);
    // Portal A exit z > Portal C entry z (sequential chambers)
    expect(portals[0].exitPosition[2]).toBeGreaterThan(portals[1].entryPosition[2]);
  });

  it('H15 config has timed_gate mechanic with 1.5s cycle', () => {
    const gate = configs[14].mechanics.find(m => m.type === 'timed_gate');
    expect(gate).toBeDefined();
    expect(gate.openDuration).toBe(1.5);
    expect(gate.closedDuration).toBe(1.5);
  });

  it('H15 timed_gate is positioned between the two portal pairs', () => {
    const portals = configs[14].mechanics.filter(m => m.type === 'portal_gate');
    const gate = configs[14].mechanics.find(m => m.type === 'timed_gate');
    // Gate z is between Portal A exit z and Portal C entry z
    expect(gate.position[2]).toBeLessThan(portals[0].exitPosition[2]);
    expect(gate.position[2]).toBeGreaterThan(portals[1].entryPosition[2]);
  });

  it('H15 cup is at far end of Chamber 3', () => {
    const holeZ = configs[14].holePosition[2];
    const startZ = configs[14].startPosition[2];
    // Cup is far from start (at least 20 units apart)
    expect(Math.abs(startZ - holeZ)).toBeGreaterThanOrEqual(20);
  });

  it('no config has an empty mechanics array', () => {
    configs.forEach((config, _i) => {
      expect(config.mechanics.length).toBeGreaterThan(0);
    });
  });

  // H17: Comet Run acceptance criteria

  it('H17 config has index 16, par 3, and name Comet Run', () => {
    expect(configs[16].index).toBe(16);
    expect(configs[16].par).toBe(3);
    expect(configs[16].description).toBe('17. Comet Run');
  });

  it('H17 has two boost_strip mechanics along the lane', () => {
    const boosts = configs[16].mechanics.filter(m => m.type === 'boost_strip');
    expect(boosts).toHaveLength(2);
  });

  it('H17 boost_strips are at roughly 1/3 and 2/3 positions', () => {
    const startZ = configs[16].startPosition[2];
    const holeZ = configs[16].holePosition[2];
    const laneLength = Math.abs(startZ - holeZ);
    const boosts = configs[16].mechanics.filter(m => m.type === 'boost_strip');
    const boostDists = boosts.map(b => Math.abs(startZ - b.position[2])).sort((a, b) => a - b);
    expect(boostDists[0]).toBeGreaterThanOrEqual(laneLength * 0.2);
    expect(boostDists[0]).toBeLessThanOrEqual(laneLength * 0.55);
    expect(boostDists[1]).toBeGreaterThanOrEqual(laneLength * 0.6);
    expect(boostDists[1]).toBeLessThanOrEqual(laneLength * 0.95);
  });

  it('H17 has two moving_sweeper mechanics at elevated speed', () => {
    const sweepers = configs[16].mechanics.filter(m => m.type === 'moving_sweeper');
    expect(sweepers).toHaveLength(2);
    for (const s of sweepers) {
      expect(s.speed).toBeGreaterThanOrEqual(2.0);
    }
  });

  it('H17 sweepers are positioned before each boost strip', () => {
    const startZ = configs[16].startPosition[2];
    const sweepers = configs[16].mechanics.filter(m => m.type === 'moving_sweeper');
    const boosts = configs[16].mechanics.filter(m => m.type === 'boost_strip');
    const sweeperZs = sweepers.map(s => s.pivot[2]).sort((a, b) => b - a);
    const boostZs = boosts.map(b => b.position[2]).sort((a, b) => b - a);
    for (let i = 0; i < sweeperZs.length; i++) {
      const distFromStart = Math.abs(startZ - sweeperZs[i]);
      const boostDistFromStart = Math.abs(startZ - boostZs[i]);
      expect(distFromStart).toBeLessThan(boostDistFromStart);
    }
  });

  it('H17 lane is straight and narrow (~4 units wide)', () => {
    const xs = configs[16].boundaryShape.map(p => p[0]);
    const width = Math.max(...xs) - Math.min(...xs);
    expect(width).toBe(4);
  });

  it('H17 lane is ~24 units long', () => {
    const zs = configs[16].boundaryShape.map(p => p[1]);
    const depth = Math.max(...zs) - Math.min(...zs);
    expect(depth).toBeGreaterThanOrEqual(22);
    expect(depth).toBeLessThanOrEqual(26);
  });

  it('H17 cup is ~22 units from start', () => {
    const start = configs[16].startPosition;
    const hole = configs[16].holePosition;
    const dist = Math.abs(start[2] - hole[2]);
    expect(dist).toBe(22);
  });

  it('H17 boost_strips have emissive color for glow rendering', () => {
    const boosts = configs[16].mechanics.filter(m => m.type === 'boost_strip');
    for (const b of boosts) {
      expect(b.color).toBeDefined();
    }
  });

  it('H17 holeValidator reports 0 errors and 0 warnings', () => {
    const { validateHoleConfig } = require('../../utils/holeValidator');
    const issues = validateHoleConfig(configs[16]);
    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  // H18: Starforge Finale acceptance criteria

  it('H18 config has index 17, par 5, and name Starforge Finale', () => {
    expect(configs[17].index).toBe(17);
    expect(configs[17].par).toBe(5);
    expect(configs[17].description).toBe('18. Starforge Finale');
  });

  it('H18 config has split_route, boost_strip, gravity_funnel, and elevated_green mechanics', () => {
    const types = configs[17].mechanics.map(m => m.type);
    expect(types).toContain('split_route');
    expect(types).toContain('boost_strip');
    expect(types).toContain('gravity_funnel');
    expect(types).toContain('elevated_green');
  });

  it('H18 split_route forks path ~6 units from spawn', () => {
    const splitRoute = configs[17].mechanics.find(m => m.type === 'split_route');
    expect(splitRoute).toBeDefined();
    expect(splitRoute.walls).toHaveLength(1);
    const wallStartZ = splitRoute.walls[0].start[2];
    const wallEndZ = splitRoute.walls[0].end[2];
    const spawnZ = configs[17].startPosition[2];
    const forkDistance = Math.abs(spawnZ - wallEndZ);
    expect(forkDistance).toBeGreaterThanOrEqual(4);
    expect(forkDistance).toBeLessThanOrEqual(10);
    expect(wallStartZ).toBeGreaterThan(wallEndZ);
  });

  it('H18 boost_strip is on right side (Route A) with positive x position', () => {
    const boost = configs[17].mechanics.find(m => m.type === 'boost_strip');
    expect(boost).toBeDefined();
    expect(boost.position[0]).toBeGreaterThan(0);
    expect(boost.force).toBeGreaterThanOrEqual(8);
  });

  it('H18 gravity_funnel has force >= 4.0 and is in Stage 2 corridor', () => {
    const funnel = configs[17].mechanics.find(m => m.type === 'gravity_funnel');
    expect(funnel).toBeDefined();
    expect(funnel.force).toBeGreaterThanOrEqual(4.0);
    expect(funnel.radius).toBeGreaterThanOrEqual(4);
    const funnelZ = funnel.position[2];
    expect(funnelZ).toBeLessThan(-6);
    expect(funnelZ).toBeGreaterThan(-20);
  });

  it('H18 elevated_green platform is >= 2.5 units above ground', () => {
    const eg = configs[17].mechanics.find(m => m.type === 'elevated_green');
    expect(eg).toBeDefined();
    expect(eg.elevation).toBeGreaterThanOrEqual(2.5);
  });

  it('H18 cup is on elevated green platform', () => {
    const holePos = configs[17].holePosition;
    expect(holePos[1]).toBeGreaterThanOrEqual(2.5);
    const eg = configs[17].mechanics.find(m => m.type === 'elevated_green');
    expect(holePos[2]).toBe(eg.platform.position[2]);
  });

  it('H18 both routes converge into Stage 2 (gravity funnel reachable from both sides)', () => {
    const funnel = configs[17].mechanics.find(m => m.type === 'gravity_funnel');
    const splitRoute = configs[17].mechanics.find(m => m.type === 'split_route');
    const funnelZ = funnel.position[2];
    const wallEndZ = splitRoute.walls[0].end[2];
    expect(funnelZ).toBeLessThan(wallEndZ);
  });

  it('H18 layout spans ~30x20 units total', () => {
    const xs = configs[17].boundaryShape.map(p => p[0]);
    const zs = configs[17].boundaryShape.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    expect(width).toBeGreaterThanOrEqual(12);
    expect(depth).toBeGreaterThanOrEqual(28);
  });

  it('H18 has camera preset showing all three stages from above', () => {
    const hint = configs[17].cameraHint;
    expect(hint).toBeDefined();
    expect(hint.offset).toBeDefined();
    expect(hint.lookAt).toBeDefined();
    expect(hint.offset[1]).toBeGreaterThanOrEqual(25);
  });

  it('H18 front nine par totals 24', () => {
    const frontNine = configs.filter(c => c.index <= 8);
    const frontPar = frontNine.reduce((sum, c) => sum + c.par, 0);
    expect(frontPar).toBe(24);
  });

  it('H18 back nine par totals 33', () => {
    const backNine = configs.filter(c => c.index >= 9);
    const backPar = backNine.reduce((sum, c) => sum + c.par, 0);
    expect(backPar).toBe(33);
  });

  it('full course par total (indices 0-17) sums to 57', () => {
    expect(configs).toHaveLength(18);
    const totalPar = configs.reduce((sum, c) => sum + c.par, 0);
    expect(totalPar).toBe(57);
  });

  it('validateHoleConfig returns 0 errors and 0 warnings for H18', () => {
    const { validateHoleConfig } = require('../../utils/holeValidator');
    const issues = validateHoleConfig(configs[17]);
    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
