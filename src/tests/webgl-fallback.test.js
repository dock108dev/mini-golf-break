/**
 * Tests for WebGL availability detection and fallback UI.
 */
import { isWebGLAvailable, showWebGLFallback } from '../utils/webglDetect';

describe('isWebGLAvailable', () => {
  let savedDescriptor;
  let origCreateElement;

  beforeEach(() => {
    savedDescriptor = Object.getOwnPropertyDescriptor(window, 'WebGLRenderingContext');
    origCreateElement = document.createElement;
  });

  afterEach(() => {
    document.createElement = origCreateElement;
    if (savedDescriptor) {
      Object.defineProperty(window, 'WebGLRenderingContext', savedDescriptor);
    } else {
      delete window.WebGLRenderingContext;
    }
  });

  function setWebGLRenderingContext(value) {
    Object.defineProperty(window, 'WebGLRenderingContext', {
      value,
      writable: true,
      configurable: true
    });
  }

  test('returns true when WebGL context is obtainable', () => {
    setWebGLRenderingContext(function () {});
    // The global setup mock already returns a truthy getContext for canvas
    expect(isWebGLAvailable()).toBe(true);
  });

  test('returns false when WebGLRenderingContext does not exist', () => {
    delete window.WebGLRenderingContext;
    expect(isWebGLAvailable()).toBe(false);
  });

  test('returns false when getContext returns null for both contexts', () => {
    setWebGLRenderingContext(function () {});
    document.createElement = jest.fn(tag => {
      if (tag === 'canvas') {
        return { getContext: jest.fn(() => null) };
      }
      return origCreateElement(tag);
    });

    expect(isWebGLAvailable()).toBe(false);
  });

  test('returns false when getContext throws', () => {
    setWebGLRenderingContext(function () {});
    document.createElement = jest.fn(tag => {
      if (tag === 'canvas') {
        return {
          getContext: jest.fn(() => {
            throw new Error('blocked');
          })
        };
      }
      return origCreateElement(tag);
    });

    expect(isWebGLAvailable()).toBe(false);
  });
});

describe('showWebGLFallback', () => {
  let origGetElementById;
  let origCreateElement;
  let createdElements;

  beforeEach(() => {
    origGetElementById = document.getElementById;
    origCreateElement = document.createElement;
    createdElements = [];

    // Track created elements so we can verify them
    document.createElement = jest.fn(tag => {
      const el = origCreateElement(tag);
      createdElements.push(el);
      return el;
    });
  });

  afterEach(() => {
    document.getElementById = origGetElementById;
    document.createElement = origCreateElement;
  });

  function setupDOM({ hasMenuScreen = true, hasContainer = true } = {}) {
    const menuScreen = hasMenuScreen ? { style: { display: 'flex' }, id: 'menu-screen' } : null;
    const containerChildren = [];
    let container = null;
    if (hasContainer) {
      container = {
        id: 'game-container',
        appendChild: jest.fn(child => {
          containerChildren.push(child);
          child.parentElement = container;
        }),
        _children: containerChildren
      };
    }

    document.getElementById = jest.fn(id => {
      if (id === 'menu-screen') {
        return menuScreen;
      }
      if (id === 'game-container') {
        return container;
      }
      return null;
    });

    return { menuScreen, container };
  }

  test('creates fallback element in game container', () => {
    const { container } = setupDOM();

    showWebGLFallback();

    expect(container.appendChild).toHaveBeenCalled();
    const fallback = container.appendChild.mock.calls[0][0];
    expect(fallback.id).toBe('webgl-fallback');
  });

  test('hides the menu screen', () => {
    const { menuScreen } = setupDOM();

    showWebGLFallback();

    expect(menuScreen.style.display).toBe('none');
  });

  test('fallback contains title, message, and suggestions', () => {
    const { container } = setupDOM();

    showWebGLFallback();

    const fallback = container.appendChild.mock.calls[0][0];
    // The fallback div should have children appended to it
    expect(fallback.appendChild).toHaveBeenCalled();
    const appendedChildren = fallback.appendChild.mock.calls.map(c => c[0]);

    // First child should be the title (h1)
    const title = appendedChildren[0];
    expect(title.textContent).toBe('WebGL Not Available');

    // Second child should be the message (p)
    const message = appendedChildren[1];
    expect(message.textContent).toContain('requires WebGL');

    // Third child should be the suggestions list (ul)
    const suggestions = appendedChildren[2];
    expect(suggestions.appendChild).toHaveBeenCalled();
    const listItems = suggestions.appendChild.mock.calls.map(c => c[0]);
    const allText = listItems.map(li => li.textContent).join(' ');
    expect(allText).toContain('hardware acceleration');
    expect(allText).toContain('different browser');
    expect(allText).toContain('Update your browser');
    expect(allText).toContain('graphics drivers');
  });

  test('does nothing if game-container is missing', () => {
    setupDOM({ hasContainer: false });

    expect(() => showWebGLFallback()).not.toThrow();
    // No elements should have been appended
    expect(createdElements.every(el => !el.id || el.id !== 'webgl-fallback')).toBe(true);
  });

  test('handles missing menu screen gracefully', () => {
    const { container } = setupDOM({ hasMenuScreen: false });

    expect(() => showWebGLFallback()).not.toThrow();
    expect(container.appendChild).toHaveBeenCalled();
  });
});
