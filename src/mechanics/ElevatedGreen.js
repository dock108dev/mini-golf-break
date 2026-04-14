import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

function computeElevatedLayout(surfaceHeight, rampConfig, requestedElevation) {
  const rampStart = rampConfig.start;
  const rampEnd = rampConfig.end;
  const rampWidth = rampConfig.width || 2;
  const rampDx = rampEnd.x - rampStart.x;
  const rampDz = rampEnd.z - rampStart.z;
  const rampHorizontalLength = Math.sqrt(rampDx * rampDx + rampDz * rampDz);
  const MAX_RAMP_ANGLE = Math.PI / 6;
  const maxElevation = Math.tan(MAX_RAMP_ANGLE) * rampHorizontalLength;
  const elevation = Math.min(requestedElevation || 0.5, maxElevation);
  const rampAngleY = Math.atan2(rampDx, rampDz);
  const rampAngleX = Math.atan2(elevation, rampHorizontalLength);
  const rampActualLength = Math.sqrt(
    rampHorizontalLength * rampHorizontalLength + elevation * elevation
  );
  const platformY = surfaceHeight + elevation;
  const rampMidX = (rampStart.x + rampEnd.x) / 2;
  const rampMidZ = (rampStart.z + rampEnd.z) / 2;
  const rampMidY = surfaceHeight + elevation / 2;
  return {
    rampStart,
    rampEnd,
    rampWidth,
    elevation,
    rampAngleY,
    rampAngleX,
    rampActualLength,
    rampHorizontalLength,
    platformY,
    rampMidX,
    rampMidZ,
    rampMidY
  };
}

function buildElevatedPlatform({
  mechanic,
  world,
  group,
  platformConfig,
  layout,
  color,
  surfaceHeight
}) {
  const { platformY } = layout;
  const platWidth = platformConfig.width || 4;
  const platLength = platformConfig.length || 4;
  const platThickness = 0.02;

  const platGeom = new THREE.BoxGeometry(platWidth, platThickness, platLength);
  const platMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
  const platMesh = new THREE.Mesh(platGeom, platMat);
  platMesh.position.set(platformConfig.position.x, platformY, platformConfig.position.z);
  platMesh.receiveShadow = true;
  group.add(platMesh);
  mechanic.meshes.push(platMesh);

  const sideColor = mechanic.theme?.mechanics?.elevatedGreen?.sideColor || 0x1a8a4a;
  const sideMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.7 });
  const frontGeom = new THREE.BoxGeometry(platWidth, layout.elevation, platThickness);
  const frontMesh = new THREE.Mesh(frontGeom, sideMat);
  frontMesh.position.set(
    platformConfig.position.x,
    surfaceHeight + layout.elevation / 2,
    platformConfig.position.z + platLength / 2
  );
  group.add(frontMesh);
  mechanic.meshes.push(frontMesh);

  const platBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    material: world.groundMaterial
  });
  platBody.addShape(
    new CANNON.Box(new CANNON.Vec3(platWidth / 2, platThickness / 2, platLength / 2))
  );
  platBody.position.set(platformConfig.position.x, platformY, platformConfig.position.z);
  platBody.userData = { type: 'elevated_platform' };
  world.addBody(platBody);
  mechanic.bodies.push(platBody);
}

function buildElevatedRamp(mechanic, world, group, layout, color, surfaceHeight) {
  const { rampStart, elevation, rampAngleY, rampAngleX, rampActualLength, rampWidth } = layout;
  const rampGeom = new THREE.PlaneGeometry(rampWidth, rampActualLength);
  const rampMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
  const rampMesh = new THREE.Mesh(rampGeom, rampMat);
  rampMesh.position.set(layout.rampMidX, layout.rampMidY, layout.rampMidZ);
  rampMesh.rotation.set(-Math.PI / 2 + rampAngleX, rampAngleY, 0, 'YXZ');
  rampMesh.receiveShadow = true;
  group.add(rampMesh);
  mechanic.meshes.push(rampMesh);

  const halfW = rampWidth / 2;
  const rampHorizontalLength = layout.rampHorizontalLength;
  const rampVertices = new Float32Array([
    -halfW,
    0,
    0,
    halfW,
    0,
    0,
    -halfW,
    elevation,
    -rampHorizontalLength,
    halfW,
    elevation,
    -rampHorizontalLength
  ]);
  const rampIndices = new Uint16Array([0, 2, 1, 1, 2, 3]);
  const rampShape = new CANNON.Trimesh(rampVertices, rampIndices);
  const rampBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    material: world.groundMaterial
  });
  const rampQuat = new CANNON.Quaternion();
  rampQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rampAngleY);
  rampBody.addShape(rampShape, new CANNON.Vec3(0, 0, 0), rampQuat);
  rampBody.position.set(rampStart.x, surfaceHeight, rampStart.z);
  rampBody.userData = { type: 'ramp' };
  world.addBody(rampBody);
  mechanic.bodies.push(rampBody);
}

function buildElevatedRampRails(mechanic, world, group, layout, sideColor) {
  const { rampAngleY, rampActualLength, rampMidX, rampMidZ, rampMidY, rampWidth } = layout;
  const railHeight = 0.3;
  const railThickness = 0.1;
  const railMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.6 });

  for (const side of [-1, 1]) {
    const railGeom = new THREE.BoxGeometry(railThickness, railHeight, rampActualLength);
    const railMesh = new THREE.Mesh(railGeom, railMat);
    const railX = rampMidX + side * (rampWidth / 2);
    railMesh.position.set(railX, rampMidY + railHeight / 2, rampMidZ);
    railMesh.rotation.y = rampAngleY;
    group.add(railMesh);
    mechanic.meshes.push(railMesh);

    const railBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: world.bumperMaterial
    });
    railBody.addShape(
      new CANNON.Box(new CANNON.Vec3(railThickness / 2, railHeight / 2, rampActualLength / 2))
    );
    railBody.position.set(railX, rampMidY + railHeight / 2, rampMidZ);
    const railQuat = new CANNON.Quaternion();
    railQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rampAngleY);
    railBody.quaternion.copy(railQuat);
    railBody.userData = { type: 'ramp_rail' };
    world.addBody(railBody);
    mechanic.bodies.push(railBody);
  }
}

/**
 * ElevatedGreen - A raised platform section with a connecting ramp.
 *
 * Config:
 *   platform: { position: Vector3, width: number, length: number } - The raised platform area
 *   elevation: number - Height above base surface (default 0.5)
 *   ramp: { start: Vector3, end: Vector3, width: number } - Ramp connecting base to platform
 *   color: number (optional) - Platform color (default 0x2ecc71, matches green)
 *
 * Ramp angle is clamped to 30 degrees max so the ball can traverse it.
 */
class ElevatedGreen extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);

    const platformConfig = config.platform || {
      position: new THREE.Vector3(0, 0, -5),
      width: 4,
      length: 4
    };
    const rampConfig = config.ramp || {
      start: new THREE.Vector3(0, 0, -3),
      end: new THREE.Vector3(0, 0, -5),
      width: 2
    };
    const color = config.color || theme?.mechanics?.elevatedGreen?.color || 0x2ecc71;
    const layout = computeElevatedLayout(surfaceHeight, rampConfig, config.elevation);

    buildElevatedPlatform({
      mechanic: this,
      world,
      group,
      platformConfig,
      layout,
      color,
      surfaceHeight
    });
    buildElevatedRamp(this, world, group, layout, color, surfaceHeight);
    const sideColor = theme?.mechanics?.elevatedGreen?.sideColor || 0x1a8a4a;
    buildElevatedRampRails(this, world, group, layout, sideColor);
  }
}

registerMechanic(
  'elevated_green',
  (world, group, config, sh, theme) => new ElevatedGreen(world, group, config, sh, theme)
);

export { ElevatedGreen };
