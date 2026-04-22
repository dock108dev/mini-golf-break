import { Ball } from '../objects/Ball';
import { EventTypes } from '../events/EventTypes';

// Mock dependencies
jest.mock('../physics/utils', () => ({
  calculateImpactAngle: jest.fn(() => 0),
  isLipOut: jest.fn(() => false)
}));

jest.mock('../utils/debug', () => ({
  debug: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../events/EventTypes', () => ({
  EventTypes: {
    BALL_HIT: 'BALL_HIT',
    BALL_STOPPED: 'BALL_STOPPED',
    BALL_RESET: 'BALL_RESET',
    BALL_IN_HOLE: 'BALL_IN_HOLE',
    BALL_OFF_COURSE: 'BALL_OFF_COURSE'
  }
}));

// Mock Cannon-es classes
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
      lengthSquared: jest.fn(() => 0),
      length: jest.fn(() => 0),
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
      lengthSquared: jest.fn(() => 0),
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

// Mock Three.js classes
jest.mock('three', () => ({
  SphereGeometry: jest.fn(),
  MeshStandardMaterial: jest.fn(() => ({
    color: { setHex: jest.fn() },
    emissive: { setHex: jest.fn() },
    roughness: 0.3,
    metalness: 0.2,
    map: null,
    bumpMap: null,
    dispose: jest.fn()
  })),
  Mesh: jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, copy: jest.fn(), set: jest.fn() },
    quaternion: { x: 0, y: 0, z: 0, w: 1, copy: jest.fn() },
    rotation: { x: 0, y: 0, z: 0 },
    castShadow: false,
    receiveShadow: false,
    geometry: { dispose: jest.fn() },
    material: { dispose: jest.fn() },
    getWorldPosition: jest.fn(target => {
      if (target) {
        target.x = 5.1;
        target.y = 0;
        target.z = 5.1;
      }
    })
  })),
  Vector3: jest.fn(function (x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.set = jest.fn();
    this.copy = jest.fn();
    this.multiplyScalar = jest.fn();
    this.lengthSquared = jest.fn(() => 0);
    this.distanceTo = jest.fn(target => {
      const dx = this.x - target.x;
      const dy = this.y - target.y;
      const dz = this.z - target.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    });
  }),
  Group: jest.fn(() => ({
    add: jest.fn(),
    remove: jest.fn()
  })),
  TextureLoader: jest.fn(() => ({
    load: jest.fn()
  })),
  CanvasTexture: jest.fn(() => ({
    needsUpdate: true
  })),
  PointLight: jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, copy: jest.fn() },
    castShadow: false
  }))
}));

// Mock the physics world
const mockPhysicsWorld = {
  addBody: jest.fn(),
  removeBody: jest.fn(),
  addEventListener: jest.fn(),
  ballMaterial: {} // Add this for the physics material
};

describe('Ball', () => {
  let ball;
  let mockScene;
  let mockGame;

  beforeEach(() => {
    // Set up DOM environment for Ball texture creation
    if (!global.document) {
      global.document = {};
    }

    // Mock DOM elements for canvas texture creation
    global.document.createElement = jest.fn(tag => {
      if (tag === 'canvas') {
        return {
          width: 512,
          height: 512,
          getContext: jest.fn(() => ({
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            beginPath: jest.fn(),
            arc: jest.fn(),
            fill: jest.fn(),
            stroke: jest.fn(),
            setTransform: jest.fn(),
            createRadialGradient: jest.fn(() => ({
              addColorStop: jest.fn()
            })),
            fillRect: jest.fn(),
            getImageData: jest.fn(() => ({
              data: new Uint8ClampedArray(512 * 512 * 4)
            })),
            putImageData: jest.fn()
          }))
        };
      }
      return {};
    });

    mockScene = {
      add: jest.fn(),
      remove: jest.fn()
    };

    mockGame = {
      debugManager: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn()
      },
      physicsManager: {
        world: mockPhysicsWorld,
        getWorld: jest.fn(() => mockPhysicsWorld)
      },
      eventManager: {
        publish: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        getEventTypes: jest.fn(() => EventTypes)
      }
    };

    ball = new Ball(mockScene, mockPhysicsWorld, mockGame);
  });

  afterEach(() => {
    if (ball) {
      ball.cleanup();
    }
  });

  test('should initialize with correct default properties', () => {
    expect(ball.mesh).toBeDefined();
    expect(ball.body).toBeDefined();
    expect(ball.radius).toBe(0.2);
    expect(ball.mass).toBe(0.045);
    expect(ball.isBallActive).toBe(true);
  });

  test('should apply force correctly', () => {
    const direction = { x: 1, y: 0, z: 0 };
    const power = 10;

    ball.applyForce(direction, power);

    expect(ball.body.applyImpulse).toHaveBeenCalled();
  });

  test('should handle position updates', () => {
    ball.setPosition(5, 2, 3);

    expect(ball.body.position.set).toHaveBeenCalledWith(5, 2, 3);
  });

  test('should detect when ball is stopped', () => {
    // Set hasBeenHit to true to enable stopped checking
    ball.hasBeenHit = true;

    // Mock velocity for stopped state (below threshold of 0.15)
    ball.body.velocity.x = 0.01;
    ball.body.velocity.y = 0.01;
    ball.body.velocity.z = 0.01;
    ball.body.angularVelocity.x = 0.01;
    ball.body.angularVelocity.y = 0.01;
    ball.body.angularVelocity.z = 0.01;
    expect(ball.isStopped()).toBe(true);

    // Mock velocity for moving state (above threshold)
    ball.body.velocity.x = 0.5;
    ball.body.velocity.y = 0.3;
    ball.body.velocity.z = 0.4;
    ball.body.angularVelocity.x = 0.2;
    ball.body.angularVelocity.y = 0.3;
    ball.body.angularVelocity.z = 0.2;
    expect(ball.isStopped()).toBe(false);
  });

  test('should cleanup resources properly', () => {
    const removeSpy = jest.spyOn(mockScene, 'remove');
    const removeBodySpy = jest.spyOn(mockPhysicsWorld, 'removeBody');

    ball.cleanup();

    // Check that cleanup methods were called (they clean up internal resources)
    expect(removeSpy).toHaveBeenCalled();
    expect(removeBodySpy).toHaveBeenCalled();
  });

  test('should handle resetPosition correctly', () => {
    mockGame.course = {
      startPosition: { x: 5, y: 1, z: 3 }
    };

    ball.resetPosition();

    expect(ball.body.position.set).toHaveBeenCalledWith(5, 1, 3);
    expect(ball.body.velocity.set).toHaveBeenCalledWith(0, 0, 0);
    expect(ball.body.angularVelocity.set).toHaveBeenCalledWith(0, 0, 0);
  });

  test('should handle resetVelocity correctly', () => {
    ball.resetVelocity();

    expect(ball.body.velocity.set).toHaveBeenCalledWith(0, 0, 0);
    expect(ball.body.angularVelocity.set).toHaveBeenCalledWith(0, 0, 0);
    expect(ball.body.force.set).toHaveBeenCalledWith(0, 0, 0);
    expect(ball.body.torque.set).toHaveBeenCalledWith(0, 0, 0);
  });

  test('should update mesh from physics body', () => {
    ball.body.position = { x: 10, y: 5, z: 8 };
    ball.body.quaternion = { x: 0.1, y: 0.2, z: 0.3, w: 0.9 };

    ball.update();

    expect(ball.mesh.position.copy).toHaveBeenCalledWith(ball.body.position);
    expect(ball.mesh.quaternion.copy).toHaveBeenCalledWith(ball.body.quaternion);
  });

  test('should update ball light position', () => {
    ball.body.position = { x: 2, y: 3, z: 4 };

    ball.update();

    expect(ball.ballLight.position.copy).toHaveBeenCalledWith(ball.mesh.position);
  });

  test('should check hole detection when near hole', () => {
    ball.hasBeenHit = true;
    ball.isHoleCompleted = false;
    ball.currentHolePosition = { x: 0, y: 0, z: 0 };
    ball.body.position = { x: 0.1, y: 0, z: 0.1 };
    ball.body.velocity.length = jest.fn(() => 2); // Below max speed of 4.06

    ball.update();

    // Should trigger hole success
    expect(ball.isHoleCompleted).toBe(true);
  });

  test('should handle bunker state updates', () => {
    // Create a proper mock for CANNON.Box
    const CANNON = require('cannon-es');
    const mockBox = Object.create(CANNON.Box.prototype);
    mockBox.halfExtents = { x: 5, y: 1, z: 5 };

    mockGame.course = {
      currentHole: {
        bodies: [
          {
            userData: { isBunkerZone: true },
            position: { x: 0, y: 0, z: 0 },
            shapes: [mockBox]
          }
        ]
      }
    };

    // Position ball inside bunker
    ball.body.position.x = 1;
    ball.body.position.y = 0;
    ball.body.position.z = 1;
    ball.isInBunker = false;

    ball.checkAndUpdateBunkerState();

    expect(ball.isInBunker).toBe(true);
    expect(ball.body.linearDamping).toBe(ball.bunkerLinearDamping);
  });

  test('should store hole position in currentHolePosition', () => {
    const newHolePosition = { x: 10, y: 0, z: 15 };

    ball.currentHolePosition = newHolePosition;

    expect(ball.currentHolePosition).toBe(newHolePosition);
  });

  test('should check if ball is in hole', () => {
    ball.currentHolePosition = { x: 5, y: 0, z: 5 };

    // Mock getWorldPosition to return position near hole
    ball.mesh.getWorldPosition = jest.fn(target => {
      if (target) {
        target.x = 5.1;
        target.y = 0;
        target.z = 5.1;
      }
    });

    // Test position in hole (distance < 0.25)
    expect(ball.isInHole()).toBe(true);

    // Mock getWorldPosition to return position far from hole
    ball.mesh.getWorldPosition = jest.fn(target => {
      if (target) {
        target.x = 10;
        target.y = 0;
        target.z = 10;
      }
    });

    // Test position not in hole
    expect(ball.isInHole()).toBe(false);

    // Test with no hole position
    ball.currentHolePosition = null;
    expect(ball.isInHole()).toBe(false);
  });

  test('should handle collision events', () => {
    mockGame.audioManager = {
      playWallImpact: jest.fn()
    };

    const mockEvent = {
      body: {
        material: { name: 'bumper' },
        userData: {}
      },
      contact: {
        getImpactVelocityAlongNormal: jest.fn(() => 5)
      }
    };

    ball.onCollide(mockEvent);

    // Should call playWallImpact with the absolute impact speed
    expect(mockGame.audioManager.playWallImpact).toHaveBeenCalledWith(5);
    expect(ball.body.wakeUp).toHaveBeenCalled();
  });

  test('should handle wall collisions', () => {
    mockGame.audioManager = {
      playWallImpact: jest.fn()
    };

    const mockEvent = {
      body: {
        material: {},
        userData: { type: 'wall_stone' }
      },
      contact: {
        getImpactVelocityAlongNormal: jest.fn(() => 3)
      }
    };

    ball.onCollide(mockEvent);

    // Should call playWallImpact for wall collision
    expect(mockGame.audioManager.playWallImpact).toHaveBeenCalledWith(3);
  });

  test('should handle success effect', () => {
    ball.mesh.material = ball.defaultMaterial;

    ball.handleHoleSuccess();

    expect(ball.mesh.material).toBe(ball.successMaterial);
  });

  test('should reset visuals', () => {
    mockGame.visualEffectsManager = {
      resetBallVisuals: jest.fn()
    };

    ball.resetVisuals();

    expect(mockGame.visualEffectsManager.resetBallVisuals).toHaveBeenCalledWith(ball);
  });

  test('should handle out of bounds', () => {
    mockGame.audioManager = {
      playSound: jest.fn()
    };

    ball.body.position.y = -60;
    ball.handleOutOfBounds = jest.fn();

    ball.update();

    expect(ball.handleOutOfBounds).toHaveBeenCalled();
  });

  test('should call handleOutOfBounds when ball is too low', () => {
    const handleOutOfBoundsSpy = jest.spyOn(ball, 'handleOutOfBounds');
    handleOutOfBoundsSpy.mockImplementation(() => {});

    ball.body.position.y = -60;

    ball.update();

    expect(handleOutOfBoundsSpy).toHaveBeenCalled();
    handleOutOfBoundsSpy.mockRestore();
  });

  test('should handle physics body creation with world material', () => {
    // Verify material was set from physics world
    expect(ball.body.material).toEqual(mockPhysicsWorld.ballMaterial);
  });

  test('should throw error when physics world is not provided', () => {
    expect(() => {
      new Ball(mockScene, null, mockGame);
    }).toThrow('[Ball] Physics world not available');
  });

  test('should create golf ball with dimples', () => {
    // This is called in constructor through createMesh
    expect(ball.mesh).toBeDefined();
    expect(ball.mesh.castShadow).toBe(true);
    expect(ball.mesh.receiveShadow).toBe(true);
  });

  test('should apply impulse correctly', () => {
    const direction = { x: 1, y: 0, z: 0 };
    const power = 5;

    ball.applyImpulse(direction, power);

    expect(ball.body.applyImpulse).toHaveBeenCalled();
    expect(ball.body.wakeUp).toHaveBeenCalled();
    // Note: applyImpulse method doesn't set hasBeenHit or shotCount - those are handled by game logic
  });

  test('should store last hit position when applying force', () => {
    ball.lastHitPosition = new THREE.Vector3();
    ball.lastHitPosition.copy = jest.fn();

    const direction = { x: 1, y: 0, z: 0 };
    ball.body.position = { x: 2, y: 1, z: 3 };

    ball.applyForce(direction, 10);

    expect(ball.lastHitPosition.copy).toHaveBeenCalledWith(ball.body.position);
  });

  test('should publish ball hit event when applying force', () => {
    const direction = { x: 1, y: 0, z: 0 };

    ball.applyForce(direction, 10);

    expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
      EventTypes.BALL_HIT,
      { power: 10 },
      ball
    );
  });

  test('should handle water hazard detection', () => {
    // Create a proper mock for CANNON.Box
    const CANNON = require('cannon-es');
    const mockBox = Object.create(CANNON.Box.prototype);
    mockBox.halfExtents = { x: 5, y: 1, z: 5 };

    mockGame.course = {
      currentHole: {
        bodies: [
          {
            userData: { isWaterZone: true },
            position: { x: 0, y: 0, z: 0 },
            shapes: [mockBox]
          }
        ]
      }
    };

    mockGame.scoringSystem = {
      addStroke: jest.fn()
    };

    mockGame.uiManager = {
      showMessage: jest.fn()
    };

    mockGame.audioManager = {
      playSound: jest.fn()
    };

    // Position ball inside water (within box bounds)
    ball.body.position.x = 1;
    ball.body.position.y = 0;
    ball.body.position.z = 1;
    ball.lastHitPosition = new THREE.Vector3(10, 0, 10);
    ball.lastHitPosition.copy = jest.fn();

    ball.checkAndUpdateWaterHazardState();

    expect(mockGame.scoringSystem.addStroke).toHaveBeenCalled();
    expect(mockGame.uiManager.showMessage).toHaveBeenCalledWith('Water Hazard! +1 Stroke', 2000);
    expect(mockGame.audioManager.playSound).toHaveBeenCalledWith('splash', 0.6);
  });

  test('should get position', () => {
    ball.body.position = { x: 5, y: 2, z: 3 };

    const pos = ball.getPosition();

    expect(pos.x).toBe(5);
    expect(pos.y).toBe(2);
    expect(pos.z).toBe(3);
  });

  test('should clamp velocity when speed is below 0.02', () => {
    ball.body.velocity.length = jest.fn(() => 0.01);

    ball.update();

    expect(ball.body.velocity.setZero).toHaveBeenCalled();
    expect(ball.body.angularVelocity.setZero).toHaveBeenCalled();
  });

  test('should dampen velocity when speed is between 0.02 and 0.08', () => {
    ball.body.velocity.length = jest.fn(() => 0.05);

    ball.update();

    expect(ball.body.velocity.scale).toHaveBeenCalledWith(0.85, ball.body.velocity);
    expect(ball.body.angularVelocity.scale).toHaveBeenCalledWith(0.85, ball.body.angularVelocity);
  });

  test('should not clamp velocity when speed is above 0.08', () => {
    ball.body.velocity.length = jest.fn(() => 1.0);

    ball.update();

    expect(ball.body.velocity.scale).not.toHaveBeenCalled();
    expect(ball.body.velocity.setZero).not.toHaveBeenCalled();
  });

  describe('emissive flash on BALL_HIT', () => {
    test('sets emissiveIntensity to 1.0 and starts flash on BALL_HIT', () => {
      // Simulate the event handler directly
      ball._onBallHit();
      expect(ball.defaultMaterial.emissiveIntensity).toBe(1.0);
      expect(ball._emissiveFlashAge).toBe(0);
    });

    test('decays emissiveIntensity back to baseline (0.3) after 0.1 s', () => {
      // Ball is moving — idle glow must not interfere with flash decay assertion
      ball.body.velocity.length.mockReturnValue(1.0);
      ball._emissiveFlashAge = 0;
      ball.defaultMaterial.emissiveIntensity = 1.0;

      ball.update(0.1); // exactly at decay boundary

      expect(ball.defaultMaterial.emissiveIntensity).toBeCloseTo(0.3, 5);
      expect(ball._emissiveFlashAge).toBeNull();
    });

    test('emissiveIntensity is above baseline during decay', () => {
      ball._emissiveFlashAge = 0;
      ball.defaultMaterial.emissiveIntensity = 1.0;

      ball.update(0.05); // halfway through decay

      expect(ball.defaultMaterial.emissiveIntensity).toBeGreaterThan(0.3);
      expect(ball.defaultMaterial.emissiveIntensity).toBeLessThan(1.0);
    });

    test('does nothing when flash is inactive and ball is moving', () => {
      // When ball is moving, neither flash nor idle glow changes emissive intensity
      ball.body.velocity.length.mockReturnValue(1.0);
      ball._emissiveFlashAge = null;
      ball.defaultMaterial.emissiveIntensity = 0.3;

      ball.update(0.1);

      expect(ball.defaultMaterial.emissiveIntensity).toBe(0.3);
    });
  });

  describe('wall impact audio', () => {
    test('calls playWallImpact with impact speed above threshold', () => {
      mockGame.audioManager = { playWallImpact: jest.fn() };

      ball.onCollide({
        body: { material: { name: 'bumper' }, userData: {} },
        contact: { getImpactVelocityAlongNormal: jest.fn(() => 0.5) }
      });

      expect(mockGame.audioManager.playWallImpact).toHaveBeenCalledWith(0.5);
    });

    test('passes absolute speed (positive) even for negative normal velocity', () => {
      mockGame.audioManager = { playWallImpact: jest.fn() };

      ball.onCollide({
        body: { material: { name: 'bumper' }, userData: {} },
        contact: { getImpactVelocityAlongNormal: jest.fn(() => -2.0) }
      });

      expect(mockGame.audioManager.playWallImpact).toHaveBeenCalledWith(2.0);
    });

    test('does not call playWallImpact for non-wall bodies', () => {
      mockGame.audioManager = { playWallImpact: jest.fn() };

      ball.onCollide({
        body: { material: { name: 'ground' }, userData: {} },
        contact: { getImpactVelocityAlongNormal: jest.fn(() => 5) }
      });

      expect(mockGame.audioManager.playWallImpact).not.toHaveBeenCalled();
    });
  });

  describe('_updateIdleGlow', () => {
    test('activates idle glow when speed is below sleepSpeedLimit', () => {
      // velocity.length() returns 0 by default — below 0.1 threshold
      ball._emissiveFlashAge = null;
      ball._updateIdleGlow(0.016);
      expect(ball._isIdleGlowing).toBe(true);
    });

    test('accumulates idle glow age while ball is at rest', () => {
      ball._emissiveFlashAge = null;
      ball._updateIdleGlow(0.1);
      ball._updateIdleGlow(0.1);
      expect(ball._idleGlowAge).toBeCloseTo(0.2);
    });

    test('emissive intensity stays within 0.3–0.6 range during idle', () => {
      ball._emissiveFlashAge = null;
      for (let t = 0; t < 2.0; t += 0.05) {
        ball._updateIdleGlow(0.05);
        const intensity = ball.defaultMaterial.emissiveIntensity;
        expect(intensity).toBeGreaterThanOrEqual(0.29);
        expect(intensity).toBeLessThanOrEqual(0.61);
      }
    });

    test('does not run when emissive flash is active', () => {
      ball._emissiveFlashAge = 0.05; // flash in progress
      ball._idleGlowAge = 0;
      ball._updateIdleGlow(0.016);
      expect(ball._isIdleGlowing).toBe(false);
      expect(ball._idleGlowAge).toBe(0);
    });

    test('deactivates and resets to baseline when ball starts moving', () => {
      // Activate idle glow first
      ball._emissiveFlashAge = null;
      ball._updateIdleGlow(0.1);
      expect(ball._isIdleGlowing).toBe(true);

      // Simulate ball moving (speed above threshold)
      ball.body.velocity.length.mockReturnValue(1.5);
      ball._updateIdleGlow(0.016);

      expect(ball._isIdleGlowing).toBe(false);
      expect(ball._idleGlowAge).toBe(0);
      expect(ball.defaultMaterial.emissiveIntensity).toBe(0.3);
    });

    test('BALL_HIT resets idle glow state', () => {
      // Start idle glow
      ball._emissiveFlashAge = null;
      ball._updateIdleGlow(0.5);
      expect(ball._isIdleGlowing).toBe(true);

      // Fire shot (triggers _onBallHit handler)
      ball._onBallHit();

      expect(ball._isIdleGlowing).toBe(false);
      expect(ball._idleGlowAge).toBe(0);
    });

    test('does nothing when body is missing', () => {
      ball.body = null;
      expect(() => ball._updateIdleGlow(0.016)).not.toThrow();
    });
  });
});
