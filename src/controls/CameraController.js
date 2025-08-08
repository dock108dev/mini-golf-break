import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TouchCameraController } from './TouchCameraController';
import { CameraStateManager, CameraModes } from './CameraStateManager';
import { EventTypes } from '../events/EventTypes';
import { debug } from '../utils/debug';

/**
 * CameraController class
 * Handles camera initialization, positioning, and behavior for Mini Golf Break
 */
export class CameraController {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.renderer = null;

    // Managers
    this.ballManager = null;
    this.adShipManager = null;

    // Setup camera and controls with increased far plane
    this.camera = new THREE.PerspectiveCamera(
      60, // Field of View (remains 60)
      window.innerWidth / window.innerHeight, // Aspect Ratio
      0.1, // Near Clipping Plane
      5000 // Far Clipping Plane (Increased significantly from 1000)
    );
    this.controls = null;
    this.touchController = null;
    this.stateManager = null;

    // Game references
    this.course = null;
    this.ball = null;

    // Debug mode
    this.debugMode = false;

    // Touch device detection
    this.isTouchDevice = this.detectTouchDevice();

    // Initialization state tracking
    this.isInitialized = false;

    this.isTransitioning = false;
    this._isRepositioning = false; // Flag to track camera repositioning
    this._userAdjustedCamera = false; // Flag to track if user manually adjusted camera
    this._lastManualControlTime = 0; // Track when user last manually adjusted camera

    // --- Ad Focus Blending State ---
    this.wasBallMovingLastFrame = false;
    this.closestAdShip = null;
    this.targetAdFocusWeight = 0.0; // Target weight (0 or 1)
    this.currentAdFocusWeight = 0.0; // Smoothed weight (0 to 1)

    // --- Ad Focus Config ---
    this.ballMoveThresholdSq = 0.2 * 0.2; // Squared velocity threshold to consider ball moving
    this.adFocusLerpFactor = 2.0; // Speed of blending towards target weight
    this.maxAdShipCheckDistanceSq = 70 * 70; // Don't focus on ships too far away (squared)
    this.adFocusMaxWeight = 0.35; // Max blend amount towards ad ship (0 to 1)
  }

  /**
   * Set the renderer after it's initialized
   * @param {THREE.WebGLRenderer} renderer - The renderer
   */
  setRenderer(renderer) {
    this.renderer = renderer;
    return this;
  }

  /**
   * Initialize camera and controls
   */
  init() {
    try {
      // Guard against multiple initialization
      if (this.isInitialized) {
        return this;
      }

      // Get manager references
      this.ballManager = this.game.ballManager;
      this.adShipManager = this.game.adShipManager;

      // Setup camera

      this.setupCamera();

      // Setup controls if renderer is available
      if (this.renderer) {
        this.setupControls();

        // Setup camera state manager

        this.setupStateManager();

        // Setup touch controls for mobile devices
        if (this.isTouchDevice) {
          this.setupTouchControls();
        }
      }

      // Set up event listeners

      this.setupEventListeners();

      // Set up resize event listener
      try {
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
      } catch (error) {
        // Error handling removed for production
      }

      // Mark as initialized
      this.isInitialized = true;
    } catch (error) {
      // Error handling removed for production
    }

    return this;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    if (!this.game.eventManager) {
      return;
    }

    try {
      this.eventSubscriptions = this.eventSubscriptions || [];

      this.eventSubscriptions.push(
        this.game.eventManager.subscribe(EventTypes.BALL_MOVED, this.handleBallMoved, this)
      );

      this.eventSubscriptions.push(
        this.game.eventManager.subscribe(EventTypes.HOLE_STARTED, this.handleHoleStarted, this)
      );

      this.eventSubscriptions.push(
        this.game.eventManager.subscribe(EventTypes.BALL_CREATED, this.handleBallCreated, this)
      );

      this.eventSubscriptions.push(
        this.game.eventManager.subscribe(EventTypes.BALL_HIT, this.handleBallHit, this)
      );
    } catch (error) {
      // Error handling removed for production
    }
  }

  /**
   * Handle ball movement events
   * @param {GameEvent} event - The ball moved event
   */
  handleBallMoved(_event) {
    // This method is left empty as the camera already follows the ball in updateCameraFollowBall()
  }

  /**
   * Handle hole started events - Defer initial positioning
   * @param {GameEvent} event - The hole started event
   */
  handleHoleStarted(_event) {
    if (this.game.debugManager) {
      this.game.debugManager.log(
        'CameraController.handleHoleStarted',
        `Event received. isInitialized: ${this.isInitialized}, game initialized?: ${this.game.isInitialized}`
      );
    }
    // We no longer position the camera immediately on HOLE_STARTED
    // during initial load. Subsequent hole starts might trigger positioning,
    // but initial setup is handled after course creation.
    if (this.game.debugManager) {
      this.game.debugManager.log(
        'CameraController.handleHoleStarted',
        'Initial positioning deferred.'
      );
    }
  }

  /**
   * Handle ball created events
   * @param {GameEvent} event - The ball created event
   */
  handleBallCreated(event) {
    // Update the ball reference
    this.ball = event.get('ball');
  }

  /**
   * Handle ball hit event - trigger cinematic ball following
   * @param {GameEvent} event - The ball hit event
   */
  handleBallHit(event) {
    // Reset user adjustment flag when ball is hit, so camera follows the shot
    this._userAdjustedCamera = false;

    // Get ball hit data for dynamic camera positioning
    const direction = event.get('direction');
    const power = event.get('power');

    // Trigger cinematic ball follow mode
    this.startCinematicBallFollow(direction, power);

    if (this.game.debugManager) {
      this.game.debugManager.log(
        'CameraController.handleBallHit',
        `Ball hit with power ${power}, starting cinematic follow`
      );
    }
  }

  /**
   * Start cinematic ball following with dynamic positioning based on shot
   * @param {THREE.Vector3} direction - Shot direction vector
   * @param {number} power - Shot power (0-1)
   */
  startCinematicBallFollow(direction, power) {
    if (!this.stateManager) {
      return; // Fallback to existing behavior
    }

    // Calculate dynamic camera position based on shot
    const ball = this.game.ballManager ? this.game.ballManager.ball : null;
    if (!ball || !ball.mesh) {
      return;
    }

    const ballPosition = ball.mesh.position.clone();

    // Calculate ideal camera position behind the ball
    const shotDirection = direction ? direction.clone().normalize() : new THREE.Vector3(0, 0, 1);

    // Position camera behind ball with height based on power
    const baseDistance = 6 + power * 8; // 6-14 units behind ball
    const baseHeight = 4 + power * 6; // 4-10 units above ground

    const cameraOffset = shotDirection.clone().negate().multiplyScalar(baseDistance);
    cameraOffset.y = baseHeight;

    const cameraPosition = ballPosition.clone().add(cameraOffset);
    const lookAtTarget = ballPosition.clone();
    lookAtTarget.y += 0.5; // Look slightly above ball center

    // Update ball follow camera state with dynamic positioning
    this.updateCameraModeState(CameraModes.BALL_FOLLOW, {
      position: cameraPosition,
      target: lookAtTarget,
      fov: 65 - power * 10 // Tighter FOV for powerful shots
    });

    // Transition to ball follow mode
    this.setCameraMode(CameraModes.BALL_FOLLOW, false, {
      duration: 0.8 // Quick transition to catch the shot
    });

    // Set up ball stop detection
    this.startBallStopDetection();
  }

  /**
   * Monitor ball movement and return to overhead when stopped
   */
  startBallStopDetection() {
    if (this.ballStopDetection) {
      clearInterval(this.ballStopDetection);
    }

    let consecutiveStopFrames = 0;
    const requiredStopFrames = 60; // ~1 second at 60fps

    this.ballStopDetection = setInterval(() => {
      const ball = this.game.ballManager ? this.game.ballManager.ball : null;
      if (!ball || !ball.body) {
        this.stopBallStopDetection();
        return;
      }

      const velocity = ball.body.velocity;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

      if (speed < 0.1) {
        // Ball is essentially stopped
        consecutiveStopFrames++;
        if (consecutiveStopFrames >= requiredStopFrames) {
          this.returnToOverheadView();
          this.stopBallStopDetection();
        }
      } else {
        consecutiveStopFrames = 0; // Reset counter if ball is still moving
      }
    }, 16); // ~60fps checking
  }

  /**
   * Return to overhead view after ball stops
   */
  returnToOverheadView() {
    if (this.stateManager && this.stateManager.getCurrentMode() === CameraModes.BALL_FOLLOW) {
      // Update overhead view to center on current ball position
      const ball = this.game.ballManager ? this.game.ballManager.ball : null;
      if (ball && ball.mesh && this.course) {
        const ballPosition = ball.mesh.position.clone();
        const holePosition = this.course.getHolePosition();

        if (holePosition) {
          // Calculate optimal overhead position
          const midpoint = new THREE.Vector3()
            .addVectors(ballPosition, holePosition)
            .multiplyScalar(0.5);

          const distance = ballPosition.distanceTo(holePosition);
          const height = Math.max(15, distance * 0.8);

          this.updateCameraModeState(CameraModes.OVERHEAD, {
            position: new THREE.Vector3(midpoint.x, height, midpoint.z + distance * 0.3),
            target: midpoint.clone().add(new THREE.Vector3(0, -2, 0))
          });
        }
      }

      // Transition back to overhead
      this.setCameraMode(CameraModes.OVERHEAD, false, {
        duration: 1.2 // Slower transition back
      });
    }
  }

  /**
   * Stop ball stop detection
   */
  stopBallStopDetection() {
    if (this.ballStopDetection) {
      clearInterval(this.ballStopDetection);
      this.ballStopDetection = null;
    }
  }

  /**
   * Handle window resize event
   */
  handleResize() {
    if (!this.camera) {
      return;
    }

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;

    // In debug mode, allow more camera freedom
    if (this.controls) {
      this.controls.maxPolarAngle = enabled ? Math.PI : Math.PI / 2;
      this.controls.minDistance = enabled ? 0.5 : 2;

      if (this.game.debugManager) {
        this.game.debugManager.log(`Camera debug mode ${enabled ? 'enabled' : 'disabled'}`);
      }
    }

    return this;
  }

  /**
   * Set the ball for the camera to follow
   * @param {Ball} ball - The ball object
   */
  setBall(ball) {
    this.ball = ball;

    if (!ball && this.game.debugManager) {
      this.game.debugManager.warn('CameraController.setBall', 'Ball reference cleared');
    }

    return this;
  }

  /**
   * Set reference to game course
   * @param {Course} course - The course object
   */
  setCourse(course) {
    this.course = course;
    return this;
  }

  /**
   * Update camera position and controls
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    // Update state manager first (handles transitions)
    if (this.stateManager) {
      this.stateManager.update(deltaTime);
    }

    // Update controls if they exist
    if (this.controls) {
      this.controls.update();
    }

    // Update camera to follow the ball if it exists and is moving
    // (but only if not in transition or manual mode)
    if (
      !this.stateManager ||
      (!this.stateManager.isInTransition() &&
        this.stateManager.getCurrentMode() !== CameraModes.MANUAL)
    ) {
      this.updateCameraFollowBall(deltaTime);
    }
  }

  /**
   * Position camera to view the current hole
   */
  positionCameraForHole() {
    // --- Force Reset Ad Focus State ---
    this.targetAdFocusWeight = 0.0;
    this.currentAdFocusWeight = 0.0;
    this.closestAdShip = null;
    this.wasBallMovingLastFrame = false; // Ensure ball state is reset too

    // --- End Reset ---

    if (!this.course) {
      return this;
    }

    // Get WORLD hole and start positions directly from course manager
    const worldHolePosition = this.course.getHolePosition();
    if (!worldHolePosition) {
      return this;
    }
    const worldStartPosition = this.course.getHoleStartPosition();
    if (!worldStartPosition) {
      return this;
    }

    // Calculate midpoint between WORLD tee and hole
    const midpoint = new THREE.Vector3()
      .addVectors(worldStartPosition, worldHolePosition)
      .multiplyScalar(0.5);

    // --- Calculate course dimensions (using WORLD coordinates) ---
    const width = Math.abs(worldStartPosition.x - worldHolePosition.x);
    const length = Math.abs(worldStartPosition.z - worldHolePosition.z);
    const diagonal = Math.sqrt(width * width + length * length);

    // Temporarily adjust controls to allow more flexible camera placement
    let originalMaxPolarAngle = Math.PI / 2;
    if (this.controls) {
      originalMaxPolarAngle = this.controls.maxPolarAngle;
      this.controls.maxPolarAngle = Math.PI; // Allow full rotation for initial positioning
    }

    // --- Calculate viewing parameters (using WORLD coordinates) ---
    const minHeight = 12.0;
    const baseHeight = Math.max(diagonal * 1.0, minHeight);
    const courseDirection = new THREE.Vector3()
      .subVectors(worldHolePosition, worldStartPosition)
      .normalize();
    const cameraOffset = new THREE.Vector3(
      -courseDirection.z * 0.6,
      baseHeight,
      courseDirection.x * 0.6
    )
      .normalize()
      .multiplyScalar(diagonal * 1.2);
    const weightToStart = 0.65;
    const weightedMidpoint = new THREE.Vector3().lerpVectors(
      midpoint,
      worldStartPosition,
      weightToStart
    );
    const behindBallDirection = new THREE.Vector3()
      .subVectors(worldStartPosition, worldHolePosition)
      .normalize();
    const behindBallOffset = behindBallDirection.multiplyScalar(diagonal * 0.2);
    const adjustedMidpoint = weightedMidpoint.clone().add(behindBallOffset);
    const cameraPosition = adjustedMidpoint.clone().add(cameraOffset);

    // Set camera position
    this.camera.position.copy(cameraPosition);

    // Look at a point that ensures we can see the entire hole (WORLD coordinates)
    const lookAtPoint = new THREE.Vector3().lerpVectors(midpoint, worldStartPosition, 0.2);
    lookAtPoint.y -= 1.5; // Lower the look-at point

    this.camera.lookAt(lookAtPoint);

    // Update orbit controls target
    if (this.controls) {
      this.controls.target.copy(lookAtPoint);
      this.controls.update();
      this.controls.maxPolarAngle = originalMaxPolarAngle; // Restore angle limit
    }

    return this;
  }

  /**
   * Set transition mode for camera
   * @param {boolean} enabled - Whether transition mode should be enabled
   */
  setTransitionMode(enabled) {
    this.isTransitioning = enabled;
  }

  /**
   * Update camera position to follow the ball
   * @param {number} deltaTime - Time since last update in seconds
   */
  updateCameraFollowBall(deltaTime) {
    // Get the ball reference from the ball manager
    const ball = this.game.ballManager ? this.game.ballManager.ball : null;
    if (!ball || !ball.mesh) {
      return;
    }

    const ballPosition = ball.mesh.position.clone(); // Ball position is already WORLD
    const currentMode = this.stateManager ? this.stateManager.getCurrentMode() : null;

    // Enhanced ball following for BALL_FOLLOW mode
    if (currentMode === CameraModes.BALL_FOLLOW && ball.body) {
      this.updateDynamicBallFollow(ballPosition, ball.body, deltaTime);
      return;
    }

    // During legacy transition mode (backwards compatibility)
    if (this.isTransitioning) {
      // Position camera slightly above and behind ball with high angle
      // Calculate direction based on ball's velocity if available
      let cameraPosition;
      if (ball.body && ball.body.velocity) {
        const velocity = ball.body.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        if (speed > 0.5) {
          // If ball is moving with speed, position camera behind the movement direction
          const directionNormalized = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
          cameraPosition = ballPosition
            .clone()
            .sub(directionNormalized.multiplyScalar(4)) // Position behind ball
            .add(new THREE.Vector3(0, 8, 0)); // Raise up
        } else {
          // Default position if not moving fast
          cameraPosition = ballPosition.clone().add(new THREE.Vector3(2, 8, 4));
        }
      } else {
        // Fallback if no velocity data
        cameraPosition = ballPosition.clone().add(new THREE.Vector3(2, 8, 4));
      }

      // Smooth camera movement
      this.camera.position.lerp(cameraPosition, 0.15); // Increased lerp factor for transition

      // Look at a point slightly below the ball to shift view down
      const lookPoint = ballPosition.clone();
      lookPoint.y -= 1.5;
      this.camera.lookAt(lookPoint);

      if (this.controls) {
        this.controls.target.copy(lookPoint);
        this.controls.update();
      }
      return;
    }

    // === Ad Focus Blending Logic ===
    const finalLookAtTarget = ballPosition.clone();
    finalLookAtTarget.y -= 1.5; // Default look-at point slightly below ball

    if (this.adShipManager && this.ballManager && this.ballManager.ball?.body) {
      const ballVelocitySq = this.ballManager.ball.body.velocity.lengthSquared();
      const isBallMoving = ballVelocitySq > this.ballMoveThresholdSq;

      // Detect state change: Ball starts moving
      if (isBallMoving && !this.wasBallMovingLastFrame) {
        this.closestAdShip = this._findClosestVisibleAdShip(ballPosition);
        if (this.closestAdShip) {
          this.targetAdFocusWeight = 1.0;
        } else {
          this.targetAdFocusWeight = 0.0; // No suitable ship found
        }
      }
      // Detect state change: Ball stops moving
      else if (!isBallMoving && this.wasBallMovingLastFrame) {
        this.targetAdFocusWeight = 0.0;
        // Don't clear closestAdShip immediately, let weight blend out
      }

      // Smoothly blend the focus weight
      this.currentAdFocusWeight = THREE.MathUtils.lerp(
        this.currentAdFocusWeight,
        this.targetAdFocusWeight,
        this.adFocusLerpFactor * deltaTime
      );
      if (this.currentAdFocusWeight < 0.01) {
        this.currentAdFocusWeight = 0.0; // Snap to zero if close enough
        this.closestAdShip = null; // Clear target once blend is finished
      }

      // Calculate final look-at target if blending towards an ad ship
      if (this.currentAdFocusWeight > 0 && this.closestAdShip) {
        const baseTarget = ballPosition.clone(); // Start with ball position
        baseTarget.y -= 1.5; // Lower target
        const adShipTarget = this.closestAdShip.group.position.clone();
        // Blend towards the ad ship, but apply max weight limit
        const blendWeight = this.currentAdFocusWeight * this.adFocusMaxWeight;
        finalLookAtTarget.lerpVectors(baseTarget, adShipTarget, blendWeight);
      }

      this.wasBallMovingLastFrame = isBallMoving;
    }
    // === End Ad Focus Blending ===

    // Always reset user adjustment flag when ball is moving
    // This ensures that after a shot, the camera starts following again
    if (this.game.stateManager && this.game.stateManager.isBallInMotion()) {
      // Reset the user adjustment flag when ball starts moving
      this._userAdjustedCamera = false;

      if (this.controls) {
        // Calculate target point slightly ahead of the ball (WORLD)
        const targetPosition = ballPosition.clone(); // Default to ball world position
        const velocity = ball.body.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        const lookAheadDistance = 1.5;
        const minSpeedForLookAhead = 0.1;

        if (speed > minSpeedForLookAhead) {
          const lookAheadDirection = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
          targetPosition.add(lookAheadDirection.multiplyScalar(lookAheadDistance));
        }
        targetPosition.y -= 1.5; // Lower target
        this.controls.target.lerp(targetPosition, 0.1);

        // Calculate ideal camera position (WORLD)
        const cameraDistance = 8;
        const cameraHeight = 6;
        let idealCameraPosition;
        if (speed > minSpeedForLookAhead) {
          const cameraOffset = new THREE.Vector3(-velocity.x, cameraHeight, -velocity.z)
            .normalize()
            .multiplyScalar(cameraDistance);
          idealCameraPosition = ballPosition.clone().add(cameraOffset);
        } else {
          const currentDir = new THREE.Vector3()
            .subVectors(this.camera.position, ballPosition)
            .normalize();
          currentDir.y = 0;
          currentDir.normalize().multiplyScalar(cameraDistance * 0.7);
          currentDir.y = cameraHeight;
          idealCameraPosition = ballPosition.clone().add(currentDir);
        }
        this.camera.position.lerp(idealCameraPosition, 0.05);
        this.controls.update();
      } else {
        // Fallback if no controls (position relative to WORLD ball pos)
        const cameraTargetPosition = ballPosition.clone().add(new THREE.Vector3(3, 15, 8));
        this.camera.position.lerp(cameraTargetPosition, 0.1);
        this.camera.lookAt(ballPosition);
      }
    } else {
      // When ball is stopped, calculate target relative to WORLD hole position
      // Reset ad focus when ball is stopped
      this.targetAdFocusWeight = 0.0;
      // Smoothly blend out any remaining focus weight
      this.currentAdFocusWeight = THREE.MathUtils.lerp(
        this.currentAdFocusWeight,
        this.targetAdFocusWeight,
        this.adFocusLerpFactor * deltaTime
      );
      if (this.currentAdFocusWeight < 0.01) {
        this.currentAdFocusWeight = 0.0;
        this.closestAdShip = null;
      }

      if (!this._userAdjustedCamera && this.controls && this.course) {
        const worldHolePosition = this.course.getHolePosition(); // Already returns WORLD
        if (worldHolePosition) {
          const directionToHole = new THREE.Vector3()
            .subVectors(worldHolePosition, ballPosition)
            .normalize();
          const weightedMidpoint = new THREE.Vector3().lerpVectors(
            ballPosition,
            worldHolePosition,
            0.4
          );
          weightedMidpoint.y -= 1.5;
          this.controls.target.lerp(weightedMidpoint, 0.03);

          // Calculate ideal stopped camera position (using WORLD coordinates)
          if (this.camera && !this._isRepositioning) {
            const distanceToHole = ballPosition.distanceTo(worldHolePosition);
            const reversedDirection = directionToHole.clone().negate().normalize();
            const idealOffset = new THREE.Vector3(
              -directionToHole.z * 0.4,
              Math.max(12, distanceToHole * 0.8),
              directionToHole.x * 0.4
            )
              .normalize()
              .multiplyScalar(distanceToHole * 1.2);
            // Increase minimum distance behind ball from 4 to 6
            const behindBallOffset = reversedDirection.multiplyScalar(
              Math.max(6, distanceToHole * 0.3)
            );
            const desiredCameraPos = ballPosition.clone().add(behindBallOffset).add(idealOffset);
            this.camera.position.lerp(desiredCameraPos, 0.02);
          }
        }
      } else if (this.controls && !this._userAdjustedCamera) {
        // Fallback: If course isn't available but user hasn't adjusted camera
        this.controls.target.lerp(ballPosition, 0.1);
      }
      // If user has adjusted camera, do nothing - let them control it
    }
  }

  /**
   * Enhanced dynamic ball following for cinematic camera mode
   * @param {THREE.Vector3} ballPosition - Current ball position
   * @param {CANNON.Body} ballBody - Ball physics body
   * @param {number} deltaTime - Time delta
   */
  updateDynamicBallFollow(ballPosition, ballBody, _deltaTime) {
    const velocity = ballBody.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

    // Calculate ideal camera position based on ball movement
    let targetCameraPosition;
    let targetLookAt;

    if (speed > 0.5) {
      // Ball is moving - position camera behind movement direction
      const movementDirection = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();

      // Dynamic distance and height based on speed
      const dynamicDistance = Math.min(12, 6 + speed * 2);
      const dynamicHeight = Math.min(10, 4 + speed * 1.5);

      // Position camera behind the movement
      const behindOffset = movementDirection.clone().negate().multiplyScalar(dynamicDistance);
      behindOffset.y = dynamicHeight;

      targetCameraPosition = ballPosition.clone().add(behindOffset);

      // Look ahead of the ball in movement direction
      const lookAheadDistance = Math.min(3, speed * 0.5);
      targetLookAt = ballPosition
        .clone()
        .add(movementDirection.clone().multiplyScalar(lookAheadDistance));
      targetLookAt.y += 0.5;
    } else {
      // Ball is slow/stopped - maintain current relative position but closer
      const currentOffset = new THREE.Vector3()
        .subVectors(this.camera.position, ballPosition)
        .normalize()
        .multiplyScalar(8);
      currentOffset.y = Math.max(currentOffset.y, 5);

      targetCameraPosition = ballPosition.clone().add(currentOffset);
      targetLookAt = ballPosition.clone();
      targetLookAt.y += 0.2;
    }

    // Smooth camera movement with adaptive lerp factor
    const lerpFactor = speed > 1.0 ? 0.08 : 0.15; // Slower tracking for fast ball
    this.camera.position.lerp(targetCameraPosition, lerpFactor);

    // Smooth look-at with slight delay for cinematic feel
    if (this.controls) {
      this.controls.target.lerp(targetLookAt, lerpFactor * 0.8);
      this.controls.update();
    } else {
      this.camera.lookAt(targetLookAt);
    }

    // Update the state manager with current camera position for consistency
    if (this.stateManager) {
      this.updateCameraModeState(CameraModes.BALL_FOLLOW, {
        position: this.camera.position.clone(),
        target: targetLookAt
      });
    }
  }

  /**
   * Position camera behind ball pointing toward hole
   */
  positionCameraBehindBall() {
    // Get the ball reference from the ball manager
    const ball = this.game.ballManager ? this.game.ballManager.ball : null;
    if (!ball || !ball.mesh) {
      return;
    }

    // Get the ball's position
    const ballPosition = ball.mesh.position.clone();

    // Get hole position
    const holePosition = this.course ? this.course.getHolePosition() : null;
    if (!holePosition) {
      return;
    }

    // Calculate direction from ball to hole
    const direction = new THREE.Vector3().subVectors(holePosition, ballPosition).normalize();

    // Determine camera position behind the ball
    const cameraPosition = ballPosition.clone().sub(direction.clone().multiplyScalar(4));
    cameraPosition.y += 2; // Raise the camera a bit for better view

    // Set camera position and look at the ball
    this.camera.position.copy(cameraPosition);
    this.camera.lookAt(ballPosition);

    // Update orbit controls if they exist
    if (this.controls) {
      this.controls.target.copy(ballPosition);
      this.controls.update();
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    try {
      // Remove window resize event listener
      try {
        window.removeEventListener('resize', this.handleResize);
      } catch (error) {
        if (this.game.debugManager) {
          this.game.debugManager.warn(
            'CameraController.cleanup',
            'Error removing resize listener',
            error
          );
        }
      }

      // Clean up event subscriptions
      if (this.eventSubscriptions) {
        this.eventSubscriptions.forEach(unsubscribe => unsubscribe());
        this.eventSubscriptions = [];
      }

      // Dispose of touch controller
      if (this.touchController) {
        this.touchController.dispose();
        this.touchController = null;
      }

      // Stop ball stop detection
      this.stopBallStopDetection();

      // Dispose of camera state manager
      if (this.stateManager) {
        this.stateManager.dispose();
        this.stateManager = null;
      }

      // Dispose of orbit controls if they exist
      if (this.controls) {
        this.controls.dispose();
        this.controls = null;
      }

      // Clear references
      this.ball = null;
      this.course = null;
      this.renderer = null;

      // Reset initialization state
      this.isInitialized = false;

      // Log cleanup
      if (this.game.debugManager) {
        this.game.debugManager.log('CameraController cleaned up');
      }
    } catch (error) {
      // Log cleanup errors
      if (this.game.debugManager) {
        this.game.debugManager.error('CameraController.cleanup', 'Error during cleanup', error);
      }
    }
  }

  /**
   * Set up the camera with initial configuration
   */
  setupCamera() {
    try {
      // Position camera much higher and further back for a better overview
      // This ensures more space behind the ball for aiming
      this.camera.position.set(0, 15, 10); // Higher elevation and further back
      this.camera.lookAt(0, -1.5, -5); // Look lower and further ahead to show more of the course

      if (this.game.debugManager) {
        this.game.debugManager.log('Camera setup complete');
      }
    } catch (error) {
      if (this.game.debugManager) {
        this.game.debugManager.error(
          'CameraController.setupCamera',
          'Failed to setup camera',
          error
        );
      }
    }
  }

  /**
   * Set up the orbit controls
   */
  setupControls() {
    try {
      if (!this.renderer) {
        if (this.game.debugManager) {
          this.game.debugManager.warn(
            'CameraController.setupControls',
            'No renderer available, skipping controls setup'
          );
        }
        return;
      }

      this.controls = new OrbitControls(this.camera, this.renderer.domElement);

      // Configure controls
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.1;
      this.controls.rotateSpeed = 0.7;
      this.controls.zoomSpeed = 1.2;
      this.controls.minDistance = 3;
      this.controls.maxDistance = 40;
      this.controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation

      // Enable all controls by default
      this.controls.enablePan = true;
      this.controls.enableZoom = true;
      this.controls.enableRotate = true;
      this.controls.panSpeed = 0.8;
      this.controls.screenSpacePanning = true;

      // Add event listeners to detect manual camera adjustments
      this.controls.addEventListener('start', () => {
        this._userAdjustedCamera = true;
        this._lastManualControlTime = Date.now();
      });

      // Listen for camera reset events
      this.renderer.domElement.addEventListener('camera-reset-view', event => {
        this.resetCameraView(event.detail.smooth);
      });

      if (this.game.debugManager) {
        this.game.debugManager.log('Controls setup complete');
      }
    } catch (error) {
      if (this.game.debugManager) {
        this.game.debugManager.error(
          'CameraController.setupControls',
          'Failed to setup controls',
          error
        );
      }
    }
  }

  /**
   * Sets the initial camera position after the first hole is confirmed ready.
   */
  setupInitialCameraPosition() {
    // Reset manual adjustment flag
    this._userAdjustedCamera = false;
    // Now it's safe to position the camera for the initial hole
    this.positionCameraForHole();
  }

  /** Helper to find the closest ad ship within a certain distance */
  _findClosestVisibleAdShip(ballPosition) {
    if (!this.adShipManager || !this.adShipManager.ships || this.adShipManager.ships.length === 0) {
      return null;
    }

    let closestShip = null;
    let minDistanceSq = this.maxAdShipCheckDistanceSq;

    this.adShipManager.ships.forEach(ship => {
      const distanceSq = ballPosition.distanceToSquared(ship.group.position);
      if (distanceSq < minDistanceSq) {
        // Basic visibility check (could be enhanced with raycasting or frustum checks)
        // For now, just use distance
        minDistanceSq = distanceSq;
        closestShip = ship;
      }
    });

    return closestShip;
  }

  /**
   * Pans the camera when user aims near the edge of the screen
   * @param {THREE.Vector3} direction - Normalized direction to pan
   * @param {number} amount - Strength of the pan (0-1)
   */
  panCameraOnEdge(direction, amount) {
    // Ignore if in transition or user is manually adjusting camera
    if (this.isTransitioning || this._isRepositioning) {
      return;
    }

    // Get ball reference if available
    const ball = this.game.ballManager ? this.game.ballManager.ball : null;
    if (!ball || !ball.mesh) {
      return;
    }

    // Get current camera and target positions
    const ballPosition = ball.mesh.position.clone();

    // Scale direction to world space (adjust for camera's local coordinate system)
    // We need to convert screen space direction to world space
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Keep horizontal
    cameraDirection.normalize();

    // Get the right vector of the camera (perpendicular to direction)
    const cameraRight = new THREE.Vector3(-cameraDirection.z, 0, cameraDirection.x).normalize();

    // Compose the pan movement using the camera's own axes
    const panMove = new THREE.Vector3();
    panMove.addScaledVector(cameraRight, direction.x);
    panMove.addScaledVector(cameraDirection, -direction.z);

    // Calculate pan amount with some limits to prevent moving too far from the ball
    const maxPanDistance = 5.0; // Maximum pan distance from ball
    const panAmountScaled = amount * 0.15; // Scale amount for smoother motion

    // Apply pan to camera position
    if (this.controls) {
      // Move the orbit controls target to pan the view
      this.controls.target.add(panMove.clone().multiplyScalar(panAmountScaled));

      // Keep camera at reasonable distance from ball
      const currentTargetToBallDist = this.controls.target.distanceTo(ballPosition);
      if (currentTargetToBallDist > maxPanDistance) {
        // If we've panned too far, move the target back towards ball
        const correction = new THREE.Vector3().subVectors(ballPosition, this.controls.target);
        correction.normalize().multiplyScalar(currentTargetToBallDist - maxPanDistance);
        this.controls.target.add(correction);
      }

      // Make sure camera updates
      this.controls.update();
    } else {
      // If no orbit controls, move camera directly
      this.camera.position.add(panMove.clone().multiplyScalar(panAmountScaled));
      this.camera.lookAt(ballPosition);
    }
  }

  /**
   * Adjust zoom level for mobile optimization
   */
  adjustZoom(zoomFactor) {
    if (!this.controls) {
      return;
    }

    const currentDistance = this.camera.position.distanceTo(this.controls.target);
    const newDistance = currentDistance / zoomFactor;

    // Clamp zoom to reasonable limits
    const minDistance = 5;
    const maxDistance = 50;
    const clampedDistance = Math.max(minDistance, Math.min(maxDistance, newDistance));

    if (clampedDistance !== currentDistance) {
      const direction = new THREE.Vector3()
        .subVectors(this.camera.position, this.controls.target)
        .normalize();

      this.camera.position
        .copy(this.controls.target)
        .add(direction.multiplyScalar(clampedDistance));

      this.controls.update();
      debug.log(`[CameraController] Zoom adjusted: distance=${clampedDistance.toFixed(2)}`);
    }
  }

  /**
   * Optimize camera settings for mobile devices
   */
  optimizeForMobile() {
    if (!this.controls) {
      return;
    }

    // Reduce damping for more responsive controls on touch
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05; // More responsive than default 0.1

    // Optimize zoom settings for touch
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 0.5; // Slower zoom for better control

    // Optimize pan settings
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.3; // Slower pan for better control

    // Optimize rotation settings
    this.controls.enableRotate = true;
    this.controls.rotateSpeed = 0.3; // Slower rotation for better control

    // Set appropriate limits for mobile
    this.controls.minDistance = 3;
    this.controls.maxDistance = 30;
    this.controls.maxPolarAngle = Math.PI * 0.8; // Prevent camera from going too low

    debug.log('[CameraController] Mobile optimizations applied');
  }

  /**
   * Set camera quality based on device performance
   */
  setQualityLevel(isHighPerformance) {
    if (isHighPerformance) {
      // High-quality settings
      this.camera.fov = 60;
      this.camera.far = 5000;
    } else {
      // Lower quality settings for better performance
      this.camera.fov = 65; // Slightly wider FOV reduces need for zooming
      this.camera.far = 2000; // Reduced draw distance
    }

    this.camera.updateProjectionMatrix();
    debug.log(`[CameraController] Quality level set: ${isHighPerformance ? 'High' : 'Low'}`);
  }

  /**
   * Detect if device supports touch
   */
  detectTouchDevice() {
    return (
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0
    );
  }

  /**
   * Setup touch-specific controls
   */
  setupTouchControls() {
    if (!this.controls || !this.renderer) {
      return;
    }

    this.touchController = new TouchCameraController(
      this.camera,
      this.renderer.domElement,
      this.controls
    );

    this.touchController.enable();

    // Optimize orbit controls for touch
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.8;
    this.controls.panSpeed = 0.5;

    debug.log('[CameraController] Touch controls initialized');
  }

  /**
   * Setup camera state manager
   */
  setupStateManager() {
    this.stateManager = new CameraStateManager(this.camera, this.controls);

    // Initialize with overhead mode
    this.stateManager.setCameraMode(CameraModes.OVERHEAD, true);

    debug.log('[CameraController] Camera state manager initialized');
  }

  /**
   * Set camera mode with optional transition
   * @param {string} mode - Target camera mode from CameraModes
   * @param {boolean} immediate - Skip transition animation
   * @param {Object} options - Additional transition options
   */
  setCameraMode(mode, immediate = false, options = {}) {
    if (!this.stateManager) {
      debug.warn('[CameraController] State manager not initialized');
      return false;
    }

    return this.stateManager.setCameraMode(mode, immediate, options);
  }

  /**
   * Get current camera mode
   */
  getCurrentCameraMode() {
    return this.stateManager ? this.stateManager.getCurrentMode() : CameraModes.OVERHEAD;
  }

  /**
   * Check if camera is transitioning between modes
   */
  isCameraTransitioning() {
    return this.stateManager ? this.stateManager.isInTransition() : false;
  }

  /**
   * Configure camera transition settings
   */
  setCameraTransitionSettings(settings) {
    if (this.stateManager) {
      this.stateManager.setTransitionSettings(settings);
    }
  }

  /**
   * Update camera state for specific mode (useful for dynamic positioning)
   */
  updateCameraModeState(mode, stateUpdate) {
    if (this.stateManager) {
      this.stateManager.updateCameraState(mode, stateUpdate);
    }
  }

  /**
   * Get available camera modes
   */
  getAvailableCameraModes() {
    return this.stateManager ? this.stateManager.getAvailableModes() : [CameraModes.OVERHEAD];
  }

  /**
   * Toggle between overhead and ball follow modes
   */
  toggleCameraMode() {
    if (!this.stateManager) {
      return false;
    }

    const currentMode = this.stateManager.getCurrentMode();

    if (currentMode === CameraModes.OVERHEAD) {
      return this.setCameraMode(CameraModes.BALL_FOLLOW);
    } else if (currentMode === CameraModes.BALL_FOLLOW) {
      return this.setCameraMode(CameraModes.OVERHEAD);
    } else {
      // If in manual or other mode, go to overhead
      return this.setCameraMode(CameraModes.OVERHEAD);
    }
  }

  /**
   * Reset camera to default view
   */
  resetCameraView(smooth = true) {
    this._userAdjustedCamera = false;

    if (this.stateManager) {
      this.stateManager.setCameraMode(CameraModes.OVERHEAD, !smooth);
    } else {
      this.positionCameraForHole();
    }

    debug.log('[CameraController] Camera view reset');
  }
}
