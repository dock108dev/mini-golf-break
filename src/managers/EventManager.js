import { GameEvent } from '../events/GameEvent';
import { EventTypes } from '../events/EventTypes';

/**
 * EventManager - Central event bus for the game
 * Handles event publishing and subscription to decouple components
 */
export class EventManager {
  constructor(game) {
    this.game = game;
    this.subscribers = new Map();
    this.enabled = true;
    this.eventHistory = [];
    this.historyLimit = 50; // Keep last 50 events for debugging
    this.debug = false;
  }

  /**
   * Initialize the event manager
   */
  init() {
    this.clear();
    this.enabled = true;
    this.debug = this.game.debugManager ? this.game.debugManager.enabled : false;
    return this;
  }

  /**
   * Subscribe to an event
   * @param {string} eventType - Type of event from EventTypes
   * @param {function} callback - Function to call when event is published
   * @param {object} context - The 'this' context for the callback
   * @returns {function} Unsubscribe function
   */
  subscribe(eventType, callback, context = null) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }

    const subscriber = { callback, context };
    this.subscribers.get(eventType).push(subscriber);

    // Return unsubscribe function
    return () => this.unsubscribe(eventType, callback, context);
  }

  /**
   * Subscribe to multiple event types with the same callback
   * @param {string[]} eventTypes - Array of event types to subscribe to
   * @param {function} callback - Function to call when any of these events is published
   * @param {object} context - The 'this' context for the callback
   * @returns {function} Unsubscribe function that removes all subscriptions
   */
  subscribeToMany(eventTypes, callback, context = null) {
    const unsubscribeFunctions = eventTypes.map(type => this.subscribe(type, callback, context));

    // Return a function that unsubscribes from all event types
    return () => unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventType - Type of event
   * @param {function} callback - The callback function to remove
   * @param {object} context - The context of the callback
   */
  unsubscribe(eventType, callback, context = null) {
    if (!this.subscribers.has(eventType)) {
      return;
    }

    const subscribers = this.subscribers.get(eventType);
    const index = subscribers.findIndex(s => s.callback === callback && s.context === context);

    if (index !== -1) {
      subscribers.splice(index, 1);
    }
  }

  /**
   * Publish an event to all subscribers
   * @param {string} eventType - Type of event
   * @param {object} data - Event data
   * @param {object} source - Source object that triggered the event
   */
  publish(eventType, data = {}, source = null) {
    if (!this.enabled) {
      return;
    }

    const event = new GameEvent(eventType, data, source);

    // Log event in debug mode
    if (this.debug) {
      this.logEvent(event);
    }

    // Store in history
    this.addToHistory(event);

    if (!this.subscribers.has(eventType)) {
      return;
    }

    this.subscribers.get(eventType).forEach(subscriber => {
      try {
        const { callback, context } = subscriber;
        callback.call(context, event);
      } catch (error) {
        // Create a context-rich error message
        const subscriberInfo = subscriber.context
          ? `in ${subscriber.context.constructor ? subscriber.context.constructor.name : 'unknown'} context`
          : 'with no context';

        // Create a compact representation of data for logging
        const simplifiedData = this.getSimplifiedData(data);

        // Determine if this error should be displayed in the UI
        // Critical errors that might affect gameplay should be shown to users
        const isUICritical = this.isCriticalEventError(eventType, error);

        if (this.game.debugManager) {
          // Use proper source identification and include comprehensive context
          this.game.debugManager.error(
            'EventManager.publish',
            `Error handling event ${eventType} ${subscriberInfo}: ${error.message}`,
            {
              eventType,
              eventData: simplifiedData,
              source: source ? this.getSourceIdentifier(source) : null,
              error: {
                message: error.message,
                stack: error.stack
              }
            },
            isUICritical // Show in UI for critical gameplay-affecting errors
          );
        } else {
          // Fallback to console if DebugManager is not available
          console.error(
            `[ERROR] EventManager.publish: Error handling event ${eventType} ${subscriberInfo}:`,
            error,
            { eventData: simplifiedData }
          );
        }

        // Optionally publish a system error event for other components to react
        if (eventType !== EventTypes.ERROR_OCCURRED) {
          // Prevent infinite loops
          this.publish(EventTypes.ERROR_OCCURRED, {
            source: 'EventManager',
            error: error.message,
            eventType
          });
        }
      }
    });
  }

  /**
   * Create a simplified representation of event data for logging
   * @param {object} data - The event data
   * @returns {object} Simplified data for logging
   * @private
   */
  getSimplifiedData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Create a simplified copy for logging
    const simplified = {};

    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value === null || value === undefined) {
        simplified[key] = value;
      } else if (typeof value === 'object') {
        if (value instanceof Array) {
          simplified[key] = `Array(${value.length})`;
        } else if (value.constructor && value.constructor.name) {
          simplified[key] = `Object<${value.constructor.name}>`;
        } else {
          simplified[key] = 'Object';
        }
      } else {
        simplified[key] = value;
      }
    });

    return simplified;
  }

  /**
   * Get an identifier for the source object
   * @param {object} source - Source object
   * @returns {string} Source identifier
   * @private
   */
  getSourceIdentifier(source) {
    if (!source) {
      return 'unknown';
    }
    if (typeof source === 'string') {
      return source;
    }
    if (source.constructor && source.constructor.name) {
      return source.constructor.name;
    }
    return 'unknown';
  }

  /**
   * Determine if an event error is critical enough to show in the UI
   * @param {string} eventType - The event type where the error occurred
   * @param {Error} error - The error that occurred
   * @returns {boolean} Whether to show in UI
   * @private
   */
  isCriticalEventError(eventType, _error) {
    // Determine which event handler errors are critical enough for UI display
    // Errors in core gameplay events might warrant user notification
    const criticalEventTypes = [
      EventTypes.BALL_HIT,
      EventTypes.HOLE_COMPLETED,
      EventTypes.GAME_COMPLETED,
      EventTypes.GAME_STARTED,
      EventTypes.HAZARD_DETECTED
    ];

    return criticalEventTypes.includes(eventType);
  }

  /**
   * Log an event in debug mode
   * @param {GameEvent} event - The event to log
   */
  logEvent(event) {
    if (this.game.debugManager) {
      this.game.debugManager.log(`EVENT: ${event.toString()}`);
    }
  }

  /**
   * Add an event to the history
   * @param {GameEvent} event - The event to add
   */
  addToHistory(event) {
    this.eventHistory.push(event);

    // Trim history if needed
    if (this.eventHistory.length > this.historyLimit) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get recent event history
   * @param {number} count - Number of events to return (default all)
   * @returns {GameEvent[]} Recent events
   */
  getEventHistory(count = this.historyLimit) {
    return this.eventHistory.slice(-count);
  }

  /**
   * Disable all event publishing (for testing or during scene transitions)
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Enable event publishing
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Clear all subscribers and history
   */
  clear() {
    this.subscribers.clear();
    this.eventHistory = [];
  }

  /**
   * Get the event types enumeration
   * @returns {object} The EventTypes enumeration
   */
  getEventTypes() {
    return EventTypes;
  }

  /**
   * Cleanup the event manager
   */
  cleanup() {
    this.clear();
    this.enabled = false;
  }
}
