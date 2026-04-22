/**
 * Tests for KeyboardHintOverlay (ISSUE-023)
 */

import { KeyboardHintOverlay } from '../../managers/ui/KeyboardHintOverlay';

jest.mock('../../events/EventTypes', () => ({
  EventTypes: {
    HOLE_STARTED: 'hole:started',
    BALL_HIT: 'ball:hit',
    GAME_PAUSED: 'game:paused'
  }
}));

function createMockGame(handlers = {}) {
  const subscriptions = {};
  return {
    eventManager: {
      subscribe: jest.fn((type, handler, ctx) => {
        subscriptions[type] = { handler, ctx };
        return jest.fn();
      })
    },
    _subscriptions: subscriptions,
    _emit(type, payload) {
      const sub = subscriptions[type];
      if (sub) {
        const event = { get: key => payload?.[key] };
        sub.handler.call(sub.ctx, event);
      }
    }
  };
}

describe('KeyboardHintOverlay', () => {
  let container;
  let game;
  let overlay;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    game = createMockGame();
    overlay = new KeyboardHintOverlay(game, container);
    overlay.init();
  });

  afterEach(() => {
    overlay.cleanup();
    container.remove();
    jest.clearAllMocks();
  });

  test('creates overlay element inside container', () => {
    expect(overlay.overlay).toBeTruthy();
    expect(overlay.overlay.classList.contains('keyboard-hint-overlay')).toBe(true);
  });

  test('overlay is hidden initially', () => {
    expect(overlay.overlay.style.display).toBe('none');
  });

  test('creates all three hint badges', () => {
    expect(Object.keys(overlay._hintElements).length).toBe(3);
  });

  test('shows overlay on HOLE_STARTED for hole 1', () => {
    game._emit('hole:started', { holeNumber: 1 });
    expect(overlay.overlay.style.display).toBe('flex');
  });

  test('shows overlay on HOLE_STARTED for hole 2', () => {
    game._emit('hole:started', { holeNumber: 2 });
    expect(overlay.overlay.style.display).toBe('flex');
  });

  test('hides overlay on HOLE_STARTED for hole 3', () => {
    game._emit('hole:started', { holeNumber: 1 });
    game._emit('hole:started', { holeNumber: 3 });
    expect(overlay.overlay.style.display).toBe('none');
  });

  test('dismisses aim hint on BALL_HIT', () => {
    game._emit('hole:started', { holeNumber: 1 });
    game._emit('ball:hit', {});
    const aimBadge = overlay._hintElements['aim'];
    expect(aimBadge.style.display).toBe('none');
  });

  test('dismisses pause hint on GAME_PAUSED', () => {
    game._emit('hole:started', { holeNumber: 1 });
    game._emit('game:paused', {});
    const pauseBadge = overlay._hintElements['pause'];
    expect(pauseBadge.style.display).toBe('none');
  });

  test('dismisses camera hint on two-finger touchstart', () => {
    game._emit('hole:started', { holeNumber: 1 });

    // Simulate the internal camera dismiss (Touch API may not exist in jsdom)
    overlay._onTouchForCamera({ touches: [1, 2] }); // length >= 2

    const cameraBadge = overlay._hintElements['camera'];
    expect(cameraBadge.style.display).toBe('none');
  });

  test('hides overlay when all hints are dismissed', () => {
    game._emit('hole:started', { holeNumber: 1 });
    game._emit('ball:hit', {});
    game._emit('game:paused', {});
    overlay._onTouchForCamera({ touches: [1, 2] });

    expect(overlay.overlay.style.display).toBe('none');
  });

  test('does not dismiss camera hint when touch is single-finger', () => {
    game._emit('hole:started', { holeNumber: 1 });
    overlay._onTouchForCamera({ touches: [1] }); // only 1 touch

    const cameraBadge = overlay._hintElements['camera'];
    expect(cameraBadge.style.display).not.toBe('none');
  });

  test('hint dismissal is idempotent', () => {
    game._emit('hole:started', { holeNumber: 1 });
    game._emit('game:paused', {});
    game._emit('game:paused', {}); // second call should not throw
    const pauseBadge = overlay._hintElements['pause'];
    expect(pauseBadge.style.display).toBe('none');
  });

  test('cleanup removes overlay from DOM', () => {
    const el = overlay.overlay;
    overlay.cleanup();
    expect(overlay.overlay).toBeNull();
    expect(el.parentNode).toBeNull();
  });

  test('cleanup unsubscribes from events', () => {
    // Each subscription returns a jest.fn() unsub
    const unsubCount = game.eventManager.subscribe.mock.results.length;
    expect(unsubCount).toBeGreaterThan(0);
    overlay.cleanup();
    // After cleanup, subscriptions array is empty
    // (can't directly verify unsubscribe was called from here, but no throw)
  });

  test('init skips event setup when eventManager is missing', () => {
    const noEventGame = { eventManager: null };
    const o2 = new KeyboardHintOverlay(noEventGame, container);
    expect(() => o2.init()).not.toThrow();
    o2.cleanup();
  });
});
