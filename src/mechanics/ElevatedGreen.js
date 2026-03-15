import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * ElevatedGreen - A raised platform section with a connecting ramp.
 *
 * Config:
 *   platform: { position: Vector3, width: number, length: number } - The raised platform area
 *   elevation: number - Height above base surface (default 0.5)
 *   ramp: { start: Vector3, end: Vector3, width: number } - Ramp connecting base to platform
 *   color: number (optional) - Platform color (default 0x2ecc71, matches green)
 */
class ElevatedGreen extends MechanicBase {
  constructor(world, group, config, surfaceHeight) {
    super(world, group, config, surfaceHeight);

    const platformConfig = config.platform || { position: new THREE.Vector3(0, 0, -5), width: 4, length: 4 };
    const elevation = config.elevation || 0.5;
    const rampConfig = config.ramp || { start: new THREE.Vector3(0, 0, -3), end: new THREE.Vector3(0, 0, -5), width: 2 };
    const color = config.color || 0x2ecc71;

    const platformY = surfaceHeight + elevation;

    // --- Raised Platform (visual + physics) ---
    const platWidth = platformConfig.width || 4;
    const platLength = platformConfig.length || 4;
    const platThickness = 0.02;

    // Visual: flat box for platform surface
    const platGeom = new THREE.BoxGeometry(platWidth, platThickness, platLength);
    const platMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
    const platMesh = new THREE.Mesh(platGeom, platMat);
    platMesh.position.set(platformConfig.position.x, platformY, platformConfig.position.z);
    platMesh.receiveShadow = true;
    group.add(platMesh);
    this.meshes.push(platMesh);

    // Platform side walls (visual depth indicator)
    const sideColor = 0x1a8a4a;
    const sideMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.7 });
    // Front side
    const frontGeom = new THREE.BoxGeometry(platWidth, elevation, platThickness);
    const frontMesh = new THREE.Mesh(frontGeom, sideMat);
    frontMesh.position.set(platformConfig.position.x, surfaceHeight + elevation / 2, platformConfig.position.z + platLength / 2);
    group.add(frontMesh);
    this.meshes.push(frontMesh);

    // Physics: static box for platform surface
    const platBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: world.groundMaterial
    });
    platBody.addShape(new CANNON.Box(new CANNON.Vec3(platWidth / 2, platThickness / 2, platLength / 2)));
    platBody.position.set(platformConfig.position.x, platformY, platformConfig.position.z);
    platBody.userData = { type: 'elevated_platform' };
    world.addBody(platBody);
    this.bodies.push(platBody);

    // --- Ramp (visual + physics) ---
    const rampStart = rampConfig.start;
    const rampEnd = rampConfig.end;
    const rampWidth = rampConfig.width || 2;

    // Calculate ramp geometry
    const rampDx = rampEnd.x - rampStart.x;
    const rampDz = rampEnd.z - rampStart.z;
    const rampHorizontalLength = Math.sqrt(rampDx * rampDx + rampDz * rampDz);
    const rampAngleY = Math.atan2(rampDx, rampDz); // Rotation around Y
    const rampAngleX = Math.atan2(elevation, rampHorizontalLength); // Tilt angle
    const rampActualLength = Math.sqrt(rampHorizontalLength * rampHorizontalLength + elevation * elevation);

    // Visual: tilted plane for ramp
    const rampGeom = new THREE.PlaneGeometry(rampWidth, rampActualLength);
    const rampMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
    const rampMesh = new THREE.Mesh(rampGeom, rampMat);

    // Position at midpoint between start and end
    const rampMidX = (rampStart.x + rampEnd.x) / 2;
    const rampMidZ = (rampStart.z + rampEnd.z) / 2;
    const rampMidY = surfaceHeight + elevation / 2;
    rampMesh.position.set(rampMidX, rampMidY, rampMidZ);

    // Rotate: first lay flat (X rotation), then tilt for slope, then orient direction
    rampMesh.rotation.set(-Math.PI / 2 + rampAngleX, rampAngleY, 0, 'YXZ');
    rampMesh.receiveShadow = true;
    group.add(rampMesh);
    this.meshes.push(rampMesh);

    // Physics: Trimesh from a tilted plane for ramp collision
    // Create vertices for a rectangular ramp surface
    const halfW = rampWidth / 2;
    const rampVertices = new Float32Array([
      // Bottom-left of ramp (at base level)
      -halfW, 0, 0,
      halfW, 0, 0,
      // Top-left of ramp (at platform level)
      -halfW, elevation, -rampHorizontalLength,
      halfW, elevation, -rampHorizontalLength
    ]);
    const rampIndices = new Uint16Array([0, 2, 1, 1, 2, 3]);

    const rampShape = new CANNON.Trimesh(rampVertices, rampIndices);
    const rampBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: world.groundMaterial
    });

    // Rotate the trimesh to align with the ramp direction
    const rampQuat = new CANNON.Quaternion();
    rampQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rampAngleY);
    rampBody.addShape(rampShape, new CANNON.Vec3(0, 0, 0), rampQuat);
    rampBody.position.set(rampStart.x, surfaceHeight, rampStart.z);
    rampBody.userData = { type: 'ramp' };
    world.addBody(rampBody);
    this.bodies.push(rampBody);

    // --- Edge rails for ramp (prevent ball falling off sides) ---
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
      this.meshes.push(railMesh);

      const railBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        material: world.bumperMaterial
      });
      railBody.addShape(new CANNON.Box(new CANNON.Vec3(railThickness / 2, railHeight / 2, rampActualLength / 2)));
      railBody.position.set(railX, rampMidY + railHeight / 2, rampMidZ);
      const railQuat = new CANNON.Quaternion();
      railQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rampAngleY);
      railBody.quaternion.copy(railQuat);
      railBody.userData = { type: 'ramp_rail' };
      world.addBody(railBody);
      this.bodies.push(railBody);
    }
  }
}

registerMechanic('elevated_green', (world, group, config, sh) => new ElevatedGreen(world, group, config, sh));

export { ElevatedGreen };
