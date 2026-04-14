import { HazardManager } from '../../managers/HazardManager';
import { EventTypes } from '../../events/EventTypes';
import { GameEvent } from '../../events/GameEvent';

jest.mock('../../objects/hazards/HazardFactory');

describe('HazardManager', () => {
  let mockGame;
  let mockEventManager;
  let mockBallManager;
  let manager;
  let eventHandlers;

  beforeEach(() => {
    eventHandlers = {};

    mockEventManager = {
      publish: jest.fn(),
      subscribe: jest.fn((type, handler, context) => {
        eventHandlers[type] = handler.bind(context);
        return jest.fn();
      })
    };

    mockBallManager = {
      ball: {
        mesh: {
          position: { x: 0, y: 0.2, z: 0 }
        }
      },
      resetBall: jest.fn()
    };

    mockGame = {
      eventManager: mockEventManager,
      ballManager: mockBallManager,
      stateManager: {
        getState: jest.fn(() => ({ currentHoleNumber: 1 }))
      },
      debugManager: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      uiManager: {
        showMessage: jest.fn()
      }
    };

    jest.spyOn(Date, 'now').mockReturnValue(10000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('init()', () => {
    test('registers listeners for ball-position events', () => {
      manager = new HazardManager(mockGame);
      manager.init();

      expect(mockEventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_STOPPED,
        expect.any(Function),
        manager
      );
      expect(mockEventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_CREATED,
        expect.any(Function),
        manager
      );
      expect(mockEventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_MOVED,
        expect.any(Function),
        manager
      );
    });

    test('sets up OOB bounds from defaults', () => {
      manager = new HazardManager(mockGame);
      manager.init();

      expect(manager.boundaryLimits).toEqual({
        minX: -50,
        maxX: 50,
        minZ: -50,
        maxZ: 50,
        minY: -10
      });
    });

    test('sets isInitialized to true', () => {
      manager = new HazardManager(mockGame);
      manager.init();
      expect(manager.isInitialized).toBe(true);
    });

    test('prevents duplicate subscriptions on repeated init calls', () => {
      manager = new HazardManager(mockGame);
      manager.init();
      const firstCount = mockEventManager.subscribe.mock.calls.length;
      manager.init();
      expect(mockEventManager.subscribe.mock.calls.length).toBe(firstCount);
    });

    test('resets lastOobTime on init', () => {
      manager = new HazardManager(mockGame);
      manager.lastOobTime = 9999;
      manager.init();
      expect(manager.lastOobTime).toBe(0);
    });
  });

  describe('setHoleBounds()', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
    });

    test('applies per-hole bounds from config', () => {
      manager.setHoleBounds({
        outOfBounds: { minX: -10, maxX: 10, minZ: -15, maxZ: 15, minY: -5 }
      });

      expect(manager.boundaryLimits).toEqual({
        minX: -10,
        maxX: 10,
        minZ: -15,
        maxZ: 15,
        minY: -5
      });
    });

    test('falls back to defaults when outOfBounds is absent', () => {
      manager.setHoleBounds({});
      expect(manager.boundaryLimits).toEqual({
        minX: -50,
        maxX: 50,
        minZ: -50,
        maxZ: 50,
        minY: -10
      });
    });

    test('falls back to defaults when config is null', () => {
      manager.setHoleBounds(null);
      expect(manager.boundaryLimits).toEqual({
        minX: -50,
        maxX: 50,
        minZ: -50,
        maxZ: 50,
        minY: -10
      });
    });

    test('fills missing individual fields with defaults', () => {
      manager.setHoleBounds({ outOfBounds: { minX: -3 } });
      expect(manager.boundaryLimits.minX).toBe(-3);
      expect(manager.boundaryLimits.maxX).toBe(50);
      expect(manager.boundaryLimits.minZ).toBe(-50);
      expect(manager.boundaryLimits.maxZ).toBe(50);
      expect(manager.boundaryLimits.minY).toBe(-10);
    });
  });

  describe('OOB detection — all three axes', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
      manager.setHoleBounds({
        outOfBounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10, minY: -5 }
      });
    });

    test('detects OOB when X < minX', () => {
      mockBallManager.ball.mesh.position = { x: -11, y: 0, z: 0 };
      expect(manager.checkHazards()).toBe(true);
    });

    test('detects OOB when X > maxX', () => {
      mockBallManager.ball.mesh.position = { x: 11, y: 0, z: 0 };
      expect(manager.checkHazards()).toBe(true);
    });

    test('detects OOB when Z < minZ', () => {
      mockBallManager.ball.mesh.position = { x: 0, y: 0, z: -11 };
      expect(manager.checkHazards()).toBe(true);
    });

    test('detects OOB when Z > maxZ', () => {
      mockBallManager.ball.mesh.position = { x: 0, y: 0, z: 11 };
      expect(manager.checkHazards()).toBe(true);
    });

    test('detects OOB when Y < minY (lost ball)', () => {
      mockBallManager.ball.mesh.position = { x: 0, y: -6, z: 0 };
      expect(manager.checkHazards()).toBe(true);
    });

    test('does not trigger OOB for position within bounds', () => {
      mockBallManager.ball.mesh.position = { x: 5, y: 0, z: 5 };
      expect(manager.checkHazards()).toBe(false);
    });

    test('boundary edge values: position at exact limit is not OOB', () => {
      mockBallManager.ball.mesh.position = { x: 10, y: 0, z: 10 };
      expect(manager.checkHazards()).toBe(false);
    });

    test('boundary edge: position at negative exact limit is not OOB', () => {
      mockBallManager.ball.mesh.position = { x: -10, y: -5, z: -10 };
      expect(manager.checkHazards()).toBe(false);
    });
  });

  describe('OOB event payload', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
      manager.setHoleBounds({
        outOfBounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10, minY: -5 }
      });
    });

    test('emits hazard:detected with hazardType outOfBounds', () => {
      mockBallManager.ball.mesh.position = { x: 15, y: 0, z: 0 };
      manager.checkHazards();

      expect(mockEventManager.publish).toHaveBeenCalledWith(
        EventTypes.HAZARD_DETECTED,
        expect.objectContaining({ hazardType: 'outOfBounds' }),
        manager
      );
    });

    test('emits penalty of 1 in event payload', () => {
      mockBallManager.ball.mesh.position = { x: 15, y: 0, z: 0 };
      manager.checkHazards();

      expect(mockEventManager.publish).toHaveBeenCalledWith(
        EventTypes.HAZARD_DETECTED,
        expect.objectContaining({ penalty: 1 }),
        manager
      );
    });

    test('includes lastSafePosition in event payload', () => {
      manager.lastSafePosition = { x: 2, y: 0, z: 3, clone: jest.fn(() => ({ x: 2, y: 0, z: 3 })) };
      mockBallManager.ball.mesh.position = { x: 15, y: 0, z: 0 };
      manager.checkHazards();

      const publishedData = mockEventManager.publish.mock.calls[0][1];
      expect(publishedData.lastSafePosition).toEqual({ x: 2, y: 0, z: 3 });
    });

    test('shows UI message on OOB', () => {
      mockBallManager.ball.mesh.position = { x: 15, y: 0, z: 0 };
      manager.checkHazards();

      expect(mockGame.uiManager.showMessage).toHaveBeenCalledWith(
        'Out of bounds! +1 stroke penalty.',
        2000
      );
    });
  });

  describe('penalty increment — exactly once per distinct OOB event', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
      manager.setHoleBounds({
        outOfBounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10, minY: -5 }
      });
    });

    test('fires penalty event exactly once for single OOB', () => {
      mockBallManager.ball.mesh.position = { x: 15, y: 0, z: 0 };
      manager.checkHazards();

      expect(mockEventManager.publish).toHaveBeenCalledTimes(1);
    });

    test('fires penalty again after cooldown expires', () => {
      mockBallManager.ball.mesh.position = { x: 15, y: 0, z: 0 };

      Date.now.mockReturnValue(10000);
      manager.checkHazards();
      expect(mockEventManager.publish).toHaveBeenCalledTimes(1);

      Date.now.mockReturnValue(10600);
      manager.checkHazards();
      expect(mockEventManager.publish).toHaveBeenCalledTimes(2);
    });
  });

  describe('ball reset to last-valid-position after OOB', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
    });

    test('lastSafePosition is updated on BALL_STOPPED event', () => {
      manager.lastSafePosition.copy = jest.fn(
        function (pos) {
          this.x = pos.x;
          this.y = pos.y;
          this.z = pos.z;
          return this;
        }.bind(manager.lastSafePosition)
      );

      const event = new GameEvent(EventTypes.BALL_STOPPED, {
        position: { x: 5, y: 0.2, z: 3 }
      });

      eventHandlers[EventTypes.BALL_STOPPED](event);

      expect(manager.lastSafePosition.x).toBe(5);
    });

    test('lastSafePosition is updated on BALL_CREATED event', () => {
      manager.lastSafePosition.copy = jest.fn(
        function (pos) {
          this.x = pos.x;
          this.y = pos.y;
          this.z = pos.z;
          return this;
        }.bind(manager.lastSafePosition)
      );

      const event = new GameEvent(EventTypes.BALL_CREATED, {
        position: { x: 1, y: 0.2, z: 2 }
      });

      eventHandlers[EventTypes.BALL_CREATED](event);

      expect(manager.lastSafePosition.x).toBe(1);
    });

    test('lastSafePosition is NOT updated when position is in hazard zone', () => {
      manager.setHoleBounds({
        outOfBounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5, minY: -3 }
      });

      manager.lastSafePosition.copy = jest.fn(
        function (pos) {
          this.x = pos.x;
          this.y = pos.y;
          this.z = pos.z;
          return this;
        }.bind(manager.lastSafePosition)
      );

      const oobPosition = { x: 20, y: 0, z: 0 };
      const event = new GameEvent(EventTypes.BALL_STOPPED, { position: oobPosition });

      eventHandlers[EventTypes.BALL_STOPPED](event);

      expect(manager.lastSafePosition.x).toBe(0);
    });

    test('OOB event payload contains last safe position from before crossing', () => {
      manager.lastSafePosition.copy = jest.fn(
        function (pos) {
          this.x = pos.x;
          this.y = pos.y;
          this.z = pos.z;
          return this;
        }.bind(manager.lastSafePosition)
      );

      const safePos = { x: 3, y: 0.2, z: 4 };
      const event = new GameEvent(EventTypes.BALL_STOPPED, { position: safePos });
      eventHandlers[EventTypes.BALL_STOPPED](event);

      manager.setHoleBounds({
        outOfBounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5, minY: -3 }
      });

      mockBallManager.ball.mesh.position = { x: 10, y: 0, z: 0 };
      manager.checkHazards();

      const publishedData = mockEventManager.publish.mock.calls[0][1];
      expect(publishedData.lastSafePosition.x).toBe(3);
      expect(publishedData.lastSafePosition.z).toBe(4);
    });
  });

  describe('lastValidPosition update behavior', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
    });

    test('updates safe position only via BALL_STOPPED (stable ball)', () => {
      manager.lastSafePosition.copy = jest.fn(
        function (pos) {
          this.x = pos.x;
          this.y = pos.y;
          this.z = pos.z;
          return this;
        }.bind(manager.lastSafePosition)
      );

      const stoppedEvent = new GameEvent(EventTypes.BALL_STOPPED, {
        position: { x: 7, y: 0.2, z: 8 }
      });
      eventHandlers[EventTypes.BALL_STOPPED](stoppedEvent);

      expect(manager.lastSafePosition.x).toBe(7);
      expect(manager.lastSafePosition.z).toBe(8);
    });

    test('does not update safe position when no position in event', () => {
      const event = new GameEvent(EventTypes.BALL_STOPPED, {});
      eventHandlers[EventTypes.BALL_STOPPED](event);

      expect(manager.lastSafePosition.x).toBe(0);
      expect(manager.lastSafePosition.z).toBe(0);
    });
  });

  describe('double-penalty guard (500ms debounce)', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
      manager.setHoleBounds({
        outOfBounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5, minY: -3 }
      });
      mockBallManager.ball.mesh.position = { x: 10, y: 0, z: 0 };
    });

    test('two rapid OOB events within 500ms count as one penalty', () => {
      Date.now.mockReturnValue(10000);
      manager.checkHazards();

      Date.now.mockReturnValue(10400);
      manager.checkHazards();

      expect(mockEventManager.publish).toHaveBeenCalledTimes(1);
    });

    test('OOB event fires again after 500ms cooldown', () => {
      Date.now.mockReturnValue(10000);
      manager.checkHazards();

      Date.now.mockReturnValue(10501);
      manager.checkHazards();

      expect(mockEventManager.publish).toHaveBeenCalledTimes(2);
    });

    test('OOB at exactly 500ms boundary is still blocked', () => {
      Date.now.mockReturnValue(10000);
      manager.checkHazards();

      Date.now.mockReturnValue(10499);
      manager.checkHazards();

      expect(mockEventManager.publish).toHaveBeenCalledTimes(1);
    });

    test('rapid triple OOB produces only one penalty', () => {
      Date.now.mockReturnValue(10000);
      manager.checkHazards();

      Date.now.mockReturnValue(10100);
      manager.checkHazards();

      Date.now.mockReturnValue(10200);
      manager.checkHazards();

      expect(mockEventManager.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup() / destroy()', () => {
    test('unsubscribes from all events', () => {
      manager = new HazardManager(mockGame);
      manager.init();

      const unsubFns = manager.eventSubscriptions.map(() => jest.fn());
      manager.eventSubscriptions = unsubFns;

      manager.cleanup();

      unsubFns.forEach(fn => {
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });

    test('clears hazards array', () => {
      manager = new HazardManager(mockGame);
      manager.init();
      manager.hazards = [{ type: 'water' }, { type: 'bunker' }];

      manager.cleanup();

      expect(manager.hazards).toEqual([]);
    });

    test('resets isInitialized to false', () => {
      manager = new HazardManager(mockGame);
      manager.init();

      manager.cleanup();

      expect(manager.isInitialized).toBe(false);
    });

    test('resets lastOobTime', () => {
      manager = new HazardManager(mockGame);
      manager.init();
      manager.lastOobTime = 9999;

      manager.cleanup();

      expect(manager.lastOobTime).toBe(0);
    });

    test('no events fire after cleanup', () => {
      manager = new HazardManager(mockGame);
      manager.init();
      manager.cleanup();

      mockBallManager.ball.mesh.position = { x: 100, y: 0, z: 0 };
      manager.update();

      expect(mockEventManager.publish).not.toHaveBeenCalled();
    });

    test('clears eventSubscriptions array', () => {
      manager = new HazardManager(mockGame);
      manager.init();

      manager.cleanup();

      expect(manager.eventSubscriptions).toEqual([]);
    });
  });

  describe('update() frame-gated checks', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
    });

    test('does not check hazards when not initialized', () => {
      manager.isInitialized = false;
      const spy = jest.spyOn(manager, 'checkHazards');
      manager.update();
      expect(spy).not.toHaveBeenCalled();
    });

    test('does not check hazards when ball is null', () => {
      mockGame.ballManager.ball = null;
      const spy = jest.spyOn(manager, 'checkHazards');
      manager.update();
      expect(spy).not.toHaveBeenCalled();
    });

    test('checks hazards only at checkFrequency interval', () => {
      const spy = jest.spyOn(manager, 'checkHazards');
      manager.checkFrequency = 3;

      manager.update();
      manager.update();
      expect(spy).not.toHaveBeenCalled();

      manager.update();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('resets frameCount after check', () => {
      manager.checkFrequency = 2;
      manager.update();
      manager.update();
      expect(manager.frameCount).toBe(0);
    });
  });

  describe('checkHazards() guards', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
    });

    test('returns false when no ballManager', () => {
      mockGame.ballManager = null;
      expect(manager.checkHazards()).toBe(false);
    });

    test('returns false when ball is null', () => {
      mockGame.ballManager.ball = null;
      expect(manager.checkHazards()).toBe(false);
    });

    test('returns false when ball is within bounds', () => {
      mockBallManager.ball.mesh.position = { x: 0, y: 0, z: 0 };
      expect(manager.checkHazards()).toBe(false);
    });
  });

  describe('isPositionOutOfBounds()', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
      manager.setHoleBounds({
        outOfBounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10, minY: -5 }
      });
    });

    test('returns true for X outside bounds', () => {
      expect(manager.isPositionOutOfBounds({ x: -11, y: 0, z: 0 })).toBe(true);
      expect(manager.isPositionOutOfBounds({ x: 11, y: 0, z: 0 })).toBe(true);
    });

    test('returns true for Z outside bounds', () => {
      expect(manager.isPositionOutOfBounds({ x: 0, y: 0, z: -11 })).toBe(true);
      expect(manager.isPositionOutOfBounds({ x: 0, y: 0, z: 11 })).toBe(true);
    });

    test('returns false for position within bounds', () => {
      expect(manager.isPositionOutOfBounds({ x: 0, y: 0, z: 0 })).toBe(false);
    });

    test('returns false for position at exact boundary', () => {
      expect(manager.isPositionOutOfBounds({ x: 10, y: 0, z: 10 })).toBe(false);
      expect(manager.isPositionOutOfBounds({ x: -10, y: 0, z: -10 })).toBe(false);
    });
  });

  describe('isPositionInHazard()', () => {
    beforeEach(() => {
      manager = new HazardManager(mockGame);
      manager.init();
      manager.setHoleBounds({
        outOfBounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5, minY: -3 }
      });
    });

    test('returns true for OOB position', () => {
      expect(manager.isPositionInHazard({ x: 20, y: 0, z: 0 })).toBe(true);
    });

    test('returns false for in-bounds position', () => {
      expect(manager.isPositionInHazard({ x: 0, y: 0, z: 0 })).toBe(false);
    });
  });

  describe('publishHazardDetected()', () => {
    test('publishes HAZARD_DETECTED event with provided data', () => {
      manager = new HazardManager(mockGame);
      manager.init();
      const data = { type: 'water', position: { x: 1, y: 0, z: 2 } };
      manager.publishHazardDetected(data);

      expect(mockEventManager.publish).toHaveBeenCalledWith(
        EventTypes.HAZARD_DETECTED,
        data,
        manager
      );
    });
  });

  describe('publishOutOfBounds()', () => {
    test('publishes HAZARD_DETECTED with outOfBounds type', () => {
      manager = new HazardManager(mockGame);
      manager.init();
      const pos = { x: 55, y: 0, z: 0 };
      manager.publishOutOfBounds(pos);

      expect(mockEventManager.publish).toHaveBeenCalledWith(
        EventTypes.HAZARD_DETECTED,
        { hazardType: 'outOfBounds', position: pos },
        manager
      );
    });
  });
});
