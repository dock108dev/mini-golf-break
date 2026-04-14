import { EventManager } from '../../managers/EventManager';
import { EventTypes } from '../../events/EventTypes';

jest.mock('../../events/GameEvent', () => ({
  GameEvent: jest.fn().mockImplementation((type, data, source) => ({
    type,
    data,
    source,
    timestamp: Date.now(),
    toString: () => `GameEvent[${type}]: ${JSON.stringify(data)}`
  }))
}));

describe('EventManager', () => {
  let eventManager;
  let mockGame;

  beforeEach(() => {
    mockGame = {
      debugManager: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        enabled: false
      }
    };
    eventManager = new EventManager(mockGame);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    eventManager.cleanup();
    jest.restoreAllMocks();
  });

  describe('subscribe() + publish()', () => {
    test('subscriber callback receives correct event payload', () => {
      const callback = jest.fn();
      const payload = { power: 42, direction: { x: 1, y: 0 } };

      eventManager.subscribe(EventTypes.BALL_HIT, callback);
      eventManager.publish(EventTypes.BALL_HIT, payload);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventTypes.BALL_HIT,
          data: payload
        })
      );
    });

    test('subscriber receives exact data object emitted', () => {
      const callback = jest.fn();
      const payload = { nested: { deep: true }, count: 7 };

      eventManager.subscribe(EventTypes.HOLE_COMPLETED, callback);
      eventManager.publish(EventTypes.HOLE_COMPLETED, payload);

      const receivedEvent = callback.mock.calls[0][0];
      expect(receivedEvent.data).toBe(payload);
    });

    test('subscribe returns an unsubscribe function', () => {
      const callback = jest.fn();
      const unsub = eventManager.subscribe(EventTypes.BALL_HIT, callback);

      expect(typeof unsub).toBe('function');
    });

    test('callback is invoked with context when provided', () => {
      const context = { name: 'TestManager' };
      const callback = jest.fn(function () {
        return this;
      });

      eventManager.subscribe(EventTypes.BALL_HIT, callback, context);
      eventManager.publish(EventTypes.BALL_HIT, {});

      expect(callback.mock.instances[0]).toBe(context);
    });
  });

  describe('unsubscribe()', () => {
    test('removed subscriber does not receive subsequent events', () => {
      const callback = jest.fn();

      eventManager.subscribe(EventTypes.BALL_HIT, callback);
      eventManager.publish(EventTypes.BALL_HIT, { first: true });
      expect(callback).toHaveBeenCalledTimes(1);

      eventManager.unsubscribe(EventTypes.BALL_HIT, callback);
      eventManager.publish(EventTypes.BALL_HIT, { second: true });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('returned unsubscribe function removes the subscriber', () => {
      const callback = jest.fn();
      const unsub = eventManager.subscribe(EventTypes.BALL_HIT, callback);

      unsub();
      eventManager.publish(EventTypes.BALL_HIT, {});

      expect(callback).not.toHaveBeenCalled();
    });

    test('unsubscribing one subscriber does not affect others', () => {
      const callbackA = jest.fn();
      const callbackB = jest.fn();

      eventManager.subscribe(EventTypes.BALL_HIT, callbackA);
      eventManager.subscribe(EventTypes.BALL_HIT, callbackB);

      eventManager.unsubscribe(EventTypes.BALL_HIT, callbackA);
      eventManager.publish(EventTypes.BALL_HIT, {});

      expect(callbackA).not.toHaveBeenCalled();
      expect(callbackB).toHaveBeenCalledTimes(1);
    });

    test('unsubscribe for non-existent event type does not throw', () => {
      expect(() => {
        eventManager.unsubscribe('non:existent', jest.fn());
      }).not.toThrow();
    });

    test('unsubscribe with context only removes matching subscriber', () => {
      const callback = jest.fn();
      const contextA = { id: 'a' };
      const contextB = { id: 'b' };

      eventManager.subscribe(EventTypes.BALL_HIT, callback, contextA);
      eventManager.subscribe(EventTypes.BALL_HIT, callback, contextB);

      eventManager.unsubscribe(EventTypes.BALL_HIT, callback, contextA);
      eventManager.publish(EventTypes.BALL_HIT, {});

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple subscribers for one event type', () => {
    test('all subscribers receive the emission', () => {
      const callbacks = [jest.fn(), jest.fn(), jest.fn()];
      const payload = { hole: 5 };

      callbacks.forEach(cb => eventManager.subscribe(EventTypes.HOLE_COMPLETED, cb));
      eventManager.publish(EventTypes.HOLE_COMPLETED, payload);

      callbacks.forEach(cb => {
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(
          expect.objectContaining({ type: EventTypes.HOLE_COMPLETED, data: payload })
        );
      });
    });

    test('subscribers for different event types are independent', () => {
      const hitCallback = jest.fn();
      const stoppedCallback = jest.fn();

      eventManager.subscribe(EventTypes.BALL_HIT, hitCallback);
      eventManager.subscribe(EventTypes.BALL_STOPPED, stoppedCallback);

      eventManager.publish(EventTypes.BALL_HIT, {});

      expect(hitCallback).toHaveBeenCalledTimes(1);
      expect(stoppedCallback).not.toHaveBeenCalled();
    });
  });

  describe('publish with no subscribers', () => {
    test('does not throw when no subscribers exist', () => {
      expect(() => {
        eventManager.publish(EventTypes.BALL_HIT, { power: 10 });
      }).not.toThrow();
    });

    test('does not throw for an unknown event type', () => {
      expect(() => {
        eventManager.publish('completely:unknown', { foo: 'bar' });
      }).not.toThrow();
    });

    test('event is still added to history even with no subscribers', () => {
      eventManager.publish(EventTypes.BALL_HIT, { power: 10 });
      const history = eventManager.getEventHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe(EventTypes.BALL_HIT);
    });
  });

  describe('publish payload passthrough', () => {
    test('complex nested payload is passed through unchanged', () => {
      const callback = jest.fn();
      const payload = {
        position: { x: 1.5, y: 0, z: -3.2 },
        velocity: { x: 0.1, y: 0, z: -0.5 },
        flags: ['bounced', 'hazard'],
        meta: null
      };

      eventManager.subscribe(EventTypes.BALL_MOVED, callback);
      eventManager.publish(EventTypes.BALL_MOVED, payload);

      const receivedData = callback.mock.calls[0][0].data;
      expect(receivedData).toBe(payload);
      expect(receivedData.position).toEqual({ x: 1.5, y: 0, z: -3.2 });
      expect(receivedData.flags).toEqual(['bounced', 'hazard']);
      expect(receivedData.meta).toBeNull();
    });

    test('publish with no data defaults to empty object', () => {
      const callback = jest.fn();
      eventManager.subscribe(EventTypes.GAME_STARTED, callback);
      eventManager.publish(EventTypes.GAME_STARTED);

      const receivedData = callback.mock.calls[0][0].data;
      expect(receivedData).toEqual({});
    });
  });

  describe('cleanup()', () => {
    test('removes all subscriptions', () => {
      const callback = jest.fn();
      eventManager.subscribe(EventTypes.BALL_HIT, callback);
      eventManager.subscribe(EventTypes.HOLE_COMPLETED, callback);

      eventManager.cleanup();
      eventManager.enabled = true;

      eventManager.publish(EventTypes.BALL_HIT, {});
      eventManager.publish(EventTypes.HOLE_COMPLETED, {});

      expect(callback).not.toHaveBeenCalled();
    });

    test('clears event history', () => {
      eventManager.publish(EventTypes.BALL_HIT, {});
      eventManager.publish(EventTypes.BALL_HIT, {});
      expect(eventManager.getEventHistory()).toHaveLength(2);

      eventManager.cleanup();
      expect(eventManager.getEventHistory()).toHaveLength(0);
    });

    test('disables the event manager', () => {
      eventManager.cleanup();
      expect(eventManager.enabled).toBe(false);
    });

    test('subsequent emissions after cleanup are no-ops', () => {
      const callback = jest.fn();
      eventManager.subscribe(EventTypes.BALL_HIT, callback);

      eventManager.cleanup();
      eventManager.publish(EventTypes.BALL_HIT, {});

      expect(callback).not.toHaveBeenCalled();
      expect(eventManager.getEventHistory()).toHaveLength(0);
    });
  });

  describe('subscribeToMany()', () => {
    test('subscribes to multiple event types with one callback', () => {
      const callback = jest.fn();
      const types = [EventTypes.BALL_HIT, EventTypes.BALL_STOPPED, EventTypes.BALL_RESET];

      eventManager.subscribeToMany(types, callback);

      types.forEach(type => eventManager.publish(type, { type }));

      expect(callback).toHaveBeenCalledTimes(3);
    });

    test('returned function unsubscribes from all event types', () => {
      const callback = jest.fn();
      const types = [EventTypes.BALL_HIT, EventTypes.BALL_STOPPED];

      const unsub = eventManager.subscribeToMany(types, callback);
      unsub();

      types.forEach(type => eventManager.publish(type, {}));
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('error handling in subscribers', () => {
    test('error in one subscriber does not prevent others from receiving', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('subscriber error');
      });
      const normalCallback = jest.fn();

      eventManager.subscribe(EventTypes.BALL_HIT, errorCallback);
      eventManager.subscribe(EventTypes.BALL_HIT, normalCallback);

      expect(() => eventManager.publish(EventTypes.BALL_HIT, {})).not.toThrow();
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });

    test('error in subscriber does not prevent ERROR_OCCURRED from being published', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('boom');
      });
      const errorHandler = jest.fn();

      eventManager.subscribe(EventTypes.BALL_HIT, errorCallback);
      eventManager.subscribe(EventTypes.ERROR_OCCURRED, errorHandler);

      eventManager.publish(EventTypes.BALL_HIT, {});

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventTypes.ERROR_OCCURRED,
          data: expect.objectContaining({
            source: 'EventManager',
            error: 'boom',
            eventType: EventTypes.BALL_HIT
          })
        })
      );
    });

    test('error in ERROR_OCCURRED handler does not cause infinite loop', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('recursive error');
      });

      eventManager.subscribe(EventTypes.ERROR_OCCURRED, errorCallback);
      eventManager.publish(EventTypes.ERROR_OCCURRED, {});

      expect(errorCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('enable / disable', () => {
    test('disabled manager does not deliver events', () => {
      const callback = jest.fn();
      eventManager.subscribe(EventTypes.BALL_HIT, callback);

      eventManager.disable();
      eventManager.publish(EventTypes.BALL_HIT, {});

      expect(callback).not.toHaveBeenCalled();
    });

    test('re-enabled manager delivers events normally', () => {
      const callback = jest.fn();
      eventManager.subscribe(EventTypes.BALL_HIT, callback);

      eventManager.disable();
      eventManager.enable();
      eventManager.publish(EventTypes.BALL_HIT, {});

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
