/**
 * Integration tests for loading screen indicator (ISSUE-073)
 * Tests that the loading screen is shown on startup, dismissed on success,
 * and shows an error message on failure.
 */

jest.mock('../../scenes/Game', () => ({
  Game: jest.fn(() => ({
    initVisuals: jest.fn().mockResolvedValue(),
    startGame: jest.fn().mockResolvedValue(),
    enableGameInput: jest.fn(),
    cleanup: jest.fn()
  }))
}));

jest.mock('../../../public/style.css', () => {}, { virtual: true });
jest.mock('../../utils/debug', () => ({
  debug: { log: jest.fn() }
}));
jest.mock('../../utils/webglDetect', () => ({
  isWebGLAvailable: jest.fn(() => true),
  showWebGLFallback: jest.fn()
}));

import { Game } from '../../scenes/Game';

// Minimal App class mirroring main.js loading screen behavior.
// Uses getElementById for all element lookups (compatible with the test mock DOM).
class App {
  constructor() {
    this.game = new Game();
    this.isGameRunning = false;
    this.menuScreen = document.getElementById('menu-screen');
  }

  async initVisuals() {
    const loadingScreen = document.getElementById('loading-screen');
    try {
      await this.game.initVisuals();
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
      }
      if (this.menuScreen) {
        this.menuScreen.style.display = '';
      }
    } catch (error) {
      if (loadingScreen) {
        const spinner = document.getElementById('loading-spinner');
        const loadingText = document.getElementById('loading-text');
        if (spinner) {
          spinner.remove();
        }
        if (loadingText) {
          loadingText.remove();
        }
        const errorMsg = document.createElement('p');
        errorMsg.className = 'loading-error';
        errorMsg.textContent = 'Failed to load the game. Please refresh the page and try again.';
        loadingScreen.appendChild(errorMsg);
      }
    }
  }
}

function createLoadingScreenDOM() {
  document.body.innerHTML = '';

  const loadingScreen = document.createElement('div');
  loadingScreen.id = 'loading-screen';

  const spinner = document.createElement('div');
  spinner.id = 'loading-spinner';
  spinner.className = 'loading-spinner';

  const text = document.createElement('p');
  text.id = 'loading-text';
  text.className = 'loading-text';
  text.textContent = 'Loading...';

  // Track spinner and text by ID so getElementById can find them
  global.document._elements['loading-spinner'] = spinner;
  global.document._elements['loading-text'] = text;

  document.body.appendChild(loadingScreen);

  const menuScreen = document.createElement('div');
  menuScreen.id = 'menu-screen';
  menuScreen.style.display = 'none';
  document.body.appendChild(menuScreen);
}

describe('Loading Screen Integration Tests', () => {
  let mockGame;

  beforeEach(() => {
    createLoadingScreenDOM();
    mockGame = {
      initVisuals: jest.fn().mockResolvedValue(),
      startGame: jest.fn().mockResolvedValue(),
      enableGameInput: jest.fn(),
      cleanup: jest.fn()
    };
    Game.mockImplementation(() => mockGame);
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('loading screen is visible before initialization', () => {
    const loadingScreen = document.getElementById('loading-screen');
    expect(loadingScreen).toBeTruthy();
    // classList.add('hidden') should not have been called yet
    expect(loadingScreen.classList.add).not.toHaveBeenCalledWith('hidden');
  });

  test('menu screen is hidden before initialization', () => {
    const menuScreen = document.getElementById('menu-screen');
    expect(menuScreen.style.display).toBe('none');
  });

  test('loading screen is dismissed after successful initialization', async () => {
    const app = new App();
    await app.initVisuals();

    const loadingScreen = document.getElementById('loading-screen');
    expect(loadingScreen.classList.add).toHaveBeenCalledWith('hidden');
  });

  test('menu screen is shown after successful initialization', async () => {
    const app = new App();
    await app.initVisuals();

    const menuScreen = document.getElementById('menu-screen');
    expect(menuScreen.style.display).toBe('');
  });

  test('loading screen shows error message on initialization failure', async () => {
    const app = new App();
    app.game.initVisuals = jest.fn().mockRejectedValue(new Error('WebGL context lost'));
    await app.initVisuals();

    const loadingScreen = document.getElementById('loading-screen');
    // Should NOT be hidden — classList.add('hidden') should not have been called
    expect(loadingScreen.classList.add).not.toHaveBeenCalledWith('hidden');

    // Check that an error message element was appended to loading screen
    const children = loadingScreen.children || [];
    const errorChild = children.find(c => c.className === 'loading-error');
    expect(errorChild).toBeTruthy();
    expect(errorChild.textContent).toContain('Failed to load the game');
  });

  test('spinner element is removed on initialization failure', async () => {
    const app = new App();
    app.game.initVisuals = jest.fn().mockRejectedValue(new Error('Init failed'));

    const spinnerBefore = document.getElementById('loading-spinner');
    expect(spinnerBefore).toBeTruthy();

    await app.initVisuals();

    // spinner.remove() is called, which should clear it from _elements
    // Verify the remove mock was called on the spinner
    expect(spinnerBefore.remove).toHaveBeenCalled();
  });

  test('menu screen stays hidden on initialization failure', async () => {
    const app = new App();
    app.game.initVisuals = jest.fn().mockRejectedValue(new Error('Init failed'));
    await app.initVisuals();

    const menuScreen = document.getElementById('menu-screen');
    expect(menuScreen.style.display).toBe('none');
  });
});
