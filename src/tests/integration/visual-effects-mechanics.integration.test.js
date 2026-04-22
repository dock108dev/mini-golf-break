/**
 * Integration tests for visual effects compatibility with active mechanics
 * ISSUE-112
 *
 * Verifies that VisualEffectsManager particle effects work correctly when
 * mechanics are active on the same hole. Force field meshes should not
 * interfere with particle rendering. Hole completion effects should play
 * correctly regardless of active mechanics.
 */

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
    setAttribute: jest.fn(),
    getAttribute: jest.fn(() => ({
      array: new Float32Array(120),
      needsUpdate: false
    })),
    attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]) } },
    index: { array: new Uint16Array([0, 1, 2, 2, 3, 0]) }
  });

  const mockMaterial = jest.fn(() => ({
    dispose: jest.fn(),
    color: 0xffffff,
    opacity: 1.0,
    transparent: true
  }));

  const mockMesh = jest.fn(function () {
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.geometry = mockGeometry();
    this.material = mockMaterial();
    this.parent = null;
    this.updateMatrix = jest.fn();
    this.name = '';
    this.isMesh = true;
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

  const mockPoints = jest.fn(function (geometry, material) {
    this.geometry = geometry || mockGeometry();
    this.material = material || mockMaterial();
    this.isPoints = true;
  });

  const mockBufferAttribute = jest.fn(function (array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.needsUpdate = false;
  });

  const mockBufferGeometry = jest.fn(function () {
    this._attributes = {};
    this.setFromPoints = jest.fn().mockReturnValue(this);
    this.setAttribute = jest.fn((name, attr) => {
      this._attributes[name] = attr;
    });
    this.getAttribute = jest.fn(name => this._attributes[name]);
    this.dispose = jest.fn();
  });

  const mockPointsMaterial = jest.fn(function (params) {
    this.size = params?.size || 1;
    this.vertexColors = params?.vertexColors || false;
    this.transparent = params?.transparent || false;
    this.opacity = params?.opacity ?? 1.0;
    this.depthWrite = params?.depthWrite ?? true;
    this.dispose = jest.fn();
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
    Mesh: mockMesh,
    Group: mockGroup,
    Points: mockPoints,
    PointsMaterial: mockPointsMaterial,
    BufferGeometry: mockBufferGeometry,
    LineBasicMaterial: jest.fn(function () {
      this.color = 0xffffff;
      this.dispose = jest.fn();
    }),
    Line: jest.fn(function (geometry, material) {
      this.geometry = geometry || { dispose: jest.fn() };
      this.material = material || { dispose: jest.fn() };
      this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    }),
    BufferAttribute: mockBufferAttribute,
    Float32BufferAttribute: mockBufferAttribute,
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

jest.mock('cannon-es', () => {
  const mockVec3 = jest.fn(function (x, y, z) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
    this.scale = jest.fn(s => new mockVec3(this.x * s, this.y * s, this.z * s));
  });

  const mockBody = jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, set: jest.fn(), copy: jest.fn() },
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    force: { x: 0, y: 0, z: 0, set: jest.fn() },
    material: null,
    type: 'STATIC',
    sleepState: 0,
    addShape: jest.fn(),
    applyForce: jest.fn(),
    wakeUp: jest.fn(),
    userData: {}
  }));
  mockBody.STATIC = 'STATIC';
  mockBody.SLEEPING = 2;

  return {
    Box: jest.fn(() => ({ material: null })),
    Body: mockBody,
    Material: jest.fn(),
    ContactMaterial: jest.fn(),
    Vec3: mockVec3,
    Cylinder: jest.fn(),
    Trimesh: jest.fn(),
    Sphere: jest.fn(),
    Quaternion: jest.fn(() => ({ setFromAxisAngle: jest.fn(() => ({ x: 0, y: 0, z: 0, w: 1 })) })),
    BODY_TYPES: { STATIC: 'STATIC' }
  };
});

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

jest.mock('../../objects/HeroPropFactory', () => ({
  createHeroProp: jest.fn(() => [])
}));

import { VisualEffectsManager } from '../../managers/VisualEffectsManager';
import { HoleEntity } from '../../objects/HoleEntity';
import { registerMechanic } from '../../mechanics/MechanicRegistry';
import { MechanicBase } from '../../mechanics/MechanicBase';
import * as THREE from 'three';

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
    sleepState: 0,
    applyForce: jest.fn(),
    wakeUp: jest.fn()
  };
}

/**
 * Force-field mechanic for testing — has isForceField=true and creates meshes.
 */
class MockForceFieldMechanic extends MechanicBase {
  constructor(world, group, config, surfaceHeight) {
    super(world, group, config, surfaceHeight);
    this.isForceField = true;
    this.updateCalls = [];
    this.destroyed = false;

    // Create a mock mesh simulating a semi-transparent force field overlay
    const mockMesh = {
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn(), transparent: true, opacity: 0.6, emissive: 0x00ffaa },
      position: { x: 0, y: 0, z: 0, set: jest.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      parent: group,
      isMesh: true,
      name: 'force_field_mesh'
    };
    const mockBody = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      userData: { type: 'force_field' }
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
    // Simulate applying a force (like BoostStrip does)
    if (ballBody && ballBody.applyForce) {
      ballBody.applyForce({ x: 5, y: 0, z: 0 });
    }
  }

  destroy() {
    this.destroyed = true;
    super.destroy();
  }
}

const TEST_FORCE_FIELD_TYPE = '__vfx_test_force_field';
const TEST_FORCE_FIELD_TYPE_B = '__vfx_test_force_field_b';
let createdMechanics = [];

function registerTestMechanics() {
  createdMechanics = [];
  registerMechanic(TEST_FORCE_FIELD_TYPE, (world, group, config, sh) => {
    const m = new MockForceFieldMechanic(world, group, config, sh);
    createdMechanics.push(m);
    return m;
  });
  registerMechanic(TEST_FORCE_FIELD_TYPE_B, (world, group, config, sh) => {
    const m = new MockForceFieldMechanic(world, group, config, sh);
    createdMechanics.push(m);
    return m;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Visual effects compatibility with active mechanics (integration)', () => {
  let world, scene, visualEffectsManager, mockGame;

  beforeEach(() => {
    world = makeMockWorld();
    scene = makeMockScene();
    createdMechanics = [];
    registerTestMechanics();

    mockGame = {
      scene,
      debugManager: { log: jest.fn() }
    };
    visualEffectsManager = new VisualEffectsManager(mockGame);

    jest.clearAllMocks();
  });

  // --- AC1: Hole completion particle effect plays with active force field meshes ---

  describe('hole completion effects with active force field meshes', () => {
    it('triggerRejectionEffect works when force field mechanics are active in the scene', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_FORCE_FIELD_TYPE, position: { x: 0, y: 0, z: 0 }, force: 8 },
          { type: TEST_FORCE_FIELD_TYPE_B, position: { x: 2, y: 0, z: 2 }, force: 5 }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Mechanics are active on the hole
      expect(hole.mechanics).toHaveLength(2);
      expect(createdMechanics).toHaveLength(2);

      // Simulate a few update frames with mechanics running
      const ballBody = makeMockBallBody();
      hole.update(0.016, ballBody);
      hole.update(0.016, ballBody);

      // Now trigger a rejection effect (particle burst) at the hole position
      const effectPosition = new THREE.Vector3(0, 0.2, 5);
      visualEffectsManager.triggerRejectionEffect(effectPosition);

      // Verify the particle effect was created and added to the scene
      expect(scene.add).toHaveBeenCalled();
      expect(visualEffectsManager.effects).toHaveLength(1);
      expect(visualEffectsManager.effects[0].age).toBe(0);
      expect(visualEffectsManager.effects[0].lifetime).toBe(1.0);

      // Verify mechanics are still being updated normally alongside the effect
      hole.update(0.016, ballBody);
      expect(createdMechanics[0].updateCalls).toHaveLength(3);
      expect(createdMechanics[1].updateCalls).toHaveLength(3);

      // Verify the visual effect updates without errors alongside active mechanics
      expect(() => visualEffectsManager.update(0.016)).not.toThrow();
      expect(visualEffectsManager.effects).toHaveLength(1);
    });

    it('multiple particle effects can coexist with multiple force field meshes', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [
          { type: TEST_FORCE_FIELD_TYPE, position: { x: -1, y: 0, z: 0 } },
          { type: TEST_FORCE_FIELD_TYPE_B, position: { x: 1, y: 0, z: 0 } }
        ]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();
      hole.update(0.016, ballBody);

      // Trigger multiple rejection effects
      visualEffectsManager.triggerRejectionEffect(new THREE.Vector3(0, 0.2, 5));
      visualEffectsManager.triggerRejectionEffect(new THREE.Vector3(1, 0.2, 3));

      expect(visualEffectsManager.effects).toHaveLength(2);

      // Both effects and mechanics update without interference
      expect(() => {
        visualEffectsManager.update(0.016);
        hole.update(0.016, ballBody);
      }).not.toThrow();
    });
  });

  // --- AC2: Rejection effect fires correctly when ball is boosted by BoostStrip ---

  describe('rejection effect with BoostStrip-boosted ball', () => {
    it('triggerRejectionEffect fires correctly when ball has force applied by mechanic', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_FORCE_FIELD_TYPE, position: { x: 0, y: 0, z: 0 }, force: 15 }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();

      // Mechanic applies force to ball (simulating BoostStrip boosting the ball)
      hole.update(0.016, ballBody);
      expect(ballBody.applyForce).toHaveBeenCalledWith({ x: 5, y: 0, z: 0 });

      // Ball is now "boosted" — simulate it approaching the hole too fast
      // The rejection effect should fire regardless of the mechanic's force application
      const rejectPosition = new THREE.Vector3(0, 0.2, 5);
      visualEffectsManager.triggerRejectionEffect(rejectPosition);

      expect(visualEffectsManager.effects).toHaveLength(1);
      expect(visualEffectsManager.effects[0].velocities.length).toBe(40);

      // Update the effect — particles should animate normally
      visualEffectsManager.update(0.1);
      expect(visualEffectsManager.effects[0].age).toBeCloseTo(0.1);

      // Mechanic continues updating after rejection effect
      hole.update(0.016, ballBody);
      expect(createdMechanics[0].updateCalls).toHaveLength(2);
    });

    it('rejection effect opacity fades correctly while mechanics are active', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_FORCE_FIELD_TYPE }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();
      hole.update(0.016, ballBody);

      visualEffectsManager.triggerRejectionEffect(new THREE.Vector3(0, 0.2, 5));

      const effect = visualEffectsManager.effects[0];

      // Simulate concurrent updates: mechanic + visual effect
      for (let i = 0; i < 5; i++) {
        hole.update(0.016, ballBody);
        visualEffectsManager.update(0.1);
      }

      // Effect should have aged and opacity should have decreased
      expect(effect.age).toBeCloseTo(0.5);
      expect(effect.points.material.opacity).toBeLessThan(1.0);

      // Mechanics still running fine
      expect(createdMechanics[0].updateCalls).toHaveLength(6);
    });
  });

  // --- AC3: VisualEffectsManager does not attempt to animate mechanic meshes ---

  describe('VisualEffectsManager does not animate mechanic meshes', () => {
    it('update() only processes its own effects array, not scene children', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_FORCE_FIELD_TYPE }, { type: TEST_FORCE_FIELD_TYPE_B }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      // Mechanic meshes exist in the scene
      const mechanicMeshes = createdMechanics.flatMap(m => m.getMeshes());
      expect(mechanicMeshes.length).toBeGreaterThan(0);

      // Trigger a rejection effect
      visualEffectsManager.triggerRejectionEffect(new THREE.Vector3(0, 0, 0));

      // Update the visual effects manager
      visualEffectsManager.update(0.016);

      // VisualEffectsManager only tracks its own effects (Points objects)
      // It should NOT reference or modify mechanic meshes
      expect(visualEffectsManager.effects).toHaveLength(1);
      const vfxEffect = visualEffectsManager.effects[0];

      // The effect's points object is distinct from any mechanic mesh
      for (const mechanicMesh of mechanicMeshes) {
        expect(vfxEffect.points).not.toBe(mechanicMesh);
      }

      // Mechanic meshes' materials should be untouched by VFX updates
      for (const mechanicMesh of mechanicMeshes) {
        expect(mechanicMesh.material.opacity).toBe(0.6);
      }
    });

    it('VisualEffectsManager effects array only contains its own particle systems', () => {
      // Without any rejection effects triggered, effects should be empty
      expect(visualEffectsManager.effects).toHaveLength(0);

      // Adding mechanic meshes to the scene does not affect VFX effects array
      const mechanicMesh = {
        isMesh: true,
        geometry: { dispose: jest.fn() },
        material: { dispose: jest.fn(), transparent: true, opacity: 0.5 }
      };
      scene.add(mechanicMesh);

      // VFX update with no effects should work fine
      expect(() => visualEffectsManager.update(0.016)).not.toThrow();
      expect(visualEffectsManager.effects).toHaveLength(0);
    });

    it('cleanup only disposes VFX particles, not mechanic meshes', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_FORCE_FIELD_TYPE }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const mechanicMesh = createdMechanics[0].getMeshes()[0];

      // Trigger an effect and then clean up
      visualEffectsManager.triggerRejectionEffect(new THREE.Vector3(0, 0, 0));
      expect(visualEffectsManager.effects).toHaveLength(1);

      visualEffectsManager.cleanup();

      // VFX effects cleared
      expect(visualEffectsManager.effects).toHaveLength(0);

      // Mechanic mesh should NOT have been disposed by VFX cleanup
      expect(mechanicMesh.material.dispose).not.toHaveBeenCalled();
      expect(mechanicMesh.geometry.dispose).not.toHaveBeenCalled();

      // Mechanic is still functional
      const ballBody = makeMockBallBody();
      expect(() => hole.update(0.016, ballBody)).not.toThrow();
    });
  });

  // --- AC4: Destroying a hole with active visual effects and mechanics does not throw ---

  describe('destroying a hole with active visual effects and mechanics', () => {
    it('does not throw when destroying hole while VFX effects are active', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_FORCE_FIELD_TYPE }, { type: TEST_FORCE_FIELD_TYPE_B }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();
      hole.update(0.016, ballBody);

      // Trigger visual effects
      visualEffectsManager.triggerRejectionEffect(new THREE.Vector3(0, 0.2, 5));
      visualEffectsManager.triggerRejectionEffect(new THREE.Vector3(1, 0.2, 3));
      expect(visualEffectsManager.effects).toHaveLength(2);

      // Destroy the hole while effects are active — should not throw
      expect(() => hole.destroy()).not.toThrow();

      // Mechanics were destroyed
      expect(createdMechanics[0].destroyed).toBe(true);
      expect(createdMechanics[1].destroyed).toBe(true);
      expect(hole.mechanics).toEqual([]);

      // Visual effects still exist and can still be updated independently
      expect(visualEffectsManager.effects).toHaveLength(2);
      expect(() => visualEffectsManager.update(0.016)).not.toThrow();
    });

    it('VFX cleanup after hole destroy does not throw', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_FORCE_FIELD_TYPE }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();
      hole.update(0.016, ballBody);

      // Trigger effect and partially update it
      visualEffectsManager.triggerRejectionEffect(new THREE.Vector3(0, 0, 0));
      visualEffectsManager.update(0.5);

      // Destroy hole first, then cleanup VFX
      hole.destroy();
      expect(() => visualEffectsManager.cleanup()).not.toThrow();
      expect(visualEffectsManager.effects).toHaveLength(0);
    });

    it('VFX effect expiry after hole destroy does not throw', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_FORCE_FIELD_TYPE }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();
      hole.update(0.016, ballBody);

      // Trigger effect
      visualEffectsManager.triggerRejectionEffect(new THREE.Vector3(0, 0, 0));

      // Destroy hole
      hole.destroy();

      // Now age the effect past its lifetime — should be removed cleanly
      visualEffectsManager.effects[0].age = 1.5;
      expect(() => visualEffectsManager.update(0.016)).not.toThrow();
      expect(visualEffectsManager.effects).toHaveLength(0);
    });

    it('simultaneous hole destroy and VFX update does not corrupt state', async () => {
      const config = makeMinimalHoleConfig({
        mechanics: [{ type: TEST_FORCE_FIELD_TYPE }, { type: TEST_FORCE_FIELD_TYPE_B }]
      });

      const hole = new HoleEntity(world, config, scene);
      await hole.init();

      const ballBody = makeMockBallBody();

      // Run several update cycles with both mechanics and effects active
      for (let i = 0; i < 3; i++) {
        hole.update(0.016, ballBody);
        visualEffectsManager.triggerRejectionEffect(
          new THREE.Vector3(Math.random(), 0.2, Math.random())
        );
        visualEffectsManager.update(0.016);
      }

      expect(visualEffectsManager.effects).toHaveLength(3);
      expect(createdMechanics[0].updateCalls).toHaveLength(3);

      // Destroy hole — mechanics cleaned up, VFX unaffected
      expect(() => hole.destroy()).not.toThrow();

      // VFX manager state is still consistent
      expect(visualEffectsManager.effects).toHaveLength(3);
      expect(() => visualEffectsManager.update(0.016)).not.toThrow();
      expect(() => visualEffectsManager.cleanup()).not.toThrow();
      expect(visualEffectsManager.effects).toHaveLength(0);
    });
  });
});
