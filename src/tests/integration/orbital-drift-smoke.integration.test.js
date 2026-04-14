/**
 * Smoke tests for all 10 Orbital Drift hole configs.
 * ISSUE-019
 *
 * Loads each config, validates it, instantiates HoleEntity,
 * verifies mechanics creation, and checks cleanup.
 */

// Mock Three.js before any imports
jest.mock('three', () => {
  const mockVector3 = jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.clone = jest.fn(() => new mockVector3(this.x, this.y, this.z));
    this.copy = jest.fn(function (other) {
      if (other) {
        this.x = other.x || 0;
        this.y = other.y || 0;
        this.z = other.z || 0;
      }
      return this;
    });
    this.set = jest.fn(function (x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    });
    this.setY = jest.fn(function (v) {
      this.y = v;
      return this;
    });
    this.normalize = jest.fn(() => this);
    this.multiplyScalar = jest.fn(() => this);
    this.subVectors = jest.fn(() => this);
    this.addVectors = jest.fn(() => this);
    this.toArray = jest.fn(() => [this.x, this.y, this.z]);
    this.distanceTo = jest.fn(() => 5);
  });

  const mockVector2 = jest.fn(function (x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.clone = jest.fn(() => new mockVector2(this.x, this.y));
    this.subVectors = jest.fn((a, b) => {
      this.x = a.x - b.x;
      this.y = a.y - b.y;
      return this;
    });
    this.length = jest.fn(() => Math.sqrt(this.x * this.x + this.y * this.y));
    this.normalize = jest.fn(() => this);
    this.multiplyScalar = jest.fn(s => {
      this.x *= s;
      this.y *= s;
      return this;
    });
    this.addVectors = jest.fn((a, b) => {
      this.x = a.x + b.x;
      this.y = a.y + b.y;
      return this;
    });
  });

  const mockBox2 = jest.fn(function () {
    this.min = { x: -5, y: -5 };
    this.max = { x: 5, y: 5 };
    this.setFromPoints = jest.fn();
    this.getCenter = jest.fn(target => {
      target.x = 0;
      target.y = 0;
    });
    this.getSize = jest.fn(target => {
      target.x = 10;
      target.y = 10;
    });
  });

  const mockGeometry = () => ({
    dispose: jest.fn(),
    rotateX: jest.fn(),
    translate: jest.fn(),
    attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]) } },
    index: { array: new Uint16Array([0, 1, 2, 2, 3, 0]) }
  });

  const mockMaterial = jest.fn(function () {
    this.dispose = jest.fn();
    this.color = 0xffffff;
    this.clone = jest.fn(() => new mockMaterial());
  });

  const mockMesh = jest.fn(function () {
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0, set: jest.fn() };
    this.geometry = { dispose: jest.fn() };
    this.material = { dispose: jest.fn(), clone: jest.fn(() => new mockMaterial()) };
    this.parent = null;
    this.updateMatrix = jest.fn();
    this.name = '';
    this.castShadow = false;
    this.receiveShadow = false;
  });

  const mockGroup = jest.fn(function () {
    this.position = {
      x: 0,
      y: 0,
      z: 0,
      copy: jest.fn(function (other) {
        if (other) {
          this.x = other.x || 0;
          this.y = other.y || 0;
          this.z = other.z || 0;
        }
      }),
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    };
    this.parent = null;
    this.add = jest.fn();
    this.remove = jest.fn();
    this.children = [];
    this.name = '';
    this.userData = {};
  });

  return {
    Vector3: mockVector3,
    Vector2: mockVector2,
    Box2: mockBox2,
    Euler: jest.fn(function (x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }),
    Shape: jest.fn(function () {
      this.holes = [];
      this.moveTo = jest.fn();
      this.lineTo = jest.fn();
      this.closePath = jest.fn();
    }),
    ShapeGeometry: jest.fn(mockGeometry),
    ExtrudeGeometry: jest.fn(function () {
      this.dispose = jest.fn();
      this.rotateX = jest.fn();
      this.translate = jest.fn();
    }),
    MeshStandardMaterial: mockMaterial,
    MeshPhongMaterial: mockMaterial,
    MeshBasicMaterial: mockMaterial,
    BufferGeometry: jest.fn(function () {
      this.setFromPoints = jest.fn().mockReturnValue(this);
      this.setAttribute = jest.fn();
      this.dispose = jest.fn();
    }),
    LineBasicMaterial: jest.fn(function () {
      this.color = 0xffffff;
      this.dispose = jest.fn();
    }),
    Line: jest.fn(function (geometry, material) {
      this.geometry = geometry || { dispose: jest.fn() };
      this.material = material || { dispose: jest.fn() };
      this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    }),
    Mesh: mockMesh,
    Group: mockGroup,
    CylinderGeometry: jest.fn(mockGeometry),
    PlaneGeometry: jest.fn(mockGeometry),
    CircleGeometry: jest.fn(mockGeometry),
    BoxGeometry: jest.fn(mockGeometry),
    RingGeometry: jest.fn(mockGeometry),
    SphereGeometry: jest.fn(mockGeometry),
    Path: jest.fn(function () {
      return {};
    }),
    Color: jest.fn(function (c) {
      this.r = 0;
      this.g = 0;
      this.b = 0;
    })
  };
});

// Mock cannon-es
jest.mock('cannon-es', () => {
  const mockVec3 = jest.fn(function (x, y, z) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
    this.scale = jest.fn(() => new mockVec3(this.x, this.y, this.z));
  });

  const mockQuaternion = jest.fn(function () {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 1;
    this.set = jest.fn();
    this.copy = jest.fn();
    this.setFromAxisAngle = jest.fn(() => this);
  });

  const mockBody = jest.fn(function () {
    this.position = new mockVec3();
    this.position.set = jest.fn();
    this.quaternion = new mockQuaternion();
    this.material = null;
    this.type = 'STATIC';
    this.addShape = jest.fn();
    this.addEventListener = jest.fn();
    this.userData = {};
    this.isTrigger = false;
  });
  mockBody.STATIC = 'STATIC';
  mockBody.SLEEPING = 'SLEEPING';

  return {
    Box: jest.fn(() => ({ material: null })),
    Body: mockBody,
    Material: jest.fn(),
    ContactMaterial: jest.fn(),
    Vec3: mockVec3,
    Cylinder: jest.fn(),
    Trimesh: jest.fn(),
    Sphere: jest.fn(),
    Quaternion: mockQuaternion,
    BODY_TYPES: { STATIC: 'STATIC' }
  };
});

// Mock three-csg-ts
jest.mock('three-csg-ts', () => ({
  CSG: {
    fromMesh: jest.fn(() => ({
      subtract: jest.fn(() => ({
        toMesh: jest.fn(() => ({
          position: { set: jest.fn() },
          geometry: { dispose: jest.fn() },
          material: { dispose: jest.fn() }
        }))
      }))
    })),
    subtract: jest.fn(() => ({
      position: { set: jest.fn() },
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    }))
  }
}));

// Mock HazardFactory
jest.mock('../../objects/hazards/HazardFactory', () => ({
  createHazard: jest.fn(() => ({
    mesh: {
      position: { set: jest.fn() },
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    },
    body: { position: { set: jest.fn() } },
    destroy: jest.fn()
  }))
}));

// Mock HeroPropFactory
jest.mock('../../objects/HeroPropFactory', () => ({
  createHeroProp: jest.fn(() => [])
}));

import { createOrbitalDriftConfigs } from '../../config/orbitalDriftConfigs';
import { hydrateHoleConfig } from '../../config/hydrateHoleConfig';
import { HoleEntity } from '../../objects/HoleEntity';
import { validateHoleConfig, validateCourse } from '../../utils/holeValidator';
import { getRegisteredTypes } from '../../mechanics/MechanicRegistry';

// Import barrel to trigger all mechanic registrations
import '../../mechanics/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    addContactMaterial: jest.fn(),
    step: jest.fn(),
    groundMaterial: { name: 'ground' },
    bumperMaterial: { name: 'bumper' },
    bodies: []
  };
}

function makeMockScene() {
  return {
    add: jest.fn(),
    remove: jest.fn(),
    children: []
  };
}

function makeMockBallBody() {
  return {
    position: { x: 0, y: 0.2, z: 0 },
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    force: { x: 0, y: 0, z: 0, set: jest.fn() },
    applyForce: jest.fn(),
    wakeUp: jest.fn()
  };
}

// Expected mechanic types and counts per hole
const EXPECTED_MECHANICS = [
  { index: 0, description: '1. Docking Lane', types: ['moving_sweeper'] },
  { index: 1, description: '2. Crater Rim', types: ['bowl_contour'] },
  { index: 2, description: '3. Satellite Slingshot', types: ['split_route', 'moving_sweeper'] },
  {
    index: 3,
    description: '4. Asteroid Belt Bounce',
    types: ['ricochet_bumpers', 'elevated_green']
  },
  { index: 4, description: '5. Wormhole Transfer', types: ['portal_gate'] },
  {
    index: 5,
    description: '6. Solar Flare Run',
    types: ['timed_hazard', 'timed_hazard', 'timed_hazard']
  },
  { index: 6, description: '7. Zero G Lab', types: ['low_gravity_zone', 'bank_wall'] },
  { index: 7, description: '8. Event Horizon', types: ['suction_zone', 'timed_gate'] },
  {
    index: 8,
    description: '9. Station Core Finale',
    types: ['split_route', 'moving_sweeper', 'boost_strip', 'elevated_green']
  },
  { index: 9, description: '10. Laser Grid', types: ['laser_grid', 'laser_grid'] },
  {
    index: 10,
    description: '11. Blackout Corridor',
    types: ['disappearing_platform', 'disappearing_platform', 'bank_wall', 'bank_wall']
  },
  { index: 11, description: '12. Gravity Well', types: ['gravity_funnel'] },
  {
    index: 12,
    description: '13. Debris Field',
    types: ['ricochet_bumpers', 'timed_hazard', 'timed_hazard']
  },
  { index: 13, description: '14. Reactor Bypass', types: ['timed_hazard', 'boost_strip'] },
  {
    index: 14,
    description: '15. Wormhole Relay',
    types: ['portal_gate', 'timed_gate', 'portal_gate']
  },
  {
    index: 15,
    description: '16. Eclipse Steps',
    types: [
      'multi_level_ramp',
      'multi_level_ramp',
      'timed_gate',
      'multi_level_ramp',
      'multi_level_ramp'
    ]
  },
  {
    index: 16,
    description: '17. Comet Run',
    types: ['moving_sweeper', 'boost_strip', 'moving_sweeper', 'boost_strip']
  },
  {
    index: 17,
    description: '18. Starforge Finale',
    types: ['split_route', 'boost_strip', 'gravity_funnel', 'elevated_green']
  }
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Initialize at module level so it.each() can access them at describe-time
const configs = createOrbitalDriftConfigs().map(hydrateHoleConfig);
const registeredTypes = getRegisteredTypes();

describe('Orbital Drift hole configs smoke tests (ISSUE-019)', () => {
  // --- Config loading and parsing ---

  describe('config loading', () => {
    it('loads exactly 18 hole configs', () => {
      expect(configs).toHaveLength(18);
    });

    it('each config has a unique index', () => {
      const indices = configs.map(c => c.index);
      const uniqueIndices = new Set(indices);
      expect(uniqueIndices.size).toBe(configs.length);
    });
  });

  // --- Required fields validation ---

  describe('required fields validation', () => {
    it.each(configs.map(c => [c.description, c]))('%s has all required fields', (_desc, config) => {
      expect(config.boundaryShape).toBeDefined();
      expect(Array.isArray(config.boundaryShape)).toBe(true);
      expect(config.boundaryShape.length).toBeGreaterThanOrEqual(3);

      expect(config.startPosition).toBeDefined();
      expect(typeof config.startPosition.x).toBe('number');
      expect(typeof config.startPosition.y).toBe('number');
      expect(typeof config.startPosition.z).toBe('number');

      expect(config.holePosition).toBeDefined();
      expect(typeof config.holePosition.x).toBe('number');
      expect(typeof config.holePosition.y).toBe('number');
      expect(typeof config.holePosition.z).toBe('number');

      expect(typeof config.par).toBe('number');
      expect(config.par).toBeGreaterThan(0);

      expect(typeof config.description).toBe('string');
      expect(config.description.length).toBeGreaterThan(0);
    });
  });

  // --- Validator integration ---

  describe('holeValidator passes all configs', () => {
    it.each(configs.map(c => [c.description, c]))(
      '%s passes validation with no errors',
      (_desc, config) => {
        const issues = validateHoleConfig(config, { registeredTypes });
        const errors = issues.filter(i => i.level === 'error');
        expect(errors).toEqual([]);
      }
    );

    it('entire course passes validateCourse with no errors', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validateCourse(configs, 'Orbital Drift', { registeredTypes });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);

      logSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  // --- Mechanics type resolution ---

  describe('mechanics type resolution', () => {
    it.each(configs.map(c => [c.description, c]))(
      '%s has mechanics that all resolve to registered types',
      (_desc, config) => {
        expect(config.mechanics).toBeDefined();
        expect(Array.isArray(config.mechanics)).toBe(true);
        expect(config.mechanics.length).toBeGreaterThan(0);

        config.mechanics.forEach((m, i) => {
          expect(m.type).toBeDefined();
          expect(registeredTypes).toContain(m.type);
        });
      }
    );

    it.each(EXPECTED_MECHANICS.map(e => [e.description, e]))(
      '%s has the expected mechanic types',
      (_desc, expected) => {
        const config = configs[expected.index];
        const actualTypes = config.mechanics.map(m => m.type);
        expect(actualTypes).toEqual(expected.types);
      }
    );
  });

  // --- HoleEntity init/destroy lifecycle per hole ---

  describe('HoleEntity lifecycle', () => {
    let world, scene;

    beforeEach(() => {
      world = makeMockWorld();
      scene = makeMockScene();
      jest.clearAllMocks();
    });

    it.each(configs.map(c => [c.description, c]))(
      '%s — init() succeeds without errors',
      async (_desc, config) => {
        const hole = new HoleEntity(world, config, scene);
        await expect(hole.init()).resolves.not.toThrow();
      }
    );

    it.each(EXPECTED_MECHANICS.map(e => [e.description, e]))(
      '%s — creates the expected number of mechanic instances',
      async (_desc, expected) => {
        const config = configs[expected.index];
        const hole = new HoleEntity(world, config, scene);
        await hole.init();

        expect(hole.mechanics).toHaveLength(expected.types.length);
      }
    );

    it.each(configs.map(c => [c.description, c]))(
      '%s — update() runs without errors',
      async (_desc, config) => {
        const hole = new HoleEntity(world, config, scene);
        await hole.init();

        const ballBody = makeMockBallBody();
        expect(() => hole.update(0.016, ballBody)).not.toThrow();
      }
    );

    it.each(configs.map(c => [c.description, c]))(
      '%s — destroy() cleans up without errors',
      async (_desc, config) => {
        const hole = new HoleEntity(world, config, scene);
        await hole.init();

        expect(() => hole.destroy()).not.toThrow();
        expect(hole.mechanics).toEqual([]);
      }
    );

    it.each(configs.map(c => [c.description, c]))(
      '%s — full lifecycle (init → update → destroy) completes',
      async (_desc, config) => {
        const hole = new HoleEntity(world, config, scene);
        await hole.init();

        const ballBody = makeMockBallBody();
        // Simulate several frames
        for (let i = 0; i < 3; i++) {
          hole.update(0.016, ballBody);
        }

        hole.destroy();

        expect(hole.mechanics).toEqual([]);
        // update after destroy should not throw
        expect(() => hole.update(0.016, ballBody)).not.toThrow();
      }
    );
  });
});
