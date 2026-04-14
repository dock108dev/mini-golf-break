/**
 * Performance benchmarks for HoleEntity mechanics update loop.
 *
 * Measures per-frame cost of HoleEntity.update() with varying numbers
 * of mechanics to ensure the update loop stays within 60fps budget (< 2ms).
 *
 * Baseline numbers (recorded on initial run):
 *   0 mechanics:  ~0.01ms per update
 *   1 mechanic:   ~0.02ms per update
 *   4 mechanics:  ~0.05ms per update
 *   8 mechanics:  ~0.10ms per update
 *
 * These baselines are approximate and will vary by machine. The key
 * constraint is that 4 mechanics must complete in under 2ms (60fps budget).
 */

import { HoleEntity } from '../../objects/HoleEntity';

// Mock THREE.js
jest.mock('three', () => {
  const mockVector3 = jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.clone = jest.fn(() => new mockVector3(this.x, this.y, this.z));
    this.copy = jest.fn();
    this.set = jest.fn();
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
    this.multiplyScalar = jest.fn(scalar => {
      this.x *= scalar;
      this.y *= scalar;
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

  const mockShape = jest.fn(function () {
    this.holes = [];
  });

  const mockExtrudeGeometry = jest.fn(function () {
    this.dispose = jest.fn();
    this.rotateX = jest.fn();
    this.translate = jest.fn();
  });

  const mockMesh = jest.fn(function () {
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0, set: jest.fn() };
    this.scale = { set: jest.fn() };
    this.castShadow = false;
    this.receiveShadow = false;
    this.geometry = { dispose: jest.fn() };
    this.material = { dispose: jest.fn() };
    this.parent = null;
    this.userData = {};
  });

  const mockGroup = jest.fn(function () {
    this.children = [];
    this.add = jest.fn(child => {
      this.children.push(child);
      child.parent = this;
    });
    this.remove = jest.fn(child => {
      const idx = this.children.indexOf(child);
      if (idx >= 0) {
        this.children.splice(idx, 1);
      }
      child.parent = null;
    });
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0, set: jest.fn() };
    this.traverse = jest.fn();
    this.parent = null;
  });

  return {
    Vector3: mockVector3,
    Vector2: mockVector2,
    Box2: mockBox2,
    Shape: mockShape,
    ExtrudeGeometry: mockExtrudeGeometry,
    Mesh: mockMesh,
    Group: mockGroup,
    MeshStandardMaterial: jest.fn(function () {
      this.dispose = jest.fn();
      this.color = { set: jest.fn() };
    }),
    MeshBasicMaterial: jest.fn(function () {
      this.dispose = jest.fn();
      this.color = { set: jest.fn() };
    }),
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
    BoxGeometry: jest.fn(function () {
      this.dispose = jest.fn();
    }),
    CylinderGeometry: jest.fn(function () {
      this.dispose = jest.fn();
    }),
    SphereGeometry: jest.fn(function () {
      this.dispose = jest.fn();
    }),
    PlaneGeometry: jest.fn(function () {
      this.dispose = jest.fn();
    }),
    CircleGeometry: jest.fn(function () {
      this.dispose = jest.fn();
    }),
    RingGeometry: jest.fn(function () {
      this.dispose = jest.fn();
    }),
    Path: jest.fn(function () {
      this.absarc = jest.fn();
    }),
    Color: jest.fn(function () {
      this.set = jest.fn();
    }),
    DoubleSide: 2,
    FrontSide: 0,
    BackSide: 1
  };
});

// Mock cannon-es
jest.mock('cannon-es', () => ({
  Body: jest.fn(function (opts = {}) {
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.quaternion = { setFromEuler: jest.fn() };
    this.velocity = { x: 0, y: 0, z: 0, set: jest.fn() };
    this.type = opts.type || 1;
    this.addShape = jest.fn();
    this.addEventListener = jest.fn();
    this.removeEventListener = jest.fn();
    this.isTrigger = false;
    this.collisionResponse = true;
    this.mass = opts.mass || 0;
  }),
  Box: jest.fn(),
  Cylinder: jest.fn(),
  Sphere: jest.fn(),
  Vec3: jest.fn(function (x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }),
  Material: jest.fn(),
  ContactMaterial: jest.fn(),
  BODY_TYPES: { STATIC: 2, KINEMATIC: 4 }
}));

// Mock dependencies
jest.mock('../../utils/debug', () => ({
  debug: { log: jest.fn() }
}));

jest.mock('../../objects/GreenSurfaceBuilder', () => ({
  buildGreenSurface: jest.fn(() => {
    const mockTHREE = require('three');
    return {
      mesh: new mockTHREE.Mesh(),
      body: { position: { set: jest.fn() } }
    };
  })
}));

jest.mock('../../objects/hazards/HazardFactory', () => ({
  createHazard: jest.fn(() => ({
    meshes: [],
    body: { position: { set: jest.fn() } },
    destroy: jest.fn()
  }))
}));

// Mock MechanicRegistry
const mockCreateMechanic = jest.fn();
jest.mock('../../mechanics/MechanicRegistry', () => ({
  createMechanic: (...args) => mockCreateMechanic(...args)
}));

jest.mock('../../mechanics/index', () => ({}));

jest.mock('../../objects/HeroPropFactory', () => ({
  createHeroProp: jest.fn(() => [])
}));

jest.mock('../../themes/defaultTheme', () => ({
  defaultTheme: {
    green: { color: 0x2d5a27 },
    wall: { color: 0x8b7355 },
    bumper: { color: 0xcccccc },
    sand: { color: 0xf4e4a6 },
    water: { color: 0x4488cc },
    rim: { color: 0xaaaaaa }
  }
}));

jest.mock('../../objects/BaseElement', () => ({
  BaseElement: class {
    constructor(world, config, scene) {
      const mockTHREE = require('three');
      this.world = world;
      this.config = config;
      this.scene = scene;
      this.group = new mockTHREE.Group();
      this.meshes = [];
      this.bodies = [];
    }
  }
}));

/**
 * Create a mock mechanic that simulates realistic update work.
 * Each update does a small amount of computation (math ops) to
 * approximate the cost of a real mechanic's per-frame logic.
 */
function createMockMechanic(type) {
  let accumulator = 0;
  return {
    config: { type },
    _failed: false,
    update: jest.fn(dt => {
      // Simulate realistic mechanic work: position checks, force calc, etc.
      for (let i = 0; i < 50; i++) {
        accumulator += Math.sin(dt * i) * Math.cos(dt + i);
      }
    }),
    onDtSpike: jest.fn(),
    destroy: jest.fn(),
    getMeshes: jest.fn(() => []),
    getBodies: jest.fn(() => []),
    meshes: [],
    bodies: [],
    _accumulator: accumulator
  };
}

describe('HoleEntity mechanics update loop — performance benchmarks', () => {
  let mockWorld;
  let mockScene;
  let mockConfig;
  let mockBallBody;

  beforeEach(() => {
    mockWorld = {
      addBody: jest.fn(),
      removeBody: jest.fn(),
      addContactMaterial: jest.fn(),
      groundMaterial: { name: 'ground' }
    };

    mockScene = {
      add: jest.fn(),
      remove: jest.fn()
    };

    mockConfig = {
      index: 0,
      startPosition: new THREE.Vector3(0, 0, -5),
      holePosition: new THREE.Vector3(0, 0, 5),
      boundaryShape: [
        { x: -2, y: -10 },
        { x: -2, y: 10 },
        { x: 2, y: 10 },
        { x: 2, y: -10 }
      ],
      hazards: [],
      bumpers: [],
      mechanics: [],
      heroProps: []
    };

    mockBallBody = {
      position: { x: 0, y: 0.2, z: 0, set: jest.fn(), copy: jest.fn() },
      velocity: { x: 1, y: 0, z: 1, set: jest.fn() },
      quaternion: { setFromEuler: jest.fn() }
    };

    mockCreateMechanic.mockReset();
  });

  /**
   * Helper: create a HoleEntity with N mechanics attached directly.
   * Bypasses init() to avoid green surface / wall creation overhead.
   */
  function createHoleEntityWithMechanics(count) {
    const holeEntity = new HoleEntity(mockWorld, mockConfig, mockScene);
    holeEntity.mechanics = [];
    for (let i = 0; i < count; i++) {
      holeEntity.mechanics.push(createMockMechanic(`bench_mechanic_${i}`));
    }
    return holeEntity;
  }

  /**
   * Run update() for a number of iterations and return average time in ms.
   */
  function benchmarkUpdate(holeEntity, iterations = 1000) {
    const dt = 1 / 60; // ~16.67ms frame time
    // Warm-up runs to stabilize JIT
    for (let i = 0; i < 100; i++) {
      holeEntity.update(dt, mockBallBody);
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      holeEntity.update(dt, mockBallBody);
    }
    const elapsed = performance.now() - start;
    return elapsed / iterations;
  }

  test('update() with 0 mechanics completes quickly', () => {
    const holeEntity = createHoleEntityWithMechanics(0);
    const avgMs = benchmarkUpdate(holeEntity);

    // With no mechanics, update should be near-instant (early return)
    expect(avgMs).toBeLessThan(0.5);

    // Document baseline
    // eslint-disable-next-line no-console
    console.log(`[Benchmark] 0 mechanics: ${avgMs.toFixed(4)}ms avg per update`);
  });

  test('update() with 1 mechanic completes quickly', () => {
    const holeEntity = createHoleEntityWithMechanics(1);
    const avgMs = benchmarkUpdate(holeEntity);

    expect(avgMs).toBeLessThan(1);

    // eslint-disable-next-line no-console
    console.log(`[Benchmark] 1 mechanic: ${avgMs.toFixed(4)}ms avg per update`);
  });

  test('update() with 4 mechanics completes in under 2ms (60fps budget)', () => {
    const holeEntity = createHoleEntityWithMechanics(4);
    const avgMs = benchmarkUpdate(holeEntity);

    // Primary acceptance criterion: 4 mechanics under 2ms
    expect(avgMs).toBeLessThan(2);

    // eslint-disable-next-line no-console
    console.log(`[Benchmark] 4 mechanics: ${avgMs.toFixed(4)}ms avg per update`);
  });

  test('update() with 8 mechanics completes in under 4ms', () => {
    const holeEntity = createHoleEntityWithMechanics(8);
    const avgMs = benchmarkUpdate(holeEntity);

    // 8 mechanics = 2x the max expected (H9 has 4). Allow 2x budget.
    expect(avgMs).toBeLessThan(4);

    // eslint-disable-next-line no-console
    console.log(`[Benchmark] 8 mechanics: ${avgMs.toFixed(4)}ms avg per update`);
  });

  test('update time scales roughly linearly with mechanic count', () => {
    const times = {};
    for (const count of [1, 4, 8]) {
      const holeEntity = createHoleEntityWithMechanics(count);
      times[count] = benchmarkUpdate(holeEntity);
    }

    // Linear scaling would give 8x; allow generous headroom because at
    // sub-millisecond timings, timer granularity and GC jitter dominate.
    const ratio = times[8] / times[1];
    expect(ratio).toBeLessThan(30);

    // eslint-disable-next-line no-console
    console.log(`[Benchmark] Scaling ratio (8/1): ${ratio.toFixed(2)}x`);
    // eslint-disable-next-line no-console
    console.log(
      `[Benchmark] Per-mechanic times: 1=${times[1].toFixed(4)}ms, 4=${times[4].toFixed(4)}ms, 8=${times[8].toFixed(4)}ms`
    );
  });

  test('failed mechanics are skipped without performance penalty', () => {
    const holeEntity = createHoleEntityWithMechanics(8);
    // Mark half the mechanics as failed
    for (let i = 0; i < 4; i++) {
      holeEntity.mechanics[i]._failed = true;
    }

    const avgWithFailed = benchmarkUpdate(holeEntity);
    const holeEntity4 = createHoleEntityWithMechanics(4);
    const avgWith4 = benchmarkUpdate(holeEntity4);

    // 8 mechanics with 4 failed should be comparable to 4 active mechanics
    // Allow 2x tolerance for measurement noise
    expect(avgWithFailed).toBeLessThan(avgWith4 * 2);

    // eslint-disable-next-line no-console
    console.log(
      `[Benchmark] 8 mechanics (4 failed): ${avgWithFailed.toFixed(4)}ms vs 4 active: ${avgWith4.toFixed(4)}ms`
    );
  });
});
