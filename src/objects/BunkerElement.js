import { debug } from '../utils/debug';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseElement } from './BaseElement';

/**
 * BunkerElement - A standalone sand bunker element
 * Demonstrates how to create a specialized course element extending BaseElement
 */
export class BunkerElement extends BaseElement {
  constructor(world, config, scene) {
    // Ensure config has required fields with defaults
    const bunkerConfig = {
      ...config,
      type: 'bunker',
      name: config.name || 'Sand Bunker',
      position: config.position || new THREE.Vector3(0, 0, 0)
    };

    // Call base constructor
    super(world, bunkerConfig, scene);

    // Bunker-specific properties
    this.radius = config.radius || 2;
    this.depth = config.depth || 0.3;
    this.sandColor = config.sandColor || 0xe6c388;
  }

  /**
   * Create the bunker
   * @override
   */
  create() {
    // Call base implementation first
    super.create();

    debug.log(`[BunkerElement] Creating sand bunker ${this.name}`);

    // Create visuals
    this.createVisuals();

    // Create physics
    this.createPhysics();

    return true;
  }

  /**
   * Create visual components for the bunker
   * @override
   */
  createVisuals() {
    // Create the depression visually representing the bunker
    // This can be a simple plane with sand texture
    const sandMaterial = new THREE.MeshStandardMaterial({
      color: this.sandColor,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    // Create a slightly concave surface for the bunker
    const segments = 32;
    const sandGeometry = new THREE.CircleGeometry(this.radius, segments);

    // Add some vertex displacement to create a natural look
    const positionAttribute = sandGeometry.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      // Skip center vertex
      if (x !== 0 || y !== 0) {
        const distanceFromCenter = Math.sqrt(x * x + y * y);
        const ratio = distanceFromCenter / this.radius;
        // Apply depression curve
        const depth = (1 - ratio * ratio) * this.depth * 0.5;
        positionAttribute.setZ(i, -depth);
      }
    }

    // Update geometry
    sandGeometry.computeVertexNormals();

    // Create mesh
    const sandMesh = new THREE.Mesh(sandGeometry, sandMaterial);
    sandMesh.rotation.x = -Math.PI / 2; // Lay flat
    sandMesh.position.y = 0.001; // Slightly above ground
    sandMesh.receiveShadow = true;

    this.group.add(sandMesh);
    this.meshes.push(sandMesh);

    // Optionally add some detail like sand pebbles or footprints
    this.addSandDetails();

    debug.log(`[BunkerElement] Created sand bunker visuals with radius ${this.radius}`);
    return true;
  }

  /**
   * Add detailed elements to make the sand look more realistic
   */
  addSandDetails() {
    // Add small random bumps to simulate sand texture
    const detailCount = Math.floor(this.radius * 15);
    const detailGeometry = new THREE.SphereGeometry(0.03, 8, 8);
    const detailMaterial = new THREE.MeshStandardMaterial({
      color: this.sandColor,
      roughness: 1.0,
      metalness: 0.0
    });

    const detailGroup = new THREE.Group();

    for (let i = 0; i < detailCount; i++) {
      // Random position within circle
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * this.radius * 0.9; // Stay within bunker

      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      const detail = new THREE.Mesh(detailGeometry, detailMaterial);
      detail.position.set(x, 0.005, z); // Slightly above sand level
      detail.scale.set(
        0.5 + Math.random() * 1.0,
        0.3 + Math.random() * 0.5,
        0.5 + Math.random() * 1.0
      );
      detail.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      detail.castShadow = true;

      detailGroup.add(detail);
    }

    this.group.add(detailGroup);
    this.meshes.push(detailGroup);
  }

  /**
   * Create physics components for the bunker
   * @override
   */
  createPhysics() {
    // Create trigger zone for bunker physics effects
    const triggerBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      collisionResponse: false, // Makes it a trigger
      position: new CANNON.Vec3(this.position.x, this.position.y, this.position.z),
      collisionFilterGroup: 8, // Trigger group
      collisionFilterMask: 4 // Ball group
    });

    // Create a cylinder shape for the trigger zone
    const triggerShape = new CANNON.Cylinder(
      this.radius, // Top radius
      this.radius, // Bottom radius
      this.depth, // Height
      16 // Segments
    );
    triggerBody.addShape(triggerShape);

    // Rotate to correct orientation
    triggerBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

    // Add user data for identification in collision callbacks
    triggerBody.userData = {
      type: 'bunker_trigger',
      elementId: this.id,
      elementType: this.elementType,
      // Additional physics parameters can be added here
      frictionModifier: 2.0, // Increase friction in sand
      dampingModifier: 3.0 // Increase damping in sand
    };

    this.world.addBody(triggerBody);
    this.bodies.push(triggerBody);

    debug.log(
      `[BunkerElement] Created bunker physics trigger at (${this.position.x}, ${this.position.y}, ${this.position.z})`
    );
    return true;
  }
}
