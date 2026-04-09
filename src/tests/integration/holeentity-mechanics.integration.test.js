/**
 * Integration tests for HoleEntity mechanics lifecycle
 * ISSUE-016
 *
 * Tests that HoleEntity correctly creates, updates, and destroys mechanics
 * from hole config via the MechanicRegistry.
 */

// Mock Three.js before any imports that use it
jest.mock('three', () => {
  const mockVector3 = jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.clone = jest.fn(() => new mockVector3(this.x, this.y, this.z));
    this.copy = jest.fn(function (other) {
      if (other) { this.x = other.x || 0; this.y = other.y || 0; this.z = other.z || 0; }
      return this;
    });
    this.set = jest.fn(function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; });
    this.setY = jest.fn(function (v) { this.y = v; return this; });
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
    this.subVectors = jest.fn((a, b) => { this.x = a.x - b.x; this.y = a.y - b.y; return this; });
    this.length = jest.fn(() => Math.sqrt(this.x * this.x + this.y * this.y));
    this.normalize = jest.fn(() => this);
    this.multiplyScalar = jest.fn((s) => { this.x *= s; this.y *= s; return this; });
    this.addVectors = jest.fn((a, b) => { this.x = a.x + b.x; this.y = a.y + b.y; return this; });
  });

  const mockBox2 = jest.fn(function () {
    this.min = { x: -5, y: -5 };
    this.max = { x: 5, y: 5 };
    this.setFromPoints = jest.fn();
    this.getCenter = jest.fn(target => { target.x = 0; target.y = 0; });
    this.getSize = jest.fn(target => { target.x = 10; target.y = 10; });
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
      x: 0, y: 0, z: 0,
      copy: jest.fn(function (other) { if (other) { this.x = other.x || 0; this.y = other.y || 0; this.z = other.z || 0; } }),
      set: jest.fn(function (x, y, z) { this.x = x; this.y = y; this.z = z; })
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
    Shape: jest.fn(function () { this.holes = []; }),
    ExtrudeGeometry: jest.fn(function () { this.dispose = jest.fn(); this.rotateX = jest.fn(); this.translate = jest.fn(); }),
    MeshStandardMaterial: mockMaterial,
    MeshPhongMaterial: mockMaterial,
    MeshBasicMaterial: mockMaterial,
    Mesh: mockMesh,
    Group: mockGroup,
    CylinderGeometry: jest.fn(mockGeometry),
    PlaneGeometry: jest.fn(mockGeometry),
    CircleGeometry: jest.fn(mockGeometry),
    BoxGeometry: jest.fn(mockGeometry),
    RingGeometry: jest.fn(mockGeometry),
    SphereGeometry: jest.fn(mockGeometry),
    Path: jest.fn(function () { return {}; })
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

import { HoleEntity } from '../../objects/HoleEntity';
import { registerMechanic, createMechanic } from '../../mechanics/MechanicRegistry';
import { MechanicBase } from '../../mechanics/MechanicBase';

// Mock three-csg-ts (used by GreenSurfaceBuilder)
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
    subtract: jest.fn((mesh1) => ({
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
 * A spy-able test mechanic that extends MechanicBase.
 * Tracks all lifecycle calls for assertion.
 */
class SpyMechanic extends MechanicBase {
  constructor(world, group, config, surfaceHeight) {
    super(world, group, config, surfaceHeight);
    this.updateCalls = [];
    this.destroyed = false;

    // Create a mock mesh and body so we can verify resource tracking
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

// Register test mechanic types using unique names to avoid cross-test contamination
const TEST_MECHANIC_TYPE_A = '__integration_test_mechanic_a';
const TEST_MECHANIC_TYPE_B = '__integration_test_mechanic_b';

// Store created instances for inspection
let createdMechanics = [];

function registerTestMechanics() {
  createdMechanics = [];

  registerMechanic(TEST_MECHANIC_TYPE_A, (world, group, config, sh) => {
    const m = new SpyMechanic(world, group, config, sh);
    createdMechanics.push(m);
    return m;
  });

  registerMechanic(TEST_MECHANIC_TYPE_B, (world, group, config, sh) => {
    const m = new SpyMechanic(world, group, config, sh);
    createdMechanics.push(m);
    return m;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HoleEntity mechanics lifecycle (integration)', () => {
  let world, scene;

  beforeEach(() => {
    world = makeMockWorld();
    scene = makeMockScene();
    createdMechanics = [];
    registerTestMechanics();
    jest.clearAllMocks();
  });

  // --- createMechanics via init ---

  describe('init() with mechanics config', () => {
    it('creates mechanic instances via MechanicRegistry', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_MECHANIC_TYPE_A, speed: 1 },
          { type: TEST_MECHANIC_TYPE_B, force: 5 }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      expect(hole.mechanics).toHaveLength(2);
      expect(createdMechanics).toHaveLength(2);
      // Verify configs were passed through
      expect(createdMechanics[0].config.type).toBe(TEST_MECHANIC_TYPE_A);
      expect(createdMechanics[0].config.speed).toBe(1);
      expect(createdMechanics[1].config.type).toBe(TEST_MECHANIC_TYPE_B);
      expect(createdMechanics[1].config.force).toBe(5);
    });

    it('tracks mechanic meshes and bodies in HoleEntity resource arrays', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_MECHANIC_TYPE_A }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // The mechanic's mock mesh and body should appear in HoleEntity's arrays
      const mechanic = createdMechanics[0];
      expect(hole.meshes).toEqual(expect.arrayContaining(mechanic.meshes));
      expect(hole.bodies).toEqual(expect.arrayContaining(mechanic.bodies));
    });
  });

  // --- Backward compatibility ---

  describe('backward compatibility', () => {
    it('works with empty mechanics array', async () => {
      const config = makeMinimalHoleConfig({ mechanics: [] });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      expect(hole.mechanics).toEqual([]);
    });

    it('works with no mechanics property at all', async () => {
      const config = makeMinimalHoleConfig();
      // Ensure no mechanics key
      delete config.mechanics;

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      expect(hole.mechanics).toEqual([]);
    });

    it('update() is safe to call with no mechanics', async () => {
      const config = makeMinimalHoleConfig();
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      expect(() => hole.update(0.016, makeMockBallBody())).not.toThrow();
    });
  });

  // --- update() ---

  describe('update(dt, ballBody)', () => {
    it('calls update on each mechanic with dt and ballBody', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_MECHANIC_TYPE_A },
          { type: TEST_MECHANIC_TYPE_B }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();
      hole.update(0.016, ballBody);

      expect(createdMechanics[0].updateCalls).toHaveLength(1);
      expect(createdMechanics[0].updateCalls[0].dt).toBe(0.016);
      expect(createdMechanics[0].updateCalls[0].ballBody).toBe(ballBody);

      expect(createdMechanics[1].updateCalls).toHaveLength(1);
      expect(createdMechanics[1].updateCalls[0].dt).toBe(0.016);
      expect(createdMechanics[1].updateCalls[0].ballBody).toBe(ballBody);
    });

    it('all mechanics receive updates on every frame', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_MECHANIC_TYPE_A },
          { type: TEST_MECHANIC_TYPE_B }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();

      // Simulate multiple frames
      hole.update(0.016, ballBody);
      hole.update(0.016, ballBody);
      hole.update(0.033, ballBody);

      expect(createdMechanics[0].updateCalls).toHaveLength(3);
      expect(createdMechanics[1].updateCalls).toHaveLength(3);
      expect(createdMechanics[0].updateCalls[2].dt).toBe(0.033);
    });

    it('is safe to call before init', () => {
      const config = makeMinimalHoleConfig();
      const hole = new HoleEntity(world, config, scene);

      // update before init — mechanics array doesn't exist yet
      expect(() => hole.update(0.016, makeMockBallBody())).not.toThrow();
    });
  });

  // --- destroy() ---

  describe('destroy()', () => {
    it('calls destroy on each mechanic', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_MECHANIC_TYPE_A },
          { type: TEST_MECHANIC_TYPE_B }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      hole.destroy();

      expect(createdMechanics[0].destroyed).toBe(true);
      expect(createdMechanics[1].destroyed).toBe(true);
    });

    it('clears the mechanics array after destroy', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_MECHANIC_TYPE_A }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      hole.destroy();

      expect(hole.mechanics).toEqual([]);
    });

    it('removes mechanic bodies from the physics world', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_MECHANIC_TYPE_A }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // The mechanic body was added during creation
      const mechanicBody = createdMechanics[0].bodies[0];
      // Note: we can't check mechanicBody directly since destroy() clears the array,
      // but we can verify removeBody was called
      hole.destroy();

      expect(world.removeBody).toHaveBeenCalled();
    });

    it('is safe to call destroy with no mechanics', async () => {
      const config = makeMinimalHoleConfig();
      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      expect(() => hole.destroy()).not.toThrow();
    });
  });

  // --- Invalid mechanic type ---

  describe('invalid mechanic type handling', () => {
    it('logs a warning for unknown mechanic type and continues', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const config = makeMinimalHoleConfig({
        mechanics: [{ type: '__nonexistent_integration_type' }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Should not have created any mechanics (createMechanic returns null for unknown)
      expect(hole.mechanics).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown mechanic type')
      );

      warnSpy.mockRestore();
    });

    it('creates valid mechanics even if one type is invalid', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_MECHANIC_TYPE_A },
          { type: '__nonexistent_integration_type' },
          { type: TEST_MECHANIC_TYPE_B }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Should have 2 valid mechanics, skipping the invalid one
      expect(hole.mechanics).toHaveLength(2);
      expect(createdMechanics).toHaveLength(2);

      warnSpy.mockRestore();
    });
  });

  // --- Multiple mechanics on same hole ---

  describe('multiple mechanics on the same hole', () => {
    it('creates and independently tracks all mechanics', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_MECHANIC_TYPE_A, id: 'first' },
          { type: TEST_MECHANIC_TYPE_A, id: 'second' },
          { type: TEST_MECHANIC_TYPE_B, id: 'third' }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      expect(hole.mechanics).toHaveLength(3);
      expect(createdMechanics).toHaveLength(3);

      // Each mechanic is a distinct instance
      expect(createdMechanics[0]).not.toBe(createdMechanics[1]);
      expect(createdMechanics[1]).not.toBe(createdMechanics[2]);
    });

    it('updates all mechanics independently each frame', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_MECHANIC_TYPE_A },
          { type: TEST_MECHANIC_TYPE_B },
          { type: TEST_MECHANIC_TYPE_A }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();
      hole.update(0.016, ballBody);

      // All 3 mechanics should have received the update
      for (const m of createdMechanics) {
        expect(m.updateCalls).toHaveLength(1);
        expect(m.updateCalls[0].dt).toBe(0.016);
        expect(m.updateCalls[0].ballBody).toBe(ballBody);
      }
    });

    it('destroys all mechanics on hole destroy', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_MECHANIC_TYPE_A },
          { type: TEST_MECHANIC_TYPE_B },
          { type: TEST_MECHANIC_TYPE_A }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      hole.destroy();

      for (const m of createdMechanics) {
        expect(m.destroyed).toBe(true);
        expect(m.meshes).toEqual([]);
        expect(m.bodies).toEqual([]);
      }
    });
  });

  // --- Full lifecycle ---

  describe('full lifecycle: init → update → destroy', () => {
    it('completes a full lifecycle without errors', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_MECHANIC_TYPE_A },
          { type: TEST_MECHANIC_TYPE_B }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      expect(hole.mechanics).toHaveLength(2);

      // Simulate several frames
      const ballBody = makeMockBallBody();
      for (let i = 0; i < 5; i++) {
        hole.update(0.016, ballBody);
      }

      expect(createdMechanics[0].updateCalls).toHaveLength(5);
      expect(createdMechanics[1].updateCalls).toHaveLength(5);

      // Destroy
      hole.destroy();

      expect(hole.mechanics).toEqual([]);
      expect(createdMechanics[0].destroyed).toBe(true);
      expect(createdMechanics[1].destroyed).toBe(true);

      // update after destroy should not throw
      expect(() => hole.update(0.016, ballBody)).not.toThrow();
    });
  });
});
