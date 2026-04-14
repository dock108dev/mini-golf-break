import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * GravityFunnel - Directional gravity pull that redirects the ball toward an exit point.
 *
 * Unlike SuctionZone (hazard vortex), GravityFunnel is a navigable puzzle element.
 * A player must enter at the right angle to exit at the desired point.
 *
 * Config:
 *   position: [x, y, z] - Center of the funnel zone
 *   radius: number - Zone radius
 *   exitPoint: [x, y, z] - Target exit direction point
 *   force: number - Lateral pull strength (default 2.0)
 *   funnelAngle: number - Visual cone angle in degrees (default 30)
 *   color: number - Hex color for visual (default 0x4488ff)
 */
class GravityFunnel extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);
    this.isForceField = true;

    if (!config.position) {
      throw new Error('GravityFunnel: missing required config field "position"');
    }
    if (!config.exitPoint) {
      throw new Error('GravityFunnel: missing required config field "exitPoint"');
    }

    const pos = config.position;
    this.centerX = pos[0] !== undefined ? pos[0] : pos.x || 0;
    this.centerZ = pos[2] !== undefined ? pos[2] : pos.z || 0;
    this.radius = config.radius || 3;
    this.force = config.force !== undefined ? config.force : 2.0;

    const exit = config.exitPoint;
    const exitX = exit[0] !== undefined ? exit[0] : exit.x || 0;
    const exitZ = exit[2] !== undefined ? exit[2] : exit.z || 0;

    // Compute normalized exit direction on the ground plane (from center to exitPoint)
    const dirX = exitX - this.centerX;
    const dirZ = exitZ - this.centerZ;
    const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (dirLen > 0.001) {
      this.exitDirX = dirX / dirLen;
      this.exitDirZ = dirZ / dirLen;
    } else {
      this.exitDirX = 0;
      this.exitDirZ = -1;
    }

    const color = config.color || theme?.mechanics?.gravityFunnel?.color || 0x4488ff;
    const funnelAngle = config.funnelAngle || 30;

    this._createVisuals(group, surfaceHeight, color, funnelAngle);
  }

  _createVisuals(group, surfaceHeight, color, funnelAngle) {
    // Glowing ring showing the funnel zone
    const ringGeometry = new THREE.RingGeometry(this.radius * 0.85, this.radius, 48);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    this.ringMesh.rotation.x = -Math.PI / 2;
    this.ringMesh.position.set(this.centerX, surfaceHeight + 0.003, this.centerZ);
    group.add(this.ringMesh);
    this.meshes.push(this.ringMesh);

    // Inner disc with lower opacity to show the zone area
    const discGeometry = new THREE.CircleGeometry(this.radius * 0.85, 48);
    const discMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    });
    this.discMesh = new THREE.Mesh(discGeometry, discMaterial);
    this.discMesh.rotation.x = -Math.PI / 2;
    this.discMesh.position.set(this.centerX, surfaceHeight + 0.002, this.centerZ);
    group.add(this.discMesh);
    this.meshes.push(this.discMesh);

    // Arrow indicating exit direction
    const arrowLen = this.radius * 0.6;
    const arrowWidth = arrowLen * Math.tan((funnelAngle * Math.PI) / 180 / 2);
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, arrowLen / 2);
    arrowShape.lineTo(-arrowWidth, -arrowLen / 2);
    arrowShape.lineTo(arrowWidth, -arrowLen / 2);
    arrowShape.closePath();

    const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
    const arrowMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    this.arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
    this.arrowMesh.rotation.x = -Math.PI / 2;
    // Rotate arrow to point in exit direction (atan2 on XZ plane, mapped to XY after rotation)
    this.arrowMesh.rotation.z = -Math.atan2(this.exitDirX, this.exitDirZ);
    this.arrowMesh.position.set(this.centerX, surfaceHeight + 0.004, this.centerZ);
    group.add(this.arrowMesh);
    this.meshes.push(this.arrowMesh);
  }

  update(_dt, ballBody) {
    if (!ballBody) {
      return;
    }

    const dx = ballBody.position.x - this.centerX;
    const dz = ballBody.position.z - this.centerZ;
    const distSq = dx * dx + dz * dz;

    if (distSq > this.radius * this.radius) {
      return;
    }

    // Wake sleeping balls — funnel should redirect a resting ball
    if (ballBody.sleepState === CANNON.Body.SLEEPING) {
      ballBody.wakeUp();
    }

    // Project the ball's current velocity onto the exit direction
    const velDotExit = ballBody.velocity.x * this.exitDirX + ballBody.velocity.z * this.exitDirZ;

    // Compute the lateral component (perpendicular to exit direction)
    const lateralX = ballBody.velocity.x - velDotExit * this.exitDirX;
    const lateralZ = ballBody.velocity.z - velDotExit * this.exitDirZ;

    // The corrective force points from the lateral component toward zero
    // (i.e., it steers the ball so its velocity aligns with exit direction)
    // Force = -lateral_direction * force_strength, scaled by distance from edge
    const dist = Math.sqrt(distSq);
    const influence = 1 - dist / this.radius;

    // Also add a component in the exit direction to gently push toward exit
    const lateralLen = Math.sqrt(lateralX * lateralX + lateralZ * lateralZ);
    const forceX =
      -lateralX * this.force * influence + this.exitDirX * this.force * influence * 0.3;
    const forceZ =
      -lateralZ * this.force * influence + this.exitDirZ * this.force * influence * 0.3;

    // Only apply lateral force — no vertical component
    if (Math.abs(forceX) > 0.001 || Math.abs(forceZ) > 0.001 || lateralLen > 0.001) {
      ballBody.applyForce(new CANNON.Vec3(forceX, 0, forceZ));
    }
  }
}

registerMechanic(
  'gravity_funnel',
  (world, group, config, sh, theme) => new GravityFunnel(world, group, config, sh, theme)
);

export { GravityFunnel };
