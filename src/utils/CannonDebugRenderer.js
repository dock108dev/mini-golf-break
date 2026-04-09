import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { debug } from './debug';

export class CannonDebugRenderer {
  constructor(scene, world, options = {}) {
    this.scene = scene;
    this.world = world;

    this._meshes = [];

    this._material = new THREE.MeshBasicMaterial({
      color: options.color || 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: options.opacity || 0.5
    });

    this._sphereGeometry = new THREE.SphereGeometry(1);
    this._boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this._planeGeometry = new THREE.PlaneGeometry(10, 10, 10, 10);
    this._cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32);
  }

  update() {
    const bodies = this.world.bodies;
    const meshes = this._meshes;

    for (let i = 0; i < meshes.length; i++) {
      this.scene.remove(meshes[i]);
    }
    meshes.length = 0;

    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];

      for (let j = 0; j < body.shapes.length; j++) {
        const shape = body.shapes[j];
        const mesh = this._createMesh(shape);

        if (mesh) {
          // Get world position
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();

          pos.copy(body.position);
          quat.copy(body.quaternion);

          mesh.position.copy(pos);
          mesh.quaternion.copy(quat);

          this._scaleMesh(mesh, shape);

          this.scene.add(mesh);
          this._meshes.push(mesh);
        }
      }
    }
  }

  /**
   * Removes all tracked debug meshes from the scene.
   */
  clearMeshes() {
    this._meshes.forEach(mesh => {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      // Optionally dispose geometry/material if not reused, but basic removal is key
    });
    this._meshes.length = 0; // Clear the tracking array
    debug.log('[CannonDebugRenderer] Cleared tracked meshes.');
  }

  _createMesh(shape) {
    let mesh = null;
    let geometry = null;

    switch (shape.type) {
      case CANNON.Shape.types.SPHERE:
        mesh = new THREE.Mesh(this._sphereGeometry, this._material);
        break;

      case CANNON.Shape.types.BOX:
        mesh = new THREE.Mesh(this._boxGeometry, this._material);
        break;

      case CANNON.Shape.types.PLANE:
        mesh = new THREE.Mesh(this._planeGeometry, this._material);
        break;

      case CANNON.Shape.types.CYLINDER:
        mesh = new THREE.Mesh(this._cylinderGeometry, this._material);
        break;

      case CANNON.Shape.types.TRIMESH: {
        geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array(shape.vertices);
        const indices = new Uint16Array(shape.indices);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        mesh = new THREE.Mesh(geometry, this._material);
        break;
      }

      case CANNON.Shape.types.HEIGHTFIELD: {
        geometry = new THREE.BufferGeometry();
        const v = shape.data.flatMap((row, i) =>
          row.flatMap((height, j) => [i * shape.elementSize, height, j * shape.elementSize])
        );
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        mesh = new THREE.Mesh(geometry, this._material);
        break;
      }

      default:
        console.warn(`Unhandled shape type: ${shape.type}`);
        break;
    }

    return mesh;
  }

  _scaleMesh(mesh, shape) {
    switch (shape.type) {
      case CANNON.Shape.types.SPHERE: {
        const radius = shape.radius;
        mesh.scale.set(radius, radius, radius);
        break;
      }

      case CANNON.Shape.types.BOX:
        mesh.scale.copy(shape.halfExtents);
        mesh.scale.multiplyScalar(2);
        break;

      case CANNON.Shape.types.PLANE:
        break;

      case CANNON.Shape.types.CYLINDER:
        mesh.scale.set(shape.radiusTop, shape.height, shape.radiusTop);
        break;

      case CANNON.Shape.types.TRIMESH:
        mesh.scale.copy(shape.scale);
        break;

      case CANNON.Shape.types.HEIGHTFIELD:
        mesh.scale.set(1, 1, 1);
        break;
    }
  }
}
