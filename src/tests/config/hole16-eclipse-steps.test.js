/**
 * Acceptance criteria tests for Hole 16 — Eclipse Steps (ISSUE-022).
 *
 * Validates the config matches the design spec:
 * - Par 4, index 15, multi_level_ramp + timed_gate mechanics
 * - 2 ramp segments connecting 3 elevation levels (0 → 2 → 4)
 * - timed_gate before final ascent with 1.5s open / 2.0s closed
 * - Cup on top platform at >= 3 units elevation
 */

import { createOrbitalDriftConfigs } from '../../config/orbitalDriftConfigs';

const configs = createOrbitalDriftConfigs();
const h16 = configs[15];

describe('Hole 16 — Eclipse Steps', () => {
  it('exists at index 15 with correct name and par', () => {
    expect(h16).toBeDefined();
    expect(h16.index).toBe(15);
    expect(h16.description).toBe('16. Eclipse Steps');
    expect(h16.par).toBe(4);
  });

  describe('multi_level_ramp segments', () => {
    const ramps = h16.mechanics.filter(m => m.type === 'multi_level_ramp');

    it('has at least 2 multi_level_ramp mechanics', () => {
      expect(ramps.length).toBeGreaterThanOrEqual(2);
    });

    it('defines ramp segments connecting 3 elevation levels', () => {
      const rampSegments = ramps.filter(r => Math.abs(r.endPosition[1] - r.startPosition[1]) > 0.5);
      expect(rampSegments.length).toBe(2);

      const elevations = new Set();
      rampSegments.forEach(r => {
        elevations.add(r.startPosition[1]);
        elevations.add(r.endPosition[1]);
      });
      expect(elevations.size).toBeGreaterThanOrEqual(3);
    });

    it('ramp 1 ascends from ground level to mid level', () => {
      const ramp1 = ramps.find(r => r.startPosition[1] < 1 && r.endPosition[1] >= 1.5);
      expect(ramp1).toBeDefined();
      expect(ramp1.width).toBeGreaterThanOrEqual(2);
    });

    it('ramp 2 ascends from mid level to top level', () => {
      const ramp2 = ramps.find(r => r.startPosition[1] >= 1.5 && r.endPosition[1] >= 3.5);
      expect(ramp2).toBeDefined();
      expect(ramp2.width).toBeGreaterThanOrEqual(2);
    });

    it('each ramp segment has valid width', () => {
      ramps.forEach(r => {
        expect(r.width).toBeGreaterThan(0);
      });
    });
  });

  describe('timed_gate', () => {
    const gates = h16.mechanics.filter(m => m.type === 'timed_gate');

    it('has exactly 1 timed_gate', () => {
      expect(gates).toHaveLength(1);
    });

    it('is positioned before the final ascent ramp', () => {
      const gate = gates[0];
      const ramp2 = h16.mechanics.find(
        m => m.type === 'multi_level_ramp' && m.startPosition[1] >= 1.5 && m.endPosition[1] >= 3.5
      );
      expect(gate.position[2]).toBeGreaterThanOrEqual(ramp2.startPosition[2]);
    });

    it('has correct open/closed durations', () => {
      const gate = gates[0];
      expect(gate.openDuration).toBe(1.5);
      expect(gate.closedDuration).toBe(2.0);
    });
  });

  describe('cup placement', () => {
    it('cup is at >= 3 units elevation', () => {
      expect(h16.holePosition[1]).toBeGreaterThanOrEqual(3);
    });

    it('cup is on the top platform area', () => {
      const topPlatforms = h16.mechanics.filter(
        m => m.type === 'multi_level_ramp' && m.startPosition[1] >= 3.5
      );
      expect(topPlatforms.length).toBeGreaterThanOrEqual(1);

      const topPlatform = topPlatforms[0];
      const cupZ = h16.holePosition[2];
      expect(cupZ).toBeLessThanOrEqual(topPlatform.startPosition[2]);
      expect(cupZ).toBeGreaterThanOrEqual(topPlatform.endPosition[2]);
    });
  });

  describe('layout dimensions', () => {
    it('has boundary shape with at least 4 points', () => {
      expect(h16.boundaryShape.length).toBeGreaterThanOrEqual(4);
    });

    it('horizontal footprint is roughly 20x10 units', () => {
      const xs = h16.boundaryShape.map(p => p[0]);
      const zs = h16.boundaryShape.map(p => p[1]);
      const width = Math.max(...xs) - Math.min(...xs);
      const length = Math.max(...zs) - Math.min(...zs);

      expect(width).toBeGreaterThanOrEqual(8);
      expect(width).toBeLessThanOrEqual(14);
      expect(length).toBeGreaterThanOrEqual(18);
      expect(length).toBeLessThanOrEqual(28);
    });
  });

  describe('no skip path', () => {
    it('ramp segments are sequential — no single ramp spans ground to top', () => {
      const ramps = h16.mechanics.filter(m => m.type === 'multi_level_ramp');
      const singleSpanRamp = ramps.find(r => r.startPosition[1] < 0.5 && r.endPosition[1] >= 3.5);
      expect(singleSpanRamp).toBeUndefined();
    });
  });
});
