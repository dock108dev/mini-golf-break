import * as CANNON from 'cannon-es';

/**
 * Safely resets a CANNON.Body's velocity and angular velocity to zero.
 */
export function resetBodyVelocity(body) {
  if (!body) {return;}
  const zero = (vec) => {
    if (vec?.set) { vec.set(0, 0, 0); }
    else if (vec) { vec.x = 0; vec.y = 0; vec.z = 0; }
  };
  zero(body.velocity);
  zero(body.angularVelocity);
  zero(body.force);
  zero(body.torque);
  if (body.wakeUp) {body.wakeUp();}
}

/**
 * Checks if a ball body is inside any bunker trigger zone.
 * @returns {boolean} Whether the ball is currently in a bunker
 */
export function checkBunkerOverlap(ballBody, bunkerTriggers, ballRadius) {
  for (const trigger of bunkerTriggers) {
    if (!trigger?.shapes?.length) {continue;}
    const shape = trigger.shapes[0];
    const triggerPos = trigger.position;
    const ballPos = ballBody.position;

    if (shape instanceof CANNON.Cylinder) {
      const dx = ballPos.x - triggerPos.x;
      const dz = ballPos.z - triggerPos.z;
      if (dx * dx + dz * dz <= shape.radiusTop * shape.radiusTop) {
        return true;
      }
    } else if (shape instanceof CANNON.Box) {
      const halfExtents = shape.halfExtents;
      const dx = Math.abs(ballPos.x - triggerPos.x);
      const dz = Math.abs(ballPos.z - triggerPos.z);
      const ballIsAbove = ballPos.y > triggerPos.y + halfExtents.y + ballRadius * 2;
      const ballIsBelow = ballPos.y < triggerPos.y - halfExtents.y - ballRadius * 2;
      if (dx <= halfExtents.x && dz <= halfExtents.z && !ballIsAbove && !ballIsBelow) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if a ball body overlaps any water hazard trigger zone.
 * @returns {object|null} The overlapping trigger or null
 */
export function checkWaterOverlap(ballBody, waterTriggers, ballRadius, overlapThreshold = 0.35) {
  const ballPos = ballBody.position;

  for (const trigger of waterTriggers) {
    if (!trigger.shapes.length) {continue;}
    const shape = trigger.shapes[0];
    const triggerPos = trigger.position;

    if (shape instanceof CANNON.Cylinder) {
      const dx = ballPos.x - triggerPos.x;
      const dz = ballPos.z - triggerPos.z;
      const distSq = dx * dx + dz * dz;
      const radius = shape.radiusTop;
      if (distSq < radius * radius) {
        const overlapDistance = radius - Math.sqrt(distSq);
        if (overlapDistance / (ballRadius * 2) >= overlapThreshold) {
          return trigger;
        }
      }
    } else if (shape instanceof CANNON.Box) {
      const halfExtents = shape.halfExtents;
      const dx = Math.abs(ballPos.x - triggerPos.x);
      const dz = Math.abs(ballPos.z - triggerPos.z);
      const effectiveHalfX = halfExtents.x + ballRadius * overlapThreshold;
      const effectiveHalfZ = halfExtents.z + ballRadius * overlapThreshold;
      if (dx < effectiveHalfX && dz < effectiveHalfZ) {
        return trigger;
      }
    }
  }
  return null;
}
