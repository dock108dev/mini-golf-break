import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

const GRAVITY_CONSTANT = 9.82;

/**
 * LowGravityZone - Reduces effective gravity within a spherical region.
 * Each tick while the ball is within `radius` of `position`, applies an
 * upward force of `(1 - gravity_fraction) * mass * 9.82` N so the ball
 * experiences only `gravity_fraction * 9.82 m/s²` downward acceleration.
 *
 * Config:
 *   position: Vector3 - Center of the sphere
 *   radius: number - Radius of influence (> 0)
 *   gravity_fraction: number - Fraction of normal gravity inside zone (0, 1]; default 0.25
 *   color: number (optional) - Visual color (default 0x44aaff)
 */
class LowGravityZone extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);
    this.isForceField = true;

    const pos = config.position || new THREE.Vector3(0, 0, 0);
    this.centerX = pos.x;
    this.centerY = pos.y !== undefined ? pos.y : surfaceHeight;
    this.centerZ = pos.z;
    this.radius = config.radius || 2;
    // Upward counter-acceleration per unit mass to leave only gravity_fraction of gravity
    const gravFraction = config.gravity_fraction ?? 0.25;
    this.counterForce = GRAVITY_CONSTANT * (1 - gravFraction);
    const color = config.color || theme?.mechanics?.lowGravityZone?.color || 0x44aaff;

    // Visual: semi-transparent disc with emissive glow
    const geometry = new THREE.CircleGeometry(this.radius, 32);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(pos.x, surfaceHeight + 0.004, pos.z);
    group.add(this.mesh);
    this.meshes.push(this.mesh);
  }

  update(_dt, ballBody) {
    if (!ballBody || ballBody.sleepState === CANNON.Body.SLEEPING) {
      return;
    }

    // Spherical distance check — zone is a 3D sphere, not a flat disc
    const dx = ballBody.position.x - this.centerX;
    const dy = ballBody.position.y - this.centerY;
    const dz = ballBody.position.z - this.centerZ;

    if (dx * dx + dy * dy + dz * dz > this.radius * this.radius) {
      return;
    }

    // Apply upward counter-gravity force: F = m * (1 - gravity_fraction) * 9.82
    const upForce = ballBody.mass * this.counterForce;
    ballBody.applyForce(new CANNON.Vec3(0, upForce, 0));
  }
}

registerMechanic(
  'low_gravity_zone',
  (world, group, config, sh, theme) => new LowGravityZone(world, group, config, sh, theme)
);

export { LowGravityZone };
