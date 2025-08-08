import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseElement } from './BaseElement';

/**
 * WallElement - A standalone wall element
 * Demonstrates how to create a specialized course element extending BaseElement
 */
export class WallElement extends BaseElement {
  constructor(world, config, scene) {
    // Ensure config has required fields with defaults
    const wallConfig = {
      ...config,
      type: 'wall',
      name: config.name || 'Wall',
      position: config.position || new THREE.Vector3(0, 0, 0)
    };

    // Call base constructor
    super(world, wallConfig, scene);

    // Wall-specific properties
    this.width = config.width || 4;
    this.height = config.height || 1.0;
    this.depth = config.depth || 0.2;
    this.rotation = config.rotation || 0; // Rotation around Y axis in radians
    this.color = config.color || 0xa0522d; // Default brown color
  }

  /**
   * Create the wall
   * @override
   */
  create() {
    // Call base implementation first
    super.create();

    // Create visuals
    this.createVisuals();

    // Create physics
    this.createPhysics();

    return true;
  }

  /**
   * Create visual components for the wall
   * @override
   */
  createVisuals() {
    // Create a box geometry for the wall
    const wallGeometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.7,
      metalness: 0.2,
      side: THREE.DoubleSide
    });

    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);

    // Position wall with bottom at ground level
    wallMesh.position.y = this.height / 2;

    // Apply rotation around Y axis
    wallMesh.rotation.y = this.rotation;

    // Enable shadows
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    this.group.add(wallMesh);
    this.meshes.push(wallMesh);

    // Optionally add some detail like beveled edges or texture
    this.addWallDetails(wallMesh);

    return true;
  }

  /**
   * Add detailed elements to make the wall look more interesting
   */
  addWallDetails(wallMesh) {
    // Add a subtle edge highlight
    const edgeGeometry = new THREE.EdgesGeometry(wallMesh.geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.color).lerp(new THREE.Color(0xffffff), 0.3),
      linewidth: 1
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);

    wallMesh.add(edges);

    // Optionally add some additional detailing based on wall type
    if (this.config.wallType === 'stone') {
      this.addStonePattern(wallMesh);
    } else if (this.config.wallType === 'wood') {
      this.addWoodPattern(wallMesh);
    }
  }

  /**
   * Add stone pattern to wall (example detail method)
   */
  addStonePattern(_wallMesh) {
    // In a real implementation, this would add a stone texture or geometry detail
  }

  /**
   * Add wood pattern to wall (example detail method)
   */
  addWoodPattern(_wallMesh) {
    // In a real implementation, this would add a wood texture or geometry detail
  }

  /**
   * Create physics components for the wall
   * @override
   */
  createPhysics() {
    // Create a static body for the wall
    const wallBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.world.bumperMaterial || null,
      position: new CANNON.Vec3(this.position.x, this.height / 2, this.position.z)
    });

    // Create a box shape with half-extents (Cannon.js convention)
    const halfExtents = new CANNON.Vec3(this.width / 2, this.height / 2, this.depth / 2);
    const wallShape = new CANNON.Box(halfExtents);
    wallBody.addShape(wallShape);

    // Apply rotation to match visual rotation
    wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.rotation);

    // Add user data for identification in collision callbacks
    wallBody.userData = {
      type: 'wall',
      elementId: this.id,
      elementType: this.elementType,
      restitution: this.config.restitution || 0.4 // How bouncy is the wall
    };

    this.world.addBody(wallBody);
    this.bodies.push(wallBody);

    return true;
  }
}
