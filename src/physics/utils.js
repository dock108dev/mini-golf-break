import { debug } from '../utils/debug';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';

/**
 * Calculates the angle between the ball's velocity vector and the vector from the ball to the hole center.
 * This helps determine if the ball is hitting the hole head-on or glancingly.
 *
 * @param {CANNON.Vec3} ballVelocity - The current velocity vector of the ball.
 * @param {CANNON.Vec3} holePosition - The world position of the center of the hole trigger.
 * @param {CANNON.Vec3} ballPosition - The current world position of the center of the ball.
 * @returns {number} The angle in degrees (0-180). Returns 0 if velocity is zero or vectors are aligned oppositely, 180 if aligned perfectly.
 */
export function calculateImpactAngle(ballVelocity, holePosition, ballPosition) {
  // Vector from ball to hole (horizontal plane)
  const ballToHole = new CANNON.Vec3(
    holePosition.x - ballPosition.x,
    0, // Ignore vertical component for angle calculation
    holePosition.z - ballPosition.z
  );

  const velHorizontal = new CANNON.Vec3(ballVelocity.x, 0, ballVelocity.z);

  const ballToHoleLen = ballToHole.length();
  const velLen = velHorizontal.length();

  // Handle edge cases: ball exactly at hole center or zero velocity
  if (ballToHoleLen === 0 || velLen === 0) {
    // If velocity is zero or ball is at center, angle is irrelevant or undefined.
    // Treat as a direct hit (0 degrees) or handle as needed.
    // Returning 180 might be safer if zero velocity means it should drop in.
    // Let's return 180 assuming zero velocity = direct drop angle.
    return 180;
  }

  // Calculate dot product (only horizontal components)
  const dotProduct = velHorizontal.dot(ballToHole);

  // Calculate angle using dot product formula: angle = acos( (v1 . v2) / (|v1| * |v2|) )
  let angleRad = Math.acos(dotProduct / (velLen * ballToHoleLen));

  // Clamp value to handle potential floating point inaccuracies
  angleRad = Math.max(0, Math.min(Math.PI, angleRad));

  // Convert radians to degrees
  const angleDeg = angleRad * (180 / Math.PI);

  // Angle should represent how directly the ball heads towards the hole.
  // 0 degrees = moving directly away, 180 degrees = moving directly towards.
  return angleDeg;
}

/**
 * Determines if a lip-out should occur based on ball speed and impact angle.
 *
 * @param {number} speed - The magnitude of the ball's velocity.
 * @param {number} angleDeg - The impact angle in degrees (calculated by calculateImpactAngle).
 * @param {object} thresholds - Object containing threshold values.
 * @param {number} thresholds.LIP_OUT_SPEED_THRESHOLD - Speed above which lip-out becomes possible.
 * @param {number} thresholds.LIP_OUT_ANGLE_THRESHOLD - Angle (degrees, 0-180) below which a glancing blow occurs. 180 = direct hit.
 * @returns {boolean} True if a lip-out occurs, false otherwise.
 */
export function isLipOut(speed, angleDeg, thresholds) {
  // A lip-out is more likely if the speed is high AND the angle is glancing (low angle value).
  // Example: High speed + hitting the edge (angle < threshold) = lip out.
  // Example: High speed + direct hit (angle near 180) = might still go in (handled by checkHoleEntry).
  const isFast = speed > thresholds.LIP_OUT_SPEED_THRESHOLD;
  const isGlancing = angleDeg < thresholds.LIP_OUT_ANGLE_THRESHOLD;

  // Simple initial logic: lip out if both fast and glancing
  if (isFast && isGlancing) {
    debug.log(
      `[PhysicsUtils] Lip Out: Fast (${speed.toFixed(2)} > ${thresholds.LIP_OUT_SPEED_THRESHOLD}) and Glancing (${angleDeg.toFixed(1)} < ${thresholds.LIP_OUT_ANGLE_THRESHOLD})`
    );
    return true;
  }

  // Consider adding more nuanced probability later if needed

  return false;
}

/**
 * Checks if the ball should enter the hole based on proximity, speed, and angle.
 *
 * @param {CANNON.Body} ballBody - The physics body of the ball.
 * @param {CANNON.Body} holeTriggerBody - The physics body of the hole trigger volume.
 * @param {object} thresholds - Object containing threshold values.
 * @param {number} thresholds.MAX_SAFE_SPEED - Speed below which the ball enters safely.
 * @param {number} thresholds.LIP_OUT_SPEED_THRESHOLD - Speed threshold for lip-out calculation.
 * @param {number} thresholds.LIP_OUT_ANGLE_THRESHOLD - Angle threshold for lip-out calculation.
 * @returns {boolean} True if the ball should enter the hole, false otherwise.
 */
export function checkHoleEntry(ballBody, holeTriggerBody, thresholds) {
  if (!ballBody || !holeTriggerBody || !holeTriggerBody.shapes[0]) {
    console.error('[PhysicsUtils.checkHoleEntry] Missing ballBody or holeTriggerBody/shape.');
    return false;
  }

  const ballPosition = ballBody.position;
  const ballVelocity = ballBody.velocity;
  const holePosition = holeTriggerBody.position;
  // Access radiusTop for Cylinder shape
  const holeRadius = holeTriggerBody.shapes[0].radiusTop;

  // --- 1. Proximity Check ---
  const dx = ballPosition.x - holePosition.x;
  const dz = ballPosition.z - holePosition.z;
  const distanceFromHoleCenter = Math.sqrt(dx * dx + dz * dz);

  // Log positions being used
  debug.log(
    `[PhysicsUtils.checkHoleEntry] Positions: Ball=(${ballPosition.x.toFixed(2)},${ballPosition.z.toFixed(2)}), Hole=(${holePosition.x.toFixed(2)},${holePosition.z.toFixed(2)})`
  );

  // Log proximity values
  debug.log(
    `[PhysicsUtils.checkHoleEntry] Proximity Check: Distance=${distanceFromHoleCenter.toFixed(3)}, Radius=${holeRadius.toFixed(3)}`
  );

  if (distanceFromHoleCenter <= holeRadius) {
    // --- 2. Speed Check ---
    const ballSpeed = ballVelocity.length();
    // Log speed values
    debug.log(
      `[PhysicsUtils.checkHoleEntry] Speed Check: Speed=${ballSpeed.toFixed(3)}, MAX_SAFE_SPEED=${thresholds.MAX_SAFE_SPEED.toFixed(3)}`
    );

    if (ballSpeed <= thresholds.MAX_SAFE_SPEED) {
      debug.log('[PhysicsUtils.checkHoleEntry] Result: Safe Entry (Slow)');
      return true;
    }

    // --- 3. Lip-Out Check (for faster balls) ---
    const angleDeg = calculateImpactAngle(ballVelocity, holePosition, ballPosition);
    // Log lip-out check values
    debug.log(
      `[PhysicsUtils.checkHoleEntry] Lip-Out Check: Speed=${ballSpeed.toFixed(3)}, Angle=${angleDeg.toFixed(1)}, SpeedThreshold=${thresholds.LIP_OUT_SPEED_THRESHOLD.toFixed(3)}, AngleThreshold=${thresholds.LIP_OUT_ANGLE_THRESHOLD.toFixed(1)}`
    );

    if (isLipOut(ballSpeed, angleDeg, thresholds)) {
      debug.log('[PhysicsUtils.checkHoleEntry] Result: Lip-Out');
      return false; // Lip-out occurred
    }

    debug.log('[PhysicsUtils.checkHoleEntry] Result: Fast but Direct Entry');
    return true;
  }

  // Ball is not within the hole trigger radius
  debug.log('[PhysicsUtils.checkHoleEntry] Result: Missed (Outside Radius)');
  return false;
}

/**
 * Convert THREE.Vector3 to CANNON.Vec3
 * @param {THREE.Vector3} threeVector - Three.js vector
 * @returns {CANNON.Vec3} Cannon vector
 */
export function threeToCannonVec3(threeVector) {
  return new CANNON.Vec3(threeVector.x, threeVector.y, threeVector.z);
}

/**
 * Convert CANNON.Vec3 to THREE.Vector3
 * @param {CANNON.Vec3} cannonVector - Cannon vector
 * @returns {THREE.Vector3} Three.js vector
 */
export function cannonToThreeVec3(cannonVector) {
  return new THREE.Vector3(cannonVector.x, cannonVector.y, cannonVector.z);
}

/**
 * Convert THREE.Quaternion to CANNON.Quaternion
 * @param {THREE.Quaternion} threeQuat - Three.js quaternion
 * @returns {CANNON.Quaternion} Cannon quaternion
 */
export function threeToCannonQuaternion(threeQuat) {
  return new CANNON.Quaternion(threeQuat.x, threeQuat.y, threeQuat.z, threeQuat.w);
}

/**
 * Convert CANNON.Quaternion to THREE.Quaternion
 * @param {CANNON.Quaternion} cannonQuat - Cannon quaternion
 * @returns {THREE.Quaternion} Three.js quaternion
 */
export function cannonToThreeQuaternion(cannonQuat) {
  return new THREE.Quaternion(cannonQuat.x, cannonQuat.y, cannonQuat.z, cannonQuat.w);
}

/**
 * Calculate velocity magnitude
 * @param {CANNON.Vec3|Object} velocity - Velocity vector
 * @returns {number} Magnitude
 */
export function calculateVelocityMagnitude(velocity) {
  return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
}

/**
 * Check if a physics body is at rest
 * @param {CANNON.Body} body - Physics body
 * @param {number} [threshold=0.1] - Velocity threshold
 * @returns {boolean} True if body is at rest
 */
export function isBodyAtRest(body, threshold = 0.1) {
  const velocityMagnitude = calculateVelocityMagnitude(body.velocity);
  const angularVelocityMagnitude = calculateVelocityMagnitude(body.angularVelocity);

  return velocityMagnitude < threshold && angularVelocityMagnitude < threshold;
}

/**
 * Apply impulse to a physics body
 * @param {CANNON.Body} body - Physics body
 * @param {CANNON.Vec3} impulse - Impulse vector
 * @param {CANNON.Vec3} [worldPoint] - Point of application (optional)
 */
export function applyImpulse(body, impulse, worldPoint) {
  if (worldPoint) {
    body.applyImpulse(impulse, worldPoint);
  } else {
    body.applyImpulse(impulse, body.position);
  }
}

/**
 * Create a physics body with common options
 * @param {Object} options - Body options
 * @returns {CANNON.Body} Physics body
 */
export function createPhysicsBody(options) {
  let shape;

  if (options.type === 'sphere') {
    shape = new CANNON.Sphere(options.radius || 1);
  } else if (options.type === 'box') {
    const size = options.size || new CANNON.Vec3(1, 1, 1);
    shape = new CANNON.Box(size);
  }

  const body = new CANNON.Body({
    mass: options.mass || 0,
    shape
  });

  if (options.position) {
    body.position.copy(options.position);
  }

  if (options.quaternion) {
    body.quaternion.copy(options.quaternion);
  }

  return body;
}
