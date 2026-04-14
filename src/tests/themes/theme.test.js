/**
 * Unit tests for theme system (defaultTheme, spaceTheme)
 */

import { defaultTheme } from '../../themes/defaultTheme';
import { spaceTheme } from '../../themes/spaceTheme';

const REQUIRED_KEYS = [
  'green',
  'wall',
  'bumper',
  'sand',
  'water',
  'tee',
  'rim',
  'holeInterior',
  'background'
];

describe('Theme System', () => {
  describe('defaultTheme', () => {
    it('exports a theme object with all required keys', () => {
      for (const key of REQUIRED_KEYS) {
        expect(defaultTheme).toHaveProperty(key);
      }
    });

    it('has a name property', () => {
      expect(defaultTheme.name).toBe('Default');
    });

    it('matches original hardcoded green color', () => {
      expect(defaultTheme.green.color).toBe(0x2ecc71);
    });

    it('matches original hardcoded wall color', () => {
      expect(defaultTheme.wall.color).toBe(0xa0522d);
    });

    it('matches original hardcoded bumper color', () => {
      expect(defaultTheme.bumper.color).toBe(0xff8c00);
    });

    it('matches original hardcoded sand color', () => {
      expect(defaultTheme.sand.color).toBe(0xe6c388);
    });

    it('matches original hardcoded water color', () => {
      expect(defaultTheme.water.color).toBe(0x3399ff);
    });

    it('matches original hardcoded tee color', () => {
      expect(defaultTheme.tee.color).toBe(0x0077cc);
    });

    it('matches original hardcoded rim color', () => {
      expect(defaultTheme.rim.color).toBe(0xcccccc);
    });

    it('matches original hardcoded hole interior color', () => {
      expect(defaultTheme.holeInterior.color).toBe(0x1a1a1a);
    });

    it('has material properties on component themes', () => {
      expect(defaultTheme.green).toHaveProperty('roughness');
      expect(defaultTheme.green).toHaveProperty('metalness');
      expect(defaultTheme.wall).toHaveProperty('roughness');
      expect(defaultTheme.wall).toHaveProperty('metalness');
    });

    it('water has opacity property', () => {
      expect(defaultTheme.water.opacity).toBe(0.7);
    });
  });

  describe('spaceTheme', () => {
    it('exports a theme object with all required keys', () => {
      for (const key of REQUIRED_KEYS) {
        expect(spaceTheme).toHaveProperty(key);
      }
    });

    it('has a name property', () => {
      expect(spaceTheme.name).toBe('Orbital Drift');
    });

    it('has the same key structure as defaultTheme', () => {
      for (const key of REQUIRED_KEYS) {
        expect(typeof spaceTheme[key]).toBe(typeof defaultTheme[key]);
      }
    });

    it('has distinct colors from defaultTheme', () => {
      expect(spaceTheme.green.color).not.toBe(defaultTheme.green.color);
      expect(spaceTheme.wall.color).not.toBe(defaultTheme.wall.color);
      expect(spaceTheme.tee.color).not.toBe(defaultTheme.tee.color);
    });

    it('has emissive properties for space aesthetic', () => {
      expect(spaceTheme.green).toHaveProperty('emissive');
      expect(spaceTheme.green).toHaveProperty('emissiveIntensity');
      expect(spaceTheme.wall).toHaveProperty('emissive');
    });
  });

  describe('theme compatibility', () => {
    it('both themes have color on all component keys', () => {
      const componentKeys = REQUIRED_KEYS.filter(k => k !== 'background');
      for (const key of componentKeys) {
        expect(defaultTheme[key]).toHaveProperty('color');
        expect(spaceTheme[key]).toHaveProperty('color');
      }
    });

    it('background is a plain number on both themes', () => {
      expect(typeof defaultTheme.background).toBe('number');
      expect(typeof spaceTheme.background).toBe('number');
    });
  });
});
