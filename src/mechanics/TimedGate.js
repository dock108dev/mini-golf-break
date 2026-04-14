import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * TimedGate - A wall/panel that raises and lowers on a timer.
 * When closed, blocks the ball. When open, allows passage.
 *
 * Config:
 *   position: Vector3 - Gate center position
 *   size: { width, height, depth } - Gate dimensions
 *   openDuration: number - Seconds the gate is open
 *   closedDuration: number - Seconds the gate is closed
 *   phase: number (optional) - Initial timer offset
 *   color: number (optional) - Gate color (default 0x4488cc)
 */
class TimedGate extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);

    const pos = config.position || new THREE.Vector3(0, 0, 0);
    this.openDuration = config.openDuration || 2;
    this.closedDuration = config.closedDuration || 3;
    this.timer = config.phase || 0;
    this.isOpen = false;

    const width = config.size?.width || 2;
    const height = config.size?.height || 1;
    const depth = config.size?.depth || 0.2;
    const color = config.color || theme?.mechanics?.timedGate?.color || 0x4488cc;

    const baseY = (config.baseElevation || 0) + surfaceHeight;
    this.closedY = baseY + height / 2;
    this.openY = baseY - height;

    // Visual mesh
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.7,
      emissive: color,
      emissiveIntensity: 0.1
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(pos.x, this.closedY, pos.z);
    this.mesh.castShadow = true;
    group.add(this.mesh);
    this.meshes.push(this.mesh);

    // Physics body (KINEMATIC — position controlled programmatically)
    this.body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: world.bumperMaterial
    });
    const halfExtents = new CANNON.Vec3(width / 2, height / 2, depth / 2);
    this.body.addShape(new CANNON.Box(halfExtents));
    this.body.position.set(pos.x, this.closedY, pos.z);
    this.body.userData = { type: 'timed_gate' };
    world.addBody(this.body);
    this.bodies.push(this.body);
  }

  onDtSpike() {
    this.timer = 0;
    this.isOpen = false;
    // Snap gate to closed position immediately (no lerp)
    this.mesh.position.y = this.closedY;
    this.body.position.y = this.closedY;
  }

  update(dt, _ballBody) {
    this.timer += dt;
    const cycleDuration = this.openDuration + this.closedDuration;
    const cyclePos = this.timer % cycleDuration;

    const shouldBeOpen = cyclePos < this.openDuration;

    if (shouldBeOpen !== this.isOpen) {
      this.isOpen = shouldBeOpen;
      if (this.audioManager) {
        this.audioManager.playSound(this.isOpen ? 'gateOpen' : 'gateClose');
      }
    }

    // Smoothly interpolate gate position
    const targetY = this.isOpen ? this.openY : this.closedY;
    const currentY = this.mesh.position.y;
    const lerpSpeed = 5; // Higher = faster transition
    const newY = currentY + (targetY - currentY) * Math.min(1, lerpSpeed * dt);

    this.mesh.position.y = newY;
    this.body.position.y = newY;
  }
}

registerMechanic(
  'timed_gate',
  (world, group, config, sh, theme) => new TimedGate(world, group, config, sh, theme)
);

export { TimedGate };
