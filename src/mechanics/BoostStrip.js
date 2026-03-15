import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * BoostStrip - Applies a directional force to the ball when it rolls over the strip.
 *
 * Config:
 *   position: Vector3 - Center of the boost strip
 *   direction: Vector3 - Normalized direction of the boost force
 *   force: number - Force magnitude applied per frame
 *   size: { width, length } - Strip dimensions (width across, length along direction)
 *   color: number (optional) - Strip color (default 0x00ffaa)
 */
class BoostStrip extends MechanicBase {
  constructor(world, group, config, surfaceHeight) {
    super(world, group, config, surfaceHeight);

    const pos = config.position || new THREE.Vector3(0, 0, 0);
    const dir = config.direction || new THREE.Vector3(0, 0, -1);
    this.direction = new CANNON.Vec3(dir.x, 0, dir.z).scale(config.force || 8);
    this.radius = Math.max(config.size?.width || 1.5, config.size?.length || 3) / 2;

    const width = config.size?.width || 1.5;
    const length = config.size?.length || 3;
    const color = config.color || 0x00ffaa;

    // Visual: glowing strip on the surface
    const geometry = new THREE.PlaneGeometry(width, length);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.6,
      roughness: 0.2
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(pos.x, surfaceHeight + 0.005, pos.z);

    // Rotate strip to align with direction
    const angle = Math.atan2(dir.x, dir.z);
    this.mesh.rotation.z = angle;

    group.add(this.mesh);
    this.meshes.push(this.mesh);

    // Trigger body (invisible, detects ball overlap)
    this.triggerBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      isTrigger: true
    });
    const halfExtents = new CANNON.Vec3(width / 2, 0.1, length / 2);
    this.triggerBody.addShape(new CANNON.Box(halfExtents));
    this.triggerBody.position.set(pos.x, surfaceHeight, pos.z);
    this.triggerBody.userData = { type: 'boost_strip' };
    world.addBody(this.triggerBody);
    this.bodies.push(this.triggerBody);

    this.triggerPos = pos;
  }

  update(_dt, ballBody) {
    if (!ballBody || ballBody.sleepState === CANNON.Body.SLEEPING) {
      return;
    }

    // Check if ball is over the strip
    if (this.isBallInZone(ballBody, this.triggerBody, this.radius)) {
      ballBody.applyForce(this.direction);
    }
  }
}

registerMechanic('boost_strip', (world, group, config, sh) => new BoostStrip(world, group, config, sh));

export { BoostStrip };
