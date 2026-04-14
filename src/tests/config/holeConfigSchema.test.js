import Ajv from 'ajv';
import { createOrbitalDriftConfigs } from '../../config/orbitalDriftConfigs';
import holeConfigSchema from '../../config/holeConfigSchema.json';

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(holeConfigSchema);
const configs = createOrbitalDriftConfigs();

function serializeConfig(config) {
  return JSON.parse(
    JSON.stringify(config, (_key, value) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const cleaned = {};
        for (const [k, v] of Object.entries(value)) {
          if (typeof v !== 'function') {
            cleaned[k] = v;
          }
        }
        return cleaned;
      }
      return value;
    })
  );
}

describe('holeConfigSchema.json', () => {
  it('is a valid JSON Schema (draft-07)', () => {
    expect(holeConfigSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(holeConfigSchema.type).toBe('object');
    expect(holeConfigSchema.$defs).toBeDefined();
  });

  it('has $defs entries for all 16 mechanic types', () => {
    const expectedTypes = [
      'moving_sweeper',
      'timed_hazard',
      'timed_gate',
      'boost_strip',
      'suction_zone',
      'low_gravity_zone',
      'bowl_contour',
      'portal_gate',
      'bank_wall',
      'split_route',
      'elevated_green',
      'ricochet_bumpers',
      'laser_grid',
      'disappearing_platform',
      'gravity_funnel',
      'multi_level_ramp'
    ];
    for (const type of expectedTypes) {
      expect(holeConfigSchema.$defs[type]).toBeDefined();
    }
  });

  it('covers all required top-level fields', () => {
    const requiredFields = [
      'index',
      'description',
      'par',
      'boundaryShape',
      'startPosition',
      'holePosition'
    ];
    expect(holeConfigSchema.required).toEqual(expect.arrayContaining(requiredFields));
  });

  it('defines optional top-level fields', () => {
    const optionalFields = [
      'theme',
      'hazards',
      'bumpers',
      'mechanics',
      'heroProps',
      'outOfBounds',
      'cameraHint'
    ];
    for (const field of optionalFields) {
      expect(holeConfigSchema.properties[field]).toBeDefined();
    }
  });

  it('validates all 18 hole configs with zero errors', () => {
    expect(configs).toHaveLength(18);
    const allErrors = [];

    configs.forEach((config, i) => {
      const serialized = serializeConfig(config);
      const valid = validate(serialized);
      if (!valid) {
        allErrors.push({
          hole: i,
          description: config.description,
          errors: validate.errors
        });
      }
    });

    if (allErrors.length > 0) {
      const messages = allErrors.map(
        e =>
          `${e.description}: ${e.errors.map(err => `${err.instancePath} ${err.message}`).join('; ')}`
      );
      throw new Error(`Schema validation failed:\n${messages.join('\n')}`);
    }

    expect(allErrors).toHaveLength(0);
  });

  it.each(configs.map((c, i) => [c.description, i]))(
    '%s passes schema validation',
    (_desc, index) => {
      const serialized = serializeConfig(configs[index]);
      const valid = validate(serialized);
      if (!valid) {
        const messages = validate.errors.map(e => `${e.instancePath} ${e.message}`);
        throw new Error(messages.join('; '));
      }
      expect(valid).toBe(true);
    }
  );

  it('rejects a config missing required fields', () => {
    const invalid = { description: 'bad hole' };
    expect(validate(invalid)).toBe(false);
  });

  it('rejects a config with invalid par', () => {
    const invalid = serializeConfig({
      ...configs[0],
      par: -1
    });
    expect(validate(invalid)).toBe(false);
  });

  it('rejects a config with unknown mechanic type', () => {
    const invalid = serializeConfig({
      ...configs[0],
      mechanics: [{ type: 'nonexistent_mechanic' }]
    });
    expect(validate(invalid)).toBe(false);
  });

  it('rejects a mechanic missing required fields', () => {
    const invalid = serializeConfig({
      ...configs[0],
      mechanics: [{ type: 'moving_sweeper' }]
    });
    expect(validate(invalid)).toBe(false);
  });

  it('schema is importable as a module', () => {
    expect(holeConfigSchema).toBeDefined();
    expect(typeof holeConfigSchema).toBe('object');
    expect(holeConfigSchema.title).toBe('Hole Configuration');
  });
});
