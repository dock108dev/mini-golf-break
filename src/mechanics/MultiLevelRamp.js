import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

const MAX_RAMP_ANGLE = Math.PI / 6;
const DEFAULT_WIDTH = 1.2;
const RAIL_HEIGHT = 0.3;
const RAIL_THICKNESS = 0.1;
const DEFAULT_SURFACE_COLOR = 0x4a90d9;
const RAMP_THICKNESS = 0.05;

function toVec3(v) {
  if (Array.isArray(v)) {
    return { x: v[0], y: v[1], z: v[2] };
  }
  return v;
}

class MultiLevelRamp extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);

    if (!config.startPosition) {
      throw new Error('MultiLevelRamp: missing required config field "startPosition"');
    }
    if (!config.endPosition) {
      throw new Error('MultiLevelRamp: missing required config field "endPosition"');
    }

    const ramp = this._computeGeometry(config, surfaceHeight);
    this.rampLength = ramp.actualLength;
    this.rampWidth = ramp.width;

    this._createRampSurface(ramp);
    this._createRampBody(ramp);

    if (config.sideWalls !== false) {
      this._createSideWalls(ramp);
    }
  }

  _computeGeometry(config, surfaceHeight) {
    const start = toVec3(config.startPosition);
    const end = toVec3(config.endPosition);
    const width = config.width || DEFAULT_WIDTH;
    const color =
      config.surfaceColor || this.theme?.mechanics?.multiLevelRamp?.color || DEFAULT_SURFACE_COLOR;

    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const horizLen = Math.sqrt(dx * dx + dz * dz);

    const requested = Math.abs(end.y - start.y);
    const maxElev = Math.tan(MAX_RAMP_ANGLE) * horizLen;
    const elevation = Math.min(requested, maxElev);
    const ascending = start.y <= end.y;

    const baseY = Math.max(Math.min(start.y, end.y), surfaceHeight);
    const startY = baseY + (ascending ? 0 : elevation);
    const endY = baseY + (ascending ? elevation : 0);

    return {
      start,
      width,
      color,
      horizLen,
      elevation,
      ascending,
      angleY: Math.atan2(dx, dz),
      angleX: Math.atan2(elevation, horizLen),
      actualLength: Math.sqrt(horizLen * horizLen + elevation * elevation),
      midX: (start.x + end.x) / 2,
      midZ: (start.z + end.z) / 2,
      midY: (startY + endY) / 2,
      baseY,
      surfaceHeight
    };
  }

  _createRampSurface(r) {
    const geom = new THREE.BoxGeometry(r.width, RAMP_THICKNESS, r.actualLength);
    const mat = new THREE.MeshStandardMaterial({ color: r.color, roughness: 0.8, metalness: 0.1 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(r.midX, r.midY, r.midZ);
    mesh.rotation.set(r.ascending ? -r.angleX : r.angleX, r.angleY, 0, 'YXZ');
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.meshes.push(mesh);
  }

  _createRampBody(r) {
    const halfW = r.width / 2;
    const sign = r.ascending ? 1 : -1;
    const vertices = new Float32Array([
      -halfW,
      0,
      0,
      halfW,
      0,
      0,
      -halfW,
      sign * r.elevation,
      -r.horizLen,
      halfW,
      sign * r.elevation,
      -r.horizLen
    ]);
    const indices = new Uint16Array([0, 2, 1, 1, 2, 3]);
    const shape = new CANNON.Trimesh(vertices, indices);
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.world.groundMaterial
    });
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), r.angleY);
    body.addShape(shape, new CANNON.Vec3(0, 0, 0), quat);
    body.position.set(r.start.x, r.baseY + (r.ascending ? 0 : r.elevation), r.start.z);
    body.userData = { type: 'multi_level_ramp' };
    this.world.addBody(body);
    this.bodies.push(body);
  }

  _createSideWalls(r) {
    const sideColor = this.theme?.mechanics?.multiLevelRamp?.sideColor || 0x3670a8;
    const mat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.6 });

    for (const side of [-1, 1]) {
      const geom = new THREE.BoxGeometry(RAIL_THICKNESS, RAIL_HEIGHT, r.actualLength);
      const mesh = new THREE.Mesh(geom, mat);
      const wallX = r.midX + side * (r.width / 2);
      mesh.position.set(wallX, r.midY + RAIL_HEIGHT / 2, r.midZ);
      mesh.rotation.y = r.angleY;
      this.group.add(mesh);
      this.meshes.push(mesh);

      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        material: this.world.bumperMaterial
      });
      body.addShape(
        new CANNON.Box(new CANNON.Vec3(RAIL_THICKNESS / 2, RAIL_HEIGHT / 2, r.actualLength / 2))
      );
      body.position.set(wallX, r.midY + RAIL_HEIGHT / 2, r.midZ);
      const quat = new CANNON.Quaternion();
      quat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), r.angleY);
      body.quaternion.copy(quat);
      body.userData = { type: 'ramp_wall' };
      this.world.addBody(body);
      this.bodies.push(body);
    }
  }
}

registerMechanic(
  'multi_level_ramp',
  (world, group, config, sh, theme) => new MultiLevelRamp(world, group, config, sh, theme)
);

export { MultiLevelRamp };
