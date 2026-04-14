const fs = require('fs');
const path = require('path');

describe('iOS Safe-Area Inset Handling', () => {
  const publicDir = path.resolve(__dirname, '../../public');
  let indexHtml;
  let styleCss;

  beforeAll(() => {
    indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
    styleCss = fs.readFileSync(path.join(publicDir, 'style.css'), 'utf8');
  });

  describe('viewport meta tag', () => {
    test('includes viewport-fit=cover for full-screen rendering on notched devices', () => {
      expect(indexHtml).toMatch(/viewport-fit=cover/);
    });

    test('includes standard mobile viewport settings', () => {
      expect(indexHtml).toMatch(/width=device-width/);
      expect(indexHtml).toMatch(/initial-scale=1/);
      expect(indexHtml).toMatch(/user-scalable=no/);
    });
  });

  describe('HUD elements respect safe-area insets', () => {
    test('top-right score container uses safe-area-inset-top and safe-area-inset-right', () => {
      const topRightMatch = styleCss.match(/\.top-right-container\s*\{[^}]*\}/s);
      expect(topRightMatch).not.toBeNull();
      const block = topRightMatch[0];
      expect(block).toContain('env(safe-area-inset-top)');
      expect(block).toContain('env(safe-area-inset-right)');
    });

    test('pause button uses safe-area-inset-top and safe-area-inset-left', () => {
      const pauseMatch = styleCss.match(/\.pause-button\s*\{[^}]*\}/s);
      expect(pauseMatch).not.toBeNull();
      const block = pauseMatch[0];
      expect(block).toContain('env(safe-area-inset-top)');
      expect(block).toContain('env(safe-area-inset-left)');
    });

    test('mute button uses safe-area-inset-top and safe-area-inset-left', () => {
      const muteMatch = styleCss.match(/\.mute-button\s*\{[^}]*\}/s);
      expect(muteMatch).not.toBeNull();
      const block = muteMatch[0];
      expect(block).toContain('env(safe-area-inset-top)');
      expect(block).toContain('env(safe-area-inset-left)');
    });

    test('stuck reset button uses safe-area-inset-bottom', () => {
      const stuckMatch = styleCss.match(/\.stuck-reset-button\s*\{[^}]*\}/s);
      expect(stuckMatch).not.toBeNull();
      expect(stuckMatch[0]).toContain('env(safe-area-inset-bottom)');
    });

    test('power indicator uses safe-area-inset-bottom', () => {
      const powerMatch = styleCss.match(/#power-indicator\s*\{[^}]*\}/s);
      expect(powerMatch).not.toBeNull();
      expect(powerMatch[0]).toContain('env(safe-area-inset-bottom)');
    });

    test('ready indicator uses safe-area-inset-bottom', () => {
      const readyMatch = styleCss.match(/#ready-indicator\s*\{[^}]*\}/s);
      expect(readyMatch).not.toBeNull();
      expect(readyMatch[0]).toContain('env(safe-area-inset-bottom)');
    });
  });

  describe('full-screen overlays respect safe-area insets', () => {
    const overlaySelectors = [
      { name: 'loading screen', pattern: /#loading-screen\s*\{[^}]*\}/s },
      { name: 'menu screen', pattern: /#menu-screen\s*\{[^}]*\}/s },
      { name: 'pause overlay', pattern: /\.pause-overlay\s*\{[^}]*\}/s },
      { name: 'scorecard overlay', pattern: /\.scorecard-overlay\s*\{[^}]*\}/s },
      { name: 'controls overlay', pattern: /\.controls-overlay\s*\{[^}]*\}/s },
      { name: 'scores overlay', pattern: /\.scores-overlay\s*\{[^}]*\}/s },
      { name: 'transition overlay', pattern: /\.transition-overlay\s*\{[^}]*\}/s }
    ];

    test.each(overlaySelectors)('$name uses safe-area inset padding', ({ pattern }) => {
      const match = styleCss.match(pattern);
      expect(match).not.toBeNull();
      const block = match[0];
      expect(block).toContain('env(safe-area-inset-top)');
      expect(block).toContain('env(safe-area-inset-right)');
      expect(block).toContain('env(safe-area-inset-bottom)');
      expect(block).toContain('env(safe-area-inset-left)');
      expect(block).toContain('box-sizing: border-box');
    });
  });

  describe('canvas fills full viewport', () => {
    test('game container uses 100vw width and 100vh height', () => {
      const containerMatch = styleCss.match(/#game-container\s*\{[^}]*\}/s);
      expect(containerMatch).not.toBeNull();
      const block = containerMatch[0];
      expect(block).toContain('width: 100vw');
      expect(block).toContain('height: 100vh');
    });

    test('game container canvas has touch-action none for no layout shift', () => {
      expect(styleCss).toContain('#game-container canvas');
      expect(styleCss).toMatch(/#game-container canvas\s*\{[^}]*touch-action:\s*none/s);
    });
  });
});
