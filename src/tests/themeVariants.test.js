import { STATION_SIDE, DEEP_VOID, getThemeForHole, isBackNine } from '../themes/themeVariants';

describe('themeVariants', () => {
  describe('isBackNine', () => {
    it('returns false for front nine holes (index 0-8)', () => {
      for (let i = 0; i < 9; i++) {
        expect(isBackNine(i)).toBe(false);
      }
    });

    it('returns true for back nine holes (index 9-17)', () => {
      for (let i = 9; i < 18; i++) {
        expect(isBackNine(i)).toBe(true);
      }
    });
  });

  describe('getThemeForHole', () => {
    it('returns STATION_SIDE for front nine holes', () => {
      for (let i = 0; i < 9; i++) {
        expect(getThemeForHole(i)).toBe(STATION_SIDE);
      }
    });

    it('returns DEEP_VOID for back nine holes', () => {
      for (let i = 9; i < 18; i++) {
        expect(getThemeForHole(i)).toBe(DEEP_VOID);
      }
    });
  });

  describe('STATION_SIDE theme', () => {
    it('has warm ambient lighting', () => {
      expect(STATION_SIDE.lighting.ambientColor).toBe(0xfff5e6);
      expect(STATION_SIDE.lighting.ambientIntensity).toBe(0.6);
    });

    it('has pale yellow key light', () => {
      expect(STATION_SIDE.lighting.keyLightColor).toBe(0xffeecc);
    });

    it('has warm neon trim accents (orange/amber)', () => {
      expect(STATION_SIDE.neonTrim.color).toBe(0xffaa44);
      expect(STATION_SIDE.neonTrim.emissive).toBe(0xffaa44);
    });

    it('has warm nebula tones', () => {
      expect(STATION_SIDE.nebula).toBeDefined();
      expect(STATION_SIDE.nebula.color1).toBeDefined();
      expect(STATION_SIDE.nebula.color2).toBeDefined();
    });

    it('has all required theme keys', () => {
      const requiredKeys = [
        'green',
        'wall',
        'bumper',
        'sand',
        'water',
        'tee',
        'rim',
        'holeInterior',
        'neonTrim',
        'mechanics',
        'lighting',
        'nebula'
      ];
      requiredKeys.forEach(key => {
        expect(STATION_SIDE[key]).toBeDefined();
      });
    });
  });

  describe('DEEP_VOID theme', () => {
    it('has cool ambient lighting with lower intensity', () => {
      expect(DEEP_VOID.lighting.ambientColor).toBe(0xccddff);
      expect(DEEP_VOID.lighting.ambientIntensity).toBe(0.4);
    });

    it('has icy blue key light', () => {
      expect(DEEP_VOID.lighting.keyLightColor).toBe(0xaaccff);
    });

    it('has near-black floor', () => {
      expect(DEEP_VOID.green.color).toBe(0x0a0a12);
    });

    it('has cold neon trim accents (cyan/blue)', () => {
      expect(DEEP_VOID.neonTrim.color).toBe(0x00ccff);
      expect(DEEP_VOID.neonTrim.emissive).toBe(0x00ccff);
    });

    it('has cold nebula tones', () => {
      expect(DEEP_VOID.nebula).toBeDefined();
      expect(DEEP_VOID.nebula.color1).toBeDefined();
      expect(DEEP_VOID.nebula.color2).toBeDefined();
    });

    it('has all required theme keys', () => {
      const requiredKeys = [
        'green',
        'wall',
        'bumper',
        'sand',
        'water',
        'tee',
        'rim',
        'holeInterior',
        'neonTrim',
        'mechanics',
        'lighting',
        'nebula'
      ];
      requiredKeys.forEach(key => {
        expect(DEEP_VOID[key]).toBeDefined();
      });
    });
  });

  describe('visual contrast between themes', () => {
    it('ambient intensity is lower in DEEP_VOID', () => {
      expect(DEEP_VOID.lighting.ambientIntensity).toBeLessThan(
        STATION_SIDE.lighting.ambientIntensity
      );
    });

    it('floor colors differ between themes', () => {
      expect(DEEP_VOID.green.color).not.toBe(STATION_SIDE.green.color);
    });

    it('wall accent colors differ between themes', () => {
      expect(DEEP_VOID.neonTrim.color).not.toBe(STATION_SIDE.neonTrim.color);
    });

    it('lighting colors differ between themes', () => {
      expect(DEEP_VOID.lighting.ambientColor).not.toBe(STATION_SIDE.lighting.ambientColor);
      expect(DEEP_VOID.lighting.keyLightColor).not.toBe(STATION_SIDE.lighting.keyLightColor);
    });
  });
});
