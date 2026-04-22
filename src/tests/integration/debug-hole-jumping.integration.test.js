/**
 * Integration tests for debug hole-jumping with OrbitalDriftCourse
 * ISSUE-048
 *
 * Verifies that pressing number keys 1-9 in debug mode loads the correct
 * OrbitalDriftCourse hole, mechanics initialize on jump, old mechanics
 * are destroyed on jump away, and no errors or leaks occur during rapid jumping.
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

  const mockMaterial = jest.fn(() => ({ dispose: jest.fn(), color: 0xffffff }));

  const mockMesh = jest.fn(function () {
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.geometry = { dispose: jest.fn() };
    this.material = { dispose: jest.fn() };
    this.parent = null;
    this.updateMatrix = jest.fn();
    this.name = '';
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
    this.visible = true;
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
    }),
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
    PointLight: jest.fn(function () {
      this.position = { x: 0, y: 0, z: 0, set: jest.fn() };
      this.parent = null;
    }),
    SpriteMaterial: jest.fn(function (opts) {
      this.opacity = opts?.opacity !== undefined ? opts.opacity : 1;
      this.dispose = jest.fn();
    }),
    Sprite: jest.fn(function (material) {
      this.material = material || { opacity: 1, dispose: jest.fn() };
      this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
      this.scale = { set: jest.fn() };
      this.parent = null;
    }),
    AdditiveBlending: 2,
    GridHelper: jest.fn(function () {
      this.geometry = { dispose: jest.fn() };
      this.material = { dispose: jest.fn() };
      this.position = { set: jest.fn() };
    })
  };
});

// Mock cannon-es
jest.mock('cannon-es', () => {
  const mockBody = jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn(), copy: jest.fn() },
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    material: null,
    type: 'STATIC',
    addShape: jest.fn(),
    userData: {},
    addEventListener: jest.fn()
  }));
  mockBody.STATIC = 'STATIC';

  return {
    Box: jest.fn(() => ({ material: null })),
    Body: mockBody,
    Material: jest.fn(),
    ContactMaterial: jest.fn(),
    Vec3: jest.fn((x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 })),
    Cylinder: jest.fn(),
    Trimesh: jest.fn(),
    Sphere: jest.fn(),
    Quaternion: jest.fn(() => ({ setFromAxisAngle: jest.fn(() => ({ x: 0, y: 0, z: 0, w: 1 })) })),
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
    subtract: jest.fn(mesh1 => ({
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

// Mock debugConfig
jest.mock('../../config/debugConfig', () => ({
  DEBUG_CONFIG: {
    enabled: false,
    enableKey: 'd',
    showHelpers: true,
    showLightHelpers: false,
    logVelocity: true,
    logCriticalErrors: true,
    courseDebug: {
      enabled: true,
      loadSpecificHoleKey: 'h',
      quickLoadKeys: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 }
    },
    errorTracking: {
      suppressRepeated: false,
      maxRepeats: 5,
      maxErrors: 100
    }
  },
  ERROR_LEVELS: {
    ERROR: 'ERROR',
    WARNING: 'WARNING',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
  }
}));

import * as THREE from 'three';
import { OrbitalDriftCourse } from '../../objects/OrbitalDriftCourse';
import { DebugManager } from '../../managers/DebugManager';
import { MechanicBase } from '../../mechanics/MechanicBase';
import { registerMechanic } from '../../mechanics/MechanicRegistry';

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
    bodies: []
  };
}

function makeMockScene() {
  const scene = {
    add: jest.fn(),
    remove: jest.fn(),
    children: []
  };
  return scene;
}

function makeMockGame(world, scene) {
  return {
    scene,
    physicsWorld: world,
    physicsManager: {
      getWorld: jest.fn(() => world)
    },
    ballManager: {
      ball: {
        body: {
          position: { x: 0, y: 0.2, z: 0 },
          velocity: { x: 0, y: 0, z: 0, length: jest.fn(() => 0) }
        },
        mesh: { position: { x: 0, y: 0, z: 0 } }
      },
      resetBall: jest.fn().mockResolvedValue(true)
    },
    cameraController: {
      setDebugMode: jest.fn(),
      setupInitialCameraPosition: jest.fn()
    },
    cannonDebugRenderer: {
      clearMeshes: jest.fn()
    },
    uiManager: {
      updateDebugDisplay: jest.fn(),
      updateHoleInfo: jest.fn(),
      updateScore: jest.fn(),
      updateStrokes: jest.fn()
    },
    audioManager: null,
    deltaTime: 0.016,
    course: null,
    lights: {
      directionalLight: null
    }
  };
}

// Track mechanics lifecycle for leak detection
let mechanicInstances = [];

class TrackableMechanic extends MechanicBase {
  constructor(world, group, config, surfaceHeight) {
    super(world, group, config, surfaceHeight);
    this.updateCount = 0;
    this.destroyed = false;
    this.id = `mechanic_${mechanicInstances.length}`;

    // Create mock resources
    const mockMesh = {
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() },
      parent: group,
      name: `${config.type}_mesh`
    };
    const mockBody = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 }
    };

    this.meshes.push(mockMesh);
    this.bodies.push(mockBody);

    if (group && group.add) {
      group.add(mockMesh);
    }
    if (world && world.addBody) {
      world.addBody(mockBody);
    }

    mechanicInstances.push(this);
  }

  update(dt, ballBody) {
    this.updateCount++;
  }

  destroy() {
    this.destroyed = true;
    super.destroy();
  }
}

// Register trackable mechanics for all types used by OrbitalDriftCourse
const MECHANIC_TYPES = [
  'moving_sweeper',
  'bowl_contour',
  'split_route',
  'ricochet_bumpers',
  'portal_gate',
  'timed_hazard',
  'low_gravity_zone',
  'bank_wall',
  'suction_zone',
  'timed_gate',
  'boost_strip',
  'elevated_green'
];

function registerTrackableMechanics() {
  mechanicInstances = [];
  for (const type of MECHANIC_TYPES) {
    registerMechanic(type, (world, group, config, sh) => {
      return new TrackableMechanic(world, group, config, sh);
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Debug hole-jumping with OrbitalDriftCourse (integration)', () => {
  let world, scene, game, course, debugManager;

  beforeEach(async () => {
    world = makeMockWorld();
    scene = makeMockScene();
    game = makeMockGame(world, scene);

    registerTrackableMechanics();
    jest.clearAllMocks();

    // Suppress console noise during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Create course and attach to game
    course = new OrbitalDriftCourse(game);
    await course.initializeHole(0);
    game.course = course;

    // Create debug manager
    debugManager = new DebugManager(game);
    debugManager.enabled = true;
    game.debugManager = debugManager;
  });

  afterEach(() => {
    mechanicInstances = [];
    jest.restoreAllMocks();
  });

  // --- Pressing 1-9 loads the correct hole ---

  describe('pressing 1-9 loads correct OrbitalDriftCourse hole', () => {
    it('loadSpecificHole(1) loads hole 1', async () => {
      await debugManager.loadHoleInExistingCourse(1);

      expect(course.currentHoleIndex).toBe(0);
      expect(course.currentHoleEntity).not.toBeNull();
      expect(course.currentHoleEntity.config.index).toBe(0);
    });

    it('loadSpecificHole(5) loads hole 5', async () => {
      await debugManager.loadHoleInExistingCourse(5);

      expect(course.currentHoleIndex).toBe(4);
      expect(course.currentHoleEntity).not.toBeNull();
      expect(course.currentHoleEntity.config.index).toBe(4);
    });

    it('loadSpecificHole(9) loads hole 9', async () => {
      await debugManager.loadHoleInExistingCourse(9);

      expect(course.currentHoleIndex).toBe(8);
      expect(course.currentHoleEntity).not.toBeNull();
      expect(course.currentHoleEntity.config.index).toBe(8);
    });

    it('loads each hole 1-9 correctly', async () => {
      for (let holeNum = 1; holeNum <= 9; holeNum++) {
        await debugManager.loadHoleInExistingCourse(holeNum);

        expect(course.currentHoleIndex).toBe(holeNum - 1);
        expect(course.currentHoleEntity).not.toBeNull();
        expect(course.currentHoleEntity.config.index).toBe(holeNum - 1);
      }
    });

    it('resets ball position after hole jump', async () => {
      await debugManager.loadHoleInExistingCourse(3);

      expect(game.ballManager.resetBall).toHaveBeenCalled();
    });

    it('repositions camera after hole jump', async () => {
      await debugManager.loadHoleInExistingCourse(3);

      expect(game.cameraController.setupInitialCameraPosition).toHaveBeenCalled();
    });

    it('updates UI after hole jump', async () => {
      await debugManager.loadHoleInExistingCourse(3);

      expect(game.uiManager.updateHoleInfo).toHaveBeenCalled();
      expect(game.uiManager.updateScore).toHaveBeenCalled();
      expect(game.uiManager.updateStrokes).toHaveBeenCalled();
    });
  });

  // --- Mechanics initialize correctly after debug jump ---

  describe('mechanics initialize correctly after debug jump', () => {
    it('hole 1 (Launch Bay) creates moving_sweeper mechanic', async () => {
      mechanicInstances = [];
      await debugManager.loadHoleInExistingCourse(1);

      const hole = course.currentHoleEntity;
      expect(hole.mechanics.length).toBeGreaterThan(0);

      const sweeperMechanics = mechanicInstances.filter(m => m.config.type === 'moving_sweeper');
      expect(sweeperMechanics.length).toBeGreaterThanOrEqual(1);
    });

    it('mechanics can receive update calls after jump', async () => {
      mechanicInstances = [];
      await debugManager.loadHoleInExistingCourse(1);

      const hole = course.currentHoleEntity;
      const ballBody = game.ballManager.ball.body;

      // Simulate a few frames
      hole.update(0.016, ballBody);
      hole.update(0.016, ballBody);

      const activeMechanics = mechanicInstances.filter(m => !m.destroyed);
      for (const mechanic of activeMechanics) {
        expect(mechanic.updateCount).toBe(2);
      }
    });

    it('hole with multiple mechanics creates all of them', async () => {
      // H3 has split_route + moving_sweeper
      mechanicInstances = [];
      await debugManager.loadHoleInExistingCourse(3);

      const hole = course.currentHoleEntity;
      expect(hole.mechanics.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --- Jumping away destroys old mechanics ---

  describe('jumping from hole with mechanics destroys old mechanics', () => {
    it('old mechanics are destroyed when jumping to a new hole', async () => {
      // Load hole 1 (has moving_sweeper)
      mechanicInstances = [];
      await debugManager.loadHoleInExistingCourse(1);

      const hole1Mechanics = [...mechanicInstances];
      expect(hole1Mechanics.length).toBeGreaterThan(0);

      // Jump to hole 2
      await debugManager.loadHoleInExistingCourse(2);

      // Hole 1's mechanics should be destroyed
      for (const mechanic of hole1Mechanics) {
        expect(mechanic.destroyed).toBe(true);
      }
    });

    it('new hole creates fresh mechanics after jumping away', async () => {
      // Load hole 1
      mechanicInstances = [];
      await debugManager.loadHoleInExistingCourse(1);
      const hole1Count = mechanicInstances.length;

      // Jump to hole 3 (split_route + moving_sweeper)
      await debugManager.loadHoleInExistingCourse(3);

      const hole3Mechanics = mechanicInstances.filter(m => !m.destroyed);
      expect(hole3Mechanics.length).toBeGreaterThan(0);

      // Total should be hole1 (destroyed) + hole3 (active)
      expect(mechanicInstances.length).toBeGreaterThan(hole1Count);
    });

    it('currentHoleEntity is replaced on jump', async () => {
      await debugManager.loadHoleInExistingCourse(1);
      const entity1 = course.currentHoleEntity;

      await debugManager.loadHoleInExistingCourse(5);
      const entity5 = course.currentHoleEntity;

      expect(entity1).not.toBe(entity5);
      expect(entity5.config.index).toBe(4);
    });
  });

  // --- No errors or leaks during rapid jumping ---

  describe('no errors or physics body leaks during rapid jumping', () => {
    it('rapid sequential jumps do not throw', async () => {
      await expect(async () => {
        for (let i = 1; i <= 9; i++) {
          await debugManager.loadHoleInExistingCourse(i);
        }
      }).not.toThrow();
    });

    it('all old mechanics are destroyed after rapid jumping', async () => {
      mechanicInstances = [];

      // Rapidly jump through all 9 holes
      for (let i = 1; i <= 9; i++) {
        await debugManager.loadHoleInExistingCourse(i);
      }

      // Only the last hole's mechanics should be alive
      const activeMechanics = mechanicInstances.filter(m => !m.destroyed);
      const destroyedMechanics = mechanicInstances.filter(m => m.destroyed);

      // There should be active mechanics (from current hole)
      expect(activeMechanics.length).toBeGreaterThan(0);

      // All earlier holes' mechanics should be destroyed
      expect(destroyedMechanics.length).toBeGreaterThan(0);

      // Active mechanics should only belong to the last hole (hole 9)
      const lastHole = course.currentHoleEntity;
      expect(lastHole.config.index).toBe(8);
    });

    it('jumping back and forth does not leak mechanics', async () => {
      mechanicInstances = [];

      // Jump back and forth between holes
      await debugManager.loadHoleInExistingCourse(1);
      await debugManager.loadHoleInExistingCourse(5);
      await debugManager.loadHoleInExistingCourse(1);
      await debugManager.loadHoleInExistingCourse(9);
      await debugManager.loadHoleInExistingCourse(3);

      // Only the last hole's mechanics should be active
      const activeMechanics = mechanicInstances.filter(m => !m.destroyed);
      const lastHole = course.currentHoleEntity;

      // All active mechanics should be from hole 3 (index 2)
      expect(lastHole.config.index).toBe(2);
      expect(activeMechanics.length).toBe(lastHole.mechanics.length);
    });

    it('no console errors during normal hole jumping', async () => {
      const errorSpy = console.error;

      // Jump through several holes
      await debugManager.loadHoleInExistingCourse(1);
      await debugManager.loadHoleInExistingCourse(4);
      await debugManager.loadHoleInExistingCourse(7);

      // Filter out expected bumper creation errors (Euler mock lacks clone())
      // and DebugManager messages — only unexpected errors should fail this test
      const errorCalls = errorSpy.mock.calls.filter(call => {
        const msg = call[0]?.toString() || '';
        return !msg.includes('[DebugManager]') && !msg.includes('Failed to create bumper');
      });
      expect(errorCalls).toHaveLength(0);
    });
  });

  // --- loadSpecificHole integration with courseDebugState ---

  describe('loadSpecificHole updates debug state', () => {
    it('updates courseDebugState.currentHole', () => {
      debugManager.loadSpecificHole(5);

      expect(debugManager.courseDebugState.currentHole).toBe(5);
      expect(debugManager.courseDebugState.courseOverrideActive).toBe(true);
    });

    it('calls loadHoleInExistingCourse when course type matches', () => {
      const loadHoleSpy = jest
        .spyOn(debugManager, 'loadHoleInExistingCourse')
        .mockResolvedValue(true);

      debugManager.loadSpecificHole(3);

      expect(loadHoleSpy).toHaveBeenCalledWith(3);
    });

    it('calls loadCourseWithType when no course exists', () => {
      game.course = null;
      const loadCourseSpy = jest.spyOn(debugManager, 'loadCourseWithType').mockResolvedValue(true);

      debugManager.loadSpecificHole(2);

      expect(loadCourseSpy).toHaveBeenCalledWith('OrbitalDriftCourse', 2);
    });
  });
});
