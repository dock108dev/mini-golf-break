import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

const FADE_DURATION = 0.2;
const WARN_DURATION = 0.3;

/**
 * DisappearingPlatform - Timed floor segments that appear and disappear.
 * When visible, provides a walkable surface. When absent, ball falls through.
 *
 * Config:
 *   platforms: [{ position, size, onDuration, offDuration, offset }]
 *   hazardBelowY: number - y-level that triggers ball reset if ball falls below
 */
class DisappearingPlatform extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);

    if (!config.platforms) {
      throw new Error('DisappearingPlatform: missing required config field "platforms"');
    }

    this.hazardBelowY = config.hazardBelowY ?? surfaceHeight - 2;
    this.platformData = [];

    const platforms = config.platforms;
    for (const platConfig of platforms) {
      this._createPlatform(platConfig, surfaceHeight);
    }
  }

  _parseVec(val, defaults) {
    if (Array.isArray(val)) {
      return { x: val[0], y: val[1], z: val[2] };
    }
    return { x: val?.x || defaults.x, y: val?.y || defaults.y, z: val?.z || defaults.z };
  }

  _parseSize(val) {
    if (Array.isArray(val)) {
      return { w: val[0], h: val[1], d: val[2] };
    }
    return { w: val?.width || 2, h: val?.height || 0.15, d: val?.depth || 2 };
  }

  _createPlatformMesh(dims, pos, color) {
    const geometry = new THREE.BoxGeometry(dims.w, dims.h, dims.d);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.5,
      emissive: color,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 1.0
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  _createStripMesh(dims, pos) {
    const geometry = new THREE.BoxGeometry(dims.w + 0.04, dims.h + 0.02, dims.d + 0.04);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.4
    });
    const stripMesh = new THREE.Mesh(geometry, material);
    stripMesh.position.set(pos.x, pos.y, pos.z);
    this.group.add(stripMesh);
    this.meshes.push(stripMesh);
    return stripMesh;
  }

  _createPlatform(platConfig, surfaceHeight) {
    const { x: px, y: py, z: pz } = this._parseVec(platConfig.position, { x: 0, y: 0, z: 0 });
    const { w: width, h: height, d: depth } = this._parseSize(platConfig.size);

    const onDuration = platConfig.onDuration || 3;
    const offDuration = platConfig.offDuration || 2;
    const offset = platConfig.offset || 0;
    const cycleDuration = onDuration + offDuration;
    const timer = offset * cycleDuration;
    const meshY = surfaceHeight + py + height / 2;
    const color = this.theme?.mechanics?.disappearingPlatform?.color || 0x33aaff;

    const dims = { w: width, h: height, d: depth };
    const meshPos = { x: px, y: meshY, z: pz };
    const mesh = this._createPlatformMesh(dims, meshPos, color);
    const stripMesh = this._createStripMesh(dims, meshPos);

    // Physics body — STATIC, toggled via collisionResponse
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
    body.position.x = px;
    body.position.y = meshY;
    body.position.z = pz;
    body.userData = { type: 'disappearing_platform' };
    this.world.addBody(body);
    this.bodies.push(body);

    const isOn = timer % cycleDuration < onDuration;
    const data = {
      mesh,
      stripMesh,
      body,
      onDuration,
      offDuration,
      cycleDuration,
      timer,
      isOn,
      fadeProgress: isOn ? 1 : 0,
      width,
      depth,
      px,
      pz
    };

    this._applyState(data);
    this.platformData.push(data);
  }

  onDtSpike() {
    for (const plat of this.platformData) {
      plat.timer = 0;
      plat.isOn = true;
      plat.fadeProgress = 1;
      this._applyState(plat);
    }
  }

  update(dt, ballBody) {
    for (const plat of this.platformData) {
      plat.timer += dt;
      const cyclePos = plat.timer % plat.cycleDuration;
      const shouldBeOn = cyclePos < plat.onDuration;

      if (shouldBeOn !== plat.isOn) {
        plat.isOn = shouldBeOn;
      }

      // Fade progress: 1 = fully visible, 0 = fully invisible
      if (plat.isOn) {
        plat.fadeProgress = Math.min(1, plat.fadeProgress + dt / FADE_DURATION);
      } else {
        plat.fadeProgress = Math.max(0, plat.fadeProgress - dt / FADE_DURATION);
      }

      // Warning: amber pulse when platform is on but about to turn off
      const timeUntilOff = plat.onDuration - cyclePos;
      const isWarning = plat.isOn && timeUntilOff > 0 && timeUntilOff <= WARN_DURATION;

      this._applyState(plat, isWarning);
    }

    // Hazard check: ball fell below hazardBelowY
    if (ballBody && ballBody.sleepState !== CANNON.Body.SLEEPING) {
      if (ballBody.position.y < this.hazardBelowY) {
        ballBody.applyImpulse(new CANNON.Vec3(0, 2, 0));
      }
    }
  }

  _applyState(plat, isWarning = false) {
    const visible = plat.fadeProgress > 0;
    plat.mesh.visible = visible;
    plat.stripMesh.visible = visible;

    if (visible) {
      plat.mesh.material.opacity = plat.fadeProgress;
    }

    // Collision: only solid when fully visible
    plat.body.collisionResponse = plat.fadeProgress >= 1;

    // Warning amber pulse on edge strip
    if (isWarning) {
      plat.stripMesh.material.color = new THREE.Color(0xffaa00);
      plat.stripMesh.material.emissive = new THREE.Color(0xffaa00);
      plat.stripMesh.material.emissiveIntensity = 0.6;
      plat.stripMesh.material.opacity = 0.7;
    } else if (visible) {
      plat.stripMesh.material.color = new THREE.Color(0x00ff88);
      plat.stripMesh.material.emissive = new THREE.Color(0x00ff88);
      plat.stripMesh.material.emissiveIntensity = 0.3;
      plat.stripMesh.material.opacity = 0.4;
    }
  }
}

registerMechanic(
  'disappearing_platform',
  (world, group, config, sh, theme) => new DisappearingPlatform(world, group, config, sh, theme)
);

export { DisappearingPlatform };
