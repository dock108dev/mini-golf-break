import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';
import { EventTypes } from '../events/EventTypes';
import { HAZARD_COLORS } from '../themes/palette';

const GRACE_PERIOD = 1.0; // seconds inactive after spawn
const EMISSIVE_LERP_RATE = 10; // reaches target in ~0.1 s (1 / 0.1)
const WARN_FLASH_DURATION = 0.1;

// Active: #ff2200 — Inactive: #220022 (as linear RGB components)
const ACTIVE_R = 1.0,
  ACTIVE_G = 0.133,
  ACTIVE_B = 0;
const INACTIVE_R = 0.133,
  INACTIVE_G = 0,
  INACTIVE_B = 0.133;

/**
 * LaserGrid — Timed planar barrier that cycles between collidable (active)
 * and passable (inactive) states on a fixed timer.
 *
 * Config:
 *   beams: [{ start: [x,y,z], end: [x,y,z] }]
 *   onDuration: number — seconds active
 *   offDuration: number — seconds inactive
 *   offset: number (0–1) — initial phase fraction of full cycle
 *   width: number — visual beam radius (default 0.05)
 *   color: number — hex color (default HAZARD_COLORS.danger)
 *
 * Emits LASER_GRID_STATE_CHANGE: { active: bool } on every toggle.
 * body.collisionResponse is true during active phase, false during inactive.
 * 1 s spawn grace period keeps the grid inactive regardless of timer phase.
 */
class LaserGrid extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);

    if (!config.beams) {
      throw new Error('LaserGrid: missing required config field "beams"');
    }

    this.onDuration = config.onDuration || 2;
    this.offDuration = config.offDuration || 2;
    this.beamWidth = config.width || 0.05;
    this.beamColor = config.color || theme?.mechanics?.laserGrid?.color || HAZARD_COLORS.danger;

    const cycleDuration = this.onDuration + this.offDuration;
    const offset = config.offset || 0;
    this.timer = offset * cycleDuration; // preserves phase offset after grace

    // Grace period — always start inactive
    this._graceTimer = 0;
    this._inGrace = true;
    this.isActive = false;
    this.isWarning = false;

    // Emissive lerp: 0 = inactive color, 1 = active color
    this._emissiveT = 0;

    this.beamData = [];

    for (const beam of config.beams) {
      const start = this._toVec3(beam.start);
      const end = this._toVec3(beam.end);
      const { mesh, body } = this._createBeam(start, end, surfaceHeight);
      this.beamData.push({ start, end, mesh, body });
    }

    // Start with all bodies inactive (no collision)
    this._applyCollisionResponse(false);
    this._syncVisibility();
  }

  _toVec3(arr) {
    if (Array.isArray(arr)) {
      return { x: arr[0], y: arr[1], z: arr[2] };
    }
    return { x: arr.x || 0, y: arr.y || 0, z: arr.z || 0 };
  }

  _createBeam(start, end, surfaceHeight) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2 + surfaceHeight;
    const midZ = (start.z + end.z) / 2;

    const geometry = new THREE.CylinderGeometry(this.beamWidth, this.beamWidth, length, 8, 1);
    const material = new THREE.MeshStandardMaterial({
      color: this.beamColor,
      emissive: new THREE.Color(INACTIVE_R, INACTIVE_G, INACTIVE_B),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = midX;
    mesh.position.y = midY;
    mesh.position.z = midZ;

    // Orient cylinder along beam direction (CylinderGeometry is along Y by default)
    if (length > 0) {
      const xzLen = Math.sqrt(dx * dx + dz * dz);
      const denom = xzLen > 0 ? xzLen : dy;
      mesh.rotation.x = Math.atan2(dz, denom);
      mesh.rotation.z = -Math.atan2(dx, denom);
    }

    mesh.castShadow = false;
    this.group.add(mesh);
    this.meshes.push(mesh);

    const body = new CANNON.Body({ mass: 0, material: this.world.bumperMaterial });
    const halfExtents = new CANNON.Vec3(this.beamWidth * 2, length / 2, this.beamWidth * 2);
    body.addShape(new CANNON.Box(halfExtents));
    body.position.x = midX;
    body.position.y = midY;
    body.position.z = midZ;
    body.userData = { type: 'laser_grid' };
    this.world.addBody(body);
    this.bodies.push(body);

    return { mesh, body };
  }

  onDtSpike() {
    this.timer = 0;
    this.isActive = false;
    this.isWarning = false;
    this._graceTimer = 0;
    this._inGrace = true;
    this._emissiveT = 0;
    this._applyCollisionResponse(false);
    this._syncVisibility();
  }

  update(dt, _ballBody) {
    if (this._inGrace) {
      this._graceTimer += dt;
      if (this._graceTimer < GRACE_PERIOD) {
        this._syncEmissive(dt);
        return;
      }
      // Only advance the cycle timer by the overshoot past GRACE_PERIOD
      dt = this._graceTimer - GRACE_PERIOD;
      this._inGrace = false;
    }

    this.timer += dt;
    const cycleDuration = this.onDuration + this.offDuration;
    const cyclePos = this.timer % cycleDuration;

    const wasActive = this.isActive;
    this.isActive = cyclePos < this.onDuration;

    const timeUntilOn = cycleDuration - cyclePos;
    this.isWarning = !this.isActive && timeUntilOn <= WARN_FLASH_DURATION;

    if (this.isActive !== wasActive) {
      this._applyCollisionResponse(this.isActive);
      if (this.eventManager?.publish) {
        this.eventManager.publish(EventTypes.LASER_GRID_STATE_CHANGE, { active: this.isActive });
      }
      this._syncVisibility();
    } else if (this.isWarning) {
      this._syncVisibility();
    }

    // Danger-tier emissive pulse at 1.5 Hz when active
    if (this.isActive) {
      const pulse = 0.5 + 0.3 * Math.sin(this.timer * Math.PI * 3);
      for (const beam of this.beamData) {
        if (beam.mesh.material) {
          beam.mesh.material.emissiveIntensity = pulse;
        }
      }
    }

    this._syncEmissive(dt);
  }

  _applyCollisionResponse(active) {
    for (const beam of this.beamData) {
      beam.body.collisionResponse = active;
    }
  }

  _syncEmissive(dt) {
    const target = this.isActive ? 1 : 0;
    this._emissiveT += (target - this._emissiveT) * Math.min(1, EMISSIVE_LERP_RATE * dt);
    const r = INACTIVE_R + (ACTIVE_R - INACTIVE_R) * this._emissiveT;
    const g = INACTIVE_G + (ACTIVE_G - INACTIVE_G) * this._emissiveT;
    const b = INACTIVE_B + (ACTIVE_B - INACTIVE_B) * this._emissiveT;
    for (const beam of this.beamData) {
      if (beam.mesh.material?.emissive?.setRGB) {
        beam.mesh.material.emissive.setRGB(r, g, b);
      }
    }
  }

  _syncVisibility() {
    for (const beam of this.beamData) {
      if (this.isActive) {
        beam.mesh.visible = true;
        if (beam.mesh.material) {
          beam.mesh.material.opacity = 0.9;
          beam.mesh.material.emissiveIntensity = 0.8;
        }
      } else if (this.isWarning) {
        beam.mesh.visible = true;
        if (beam.mesh.material) {
          beam.mesh.material.opacity = 0.3;
          beam.mesh.material.emissiveIntensity = 0.4;
        }
      } else {
        beam.mesh.visible = false;
      }
    }
  }
}

registerMechanic(
  'laser_grid',
  (world, group, config, sh, theme) => new LaserGrid(world, group, config, sh, theme)
);

export { LaserGrid };
