import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * SuctionZone - Radial pull toward a center point (black hole effect).
 *
 * Config:
 *   position: Vector3 - Center of the suction zone
 *   radius: number - Radius of influence
 *   force: number - Pull force magnitude
 *   color: number (optional) - Visual color (default 0x6600cc)
 */
class SuctionZone extends MechanicBase {
  constructor(world, group, config, surfaceHeight) {
    super(world, group, config, surfaceHeight);

    const pos = config.position || new THREE.Vector3(0, 0, 0);
    this.centerX = pos.x;
    this.centerZ = pos.z;
    this.radius = config.radius || 3;
    this.force = config.force || 6;
    const color = config.color || 0x6600cc;

    // Visual: semi-transparent disc
    const geometry = new THREE.CircleGeometry(this.radius, 32);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(pos.x, surfaceHeight + 0.003, pos.z);
    group.add(this.mesh);
    this.meshes.push(this.mesh);
  }

  update(_dt, ballBody) {
    if (!ballBody || ballBody.sleepState === CANNON.Body.SLEEPING) {
      return;
    }

    const dx = this.centerX - ballBody.position.x;
    const dz = this.centerZ - ballBody.position.z;
    const distSq = dx * dx + dz * dz;

    if (distSq > this.radius * this.radius || distSq < 0.01) {
      return;
    }

    // Force increases as ball gets closer (inverse distance)
    const dist = Math.sqrt(distSq);
    const strength = this.force * (1 - dist / this.radius);
    const nx = dx / dist;
    const nz = dz / dist;

    ballBody.applyForce(new CANNON.Vec3(nx * strength, 0, nz * strength));
  }
}

registerMechanic('suction_zone', (world, group, config, sh) => new SuctionZone(world, group, config, sh));

export { SuctionZone };
