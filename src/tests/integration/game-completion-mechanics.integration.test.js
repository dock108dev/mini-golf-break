/**
 * Integration tests for mechanics cleanup on game completion
 * ISSUE-114
 *
 * Verifies that when the final hole is completed and game transitions to
 * GAME_COMPLETED state, all active mechanics on the last hole are properly
 * destroyed, no updates occur after completion, physics world has no orphaned
 * mechanic bodies, and restarting initializes fresh mechanics.
 */

// Mock Three.js before any imports that use it
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
  });

  return {
    Vector3: mockVector3,
    Vector2: mockVector2,
    Box2: mockBox2,
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
    PointLight: jest.fn(function () {
      this.position = { x: 0, y: 0, z: 0, set: jest.fn() };
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
    material: null,
    type: 'STATIC',
    addShape: jest.fn(),
    userData: {}
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

import { HoleEntity } from '../../objects/HoleEntity';
import { registerMechanic } from '../../mechanics/MechanicRegistry';
import { MechanicBase } from '../../mechanics/MechanicBase';
import { GameState } from '../../states/GameState';
import { EventTypes } from '../../events/EventTypes';
import { HoleCompletionManager } from '../../managers/HoleCompletionManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  const bodies = [];
  return {
    addBody: jest.fn(body => bodies.push(body)),
    removeBody: jest.fn(body => {
      const idx = bodies.indexOf(body);
      if (idx !== -1) {
        bodies.splice(idx, 1);
      }
    }),
    addContactMaterial: jest.fn(),
    step: jest.fn(),
    groundMaterial: { name: 'ground' },
    bodies
  };
}

function makeMockScene() {
  return {
    add: jest.fn(),
    remove: jest.fn(),
    children: []
  };
}

function makeMinimalHoleConfig(overrides = {}) {
  const THREE = require('three');
  return {
    index: 0,
    startPosition: new THREE.Vector3(0, 0, -5),
    holePosition: new THREE.Vector3(0, 0, 5),
    boundaryShape: [
      { x: -3, y: -10 },
      { x: -3, y: 10 },
      { x: 3, y: 10 },
      { x: 3, y: -10 }
    ],
    ...overrides
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

/**
 * Spy mechanic that tracks all lifecycle calls.
 */
class SpyMechanic extends MechanicBase {
  constructor(world, group, config, surfaceHeight) {
    super(world, group, config, surfaceHeight);
    this.updateCalls = [];
    this.destroyed = false;

    const mockMesh = {
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() },
      parent: group
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
  }

  update(dt, ballBody) {
    this.updateCalls.push({ dt, ballBody });
  }

  destroy() {
    this.destroyed = true;
    super.destroy();
  }
}

const TEST_MECHANIC_A = '__gc_test_mechanic_a';
const TEST_MECHANIC_B = '__gc_test_mechanic_b';

let createdMechanics = [];

function registerTestMechanics() {
  createdMechanics = [];

  registerMechanic(TEST_MECHANIC_A, (world, group, config, sh) => {
    const m = new SpyMechanic(world, group, config, sh);
    createdMechanics.push(m);
    return m;
  });

  registerMechanic(TEST_MECHANIC_B, (world, group, config, sh) => {
    const m = new SpyMechanic(world, group, config, sh);
    createdMechanics.push(m);
    return m;
  });
}

/**
 * Creates a minimal mock game object that mimics the Game coordinator,
 * including StateManager, EventManager, and CoursesManager behavior.
 */
function makeMockGame(world, scene) {
  const subscribers = {};
  const eventManager = {
    subscribe: jest.fn((event, handler, ctx) => {
      if (!subscribers[event]) {
        subscribers[event] = [];
      }
      subscribers[event].push({ handler, ctx });
    }),
    publish: jest.fn((event, data, source) => {
      if (subscribers[event]) {
        for (const sub of subscribers[event]) {
          sub.handler.call(sub.ctx, data);
        }
      }
    }),
    _subscribers: subscribers
  };

  let gameState = GameState.PLAYING;
  let currentHoleNumber = 1;
  let holeCompleted = false;

  const stateManager = {
    getCurrentHoleNumber: jest.fn(() => currentHoleNumber),
    setCurrentHoleNumber: jest.fn(n => {
      currentHoleNumber = n;
    }),
    isHoleCompleted: jest.fn(() => holeCompleted),
    setHoleCompleted: jest.fn(val => {
      holeCompleted = val;
    }),
    setGameState: jest.fn(state => {
      gameState = state;
    }),
    getGameState: jest.fn(() => gameState),
    resetForNextHole: jest.fn(() => {
      currentHoleNumber++;
      holeCompleted = false;
    }),
    state: { debugMode: false }
  };

  const scoringSystem = {
    getTotalStrokes: jest.fn(() => 10),
    getHoleStrokes: jest.fn(() => 2),
    resetStrokes: jest.fn()
  };

  const uiManager = {
    updateScore: jest.fn(),
    showMessage: jest.fn(),
    updateHoleNumber: jest.fn(),
    updatePar: jest.fn(),
    showTransitionOverlay: jest.fn(),
    hideTransitionOverlay: jest.fn(),
    updateHoleInfo: jest.fn()
  };

  const audioManager = {
    playSound: jest.fn()
  };

  const ballManager = {
    ball: {
      body: makeMockBallBody(),
      handleHoleSuccess: jest.fn()
    },
    removeBall: jest.fn(),
    createBall: jest.fn(() => true)
  };

  const debugManager = {
    log: jest.fn()
  };

  return {
    eventManager,
    stateManager,
    scoringSystem,
    uiManager,
    audioManager,
    ballManager,
    debugManager,
    scene,
    course: null, // set after creating course mock
    holeCompletionManager: null, // set after creating
    holeTransitionManager: null,
    _setCurrentHoleNumber: n => {
      currentHoleNumber = n;
    },
    _getGameState: () => gameState,
    _resetGameState: () => {
      gameState = GameState.PLAYING;
      holeCompleted = false;
      currentHoleNumber = 1;
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Mechanics cleanup on game completion (ISSUE-114)', () => {
  let world, scene, mockGame;

  beforeEach(() => {
    world = makeMockWorld();
    scene = makeMockScene();
    createdMechanics = [];
    registerTestMechanics();
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Helper: create a HoleEntity with mechanics, simulate a game on the final hole,
   * and trigger game completion via HoleCompletionManager.
   */
  async function setupFinalHoleWithMechanics(totalHoles = 9) {
    const config = makeMinimalHoleConfig({
      index: totalHoles - 1,
      mechanics: [
        { type: TEST_MECHANIC_A, speed: 1 },
        { type: TEST_MECHANIC_B, force: 5 }
      ]
    });

    const hole = new HoleEntity(world, config, scene);
    await hole.init();

    mockGame = makeMockGame(world, scene);
    mockGame._setCurrentHoleNumber(totalHoles);

    // Wire up a mock course that holds our hole entity
    mockGame.course = {
      getTotalHoles: jest.fn(() => totalHoles),
      getCurrentHoleMesh: jest.fn(() => null),
      getHolePar: jest.fn(() => 3),
      currentHoleEntity: hole,
      clearCurrentHole: jest.fn(() => {
        hole.destroy();
      }),
      update: jest.fn(dt => {
        const ballBody = mockGame.ballManager?.ball?.body || null;
        hole.update(dt, ballBody);
      })
    };

    // Create and init HoleCompletionManager
    const hcm = new HoleCompletionManager(mockGame);
    hcm.init();
    mockGame.holeCompletionManager = hcm;

    return { hole, hcm };
  }

  // -------------------------------------------------------------------------
  // AC1: completing the 9th hole triggers destroy() on all active mechanics
  // -------------------------------------------------------------------------

  describe('completing the final hole triggers destroy() on all active mechanics', () => {
    it('calls destroy() on every mechanic when the 9th hole is completed', async () => {
      const { hole, hcm } = await setupFinalHoleWithMechanics(9);

      // Verify mechanics are alive before completion
      expect(hole.mechanics).toHaveLength(2);
      expect(createdMechanics[0].destroyed).toBe(false);
      expect(createdMechanics[1].destroyed).toBe(false);

      // Trigger game completion (ball enters hole on final hole)
      hcm.handleBallInHole();

      // State should be GAME_COMPLETED
      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.GAME_COMPLETED);

      // Now simulate the course cleanup that happens after game completion
      mockGame.course.clearCurrentHole();

      // All mechanics should be destroyed
      expect(createdMechanics[0].destroyed).toBe(true);
      expect(createdMechanics[1].destroyed).toBe(true);
      expect(hole.mechanics).toEqual([]);
    });

    it('mechanic bodies are removed from physics world after cleanup', async () => {
      const { hole } = await setupFinalHoleWithMechanics(9);

      // Capture mechanic bodies before destroy
      const mechanicBodiesCount = createdMechanics.reduce((sum, m) => sum + m.bodies.length, 0);
      expect(mechanicBodiesCount).toBeGreaterThan(0);

      // Trigger cleanup
      mockGame.course.clearCurrentHole();

      // All mechanic bodies should have been removed
      for (const m of createdMechanics) {
        expect(m.bodies).toEqual([]);
      }
      expect(world.removeBody).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // AC2: no mechanic update() calls occur after GAME_COMPLETED state
  // -------------------------------------------------------------------------

  describe('no mechanic update() calls after GAME_COMPLETED', () => {
    it('does not call update() on mechanics after game completion and cleanup', async () => {
      const { hole, hcm } = await setupFinalHoleWithMechanics(9);

      const ballBody = makeMockBallBody();

      // Simulate a few normal frames
      hole.update(0.016, ballBody);
      hole.update(0.016, ballBody);
      expect(createdMechanics[0].updateCalls).toHaveLength(2);
      expect(createdMechanics[1].updateCalls).toHaveLength(2);

      // Complete the game
      hcm.handleBallInHole();
      mockGame.course.clearCurrentHole();

      // Record current update call counts
      const countA = createdMechanics[0].updateCalls.length;
      const countB = createdMechanics[1].updateCalls.length;

      // Attempt to update after destruction — mechanics array is empty, so no updates
      hole.update(0.016, ballBody);
      hole.update(0.016, ballBody);

      // Update counts should not have increased
      expect(createdMechanics[0].updateCalls).toHaveLength(countA);
      expect(createdMechanics[1].updateCalls).toHaveLength(countB);
    });

    it('course.update() does not propagate to destroyed mechanics', async () => {
      const { hole, hcm } = await setupFinalHoleWithMechanics(9);

      // Complete the game and destroy the hole
      hcm.handleBallInHole();
      mockGame.course.clearCurrentHole();

      const countA = createdMechanics[0].updateCalls.length;

      // Simulate the game loop continuing to call course.update() after completion
      // The hole's mechanics array is empty, so no updates should propagate
      mockGame.course.update(0.016);

      expect(createdMechanics[0].updateCalls).toHaveLength(countA);
    });
  });

  // -------------------------------------------------------------------------
  // AC3: physics world has no orphaned mechanic bodies after game completion
  // -------------------------------------------------------------------------

  describe('no orphaned mechanic bodies in physics world', () => {
    it('all mechanic bodies are removed from the world after game completion cleanup', async () => {
      const { hole, hcm } = await setupFinalHoleWithMechanics(9);

      // Before completion, world has mechanic bodies
      const bodiesBeforeCleanup = world.bodies.length;
      expect(bodiesBeforeCleanup).toBeGreaterThan(0);

      // Complete game and cleanup
      hcm.handleBallInHole();
      mockGame.course.clearCurrentHole();

      // All mechanic bodies should be gone from the world
      // (Only non-mechanic bodies, if any, should remain)
      expect(world.bodies.length).toBe(0);
    });

    it('removeBody is called for every mechanic body', async () => {
      const { hole, hcm } = await setupFinalHoleWithMechanics(9);

      // Capture all mechanic bodies
      const allMechanicBodies = [];
      for (const m of createdMechanics) {
        allMechanicBodies.push(...m.bodies);
      }
      expect(allMechanicBodies.length).toBeGreaterThan(0);

      // Complete game and cleanup
      hcm.handleBallInHole();
      mockGame.course.clearCurrentHole();

      for (const body of allMechanicBodies) {
        expect(world.removeBody).toHaveBeenCalledWith(body);
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC4: restarting the game after completion initializes fresh mechanics
  // -------------------------------------------------------------------------

  describe('restarting the game initializes fresh mechanics (no stale state)', () => {
    it('creates new mechanic instances on re-initialization after game completion', async () => {
      const { hole: firstHole, hcm } = await setupFinalHoleWithMechanics(9);

      // Complete game and cleanup
      hcm.handleBallInHole();
      mockGame.course.clearCurrentHole();

      // Snapshot old mechanics
      const oldMechanics = [...createdMechanics];
      expect(oldMechanics[0].destroyed).toBe(true);
      expect(oldMechanics[1].destroyed).toBe(true);

      // Simulate "restart": create a new hole entity with the same config
      const freshConfig = makeMinimalHoleConfig({
        index: 0,
        mechanics: [
          { type: TEST_MECHANIC_A, speed: 1 },
          { type: TEST_MECHANIC_B, force: 5 }
        ]
      });

      const freshWorld = makeMockWorld();
      const freshHole = new HoleEntity(freshWorld, freshConfig, scene);
      await freshHole.init();

      // New mechanics should have been created (createdMechanics now has 4 total)
      const newMechanics = createdMechanics.slice(2);
      expect(newMechanics).toHaveLength(2);

      // New mechanics should be fresh (not destroyed, no prior update calls)
      expect(newMechanics[0].destroyed).toBe(false);
      expect(newMechanics[1].destroyed).toBe(false);
      expect(newMechanics[0].updateCalls).toHaveLength(0);
      expect(newMechanics[1].updateCalls).toHaveLength(0);

      // New mechanics should be different instances from the old ones
      expect(newMechanics[0]).not.toBe(oldMechanics[0]);
      expect(newMechanics[1]).not.toBe(oldMechanics[1]);

      // New hole entity should have its own independent mechanics
      expect(freshHole.mechanics).toHaveLength(2);
    });

    it('fresh mechanics respond to updates independently of old destroyed mechanics', async () => {
      const { hole: firstHole, hcm } = await setupFinalHoleWithMechanics(9);

      // Update old mechanics a few times
      const ballBody = makeMockBallBody();
      firstHole.update(0.016, ballBody);
      firstHole.update(0.016, ballBody);

      // Complete game and cleanup
      hcm.handleBallInHole();
      mockGame.course.clearCurrentHole();

      const oldUpdateCountA = createdMechanics[0].updateCalls.length;

      // Restart with fresh hole
      const freshConfig = makeMinimalHoleConfig({
        index: 0,
        mechanics: [{ type: TEST_MECHANIC_A }]
      });
      const freshWorld = makeMockWorld();
      const freshHole = new HoleEntity(freshWorld, freshConfig, scene);
      await freshHole.init();

      const freshMechanic = createdMechanics[createdMechanics.length - 1];

      // Update the fresh hole
      freshHole.update(0.016, ballBody);

      // Fresh mechanic should have exactly 1 update call
      expect(freshMechanic.updateCalls).toHaveLength(1);

      // Old mechanic should NOT have received any additional updates
      expect(createdMechanics[0].updateCalls).toHaveLength(oldUpdateCountA);
    });

    it('fresh mechanics register their bodies in the new physics world', async () => {
      const { hole, hcm } = await setupFinalHoleWithMechanics(9);

      // Complete and cleanup
      hcm.handleBallInHole();
      mockGame.course.clearCurrentHole();
      expect(world.bodies.length).toBe(0);

      // Restart with a fresh world (simulating physics reset)
      const freshWorld = makeMockWorld();
      const freshConfig = makeMinimalHoleConfig({
        index: 0,
        mechanics: [{ type: TEST_MECHANIC_A }, { type: TEST_MECHANIC_B }]
      });
      const freshHole = new HoleEntity(freshWorld, freshConfig, scene);
      await freshHole.init();

      // New mechanics should have registered their bodies in the new world
      expect(freshWorld.bodies.length).toBeGreaterThan(0);
      expect(freshWorld.addBody).toHaveBeenCalled();
    });
  });
});
