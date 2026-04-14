import { Ball } from '../../objects/Ball';
import { EventTypes } from '../../events/EventTypes';

jest.mock('../../utils/debug', () => ({
  debug: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../events/EventTypes', () => ({
  EventTypes: {
    BALL_HIT: 'BALL_HIT',
    BALL_STOPPED: 'BALL_STOPPED',
    BALL_RESET: 'BALL_RESET',
    BALL_IN_HOLE: 'BALL_IN_HOLE',
    BALL_OFF_COURSE: 'BALL_OFF_COURSE'
  }
}));

jest.mock('cannon-es', () => ({
  Body: jest.fn(() => ({
    position: {
      x: 0,
      y: 0,
      z: 0,
      copy: jest.fn(),
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }),
      length: jest.fn(function () {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
      }),
      scale: jest.fn(),
      setZero: jest.fn()
    },
    force: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    },
    torque: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      })
    },
    angularVelocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }),
      scale: jest.fn(),
      setZero: jest.fn()
    },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    linearDamping: 0,
    angularDamping: 0,
    material: {},
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    applyForce: jest.fn(),
    applyImpulse: jest.fn(),
    wakeUp: jest.fn(),
    sleep: jest.fn()
  })),
  Sphere: jest.fn(),
  Vec3: jest.fn((x, y, z) => ({ x, y, z })),
  Material: jest.fn(() => ({})),
  Cylinder: jest.fn(),
  Box: jest.fn()
}));

jest.mock('three', () => ({
  SphereGeometry: jest.fn(() => ({ dispose: jest.fn() })),
  MeshStandardMaterial: jest.fn(() => ({
    color: { setHex: jest.fn() },
    emissive: { setHex: jest.fn() },
    roughness: 0.3,
    metalness: 0.2,
    map: null,
    bumpMap: null,
    needsUpdate: false,
    dispose: jest.fn()
  })),
  Mesh: jest.fn(() => ({
    position: {
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
    },
    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      copy: jest.fn(function (other) {
        if (other) {
          this.x = other.x || 0;
          this.y = other.y || 0;
          this.z = other.z || 0;
          this.w = other.w || 1;
        }
      })
    },
    rotation: { x: 0, y: 0, z: 0 },
    castShadow: false,
    receiveShadow: false,
    scale: { set: jest.fn() },
    geometry: { dispose: jest.fn() },
    material: { dispose: jest.fn() },
    getWorldPosition: jest.fn(target => {
      if (target) {
        target.x = 0;
        target.y = 0;
        target.z = 0;
      }
    })
  })),
  Vector3: jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.set = jest.fn();
    this.copy = jest.fn(function (other) {
      if (other) {
        this.x = other.x || 0;
        this.y = other.y || 0;
        this.z = other.z || 0;
      }
    });
    this.distanceTo = jest.fn(target => {
      const dx = x - target.x;
      const dy = y - target.y;
      const dz = z - target.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    });
  }),
  CanvasTexture: jest.fn(() => ({ needsUpdate: true })),
  PointLight: jest.fn(() => ({
    position: {
      x: 0,
      y: 0,
      z: 0,
      copy: jest.fn(function (other) {
        if (other) {
          this.x = other.x || 0;
          this.y = other.y || 0;
          this.z = other.z || 0;
        }
      })
    }
  }))
}));

jest.mock('../../objects/BallPhysicsHelper', () => ({
  resetBodyVelocity: jest.fn(body => {
    if (!body) {
      return;
    }
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.force.set(0, 0, 0);
    body.torque.set(0, 0, 0);
    body.wakeUp();
  }),
  checkBunkerOverlap: jest.fn(() => false),
  checkWaterOverlap: jest.fn(() => null)
}));

const { checkBunkerOverlap } = require('../../objects/BallPhysicsHelper');

function createMockScene() {
  return {
    add: jest.fn(),
    remove: jest.fn()
  };
}

function createMockPhysicsWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    addEventListener: jest.fn(),
    ballMaterial: {}
  };
}

function createMockGame(physicsWorld) {
  return {
    debugManager: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn()
    },
    physicsManager: {
      world: physicsWorld
    },
    eventManager: {
      publish: jest.fn(),
      getEventTypes: jest.fn(() => EventTypes)
    },
    audioManager: null,
    visualEffectsManager: null,
    scoringSystem: null,
    uiManager: null,
    course: null
  };
}

describe('Ball — state flags, position reset, and physics body synchronisation', () => {
  let ball;
  let mockScene;
  let mockPhysicsWorld;
  let mockGame;

  beforeEach(() => {
    mockScene = createMockScene();
    mockPhysicsWorld = createMockPhysicsWorld();
    mockGame = createMockGame(mockPhysicsWorld);
    ball = new Ball(mockScene, mockPhysicsWorld, mockGame);
  });

  afterEach(() => {
    if (ball && ball.mesh) {
      ball.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('constructor — mesh and physics body creation', () => {
    test('creates a Three.js mesh', () => {
      expect(ball.mesh).toBeDefined();
      expect(ball.mesh).not.toBeNull();
    });

    test('creates a Cannon-es physics body', () => {
      expect(ball.body).toBeDefined();
      expect(ball.body).not.toBeNull();
    });

    test('adds mesh to scene', () => {
      expect(mockScene.add).toHaveBeenCalled();
    });

    test('adds body to physics world', () => {
      expect(mockPhysicsWorld.addBody).toHaveBeenCalledWith(ball.body);
    });

    test('registers collide event listener on body', () => {
      expect(ball.body.addEventListener).toHaveBeenCalledWith('collide', expect.any(Function));
    });

    test('sets mesh castShadow and receiveShadow', () => {
      expect(ball.mesh.castShadow).toBe(true);
      expect(ball.mesh.receiveShadow).toBe(true);
    });

    test('initialises state flags to defaults', () => {
      expect(ball.isBallActive).toBe(true);
      expect(ball.isMoving).toBe(false);
      expect(ball.hasBeenHit).toBe(false);
      expect(ball.isHoleCompleted).toBe(false);
      expect(ball.isInBunker).toBe(false);
    });

    test('throws when physics world is null', () => {
      expect(() => new Ball(mockScene, null, mockGame)).toThrow(
        '[Ball] Physics world not available'
      );
    });
  });

  describe('update() — body-to-mesh synchronisation', () => {
    test('copies body position to mesh each call', () => {
      ball.body.position.x = 3;
      ball.body.position.y = 1;
      ball.body.position.z = -2;

      ball.update(1 / 60);

      expect(ball.mesh.position.copy).toHaveBeenCalledWith(ball.body.position);
    });

    test('copies body quaternion to mesh each call', () => {
      ball.body.quaternion = { x: 0.1, y: 0.2, z: 0.3, w: 0.9 };

      ball.update(1 / 60);

      expect(ball.mesh.quaternion.copy).toHaveBeenCalledWith(ball.body.quaternion);
    });

    test('syncs ball light position to mesh position', () => {
      ball.body.position.x = 5;
      ball.body.position.y = 2;
      ball.body.position.z = 7;

      ball.update(1 / 60);

      expect(ball.ballLight.position.copy).toHaveBeenCalledWith(ball.mesh.position);
    });

    test('does not throw when body or mesh is null', () => {
      ball.body = null;
      expect(() => ball.update(1 / 60)).not.toThrow();

      ball.body = {};
      ball.mesh = null;
      expect(() => ball.update(1 / 60)).not.toThrow();
    });
  });

  describe('setPosition / resetPosition — position reset and velocity zeroing', () => {
    test('setPosition sets body position and zeroes velocity', () => {
      ball.setPosition(10, 5, -3);

      expect(ball.body.position.set).toHaveBeenCalledWith(10, 5, -3);
      expect(ball.body.velocity.set).toHaveBeenCalledWith(0, 0, 0);
      expect(ball.body.angularVelocity.set).toHaveBeenCalledWith(0, 0, 0);
    });

    test('setPosition also sets mesh position', () => {
      ball.setPosition(4, 2, 6);

      expect(ball.mesh.position.set).toHaveBeenCalledWith(4, 2, 6);
    });

    test('setPosition enforces minimum y (radius + START_HEIGHT)', () => {
      ball.setPosition(1, 0, 1);

      const minY = ball.radius + Ball.START_HEIGHT;
      expect(ball.body.position.set).toHaveBeenCalledWith(1, minY, 1);
      expect(ball.mesh.position.set).toHaveBeenCalledWith(1, minY, 1);
    });

    test('setPosition wakes the body up', () => {
      ball.setPosition(0, 1, 0);

      expect(ball.body.wakeUp).toHaveBeenCalled();
    });

    test('resetPosition uses course start position', () => {
      mockGame.course = { startPosition: { x: 5, y: 1, z: 3 } };

      ball.resetPosition();

      expect(ball.body.position.set).toHaveBeenCalledWith(5, 1, 3);
    });

    test('resetPosition clears isHoleCompleted and isInBunker', () => {
      ball.isHoleCompleted = true;
      ball.isInBunker = true;
      mockGame.course = { startPosition: { x: 0, y: 1, z: 0 } };

      ball.resetPosition();

      expect(ball.isHoleCompleted).toBe(false);
      expect(ball.isInBunker).toBe(false);
    });

    test('resetPosition falls back to origin when no start position', () => {
      mockGame.course = null;

      ball.resetPosition();

      const expectedY = ball.radius + Ball.START_HEIGHT;
      expect(ball.body.position.set).toHaveBeenCalledWith(0, expectedY, 0);
    });
  });

  describe('bunker state — isInBunker flag and physics damping', () => {
    test('sets isInBunker true and increases damping when entering bunker', () => {
      checkBunkerOverlap.mockReturnValue(true);
      mockGame.course = {
        currentHole: {
          bodies: [{ userData: { isBunkerZone: true } }]
        }
      };
      ball.isInBunker = false;

      ball.checkAndUpdateBunkerState();

      expect(ball.isInBunker).toBe(true);
      expect(ball.body.linearDamping).toBe(ball.bunkerLinearDamping);
    });

    test('sets isInBunker false and restores damping when leaving bunker', () => {
      checkBunkerOverlap.mockReturnValue(false);
      mockGame.course = {
        currentHole: {
          bodies: [{ userData: { isBunkerZone: true } }]
        }
      };
      ball.isInBunker = true;
      ball.body.linearDamping = ball.bunkerLinearDamping;

      ball.checkAndUpdateBunkerState();

      expect(ball.isInBunker).toBe(false);
      expect(ball.body.linearDamping).toBe(ball.defaultLinearDamping);
    });

    test('does nothing when no course or hole bodies', () => {
      ball.isInBunker = false;
      ball.checkAndUpdateBunkerState();
      expect(ball.isInBunker).toBe(false);
    });
  });

  describe('handleHoleSuccess — marks completed and freezes body', () => {
    test('isHoleCompleted is set during hole entry detection in update()', () => {
      ball.isHoleCompleted = false;
      ball.currentHolePosition = { x: 0, y: 0, z: 0 };
      ball.body.position.x = 0;
      ball.body.position.y = 0;
      ball.body.position.z = 0;
      ball.body.velocity.length = jest.fn(() => 1.0);

      ball.update(1 / 60);

      expect(ball.isHoleCompleted).toBe(true);
    });

    test('puts the physics body to sleep', () => {
      ball.handleHoleSuccess();

      expect(ball.body.sleep).toHaveBeenCalled();
    });

    test('zeroes body velocity via resetBodyVelocity', () => {
      ball.handleHoleSuccess();

      expect(ball.body.velocity.set).toHaveBeenCalledWith(0, 0, 0);
      expect(ball.body.angularVelocity.set).toHaveBeenCalledWith(0, 0, 0);
    });

    test('switches mesh material to success material', () => {
      ball.handleHoleSuccess();

      expect(ball.mesh.material).toBe(ball.successMaterial);
    });

    test('publishes BALL_IN_HOLE event', () => {
      ball.handleHoleSuccess();

      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.BALL_IN_HOLE,
        expect.objectContaining({ ballBody: ball.body }),
        ball
      );
    });

    test('plays success sound when audioManager is available', () => {
      mockGame.audioManager = { playSound: jest.fn() };

      ball.handleHoleSuccess();

      expect(mockGame.audioManager.playSound).toHaveBeenCalledWith('success', 0.7);
    });
  });

  describe('isStopped / isMoving — velocity threshold checks', () => {
    test('isStopped returns true when velocity is below threshold', () => {
      ball.body.velocity.x = 0.01;
      ball.body.velocity.y = 0.01;
      ball.body.velocity.z = 0.01;
      ball.body.angularVelocity.x = 0.01;
      ball.body.angularVelocity.y = 0.01;
      ball.body.angularVelocity.z = 0.01;

      expect(ball.isStopped()).toBe(true);
    });

    test('isStopped returns false when velocity exceeds threshold', () => {
      ball.body.velocity.x = 1.0;
      ball.body.velocity.y = 0.5;
      ball.body.velocity.z = 0.8;
      ball.body.angularVelocity.x = 0.3;
      ball.body.angularVelocity.y = 0.4;
      ball.body.angularVelocity.z = 0.2;

      expect(ball.isStopped()).toBe(false);
    });

    test('isStopped returns true when body is null', () => {
      ball.body = null;

      expect(ball.isStopped()).toBe(true);
    });

    test('isMoving flag is set to true after applyForce', () => {
      ball.isMoving = false;
      ball.powerMultiplier = 1;

      ball.applyForce({ x: 1, y: 0, z: 0 }, 5);

      expect(ball.isMoving).toBe(true);
    });

    test('wasStopped transitions from true to false when ball is not stopped', () => {
      ball.wasStopped = true;
      ball.body.velocity.x = 1.0;
      ball.body.velocity.y = 0.5;
      ball.body.velocity.z = 0.8;
      ball.body.angularVelocity.x = 0.3;
      ball.body.angularVelocity.y = 0.4;
      ball.body.angularVelocity.z = 0.2;

      ball.isStopped();

      expect(ball.wasStopped).toBe(false);
    });
  });

  describe('cleanup — removes mesh from scene and body from world', () => {
    test('removes mesh from scene', () => {
      ball.cleanup();

      expect(mockScene.remove).toHaveBeenCalledWith(ball.mesh || expect.anything());
    });

    test('removes body from physics world', () => {
      const body = ball.body;

      ball.cleanup();

      expect(mockPhysicsWorld.removeBody).toHaveBeenCalledWith(body);
    });

    test('removes ball light from scene', () => {
      ball.cleanup();

      expect(mockScene.remove).toHaveBeenCalledTimes(2);
    });

    test('disposes mesh geometry and materials', () => {
      const geomDispose = ball.mesh.geometry.dispose;
      const defaultMatDispose = ball.defaultMaterial.dispose;
      const successMatDispose = ball.successMaterial.dispose;

      ball.cleanup();

      expect(geomDispose).toHaveBeenCalled();
      expect(defaultMatDispose).toHaveBeenCalled();
      expect(successMatDispose).toHaveBeenCalled();
    });

    test('nullifies references after cleanup', () => {
      ball.cleanup();

      expect(ball.mesh).toBeNull();
      expect(ball.body).toBeNull();
      expect(ball.scene).toBeNull();
      expect(ball.physicsWorld).toBeNull();
      expect(ball.ballLight).toBeNull();
    });
  });
});
