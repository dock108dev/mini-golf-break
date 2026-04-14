import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * SplitRoute - Internal wall dividers that create alternate paths within a hole.
 *
 * Config:
 *   walls: [{ start: Vector3, end: Vector3 }] - Divider wall segments
 *   height: number (optional) - Wall height (default 0.8)
 *   thickness: number (optional) - Wall thickness (default 0.15)
 *   color: number (optional) - Wall color (default 0x8888aa)
 */
class SplitRoute extends MechanicBase {
  constructor(world, group, config, surfaceHeight, theme) {
    super(world, group, config, surfaceHeight, theme);

    const walls = config.walls || [];
    const wallHeight = config.height || 0.8;
    const thickness = config.thickness || 0.15;
    const color = config.color || theme?.mechanics?.splitRoute?.color || 0x8888aa;

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.4
    });

    for (const wall of walls) {
      const dx = wall.end.x - wall.start.x;
      const dz = wall.end.z - wall.start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length < 0.01) {
        continue;
      }

      const angle = Math.atan2(dz, dx);
      const midX = (wall.start.x + wall.end.x) / 2;
      const midZ = (wall.start.z + wall.end.z) / 2;
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
      body.userData = { type: 'split_route_wall' };
      world.addBody(body);
      this.bodies.push(body);
    }
  }
}

registerMechanic(
  'split_route',
  (world, group, config, sh, theme) => new SplitRoute(world, group, config, sh, theme)
);

export { SplitRoute };
