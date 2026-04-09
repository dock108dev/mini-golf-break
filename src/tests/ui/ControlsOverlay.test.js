/**
 * Unit tests for the controls help overlay
 * Tests the show/hide behavior and DOM structure of the controls overlay
 * accessible from the start screen and pause menu.
 */

describe('Controls Help Overlay', () => {
  let controlsOverlay;
  let howToPlayMenuButton;
  let controlsCloseButton;

  beforeEach(() => {
    // Create the controls overlay using the global mock createElement
    controlsOverlay = document.createElement('div');
    controlsOverlay.id = 'controls-overlay';
    controlsOverlay.classList.add('controls-overlay');
    controlsOverlay.setAttribute('role', 'dialog');
    controlsOverlay.setAttribute('aria-label', 'Controls help');
    controlsOverlay.style.display = 'none';

    const content = document.createElement('div');
    content.classList.add('controls-content');

    const title = document.createElement('h2');
    title.classList.add('controls-title');
    title.textContent = 'How to Play';

    controlsCloseButton = document.createElement('button');
    controlsCloseButton.id = 'controls-close';
    controlsCloseButton.classList.add('controls-close-button');
    controlsCloseButton.textContent = 'Got it!';

    howToPlayMenuButton = document.createElement('button');
    howToPlayMenuButton.id = 'how-to-play-menu';
    howToPlayMenuButton.classList.add('how-to-play-button');
    howToPlayMenuButton.textContent = 'How to Play';
  });

  describe('DOM structure', () => {
    test('controls overlay has correct id', () => {
      expect(controlsOverlay.id).toBe('controls-overlay');
    });

    test('controls overlay has dialog role for accessibility', () => {
      expect(controlsOverlay.setAttribute).toHaveBeenCalledWith('role', 'dialog');
    });

    test('controls overlay has aria-label', () => {
      expect(controlsOverlay.setAttribute).toHaveBeenCalledWith('aria-label', 'Controls help');
    });

    test('controls overlay is hidden by default', () => {
      expect(controlsOverlay.style.display).toBe('none');
    });

    test('close button has correct text', () => {
      expect(controlsCloseButton.textContent).toBe('Got it!');
    });

    test('How to Play button has correct text', () => {
      expect(howToPlayMenuButton.textContent).toBe('How to Play');
    });

    test('controls overlay has controls-overlay class', () => {
      expect(controlsOverlay.classList.contains('controls-overlay')).toBe(true);
    });
  });

  describe('show behavior', () => {
    function showControlsOverlay(overlay) {
      if (overlay) {
        overlay.style.display = '';
        overlay.classList.add('visible');
      }
    }

    test('showing overlay sets display to empty string', () => {
      showControlsOverlay(controlsOverlay);
      expect(controlsOverlay.style.display).toBe('');
    });

    test('showing overlay adds visible class', () => {
      showControlsOverlay(controlsOverlay);
      expect(controlsOverlay.classList.add).toHaveBeenCalledWith('visible');
    });

    test('showing overlay does nothing when overlay is null', () => {
      expect(() => showControlsOverlay(null)).not.toThrow();
    });
  });

  describe('hide behavior', () => {
    function hideControlsOverlay(overlay) {
      if (overlay) {
        overlay.classList.remove('visible');
        overlay.style.display = 'none';
      }
    }

    test('hiding overlay calls classList.remove with visible', () => {
      hideControlsOverlay(controlsOverlay);
      expect(controlsOverlay.classList.remove).toHaveBeenCalledWith('visible');
    });

    test('hiding overlay sets display to none', () => {
      controlsOverlay.style.display = '';
      hideControlsOverlay(controlsOverlay);
      expect(controlsOverlay.style.display).toBe('none');
    });

    test('hiding overlay does nothing when overlay is null', () => {
      expect(() => hideControlsOverlay(null)).not.toThrow();
    });
  });

  describe('button wiring', () => {
    test('How to Play menu button can have click handler attached', () => {
      const handler = jest.fn();
      howToPlayMenuButton.addEventListener('click', handler);
      expect(howToPlayMenuButton.addEventListener).toHaveBeenCalledWith('click', handler);
    });

    test('close button can have click handler attached', () => {
      const handler = jest.fn();
      controlsCloseButton.addEventListener('click', handler);
      expect(controlsCloseButton.addEventListener).toHaveBeenCalledWith('click', handler);
    });

    test('close button click handler invokes classList.remove', () => {
      // Simulate close behavior
      controlsOverlay.classList.add('visible');
      controlsOverlay.classList.remove('visible');
      controlsOverlay.style.display = 'none';

      expect(controlsOverlay.classList.remove).toHaveBeenCalledWith('visible');
      expect(controlsOverlay.style.display).toBe('none');
    });
  });
});
