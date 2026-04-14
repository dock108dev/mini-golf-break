import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * PortalGate - Two linked portals that teleport the ball.
 * Ball enters one portal and exits the other with preserved velocity direction.
 *
 * Config:
 *   entryPosition: Vector3 - Position of the entry portal
 *   exitPosition: Vector3 - Position of the exit portal
 *   radius: number - Portal trigger radius (default 0.6)
 *   color: number (optional) - Portal color (default 0x8800ff)
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
    this.exitY = surfaceHeight + 0.3; // Slight elevation for clean exit
    this.radius = config.radius || 0.6;
    this.cooldown = 0; // Prevent immediate re-trigger
    const color = config.color || theme?.mechanics?.portalGate?.color || 0x8800ff;

    // Entry portal ring
    this._createPortalRing(entryPos, color, 'entry', surfaceHeight, group);
    // Exit portal ring
    this._createPortalRing(exitPos, color, 'exit', surfaceHeight, group);
  }

  _createPortalRing(pos, color, label, surfaceHeight, group) {
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

    // Inner glow disc
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

    // Decrease cooldown
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return;
    }

    // Check if ball is at entry portal
    const dx = ballBody.position.x - this.entryX;
    const dz = ballBody.position.z - this.entryZ;

    if (dx * dx + dz * dz <= this.radius * this.radius) {
      // Teleport: preserve velocity magnitude and direction
      ballBody.position.set(this.exitX, this.exitY, this.exitZ);
      ballBody.wakeUp();

      if (this.audioManager) {
        this.audioManager.playSound('teleport');
      }

      // Set cooldown to prevent immediate re-entry
      this.cooldown = 1.0;
    }
  }
}

registerMechanic(
  'portal_gate',
  (world, group, config, sh, theme) => new PortalGate(world, group, config, sh, theme)
);

export { PortalGate };
