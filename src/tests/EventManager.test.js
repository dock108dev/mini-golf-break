import { EventManager } from '../managers/EventManager';
import { EventTypes } from '../events/EventTypes';

// Mock GameEvent
jest.mock('../events/GameEvent', () => ({
  GameEvent: jest.fn().mockImplementation((type, data, source) => ({
    type,
    data,
    source,
    timestamp: Date.now(),
    toString: () => `Event: ${type}`
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
    console.error = jest.fn();
  });

  afterEach(() => {
    eventManager.cleanup();
    jest.clearAllMocks();
  });

  test('should subscribe and publish events correctly', () => {
    const mockCallback = jest.fn();
    const testData = { message: 'test' };

    eventManager.subscribe(EventTypes.BALL_HIT, mockCallback);
    eventManager.publish(EventTypes.BALL_HIT, testData);

    expect(mockCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EventTypes.BALL_HIT,
        data: testData
      })
    );
  });

  test('should handle multiple subscribers', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    eventManager.subscribe(EventTypes.BALL_HIT, callback1);
    eventManager.subscribe(EventTypes.BALL_HIT, callback2);
    eventManager.publish(EventTypes.BALL_HIT, { test: true });

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });

  test('should unsubscribe correctly', () => {
    const mockCallback = jest.fn();

    const unsubscribe = eventManager.subscribe(EventTypes.BALL_HIT, mockCallback);
    unsubscribe();
    eventManager.publish(EventTypes.BALL_HIT, {});

    expect(mockCallback).not.toHaveBeenCalled();
  });

  test('should handle error in event listener gracefully', () => {
    const errorCallback = jest.fn(() => {
      throw new Error('Test error');
    });
    const normalCallback = jest.fn();

    eventManager.subscribe(EventTypes.BALL_HIT, errorCallback);
    eventManager.subscribe(EventTypes.BALL_HIT, normalCallback);

    expect(() => {
      eventManager.publish(EventTypes.BALL_HIT, {});
    }).not.toThrow();

    expect(normalCallback).toHaveBeenCalled();
  });

  test('should initialize event manager', () => {
    eventManager.subscribers.set('test', ['data']);
    eventManager.eventHistory = ['event1', 'event2'];
    eventManager.enabled = false;

    const result = eventManager.init();

    expect(eventManager.subscribers.size).toBe(0);
    expect(eventManager.eventHistory).toEqual([]);
    expect(eventManager.enabled).toBe(true);
    expect(result).toBe(eventManager);
  });

  test('should subscribe to many events at once', () => {
    const callback = jest.fn();
    const eventTypes = [EventTypes.BALL_HIT, EventTypes.HOLE_COMPLETED, EventTypes.GAME_STARTED];

    const unsubscribeAll = eventManager.subscribeToMany(eventTypes, callback);

    // Publish to each event type
    eventTypes.forEach(type => {
      eventManager.publish(type, { test: true });
    });

    expect(callback).toHaveBeenCalledTimes(3);

    // Unsubscribe from all
    unsubscribeAll();

    // Publish again - should not be called
    eventTypes.forEach(type => {
      eventManager.publish(type, { test: true });
    });

    expect(callback).toHaveBeenCalledTimes(3); // Still 3, not 6
  });

  test('should handle unsubscribe when event type does not exist', () => {
    const callback = jest.fn();

    // Try to unsubscribe from non-existent event type
    expect(() => {
      eventManager.unsubscribe('NON_EXISTENT_EVENT', callback);
    }).not.toThrow();
  });

  test('should not publish events when disabled', () => {
    const callback = jest.fn();
    eventManager.subscribe(EventTypes.BALL_HIT, callback);

    eventManager.disable();
    eventManager.publish(EventTypes.BALL_HIT, {});

    expect(callback).not.toHaveBeenCalled();

    eventManager.enable();
    eventManager.publish(EventTypes.BALL_HIT, {});

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('should log events in debug mode', () => {
    eventManager.debug = true;

    eventManager.publish(EventTypes.BALL_HIT, { power: 10 });

    expect(mockGame.debugManager.log).toHaveBeenCalledWith(expect.stringContaining('EVENT:'));
  });

  test('should maintain event history', () => {
    // Publish some events
    eventManager.publish(EventTypes.BALL_HIT, { power: 10 });
    eventManager.publish(EventTypes.HOLE_COMPLETED, { hole: 1 });
    eventManager.publish(EventTypes.GAME_STARTED, {});

    const history = eventManager.getEventHistory();
    expect(history.length).toBe(3);
    expect(history[0].type).toBe(EventTypes.BALL_HIT);
    expect(history[1].type).toBe(EventTypes.HOLE_COMPLETED);
    expect(history[2].type).toBe(EventTypes.GAME_STARTED);
  });

  test('should limit event history', () => {
    eventManager.historyLimit = 3;

    // Publish more events than the limit
    for (let i = 0; i < 5; i++) {
      eventManager.publish(EventTypes.BALL_HIT, { count: i });
    }

    const history = eventManager.getEventHistory();
    expect(history.length).toBe(3);
    expect(history[0].data.count).toBe(2); // First two should be removed
  });

  test('should get limited event history', () => {
    // Publish 5 events
    for (let i = 0; i < 5; i++) {
      eventManager.publish(EventTypes.BALL_HIT, { count: i });
    }

    const history = eventManager.getEventHistory(2);
    expect(history.length).toBe(2);
    expect(history[0].data.count).toBe(3);
    expect(history[1].data.count).toBe(4);
  });

  test('should handle getSimplifiedData with various data types', () => {
    // Test with null/undefined
    expect(eventManager.getSimplifiedData(null)).toBe(null);
    expect(eventManager.getSimplifiedData(undefined)).toBe(undefined);
    expect(eventManager.getSimplifiedData('string')).toBe('string');
    expect(eventManager.getSimplifiedData(123)).toBe(123);

    // Test with complex object
    const complexData = {
      string: 'test',
      number: 42,
      null: null,
      undefined,
      array: [1, 2, 3],
      object: { nested: true },
      instance: new Date(),
      plainObject: Object.create(null)
    };

    const simplified = eventManager.getSimplifiedData(complexData);
    expect(simplified.string).toBe('test');
    expect(simplified.number).toBe(42);
    expect(simplified.null).toBe(null);
    expect(simplified.undefined).toBe(undefined);
    expect(simplified.array).toBe('Array(3)');
    expect(simplified.object).toBe('Object<Object>');
    expect(simplified.instance).toBe('Object<Date>');
    expect(simplified.plainObject).toBe('Object');
  });

  test('should get source identifier correctly', () => {
    expect(eventManager.getSourceIdentifier(null)).toBe('unknown');
    expect(eventManager.getSourceIdentifier('StringSource')).toBe('StringSource');
    expect(eventManager.getSourceIdentifier({ constructor: { name: 'TestClass' } })).toBe(
      'TestClass'
    );
    expect(eventManager.getSourceIdentifier({})).toBe('Object'); // Empty object has Object constructor
  });

  test('should determine critical event errors', () => {
    const error = new Error('Test');

    // Critical events
    expect(eventManager.isCriticalEventError(EventTypes.BALL_HIT, error)).toBe(true);
    expect(eventManager.isCriticalEventError(EventTypes.HOLE_COMPLETED, error)).toBe(true);
    expect(eventManager.isCriticalEventError(EventTypes.GAME_COMPLETED, error)).toBe(true);
    expect(eventManager.isCriticalEventError(EventTypes.GAME_STARTED, error)).toBe(true);
    expect(eventManager.isCriticalEventError(EventTypes.HAZARD_DETECTED, error)).toBe(true);

    // Non-critical events
    expect(eventManager.isCriticalEventError(EventTypes.BALL_STOPPED, error)).toBe(false);
    expect(eventManager.isCriticalEventError('CUSTOM_EVENT', error)).toBe(false);
  });

  test('should handle error without debugManager', () => {
    // Remove debugManager
    eventManager.game.debugManager = null;

    const errorCallback = jest.fn(() => {
      throw new Error('Test error');
    });

    eventManager.subscribe(EventTypes.BALL_HIT, errorCallback);
    eventManager.publish(EventTypes.BALL_HIT, { test: true });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] EventManager.publish'),
      expect.any(Error),
      expect.any(Object)
    );
  });

  test('should publish ERROR_OCCURRED event on error', () => {
    const errorCallback = jest.fn(() => {
      throw new Error('Test error');
    });
    const errorOccurredCallback = jest.fn();

    eventManager.subscribe(EventTypes.BALL_HIT, errorCallback);
    eventManager.subscribe(EventTypes.ERROR_OCCURRED, errorOccurredCallback);

    eventManager.publish(EventTypes.BALL_HIT, {});

    expect(errorOccurredCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EventTypes.ERROR_OCCURRED,
        data: expect.objectContaining({
          source: 'EventManager',
          error: 'Test error',
          eventType: EventTypes.BALL_HIT
        })
      })
    );
  });

  test('should not cause infinite loop with ERROR_OCCURRED event', () => {
    const errorCallback = jest.fn(() => {
      throw new Error('Test error');
    });

    eventManager.subscribe(EventTypes.ERROR_OCCURRED, errorCallback);
    eventManager.publish(EventTypes.ERROR_OCCURRED, {});

    // Should only be called once, not infinitely
    expect(errorCallback).toHaveBeenCalledTimes(1);
  });

  test('should handle error with context', () => {
    const context = { constructor: { name: 'TestContext' } };
    const errorCallback = jest.fn(() => {
      throw new Error('Test error');
    });

    eventManager.subscribe(EventTypes.BALL_HIT, errorCallback, context);
    eventManager.publish(EventTypes.BALL_HIT, {});

    expect(mockGame.debugManager.error).toHaveBeenCalledWith(
      'EventManager.publish',
      expect.stringContaining('in TestContext context'),
      expect.any(Object),
      true // Critical error
    );
  });

  test('should clear all subscribers and history', () => {
    // Add some subscribers and events
    eventManager.subscribe(EventTypes.BALL_HIT, jest.fn());
    eventManager.subscribe(EventTypes.HOLE_COMPLETED, jest.fn());
    eventManager.publish(EventTypes.BALL_HIT, {});
    eventManager.publish(EventTypes.HOLE_COMPLETED, {});

    expect(eventManager.subscribers.size).toBe(2);
    expect(eventManager.eventHistory.length).toBe(2);

    eventManager.clear();

    expect(eventManager.subscribers.size).toBe(0);
    expect(eventManager.eventHistory.length).toBe(0);
  });

  test('should get event types', () => {
    const types = eventManager.getEventTypes();
    expect(types).toBe(EventTypes);
  });

  test('should handle cleanup', () => {
    // Add some data
    eventManager.subscribe(EventTypes.BALL_HIT, jest.fn());
    eventManager.publish(EventTypes.BALL_HIT, {});

    eventManager.cleanup();

    expect(eventManager.subscribers.size).toBe(0);
    expect(eventManager.eventHistory.length).toBe(0);
  });
});
