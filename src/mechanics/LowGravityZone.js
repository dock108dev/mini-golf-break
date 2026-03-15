import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * LowGravityZone - Reduces effective gravity within a circular area.
 * Ball floats more and bounces farther when inside the zone.
 *
 * Config:
 *   position: Vector3 - Center of the zone
 *   radius: number - Radius of influence
 *   gravityMultiplier: number - How much gravity remains (0.3 = 30% gravity)
 *   color: number (optional) - Visual color (default 0x44aaff)
 */
class LowGravityZone extends MechanicBase {
  constructor(world, group, config, surfaceHeight) {
    super(world, group, config, surfaceHeight);

    const pos = config.position || new THREE.Vector3(0, 0, 0);
    this.centerX = pos.x;
    this.centerZ = pos.z;
    this.radius = config.radius || 2;
    // Counter-gravity force: apply upward force to cancel some gravity
    // Gravity is -9.81, so to keep 30% gravity we apply 70% upward counter
    const gravMult = config.gravityMultiplier ?? 0.3;
    this.counterForce = 9.81 * (1 - gravMult); // upward force per unit mass
    const color = config.color || 0x44aaff;

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

    const dx = ballBody.position.x - this.centerX;
    const dz = ballBody.position.z - this.centerZ;

    if (dx * dx + dz * dz > this.radius * this.radius) {
      return;
    }

    // Apply upward counter-gravity force (F = m * counterAcceleration)
    const upForce = ballBody.mass * this.counterForce;
    ballBody.applyForce(new CANNON.Vec3(0, upForce, 0));
  }
}

registerMechanic('low_gravity_zone', (world, group, config, sh) => new LowGravityZone(world, group, config, sh));

export { LowGravityZone };
