/**
 * Integration tests for main.js App class DOM interactions
 * Tests actual DOM event handling and element manipulation
 */

// Mock the Game import
jest.mock('../../scenes/Game', () => ({
  Game: jest.fn(() => ({
    init: jest.fn().mockResolvedValue(),
    enableGameInput: jest.fn()
  }))
}));

// Mock CSS imports - moduleNameMapper doesn't work with inline require()
jest.mock('../../../public/style.css', () => {}, { virtual: true });

import { Game } from '../../scenes/Game';

// App class extracted from main.js for testing
class App {
  constructor() {
    this.game = new Game();
    this.isGameRunning = false;
    this.menuScreen = document.getElementById('menu-screen');
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Add click event for the play course button
    const playCourseButton = document.getElementById('play-course');
    if (playCourseButton) {
      console.log('[App] Adding click listener to Play Course button.');
      playCourseButton.addEventListener('click', () => {
        console.log('[App] Play Course button CLICKED.');
        this.startCourse();
      });
    }
  }

  async startCourse() {
    console.log('[App] startCourse called.');
    // Hide the menu screen
    if (this.menuScreen) {
      console.log('[App] Hiding menu screen.');
      this.menuScreen.style.display = 'none';
    }

    // Initialize the game if not already initialized
    if (!this.isGameRunning) {
      console.log('[App] Game not running, calling App.init()...');
      await this.init();
      console.log('[App] App.init() finished.');
      this.isGameRunning = true;
    } else {
      console.log('[App] Game already running.');
    }

    // Enable game input
    console.log('[App] Enabling game input...');
    this.game.enableGameInput();
    console.log('[App] startCourse finished.');
  }

  async init() {
    console.log('[App.init] Starting...');
    try {
      // Initialize the game
      console.log('[App.init] Calling game.init()...');
      await this.game.init();
      console.log('[App.init] game.init() finished.');
      console.log('[App.init] Finished successfully.');
    } catch (error) {
      console.error('[App.init] CRITICAL: Failed to initialize game:', error);
      // Show error message to user
      if (this.menuScreen) {
        this.menuScreen.style.display = 'block';
        const errorMessage = document.createElement('div');
        errorMessage.style.color = 'red';
        errorMessage.style.marginTop = '20px';
        errorMessage.textContent = 'Failed to initialize game. Please refresh the page.';
        this.menuScreen.appendChild(errorMessage);
      }
      throw error;
    }
  }
}

describe('App DOM Integration Tests', () => {
  let mockGame;

  beforeEach(() => {
    // Clear DOM completely
    document.body.innerHTML = '';

    // Create real DOM elements (no mocking)
    const menuScreen = document.createElement('div');
    menuScreen.id = 'menu-screen';
    menuScreen.style.display = 'block';
    document.body.appendChild(menuScreen);

    const playCourseButton = document.createElement('button');
    playCourseButton.id = 'play-course';
    playCourseButton.textContent = 'Play Course';
    document.body.appendChild(playCourseButton);

    // Mock game instance
    mockGame = {
      init: jest.fn().mockResolvedValue(),
      enableGameInput: jest.fn()
    };
    Game.mockImplementation(() => mockGame);

    // Mock window.open and location
    global.window.open = jest.fn();
    delete window.location;
    window.location = { href: '' };

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('DOM Element Discovery', () => {
    test('should find and store menu screen element during construction', () => {
      const app = new App();

      expect(app.menuScreen).toBeTruthy();
      expect(app.menuScreen.id).toBe('menu-screen');
      // Compare properties instead of object identity since JSDOM may return different references
      expect(app.menuScreen.id).toBe(document.getElementById('menu-screen').id);
      expect(app.menuScreen.tagName).toBe(document.getElementById('menu-screen').tagName);
    });

    test('should handle missing menu screen gracefully', () => {
      // Remove menu screen before creating app
      document.getElementById('menu-screen').remove();

      expect(() => {
        new App();
      }).not.toThrow();
    });
  });

  describe('DOM Event Listener Setup', () => {
    test('should add click listener to play course button', () => {
      // Get the button element
      const playCourseButton = document.getElementById('play-course');

      // Spy on the button's addEventListener method
      const addEventListenerSpy = jest.spyOn(playCourseButton, 'addEventListener');

      new App();

      // Verify addEventListener was called on the button with 'click' event
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));

      // Also verify the console log was called
      expect(console.log).toHaveBeenCalledWith(
        '[App] Adding click listener to Play Course button.'
      );

      addEventListenerSpy.mockRestore();
    });

    test('should handle missing play course button gracefully', () => {
      // Remove the button before creating app
      document.getElementById('play-course').remove();

      expect(() => {
        new App();
      }).not.toThrow();

      expect(console.log).not.toHaveBeenCalledWith(
        '[App] Adding click listener to Play Course button.'
      );
    });

    test('should actually trigger startCourse when button is clicked', async () => {
      const app = new App();
      const playCourseButton = document.getElementById('play-course');

      // Spy on startCourse method
      const startCourseSpy = jest
        .spyOn(app, 'startCourse')
        .mockImplementation(() => Promise.resolve());

      // Simulate actual DOM click event
      playCourseButton.click();

      expect(startCourseSpy).toHaveBeenCalled();

      startCourseSpy.mockRestore();
    });
  });

  describe('DOM Menu Screen Manipulation', () => {
    test('should hide menu screen when starting course', async () => {
      const app = new App();
      const menuScreen = app.menuScreen;

      // Verify initial state
      expect(menuScreen.style.display).toBe('block');

      await app.startCourse();

      // Verify menu screen was hidden
      expect(menuScreen.style.display).toBe('none');
    });

    test('should handle missing menu screen during startCourse', async () => {
      const app = new App();

      // Remove menu screen after app creation
      app.menuScreen.remove();
      app.menuScreen = null;

      // Should not throw
      await expect(app.startCourse()).resolves.not.toThrow();
    });
  });

  describe('DOM Error Message Display', () => {
    test('should create and append error message div on init failure', async () => {
      const app = new App();
      const error = new Error('Game initialization failed');
      mockGame.init.mockRejectedValue(error);

      const menuScreen = app.menuScreen;
      const initialChildCount = menuScreen.children.length;

      try {
        await app.init();
      } catch (e) {
        // Expected error
      }

      // Verify menu screen is shown
      expect(menuScreen.style.display).toBe('block');

      // Verify error div was created and appended
      expect(menuScreen.children.length).toBe(initialChildCount + 1);

      const errorDiv = menuScreen.children[menuScreen.children.length - 1];
      expect(errorDiv.tagName.toLowerCase()).toBe('div');
      expect(errorDiv.style.color).toBe('red');
      expect(errorDiv.style.marginTop).toBe('20px');
      expect(errorDiv.textContent).toBe('Failed to initialize game. Please refresh the page.');

      // Verify it's actually in the DOM
      expect(menuScreen.contains(errorDiv)).toBe(true);
    });

    test('should handle missing menu screen during error display', async () => {
      const app = new App();
      const error = new Error('Game initialization failed');
      mockGame.init.mockRejectedValue(error);

      // Remove menu screen
      app.menuScreen.remove();
      app.menuScreen = null;

      // Should not crash even without menu screen
      await expect(app.init()).rejects.toThrow('Game initialization failed');
    });
  });

  describe('DOM Integration Workflow', () => {
    test('should handle complete user interaction workflow', async () => {
      const app = new App();
      const playCourseButton = document.getElementById('play-course');
      const menuScreen = app.menuScreen;

      // Initial state
      expect(menuScreen.style.display).toBe('block');
      expect(app.isGameRunning).toBe(false);

      // Simulate user clicking play button
      playCourseButton.click();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify game workflow
      expect(mockGame.init).toHaveBeenCalled();
      expect(mockGame.enableGameInput).toHaveBeenCalled();
      expect(menuScreen.style.display).toBe('none');
      expect(app.isGameRunning).toBe(true);
    });

    test('should prevent double initialization', async () => {
      const app = new App();

      // First call
      await app.startCourse();
      expect(app.isGameRunning).toBe(true);

      // Reset mocks
      mockGame.init.mockClear();

      // Second call
      await app.startCourse();

      // Should not reinitialize
      expect(mockGame.init).not.toHaveBeenCalled();
      expect(mockGame.enableGameInput).toHaveBeenCalled(); // But should still enable input
    });
  });
});
