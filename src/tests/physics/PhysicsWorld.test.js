/**
 * Unit tests for PhysicsWorld
 */

import { PhysicsWorld } from '../../physics/PhysicsWorld';
import * as CANNON from 'cannon-es';

jest.mock('cannon-es', () => {
  const createWorld = () => {
    const world = {
      gravity: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn(function (x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        })
      },
      broadphase: null,
      solver: { iterations: 10, tolerance: 0.01 },
      allowSleep: false,
      defaultSleepSpeedLimit: 0,
      defaultSleepTimeLimit: 0,
      defaultContactMaterial: {
        friction: 0.8,
        restitution: 0.1,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 4,
        frictionEquationStiffness: 1e8,
        frictionEquationRelaxation: 3
      },
      contactmaterials: [],
      addContactMaterial: jest.fn(cm => {
        world.contactmaterials.push(cm);
      }),
      removeContactMaterial: jest.fn(),
      bodies: [],
      addBody: jest.fn(body => {
        world.bodies.push(body);
      }),
      removeBody: jest.fn(body => {
        const index = world.bodies.indexOf(body);
        if (index > -1) {
          world.bodies.splice(index, 1);
        }
      }),
      step: jest.fn(),
      constraints: [],
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      removeConstraint: jest.fn()
    };
    return world;
  };

  return {
    World: jest.fn(createWorld),
    NaiveBroadphase: jest.fn(),
    SAPBroadphase: jest.fn(),
    Material: jest.fn(name => ({ name, id: name })),
    ContactMaterial: jest.fn((m1, m2, options) => ({
      materials: [m1, m2],
      friction: options.friction,
      restitution: options.restitution
    })),
    Vec3: jest.fn((x, y, z) => ({ x, y, z, set: jest.fn() })),
    Body: Object.assign(
      jest.fn(() => ({
        addShape: jest.fn(),
        removeShape: jest.fn(),
        position: { x: 0, y: 0, z: 0, set: jest.fn() },
        velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
        angularVelocity: { x: 0, y: 0, z: 0, set: jest.fn() },
        force: { x: 0, y: 0, z: 0, set: jest.fn() },
        torque: { x: 0, y: 0, z: 0, set: jest.fn() },
        quaternion: { setFromEuler: jest.fn() },
        wakeUp: jest.fn(),
        shapes: [],
        userData: {},
        material: null
      })),
      { STATIC: 1, DYNAMIC: 2, KINEMATIC: 4 }
    ),
    Sphere: jest.fn(),
    Box: jest.fn(),
    Cylinder: jest.fn(),
    Plane: jest.fn(),
    Shape: { types: { SPHERE: 1, BOX: 2, CYLINDER: 4, PLANE: 8 } }
  };
});

describe('PhysicsWorld', () => {
  let physicsWorld;

  beforeEach(() => {
    physicsWorld = new PhysicsWorld();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create a CANNON.World instance', () => {
      expect(CANNON.World).toHaveBeenCalled();
      expect(physicsWorld.world).toBeDefined();
    });

    test('should set gravity to non-zero downward vector', () => {
      expect(physicsWorld.world.gravity.set).toHaveBeenCalledWith(0, -9.81, 0);
    });

    test('should have gravity magnitude matching configured value (9.81)', () => {
      const g = physicsWorld.world.gravity;
      const magnitude = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
      expect(magnitude).toBeCloseTo(9.81, 2);
    });

    test('should use SAPBroadphase', () => {
      expect(CANNON.SAPBroadphase).toHaveBeenCalledWith(physicsWorld.world);
    });

    test('should set solver iterations to 30', () => {
      expect(physicsWorld.world.solver.iterations).toBe(30);
    });

    test('should enable sleep', () => {
      expect(physicsWorld.world.allowSleep).toBe(true);
    });

    test('should initialize materials array with 6 materials', () => {
      expect(physicsWorld.materials).toHaveLength(6);
    });

    test('should set fixed timestep to 1/60', () => {
      expect(physicsWorld.fixedTimeStep).toBeCloseTo(1 / 60);
    });

    test('should set collision grace period', () => {
      expect(physicsWorld.collisionGracePeriod).toBe(2000);
    });

    test('should set up collide event listener', () => {
      expect(physicsWorld.world.addEventListener).toHaveBeenCalledWith(
        'collide',
        expect.any(Function)
      );
    });
  });

  describe('materials', () => {
    test('should create all named materials', () => {
      expect(physicsWorld.defaultMaterial).toBeDefined();
      expect(physicsWorld.groundMaterial).toBeDefined();
      expect(physicsWorld.ballMaterial).toBeDefined();
      expect(physicsWorld.bumperMaterial).toBeDefined();
      expect(physicsWorld.holeCupMaterial).toBeDefined();
      expect(physicsWorld.holeRimMaterial).toBeDefined();
    });

    test('should create ball-ground contact material with tuned values', () => {
      expect(CANNON.ContactMaterial).toHaveBeenCalledWith(
        physicsWorld.ballMaterial,
        physicsWorld.groundMaterial,
        expect.objectContaining({
          friction: 0.4,
          restitution: 0.05
        })
      );
    });

    test('should create ball-bumper contact material', () => {
      expect(CANNON.ContactMaterial).toHaveBeenCalledWith(
        physicsWorld.ballMaterial,
        physicsWorld.bumperMaterial,
        expect.objectContaining({
          friction: 0.2,
          restitution: 0.65
        })
      );
    });

    test('should add contact materials to the world', () => {
      expect(physicsWorld.world.addContactMaterial.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    test('should configure default contact material', () => {
      expect(physicsWorld.world.defaultContactMaterial.friction).toBe(0.4);
      expect(physicsWorld.world.defaultContactMaterial.restitution).toBe(0.05);
    });
  });

  describe('addBody', () => {
    test('should add body to the world body list', () => {
      const mockBody = {
        id: 1,
        type: 'dynamic',
        mass: 1,
        shapes: [{ type: 'sphere' }],
        material: { id: 'ball' },
        userData: { type: 'ball' }
      };

      physicsWorld.addBody(mockBody);

      expect(physicsWorld.world.addBody).toHaveBeenCalledWith(mockBody);
      expect(physicsWorld.world.bodies).toContain(mockBody);
    });

    test('should not throw when body is null', () => {
      expect(() => physicsWorld.addBody(null)).not.toThrow();
      expect(physicsWorld.world.bodies).toHaveLength(0);
    });

    test('should track multiple bodies', () => {
      const body1 = { id: 1, shapes: [], userData: {} };
      const body2 = { id: 2, shapes: [], userData: {} };

      physicsWorld.addBody(body1);
      physicsWorld.addBody(body2);

      expect(physicsWorld.world.bodies).toHaveLength(2);
      expect(physicsWorld.world.bodies).toContain(body1);
      expect(physicsWorld.world.bodies).toContain(body2);
    });
  });

  describe('removeBody', () => {
    test('should remove a previously added body from the world body list', () => {
      const mockBody = {
        id: 1,
        wakeUp: jest.fn(),
        velocity: { set: jest.fn() },
        angularVelocity: { set: jest.fn() },
        force: { set: jest.fn() },
        torque: { set: jest.fn() },
        userData: { type: 'ball' }
      };

      physicsWorld.addBody(mockBody);
      expect(physicsWorld.world.bodies).toContain(mockBody);

      physicsWorld.removeBody(mockBody);
      expect(physicsWorld.world.bodies).not.toContain(mockBody);
    });

    test('should wake up the body before removal', () => {
      const mockBody = {
        wakeUp: jest.fn(),
        velocity: { set: jest.fn() },
        angularVelocity: { set: jest.fn() },
        force: { set: jest.fn() },
        torque: { set: jest.fn() },
        userData: {}
      };

      physicsWorld.addBody(mockBody);
      physicsWorld.removeBody(mockBody);

      expect(mockBody.wakeUp).toHaveBeenCalled();
    });

    test('should reset velocity and forces before removal', () => {
      const mockBody = {
        wakeUp: jest.fn(),
        velocity: { set: jest.fn() },
        angularVelocity: { set: jest.fn() },
        force: { set: jest.fn() },
        torque: { set: jest.fn() },
        userData: {}
      };

      physicsWorld.addBody(mockBody);
      physicsWorld.removeBody(mockBody);

      expect(mockBody.velocity.set).toHaveBeenCalledWith(0, 0, 0);
      expect(mockBody.angularVelocity.set).toHaveBeenCalledWith(0, 0, 0);
      expect(mockBody.force.set).toHaveBeenCalledWith(0, 0, 0);
      expect(mockBody.torque.set).toHaveBeenCalledWith(0, 0, 0);
    });

    test('should not throw when body is null', () => {
      expect(() => physicsWorld.removeBody(null)).not.toThrow();
    });

    test('should remove constraints involving the body', () => {
      const mockBody = {
        wakeUp: jest.fn(),
        velocity: { set: jest.fn() },
        angularVelocity: { set: jest.fn() },
        force: { set: jest.fn() },
        torque: { set: jest.fn() },
        userData: {}
      };
      const constraint = { bodyA: mockBody, bodyB: {} };
      physicsWorld.world.constraints.push(constraint);

      physicsWorld.addBody(mockBody);
      physicsWorld.removeBody(mockBody);

      expect(physicsWorld.world.removeConstraint).toHaveBeenCalledWith(constraint);
    });
  });

  describe('step', () => {
    test('should call world.step with correct fixed timestep', () => {
      physicsWorld.step(1 / 60);

      expect(physicsWorld.world.step).toHaveBeenCalledWith(1 / 60, 1 / 60, 8);
    });

    test('should not throw on delta-time of 1/60', () => {
      expect(() => physicsWorld.step(1 / 60)).not.toThrow();
    });

    test('should not throw on delta-time of 1/30', () => {
      expect(() => physicsWorld.step(1 / 30)).not.toThrow();
    });

    test('should use fixed timestep regardless of input', () => {
      physicsWorld.step(0.033);

      expect(physicsWorld.world.step).toHaveBeenCalledWith(1 / 60, 0.033, 8);
    });

    test('should allow overriding maxSubSteps', () => {
      physicsWorld.step(0.016, null, 5);

      expect(physicsWorld.world.step).toHaveBeenCalledWith(1 / 60, 0.016, 5);
    });

    test('should update lastCallTime', () => {
      const initialTime = physicsWorld.lastCallTime;
      physicsWorld.step(0.016);

      expect(physicsWorld.lastCallTime).toBeGreaterThanOrEqual(initialTime);
    });

    test('should not throw when world is null', () => {
      physicsWorld.world = null;
      expect(() => physicsWorld.step(0.016)).not.toThrow();
    });
  });

  describe('reset (dispose)', () => {
    test('should remove all bodies from the world', () => {
      const body1 = createMockBody();
      const body2 = createMockBody();
      physicsWorld.addBody(body1);
      physicsWorld.addBody(body2);
      expect(physicsWorld.world.bodies).toHaveLength(2);

      physicsWorld.reset();

      expect(physicsWorld.world.bodies).toHaveLength(0);
    });

    test('should leave bodies array empty after reset', () => {
      const body = createMockBody();
      physicsWorld.addBody(body);

      physicsWorld.reset();

      expect(physicsWorld.world.bodies).toEqual([]);
    });

    test('should reset gravity to default', () => {
      physicsWorld.setGravity(0, -20, 0);
      physicsWorld.reset();

      expect(physicsWorld.world.gravity.set).toHaveBeenLastCalledWith(0, -9.81, 0);
    });

    test('should reset solver iterations', () => {
      physicsWorld.reset();

      expect(physicsWorld.world.solver.iterations).toBe(30);
    });

    test('should recreate contact materials', () => {
      const callCountBefore = physicsWorld.world.addContactMaterial.mock.calls.length;
      physicsWorld.reset();

      expect(physicsWorld.world.addContactMaterial.mock.calls.length).toBeGreaterThan(
        callCountBefore
      );
    });

    test('should reset collision grace period', () => {
      const originalCreationTime = physicsWorld.creationTime;

      const laterTime = originalCreationTime + 5000;
      jest.spyOn(Date, 'now').mockReturnValue(laterTime);

      physicsWorld.reset();

      expect(physicsWorld.creationTime).toBe(laterTime);

      Date.now.mockRestore();
    });

    test('should re-setup collide listener', () => {
      const addEventListenerCalls = physicsWorld.world.addEventListener.mock.calls.length;
      physicsWorld.reset();

      expect(physicsWorld.world.addEventListener.mock.calls.length).toBeGreaterThan(
        addEventListenerCalls
      );
    });
  });

  describe('update', () => {
    test('should step the physics world', () => {
      physicsWorld.update();

      expect(physicsWorld.world.step).toHaveBeenCalled();
    });

    test('should cap delta time to 0.1', () => {
      const oldNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 5000 : 5000;
      });

      physicsWorld.lastCallTime = 0;
      physicsWorld.update();

      const stepCall = physicsWorld.world.step.mock.calls[0];
      expect(stepCall[1]).toBeLessThanOrEqual(0.1);

      performance.now = oldNow;
    });

    test('should wake up all bodies before stepping', () => {
      const body = createMockBody();
      physicsWorld.addBody(body);

      physicsWorld.update();

      expect(body.wakeUp).toHaveBeenCalled();
    });

    test('should not throw when world is null', () => {
      physicsWorld.world = null;
      expect(() => physicsWorld.update()).not.toThrow();
    });

    test('should handle physics step errors gracefully', () => {
      physicsWorld.world.step.mockImplementation(() => {
        throw new Error('physics error');
      });

      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => physicsWorld.update()).not.toThrow();
      console.error.mockRestore();
    });

    test('should reset body velocities after repeated physics errors', () => {
      const body = createMockBody();
      physicsWorld.addBody(body);

      physicsWorld.world.step.mockImplementation(() => {
        throw new Error('physics error');
      });

      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      physicsWorld.update();
      physicsWorld.update();
      physicsWorld.update();

      expect(body.velocity.set).toHaveBeenCalledWith(0, 0, 0);
      expect(body.angularVelocity.set).toHaveBeenCalledWith(0, 0, 0);

      console.error.mockRestore();
      console.warn.mockRestore();
    });
  });

  describe('collision handling', () => {
    test('should ignore collide events during grace period', () => {
      const collideCall = physicsWorld.world.addEventListener.mock.calls.find(
        c => c[0] === 'collide'
      );
      const collideHandler = collideCall[1];

      expect(() => collideHandler({ bodyA: {}, bodyB: {} })).not.toThrow();
    });

    test('should set collision callback with grace period wrapping', () => {
      const callback = jest.fn();
      physicsWorld.setCollisionCallback(callback);

      expect(physicsWorld.world.addEventListener).toHaveBeenCalledWith(
        'beginContact',
        expect.any(Function)
      );
    });
  });

  describe('helper methods', () => {
    test('createGroundBody should create a static plane body', () => {
      const groundBody = physicsWorld.createGroundBody();

      expect(CANNON.Body).toHaveBeenCalled();
      expect(CANNON.Plane).toHaveBeenCalled();
      expect(groundBody).toBeDefined();
    });

    test('createBoxBody should create a box body at position', () => {
      const size = { x: 2, y: 1, z: 3 };
      const position = { x: 0, y: 0, z: 0 };
      const boxBody = physicsWorld.createBoxBody(size, position);

      expect(CANNON.Box).toHaveBeenCalled();
      expect(boxBody).toBeDefined();
    });

    test('createSphereBody should create a dynamic sphere body', () => {
      const sphereBody = physicsWorld.createSphereBody(0.5, { x: 0, y: 1, z: 0 });

      expect(CANNON.Sphere).toHaveBeenCalledWith(0.5);
      expect(sphereBody).toBeDefined();
    });

    test('createCylinderBody should create a cylinder body', () => {
      const cylinderBody = physicsWorld.createCylinderBody(0.3, 0.5, { x: 0, y: 0, z: 0 });

      expect(CANNON.Cylinder).toHaveBeenCalled();
      expect(cylinderBody).toBeDefined();
    });
  });

  describe('getters', () => {
    test('getWorld should return the underlying world', () => {
      expect(physicsWorld.getWorld()).toBe(physicsWorld.world);
    });

    test('getMaterials should return materials array', () => {
      expect(physicsWorld.getMaterials()).toBe(physicsWorld.materials);
    });

    test('getMaterial should find material by name', () => {
      expect(physicsWorld.getMaterial('ball')).toBe(physicsWorld.ballMaterial);
    });

    test('getMaterial should return null for unknown name', () => {
      expect(physicsWorld.getMaterial('nonexistent')).toBeNull();
    });

    test('getMaterials should return empty array if materials is null', () => {
      physicsWorld.materials = null;
      expect(physicsWorld.getMaterials()).toEqual([]);
    });

    test('getMaterial should return null if materials is null', () => {
      physicsWorld.materials = null;
      expect(physicsWorld.getMaterial('ball')).toBeNull();
    });
  });

  describe('setGravity', () => {
    test('should set gravity with individual x, y, z values', () => {
      physicsWorld.setGravity(0, -20, 0);

      expect(physicsWorld.world.gravity.set).toHaveBeenCalledWith(0, -20, 0);
    });

    test('should accept a Vec3 object', () => {
      physicsWorld.setGravity({ x: 0, y: -15, z: 0 });

      expect(physicsWorld.world.gravity.set).toHaveBeenCalledWith(0, -15, 0);
    });
  });

  describe('cleanup', () => {
    test('should remove collide event listener', () => {
      physicsWorld.cleanup();

      expect(physicsWorld.world.removeEventListener).toHaveBeenCalledWith(
        'collide',
        expect.any(Function)
      );
    });

    test('should null out collide callback', () => {
      physicsWorld.cleanup();

      expect(physicsWorld._collideCallback).toBeNull();
    });
  });
});

function createMockBody() {
  return {
    id: Math.random(),
    wakeUp: jest.fn(),
    velocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    angularVelocity: { x: 0, y: 0, z: 0, set: jest.fn() },
    force: { x: 0, y: 0, z: 0, set: jest.fn() },
    torque: { x: 0, y: 0, z: 0, set: jest.fn() },
    shapes: [],
    removeShape: jest.fn(),
    userData: {}
  };
}
