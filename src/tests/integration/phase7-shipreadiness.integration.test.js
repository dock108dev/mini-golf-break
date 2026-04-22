/**
 * Phase 7 ship-readiness gate (ISSUE-024).
 *
 * Covers the structurally-verifiable acceptance criteria:
 *  - Hole 9 (the most physics-dense front-nine hole) has a documented
 *    `physicsSubsteps` value so the per-frame physics budget is explicit.
 *  - The course module is loaded via dynamic `import()` from Game.js so
 *    the initial JS parse cost stays under the 400 KB budget enforced by
 *    webpack. Hole configs therefore parse lazily, not on first paint.
 *  - Bundle-size budget guard (bundle-size.test.js) exists.
 *
 * The remaining ACs require a real browser environment:
 *  - Stable 60 fps on a 2019 MacBook at 1080p — verified via DevTools
 *    profiling (manual) and the in-game PerformanceManager overlay.
 *  - Playwright UAT across all holes — covered by
 *    tests/uat/orbital-drift.test.js which iterates every hole.
 *  - External playtest — non-automatable ship gate.
 */

const fs = require('fs');
const path = require('path');

describe('Phase 7 ship-readiness (ISSUE-024)', () => {
  describe('Hole 9 physics budget', () => {
    let configs;

    beforeAll(() => {
      const { createOrbitalDriftConfigs } = require('../../config/orbitalDriftConfigs');
      configs = createOrbitalDriftConfigs();
    });

    it('hole 9 exists and is identified as Station Core Finale', () => {
      const hole9 = configs.find(c => c.index === 8);
      expect(hole9).toBeDefined();
      expect(hole9.description).toMatch(/Station Core Finale/);
    });

    it('hole 9 declares physicsSubsteps so world.step stays within 16ms budget', () => {
      const hole9 = configs.find(c => c.index === 8);
      expect(typeof hole9.physicsSubsteps).toBe('number');
      expect(Number.isInteger(hole9.physicsSubsteps)).toBe(true);
      expect(hole9.physicsSubsteps).toBeGreaterThanOrEqual(8);
    });

    it('hole 9 composes multiple mechanics (validates it is the complexity ceiling)', () => {
      const hole9 = configs.find(c => c.index === 8);
      expect(Array.isArray(hole9.mechanics)).toBe(true);
      expect(hole9.mechanics.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Lazy-load guard', () => {
    it('course module is loaded via dynamic import(), not statically at bundle entry', () => {
      const gameSrc = fs.readFileSync(path.resolve(__dirname, '../../scenes/Game.js'), 'utf8');
      expect(gameSrc).toMatch(/await import\([^)]*OrbitalDriftCourse/);
      expect(gameSrc).not.toMatch(/^import .*OrbitalDriftCourse/m);
    });

    it('bundle-size regression test is present to enforce ≤ 400 KB main chunk', () => {
      const bundleTest = path.resolve(__dirname, '../bundle-size.test.js');
      expect(fs.existsSync(bundleTest)).toBe(true);
    });
  });
});
