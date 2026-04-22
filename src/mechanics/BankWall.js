import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';
import { HAZARD_COLORS } from '../themes/palette';

/**
 * BankWall - Angled wall segments for bank shots and ricochets.
 * Creates wall segments from point pairs with configurable restitution.
 *
 * Config:
 *   segments: [{ start: Vector3, end: Vector3 }] - Wall segment endpoints
 *   height: number (optional) - Wall height (default 0.6)
 *   thickness: number (optional) - Wall thickness (default 0.15)
 *   restitution: number (optional) - Bounce factor (default 0.8, higher = more bounce)
 *   color: number (optional) - Wall color (default 0x6666aa)
 */
class BankWall extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);

    const segments = config.segments || [];
    const wallHeight = config.height || 0.6;
    const thickness = config.thickness || 0.15;
    const color = config.color || theme?.mechanics?.bankWall?.color || HAZARD_COLORS.blocker;

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.5,
      emissive: HAZARD_COLORS.blocker,
      emissiveIntensity: 0.2
    });

    for (const seg of segments) {
      const start = seg.start;
      const end = seg.end;
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length < 0.01) {
        continue;
      }

      const angle = Math.atan2(dz, dx);
      const midX = (start.x + end.x) / 2;
      const midZ = (start.z + end.z) / 2;
      const wallY = surfaceHeight + wallHeight / 2;

      // Visual
      const geom = new THREE.BoxGeometry(length, wallHeight, thickness);
      const mesh = new THREE.Mesh(geom, material.clone());
      mesh.position.set(midX, wallY, midZ);
      mesh.rotation.y = angle;
      mesh.castShadow = true;
      group.add(mesh);
      this.meshes.push(mesh);

      // Physics
      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        material: world.bumperMaterial
      });
      body.addShape(new CANNON.Box(new CANNON.Vec3(length / 2, wallHeight / 2, thickness / 2)));
      body.position.set(midX, wallY, midZ);
      const quat = new CANNON.Quaternion();
      quat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
      body.quaternion.copy(quat);
      body.userData = { type: 'bank_wall' };
      world.addBody(body);
      this.bodies.push(body);
    }
  }
}

registerMechanic(
  'bank_wall',
  (world, group, config, sh, theme) => new BankWall(world, group, config, sh, theme)
);

export { BankWall };
