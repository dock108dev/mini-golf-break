import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';
import { EventTypes } from '../events/EventTypes';

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
 *   gracePeriod: number (optional) - Seconds gate stays forced-open after spawn (default 0)
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
    this._depth = depth; // stored for velocity-servo speed cap
    const color = config.color || theme?.mechanics?.timedGate?.color || 0x4488cc;

    const baseY = (config.baseElevation || 0) + surfaceHeight;
    this.closedY = baseY + height / 2;
    this.openY = baseY - height;

    // Emissive lerp state: 0 = closed (red), 1 = open (green)
    this._emissiveT = 0;

    // Grace period: gate stays forced-open for this many seconds after spawn
    this._gracePeriod = config.gracePeriod || 0;
    this._graceTimer = 0;

    // Visual mesh — starts with red emissive (closed state)
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.7,
      emissive: new THREE.Color(0xff0000),
      emissiveIntensity: 0.4
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
    this._graceTimer = 0;
    this.isOpen = false;
    this._emissiveT = 0;
    // Snap gate to closed position immediately (no lerp)
    this.mesh.position.y = this.closedY;
    this.body.position.y = this.closedY;
    this.body.velocity.set(0, 0, 0);
    if (this.mesh.material.emissive?.setRGB) {
      this.mesh.material.emissive.setRGB(1, 0, 0);
    }
  }

  update(dt, _ballBody) {
    this._graceTimer += dt;
    const inGrace = this._gracePeriod > 0 && this._graceTimer < this._gracePeriod;

    let shouldBeOpen;
    if (inGrace) {
      shouldBeOpen = true;
    } else {
      this.timer += dt;
      const cycleDuration = this.openDuration + this.closedDuration;
      const cyclePos = this.timer % cycleDuration;
      shouldBeOpen = cyclePos < this.openDuration;
    }

    if (shouldBeOpen !== this.isOpen) {
      this.isOpen = shouldBeOpen;
      if (this.audioManager) {
        this.audioManager.playSound(this.isOpen ? 'gateOpen' : 'gateClose');
      }
      if (this.eventManager?.publish) {
        this.eventManager.publish(EventTypes.GATE_STATE_CHANGED, { isOpen: this.isOpen });
      }
    }

    // Velocity-servo: set body velocity toward target — prevents tunneling vs. teleporting
    const fixedDt = 1 / 60;
    const maxSpeed = this._depth / fixedDt; // anti-tunneling cap (depth / fixedDt)
    const targetY = this.isOpen ? this.openY : this.closedY;
    const currentY = this.mesh.position.y;
    const rawVy = dt > 0 ? (targetY - currentY) / dt : 0;
    const vy = Math.max(-maxSpeed, Math.min(maxSpeed, rawVy));
    this.body.velocity.set(0, vy, 0);

    // Advance mesh and body position (manual integration mirrors physics-step result)
    const newY = currentY + vy * dt;
    this.mesh.position.y = newY;
    this.body.position.y = newY;

    // Emissive color lerp: closed = red (0), open = green (1), 0.2 s transition
    const emissiveTarget = this.isOpen ? 1 : 0;
    this._emissiveT += (emissiveTarget - this._emissiveT) * Math.min(1, 5 * dt);
    if (this.mesh.material.emissive?.setRGB) {
      this.mesh.material.emissive.setRGB(1 - this._emissiveT, this._emissiveT, 0);
    }
  }
}

registerMechanic(
  'timed_gate',
  (world, group, config, sh, theme) => new TimedGate(world, group, config, sh, theme)
);

export { TimedGate };
