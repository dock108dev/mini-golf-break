import { Game } from './scenes/Game';
import '../public/style.css';
import { SplashScreen } from '@capacitor/splash-screen';

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
      playCourseButton.addEventListener('click', () => {
        this.startCourse();
      });
    }
  }

  /**
   * Opens the feedback form in a new tab
   */
  openFeedbackForm() {
    // Open feedback form in new tab
    const feedbackWindow = window.open('/feedback.html', '_blank');

    // Fallback if browser blocks popups
    if (!feedbackWindow) {
      window.location.href = '/feedback.html';
    }
  }

  async startCourse() {
    // Hide the menu screen
    if (this.menuScreen) {
      this.menuScreen.style.display = 'none';
    }

    // Initialize the game if not already initialized
    if (!this.isGameRunning) {
      await this.init();
      this.isGameRunning = true;
    }

    // Enable game input

    this.game.enableGameInput();
  }

  async init() {
    try {
      // Initialize the game
      await this.game.init();
    } catch (error) {
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

// Start the application when the window loads
window.addEventListener('load', async () => {
  window.App = new App();
  // Also expose game for easier testing access
  window.game = window.App.game;

  // Hide splash screen after app loads
  try {
    await SplashScreen.hide();
  } catch (error) {
    // Splash screen plugin may not be available in web browser
  }
});
