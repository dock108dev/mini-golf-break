import * as THREE from 'three';
import { EventTypes } from '../events/EventTypes';
import { DeviceCapabilities } from './DeviceCapabilities';

/** Handles all user input for aiming and hitting the ball. */
export class InputController {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.renderer = game.renderer;
    this.stateManager = game.stateManager;

    this.deviceCapabilities = new DeviceCapabilities();
    this.isMobileDevice = this.deviceCapabilities.isMobile;
    this.supportsHaptics = this.deviceCapabilities.supportsHaptics;
    this.isHighPerformanceDevice = this.deviceCapabilities.isHighPerformance;

    this._assignDefaultInputFields();
  }

  _assignDefaultInputFields() {
    this.isInputEnabled = true;
    this.isPointerDown = false;
    this.isDragging = false;
    this.intersectionPoint = null;
    this.intersection = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.maxDragDistance = 10;
    this.hitDirection = new THREE.Vector3(0, 0, 1);
    this.hitPower = 0;
    this.directionLine = null;
    this.powerIndicator = document.getElementById('power-indicator');
    this.controlsWereEnabled = true;
    this.isInitialized = false;

    this.isMultiTouch = false;
    this.pinchDistance = 0;
    this.touchStartTime = 0;
    this.touchVelocity = new THREE.Vector2();
    this.lastTouchPosition = new THREE.Vector2();
    this._twoFingerStartTime = undefined;

    this._dragStartScreenX = 0;
    this._dragStartScreenY = 0;
    this._DRAG_SCALE_PX = 120;

    this._trajectoryDots = [];
    this._wallReflectionLine = null;

    this.powerBarMode = false;
    this._powerBarPhase = 0;
    this.powerBarValue = 0;

    this.sleepSpeedLimit = 0.1;

    this.isKeyboardAiming = false;
    this.keyboardAimAngle = 0;
    this.isKeyboardCharging = false;
    this.keyboardPower = 0;
    this.keyboardChargeRate = 0.8;
    this.keyboardAimSpeed = 2.5;
    this.keysPressed = {};
    this.keyboardAnimationId = null;
    this.lastKeyboardUpdateTime = 0;
  }

  init() {
    try {
      if (this.isInitialized) {
        this.game.debugManager?.warn('InputController.init', 'Already initialized');
        return this;
      }
      this.initEventListeners();
      this.setupGameEventListeners();
      this.isInitialized = true;
      this.game.debugManager?.log('InputController initialized');
    } catch (error) {
      if (this.game.debugManager) {
        this.game.debugManager.error('InputController.init', 'Failed to initialize', error);
      } else {
        console.error('Failed to initialize input controller:', error);
      }
    }
    return this;
  }

  initEventListeners() {
    try {
      const domElement = this.renderer ? this.renderer.domElement : window;
      this.onMouseDown = this.onMouseDown.bind(this);
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onMouseUp = this.onMouseUp.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onTouchMove = this.onTouchMove.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyUp = this.onKeyUp.bind(this);

      domElement.addEventListener('mousedown', this.onMouseDown);
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
      domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
      window.addEventListener('touchmove', this.onTouchMove, { passive: false });
      window.addEventListener('touchend', this.onTouchEnd, { passive: false });
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);

      this.game.debugManager?.log('InputController DOM event listeners initialized');
    } catch (error) {
      if (this.game.debugManager) {
        this.game.debugManager.error(
          'InputController.initEventListeners',
          'Failed to init DOM listeners',
          error
        );
      } else {
        console.error('Failed to initialize DOM event listeners:', error);
      }
    }
  }

  setupGameEventListeners() {
    if (!this.game.eventManager) {
      this.game.debugManager?.warn('InputController', 'EventManager not available');
      return;
    }
    try {
      this.eventSubscriptions = [
        this.game.eventManager.subscribe(EventTypes.BALL_STOPPED, this.handleBallStopped, this),
        this.game.eventManager.subscribe(EventTypes.BALL_IN_HOLE, this.handleBallInHole, this),
        this.game.eventManager.subscribe(EventTypes.HOLE_STARTED, this.handleHoleStarted, this)
      ];
      this.game.debugManager?.log('InputController game event listeners initialized');
    } catch (error) {
      if (this.game.debugManager) {
        this.game.debugManager.error(
          'InputController',
          'Failed to set up game event listeners',
          error
        );
      } else {
        console.error('Failed to set up game event listeners:', error);
      }
    }
  }

  handleBallStopped(_event) {
    if (!this.game.stateManager.isHoleCompleted()) {
      this.enableInput();
    }
  }

  handleBallInHole(_event) {
    this.disableInput();
  }

  handleHoleStarted(_event) {
    this.enableInput();
  }

  isEventInsideCanvas(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  _suspendOrbitControlsForDrag() {
    if (this.game.cameraController?.controls) {
      this.controlsWereEnabled = this.game.cameraController.controls.enabled;
      this.game.cameraController.controls.enabled = false;
    }
  }

  _restoreOrbitControlsAfterAbortedDrag() {
    if (this.game.cameraController?.controls) {
      this.game.cameraController.controls.enabled = this.controlsWereEnabled;
    }
  }

  _capturePointerAndRayFromMouse(event) {
    this.isPointerDown = true;
    this.isDragging = false;
    this._dragStartScreenX = event.clientX;
    this._dragStartScreenY = event.clientY;
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  _raycastBallOrPlaneAim(ball) {
    if (!ball?.mesh) {
      return false;
    }
    if (this.raycaster.intersectObject(ball.mesh).length > 0) {
      return true;
    }
    const ballPosition = ball.mesh.position.clone();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ballPosition.y);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(dragPlane, intersection);
    if (!intersection) {
      return false;
    }
    const distanceToBall = intersection.distanceTo(ballPosition);
    if (distanceToBall >= ball.radius * 3) {
      return false;
    }
    this.intersectionPoint = intersection.clone();
    this.hitDirection = new THREE.Vector3(0, 0, 0);
    this.hitPower = 0;
    if (this.powerIndicator) {
      this.powerIndicator.style.display = 'block';
      this.updatePowerIndicator(0);
    }
    return true;
  }

  onMouseDown(event) {
    const ball = this.game.ballManager?.ball;
    if (!this.isInputEnabled || (ball && !ball.isStopped())) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    if (!this.isEventInsideCanvas(event)) {
      return;
    }
    if (this.game.stateManager?.isBallInMotion()) {
      return;
    }

    this._suspendOrbitControlsForDrag();
    this._capturePointerAndRayFromMouse(event);

    const clickedOnBall = this._raycastBallOrPlaneAim(ball);

    if (!clickedOnBall) {
      this.isPointerDown = false;
      this._restoreOrbitControlsAfterAbortedDrag();
    }
    event.preventDefault();
  }

  onMouseMove(event) {
    if (!this.isInputEnabled || !this.isPointerDown) {
      return;
    }
    this.isDragging = true;

    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Edge detection for camera panning
    this.handleEdgePanning();

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const ballPosition = this.game.ballManager.ball.mesh.position.clone();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ballPosition.y);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(dragPlane, intersection);

    if (intersection) {
      this.hitDirection = new THREE.Vector3().subVectors(ballPosition, intersection).normalize();
      const dx = event.clientX - this._dragStartScreenX;
      const dy = event.clientY - this._dragStartScreenY;
      const screenDist = Math.sqrt(dx * dx + dy * dy);
      this.hitPower = Math.min(screenDist / this._DRAG_SCALE_PX, 1.0);
      this.updatePowerIndicator(this.hitPower);
      this.updateAimLine(ballPosition, this.hitDirection, this.hitPower);
    }
    event.preventDefault();
  }

  handleEdgePanning() {
    const edgeThreshold = 0.15;
    const panSpeed = 0.03;
    let panX = 0,
      panZ = 0;
    const screenX = (this.pointer.x + 1) / 2;
    const screenY = (this.pointer.y + 1) / 2;

    if (screenX < edgeThreshold) {
      panX = -panSpeed * (1 - screenX / edgeThreshold);
    }
    if (screenX > 1 - edgeThreshold) {
      panX = panSpeed * (1 - (1 - screenX) / edgeThreshold);
    }
    if (screenY > 1 - edgeThreshold) {
      panZ = -panSpeed * (1 - (1 - screenY) / edgeThreshold);
    }
    if (screenY < edgeThreshold) {
      panZ = panSpeed * (1 - screenY / edgeThreshold);
    }

    if ((panX !== 0 || panZ !== 0) && this.game.cameraController) {
      const panDirection = new THREE.Vector3(panX, 0, panZ).normalize();
      this.game.cameraController.panCameraOnEdge(
        panDirection,
        Math.sqrt(panX * panX + panZ * panZ)
      );
    }
  }

  onMouseUp(event) {
    if (event.button !== 0) {
      return;
    }
    if (!this.isPointerDown) {
      if (this.game.cameraController?.controls && !this.controlsWereEnabled) {
        this.game.cameraController.controls.enabled = this.controlsWereEnabled;
      }
      return;
    }

    this.isPointerDown = false;

    if (this.isDragging && this.isInputEnabled && this.hitPower > 0.05) {
      this.removeDirectionLine();
      if (this.powerIndicator) {
        this.powerIndicator.style.display = 'none';
      }
      if (this.game.ballManager) {
        this.game.ballManager.hitBall(this.hitDirection.clone(), this.hitPower);
        this.disableInput();
      }
    } else {
      this.removeDirectionLine();
    }

    this.isDragging = false;
    if (this.game.cameraController?.controls) {
      this.game.cameraController.controls.enabled = this.controlsWereEnabled;
    }
    this.hitDirection.set(0, 0, 0);
    this.hitPower = 0;
    this.intersectionPoint = null;
    event.preventDefault();
  }

  onTouchStart(event) {
    const ball = this.game.ballManager?.ball;
    if (!this.isInputEnabled || (ball && !ball.isStopped())) {
      return;
    }

    this.isMultiTouch = event.touches.length > 1;
    if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.pinchDistance = Math.sqrt(dx * dx + dy * dy);
      this._twoFingerStartTime = performance.now();
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.lastTouchPosition.set(touch.clientX, touch.clientY);
      this.touchStartTime = performance.now();
      this.onMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        preventDefault: () => event.preventDefault()
      });
    }
  }

  onTouchMove(event) {
    if (this.isPointerDown && event.touches.length === 1) {
      const touch = event.touches[0];
      this.onMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => event.preventDefault()
      });
    }
  }

  onTouchEnd(event) {
    // Two-finger tap: if two fingers landed and all are now up within 200 ms, trigger pause
    if (this.isMultiTouch && this._twoFingerStartTime !== undefined && event.touches.length === 0) {
      const elapsed = performance.now() - this._twoFingerStartTime;
      this._twoFingerStartTime = undefined;
      this.isMultiTouch = false;
      if (elapsed < 200 && typeof this.game.pauseGame === 'function') {
        this.game.pauseGame();
        event.preventDefault();
        return;
      }
    }

    if (this.isPointerDown) {
      this.onMouseUp({ button: 0, preventDefault: () => event.preventDefault() });
    }
  }

  onKeyDown(event) {
    const key = event.key;

    // Ignore if input disabled, ball moving, or mouse/touch is active
    if (!this.isInputEnabled) {
      return;
    }
    if (this.isPointerDown) {
      return;
    }
    const ball = this.game.ballManager?.ball;
    if (!ball || !ball.isStopped()) {
      return;
    }
    if (this.game.stateManager?.isBallInMotion()) {
      return;
    }

    // Arrow keys for aiming direction
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      this.keysPressed[key] = true;
      if (!this.isKeyboardAiming) {
        this.startKeyboardAiming();
      }
      this.startKeyboardUpdateLoop();
      return;
    }

    // Space or Enter for power charge
    if (key === ' ' || key === 'Enter') {
      event.preventDefault();
      if (this.isKeyboardCharging) {
        return;
      } // already charging
      if (!this.isKeyboardAiming) {
        this.startKeyboardAiming();
      }
      this.isKeyboardCharging = true;
      this.keyboardPower = 0;
      if (this.powerIndicator) {
        this.powerIndicator.style.display = 'block';
        this.updatePowerIndicator(0);
      }
      this.startKeyboardUpdateLoop();
      return;
    }
  }

  onKeyUp(event) {
    const key = event.key;

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      delete this.keysPressed[key];
      return;
    }

    // Release space/enter fires the shot
    if ((key === ' ' || key === 'Enter') && this.isKeyboardCharging) {
      event.preventDefault();
      this.fireKeyboardShot();
      return;
    }

    // Escape cancels keyboard aiming
    if (key === 'Escape' && this.isKeyboardAiming) {
      this.cancelKeyboardAiming();
      return;
    }
  }

  startKeyboardAiming() {
    this.isKeyboardAiming = true;
    // Initialize aim angle from camera forward direction so aiming feels natural
    const cameraDir = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDir);
    cameraDir.y = 0;
    cameraDir.normalize();
    this.keyboardAimAngle = Math.atan2(cameraDir.x, cameraDir.z);
    this.keyboardPower = 0;
    this.updateKeyboardAimVisual();
  }

  startKeyboardUpdateLoop() {
    if (this.keyboardAnimationId !== null) {
      return;
    }
    this.lastKeyboardUpdateTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = (now - this.lastKeyboardUpdateTime) / 1000;
      this.lastKeyboardUpdateTime = now;
      this.updateKeyboardAiming(dt);
      if (this.isKeyboardAiming) {
        this.keyboardAnimationId = requestAnimationFrame(loop);
      }
    };
    this.keyboardAnimationId = requestAnimationFrame(loop);
  }

  stopKeyboardUpdateLoop() {
    if (this.keyboardAnimationId !== null) {
      cancelAnimationFrame(this.keyboardAnimationId);
      this.keyboardAnimationId = null;
    }
  }

  updateKeyboardAiming(dt) {
    // Rotate aim angle
    if (this.keysPressed['ArrowLeft']) {
      this.keyboardAimAngle += this.keyboardAimSpeed * dt;
    }
    if (this.keysPressed['ArrowRight']) {
      this.keyboardAimAngle -= this.keyboardAimSpeed * dt;
    }

    // Charge power
    if (this.isKeyboardCharging) {
      this.keyboardPower = Math.min(this.keyboardPower + this.keyboardChargeRate * dt, 1.0);
      this.updatePowerIndicator(this.keyboardPower);
    }

    this.updateKeyboardAimVisual();
  }

  updateKeyboardAimVisual() {
    const ball = this.game.ballManager?.ball;
    if (!ball?.mesh) {
      return;
    }

    const ballPosition = ball.mesh.position.clone();
    const direction = new THREE.Vector3(
      Math.sin(this.keyboardAimAngle),
      0,
      Math.cos(this.keyboardAimAngle)
    );

    // Show aim line with a preview power when not charging, actual power when charging
    const displayPower = this.isKeyboardCharging ? this.keyboardPower : 0.3;
    this.updateAimLine(ballPosition, direction, displayPower);
  }

  fireKeyboardShot() {
    if (this.keyboardPower < 0.05) {
      // Too little power, cancel
      this.cancelKeyboardAiming();
      return;
    }

    const direction = new THREE.Vector3(
      Math.sin(this.keyboardAimAngle),
      0,
      Math.cos(this.keyboardAimAngle)
    );

    this.removeDirectionLine();
    if (this.powerIndicator) {
      this.powerIndicator.style.display = 'none';
    }

    if (this.game.ballManager) {
      this.game.ballManager.hitBall(direction, this.keyboardPower);
      this.disableInput();
    }

    this.resetKeyboardState();
  }

  cancelKeyboardAiming() {
    this.removeDirectionLine();
    if (this.powerIndicator) {
      this.powerIndicator.style.display = 'none';
    }
    this.resetPowerIndicator();
    this.resetKeyboardState();
  }

  resetKeyboardState() {
    this.isKeyboardAiming = false;
    this.isKeyboardCharging = false;
    this.keyboardPower = 0;
    this.keysPressed = {};
    this.stopKeyboardUpdateLoop();
  }

  /** Remove and dispose the direction/aim line, trajectory dots, and wall reflection */
  removeDirectionLine() {
    if (this.directionLine) {
      if (this.game.scene) {
        this.game.scene.remove(this.directionLine);
      }
      this.directionLine.geometry?.dispose();
      this.directionLine.material?.dispose();
      this.directionLine = null;
    }
    this._clearTrajectoryDots();
    this._removeWallReflectionLine();
  }

  _clearTrajectoryDots() {
    this._trajectoryDots.forEach(dot => {
      this.game.scene?.remove(dot);
      dot.geometry?.dispose?.();
      dot.material?.dispose?.();
    });
    this._trajectoryDots = [];
  }

  _removeWallReflectionLine() {
    if (!this._wallReflectionLine) {
      return;
    }
    this.game.scene?.remove(this._wallReflectionLine);
    this._wallReflectionLine.geometry?.dispose?.();
    this._wallReflectionLine.material?.dispose?.();
    this._wallReflectionLine = null;
  }

  updatePowerIndicator(power) {
    if (this.powerIndicator) {
      this.powerIndicator.style.setProperty('--power-width', `${power * 100}%`);
    }
  }

  resetPowerIndicator() {
    if (this.powerIndicator) {
      this.powerIndicator.style.setProperty('--power-width', '0%');
    }
  }

  enableInput() {
    if (!this.isInputEnabled) {
      this.isInputEnabled = true;
      this.game.debugManager.log('Input enabled');
    }
  }

  disableInput() {
    if (this.isInputEnabled) {
      this.isInputEnabled = false;
      this.isPointerDown = false;
      this.isDragging = false;
      this.resetKeyboardState();
      this.removeDirectionLine();
      this.resetPowerIndicator();
      this.game.debugManager.log('Input disabled');
    }
  }

  updateAimLine(ballPosition, direction, power) {
    this.removeDirectionLine();

    const lineLength = power * 8.75;
    const endPoint = new THREE.Vector3()
      .copy(ballPosition)
      .add(new THREE.Vector3().copy(direction).multiplyScalar(lineLength));

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([ballPosition, endPoint]);
    const lineColor = new THREE.Color(
      Math.min(0.2 + power * 0.8, 1.0),
      Math.max(1.0 - power * 0.8, 0.2),
      0.2
    );
    const lineMaterial = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 2 });

    this.directionLine = new THREE.Line(lineGeometry, lineMaterial);
    this.directionLine.position.y += 0.02;
    this.game.scene.add(this.directionLine);

    this._updateTrajectoryDots(ballPosition, direction, power);
    this._updateWallReflectionLine(ballPosition, direction, lineLength);
  }

  _updateTrajectoryDots(ballPos, dir, power) {
    this._clearTrajectoryDots();
    if (!this.game.scene) {
      return;
    }

    const DOT_COUNT = 12;
    const previewSpeed = power * 10;
    const stepDt = 0.12;
    const damping = 0.99;

    let px = ballPos.x || 0;
    const py = ballPos.y || 0;
    let pz = ballPos.z || 0;
    let vx = (dir.x || 0) * previewSpeed;
    let vz = (dir.z || 0) * previewSpeed;

    for (let i = 0; i < DOT_COUNT; i++) {
      px += vx * stepDt;
      pz += vz * stepDt;
      vx *= damping;
      vz *= damping;

      const t = i / (DOT_COUNT - 1);
      const opacity = 1.0 - t * 0.9;
      const scale = 1.0 - t * 0.6;

      const geo = new THREE.SphereGeometry(0.08, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity });
      const dot = new THREE.Mesh(geo, mat);
      dot.position.set(px, py + 0.05, pz);
      dot.scale.setScalar(scale);
      this.game.scene.add(dot);
      this._trajectoryDots.push(dot);
    }
  }

  _updateWallReflectionLine(ballPos, dir, lineLength) {
    this._removeWallReflectionLine();

    const world = this.game.physicsManager?.world;
    if (typeof world?.raycastClosest !== 'function') {
      return;
    }

    const aimLen = lineLength * 2;
    const from = { x: ballPos.x || 0, y: (ballPos.y || 0) + 0.1, z: ballPos.z || 0 };
    const to = {
      x: (ballPos.x || 0) + (dir.x || 0) * aimLen,
      y: (ballPos.y || 0) + 0.1,
      z: (ballPos.z || 0) + (dir.z || 0) * aimLen
    };
    const result = {
      hasHit: false,
      hitPointWorld: { x: 0, y: 0, z: 0 },
      hitNormalWorld: { x: 0, y: 0, z: 0 }
    };

    const hit = world.raycastClosest(from, to, { skipBackfaces: true }, result);
    if (!hit && !result.hasHit) {
      return;
    }

    const hpx = result.hitPointWorld.x;
    const hpy = (ballPos.y || 0) + 0.02;
    const hpz = result.hitPointWorld.z;

    const nx = result.hitNormalWorld.x;
    const nz = result.hitNormalWorld.z;
    const nLen = Math.sqrt(nx * nx + nz * nz) || 1;
    const nnx = nx / nLen;
    const nnz = nz / nLen;
    const dot2 = (dir.x || 0) * nnx + (dir.z || 0) * nnz;
    const rx = (dir.x || 0) - 2 * dot2 * nnx;
    const rz = (dir.z || 0) - 2 * dot2 * nnz;

    const reflectLen = lineLength * 0.7;
    const hitPt = new THREE.Vector3(hpx, hpy, hpz);
    const reflectEnd = new THREE.Vector3(hpx + rx * reflectLen, hpy, hpz + rz * reflectLen);

    const geo = new THREE.BufferGeometry().setFromPoints([hitPt, reflectEnd]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
    this._wallReflectionLine = new THREE.Line(geo, mat);
    this.game.scene.add(this._wallReflectionLine);
  }

  triggerHapticFeedback(intensity) {
    this.deviceCapabilities.triggerHapticFeedback(intensity);
  }

  /** Called each frame by the game loop. Drives power-bar oscillation. */
  update(dt) {
    if (!this.powerBarMode) {
      return;
    }
    const ball = this.game.ballManager?.ball;
    if (ball && !ball.isStopped()) {
      return;
    }

    this._powerBarPhase += 2 * Math.PI * 0.7 * dt;
    this.powerBarValue = (1 - Math.cos(this._powerBarPhase)) / 2;
    this.updatePowerIndicator(this.powerBarValue);
  }

  cleanup() {
    try {
      const domElement = this.renderer ? this.renderer.domElement : window;
      domElement.removeEventListener('mousedown', this.onMouseDown);
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseUp);
      domElement.removeEventListener('touchstart', this.onTouchStart);
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('touchend', this.onTouchEnd);
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
    } catch (error) {
      this.game.debugManager?.warn(
        'InputController.cleanup',
        'Error removing DOM listeners',
        error
      );
    }
    if (this.eventSubscriptions) {
      this.eventSubscriptions.forEach(fn => fn());
      this.eventSubscriptions = [];
    }
    this.resetKeyboardState();
    this._clearTrajectoryDots();
    this._removeWallReflectionLine();
    this.removeDirectionLine();
    this.resetPowerIndicator();
    this.raycaster = null;
    this.pointer = null;
    this.intersectionPoint = null;
    this.isInitialized = false;
    this.game.debugManager?.log('InputController cleaned up');
  }
}
