# Mini Golf Break - A 3D Mini Golf Game

**Mini Golf Break** is a simple yet engaging 3D mini-golf game built with Three.js for graphics and Cannon-es for physics simulation. Enjoy a relaxing break with intuitive controls and progressively challenging holes.

## Features

*   **3D Graphics:** Clean and simple low-poly aesthetics using Three.js.
*   **Realistic Physics:** Accurate ball rolling, bouncing, and interactions powered by Cannon-es.
*   **Intuitive Controls:** Simple click-and-drag aiming and power control.
*   **Multiple Holes:** Includes a basic 3-hole test course (`BasicCourse`) and scaffolding for a full 9-hole course (`NineHoleCourse`).
*   **Configurable Hazards:** Easily define sand traps and water hazards with various shapes (circles, rectangles, compound shapes!) via configuration.
*   **Hazard Penalties:** Water hazards apply a one-stroke penalty and reset the ball to the last hit position.
*   **Improved Hole Physics:** Ball entry logic considers speed and overlap for more realistic interactions (including high-speed rejections).
*   **Bunker Effects:** Ball experiences increased drag when rolling through sand traps.
*   **Dynamic Camera:** Camera actively follows the ball with intelligent positioning based on ball movement direction and speed.
*   **Custom Hole Layouts:** Supports standard rectangular holes and custom shapes (like L-shapes) using boundary wall definitions.
*   **Scoring System:** Tracks strokes per hole and total score.
*   **Basic UI:** Displays current hole, stroke count, and total score.
*   **Debug Mode:** Includes physics debugging visuals (toggle with 'd').

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd mini-golf-break
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm start
    ```
4.  Open your browser to `http://localhost:8080` (or the specified port).

## How to Play

1.  **Aim:** Click and hold the left mouse button on the golf ball.
2.  **Set Power:** Drag the mouse backward away from the direction you want to shoot. The further you drag, the more power you apply (indicated by the aiming line).
3.  **Shoot:** Release the mouse button to hit the ball.
4.  **Goal:** Get the ball into the hole in the fewest strokes possible.
5.  Navigate through the different holes using the UI prompts after completing each hole.

## Running on iOS (via Capacitor)

This web application can be run as a native iOS app using Capacitor.

1.  **Prerequisites:**
    *   Ensure you have Xcode installed.
    *   Ensure you have CocoaPods installed (`sudo gem install cocoapods`).
    *   An Apple Developer account added to Xcode (for running on a physical device).

2.  **Build the Web App:**
    ```bash
    npm run build
    ```

3.  **Sync with Capacitor:**
    ```bash
    npx cap sync ios
    ```

4.  **Open in Xcode:**
    ```bash
    npx cap open ios
    ```

5.  **Run in Xcode:**
    *   Inside Xcode, select the `App` target.
    *   Go to the `Signing & Capabilities` tab and select your development team.
    *   Choose your target device (physical iPhone or Simulator).
    *   Click the Run button (or press Cmd+R).

## Development

See the [DEVELOPMENT_GUIDE.md](docs/development-guide.md) for details on the project structure, key components, and how to extend the game.

## Contributing

Contributions are welcome! Please follow standard fork-and-pull-request workflows.

## License

This project is open-source (specify license if applicable, e.g., MIT License).