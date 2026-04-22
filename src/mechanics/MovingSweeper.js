import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';
import { HAZARD_COLORS } from '../themes/palette';

/**
 * MovingSweeper - A rotating arm that sweeps across the playing field.
 *
 * Config:
 *   pivot: Vector3 - Center point of rotation
 *   armLength: number - Length of the sweeper arm
 *   speed: number - Rotation speed in radians per second (positive = CCW)
 *   size: { width, height, depth } - Arm dimensions
 *   phase: number (optional) - Initial rotation angle in radians (default 0)
 *   color: number (optional) - Arm color (default 0xff4444)
 *
 * The arm rotates around the pivot point at the given speed.
 * Uses a KINEMATIC body so Cannon-es handles ball collisions automatically.
 */
class MovingSweeper extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);

    this.pivot = config.pivot || new THREE.Vector3(0, 0, 0);
    this.armLength = config.armLength || 3;
    this.speed = config.speed || 1.5;
    this.initialAngle = config.phase || 0;
    this.elapsedTime = 0;
    this.angle = this.initialAngle;

    const armWidth = config.size?.width || this.armLength;
    const armHeight = config.size?.height || 0.4;
    const armDepth = config.size?.depth || 0.3;
    const color = config.color || theme?.mechanics?.movingSweeper?.color || HAZARD_COLORS.blocker;

    // Visual mesh
    const geometry = new THREE.BoxGeometry(armWidth, armHeight, armDepth);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.6,
      emissive: HAZARD_COLORS.blocker,
      emissiveIntensity: 0.2
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;

    const armY = surfaceHeight + armHeight / 2;
    group.add(this.mesh);
    this.meshes.push(this.mesh);

    // Physics body (KINEMATIC — positioned at arm center, updated each frame)
    this.body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: world.bumperMaterial
    });
    const halfExtents = new CANNON.Vec3(armWidth / 2, armHeight / 2, armDepth / 2);
    const halfLength = this.armLength / 2;
    this.body.addShape(new CANNON.Box(halfExtents));
    // Place body at initial arm center (pivot + rotated halfLength offset)
    const initCx = this.pivot.x + Math.cos(this.initialAngle) * halfLength;
    const initCz = this.pivot.z + Math.sin(this.initialAngle) * halfLength;
    this.body.position.set(initCx, armY, initCz);
    // Rotate body to match initial phase angle
    const initQuat = new CANNON.Quaternion();
    initQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -this.initialAngle);
    this.body.quaternion.copy(initQuat);
    this.body.userData = { type: 'moving_sweeper' };
    this.body.addEventListener('collide', _event => {
      if (this.audioManager) {
        this.audioManager.playSound('sweeperHit');
      }
    });
    world.addBody(this.body);
    this.bodies.push(this.body);
    // Initialise mesh at arm center to match body
    this.mesh.position.set(initCx, armY, initCz);
    this.mesh.rotation.y = -this.initialAngle;

    // Pivot post visual (cylinder at pivot point)
    const postGeometry = new THREE.CylinderGeometry(0.15, 0.15, armHeight + 0.2, 8);
    const postColor = theme?.mechanics?.movingSweeper?.postColor || 0x888888;
    const postMaterial = new THREE.MeshStandardMaterial({ color: postColor, metalness: 0.7 });
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(this.pivot.x, armY, this.pivot.z);
    group.add(post);
    this.meshes.push(post);
  }

  onDtSpike() {
    // Recalculate elapsedTime from current angle to maintain position continuity.
    // On the next update(), the angle will be recomputed from elapsedTime,
    // advancing smoothly from wherever the sweeper currently is.
    this.elapsedTime = (this.angle - this.initialAngle) / this.speed;
  }

  update(dt, _ballBody) {
    this.elapsedTime += dt;
    this.angle = this.initialAngle + this.speed * this.elapsedTime;

    // Keep body quaternion in sync so collision geometry matches visual angle
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -this.angle);
    this.body.quaternion.copy(quat);

    // Derive arm-center position from angle and move body there
    const halfLength = this.armLength / 2;
    const cx = this.pivot.x + Math.cos(this.angle) * halfLength;
    const cz = this.pivot.z + Math.sin(this.angle) * halfLength;
    const y = this.body.position.y;

    this.body.position.set(cx, y, cz);
    this.mesh.position.set(cx, y, cz);
    this.mesh.rotation.y = -this.angle;
  }
}

registerMechanic(
  'moving_sweeper',
  (world, group, config, sh, theme) => new MovingSweeper(world, group, config, sh, theme)
);

export { MovingSweeper };
