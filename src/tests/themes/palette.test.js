import { MATERIAL_PALETTE } from '../../themes/palette';
import { spaceTheme } from '../../themes/spaceTheme';

describe('MATERIAL_PALETTE', () => {
  it('exports a MATERIAL_PALETTE object', () => {
    expect(MATERIAL_PALETTE).toBeDefined();
    expect(typeof MATERIAL_PALETTE).toBe('object');
  });

  describe('required top-level keys', () => {
    const requiredKeys = [
      'floor',
      'wall',
      'hazard',
      'decoration',
      'rim',
      'tee',
      'holeInterior',
      'bumper',
      'neonTrim',
      'background'
    ];

    it.each(requiredKeys)('has key: %s', key => {
      expect(MATERIAL_PALETTE).toHaveProperty(key);
    });
  });

  describe('floor', () => {
    it('has standard material properties', () => {
      expect(MATERIAL_PALETTE.floor).toHaveProperty('color');
      expect(MATERIAL_PALETTE.floor).toHaveProperty('roughness');
      expect(MATERIAL_PALETTE.floor).toHaveProperty('metalness');
    });

    it('has emissive properties', () => {
      expect(MATERIAL_PALETTE.floor).toHaveProperty('emissive');
      expect(MATERIAL_PALETTE.floor).toHaveProperty('emissiveIntensity');
    });
  });

  describe('wall', () => {
    it('has gloss metallic properties', () => {
      expect(MATERIAL_PALETTE.wall.metalness).toBeGreaterThanOrEqual(0.5);
      expect(MATERIAL_PALETTE.wall.roughness).toBeLessThanOrEqual(0.5);
    });
  });

  describe('hazard', () => {
    it('has sand hazard with emissive glow', () => {
      expect(MATERIAL_PALETTE.hazard.sand).toHaveProperty('emissive');
      expect(MATERIAL_PALETTE.hazard.sand.emissiveIntensity).toBeGreaterThan(0);
    });

    it('has water hazard with emissive glow', () => {
      expect(MATERIAL_PALETTE.hazard.water).toHaveProperty('emissive');
      expect(MATERIAL_PALETTE.hazard.water.emissiveIntensity).toBeGreaterThan(0);
    });

    it('hazard emissive colors are red/orange spectrum', () => {
      const sandEmissive = MATERIAL_PALETTE.hazard.sand.emissive;
      const redChannel = (sandEmissive >> 16) & 0xff;
      expect(redChannel).toBeGreaterThan(0x80);

      const waterEmissive = MATERIAL_PALETTE.hazard.water.emissive;
      const waterRedChannel = (waterEmissive >> 16) & 0xff;
      expect(waterRedChannel).toBeGreaterThan(0x80);
    });
  });

  describe('decoration', () => {
    it('has zero emissive intensity', () => {
      expect(MATERIAL_PALETTE.decoration.emissiveIntensity).toBe(0);
    });

    it('has no emissive color', () => {
      expect(MATERIAL_PALETTE.decoration.emissive).toBe(0x000000);
    });
  });

  describe('neonTrim', () => {
    it('has emissive color for visibility', () => {
      expect(MATERIAL_PALETTE.neonTrim.emissive).toBeDefined();
      expect(MATERIAL_PALETTE.neonTrim.emissiveIntensity).toBeGreaterThan(0);
    });

    it('has a bright color distinct from walls and floor', () => {
      expect(MATERIAL_PALETTE.neonTrim.color).not.toBe(MATERIAL_PALETTE.wall.color);
      expect(MATERIAL_PALETTE.neonTrim.color).not.toBe(MATERIAL_PALETTE.floor.color);
    });
  });

  describe('background', () => {
    it('planet has zero emissive', () => {
      expect(MATERIAL_PALETTE.background.planet.emissiveIntensity).toBe(0);
    });

    it('nebula has zero emissive', () => {
      expect(MATERIAL_PALETTE.background.nebula.emissiveIntensity).toBe(0);
    });

    it('debris has zero emissive', () => {
      expect(MATERIAL_PALETTE.background.debris.emissiveIntensity).toBe(0);
    });

    it('nebula has low opacity for muted appearance', () => {
      expect(MATERIAL_PALETTE.background.nebula.opacity).toBeLessThan(0.2);
    });
  });
});

describe('spaceTheme palette integration', () => {
  it('green properties match palette floor', () => {
    expect(spaceTheme.green.color).toBe(MATERIAL_PALETTE.floor.color);
    expect(spaceTheme.green.roughness).toBe(MATERIAL_PALETTE.floor.roughness);
    expect(spaceTheme.green.metalness).toBe(MATERIAL_PALETTE.floor.metalness);
  });

  it('wall properties match palette wall', () => {
    expect(spaceTheme.wall.color).toBe(MATERIAL_PALETTE.wall.color);
    expect(spaceTheme.wall.roughness).toBe(MATERIAL_PALETTE.wall.roughness);
    expect(spaceTheme.wall.metalness).toBe(MATERIAL_PALETTE.wall.metalness);
  });

  it('sand hazard has emissive from palette', () => {
    expect(spaceTheme.sand.emissive).toBe(MATERIAL_PALETTE.hazard.sand.emissive);
    expect(spaceTheme.sand.emissiveIntensity).toBe(MATERIAL_PALETTE.hazard.sand.emissiveIntensity);
  });

  it('water hazard has emissive from palette', () => {
    expect(spaceTheme.water.emissive).toBe(MATERIAL_PALETTE.hazard.water.emissive);
    expect(spaceTheme.water.emissiveIntensity).toBe(
      MATERIAL_PALETTE.hazard.water.emissiveIntensity
    );
  });

  it('has neonTrim property from palette', () => {
    expect(spaceTheme.neonTrim).toBeDefined();
    expect(spaceTheme.neonTrim.color).toBe(MATERIAL_PALETTE.neonTrim.color);
    expect(spaceTheme.neonTrim.emissive).toBe(MATERIAL_PALETTE.neonTrim.emissive);
  });
});
