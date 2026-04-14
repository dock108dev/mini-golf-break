/**
 * Unit tests for PhysicsManager
 */

import { PhysicsManager } from '../../managers/PhysicsManager';

jest.mock('../../utils/debug', () => ({
  debug: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../physics/PhysicsWorld', () => {
  function mockCannonWorld() {
    const listeners = {};
    return {
      bodies: [],
      gravity: { set: jest.fn() },
      solver: { iterations: 30, tolerance: 0.0001 },
      broadphase: {},
      allowSleep: true,
      addEventListener: jest.fn((event, handler) => {
        if (!listeners[event]) {
          listeners[event] = [];
        }
        listeners[event].push(handler);
      }),
      removeEventListener: jest.fn((event, handler) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter(h => h !== handler);
        }
      }),
      addBody: jest.fn(function (body) {
        this.bodies.push(body);
      }),
      removeBody: jest.fn(function (body) {
        const idx = this.bodies.indexOf(body);
        if (idx > -1) {
          this.bodies.splice(idx, 1);
        }
      }),
      step: jest.fn()
    };
  }

  return {
    PhysicsWorld: jest.fn(() => ({
      world: mockCannonWorld(),
      ballMaterial: { id: 1, name: 'ball' },
      groundMaterial: { id: 2, name: 'ground' },
      bumperMaterial: { id: 3, name: 'bumper' },
      setCollisionCallback: jest.fn(),
      update: jest.fn(),
      cleanup: jest.fn(),
      step: jest.fn(),
      addBody: jest.fn(),
      removeBody: jest.fn()
    }))
  };
});

function createMockGame() {
  return {
    debugManager: {
      physicsDebuggerEnabled: false,
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    },
    ballManager: null,
    handleCollision: jest.fn(),
    eventManager: {
      subscribe: jest.fn(),
      publish: jest.fn()
    }
  };
}

describe('PhysicsManager', () => {
  let manager;
  let mockGame;

  beforeEach(() => {
    mockGame = createMockGame();
    manager = new PhysicsManager(mockGame);
  });

  afterEach(() => {
    if (manager.world) {
      manager.cleanup();
    }
  });

  describe('constructor', () => {
    test('initializes with null world and cannonWorld', () => {
      expect(manager.world).toBeNull();
      expect(manager.cannonWorld).toBeNull();
    });

    test('stores game reference', () => {
      expect(manager.game).toBe(mockGame);
    });

    test('initializes debug and resetting flags', () => {
      expect(manager.debugEnabled).toBe(false);
      expect(manager.isResetting).toBe(false);
    });
  });

  describe('init()', () => {
    test('creates and stores a PhysicsWorld instance', async () => {
      await manager.init();

      expect(manager.world).not.toBeNull();
      expect(manager.cannonWorld).not.toBeNull();
      expect(manager.cannonWorld).toBe(manager.world.world);
    });

    test('returns the PhysicsWorld instance', async () => {
      const result = await manager.init();

      expect(result).toBe(manager.world);
    });

    test('sets up collision events during init', async () => {
      await manager.init();

      expect(manager.world.setCollisionCallback).toHaveBeenCalled();
      expect(manager.cannonWorld.addEventListener).toHaveBeenCalledWith(
        'endContact',
        expect.any(Function)
      );
    });

    test('acquires ball body when ballManager has a ball', async () => {
      const mockBody = { addEventListener: jest.fn() };
      mockGame.ballManager = { ball: { body: mockBody } };

      await manager.init();

      expect(manager.ballBody).toBe(mockBody);
    });

    test('sets ballBody to undefined when ballManager has no ball', async () => {
      mockGame.ballManager = null;

      await manager.init();

      expect(manager.ballBody).toBeFalsy();
    });
  });

  describe('getWorld()', () => {
    test('returns null before init', () => {
      expect(manager.getWorld()).toBeNull();
    });

    test('returns PhysicsWorld after init', async () => {
      await manager.init();

      expect(manager.getWorld()).toBe(manager.world);
    });
  });

  describe('setupCollisionEvents()', () => {
    test('returns early if cannonWorld is null', () => {
      manager.cannonWorld = null;
      const result = manager.setupCollisionEvents();

      expect(result).toBe(manager);
    });

    test('registers beginContact via setCollisionCallback', async () => {
      await manager.init();

      expect(manager.world.setCollisionCallback).toHaveBeenCalledWith(expect.any(Function));
    });

    test('registers endContact listener on cannonWorld', async () => {
      await manager.init();

      expect(manager.cannonWorld.addEventListener).toHaveBeenCalledWith(
        'endContact',
        expect.any(Function)
      );
    });

    test('stores bound handlers', async () => {
      await manager.init();

      expect(manager.boundCollisionStart).toBeDefined();
      expect(manager.boundCollisionEnd).toBeDefined();
    });
  });

  describe('handleCollisionStart()', () => {
    test('delegates to game.handleCollision when available', async () => {
      await manager.init();

      const bodyA = { id: 1 };
      const bodyB = { id: 2 };
      manager.handleCollisionStart({ bodyA, bodyB });

      expect(mockGame.handleCollision).toHaveBeenCalledWith(bodyA, bodyB);
    });

    test('does nothing when game is null', async () => {
      await manager.init();
      manager.game = null;

      expect(() => {
        manager.handleCollisionStart({ bodyA: {}, bodyB: {} });
      }).not.toThrow();
    });

    test('does nothing when game.handleCollision is not defined', async () => {
      await manager.init();
      delete mockGame.handleCollision;

      expect(() => {
        manager.handleCollisionStart({ bodyA: {}, bodyB: {} });
      }).not.toThrow();
    });
  });

  describe('update()', () => {
    test('calls world.update() with valid world', async () => {
      await manager.init();

      manager.update(1 / 60);

      expect(manager.world.update).toHaveBeenCalled();
    });

    test('skips update when isResetting is true', async () => {
      await manager.init();
      manager.isResetting = true;

      manager.update(1 / 60);

      expect(manager.world.update).not.toHaveBeenCalled();
    });

    test('skips update when cannonWorld is null', () => {
      manager.cannonWorld = null;

      const result = manager.update(1 / 60);

      expect(result).toBe(manager);
    });

    test('skips update when cannonWorld.bodies is null', async () => {
      await manager.init();
      manager.cannonWorld.bodies = null;

      const result = manager.update(1 / 60);

      expect(result).toBe(manager);
    });

    test('returns this for chaining', async () => {
      await manager.init();

      const result = manager.update(1 / 60);

      expect(result).toBe(manager);
    });

    test('handles world.update() throwing an error', async () => {
      await manager.init();
      manager.world.update.mockImplementation(() => {
        throw new Error('physics error');
      });

      expect(() => manager.update(1 / 60)).not.toThrow();
    });
  });

  describe('removeBody()', () => {
    test('removes body from cannonWorld when body exists in world', async () => {
      await manager.init();
      const mockBody = { id: 42 };
      manager.cannonWorld.bodies.push(mockBody);

      manager.removeBody(mockBody);

      expect(manager.cannonWorld.removeBody).toHaveBeenCalledWith(mockBody);
    });

    test('does nothing when body is not in world', async () => {
      await manager.init();
      const mockBody = { id: 42 };

      manager.removeBody(mockBody);

      expect(manager.cannonWorld.removeBody).not.toHaveBeenCalled();
    });

    test('does nothing when cannonWorld is null', () => {
      manager.cannonWorld = null;

      const result = manager.removeBody({ id: 1 });

      expect(result).toBe(manager);
    });

    test('does nothing when body is null', async () => {
      await manager.init();

      const result = manager.removeBody(null);

      expect(result).toBe(manager);
    });

    test('returns this for chaining', async () => {
      await manager.init();

      const result = manager.removeBody({ id: 1 });

      expect(result).toBe(manager);
    });
  });

  describe('disableDebug()', () => {
    test('sets debugEnabled to false', async () => {
      await manager.init();
      manager.debugEnabled = true;

      manager.disableDebug();

      expect(manager.debugEnabled).toBe(false);
    });

    test('returns early if debug is already disabled', () => {
      manager.debugEnabled = false;

      const result = manager.disableDebug();

      expect(result).toBe(manager);
    });

    test('returns this for chaining', () => {
      manager.debugEnabled = true;

      const result = manager.disableDebug();

      expect(result).toBe(manager);
    });
  });

  describe('cleanup()', () => {
    test('nullifies world and cannonWorld', async () => {
      await manager.init();

      manager.cleanup();

      expect(manager.world).toBeNull();
      expect(manager.cannonWorld).toBeNull();
    });

    test('removes collision event listeners', async () => {
      await manager.init();
      const cannonWorld = manager.cannonWorld;
      const boundStart = manager.boundCollisionStart;
      const boundEnd = manager.boundCollisionEnd;

      manager.cleanup();

      expect(cannonWorld.removeEventListener).toHaveBeenCalledWith('beginContact', boundStart);
      expect(cannonWorld.removeEventListener).toHaveBeenCalledWith('endContact', boundEnd);
    });

    test('disables debug before cleanup', async () => {
      await manager.init();
      manager.debugEnabled = true;

      manager.cleanup();

      expect(manager.debugEnabled).toBe(false);
    });

    test('returns this for chaining', async () => {
      await manager.init();

      const result = manager.cleanup();

      expect(result).toBe(manager);
    });

    test('handles cleanup when cannonWorld is already null', () => {
      manager.cannonWorld = null;

      expect(() => manager.cleanup()).not.toThrow();
    });
  });

  describe('resetWorld()', () => {
    test('creates a new PhysicsWorld after reset', async () => {
      await manager.init();
      const oldWorld = manager.world;

      await manager.resetWorld();

      expect(manager.world).not.toBeNull();
      expect(manager.world).not.toBe(oldWorld);
    });

    test('sets up collision events on the new world', async () => {
      await manager.init();

      await manager.resetWorld();

      expect(manager.world.setCollisionCallback).toHaveBeenCalled();
    });

    test('sets isResetting to false after completion', async () => {
      await manager.init();

      await manager.resetWorld();

      expect(manager.isResetting).toBe(false);
    });

    test('calls cleanup on old world', async () => {
      await manager.init();
      const oldWorld = manager.world;

      await manager.resetWorld();

      expect(oldWorld.cleanup).toHaveBeenCalled();
    });
  });

  describe('setupContactListeners()', () => {
    test('adds beginContact and endContact listeners to ballBody', async () => {
      const mockBody = { addEventListener: jest.fn() };
      mockGame.ballManager = { ball: { body: mockBody } };

      await manager.init();

      expect(mockBody.addEventListener).toHaveBeenCalledWith('beginContact', expect.any(Function));
      expect(mockBody.addEventListener).toHaveBeenCalledWith('endContact', expect.any(Function));
    });

    test('does not add listeners when ballBody is null', () => {
      manager.ballBody = null;

      manager.setupContactListeners();

      expect(manager.ballBody).toBeNull();
    });
  });

  describe('handleBeginContact()', () => {
    test('sets isInBunker and increases damping on bunker contact', async () => {
      const mockBody = { addEventListener: jest.fn(), linearDamping: 0.6 };
      mockGame.ballManager = {
        ball: { body: mockBody, bunkerLinearDamping: 0.95, defaultLinearDamping: 0.6 }
      };

      await manager.init();

      manager.handleBeginContact({
        body: { userData: { isBunkerZone: true } }
      });

      expect(manager.isInBunker).toBe(true);
      expect(mockBody.linearDamping).toBe(0.95);
    });

    test('does not change state for non-bunker bodies', async () => {
      const mockBody = { addEventListener: jest.fn(), linearDamping: 0.6 };
      mockGame.ballManager = {
        ball: { body: mockBody, bunkerLinearDamping: 0.95, defaultLinearDamping: 0.6 }
      };

      await manager.init();

      manager.handleBeginContact({
        body: { userData: {} }
      });

      expect(manager.isInBunker).toBe(false);
      expect(mockBody.linearDamping).toBe(0.6);
    });
  });

  describe('handleEndContact()', () => {
    test('clears isInBunker and restores damping on bunker exit', async () => {
      const mockBody = { addEventListener: jest.fn(), linearDamping: 0.95 };
      mockGame.ballManager = {
        ball: { body: mockBody, bunkerLinearDamping: 0.95, defaultLinearDamping: 0.6 }
      };

      await manager.init();
      manager.isInBunker = true;

      manager.handleEndContact({
        body: { userData: { isBunkerZone: true } }
      });

      expect(manager.isInBunker).toBe(false);
      expect(mockBody.linearDamping).toBe(0.6);
    });

    test('does not change state when not in bunker', async () => {
      const mockBody = { addEventListener: jest.fn(), linearDamping: 0.6 };
      mockGame.ballManager = {
        ball: { body: mockBody, bunkerLinearDamping: 0.95, defaultLinearDamping: 0.6 }
      };

      await manager.init();
      manager.isInBunker = false;

      manager.handleEndContact({
        body: { userData: { isBunkerZone: true } }
      });

      expect(manager.isInBunker).toBe(false);
      expect(mockBody.linearDamping).toBe(0.6);
    });
  });
});
