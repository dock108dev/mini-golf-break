import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MechanicBase } from './MechanicBase';
import { registerMechanic } from './MechanicRegistry';

/**
 * RicochetBumpers - Bumpers with varied geometry (cylinder, sphere, box) and high restitution.
 *
 * Config:
 *   bumpers: [{
 *     position: Vector3,
 *     geometry: 'cylinder'|'sphere'|'box' (default 'cylinder'),
 *     radius: number (for cylinder/sphere),
 *     size: Vector3 (for box),
 *     height: number (optional, for cylinder, default 0.5),
 *     restitution: number (optional, default 0.9)
 *   }]
 *   color: number (optional) - Bumper color (default 0xff6600)
 */
class RicochetBumpers extends MechanicBase {
  constructor(world, group, config, surfaceHeight) {
    super(world, group, config, surfaceHeight);

    const bumpers = config.bumpers || [];
    const defaultColor = config.color || 0xff6600;

    for (const b of bumpers) {
      const pos = b.position || new THREE.Vector3(0, 0, 0);
      const geomType = b.geometry || 'cylinder';
      const radius = b.radius || 0.4;
      const height = b.height || 0.5;
      const color = b.color || defaultColor;
      const bumperY = surfaceHeight + height / 2;

      let mesh;
      let shape;

      if (geomType === 'sphere') {
        const geom = new THREE.SphereGeometry(radius, 16, 16);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });
        mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(pos.x, surfaceHeight + radius, pos.z);
        shape = new CANNON.Sphere(radius);
      } else if (geomType === 'box') {
        const size = b.size || new THREE.Vector3(0.8, height, 0.8);
        const geom = new THREE.BoxGeometry(size.x, size.y, size.z);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 });
        mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(pos.x, bumperY, pos.z);
        shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
      } else {
        // Default: cylinder
        const geom = new THREE.CylinderGeometry(radius, radius, height, 16);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });
        mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(pos.x, bumperY, pos.z);
        shape = new CANNON.Cylinder(radius, radius, height, 16);
      }

      mesh.castShadow = true;
      group.add(mesh);
      this.meshes.push(mesh);

      // Physics body with high restitution for bouncy ricochets
      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        material: world.bumperMaterial
      });
      body.addShape(shape);
      body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
      body.userData = { type: 'ricochet_bumper' };
      world.addBody(body);
      this.bodies.push(body);
    }
  }
}

registerMechanic('ricochet_bumpers', (world, group, config, sh) => new RicochetBumpers(world, group, config, sh));

export { RicochetBumpers };
