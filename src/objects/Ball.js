import * as THREE from 'three';
import * as CANNON from 'cannon-es';
// Import the physics utility functions
import { calculateImpactAngle, isLipOut } from '../physics/utils';
import { debug } from '../utils/debug';
import { EventTypes } from '../events/EventTypes';

// --- Configuration Constants ---
const HOLE_ENTRY_OVERLAP_REQUIRED = 0.55; // e.g., 0.55 means 55% of ball diameter must be over the hole
const HOLE_ENTRY_MAX_SPEED = 4.06; // Max speed (m/s) for ball to enter the hole (Increased by 1.25x)
const HOLE_EDGE_RADIUS = 0.4; // Assumed physical radius of the hole opening
// --- End Configuration Constants ---

export class Ball {
  // Constants for ball properties
  static START_HEIGHT = 0.2; // Reduced to match green surface height

  constructor(scene, physicsWorld, game) {
    this.scene = scene;
    this.game = game;
    this.physicsWorld = physicsWorld;

    if (!this.physicsWorld) {
      throw new Error('[Ball] Physics world not available');
    }

    // Initialize ball properties
    this.radius = 0.2;
    this.segments = 32;
    this.mass = 1;
    this.body = null;
    this.mesh = null;
    this.isBallActive = true;

    // Store hole information
    this.currentHolePosition = null;
    this.shotCount = 0;
    this.isMoving = false;
    this.hasBeenHit = false;
    this.isHoleCompleted = false; // Added completion flag
    this.wasStopped = true; // Initialize as stopped
    this.justAppliedHop = false; // Flag to prevent repeated hop impulse
    this.isInBunker = false; // Add flag to track bunker state
    this.lastBunkerLogTime = 0; // Timer for throttling bunker check logs
    this.lastHitPosition = new THREE.Vector3(); // Store position before hit

    // Damping values
    this.defaultLinearDamping = 0.85; // Increased from 0.7 for faster stopping
    this.bunkerLinearDamping = 0.98;

    // Create materials for the ball
    this.defaultMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Pure white golf ball
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0x333333, // Slight glow to be visible in space
      emissiveIntensity: 0.3
    });

    this.successMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00, // Green for success
      roughness: 0.2,
      metalness: 0.3,
      emissive: 0x00ff00, // Strong green glow
      emissiveIntensity: 0.8 // Brighter glow for success
    });

    // Create the ball
    this.createMesh();
    this.createPhysicsBody();

    debug.log('[Ball] Initialized with physics world:', {
      exists: !!this.physicsWorld,
      bodyAdded: !!this.body
    });
  }

  createMesh() {
    // Create golf ball with dimples
    this.createGolfBallWithDimples();

    // Set initial position - REMOVED - Position is set by BallManager after creation
    // this.mesh.position.copy(this.position);

    // Enable shadows
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Add to scene
    if (this.scene) {
      this.scene.add(this.mesh);
    }

    // Add a small light to the ball to make it stand out
    this.ballLight = new THREE.PointLight(0xffffff, 0.4, 3);
    // Set initial position - REMOVED - Position is set by BallManager after creation
    // this.ballLight.position.copy(this.position);
    if (this.scene) {
      this.scene.add(this.ballLight);
    }

    return this.mesh;
  }

  /**
   * Create a golf ball mesh with dimples
   */
  createGolfBallWithDimples() {
    // Create base sphere for the golf ball
    const baseGeometry = new THREE.SphereGeometry(this.radius, this.segments, this.segments);

    // Create the ball mesh
    this.mesh = new THREE.Mesh(baseGeometry, this.defaultMaterial);

    // Create dimples using displacement map
    const textureLoader = new THREE.TextureLoader();
    const createDimpleTexture = () => {
      // Create a canvas for the dimple texture
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');

      // Fill with white
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Draw dimples
      context.fillStyle = 'black';

      // Number of dimples and their size
      const numDimples = 120;
      const dimpleRadius = 8;

      // Draw randomly positioned dimples
      for (let i = 0; i < numDimples; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;

        context.beginPath();
        context.arc(x, y, dimpleRadius, 0, Math.PI * 2);
        context.fill();
      }

      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };

    // Create and apply the dimple texture as a bump map
    const dimpleTexture = createDimpleTexture();
    this.defaultMaterial.bumpMap = dimpleTexture;
    this.defaultMaterial.bumpScale = 0.005; // Adjust dimple depth
    this.defaultMaterial.needsUpdate = true;

    // Apply the same texture to success material
    this.successMaterial.bumpMap = dimpleTexture;
    this.successMaterial.bumpScale = 0.005;
    this.successMaterial.needsUpdate = true;
  }

  createPhysicsBody() {
    if (!this.physicsWorld) {
      console.error('[Ball] Cannot create physics body: physics world not available');
      return;
    }

    // Create the physics body
    this.body = new CANNON.Body({
      mass: this.mass,
      shape: new CANNON.Sphere(this.radius),
      material: this.game.physicsManager.world.ballMaterial,
      linearDamping: this.defaultLinearDamping, // Use stored default
      angularDamping: 0.5, // Increased from 0.3 for faster stopping
      collisionFilterGroup: 4,
      collisionFilterMask: -1,
      allowSleep: true, // Ensure sleep is allowed
      sleepSpeedLimit: 0.03, // Reduced from 0.05 to sleep sooner
      sleepTimeLimit: 0.3, // Reduced from 0.5 to sleep sooner
      // Enable CCD (Continuous Collision Detection) to prevent tunneling through barriers
      ccdSpeedThreshold: 1.0, // Enable CCD when moving faster than 1 unit per second
      ccdIterations: 10 // Number of CCD "substeps" - higher values increase accuracy but cost performance
    });

    // Log assigned material ID
    debug.log(
      `[Ball.createPhysicsBody] Assigned Material ID: ${this.body.material?.id}, Name: ${this.body.material?.name}`
    );

    // Define thresholds for hole entry logic (make these easily configurable)
    this.holeEntryThresholds = {
      MAX_SAFE_SPEED: 1.875, // Speed (m/s) below which the ball safely drops in. (Increased by 1.25x)
      LIP_OUT_SPEED_THRESHOLD: 3.125, // Speed (m/s) above which lip-outs become more likely. (Increased by 1.25x)
      LIP_OUT_ANGLE_THRESHOLD: 60 // Angle (degrees, 0-180, 180=direct) below which is considered a glancing blow.
    };

    // Add event listener
    if (this.body) {
      this.body.addEventListener('collide', this.onCollide.bind(this));
      debug.log('[Ball] Added collide event listener');
    } else {
      console.error('[Ball] Failed to add collide listener: body not created.');
    }

    // Add body to physics world
    this.physicsWorld.addBody(this.body);
    debug.log('[Ball] Added physics body to world');
  }

  onCollide(event) {
    // Handle collision events
    if (!event.body) {
      return;
    } // Safety check

    const otherBody = event.body;
    const otherUserData = otherBody.userData;
    // let justEnteredBunker = false; // Flag for this event cycle - REMOVED

    // --- Bunker Enter/Exit Check --- REMOVED
    // Logic moved to update() for continuous state checking
    // --- End Bunker Check ---

    // --- Existing Other Collision Logic (Walls, Bumpers) ---
    // This part requires contact information for sounds etc.
    if (!event.contact) {
      return; // Only process physical collisions with contact info below
    }

    this.body.wakeUp(); // Wake up on physical contact

    const otherMatName = otherBody.material?.name || 'unknown';
    if (otherMatName === 'bumper' || otherUserData?.type?.startsWith('wall')) {
      if (this.game && this.game.audioManager) {
        const contactInfo = event.contact;
        const impactSpeed = contactInfo.getImpactVelocityAlongNormal();
        const volume = Math.min(0.8, Math.max(0.1, Math.abs(impactSpeed) / 5.0)); // Use Math.abs
        this.game.audioManager.playSound('bump', volume);
      }
    }
    // Add other collision handling here if needed
  }

  /**
   * Update the ball's physics and visuals
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (this.body && this.mesh) {
      this.mesh.position.copy(this.body.position);
      if (this.mesh.quaternion && this.body.quaternion) {
        this.mesh.quaternion.copy(this.body.quaternion);
      }

      if (this.ballLight) {
        this.ballLight.position.copy(this.mesh.position);
      }

      // Log current hole position status before check
      if (!this.isHoleCompleted) {
        // debug.log(`[Ball.update] Checking hole entry. currentHolePosition:`, this.currentHolePosition);
      }

      // --- Check for Hole Entry ---
      if (this.currentHolePosition && !this.isHoleCompleted) {
        // Use constants defined at the top of the file
        const ballRadius = this.radius; // Assumes this.radius is correct (e.g., 0.2 from constructor)

        // Calculate the effective radius for check based on required overlap
        const allowedCenterOffsetFromEdge = ballRadius * (1.0 - HOLE_ENTRY_OVERLAP_REQUIRED);
        const checkRadius = HOLE_EDGE_RADIUS - allowedCenterOffsetFromEdge;

        // Calculate horizontal distance to hole center
        const dx = this.body.position.x - this.currentHolePosition.x;
        const dz = this.body.position.z - this.currentHolePosition.z;
        const distanceFromHoleCenter = Math.sqrt(dx * dx + dz * dz);

        // Check if ball center is within the effective check radius
        if (distanceFromHoleCenter <= checkRadius) {
          const ballSpeed = this.body.velocity.length();

          debug.log(
            `[Ball.update] Near hole: Dist=${distanceFromHoleCenter.toFixed(3)}, CheckRadius=${checkRadius.toFixed(3)}, Speed=${ballSpeed.toFixed(3)}, MaxSpeed=${HOLE_ENTRY_MAX_SPEED}`
          );

          let shouldEnter = false;
          // Check speed against threshold constant
          if (ballSpeed <= HOLE_ENTRY_MAX_SPEED) {
            debug.log('[Ball.update] Hole Entry: Speed OK.');
            shouldEnter = true;
          } else {
            debug.log('[Ball.update] Hole Rejected: Speed too high.');
            // --- Add Lip-Out/High Speed Rejection Effect ---
            // Apply hop only once per rejection event
            if (this.body && !this.justAppliedHop) {
              this.justAppliedHop = true; // Set flag
              // Ensure the body is awake to receive impulse
              this.body.wakeUp();
              // Apply a small upward impulse for a visual hop
              const hopImpulseStrength = 2.5; // DRASTICALLY INCREASED STRENGTH
              const hopImpulse = new CANNON.Vec3(0, hopImpulseStrength, 0);
              const velBefore = this.body.velocity.y;
              this.body.applyImpulse(hopImpulse);
              const velAfter = this.body.velocity.y;
              debug.log(
                `[Ball.update] Applied rejection hop impulse. Vel Y Before: ${velBefore.toFixed(3)}, After: ${velAfter.toFixed(3)}`
              );

              // --- Trigger Visual Effect ---
              if (this.game && this.game.visualEffectsManager) {
                // Convert CANNON.Vec3 to THREE.Vector3 if needed by the manager
                const effectPosition = new THREE.Vector3(
                  this.body.position.x,
                  this.body.position.y,
                  this.body.position.z
                );
                this.game.visualEffectsManager.triggerRejectionEffect(effectPosition);
                debug.log('[Ball.update] Triggered rejection visual effect.');
              } else {
                console.warn(
                  '[Ball.update] VisualEffectsManager not found, cannot trigger rejection effect.'
                );
              }
              // --- End Trigger Visual Effect ---
            }
            // --- End Effect ---
          }

          // Trigger success if conditions met
          if (shouldEnter) {
            this.isHoleCompleted = true;
            this.handleHoleSuccess();
          }
        } else {
          // Ball is outside the check radius, reset the hop flag
          this.justAppliedHop = false;
        }
      }
      // --- End Check for Hole Entry ---

      // --- Bunker State Check ---
      this.checkAndUpdateBunkerState();
      // --- End Bunker State Check ---

      // --- Water Hazard Check ---
      this.checkAndUpdateWaterHazardState();
      // --- End Water Hazard Check ---

      const outOfBoundsThreshold = -50;
      if (this.body.position.y < outOfBoundsThreshold) {
        this.handleOutOfBounds();
      }
    }
  }

  /**
   * Checks if the ball is currently inside any bunker trigger zone
   * and updates the isInBunker state and physics properties accordingly.
   */
  checkAndUpdateBunkerState() {
    // Ensure game, course, and currentHole are valid
    if (!this.game || !this.game.course || !this.game.course.currentHole) {
      return; // Cannot check without course/hole context
    }

    // Get bunker trigger bodies from the current hole
    const currentHole = this.game.course.currentHole;
    if (!currentHole || !Array.isArray(currentHole.bodies)) {
      return;
    }
    const bunkerTriggers = currentHole.bodies.filter(body => body?.userData?.isBunkerZone);

    if (bunkerTriggers.length === 0) {
      // If no bunkers on this hole, ensure state is false
      if (this.isInBunker) {
        debug.log('[Ball.update] Exited bunker zone (no bunkers on hole).');
        this.isInBunker = false;
        if (this.body) {
          this.body.linearDamping = this.defaultLinearDamping;
        }
      }
      return;
    }

    // If we don't have a body, we can't check
    if (!this.body) {
      return;
    }
    const ballPos = this.body.position;
    let isCurrentlyInsideBunker = false;

    // Check each bunker trigger
    for (const trigger of bunkerTriggers) {
      if (!trigger || !trigger.shapes || trigger.shapes.length === 0) {
        continue;
      }

      const shape = trigger.shapes[0];
      const triggerPos = trigger.position;

      // Simple world-space checks based on shape type
      if (shape instanceof CANNON.Cylinder) {
        // For cylinders, just check horizontal distance (ignore Y/height)
        const dx = ballPos.x - triggerPos.x;
        const dz = ballPos.z - triggerPos.z;
        const horizontalDistSq = dx * dx + dz * dz;
        const radius = shape.radiusTop;

        if (horizontalDistSq <= radius * radius) {
          isCurrentlyInsideBunker = true;
          break;
        }
      } else if (shape instanceof CANNON.Box) {
        // For boxes, check all axes but with a simplified approach
        // This assumes the box is axis-aligned (not rotated)
        const halfExtents = shape.halfExtents;

        const dx = Math.abs(ballPos.x - triggerPos.x);
        const dz = Math.abs(ballPos.z - triggerPos.z);

        // For sand bunkers, we primarily care about XZ plane overlap
        // Since the ball is always on the ground, just check if it's horizontally inside
        // Only use a very basic vertical check to ensure the ball isn't way above/below the bunker
        const ballIsAboveBunker = ballPos.y > triggerPos.y + halfExtents.y + this.radius * 2;
        const ballIsBelowBunker = ballPos.y < triggerPos.y - halfExtents.y - this.radius * 2;
        const verticalOverlap = !ballIsAboveBunker && !ballIsBelowBunker;

        // Debug logging - only once per second using lastBunkerLogTime
        const currentTime = Date.now();
        if (currentTime - this.lastBunkerLogTime > 1000) {
          this.lastBunkerLogTime = currentTime;
          const dy = Math.abs(ballPos.y - triggerPos.y); // Calculate dy only for logging
          debug.log(
            `[BUNKER DEBUG] Box check - ballPos: (${ballPos.x.toFixed(2)}, ${ballPos.y.toFixed(2)}, ${ballPos.z.toFixed(2)})`
          );
          debug.log(
            `[BUNKER DEBUG] Box check - triggerPos: (${triggerPos.x.toFixed(2)}, ${triggerPos.y.toFixed(2)}, ${triggerPos.z.toFixed(2)})`
          );
          debug.log(
            `[BUNKER DEBUG] Box check - halfExtents: (${halfExtents.x.toFixed(2)}, ${halfExtents.y.toFixed(2)}, ${halfExtents.z.toFixed(2)})`
          );
          debug.log(
            `[BUNKER DEBUG] Box check - distances: dx: ${dx.toFixed(2)}, dy: ${dy.toFixed(2)}, dz: ${dz.toFixed(2)}`
          );
          debug.log(
            `[BUNKER DEBUG] Box check - isWithinX=${dx <= halfExtents.x}, isAboveBunker=${ballIsAboveBunker}, isBelowBunker=${ballIsBelowBunker}, isWithinZ=${dz <= halfExtents.z}`
          );
          debug.log(
            `[BUNKER DEBUG] Box check - verticalOverlap=${verticalOverlap}, finalResult=${dx <= halfExtents.x && dz <= halfExtents.z && verticalOverlap}`
          );
        }

        if (dx <= halfExtents.x && dz <= halfExtents.z && verticalOverlap) {
          isCurrentlyInsideBunker = true;
          break;
        }
      }
    }

    // Update state if changed
    if (isCurrentlyInsideBunker && !this.isInBunker) {
      // Just entered a bunker
      debug.log('[Ball.update] Entered bunker zone.');
      this.isInBunker = true;
      this.body.linearDamping = this.bunkerLinearDamping; // Apply higher damping
    } else if (!isCurrentlyInsideBunker && this.isInBunker) {
      // Just exited a bunker
      debug.log('[Ball.update] Exited bunker zone.');
      this.isInBunker = false;
      this.body.linearDamping = this.defaultLinearDamping; // Restore default damping
    }
  }

  /**
   * Checks if the ball is currently overlapping any water hazard trigger zone
   * and applies penalty logic if necessary.
   */
  checkAndUpdateWaterHazardState() {
    if (this.isHoleCompleted || !this.game?.course?.currentHole?.bodies) {
      return; // Don't check if hole complete or context missing
    }

    const waterTriggers = this.game.course.currentHole.bodies.filter(
      body => body.userData?.isWaterZone
    );
    if (waterTriggers.length === 0) {
      return; // No water hazards on this hole
    }

    // Check if we have a valid last hit position
    if (
      !this.lastHitPosition ||
      (this.lastHitPosition.x === 0 && this.lastHitPosition.y === 0 && this.lastHitPosition.z === 0)
    ) {
      // No valid last hit position, store current position as fallback
      this.storeLastHitPosition();
    }

    const ballPos = this.body.position;
    const ballRadius = this.radius;
    const overlapThreshold = 0.35; // 35% overlap required for penalty

    for (const trigger of waterTriggers) {
      if (trigger.shapes.length > 0) {
        const shape = trigger.shapes[0];
        const triggerPos = trigger.position;
        let isOverlapping = false;
        let overlapDistance = 0;

        if (shape instanceof CANNON.Cylinder) {
          const dx = ballPos.x - triggerPos.x;
          const dz = ballPos.z - triggerPos.z;
          const distSq = dx * dx + dz * dz;
          const radius = shape.radiusTop;
          if (distSq < radius * radius) {
            // Check horizontal first
            overlapDistance = radius - Math.sqrt(distSq);
            isOverlapping = overlapDistance / (ballRadius * 2) >= overlapThreshold;
          }
        } else if (shape instanceof CANNON.Box) {
          // Basic AABB check for overlap with Box - simplified
          const halfExtents = shape.halfExtents;
          const dx = Math.abs(ballPos.x - triggerPos.x);
          const dz = Math.abs(ballPos.z - triggerPos.z);
          // Simplification: check if center is within box + overlap distance
          const effectiveHalfX = halfExtents.x + ballRadius * overlapThreshold;
          const effectiveHalfZ = halfExtents.z + ballRadius * overlapThreshold;
          if (dx < effectiveHalfX && dz < effectiveHalfZ) {
            // This is a rough check, not precise overlap percentage
            isOverlapping = true;
          }
        }

        if (isOverlapping) {
          debug.log(
            `[WATER HAZARD] Ball in water! Current position: (${ballPos.x.toFixed(2)}, ${ballPos.y.toFixed(2)}, ${ballPos.z.toFixed(2)})`
          );
          debug.log(
            `[WATER HAZARD] Last hit position: (${this.lastHitPosition.x.toFixed(2)}, ${this.lastHitPosition.y.toFixed(2)}, ${this.lastHitPosition.z.toFixed(2)})`
          );

          // Apply penalty
          if (this.game.scoringSystem) {
            this.game.scoringSystem.addStroke();
          }

          // Reset ball to last hit position
          this.resetToLastHitPosition();

          // Exit loop after penalty
          return;
        }
      }
    }
  }

  // Method to store the last hit position
  storeLastHitPosition() {
    if (this.body) {
      this.lastHitPosition.copy(this.body.position);
      debug.log(
        `[Ball] 📍 Stored last hit position: (${this.lastHitPosition.x.toFixed(2)}, ${this.lastHitPosition.y.toFixed(2)}, ${this.lastHitPosition.z.toFixed(2)})`
      );
    }
  }

  // Method to reset the ball to the last hit position
  resetToLastHitPosition() {
    debug.log('[Ball] ⚠️ Attempting to reset to last hit position...');

    if (this.body && this.lastHitPosition) {
      debug.log(
        `[Ball] ⚠️ Resetting to last hit position: (${this.lastHitPosition.x.toFixed(2)}, ${this.lastHitPosition.y.toFixed(2)}, ${this.lastHitPosition.z.toFixed(2)})`
      );
      // Ensure reset position is slightly above ground
      const resetY = Math.max(this.lastHitPosition.y, this.radius + Ball.START_HEIGHT);

      // We're going to use our internal setPosition method to ensure the physics body is properly updated
      this.setPosition(this.lastHitPosition.x, resetY, this.lastHitPosition.z);

      // Update mesh position to match physics body
      if (this.mesh) {
        this.mesh.position.copy(this.body.position);
      }

      // Wake up the body to ensure physics are applied
      this.body.wakeUp();

      // Optional: Notify UI or play sound
      if (this.game.uiManager) {
        this.game.uiManager.showMessage('Water Hazard! +1 Stroke', 2000);
      }
      if (this.game.audioManager) {
        this.game.audioManager.playSound('splash', 0.6); // Assuming a splash sound exists
      }
    } else {
      console.warn(
        '[Ball] ⚠️ Cannot reset to last hit position - position not stored or body missing.'
      );
      console.warn(
        '[Ball] body exists:',
        !!this.body,
        'lastHitPosition exists:',
        !!this.lastHitPosition
      );
      // Fallback: reset to hole start?
      this.resetPosition();
    }
  }

  // Modify applyForce to store position *before* applying impulse
  applyForce(direction, power) {
    if (!this.body) {
      return;
    }

    // Store position just before hitting
    this.storeLastHitPosition();

    // Apply impulse (existing logic)
    const forceMagnitude = power * this.powerMultiplier;
    const impulse = new CANNON.Vec3(
      direction.x * forceMagnitude,
      0, // No vertical impulse from player hit
      direction.z * forceMagnitude
    );
    this.body.wakeUp();
    this.body.applyImpulse(impulse);
    if (this.body.angularVelocity.set) {
      if (this.body.angularVelocity.set) {
        this.body.angularVelocity.set(0, 0, 0);
      } else {
        this.body.angularVelocity.x = 0;
        this.body.angularVelocity.y = 0;
        this.body.angularVelocity.z = 0;
      }
    } else {
      this.body.angularVelocity.x = 0;
      this.body.angularVelocity.y = 0;
      this.body.angularVelocity.z = 0;
    } // Reset spin

    this.isMoving = true;
    this.wasStopped = false;

    // Log event
    if (this.game.eventManager) {
      this.game.eventManager.publish(EventTypes.BALL_HIT, { power }, this);
    }
  }

  // Modify resetPosition to also reset lastHitPosition potentially?
  resetPosition() {
    // Reset to current hole's start position
    if (this.game?.course?.startPosition) {
      const startPos = this.game.course.startPosition;
      const resetY = Math.max(startPos.y, this.radius + Ball.START_HEIGHT);
      this.setPosition(startPos.x, resetY, startPos.z);
      // this.lastHitPosition.copy(startPos); // REMOVED - Don't overwrite last hit pos on general reset
      debug.log('[Ball] Reset position to hole start.');
    } else {
      console.warn('[Ball] Cannot reset position - hole start position unknown.');
      this.setPosition(0, this.radius + Ball.START_HEIGHT, 0); // Fallback reset
      // this.lastHitPosition.set(0, this.radius + Ball.START_HEIGHT, 0); // REMOVED - Fallback reset should NOT affect last hit position
    }
    this.isHoleCompleted = false; // Ensure hole completion flag is reset
    this.isInBunker = false; // Ensure bunker flag is reset
  }

  setPosition(x, y, z) {
    // Make sure y is at least ball radius + start height to avoid ground penetration
    const safeY = Math.max(y, this.radius + Ball.START_HEIGHT);

    // Set mesh position
    if (this.mesh) {
      this.mesh.position.set(x, safeY, z);
    }

    // Set body position
    if (this.body) {
      // Position the ball at the safe height
      if (this.body.position.set) {
        this.body.position.set(x, safeY, z);
      } else {
        // Fallback for mocks or incomplete physics bodies
        this.body.position.x = x;
        this.body.position.y = safeY;
        this.body.position.z = z;
      }

      // Reset velocity and forces when repositioning
      this.resetVelocity();

      // Make sure the body is awake after repositioning
      this.body.wakeUp();

      if (this.game && this.game.debugManager) {
        this.game.debugManager.log(`Ball position set to (${x}, ${safeY}, ${z})`);
      }
    }
  }

  resetVelocity() {
    if (this.body) {
      if (this.body.velocity.set) {
        if (this.body.velocity.set) {
          this.body.velocity.set(0, 0, 0);
        } else {
          this.body.velocity.x = 0;
          this.body.velocity.y = 0;
          this.body.velocity.z = 0;
        }
      } else {
        this.body.velocity.x = 0;
        this.body.velocity.y = 0;
        this.body.velocity.z = 0;
      }
      if (this.body.angularVelocity.set) {
        if (this.body.angularVelocity.set) {
          this.body.angularVelocity.set(0, 0, 0);
        } else {
          this.body.angularVelocity.x = 0;
          this.body.angularVelocity.y = 0;
          this.body.angularVelocity.z = 0;
        }
      } else {
        this.body.angularVelocity.x = 0;
        this.body.angularVelocity.y = 0;
        this.body.angularVelocity.z = 0;
      }
      this.body.force.set(0, 0, 0);
      this.body.torque.set(0, 0, 0);

      // Explicitly wake up the body to ensure physics are applied
      this.body.wakeUp();
    }
  }

  isStopped() {
    if (!this.body) {
      return true;
    }

    const velocity = this.body.velocity;
    const angularVelocity = this.body.angularVelocity;

    // Thresholds for determining if stopped or very slow
    const speedThreshold = 0.15; // Lowered from 0.25 to stop faster
    const rotationThreshold = 0.15; // Lowered from 0.25 to stop faster
    const verySlowFactor = 1.0; // Apply high damping below speedThreshold

    const isEffectivelyZero =
      Math.abs(velocity.x) < speedThreshold &&
      Math.abs(velocity.y) < speedThreshold &&
      Math.abs(velocity.z) < speedThreshold &&
      Math.abs(angularVelocity.x) < rotationThreshold &&
      Math.abs(angularVelocity.y) < rotationThreshold &&
      Math.abs(angularVelocity.z) < rotationThreshold;

    const isVerySlow =
      Math.abs(velocity.x) < speedThreshold * verySlowFactor &&
      Math.abs(velocity.z) < speedThreshold * verySlowFactor;

    // --- Simplified Stop Logic ---
    // Check if the ball is either stopped OR moving very slowly.
    const shouldBeStopped = isEffectivelyZero || isVerySlow;

    if (shouldBeStopped) {
      // Log stopping event only once
      if (!this.wasStopped) {
        const pos = this.body.position;
        debug.log(
          `[Ball.isStopped] Ball considered stopped at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`
        );
        this.wasStopped = true;
      }
    } else {
      // Reset wasStopped flag if moving faster
      this.wasStopped = false;
    }

    // Return the state - rely on damping/sleep params to actually stop the body
    return shouldBeStopped;
  }

  /**
   * Apply impulse to the ball
   * @param {THREE.Vector3} direction - Direction vector for the impulse
   * @param {number} power - Power of the impulse (0-1, scaled internally)
   */
  applyImpulse(direction, power) {
    // Enhanced error handling with detailed context
    if (!this.body) {
      if (this.game && this.game.debugManager) {
        this.game.debugManager.error(
          'Ball.applyImpulse', // Updated context
          'Failed - Ball physics body is null or undefined!',
          { direction, power },
          true // Show in UI as this is a critical gameplay issue
        );
      } else {
        console.error('ERROR: Ball.applyImpulse: Failed - Ball physics body is null or undefined!'); // Updated context
      }
      return;
    }

    // Scale power for reasonable impulse magnitude
    const impulseMagnitude = power * 65.0; // Doubled from previous value of 32.5

    // Apply horizontal impulse only
    const impulse = new CANNON.Vec3(
      direction.x * impulseMagnitude,
      0,
      direction.z * impulseMagnitude
    );

    // Apply impulse at the center of the ball
    if (this.body.applyImpulse) {
      this.body.applyImpulse(impulse);
    } else {
      // Fallback for mocks - manually update velocity
      if (impulse && this.body.velocity) {
        this.body.velocity.x += impulse.x;
        this.body.velocity.y += impulse.y;
        this.body.velocity.z += impulse.z;
      }
    }

    // Wake up the physics body
    this.body.wakeUp();

    // Use improved debug logging
    if (this.game && this.game.debugManager) {
      this.game.debugManager.info(
        'Ball.applyImpulse', // Updated context
        `Applied impulse with power ${power.toFixed(2)}`,
        {
          direction: `(${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)})`,
          impulseMagnitude // Log the new magnitude
        }
      );
    }
  }

  /**
   * Check if the ball is in a hole
   */
  isInHole() {
    // Check distance to hole position
    if (!this.currentHolePosition) {
      return false;
    }

    const ballPosition = new THREE.Vector3();
    this.mesh.getWorldPosition(ballPosition);

    const distanceToHole = ballPosition.distanceTo(this.currentHolePosition);
    const isNearHole = distanceToHole < 0.25; // Slightly smaller than hole radius for better detection

    // Also check if ball is at rest or nearly at rest
    const isAtRest = this.isStopped();

    return isNearHole && isAtRest;
  }

  /**
   * Handle when ball goes in hole
   */
  handleHoleSuccess() {
    debug.log('[Ball.handleHoleSuccess] Hole completed!');
    this.mesh.material = this.successMaterial;
    this.body.sleep();
    if (this.body.velocity.set) {
      this.body.velocity.set(0, 0, 0);
    } else {
      this.body.velocity.x = 0;
      this.body.velocity.y = 0;
      this.body.velocity.z = 0;
    }
    if (this.body.angularVelocity.set) {
      if (this.body.angularVelocity.set) {
        this.body.angularVelocity.set(0, 0, 0);
      } else {
        this.body.angularVelocity.x = 0;
        this.body.angularVelocity.y = 0;
        this.body.angularVelocity.z = 0;
      }
    } else {
      this.body.angularVelocity.x = 0;
      this.body.angularVelocity.y = 0;
      this.body.angularVelocity.z = 0;
    }

    if (this.game && this.game.audioManager) {
      this.game.audioManager.playSound('success', 0.7);
    }

    if (this.game && this.game.eventManager) {
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

  /**
   * Reset ball visuals to default state
   */
  resetVisuals() {
    if (this.game && this.game.visualEffectsManager) {
      this.game.visualEffectsManager.resetBallVisuals(this);
    } else {
      // Fallback if the manager isn't available
      this.mesh.material = this.defaultMaterial;
      this.mesh.scale.set(1, 1, 1);
    }
  }

  /**
   * Clean up resources for this ball
   */
  cleanup() {
    debug.log('[Ball] Cleaning up...');

    // Remove mesh from scene
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
    }

    // Remove light from scene
    if (this.ballLight && this.scene) {
      this.scene.remove(this.ballLight);
    }

    // Remove physics body from world
    if (this.body && this.physicsWorld) {
      this.physicsWorld.removeBody(this.body);
    }

    // Dispose of geometry and materials
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.defaultMaterial.dispose();
      this.successMaterial.dispose();

      // Dispose of bump map texture if it exists
      if (
        this.defaultMaterial.bumpMap &&
        typeof this.defaultMaterial.bumpMap.dispose === 'function'
      ) {
        this.defaultMaterial.bumpMap.dispose();
      }
    }

    // Clear references
    this.mesh = null;
    this.body = null;
    this.scene = null;
    this.physicsWorld = null;
    this.ballLight = null;
  }

  /**
   * Handle ball out of bounds
   */
  handleOutOfBounds() {
    debug.log(`[Ball] Ball out of bounds at y=${this.body.position.y.toFixed(2)}, resetting.`);
    this.resetToStartPosition();
    if (this.game && this.game.audioManager) {
      this.game.audioManager.playSound('outOfBounds', 0.6);
    }
  }

  /**
   * Resets the ball to the current hole's start position.
   * (This might exist in BallManager, ensure consistency or move logic)
   * For now, assuming it gets the start position from the game/course.
   */
  resetToStartPosition() {
    if (!this.game || !this.game.course || !this.game.course.startPosition) {
      console.error(
        '[Ball.resetToStartPosition] Cannot reset ball: Missing game/course/startPosition info.'
      );
      if (this.body.position.set) {
        this.body.position.set(0, Ball.START_HEIGHT + 0.2, 0);
      } else {
        this.body.position.x = 0;
        this.body.position.y = Ball.START_HEIGHT + 0.2;
        this.body.position.z = 0;
      }
      return;
    }

    const startPos = this.game.course.startPosition;
    if (this.body.position.set) {
      this.body.position.set(startPos.x, startPos.y + Ball.START_HEIGHT + 0.2, startPos.z);
    } else {
      this.body.position.x = startPos.x;
      this.body.position.y = startPos.y + Ball.START_HEIGHT + 0.2;
      this.body.position.z = startPos.z;
    }
    if (this.body.velocity.set) {
      this.body.velocity.set(0, 0, 0);
    } else {
      this.body.velocity.x = 0;
      this.body.velocity.y = 0;
      this.body.velocity.z = 0;
    }
    if (this.body.angularVelocity.set) {
      if (this.body.angularVelocity.set) {
        this.body.angularVelocity.set(0, 0, 0);
      } else {
        this.body.angularVelocity.x = 0;
        this.body.angularVelocity.y = 0;
        this.body.angularVelocity.z = 0;
      }
    } else {
      this.body.angularVelocity.x = 0;
      this.body.angularVelocity.y = 0;
      this.body.angularVelocity.z = 0;
    }
    this.body.wakeUp();
    this.isHoleCompleted = false;
    this.mesh.material = this.defaultMaterial;
    debug.log('[Ball] Ball reset to position:', this.body.position.clone());
  }

  /**
   * Get the ball's current position
   * @returns {THREE.Vector3} The current position
   */
  getPosition() {
    if (this.body) {
      return new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    }
    return this.position.clone();
  }
}
