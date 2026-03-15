import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * BowlContour - Simulates a bowl/crater depression via radial inward force.
 * Ball rolls toward the center when inside the zone, simulating gravity on a curved surface.
 *
 * Config:
 *   position: Vector3 - Center of the bowl
 *   radius: number - Radius of the bowl
 *   force: number - Inward pull strength (higher = steeper bowl)
 *   color: number (optional) - Visual tint (default 0x887744)
 */
class BowlContour extends MechanicBase {
  constructor(world, group, config, surfaceHeight) {
    super(world, group, config, surfaceHeight);

    const pos = config.position || new THREE.Vector3(0, 0, 0);
    this.centerX = pos.x;
    this.centerZ = pos.z;
    this.radius = config.radius || 4;
    this.force = config.force || 3;
    const color = config.color || 0x887744;

    // Visual: subtle tinted disc showing the bowl area
    const geometry = new THREE.CircleGeometry(this.radius, 32);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(pos.x, surfaceHeight + 0.002, pos.z);
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

    // Force proportional to distance from center (steeper at edges)
    const dist = Math.sqrt(distSq);
    const strength = this.force * (dist / this.radius);
    const nx = dx / dist;
    const nz = dz / dist;

    ballBody.applyForce(new CANNON.Vec3(nx * strength, 0, nz * strength));
  }
}

registerMechanic('bowl_contour', (world, group, config, sh) => new BowlContour(world, group, config, sh));

export { BowlContour };
