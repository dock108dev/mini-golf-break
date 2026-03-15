import * as THREE from 'three';
import { EventTypes } from '../events/EventTypes';
import { debug } from '../utils/debug';

/**
 * InputController - Handles all user input for the game
 * Manages mouse/touch interactions for aiming and hitting the ball
 */
export class InputController {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.renderer = game.renderer;
    this.stateManager = game.stateManager;

    // Track input state
    this.isInputEnabled = true;
    this.isPointerDown = false;
    this.isDragging = false;

    // Track intersection point when clicking on the ground
    this.intersectionPoint = null;
    this.intersection = new THREE.Vector3();

    // Create raycaster for mouse intersection
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // Max drag distance for power calculation (in world units)
    this.maxDragDistance = 10;

    // Hit parameters
    this.hitDirection = new THREE.Vector3(0, 0, 1); // Default forward
    this.hitPower = 0;

    // Reference to direction line
    this.directionLine = null;

    // Reference to power indicator
    this.powerIndicator = document.getElementById('power-indicator');

    // Store control state to restore later
    this.controlsWereEnabled = true;

    // Initialization state tracking
    this.isInitialized = false;

    // Mobile device detection
    this.isMobileDevice = this.detectMobileDevice();
    this.supportsHaptics = this.detectHapticSupport();
    this.isHighPerformanceDevice = this.detectDevicePerformance();

    // Touch state for mobile
    this.isMultiTouch = false;
    this.pinchDistance = 0;
    this.touchStartTime = 0;
    this.touchVelocity = new THREE.Vector2();
    this.lastTouchPosition = new THREE.Vector2();
  }

  /**
   * Initialize event listeners and setup
   */
  init() {
    try {
      if (this.isInitialized) {
        if (this.game.debugManager) {
          this.game.debugManager.warn('InputController.init', 'Already initialized');
        }
        return this;
      }

      this.initEventListeners();
      this.setupGameEventListeners();

      // Mark as initialized
      this.isInitialized = true;

      if (this.game.debugManager) {
        this.game.debugManager.log('InputController initialized');
      }
    } catch (error) {
      if (this.game.debugManager) {
        this.game.debugManager.error(
          'InputController.init',
          'Failed to initialize input controller',
          error
        );
      } else {
        console.error('Failed to initialize input controller:', error);
      }
    }

    return this;
  }

  /**
   * Initialize DOM event listeners
   */
  initEventListeners() {
    try {
      // Get the DOM element to attach events to
      const domElement = this.renderer ? this.renderer.domElement : window;

      // Bind methods to ensure 'this' context is preserved
      this.onMouseDown = this.onMouseDown.bind(this);
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onMouseUp = this.onMouseUp.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onTouchMove = this.onTouchMove.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);
      // Add event listeners
      domElement.addEventListener('mousedown', this.onMouseDown);
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);

      // Touch events
      domElement.addEventListener('touchstart', this.onTouchStart);
      window.addEventListener('touchmove', this.onTouchMove);
      window.addEventListener('touchend', this.onTouchEnd);

      if (this.game.debugManager) {
        this.game.debugManager.log('InputController DOM event listeners initialized');
      }
    } catch (error) {
      if (this.game.debugManager) {
        this.game.debugManager.error(
          'InputController.initEventListeners',
          'Failed to initialize DOM event listeners',
          error
        );
      } else {
        console.error('Failed to initialize DOM event listeners:', error);
      }
    }
  }

  /**
   * Setup game event subscriptions
   */
  setupGameEventListeners() {
    if (!this.game.eventManager) {
      if (this.game.debugManager) {
        this.game.debugManager.warn(
          'InputController.setupGameEventListeners',
          'EventManager not available, skipping event subscriptions'
        );
      }
      return;
    }

    try {
      // Initialize event subscriptions array if not already created
      this.eventSubscriptions = this.eventSubscriptions || [];

      // Store subscription functions to simplify cleanup
      this.eventSubscriptions = [
        // Listen for ball stopped to re-enable input
        this.game.eventManager.subscribe(EventTypes.BALL_STOPPED, this.handleBallStopped, this),

        // Listen for ball in hole to disable input
        this.game.eventManager.subscribe(EventTypes.BALL_IN_HOLE, this.handleBallInHole, this),

        // Listen for hole started to enable input
        this.game.eventManager.subscribe(EventTypes.HOLE_STARTED, this.handleHoleStarted, this)
      ];

      if (this.game.debugManager) {
        this.game.debugManager.log('InputController game event listeners initialized');
      }
    } catch (error) {
      if (this.game.debugManager) {
        this.game.debugManager.error(
          'InputController.setupGameEventListeners',
          'Failed to set up game event listeners',
          error
        );
      } else {
        console.error('Failed to set up game event listeners:', error);
      }
    }
  }

  /**
   * Handle ball stopped event
   */
  handleBallStopped(_event) {
    // Re-enable input when ball stops (if hole is not completed)
    if (!this.game.stateManager.isHoleCompleted()) {
      this.enableInput();
    }
  }

  /**
   * Handle ball in hole event
   */
  handleBallInHole(_event) {
    // Disable input when ball goes in hole
    this.disableInput();
  }

  /**
   * Handle hole started event
   */
  handleHoleStarted(_event) {
    // Enable input when a new hole starts
    this.enableInput();
  }

  isEventInsideCanvas(event) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  onMouseDown(event) {
    // Check if input is allowed and if the ball is stopped
    const ball = this.game.ballManager?.ball;
    if (!this.isInputEnabled || (ball && !ball.isStopped())) {
      debug.log(
        `[InputController.onMouseDown] Input ignored: InputEnabled=${this.isInputEnabled}, Ball Stopped=${ball ? ball.isStopped() : 'N/A'}`
      );
      return; // Ignore click if input disabled or ball is moving
    }

    // Only handle left mouse button
    if (event.button !== 0) {
      return;
    }

    // Check if mouse is over the canvas
    if (!this.isEventInsideCanvas(event)) {
      return;
    }

    // First, check if the ball is in motion - if so, we shouldn't allow new shots
    if (this.game.stateManager && this.game.stateManager.isBallInMotion()) {
      debug.log('Ball is in motion, ignoring input');
      return;
    }

    // When starting a drag, store the current orbit controls state and disable them
    if (this.game.cameraController && this.game.cameraController.controls) {
      this.controlsWereEnabled = this.game.cameraController.controls.enabled;
      this.game.cameraController.controls.enabled = false;
    }

    // Set pointer down flag
    this.isPointerDown = true;
    this.isDragging = false; // Reset drag state

    // Update mouse position
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Cast ray into the scene
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Get ball reference from ball manager (already declared at start of function)
    // const ball = this.game.ballManager ? this.game.ballManager.ball : null;

    // Check if we clicked directly on the ball first
    let clickedOnBall = false;
    if (ball && ball.mesh) {
      const intersects = this.raycaster.intersectObject(ball.mesh);
      clickedOnBall = intersects.length > 0;

      // If we didn't click directly on the ball, check if we're close enough to the ball position
      // This makes it easier to click on the ball, especially on mobile
      if (!clickedOnBall) {
        // Create a plane at ball height for consistent dragging
        const ballPosition = ball.mesh.position.clone();
        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ballPosition.y);

        // Find intersection with the drag plane
        const intersection = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(dragPlane, intersection);

        if (intersection) {
          // Check if the intersection point is close enough to the ball (in world units)
          const distanceToBall = intersection.distanceTo(ballPosition);
          clickedOnBall = distanceToBall < ball.radius * 3; // Using 3x radius for easier clicking

          this.intersectionPoint = intersection.clone();

          // Initially no direction or power
          this.hitDirection = new THREE.Vector3(0, 0, 0);
          this.hitPower = 0;

          // Log start of input
          debug.log(
            `[InputController] Drag started on ball. Initial point: (${this.intersectionPoint.x.toFixed(2)}, ${this.intersectionPoint.z.toFixed(2)})`
          );

          // Show power indicator
          if (this.powerIndicator) {
            this.powerIndicator.style.display = 'block';
            this.updatePowerIndicator(0);
          }

          debug.log(
            `Clicked at distance ${distanceToBall.toFixed(2)} from ball, clickedOnBall: ${clickedOnBall}`
          );
        }
      }
    }

    // If we didn't click on or near the ball, restore camera controls and exit
    if (!clickedOnBall) {
      this.isPointerDown = false;
      if (this.game.cameraController && this.game.cameraController.controls) {
        this.game.cameraController.controls.enabled = this.controlsWereEnabled;
      }
    }

    // Prevent default behavior
    event.preventDefault();
  }

  onMouseMove(event) {
    // Skip if input is not active or no drag started
    if (!this.isInputEnabled || !this.isPointerDown) {
      return;
    }

    // Set dragging flag
    this.isDragging = true;

    // Get mouse position
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // --- Edge Detection for Camera Panning ---
    if (this.isDragging) {
      const edgeThreshold = 0.15; // How close to the edge before panning (0-1)
      const panSpeed = 0.03; // How fast to pan
      let panX = 0;
      let panZ = 0;

      // Convert normalized pointer (-1 to 1) to 0-1 range for easier edge detection
      const screenX = (this.pointer.x + 1) / 2;
      const screenY = (this.pointer.y + 1) / 2;

      // Check if cursor is near any edge
      const nearLeft = screenX < edgeThreshold;
      const nearRight = screenX > 1 - edgeThreshold;
      const nearTop = screenY > 1 - edgeThreshold;
      const nearBottom = screenY < edgeThreshold;

      // Calculate pan direction and strength
      if (nearLeft) {
        panX = -panSpeed * (1 - screenX / edgeThreshold);
      }
      if (nearRight) {
        panX = panSpeed * (1 - (1 - screenX) / edgeThreshold);
      }
      if (nearTop) {
        panZ = -panSpeed * (1 - (1 - screenY) / edgeThreshold);
      }
      if (nearBottom) {
        panZ = panSpeed * (1 - screenY / edgeThreshold);
      }

      // Apply panning if needed
      if (panX !== 0 || panZ !== 0) {
        // Only pan if we have the camera controller
        if (this.game.cameraController) {
          const panDirection = new THREE.Vector3(panX, 0, panZ).normalize();
          const panAmount = Math.sqrt(panX * panX + panZ * panZ);
          this.game.cameraController.panCameraOnEdge(panDirection, panAmount);
        }
      }
    }
    // --- End Edge Detection Logic ---

    // Update the position in 3D space
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Create a plane at ball height for consistent dragging
    const ballPosition = this.game.ballManager.ball.mesh.position.clone();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ballPosition.y);

    // Find intersection with the drag plane
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(dragPlane, intersection);

    if (intersection) {
      // Calculate direction FROM the intersection point TO the ball
      // This way, pulling back from the ball creates a forward shot
      this.hitDirection = new THREE.Vector3().subVectors(ballPosition, intersection).normalize();

      // Calculate power based on distance (limit to max range)
      const dragDistance = ballPosition.distanceTo(intersection);
      this.hitPower = Math.min(dragDistance / this.maxDragDistance, 1.0);

      // Update indicator width
      this.updatePowerIndicator(this.hitPower);

      // Update or create the aim line
      this.updateAimLine(ballPosition, this.hitDirection, this.hitPower);
    }

    // Prevent default behavior
    event.preventDefault();
  }

  onMouseUp(event) {
    const currentState = this.stateManager ? this.stateManager.getGameState() : 'UNKNOWN';
    debug.log(
      `[InputController.onMouseUp] State: ${currentState}, PointerDown: ${this.isPointerDown}, Dragging: ${this.isDragging}`
    );

    // Only handle left mouse button (or touch equivalent)
    if (event.button !== 0) {
      return;
    }

    // --- Aiming/Shooting Logic ---
    if (!this.isPointerDown) {
      // Restore controls if pointer wasn't down but they were disabled (e.g., clicked outside canvas)
      if (this.game.cameraController?.controls && !this.controlsWereEnabled) {
        this.game.cameraController.controls.enabled = this.controlsWereEnabled;
      }
      return;
    }

    // Reset pointer down flag AFTER evaluating dragging state
    this.isPointerDown = false;

    // If dragging occurred (and ad wasn't clicked), attempt to hit the ball
    if (this.isDragging && this.isInputEnabled && this.hitPower > 0.05) {
      // Hide direction line
      this.removeDirectionLine();

      // Hide power indicator
      if (this.powerIndicator) {
        this.powerIndicator.style.display = 'none';
      }

      // Hit ball using BallManager
      if (this.game.ballManager) {
        const direction = this.hitDirection.clone();
        debug.log(
          `[InputController] Applying stroke: Power=${this.hitPower.toFixed(2)}, Direction=(${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)})`
        );
        this.game.ballManager.hitBall(direction, this.hitPower);
        this.disableInput();
      }
    } else {
      // If not dragging (and wasn't an ad click) or power too low, just remove aim line
      this.removeAimLine();
    }

    // Reset dragging flag AFTER checking it
    this.isDragging = false;

    // Restore camera controls state
    if (this.game.cameraController && this.game.cameraController.controls) {
      this.game.cameraController.controls.enabled = this.controlsWereEnabled;
    }

    // Reset hit parameters
    this.hitDirection.set(0, 0, 0);
    this.hitPower = 0;
    this.intersectionPoint = null;

    // Prevent default browser behavior (important to keep at the end)
    event.preventDefault();
  }

  onTouchStart(event) {
    // Check if input is allowed and if the ball is stopped
    const ball = this.game.ballManager?.ball;
    if (!this.isInputEnabled || (ball && !ball.isStopped())) {
      debug.log(
        `[InputController.onTouchStart] Input ignored: InputEnabled=${this.isInputEnabled}, Ball Stopped=${ball ? ball.isStopped() : 'N/A'}`
      );
      return; // Ignore touch if input disabled or ball is moving
    }

    // Handle multi-touch detection
    this.isMultiTouch = event.touches.length > 1;

    if (event.touches.length === 2) {
      // Calculate initial pinch distance
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      this.pinchDistance = Math.sqrt(dx * dx + dy * dy);
    }

    // Only handle single touch events for aiming/shooting
    if (event.touches.length === 1) {
      const touch = event.touches[0];

      // Store touch position and time
      this.lastTouchPosition.set(touch.clientX, touch.clientY);
      this.touchStartTime = performance.now();

      // Simulate a left mouse button down event
      const simulatedMouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0, // Simulate left mouse button
        preventDefault: () => event.preventDefault() // Pass preventDefault
      };

      // Call the existing onMouseDown logic
      this.onMouseDown(simulatedMouseEvent);
    }
    // Ignore multi-touch events for shooting mechanics
  }

  onTouchMove(event) {
    // Only handle single touch movements if a drag is active
    if (this.isPointerDown && event.touches.length === 1) {
      const touch = event.touches[0];

      // Simulate a mouse move event
      const simulatedMouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => event.preventDefault() // Pass preventDefault
      };

      // Call the existing onMouseMove logic
      this.onMouseMove(simulatedMouseEvent);

      // Edge detection is handled in onMouseMove, no need to duplicate it here
    }
  }

  onTouchEnd(event) {
    // Check if we were actually dragging (pointer was down)
    // touchend is fired even if the touch didn't start on the canvas
    if (this.isPointerDown) {
      // Simulate a left mouse button up event
      // We don't strictly need coordinates for mouse up logic
      const simulatedMouseEvent = {
        button: 0, // Simulate left mouse button release
        preventDefault: () => event.preventDefault() // Pass preventDefault
      };

      // Call the existing onMouseUp logic
      this.onMouseUp(simulatedMouseEvent);
    }
    // Note: No check for event.touches.length here, as touchend signifies the end of a touch point.
    // The state (isPointerDown) determines if it corresponds to our drag action.
  }

  calculateDragPower() {
    // Calculate direction
    const dx = this.dragStart.x - this.dragCurrent.x;
    const dy = this.dragStart.y - this.dragCurrent.y;

    // Calculate distance for power
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize direction
    if (distance > 0) {
      this.dragDirection.x = dx / distance;
      this.dragDirection.y = dy / distance;
    } else {
      this.dragDirection.x = 0;
      this.dragDirection.y = 0;
    }

    // Scale and clamp power
    this.dragPower = Math.min(distance / 100, this.maxPower);
  }

  getWorldDirection() {
    // Get ball position in world space
    const ballPosition = this.game.ballManager.ball.mesh.position.clone();

    // Create a plane at the ball's height
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ballPosition.y);

    // Raycast from camera through drag direction to get world position
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Create a 3D vector for the direction
    const direction = new THREE.Vector3();

    // Find the point where the ray intersects the horizontal plane
    const intersects = this.raycaster.ray.intersectPlane(plane, this.intersection);

    // Check if intersection occurred before calculating direction
    if (intersects) {
      // Direction vector from the ball to the intersection point (reversed for pull effect)
      direction.subVectors(ballPosition, this.intersection).normalize();
      direction.y = 0; // Force horizontal direction
    } else {
      // Default direction if no intersection (e.g., looking straight down)
      // You might want a more robust fallback here
      console.warn('[InputController] Raycaster did not intersect drag plane.');
      direction.set(0, 0, -1); // Default to backward direction relative to camera maybe?
    }

    return direction;
  }

  createDirectionLine() {
    // Remove existing line if there is one
    this.removeDirectionLine();

    // Create basic line geometry with initial points
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)];

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

    // Create bright red line material - make it thicker
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xff0000,
      linewidth: 3 // Note: WebGL has limitations on line width
    });

    // Create the line object
    this.directionLine = new THREE.Line(lineGeometry, lineMaterial);

    // Add to scene
    if (this.game.scene) {
      this.game.scene.add(this.directionLine);
    }
  }

  updateDirectionLine() {
    if (!this.directionLine || !this.game.ballManager.ball.mesh) {
      return;
    }

    // Get ball position
    const ballPosition = this.game.ballManager.ball.mesh.position.clone();

    // Calculate direction
    const direction = this.getWorldDirection();

    // Scale line length based on drag power (make it longer for better visibility)
    const lineLength = Math.max(1, this.dragPower * 10);

    // Calculate end position - extend from ball in the direction
    const endPosition = ballPosition.clone().add(direction.clone().multiplyScalar(lineLength));

    // Slightly raise line above ground to prevent z-fighting
    ballPosition.y += 0.05;
    endPosition.y += 0.05;

    // Update line points
    const positions = new Float32Array([
      ballPosition.x,
      ballPosition.y,
      ballPosition.z,
      endPosition.x,
      endPosition.y,
      endPosition.z
    ]);

    // Update geometry
    this.directionLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Ensure line is visible and geometry needs update
    this.directionLine.visible = true;
    this.directionLine.geometry.attributes.position.needsUpdate = true;
  }

  removeDirectionLine() {
    if (this.directionLine) {
      if (this.game.scene) {
        this.game.scene.remove(this.directionLine);
      }

      if (this.directionLine.geometry) {
        this.directionLine.geometry.dispose();
      }

      if (this.directionLine.material) {
        this.directionLine.material.dispose();
      }

      this.directionLine = null;
    }
  }

  updatePowerIndicator(power) {
    if (!this.powerIndicator) {
      return;
    }

    // Calculate power percentage (0-100)
    const powerPercentage = power * 100;

    // Update power indicator width using CSS custom property
    this.powerIndicator.style.setProperty('--power-width', `${powerPercentage}%`);
  }

  resetPowerIndicator() {
    if (this.powerIndicator) {
      this.powerIndicator.style.setProperty('--power-width', '0%');
    }
  }

  /**
   * Enable user input for hitting the ball
   */
  enableInput() {
    if (!this.isInputEnabled) {
      this.isInputEnabled = true;

      // Publish input enabled event
      this.game.eventManager.publish(EventTypes.INPUT_ENABLED, {}, this);

      this.game.debugManager.log('Input enabled');
    }
  }

  /**
   * Disable user input for hitting the ball
   */
  disableInput() {
    if (this.isInputEnabled) {
      this.isInputEnabled = false;
      this.isPointerDown = false;
      this.isDragging = false;

      // Clean up any visual elements
      this.removeDirectionLine();
      this.resetPowerIndicator();

      // Publish input disabled event
      this.game.eventManager.publish(
        EventTypes.INPUT_DISABLED,
        {
          reason: 'programmatic'
        },
        this
      );

      this.game.debugManager.log('Input disabled');
    }
  }

  updateAimLine(ballPosition, direction, power) {
    // Remove existing line
    if (this.directionLine) {
      this.game.scene.remove(this.directionLine);
      if (this.directionLine.geometry) {
        this.directionLine.geometry.dispose();
      }
      if (this.directionLine.material) {
        this.directionLine.material.dispose();
      }
    }

    // Calculate line length based on power
    const lineLength = power * 8.75; // Increased from 5 to 8.75 (1.75x longer)

    // Create points for line (from ball position to desired direction * length)
    const endPoint = new THREE.Vector3()
      .copy(ballPosition)
      .add(new THREE.Vector3().copy(direction).multiplyScalar(lineLength));

    // Create line geometry
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([ballPosition, endPoint]);

    // Create line material with gradient color based on power
    const lineColor = new THREE.Color(
      Math.min(0.2 + power * 0.8, 1.0), // More red with higher power
      Math.max(1.0 - power * 0.8, 0.2), // Less green with higher power
      0.2 // Low blue component
    );

    const lineMaterial = new THREE.LineBasicMaterial({
      color: lineColor,
      linewidth: 2
    });

    // Create the line
    this.directionLine = new THREE.Line(lineGeometry, lineMaterial);

    // Raise line slightly above ground
    this.directionLine.position.y += 0.02;

    // Add line to scene
    this.game.scene.add(this.directionLine);
  }

  removeAimLine() {
    if (this.directionLine) {
      this.game.scene.remove(this.directionLine);
      if (this.directionLine.geometry) {
        this.directionLine.geometry.dispose();
      }
      if (this.directionLine.material) {
        this.directionLine.material.dispose();
      }
      this.directionLine = null;
    }
  }

  /**
   * Detect if device is mobile
   */
  detectMobileDevice() {
    if (typeof navigator !== 'undefined') {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    }
    return false;
  }

  /**
   * Detect if device supports haptic feedback
   */
  detectHapticSupport() {
    if (typeof navigator !== 'undefined') {
      return 'vibrate' in navigator;
    }
    return false;
  }

  /**
   * Detect device performance level
   */
  detectDevicePerformance() {
    if (typeof navigator !== 'undefined' && navigator.deviceMemory) {
      return navigator.deviceMemory >= 4; // 4GB+ is considered high performance
    }
    return true; // Default to high performance if can't detect
  }

  /**
   * Trigger haptic feedback
   */
  triggerHapticFeedback(intensity) {
    if (this.supportsHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      const durations = {
        light: 15,
        medium: 25,
        heavy: 50
      };
      navigator.vibrate(durations[intensity] || 25);
    }
  }

  /**
   * Handle pinch zoom gestures
   */
  handlePinchZoom(delta) {
    if (this.game.cameraController && this.game.cameraController.adjustZoom) {
      this.game.cameraController.adjustZoom(delta);
    }
  }

  /**
   * Optimize settings for device performance
   */
  optimizeForDevice() {
    if (!this.isHighPerformanceDevice) {
      // Lower physics update rate for low-performance devices
      if (this.game.physicsManager && this.game.physicsManager.setUpdateRate) {
        this.game.physicsManager.setUpdateRate(30);
      }

      // Lower render quality
      if (this.game.cameraController && this.game.cameraController.setQualityLevel) {
        this.game.cameraController.setQualityLevel('low');
      }
    }
  }

  /**
   * Handle quick tap gestures
   */
  handleQuickTap() {
    debug.log('[InputController] Quick tap detected');
    // Quick tap implementation - could trigger a gentle hit or UI action
  }

  /**
   * Handle swipe gestures with velocity boost
   */
  handleSwipeGesture() {
    // Apply velocity boost based on swipe
    const velocityBoost = 0.1;
    this.hitPower = Math.min(this.hitPower + velocityBoost, 1.0);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    try {
      // Clean up DOM event listeners
      try {
        const domElement = this.renderer ? this.renderer.domElement : window;

        // Remove mouse events
        domElement.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);

        // Remove touch events
        domElement.removeEventListener('touchstart', this.onTouchStart);
        window.removeEventListener('touchmove', this.onTouchMove);
        window.removeEventListener('touchend', this.onTouchEnd);
      } catch (error) {
        if (this.game.debugManager) {
          this.game.debugManager.warn(
            'InputController.cleanup',
            'Error removing DOM event listeners',
            error
          );
        }
      }

      // Clean up event subscriptions
      if (this.eventSubscriptions) {
        this.eventSubscriptions.forEach(unsubscribe => unsubscribe());
        this.eventSubscriptions = [];
      }

      // Clean up direction line
      this.removeDirectionLine();

      // Reset power indicator
      this.resetPowerIndicator();

      // Clean up THREE.js objects
      if (this.raycaster) {
        this.raycaster = null;
      }

      // Clear references
      this.pointer = null;
      this.intersectionPoint = null;

      // Reset initialization state
      this.isInitialized = false;

      // Log cleanup
      if (this.game.debugManager) {
        this.game.debugManager.log('InputController cleaned up');
      }
    } catch (error) {
      // Log cleanup errors
      if (this.game.debugManager) {
        this.game.debugManager.error('InputController.cleanup', 'Error during cleanup', error);
      } else {
        console.error('Error during InputController cleanup:', error);
      }
    }
  }

}
