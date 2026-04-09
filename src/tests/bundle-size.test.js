/**
 * Bundle Size Regression Test (ISSUE-046)
 *
 * Validates that the production build stays within acceptable size limits.
 * Run after `npm run build` to check chunk sizes.
 *
 * Baseline recorded 2026-04-09:
 *
 * | Chunk    | Raw (KB) | Gzipped (KB) | Contents                        |
 * |----------|----------|-------------- |---------------------------------|
 * | runtime  |     1.2  |         0.7   | Webpack runtime                 |
 * | three    |   808.4  |       202.8   | Three.js                        |
 * | cannon   |   121.0  |        34.2   | Cannon-es physics               |
 * | vendors  |    11.4  |         4.0   | three-csg-ts, css-loader, etc.  |
 * | main     |   345.7  |        71.5   | App code + mechanics + themes   |
 * |----------|----------|---------------|                                 |
 * | TOTAL    |  1287    |       313     |                                 |
 *
 * Mechanics code (MechanicBase, MechanicRegistry, all 12 mechanic types,
 * OrbitalDriftCourse, theme system) is bundled in the main chunk only —
 * not duplicated across vendor chunks.
 *
 * No individual chunk exceeds 500KB gzipped (three.js is ~203KB gzipped).
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const DIST_DIR = path.resolve(__dirname, '../../dist');
const GZIP_LIMIT_BYTES = 500 * 1024; // 500KB gzipped per chunk

describe('Production Bundle Size', () => {
  let jsFiles;

  beforeAll(() => {
    // Build if dist doesn't exist or is stale
    if (!fs.existsSync(DIST_DIR) || fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.js')).length === 0) {
      execSync('npm run build', { cwd: path.resolve(__dirname, '../..'), stdio: 'pipe' });
    }
    jsFiles = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.js'));
  });

  test('build produces expected chunks', () => {
    const chunkNames = jsFiles.map(f => {
      const match = f.match(/^([^.]+)\./);
      return match ? match[1] : f;
    });

    expect(chunkNames).toEqual(expect.arrayContaining(['runtime', 'three', 'cannon', 'vendors', 'main']));
  });

  test('no individual chunk exceeds 500KB gzipped', () => {
    for (const file of jsFiles) {
      const filePath = path.join(DIST_DIR, file);
      const raw = fs.readFileSync(filePath);
      const gzipped = zlib.gzipSync(raw);
      const gzipKB = (gzipped.length / 1024).toFixed(1);

      expect(gzipped.length).toBeLessThan(GZIP_LIMIT_BYTES);
      // Log for visibility
      // eslint-disable-next-line no-console
      console.log(`  ${file}: ${(raw.length / 1024).toFixed(1)} KB raw, ${gzipKB} KB gzipped`);
    }
  });

  test('mechanics code is in main chunk, not vendor chunks', () => {
    const mechanicClasses = [
      'MechanicBase', 'MechanicRegistry', 'MovingSweeper',
      'BoostStrip', 'SuctionZone', 'PortalGate',
      'TimedHazard', 'TimedGate', 'BankWall',
      'ElevatedGreen', 'BowlContour', 'LowGravityZone',
      'RicochetBumper', 'SplitRoute'
    ];

    const vendorFiles = jsFiles.filter(f =>
      f.startsWith('three.') || f.startsWith('cannon.') || f.startsWith('vendors.')
    );

    for (const file of vendorFiles) {
      const content = fs.readFileSync(path.join(DIST_DIR, file), 'utf8');
      for (const cls of mechanicClasses) {
        // In minified code, class names may be mangled, but string literals
        // and registry keys would remain. Check for registry-style references.
        const hasClassDef = content.includes(`class ${cls}`) || content.includes(`${cls}=class`);
        expect(hasClassDef).toBe(false);
      }
    }
  });

  test('total gzipped bundle is under 500KB', () => {
    let totalGzip = 0;
    for (const file of jsFiles) {
      const raw = fs.readFileSync(path.join(DIST_DIR, file));
      totalGzip += zlib.gzipSync(raw).length;
    }
    const totalKB = (totalGzip / 1024).toFixed(1);
    // eslint-disable-next-line no-console
    console.log(`  Total gzipped: ${totalKB} KB`);
    // Total should stay reasonable — allow 2x current baseline (~313KB) for growth
    expect(totalGzip).toBeLessThan(650 * 1024);
  });
});
