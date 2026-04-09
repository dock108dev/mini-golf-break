import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * TimedHazard - A hazard that toggles on/off on a timer (e.g., solar flares).
 *
 * Config:
 *   position: Vector3 - Center position
 *   size: { width, length } - Hazard area dimensions
 *   onDuration: number - Seconds the hazard is active
 *   offDuration: number - Seconds the hazard is inactive
 *   hazardType: 'water'|'sand' - What happens when ball is in active hazard
 *   phase: number (optional) - Initial timer offset in seconds
 *   color: number (optional) - Active hazard color
 */
class TimedHazard extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);

    const pos = config.position || new THREE.Vector3(0, 0, 0);
    this.posX = pos.x;
    this.posZ = pos.z;
    this.onDuration = config.onDuration || 2;
    this.offDuration = config.offDuration || 2;
    this.hazardType = config.hazardType || 'water';
    this.timer = config.phase || 0;
    this.isActive = false;

    const width = config.size?.width || 2;
    const length = config.size?.length || 1;
    this.halfWidth = width / 2;
    this.halfLength = length / 2;

    const themeHazardColors = theme?.mechanics?.timedHazard;
    const defaultColor = this.hazardType === 'water'
      ? (themeHazardColors?.waterColor || 0xff4400)
      : (themeHazardColors?.sandColor || 0xffaa00);
    const activeColor = config.color || defaultColor;

    // Visual mesh (shown/hidden based on timer)
    const geometry = new THREE.PlaneGeometry(width, length);
    const material = new THREE.MeshStandardMaterial({
      color: activeColor,
      emissive: activeColor,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(pos.x, surfaceHeight + 0.006, pos.z);
    this.mesh.visible = false;
    group.add(this.mesh);
    this.meshes.push(this.mesh);
  }

  onDtSpike() {
    this.timer = 0;
    this.isActive = false;
    this.mesh.visible = false;
  }

  update(dt, ballBody) {
    // Advance timer
    this.timer += dt;
    const cycleDuration = this.onDuration + this.offDuration;
    const cyclePos = this.timer % cycleDuration;

    const wasActive = this.isActive;
    this.isActive = cyclePos < this.onDuration;

    // Toggle visibility
    if (this.isActive !== wasActive) {
      this.mesh.visible = this.isActive;
    }

    // Check ball overlap when active
    if (this.isActive && ballBody && ballBody.sleepState !== CANNON.Body.SLEEPING) {
      const dx = Math.abs(ballBody.position.x - this.posX);
      const dz = Math.abs(ballBody.position.z - this.posZ);

      if (dx < this.halfWidth && dz < this.halfLength) {
        // Apply hazard effect — the ball's own water/sand handling
        // applies penalties. Here we just apply a bounce-out impulse.
        ballBody.applyImpulse(new CANNON.Vec3(0, 2, 0));
      }
    }
  }
}

registerMechanic('timed_hazard', (world, group, config, sh, theme) => new TimedHazard(world, group, config, sh, theme));

export { TimedHazard };
