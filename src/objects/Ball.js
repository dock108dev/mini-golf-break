import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { debug } from '../utils/debug';
import { EventTypes } from '../events/EventTypes';
import { resetBodyVelocity, checkBunkerOverlap, checkWaterOverlap } from './BallPhysicsHelper';
import { PhysicsConstants } from '../physics/PhysicsConstants';

const HOLE_ENTRY_OVERLAP_REQUIRED = 0.55;
const HOLE_ENTRY_MAX_SPEED = 4.06;
const HOLE_EDGE_RADIUS = 0.4;

export class Ball {
  static START_HEIGHT = 0.2;

  constructor(scene, physicsWorld, game) {
    this.scene = scene;
    this.game = game;
    this.physicsWorld = physicsWorld;
    if (!this.physicsWorld) {
      throw new Error('[Ball] Physics world not available');
    }

    this.radius = 0.2;
    this.segments = 32;
    this.mass = PhysicsConstants.ball.mass;
    this.body = null;
    this.mesh = null;
    this.isBallActive = true;
    this.currentHolePosition = null;
    this.shotCount = 0;
    this.isMoving = false;
    this.hasBeenHit = false;
    this.isHoleCompleted = false;
    this.wasStopped = true;
    this.justAppliedHop = false;
    this.isInBunker = false;
    this.lastHitPosition = new THREE.Vector3();
    this.defaultLinearDamping = PhysicsConstants.ball.linearDamping;
    this.bunkerLinearDamping = 0.98;

    // Emissive flash state: null when inactive, seconds elapsed when decaying
    this._emissiveFlashAge = null;
    this._emissiveBaseline = 0.3;

    // Idle glow state: pulses 0.3→0.6 via sine when ball speed < sleepSpeedLimit
    this._idleGlowAge = 0;
    this._isIdleGlowing = false;

    this.defaultMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0x333333,
      emissiveIntensity: 0.3
    });
    this.successMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      roughness: 0.2,
      metalness: 0.3,
      emissive: 0x00ff00,
      emissiveIntensity: 0.8
    });

    this.createMesh();
    this.createPhysicsBody();

    // Flash ball emissive on each shot and cancel idle glow
    this._onBallHit = () => {
      if (this.defaultMaterial) {
        this.defaultMaterial.emissiveIntensity = 1.0;
        this._emissiveFlashAge = 0;
      }
      this._isIdleGlowing = false;
      this._idleGlowAge = 0;
    };
    this.game?.eventManager?.subscribe?.(EventTypes.BALL_HIT, this._onBallHit);
    debug.log('[Ball] Initialized with physics world:', {
      exists: !!this.physicsWorld,
      bodyAdded: !!this.body
    });
  }

  createMesh() {
    this.createGolfBallWithDimples();
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    if (this.scene) {
      this.scene.add(this.mesh);
    }

    this.ballLight = new THREE.PointLight(0xffffff, 0.4, 3);
    if (this.scene) {
      this.scene.add(this.ballLight);
    }
    return this.mesh;
  }

  createGolfBallWithDimples() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, this.segments, this.segments),
      this.defaultMaterial
    );

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'black';
    for (let i = 0; i < 120; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    const dimpleTexture = new THREE.CanvasTexture(canvas);

    for (const mat of [this.defaultMaterial, this.successMaterial]) {
      mat.bumpMap = dimpleTexture;
      mat.bumpScale = 0.005;
      mat.needsUpdate = true;
    }
  }

  createPhysicsBody() {
    if (!this.physicsWorld) {
      console.error('[Ball] Cannot create physics body: physics world not available');
      return;
    }

    this.body = new CANNON.Body({
      mass: this.mass,
      shape: new CANNON.Sphere(this.radius),
      material: this.game.physicsManager.world.ballMaterial,
      linearDamping: this.defaultLinearDamping,
      angularDamping: PhysicsConstants.ball.angularDamping,
      collisionFilterGroup: 4,
      collisionFilterMask: -1,
      allowSleep: true,
      sleepSpeedLimit: PhysicsConstants.ball.sleepSpeedLimit,
      sleepTimeLimit: PhysicsConstants.ball.sleepTimeLimit,
      ccdSpeedThreshold: 1.5,
      ccdIterations: 8
    });

    debug.log(
      `[Ball.createPhysicsBody] Material ID: ${this.body.material?.id}, Name: ${this.body.material?.name}`
    );

    this.holeEntryThresholds = {
      MAX_SAFE_SPEED: 1.875,
      LIP_OUT_SPEED_THRESHOLD: 3.125,
      LIP_OUT_ANGLE_THRESHOLD: 60
    };

    if (this.body) {
      this.body.addEventListener('collide', this.onCollide.bind(this));
    } else {
      console.error('[Ball] Failed to add collide listener: body not created.');
    }

    this.physicsWorld.addBody(this.body);
  }

  onCollide(event) {
    if (!event.body || !event.contact) {
      return;
    }
    this.body.wakeUp();

    const otherBody = event.body;
    const otherMatName = otherBody.material?.name || 'unknown';
    if (otherMatName === 'bumper' || otherBody.userData?.type?.startsWith('wall')) {
      const impactSpeed = Math.abs(event.contact.getImpactVelocityAlongNormal());
      if (this.game?.audioManager) {
        this.game.audioManager.playWallImpact(impactSpeed);
      }
      if (impactSpeed >= 2 && this.game?.eventManager) {
        this.game.eventManager.publish(EventTypes.BALL_WALL_IMPACT, { impactSpeed }, this);
      }
    }
  }

  _tickEmissiveFlashDecay(dt) {
    if (this._emissiveFlashAge === null || !this.defaultMaterial) {
      return;
    }
    this._emissiveFlashAge += dt;
    const progress = Math.min(1, this._emissiveFlashAge / 0.1);
    this.defaultMaterial.emissiveIntensity = 1.0 - progress * (1.0 - this._emissiveBaseline);
    if (this._emissiveFlashAge >= 0.1) {
      this.defaultMaterial.emissiveIntensity = this._emissiveBaseline;
      this._emissiveFlashAge = null;
    }
  }

  _syncMeshAndLightFromBody() {
    this.mesh.position.copy(this.body.position);
    if (this.mesh.quaternion && this.body.quaternion) {
      this.mesh.quaternion.copy(this.body.quaternion);
    }
    if (this.ballLight) {
      this.ballLight.position.copy(this.mesh.position);
    }
  }

  _applyNearStopVelocityDamping() {
    const speed = this.body.velocity.length();
    if (speed < 0.08 && speed > 0) {
      this.body.velocity.scale(0.85, this.body.velocity);
      this.body.angularVelocity.scale(0.85, this.body.angularVelocity);
    }
    if (speed < 0.02) {
      this.body.velocity.setZero();
      this.body.angularVelocity.setZero();
    }
  }

  _updateHoleEntryProximity() {
    if (!this.currentHolePosition || this.isHoleCompleted) {
      return;
    }
    const allowedOffset = this.radius * (1.0 - HOLE_ENTRY_OVERLAP_REQUIRED);
    const checkRadius = HOLE_EDGE_RADIUS - allowedOffset;
    const dx = this.body.position.x - this.currentHolePosition.x;
    const dz = this.body.position.z - this.currentHolePosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > checkRadius) {
      this.justAppliedHop = false;
      return;
    }

    const ballSpeed = this.body.velocity.length();
    debug.log(
      `[Ball.update] Near hole: Dist=${dist.toFixed(3)}, Speed=${ballSpeed.toFixed(3)}, MaxSpeed=${HOLE_ENTRY_MAX_SPEED}`
    );

    if (ballSpeed <= HOLE_ENTRY_MAX_SPEED) {
      this.isHoleCompleted = true;
      this.handleHoleSuccess();
      return;
    }
    if (this.justAppliedHop) {
      return;
    }
    this.justAppliedHop = true;
    this.body.wakeUp();
    this.body.applyImpulse(new CANNON.Vec3(0, 2.5, 0));
    if (this.game?.visualEffectsManager) {
      this.game.visualEffectsManager.triggerRejectionEffect(
        new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z)
      );
    }
  }

  update(dt) {
    if (!this.body || !this.mesh) {
      return;
    }

    this._tickEmissiveFlashDecay(dt);
    this._syncMeshAndLightFromBody();
    this._applyNearStopVelocityDamping();
    this._updateHoleEntryProximity();

    this._updateIdleGlow(dt);
    this.checkAndUpdateBunkerState();
    this.checkAndUpdateWaterHazardState();

    if (this.body.position.y < -50) {
      this.handleOutOfBounds();
    }
  }

  /**
   * Pulse emissive intensity 0.3→0.6 via 2-second sine wave when ball is idle.
   * Cancels immediately when a shot fires (handled via _onBallHit).
   */
  _updateIdleGlow(dt) {
    if (this._emissiveFlashAge !== null || !this.body || !this.defaultMaterial) {
      return;
    }
    const speed = this.body.velocity.length();
    if (speed < PhysicsConstants.ball.sleepSpeedLimit) {
      if (!this._isIdleGlowing) {
        this._isIdleGlowing = true;
        this._idleGlowAge = 0;
      }
      this._idleGlowAge += dt;
      this.defaultMaterial.emissiveIntensity =
        0.45 + 0.15 * Math.sin((Math.PI * 2 * this._idleGlowAge) / 2.0);
    } else if (this._isIdleGlowing) {
      this._isIdleGlowing = false;
      this._idleGlowAge = 0;
      this.defaultMaterial.emissiveIntensity = this._emissiveBaseline;
    }
  }

  checkAndUpdateBunkerState() {
    if (!this.game?.course?.currentHole?.bodies || !this.body) {
      return;
    }

    const bunkerTriggers = this.game.course.currentHole.bodies.filter(
      b => b?.userData?.isBunkerZone
    );
    const inBunker =
      bunkerTriggers.length > 0 && checkBunkerOverlap(this.body, bunkerTriggers, this.radius);

    if (inBunker && !this.isInBunker) {
      debug.log('[Ball] Entered bunker zone.');
      this.isInBunker = true;
      this.body.linearDamping = this.bunkerLinearDamping;
    } else if (!inBunker && this.isInBunker) {
      debug.log('[Ball] Exited bunker zone.');
      this.isInBunker = false;
      this.body.linearDamping = this.defaultLinearDamping;
    }
  }

  checkAndUpdateWaterHazardState() {
    if (this.isHoleCompleted || !this.game?.course?.currentHole?.bodies) {
      return;
    }

    const waterTriggers = this.game.course.currentHole.bodies.filter(b => b.userData?.isWaterZone);
    if (waterTriggers.length === 0) {
      return;
    }

    if (
      !this.lastHitPosition ||
      (this.lastHitPosition.x === 0 && this.lastHitPosition.y === 0 && this.lastHitPosition.z === 0)
    ) {
      this.storeLastHitPosition();
    }

    if (checkWaterOverlap(this.body, waterTriggers, this.radius)) {
      debug.log(
        `[WATER HAZARD] Ball in water at (${this.body.position.x.toFixed(2)}, ${this.body.position.z.toFixed(2)})`
      );
      if (this.game.scoringSystem) {
        this.game.scoringSystem.addStroke();
      }
      this.resetToLastHitPosition();
    }
  }

  storeLastHitPosition() {
    if (this.body) {
      this.lastHitPosition.copy(this.body.position);
      debug.log(
        `[Ball] Stored last hit position: (${this.lastHitPosition.x.toFixed(2)}, ${this.lastHitPosition.y.toFixed(2)}, ${this.lastHitPosition.z.toFixed(2)})`
      );
    }
  }

  resetToLastHitPosition() {
    if (this.body && this.lastHitPosition) {
      const resetY = Math.max(this.lastHitPosition.y, this.radius + Ball.START_HEIGHT);
      this.setPosition(this.lastHitPosition.x, resetY, this.lastHitPosition.z);
      if (this.mesh) {
        this.mesh.position.copy(this.body.position);
      }
      this.body.wakeUp();
      if (this.game.uiManager) {
        this.game.uiManager.showMessage('Water Hazard! +1 Stroke', 2000);
      }
      if (this.game.audioManager) {
        this.game.audioManager.playSound('splash', 0.6);
      }
    } else {
      console.warn(
        '[Ball] Cannot reset to last hit position - position not stored or body missing.'
      );
      this.resetPosition();
    }
  }

  applyForce(direction, power) {
    if (!this.body) {
      return;
    }
    this.storeLastHitPosition();

    const forceMagnitude = power * this.powerMultiplier;
    const impulse = new CANNON.Vec3(direction.x * forceMagnitude, 0, direction.z * forceMagnitude);
    this.body.wakeUp();
    this.body.applyImpulse(impulse);
    this.body.angularVelocity.set(0, 0, 0);
    this.isMoving = true;
    this.wasStopped = false;

    if (this.game.eventManager) {
      this.game.eventManager.publish(EventTypes.BALL_HIT, { power }, this);
    }
  }

  resetPosition() {
    if (this.game?.course?.startPosition) {
      const startPos = this.game.course.startPosition;
      this.setPosition(
        startPos.x,
        Math.max(startPos.y, this.radius + Ball.START_HEIGHT),
        startPos.z
      );
      debug.log('[Ball] Reset position to hole start.');
    } else {
      console.warn('[Ball] Cannot reset position - hole start position unknown.');
      this.setPosition(0, this.radius + Ball.START_HEIGHT, 0);
    }
    this.isHoleCompleted = false;
    this.isInBunker = false;
  }

  setPosition(x, y, z) {
    const safeY = Math.max(y, this.radius + Ball.START_HEIGHT);
    if (this.mesh) {
      this.mesh.position.set(x, safeY, z);
    }
    if (this.body) {
      if (this.body.position.set) {
        this.body.position.set(x, safeY, z);
      } else {
        this.body.position.x = x;
        this.body.position.y = safeY;
        this.body.position.z = z;
      }
      this.resetVelocity();
      this.body.wakeUp();
      if (this.game?.debugManager) {
        this.game.debugManager.log(`Ball position set to (${x}, ${safeY}, ${z})`);
      }
    }
  }

  resetVelocity() {
    resetBodyVelocity(this.body);
  }

  isStopped() {
    if (!this.body) {
      return true;
    }

    const { velocity, angularVelocity } = this.body;
    const threshold = 0.15;

    const isEffectivelyZero =
      Math.abs(velocity.x) < threshold &&
      Math.abs(velocity.y) < threshold &&
      Math.abs(velocity.z) < threshold &&
      Math.abs(angularVelocity.x) < threshold &&
      Math.abs(angularVelocity.y) < threshold &&
      Math.abs(angularVelocity.z) < threshold;

    const isVerySlow = Math.abs(velocity.x) < threshold && Math.abs(velocity.z) < threshold;
    const shouldBeStopped = isEffectivelyZero || isVerySlow;

    if (shouldBeStopped && !this.wasStopped) {
      const pos = this.body.position;
      debug.log(
        `[Ball.isStopped] Stopped at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`
      );
      this.wasStopped = true;
    } else if (!shouldBeStopped) {
      this.wasStopped = false;
    }
    return shouldBeStopped;
  }

  applyImpulse(direction, power) {
    if (!this.body) {
      if (this.game?.debugManager) {
        this.game.debugManager.error(
          'Ball.applyImpulse',
          'Ball physics body is null!',
          { direction, power },
          true
        );
      } else {
        console.error('ERROR: Ball.applyImpulse: Ball physics body is null or undefined!');
      }
      return;
    }

    const mag = power * 65.0;
    const impulse = new CANNON.Vec3(direction.x * mag, 0, direction.z * mag);

    if (this.body.applyImpulse) {
      this.body.applyImpulse(impulse);
    } else if (this.body.velocity) {
      this.body.velocity.x += impulse.x;
      this.body.velocity.y += impulse.y;
      this.body.velocity.z += impulse.z;
    }

    this.body.wakeUp();

    if (this.game?.debugManager) {
      this.game.debugManager.info(
        'Ball.applyImpulse',
        `Applied impulse with power ${power.toFixed(2)}`,
        {
          direction: `(${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)})`,
          impulseMagnitude: mag
        }
      );
    }
  }

  isInHole() {
    if (!this.currentHolePosition) {
      return false;
    }
    const ballPosition = new THREE.Vector3();
    this.mesh.getWorldPosition(ballPosition);
    return ballPosition.distanceTo(this.currentHolePosition) < 0.25 && this.isStopped();
  }

  handleHoleSuccess() {
    debug.log('[Ball.handleHoleSuccess] Hole completed!');
    this.mesh.material = this.successMaterial;
    this.body.sleep();
    resetBodyVelocity(this.body);

    if (this.game?.audioManager) {
      this.game.audioManager.playSound('success', 0.7);
    }

    if (this.game?.eventManager) {
      const EventTypes = this.game.eventManager.getEventTypes();
      this.game.eventManager.publish(
        EventTypes.BALL_IN_HOLE,
        {
          ballBody: this.body,
          holeIndex: this.game.course?.currentHoleIndex ?? -1
        },
        this
      );
    } else {
      console.error(
        '[Ball.handleHoleSuccess] Cannot publish BALL_IN_HOLE event: Missing game or eventManager.'
      );
    }
  }

  resetVisuals() {
    if (this.game?.visualEffectsManager) {
      this.game.visualEffectsManager.resetBallVisuals(this);
    } else {
      this.mesh.material = this.defaultMaterial;
      this.mesh.scale.set(1, 1, 1);
    }
  }

  cleanup() {
    debug.log('[Ball] Cleaning up...');
    if (this._onBallHit) {
      this.game?.eventManager?.unsubscribe?.(EventTypes.BALL_HIT, this._onBallHit);
      this._onBallHit = null;
    }
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
    }
    if (this.ballLight && this.scene) {
      this.scene.remove(this.ballLight);
    }
    if (this.body && this.physicsWorld) {
      this.physicsWorld.removeBody(this.body);
    }
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.defaultMaterial.dispose();
      this.successMaterial.dispose();
      if (this.defaultMaterial.bumpMap?.dispose) {
        this.defaultMaterial.bumpMap.dispose();
      }
    }
    this.mesh = null;
    this.body = null;
    this.scene = null;
    this.physicsWorld = null;
    this.ballLight = null;
  }

  handleOutOfBounds() {
    debug.log(`[Ball] Out of bounds at y=${this.body.position.y.toFixed(2)}, resetting.`);
    this.resetToStartPosition();
    if (this.game?.audioManager) {
      this.game.audioManager.playSound('outOfBounds', 0.6);
    }
  }

  resetToStartPosition() {
    if (!this.game?.course?.startPosition) {
      console.error('[Ball.resetToStartPosition] Missing start position.');
      this.setPosition(0, Ball.START_HEIGHT + 0.2, 0);
      return;
    }
    const startPos = this.game.course.startPosition;
    this.setPosition(startPos.x, startPos.y + Ball.START_HEIGHT + 0.2, startPos.z);
    this.isHoleCompleted = false;
    this.mesh.material = this.defaultMaterial;
    debug.log('[Ball] Reset to start position.');
  }

  getPosition() {
    if (this.body) {
      return new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    }
    return this.position.clone();
  }
}
