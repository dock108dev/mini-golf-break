import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * CourseElementFactory - Creates standardized course elements for golf courses
 */
export class CourseElementFactory {
  /**
   * Create a hole with rim and physics
   * @param {THREE.Scene} scene - Scene to add elements to
   * @param {CANNON.World} physicsWorld - Physics world for collision bodies
   * @param {THREE.Vector3} position - Position for the hole
   * @param {Object} options - Optional parameters for customization
   * @returns {Object} Created hole objects and physics bodies
   */
  static createHole(scene, physicsWorld, position, options = {}) {
    const elements = {};
    // Realistic proportion: Hole radius should be ~2.53 * ball radius (0.2)
    // const ballRadius = 0.2;
    // const realisticHoleRadius = ballRadius * 2.53; // ~0.506
    const holeRadius = options.radius || 0.5; // Use 0.5 (was 0.35)
    const holeDepth = options.depth || 0.3;

    // Create hole bottom (black circle at bottom of hole)
    elements.holeBottom = this.createHoleBottom(scene, position, holeRadius, holeDepth);

    // Create hole walls (to prevent seeing through to space)
    elements.holeWall = this.createHoleWall(scene, position, holeRadius, holeDepth);

    // Create a visible rim around the hole
    elements.rim = this.createHoleRim(scene, position, holeRadius);

    // Create the hole (inner circle) - REMOVED as likely redundant/causing issues
    // elements.hole = this.createHoleInnerCircle(scene, position, holeRadius);

    // Create physics bodies if physics world exists
    if (physicsWorld) {
      elements.bodies = this.createHolePhysics(physicsWorld, position, holeRadius, holeDepth);
    }

    return elements;
  }

  /**
   * Create the bottom of a hole
   */
  static createHoleBottom(scene, position, radius, depth) {
    const holeBottomGeometry = new THREE.CircleGeometry(radius, 32);
    const holeBottomMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000, // Pure black for the hole bottom
      side: THREE.DoubleSide
    });

    const holeBottom = new THREE.Mesh(holeBottomGeometry, holeBottomMaterial);
    holeBottom.rotation.x = -Math.PI / 2;
    holeBottom.position.set(position.x, position.y - depth + 0.005, position.z);

    scene.add(holeBottom);
    return holeBottom;
  }

  /**
   * Create hole walls
   */
  static createHoleWall(scene, position, radius, depth) {
    const holeWallGeometry = new THREE.CylinderGeometry(radius, radius, depth, 32);
    const holeWallMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000, // Black walls
      side: THREE.DoubleSide // Changed from BackSide for robustness
    });

    const holeWall = new THREE.Mesh(holeWallGeometry, holeWallMaterial);
    holeWall.position.set(position.x, position.y - depth / 2, position.z);

    scene.add(holeWall);
    return holeWall;
  }

  /**
   * Create a rim around the hole
   */
  static createHoleRim(scene, position, radius) {
    const rimRadius = radius + 0.1; // Larger rim for better visibility
    const rimGeometry = new THREE.RingGeometry(radius, rimRadius, 32);
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White for better visibility in space
      roughness: 0.7,
      metalness: 0.3,
      emissive: 0xaaaaaa,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide
    });

    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.rotation.x = -Math.PI / 2; // Make it flat on ground
    rim.position.set(position.x, position.y + 0.01, position.z); // Slightly above the ground
    rim.receiveShadow = true;

    scene.add(rim);
    return rim;
  }

  /**
   * Create the inner circle of the hole
   */
  static createHoleInnerCircle(scene, position, radius) {
    const holeGeometry = new THREE.CircleGeometry(radius, 32);
    const holeMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000, // Pure black for the hole
      side: THREE.DoubleSide
    });

    const hole = new THREE.Mesh(holeGeometry, holeMaterial);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(position.x, position.y + 0.008, position.z);

    scene.add(hole);
    return hole;
  }

  /**
   * Create physics bodies for hole
   */
  static createHolePhysics(physicsWorld, position, radius, _depth) {
    const bodies = {};

    // Create a funnel effect leading to the hole
    const funnelRadius = radius * 1.5 + 0.1;
    const funnelShape = new CANNON.Cylinder(funnelRadius, radius, 0.15, 16);
    const funnelBody = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(position.x, position.y - 0.05, position.z),
      shape: funnelShape,
      material: physicsWorld.holeRimMaterial
    });

    // Rotate to align with hole
    funnelBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

    physicsWorld.addBody(funnelBody);
    bodies.funnel = funnelBody;

    // Create a hole trigger to detect when ball is in hole
    const holeTriggerBody = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(position.x, position.y - 0.1, position.z),
      shape: new CANNON.Cylinder(radius * 0.9, radius * 0.9, 0.2, 16),
      material: physicsWorld.defaultMaterial,
      collisionResponse: false // Don't affect ball physics
    });

    // Rotate to align with hole
    holeTriggerBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

    // Set as a trigger for detecting entry
    holeTriggerBody.isTrigger = true;

    // Set collision groups
    holeTriggerBody.collisionFilterGroup = 2; // Holes
    holeTriggerBody.collisionFilterMask = 4; // Collide with ball

    // Add custom user data to identify this as a hole
    holeTriggerBody.userData = { type: 'hole' };

    physicsWorld.addBody(holeTriggerBody);
    bodies.trigger = holeTriggerBody;

    // Create the actual hole depression (a physical depression where the ball can fall into)
    const holePhysicsBody = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(position.x, position.y - 0.15, position.z),
      material: physicsWorld.defaultMaterial
    });

    // Create a plane at the bottom of the hole
    const holePlaneShape = new CANNON.Plane();
    holePhysicsBody.addShape(holePlaneShape);
    holePhysicsBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

    physicsWorld.addBody(holePhysicsBody);
    bodies.bottom = holePhysicsBody;

    return bodies;
  }

  /**
   * Create a flag for a hole
   */
  static createFlag(scene, position, options = {}) {
    const elements = {};
    const flagHeight = options.height || 1.8;

    // Create flagpole
    elements.pole = this.createFlagpole(scene, position, flagHeight);

    // Create flag
    elements.flag = this.createFlagMesh(scene, position, flagHeight);

    // Add a light to highlight the flag
    elements.light = this.createFlagLight(scene, position, flagHeight);

    return elements;
  }

  /**
   * Create a flagpole
   */
  static createFlagpole(scene, position, height) {
    const flagpoleGeometry = new THREE.CylinderGeometry(0.03, 0.03, height, 8);
    const flagpoleMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0e0e0, // Bright white pole
      roughness: 0.4,
      metalness: 0.6,
      emissive: 0xaaaaaa,
      emissiveIntensity: 0.4
    });
    const flagpole = new THREE.Mesh(flagpoleGeometry, flagpoleMaterial);

    // Position the flagpole
    flagpole.position.set(position.x, position.y + height / 2, position.z);
    scene.add(flagpole);

    return flagpole;
  }

  /**
   * Create a flag mesh with animation data
   */
  static createFlagMesh(scene, position, flagHeight) {
    // Add larger flag with waving animation
    const flagWidth = 0.6;
    const flagHeight2 = 0.4;
    const flagSegments = 10; // More segments for wave effect
    const flagGeometry = new THREE.PlaneGeometry(flagWidth, flagHeight2, flagSegments, 1);

    // Create vertices for waving effect (initial state)
    const vertices = flagGeometry.attributes.position.array;
    const originalVertices = [...vertices];
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      // Apply wave effect based on x position
      const waveAmount = (x / flagWidth) * 0.1;
      vertices[i + 1] += Math.sin(x * 5) * waveAmount;
    }

    const flagMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000, // Bright red flag
      emissive: 0xff0000,
      emissiveIntensity: 0.7,
      side: THREE.DoubleSide
    });
    const flag = new THREE.Mesh(flagGeometry, flagMaterial);

    // Position the flag near the top of the pole, offset to one side
    flag.position.set(position.x + 0.3, position.y + flagHeight - 0.2, position.z);
    flag.rotation.y = Math.PI / 2;
    scene.add(flag);

    // Store original vertices for animation
    flag.userData = {
      originalVertices
    };

    // Add checkered pattern to the flag
    this.addCheckerPatternToFlag(flag);

    return flag;
  }

  /**
   * Add a checkered pattern to the flag
   */
  static addCheckerPatternToFlag(flag) {
    const flagWidth = 0.6;
    const flagHeight = 0.4;
    const checkerGeometry = new THREE.PlaneGeometry(flagWidth, flagHeight);
    const checkerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    const checker = new THREE.Mesh(checkerGeometry, checkerMaterial);
    checker.position.set(0, 0, 0.001); // Slightly in front of the flag
    flag.add(checker);

    // Create checkered texture using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    // Draw checker pattern
    const squareSize = canvas.width / 4;
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        const isWhite = (x + y) % 2 === 0;
        context.fillStyle = isWhite ? 'white' : 'transparent';
        context.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
      }
    }

    // Create texture from canvas and apply to checker material
    const texture = new THREE.CanvasTexture(canvas);
    checkerMaterial.map = texture;
    checkerMaterial.needsUpdate = true;

    return checker;
  }

  /**
   * Create a light for the flag
   */
  static createFlagLight(scene, position, flagHeight) {
    // Add a stronger point light at the flag to highlight the hole area
    const flagLight = new THREE.PointLight(0xffffff, 1.2, 12);
    flagLight.position.set(position.x, position.y + flagHeight - 0.1, position.z);
    scene.add(flagLight);

    return flagLight;
  }

  /**
   * Create a fairway between two points
   */
  static createFairway(scene, startPos, endPos, width, length) {
    const elements = {};

    // Calculate direction vector between start and end
    // const direction = new THREE.Vector3().subVectors(endPos, startPos).normalize();

    // Create outer border - brighter for visibility in space
    elements.border = this.createFairwayBorder(scene, startPos, endPos, width, length);

    // Create fairway path
    elements.fairway = this.createFairwayPath(scene, startPos, endPos, width, length);

    return elements;
  }

  /**
   * Create a fairway border
   */
  static createFairwayBorder(scene, startPos, endPos, width, length) {
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0x32cd32, // Lime green for better visibility
      roughness: 0.7,
      metalness: 0.2,
      emissive: 0x006400,
      emissiveIntensity: 0.3
    });

    // Border is slightly larger than fairway
    const borderWidth = width + 0.5;
    const borderLength = length + 0.5;
    const borderGeometry = new THREE.PlaneGeometry(borderWidth, borderLength);
    const border = new THREE.Mesh(borderGeometry, borderMaterial);

    // Calculate midpoint between start and end for positioning
    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);

    // Position border slightly below fairway
    border.position.copy(midPoint);
    border.position.y = 0.003;

    // Rotate to point from start to end
    const direction = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const angle = Math.atan2(direction.x, direction.z);
    border.rotation.set(-Math.PI / 2, 0, angle);

    // Add shadows
    border.receiveShadow = true;

    scene.add(border);
    return border;
  }

  /**
   * Create a fairway path
   */
  static createFairwayPath(scene, startPos, endPos, width, length) {
    const fairwayMaterial = new THREE.MeshStandardMaterial({
      color: 0x7cfc00, // Lawn green for better contrast
      roughness: 0.5,
      metalness: 0.1,
      emissive: 0x228b22,
      emissiveIntensity: 0.2
    });

    // Create a plane that follows the direction
    const fairwayGeometry = new THREE.PlaneGeometry(width, length);
    const fairway = new THREE.Mesh(fairwayGeometry, fairwayMaterial);

    // Calculate midpoint between start and end for positioning
    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);

    // Position fairway just above border
    fairway.position.copy(midPoint);
    fairway.position.y = 0.005;

    // Rotate to point from start to end
    const direction = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const angle = Math.atan2(direction.x, direction.z);
    fairway.rotation.set(-Math.PI / 2, 0, angle);

    // Add shadows
    fairway.receiveShadow = true;

    scene.add(fairway);
    return fairway;
  }

  /**
   * Create walls for a course with physics
   */
  static createWalls(scene, physicsWorld, walls) {
    const createdElements = [];

    walls.forEach(wall => {
      const element = this.createWall(scene, physicsWorld, wall.position, wall.size);
      createdElements.push(element);
    });

    return createdElements;
  }

  /**
   * Create a single wall
   */
  static createWall(scene, physicsWorld, position, size) {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xa0522d, // Brown
      roughness: 0.7,
      metalness: 0.3,
      emissive: 0x3a1f00,
      emissiveIntensity: 0.3
    });

    // Create mesh
    const geometry = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geometry, wallMaterial);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Create physics body
    if (physicsWorld) {
      const body = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(...position),
        shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)),
        material: physicsWorld.bumperMaterial
      });

      physicsWorld.addBody(body);

      return { mesh, body };
    }

    return { mesh };
  }

  /**
   * Animate a flag for waving effect
   */
  static animateFlag(flag, time) {
    if (!flag || !flag.userData || !flag.userData.originalVertices) {
      return;
    }

    const vertices = flag.geometry.attributes.position.array;
    const originalVertices = flag.userData.originalVertices;

    // Update vertices for wave effect
    for (let i = 0; i < vertices.length; i += 3) {
      const x = originalVertices[i]; // Use original x position
      // Increasing wave effect as we move away from flagpole
      const waveStrength = (x / 0.6) * 0.15; // 0.6 is flag width

      // Create wave effect with time-based animation
      vertices[i + 1] = originalVertices[i + 1] + Math.sin(time * 2 + x * 10) * waveStrength;
      vertices[i + 2] = originalVertices[i + 2] + Math.cos(time + x * 5) * waveStrength * 0.5;
    }

    // Need to flag this so three.js knows to update
    flag.geometry.attributes.position.needsUpdate = true;
  }
}
