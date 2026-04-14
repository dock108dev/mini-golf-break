import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

const WARN_FLASH_DURATION = 0.1;

/**
 * LaserGrid - Timed beam hazard that cycles on/off.
 * When active, beams act as hazards (ball reset + penalty).
 * When inactive, the ball passes through freely.
 *
 * Config:
 *   beams: [{ start: [x, y, z], end: [x, y, z] }] - beam segments
 *   onDuration: number - seconds beam is active
 *   offDuration: number - seconds beam is inactive
 *   offset: number (0–1) - initial phase offset as fraction of full cycle
 *   width: number (optional) - visual beam width (default 0.05)
 *   color: number (optional) - hex color (default 0xff2222)
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
    this.beamColor = config.color || theme?.mechanics?.laserGrid?.color || 0xff2222;

    const cycleDuration = this.onDuration + this.offDuration;
    const offset = config.offset || 0;
    this.timer = offset * cycleDuration;
    this.isActive = this.timer % cycleDuration < this.onDuration;
    this.isWarning = false;

    this.beamData = [];
    const beams = config.beams;

    for (const beam of beams) {
      const start = this._toVec3(beam.start);
      const end = this._toVec3(beam.end);
      const { mesh, body } = this._createBeam(start, end, surfaceHeight);
      this.beamData.push({ start, end, mesh, body });
    }

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

    // Visual: cylinder along the beam segment
    const geometry = new THREE.CylinderGeometry(this.beamWidth, this.beamWidth, length, 8, 1);
    const material = new THREE.MeshStandardMaterial({
      color: this.beamColor,
      emissive: this.beamColor,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = midX;
    mesh.position.y = midY;
    mesh.position.z = midZ;

    // Orient cylinder along the beam direction.
    // CylinderGeometry is along Y axis by default.
    if (length > 0) {
      const xzLen = Math.sqrt(dx * dx + dz * dz);
      const denom = xzLen > 0 ? xzLen : dy;
      mesh.rotation.x = Math.atan2(dz, denom);
      mesh.rotation.z = -Math.atan2(dx, denom);
    }

    mesh.castShadow = false;
    this.group.add(mesh);
    this.meshes.push(mesh);

    // Physics: KINEMATIC trigger body for hazard detection
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      isTrigger: true
    });
    const halfExtents = new CANNON.Vec3(this.beamWidth * 2, length / 2, this.beamWidth * 2);
    body.addShape(new CANNON.Box(halfExtents));
    body.position.x = midX;
    body.position.y = midY;
    body.position.z = midZ;
    body.userData = { type: 'laser_grid', isHazard: true };
    this.world.addBody(body);
    this.bodies.push(body);

    return { mesh, body };
  }

  onDtSpike() {
    this.timer = 0;
    this.isActive = false;
    this.isWarning = false;
    this._syncVisibility();
  }

  update(dt, ballBody) {
    this.timer += dt;
    const cycleDuration = this.onDuration + this.offDuration;
    const cyclePos = this.timer % cycleDuration;

    const wasActive = this.isActive;
    this.isActive = cyclePos < this.onDuration;

    // Warn flash: beam is off but about to turn on within WARN_FLASH_DURATION
    const timeUntilOn = cycleDuration - cyclePos;
    this.isWarning = !this.isActive && timeUntilOn <= WARN_FLASH_DURATION;

    if (this.isActive !== wasActive || this.isWarning) {
      this._syncVisibility();
    }

    // Pulse opacity when active
    if (this.isActive) {
      const pulse = 0.7 + 0.3 * Math.sin(this.timer * 8);
      for (const beam of this.beamData) {
        if (beam.mesh.material) {
          beam.mesh.material.opacity = pulse;
        }
      }
    }

    // Hazard check: ball touching an active beam
    if (this.isActive && ballBody && ballBody.sleepState !== CANNON.Body.SLEEPING) {
      for (const beam of this.beamData) {
        if (this._isBallOnBeam(ballBody, beam)) {
          ballBody.applyImpulse(new CANNON.Vec3(0, 2, 0));
          break;
        }
      }
    }
  }

  _isBallOnBeam(ballBody, beam) {
    const bx = ballBody.position.x;
    const bz = ballBody.position.z;
    const sx = beam.start.x;
    const sz = beam.start.z;
    const ex = beam.end.x;
    const ez = beam.end.z;

    // Point-to-line-segment distance in XZ plane
    const segDx = ex - sx;
    const segDz = ez - sz;
    const segLenSq = segDx * segDx + segDz * segDz;

    if (segLenSq === 0) {
      // Degenerate beam (zero length)
      const dx = bx - sx;
      const dz = bz - sz;
      return Math.sqrt(dx * dx + dz * dz) <= this.beamWidth * 4;
    }

    // Project ball onto segment, clamped to [0,1]
    let t = ((bx - sx) * segDx + (bz - sz) * segDz) / segLenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = sx + t * segDx;
    const closestZ = sz + t * segDz;
    const dx = bx - closestX;
    const dz = bz - closestZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Ball radius ~0.05 + beam width buffer
    return dist <= this.beamWidth * 4;
  }

  _syncVisibility() {
    for (const beam of this.beamData) {
      if (this.isActive) {
        beam.mesh.visible = true;
        beam.mesh.material.opacity = 0.9;
        beam.mesh.material.emissiveIntensity = 0.8;
      } else if (this.isWarning) {
        // Warn flash: brief flicker before reactivation
        beam.mesh.visible = true;
        beam.mesh.material.opacity = 0.3;
        beam.mesh.material.emissiveIntensity = 0.4;
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
