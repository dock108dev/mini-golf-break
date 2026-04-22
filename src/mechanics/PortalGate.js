import * as THREE from 'three';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

const PORTAL_COOLDOWN = 0.5;
const DEFAULT_RADIUS = 0.4;
const DEFAULT_PULSE_SPEED = 1.5; // Hz
const ENTRY_COLOR = 0x00aaff;
const EXIT_COLOR = 0xff6600;

/**
 * PortalGate - Two linked portals that teleport the ball.
 * On contact with the entry trigger radius the ball is moved to the exit
 * position. A 0.5 s cooldown prevents re-entry loops.
 *
 * Config: entryPosition: Vector3, exitPosition: Vector3, radius: number
 */
class PortalGate extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);

    const entryPos = config.entryPosition || new THREE.Vector3(-3, 0, 2);
    const exitPos = config.exitPosition || new THREE.Vector3(3, 0, -5);

    this.entryX = entryPos.x;
    this.entryZ = entryPos.z;
    this.exitX = exitPos.x;
    this.exitZ = exitPos.z;
    this.exitY = surfaceHeight + 0.3;
    this.radius = config.radius || DEFAULT_RADIUS;
    this.cooldown = 0;
    this._pulseTimer = 0;

    const entryColor = config.color || theme?.mechanics?.portalGate?.entryColor || ENTRY_COLOR;
    const exitColor = config.exitColor || theme?.mechanics?.portalGate?.exitColor || EXIT_COLOR;

    this._createPortalVisual(entryPos, entryColor, surfaceHeight, group);
    this._createPortalVisual(exitPos, exitColor, surfaceHeight, group);
  }

  _createPortalVisual(pos, color, surfaceHeight, group) {
    const ringGeom = new THREE.RingGeometry(this.radius * 0.7, this.radius, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, surfaceHeight + 0.01, pos.z);
    group.add(ring);
    this.meshes.push(ring);

    const discGeom = new THREE.CircleGeometry(this.radius * 0.7, 32);
    const discMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const disc = new THREE.Mesh(discGeom, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(pos.x, surfaceHeight + 0.008, pos.z);
    group.add(disc);
    this.meshes.push(disc);
  }

  onDtSpike() {
    this.cooldown = 0;
  }

  update(dt, ballBody) {
    if (!ballBody) {
      return;
    }

    // Animate portal pulse (slow emissive throb)
    this._pulseTimer += dt;
    const pulse = 0.4 + 0.3 * Math.sin(this._pulseTimer * Math.PI * 2 * DEFAULT_PULSE_SPEED);
    for (let i = 0; i < this.meshes.length; i++) {
      const mat = this.meshes[i]?.material;
      if (mat) {
        mat.emissiveIntensity = i % 2 === 0 ? pulse + 0.2 : pulse;
      }
    }

    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return;
    }

    const dx = ballBody.position.x - this.entryX;
    const dz = ballBody.position.z - this.entryZ;
    if (dx * dx + dz * dz > this.radius * this.radius) {
      return;
    }

    // Teleport: move ball to exit position
    ballBody.position.set(this.exitX, this.exitY, this.exitZ);
    ballBody.wakeUp();

    if (this.audioManager) {
      this.audioManager.playSound('teleport');
    }

    this.cooldown = PORTAL_COOLDOWN;
  }
}

registerMechanic(
  'portal_gate',
  (world, group, config, sh, theme) => new PortalGate(world, group, config, sh, theme)
);

export { PortalGate };
