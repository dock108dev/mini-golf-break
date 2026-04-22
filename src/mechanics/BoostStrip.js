import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';
import { HAZARD_COLORS } from '../themes/palette';

const BOOST_COOLDOWN = 0.8;
const UV_SCROLL_SPEED = 0.3;
const DEFAULT_BOOST_MAGNITUDE = 12;

function parseBoostDirection(rawDir) {
  const src = rawDir || { x: 0, y: 0, z: -1 };
  const x = src.x || 0;
  const y = src.y || 0;
  const z = src.z || 0;
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function resolveBoostMagnitude(config) {
  if (config.boost_magnitude !== undefined && config.boost_magnitude <= 0) {
    console.warn('[BoostStrip] boost_magnitude must be > 0; using default');
  }
  return config.boost_magnitude > 0 ? config.boost_magnitude : DEFAULT_BOOST_MAGNITUDE;
}

/**
 * BoostStrip - Applies a one-shot velocity impulse when the ball contacts the strip.
 * A 0.8s cooldown prevents re-triggering while the ball slides across the surface.
 *
 * Config:
 *   position: Vector3 - Center of the boost strip
 *   boost_direction: Vector3 - Direction of the impulse (normalized at load time)
 *   boost_magnitude: number - Speed added in m/s (must be > 0)
 *   size: { width, length } - Strip dimensions
 *   color: number (optional) - Override emissive color (default HAZARD_COLORS.reward)
 */
class BoostStrip extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);
    this.isForceField = true;

    const pos = config.position || { x: 0, y: 0, z: 0 };
    this._boostDir = parseBoostDirection(config.boost_direction);
    this._boostMagnitude = resolveBoostMagnitude(config);

    const width = config.size?.width || 2;
    const length = config.size?.length || 3;
    const emissiveColor =
      config.color || theme?.mechanics?.boostStrip?.color || HAZARD_COLORS.reward;

    // Visual: flat emissive strip with chevron UV-scroll in boost direction
    const geometry = new THREE.PlaneGeometry(width, length);
    const material = new THREE.MeshStandardMaterial({
      color: emissiveColor,
      emissive: emissiveColor,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.85,
      roughness: 0.2
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(pos.x || 0, surfaceHeight + 0.005, pos.z || 0);

    // Rotate strip to align with boost direction
    const angle = Math.atan2(this._boostDir.x, this._boostDir.z);
    this.mesh.rotation.z = angle;

    group.add(this.mesh);
    this.meshes.push(this.mesh);

    // Trigger body (detects ball overlap)
    this.triggerBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      isTrigger: true
    });
    const halfExtents = new CANNON.Vec3(width / 2, 0.1, length / 2);
    this.triggerBody.addShape(new CANNON.Box(halfExtents));
    this.triggerBody.position.set(pos.x || 0, surfaceHeight, pos.z || 0);
    this.triggerBody.userData = { type: 'boost_strip' };
    world.addBody(this.triggerBody);
    this.bodies.push(this.triggerBody);

    this.radius = Math.max(width, length) / 2;
    this._boostCooldown = 0;
    this._uvOffset = 0;
    this._pulseTimer = 0;
    this.boostSoundCooldown = 0;
  }

  update(dt, ballBody) {
    if (this._boostCooldown > 0) {
      this._boostCooldown -= dt;
    }
    if (this.boostSoundCooldown > 0) {
      this.boostSoundCooldown -= dt;
    }

    // UV scroll chevrons at 0.3 units/s in boost direction
    this._uvOffset += dt * UV_SCROLL_SPEED;
    if (this.mesh.material?.map) {
      this.mesh.material.map.offset.set(
        this._uvOffset * this._boostDir.x,
        this._uvOffset * this._boostDir.z
      );
    }

    // Reward-tier: slow pulse at 0.5 Hz
    this._pulseTimer += dt;
    if (this.mesh.material) {
      this.mesh.material.emissiveIntensity = 0.45 + 0.2 * Math.sin(this._pulseTimer * Math.PI);
    }

    if (!ballBody) {
      return;
    }

    if (this._boostCooldown <= 0 && this.isBallInZone(ballBody, this.triggerBody, this.radius)) {
      if (ballBody.sleepState === CANNON.Body.SLEEPING) {
        ballBody.wakeUp();
      }

      // One-shot velocity impulse: add boost_direction * boost_magnitude to ball velocity
      ballBody.velocity.x += this._boostDir.x * this._boostMagnitude;
      ballBody.velocity.y += this._boostDir.y * this._boostMagnitude;
      ballBody.velocity.z += this._boostDir.z * this._boostMagnitude;
      this._boostCooldown = BOOST_COOLDOWN;

      if (this.audioManager && this.boostSoundCooldown <= 0) {
        this.audioManager.playSound('boost');
        this.boostSoundCooldown = 0.3;
      }
    }
  }

  onDtSpike() {
    // Reset cooldown after long pauses so the strip is ready for fresh contact
    this._boostCooldown = 0;
  }
}

registerMechanic(
  'boost_strip',
  (world, group, config, sh, theme) => new BoostStrip(world, group, config, sh, theme)
);

export { BoostStrip };
