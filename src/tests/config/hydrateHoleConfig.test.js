/**
 * Unit tests for hydrateHoleConfig — converts plain-array coordinates to Three.js objects.
 */

import * as THREE from 'three';
import { hydrateHoleConfig } from '../../config/hydrateHoleConfig';

describe('hydrateHoleConfig', () => {
  describe('top-level positions', () => {
    test('converts startPosition array to Vector3', () => {
      const config = { startPosition: [1, 2, 3], holePosition: [4, 5, 6] };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.startPosition).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.startPosition.x).toBe(1);
      expect(hydrated.startPosition.y).toBe(2);
      expect(hydrated.startPosition.z).toBe(3);
    });

    test('converts holePosition array to Vector3', () => {
      const config = { startPosition: [0, 0, 0], holePosition: [4, 5, 6] };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.holePosition).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.holePosition.x).toBe(4);
      expect(hydrated.holePosition.y).toBe(5);
      expect(hydrated.holePosition.z).toBe(6);
    });

    test('passes through already-hydrated Vector3 positions', () => {
      const start = new THREE.Vector3(1, 2, 3);
      const hole = new THREE.Vector3(4, 5, 6);
      const config = { startPosition: start, holePosition: hole };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.startPosition).toBe(start);
      expect(hydrated.holePosition).toBe(hole);
    });
  });

  describe('boundaryShape', () => {
    test('converts [x, y] arrays to Vector2', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        boundaryShape: [
          [-4, -12],
          [-4, 12],
          [4, 12],
          [4, -12]
        ]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.boundaryShape).toHaveLength(4);
      hydrated.boundaryShape.forEach(v => {
        expect(v).toBeInstanceOf(THREE.Vector2);
      });
      expect(hydrated.boundaryShape[0].x).toBe(-4);
      expect(hydrated.boundaryShape[0].y).toBe(-12);
    });
  });

  describe('bumpers', () => {
    test('converts bumper position, size, and rotation arrays', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        bumpers: [{ position: [-3.5, 0.25, 0], size: [0.3, 0.5, 8], rotation: [0, 0.3, 0] }]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.bumpers[0].position).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.bumpers[0].size).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.bumpers[0].rotation).toBeInstanceOf(THREE.Euler);
      expect(hydrated.bumpers[0].rotation.y).toBe(0.3);
    });

    test('handles bumpers without rotation', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        bumpers: [{ position: [1, 2, 3], size: [4, 5, 6] }]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.bumpers[0].rotation).toBeUndefined();
    });
  });

  describe('hazards', () => {
    test('converts hazard position array to Vector3', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        hazards: [
          { type: 'sand', shape: 'circle', position: [0, 0, 0], size: { radius: 3 }, depth: 0.1 }
        ]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.hazards[0].position).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.hazards[0].type).toBe('sand');
      expect(hydrated.hazards[0].size.radius).toBe(3);
    });
  });

  describe('heroProps', () => {
    test('converts heroProp position array to Vector3', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        heroProps: [{ type: 'rocket_stand', position: [-6, 0, 8], scale: 1.5 }]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.heroProps[0].position).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.heroProps[0].position.x).toBe(-6);
      expect(hydrated.heroProps[0].scale).toBe(1.5);
    });

    test('converts heroProp rotation if present', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        heroProps: [{ type: 'test', position: [0, 0, 0], rotation: [0, 1.57, 0] }]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.heroProps[0].rotation).toBeInstanceOf(THREE.Euler);
    });
  });

  describe('mechanics — moving_sweeper', () => {
    test('converts pivot to Vector3', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        mechanics: [
          {
            type: 'moving_sweeper',
            pivot: [0, 0, 0],
            armLength: 4,
            speed: 1.2,
            size: { width: 4, height: 0.4, depth: 0.3 }
          }
        ]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.mechanics[0].pivot).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].armLength).toBe(4);
    });
  });

  describe('mechanics — portal_gate', () => {
    test('converts entryPosition and exitPosition to Vector3', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        mechanics: [
          { type: 'portal_gate', entryPosition: [0, 0, 2], exitPosition: [0, 0, -3], radius: 0.7 }
        ]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.mechanics[0].entryPosition).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].exitPosition).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].exitPosition.z).toBe(-3);
    });
  });

  describe('mechanics — split_route', () => {
    test('converts walls start/end to Vector3', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        mechanics: [
          { type: 'split_route', walls: [{ start: [0, 0, 6], end: [0, 0, -2] }], height: 0.8 }
        ]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.mechanics[0].walls[0].start).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].walls[0].end).toBeInstanceOf(THREE.Vector3);
    });
  });

  describe('mechanics — bank_wall', () => {
    test('converts segments start/end to Vector3', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        mechanics: [
          {
            type: 'bank_wall',
            segments: [{ start: [-3, 0, -2], end: [-4, 0, 2] }],
            restitution: 0.9
          }
        ]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.mechanics[0].segments[0].start).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].segments[0].end).toBeInstanceOf(THREE.Vector3);
    });
  });

  describe('mechanics — ricochet_bumpers', () => {
    test('converts bumper positions to Vector3', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        mechanics: [
          {
            type: 'ricochet_bumpers',
            bumpers: [
              { position: [-2, 0, 2], geometry: 'cylinder', radius: 0.5 },
              { position: [2, 0, 2], geometry: 'cylinder', radius: 0.5 }
            ]
          }
        ]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.mechanics[0].bumpers[0].position).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].bumpers[1].position).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].bumpers[0].geometry).toBe('cylinder');
    });
  });

  describe('mechanics — elevated_green', () => {
    test('converts platform.position, ramp.start, ramp.end to Vector3', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        mechanics: [
          {
            type: 'elevated_green',
            platform: { position: [0, 0, -7], width: 5, length: 4 },
            elevation: 0.5,
            ramp: { start: [5, 0, -6], end: [3, 0, -7], width: 2 }
          }
        ]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.mechanics[0].platform.position).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].ramp.start).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].ramp.end).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].platform.width).toBe(5);
      expect(hydrated.mechanics[0].ramp.width).toBe(2);
    });
  });

  describe('mechanics — boost_strip', () => {
    test('converts position and direction to Vector3', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        mechanics: [
          {
            type: 'boost_strip',
            position: [4, 0, -4],
            direction: [0, 0, -1],
            force: 10,
            size: { width: 1.5, length: 3 }
          }
        ]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.mechanics[0].position).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].direction).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].direction.z).toBe(-1);
    });
  });

  describe('mechanics — multi_level_ramp', () => {
    test('converts startPosition and endPosition to Vector3', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        mechanics: [
          {
            type: 'multi_level_ramp',
            startPosition: [0, 0, -1],
            endPosition: [0, 2, -5],
            width: 3
          }
        ]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.mechanics[0].startPosition).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].startPosition.z).toBe(-1);
      expect(hydrated.mechanics[0].endPosition).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.mechanics[0].endPosition.y).toBe(2);
      expect(hydrated.mechanics[0].width).toBe(3);
    });
  });

  describe('mechanics — simple position types', () => {
    test.each(['bowl_contour', 'suction_zone', 'low_gravity_zone', 'timed_hazard', 'timed_gate'])(
      'converts %s position to Vector3',
      type => {
        const config = {
          startPosition: [0, 0, 0],
          holePosition: [0, 0, 0],
          mechanics: [{ type, position: [1, 2, 3], radius: 5, force: 2 }]
        };
        const hydrated = hydrateHoleConfig(config);

        expect(hydrated.mechanics[0].position).toBeInstanceOf(THREE.Vector3);
        expect(hydrated.mechanics[0].position.x).toBe(1);
      }
    );
  });

  describe('non-coordinate fields are preserved', () => {
    test('preserves index, description, par, theme', () => {
      const theme = { name: 'test' };
      const config = {
        index: 0,
        description: '1. Test',
        par: 2,
        theme,
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.index).toBe(0);
      expect(hydrated.description).toBe('1. Test');
      expect(hydrated.par).toBe(2);
      expect(hydrated.theme).toBe(theme);
    });
  });

  describe('missing optional arrays', () => {
    test('handles config with no bumpers, hazards, mechanics, heroProps', () => {
      const config = { startPosition: [0, 0, 0], holePosition: [0, 0, 0] };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.startPosition).toBeInstanceOf(THREE.Vector3);
      expect(hydrated.bumpers).toBeUndefined();
      expect(hydrated.hazards).toBeUndefined();
      expect(hydrated.mechanics).toBeUndefined();
      expect(hydrated.heroProps).toBeUndefined();
    });
  });

  describe('unknown mechanic type', () => {
    test('converts position field for unknown mechanic types via default case', () => {
      const config = {
        startPosition: [0, 0, 0],
        holePosition: [0, 0, 0],
        mechanics: [{ type: 'future_mechanic', position: [5, 6, 7] }]
      };
      const hydrated = hydrateHoleConfig(config);

      expect(hydrated.mechanics[0].position).toBeInstanceOf(THREE.Vector3);
    });
  });
});
