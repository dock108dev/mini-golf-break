import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';
import { HAZARD_COLORS } from '../themes/palette';

const ROTATION_SPEED = 0.5; // rad/s, Y-axis rotation per spec

/**
 * SuctionZone - Radial pull toward a center point (black hole effect).
 *
 * Config:
 *   position: Vector3 - Center of the suction zone
 *   radius: number - Radius of influence (> 0)
 *   force: number - Pull force magnitude (> 0); applied as force * ball.mass each tick
 *   color: number (optional) - Visual torus color (default reward #aaff44)
 */
class SuctionZone extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);
    this.isForceField = true;

    const pos = config.position || new THREE.Vector3(0, 0, 0);
    this.centerX = pos.x;
    this.centerZ = pos.z;
    this.radius = config.radius ?? 3;
    this.force = config.force ?? 6;

    if (this.radius <= 0) {
      console.warn('[SuctionZone] outer_radius must be > 0');
    }
    if (this.force <= 0) {
      console.warn('[SuctionZone] suction_force must be > 0');
    }

    const color = config.color || theme?.mechanics?.suctionZone?.color || HAZARD_COLORS.reward;

    // Torus ring at zone boundary — reward-color emissive, slow Y-axis rotation
    const geometry = new THREE.TorusGeometry(this.radius, 0.08, 16, 64);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.9
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(pos.x, surfaceHeight + 0.01, pos.z);
    group.add(this.mesh);
    this.meshes.push(this.mesh);
  }

  update(dt, ballBody) {
    // Rotate torus ring at 0.5 rad/s around Y-axis
    if (this.mesh) {
      this.mesh.rotation.y += ROTATION_SPEED * dt;
    }

    if (!ballBody) {
      return;
    }

    const dx = this.centerX - ballBody.position.x;
    const dz = this.centerZ - ballBody.position.z;
    const distSq = dx * dx + dz * dz;

    if (distSq > this.radius * this.radius || distSq < 0.01) {
      return;
    }

    // Wake sleeping balls — suction should pull a resting ball toward center
    if (ballBody.sleepState === CANNON.Body.SLEEPING) {
      ballBody.wakeUp();
    }

    // Constant force toward center: suction_force * mass (not distance-scaled)
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const nz = dz / dist;
    const magnitude = this.force * ballBody.mass;

    ballBody.applyForce(new CANNON.Vec3(nx * magnitude, 0, nz * magnitude));
  }
}

registerMechanic(
  'suction_zone',
  (world, group, config, sh, theme) => new SuctionZone(world, group, config, sh, theme)
);

export { SuctionZone };
