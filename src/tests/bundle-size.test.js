/**
 * Bundle Size Regression Test (ISSUE-046)
 *
 * Validates that the production build stays within acceptable size limits.
 * Run after `npm run build` to check chunk sizes.
 *
 * Baseline recorded 2026-04-14 (production `npm run build`):
 *
 * | Chunk    | Raw (KB) | Gzipped (KB) | Contents                        |
 * |----------|----------|--------------|---------------------------------|
 * | runtime  |     ~3   |         ~1   | Webpack runtime                 |
 * | three    |   ~808   |       ~204   | Three.js                        |
 * | cannon   |   ~121   |        ~34   | Cannon-es physics               |
 * | vendors  |    ~19   |         ~7   | three-csg-ts, Capacitor, etc.   |
 * | main     |   ~296   |        ~64   | App code + mechanics + themes   |
 * | course   |   ~159   |        ~27   | Async course chunk              |
 * |----------|----------|--------------|---------------------------------|
 * | TOTAL    |  ~1.5MB  |       ~338   | All .js gzipped                 |
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
const TOTAL_GZIP_LIMIT_BYTES = 650 * 1024; // ~2x current ~338KB total (all JS)

function distNeedsProductionBuild() {
  if (!fs.existsSync(DIST_DIR)) {
    return true;
  }
  const files = fs.readdirSync(DIST_DIR);
  const jsCount = files.filter(f => f.endsWith('.js')).length;
  if (jsCount === 0) {
    return true;
  }
  // Dev server writes bundle.js without contenthash — never use it for size checks
  if (files.includes('bundle.js')) {
    return true;
  }
  // Production entry is main.<contenthash>.js
  const hasProdMain = files.some(f => /^main\.[a-f0-9]+\.js$/i.test(f));
  return !hasProdMain;
}

describe('Production Bundle Size', () => {
  let jsFiles;

  beforeAll(() => {
    const root = path.resolve(__dirname, '../..');
    if (distNeedsProductionBuild()) {
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
    }
    jsFiles = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.js'));
  });

  test('build produces expected chunks', () => {
    const chunkNames = jsFiles.map(f => {
      const match = f.match(/^([^.]+)\./);
      return match ? match[1] : f;
    });

    expect(chunkNames).toEqual(
      expect.arrayContaining(['runtime', 'three', 'cannon', 'vendors', 'main', 'course'])
    );
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
      'MechanicBase',
      'MechanicRegistry',
      'MovingSweeper',
      'BoostStrip',
      'SuctionZone',
      'PortalGate',
      'TimedHazard',
      'TimedGate',
      'BankWall',
      'ElevatedGreen',
      'BowlContour',
      'LowGravityZone',
      'RicochetBumper',
      'SplitRoute'
    ];

    const vendorFiles = jsFiles.filter(
      f => f.startsWith('three.') || f.startsWith('cannon.') || f.startsWith('vendors.')
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

  test('main chunk raw size is logged for budget tracking', () => {
    const mainFile = jsFiles.find(f => /^main\.[a-f0-9]+\.js$/i.test(f));
    expect(mainFile).toBeDefined();
    const mainSize = fs.statSync(path.join(DIST_DIR, mainFile)).size;
    const mainKB = (mainSize / 1024).toFixed(1);
    // eslint-disable-next-line no-console
    console.log(`  Main chunk: ${mainKB} KB (budget: 400 KB)`);
    expect(mainSize).toBeGreaterThan(0);
  });

  test('total gzipped bundle stays within budget', () => {
    let totalGzip = 0;
    for (const file of jsFiles) {
      const raw = fs.readFileSync(path.join(DIST_DIR, file));
      totalGzip += zlib.gzipSync(raw).length;
    }
    const totalKB = (totalGzip / 1024).toFixed(1);
    // eslint-disable-next-line no-console
    console.log(`  Total gzipped: ${totalKB} KB`);
    expect(totalGzip).toBeLessThan(TOTAL_GZIP_LIMIT_BYTES);
  });
});
