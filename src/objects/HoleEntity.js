import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CSG } from 'three-csg-ts';
import { BaseElement } from './BaseElement';
import { createHazard } from './hazards/HazardFactory';

// Helper function to get bounding box of the shape
function getShapeBounds(shapePoints) {
  if (!shapePoints || shapePoints.length === 0) {
    return {
      min: new THREE.Vector2(0, 0),
      max: new THREE.Vector2(0, 0),
      center: new THREE.Vector2(0, 0),
      size: new THREE.Vector2(0, 0)
    };
  }
  const bounds = new THREE.Box2();
  bounds.setFromPoints(shapePoints);
  const center = new THREE.Vector2();
  bounds.getCenter(center);
  const size = new THREE.Vector2();
  bounds.getSize(size);
  return { min: bounds.min, max: bounds.max, center, size };
}

/**
 * HoleEntity - Encapsulates all resources and physics for a single hole
 * Now extends BaseElement
 * EXPECTS: All positions in config (startPosition, holePosition, hazards, bumpers) = WORLD coordinates relative to (0,0,0)
 */
export class HoleEntity extends BaseElement {
  constructor(world, config, scene) {
    // Scene can be a THREE.Group when used with NineHoleCourse
    const sceneIsGroup = scene instanceof THREE.Group;
    const actualScene = sceneIsGroup ? scene.parent || scene : scene;
    const targetGroup = sceneIsGroup ? scene : null; // The specific group for this hole if provided

    // BaseElement config: Use (0,0,0) as the position for the HoleEntity's group itself.
    // The actual geometry placement will use the WORLD coordinates from the config.
    const baseConfig = {
      ...config,
      position: new THREE.Vector3(0, 0, 0), // Force HoleEntity group to be at world origin
      type: 'hole',
      name: `Hole ${config.index + 1}`
    };

    // BaseElement constructor creates this.group at baseConfig.position (0,0,0)
    super(world, baseConfig, actualScene);

    // Store the target group if one was provided (e.g., Hole_1_Group)
    // If targetGroup exists, add this.group (at 0,0,0) to it.
    // Otherwise, add this.group directly to the main scene.
    if (targetGroup) {
      if (this.group && !this.group.parent) {
        targetGroup.add(this.group);
      }
      this.parentGroup = targetGroup; // Store reference if needed
    } else {
      if (this.group && !this.group.parent) {
        this.scene.add(this.group);
      }
      this.parentGroup = null;
    }

    // Validate boundary shape - handle both regular and compound shapes
    if (config.boundaryShapeDef && config.boundaryShapeDef.outer) {
      // For compound shapes, use the outer boundary for walls
      this.boundaryShape = config.boundaryShapeDef.outer.map(p => new THREE.Vector2(p.x, p.y));
    } else if (Array.isArray(config.boundaryShape) && config.boundaryShape.length >= 3) {
      this.boundaryShape = config.boundaryShape.map(p => new THREE.Vector2(p.x, p.y)); // Ensure Vector2, use y for world z
    } else {
      // Default rectangular shape if invalid
      this.boundaryShape = [
        new THREE.Vector2(-2, -10),
        new THREE.Vector2(-2, 10),
        new THREE.Vector2(2, 10),
        new THREE.Vector2(2, -10),
        new THREE.Vector2(-2, -10)
      ];
    }

    // Hole-specific properties
    this.wallHeight = 1.0;
    this.wallThickness = 0.2;
    this.holeRadius = 0.35; // Physics radius
    this.surfaceHeight = 0.2; // Local Y height of the green surface relative to group (0,0,0)
    this.visualGreenY = this.surfaceHeight;

    // Store WORLD coordinates from config, ensuring they are Vector3
    this.worldStartPosition =
      config.startPosition instanceof THREE.Vector3
        ? config.startPosition.clone()
        : new THREE.Vector3(
            config.startPosition?.x || 0,
            config.startPosition?.y || 0,
            config.startPosition?.z || 0
          );
    this.worldHolePosition =
      config.holePosition instanceof THREE.Vector3
        ? config.holePosition.clone()
        : new THREE.Vector3(
            config.holePosition?.x || 0,
            config.holePosition?.y || 0,
            config.holePosition?.z || 0
          );

    console.log(`[HoleEntity] Created for hole index ${config.index + 1}. Group at (0,0,0).`);
    console.log(
      `[HoleEntity] World Start: (${this.worldStartPosition.x}, ${this.worldStartPosition.z}), World Hole: (${this.worldHolePosition.x}, ${this.worldHolePosition.z})`
    );
  }

  init() {
    if (!this.world || !this.scene || !this.group) {
      console.error('[HoleEntity] Missing world, scene, or group reference during init');
      return Promise.reject('Missing references');
    }

    try {
      // Create elements using WORLD coordinates from config
      this.createGreenSurfaceAndPhysics();
      this.createWalls();
      this.createHoleRim();
      this.createHoleVisual();
      this.createHoleTrigger();
      this.createStartPosition();
      this.createHazards();
      this.createBumpers();
      console.log(`[HoleEntity] Initialization complete for hole index ${this.config.index}.`);
      return Promise.resolve();
    } catch (error) {
      console.error(
        `[HoleEntity] Error during initialization for hole ${this.config.index}:`,
        error
      );
      this.destroy();
      return Promise.reject(error);
    }
  }

  /**
   * Check if shape type is known to be self-intersecting
   * @returns {boolean} True if shape may self-intersect
   * @private
   */
  isSelfIntersectingShape() {
    // Figure-8/lemniscate is known to self-intersect
    return this.config.shapeType === 'figure8';
  }

  createGreenSurfaceAndPhysics() {
    const greenMaterial = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      roughness: 0.8,
      metalness: 0.1
    });
    const greenDepth = 0.01; // Thickness for extrusion

    // Create shape from boundary points (using Vector2's y as world z)
    let shape;
    if (this.config.boundaryShapeDef && this.config.boundaryShapeDef.outer) {
      // New method: Use outer shape and holes
      shape = new THREE.Shape(this.config.boundaryShapeDef.outer);
      if (this.config.boundaryShapeDef.holes) {
        this.config.boundaryShapeDef.holes.forEach(holePoints => {
          const holePath = new THREE.Path(holePoints);
          shape.holes.push(holePath);
        });
      }
    } else if (this.config.boundaryShape) {
      // Original method: Use a single boundary path
      shape = new THREE.Shape(this.config.boundaryShape);
    } else {
      console.error(
        `[HoleEntity] No valid boundaryShape or boundaryShapeDef found for hole ${this.config.index}`
      );
      return; // Cannot create green without shape definition
    }


    // Extrude the shape slightly to give it depth
    const extrudeSettings = { depth: greenDepth, bevelEnabled: false };
    const baseGreenGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // ExtrudeGeometry creates in XY plane, rotate to XZ plane
    baseGreenGeometry.rotateX(-Math.PI / 2);

    const baseGreenMesh = new THREE.Mesh(baseGreenGeometry);
    // Position mesh LOCALLY relative to group (0,0,0)
    // Need to offset slightly because extrusion depth goes in +Y after rotation
    baseGreenMesh.position.y = this.surfaceHeight - greenDepth / 2;
    baseGreenMesh.updateMatrix();

    // --- Cutters (use WORLD coords from config) ---
    const cutters = [];
    // Hole Cutter
    const visualHoleRadius = 0.4;
    // Make cutter height slightly larger than extrusion depth + buffer
    const mainHoleCutterHeight = greenDepth + 0.1;
    const mainHoleCutterGeometry = new THREE.CylinderGeometry(
      visualHoleRadius,
      visualHoleRadius,
      mainHoleCutterHeight,
      32
    );
    const mainHoleCutterMesh = new THREE.Mesh(mainHoleCutterGeometry);
    // Position cutter at WORLD hole position, adjusted for local surface height
    // Center cutter vertically relative to the green surface mesh's center
    mainHoleCutterMesh.position.set(
      this.worldHolePosition.x,
      baseGreenMesh.position.y,
      this.worldHolePosition.z
    );
    mainHoleCutterMesh.updateMatrix();
    cutters.push(mainHoleCutterMesh);

    // Hazard Cutters
    (this.config.hazards || []).forEach(hazardConfig => {
      if (hazardConfig.type === 'sand' || hazardConfig.type === 'water') {
        const hazardCutterHeight = greenDepth + 0.1; // Match main cutter height
        // Ensure hazard position is WORLD Vector3
        const hazardWorldPos =
          hazardConfig.position instanceof THREE.Vector3
            ? hazardConfig.position.clone()
            : new THREE.Vector3(hazardConfig.position?.x || 0, 0, hazardConfig.position?.z || 0);

        if (hazardConfig.shape === 'circle' && hazardConfig.size?.radius) {
          const cutterGeom = new THREE.CylinderGeometry(
            hazardConfig.size.radius,
            hazardConfig.size.radius,
            hazardCutterHeight,
            32
          );
          const cutterMesh = new THREE.Mesh(cutterGeom);
          // Position cutter vertically centered with the green mesh
          cutterMesh.position.set(hazardWorldPos.x, baseGreenMesh.position.y, hazardWorldPos.z);
          cutterMesh.updateMatrix();
          cutters.push(cutterMesh);
        } else if (
          hazardConfig.shape === 'rectangle' &&
          hazardConfig.size?.width &&
          hazardConfig.size?.length
        ) {
          const cutterGeom = new THREE.BoxGeometry(
            hazardConfig.size.width,
            hazardCutterHeight,
            hazardConfig.size.length
          );
          const cutterMesh = new THREE.Mesh(cutterGeom);
          // Position cutter vertically centered with the green mesh
          cutterMesh.position.set(hazardWorldPos.x, baseGreenMesh.position.y, hazardWorldPos.z);
          if (hazardConfig.rotation) {
            cutterMesh.rotation.copy(hazardConfig.rotation);
          }
          cutterMesh.updateMatrix();
          cutters.push(cutterMesh);
        }
      }
    });

    // Perform CSG
    let currentGreenMesh = baseGreenMesh;
    cutters.forEach(cutter => {
      currentGreenMesh = CSG.subtract(currentGreenMesh, cutter);
    });
    const finalVisualGreenMesh = currentGreenMesh;
    finalVisualGreenMesh.material = greenMaterial;
    finalVisualGreenMesh.castShadow = false;
    finalVisualGreenMesh.receiveShadow = true;
    // Add final mesh to the group (at 0,0,0), its internal geometry is correctly positioned relative to the group center
    this.group.add(finalVisualGreenMesh);
    this.meshes.push(finalVisualGreenMesh);

    // --- Physics Body (Simple large plane for now, rely on walls for containment) ---
    // Get bounds of the shape to make a reasonable plane size
    const shapeBounds = getShapeBounds(this.boundaryShape);
    const physicsPlaneWidth = shapeBounds.size.x > 0 ? shapeBounds.size.x + 10 : 20; // Add padding
    const physicsPlaneLength = shapeBounds.size.y > 0 ? shapeBounds.size.y + 10 : 40; // Add padding

    const physicsPlaneGeom = new THREE.PlaneGeometry(physicsPlaneWidth, physicsPlaneLength, 1, 1);
    const physicsGroundMaterial = this.world.groundMaterial;
    const vertices = physicsPlaneGeom.attributes.position.array;
    const indices = physicsPlaneGeom.index.array;
    const groundShape = new CANNON.Trimesh(vertices, indices);
    const groundBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: physicsGroundMaterial
    });

    // Plane needs local rotation to lie flat on XZ
    const planeLocalRotation = new CANNON.Quaternion().setFromAxisAngle(
      new CANNON.Vec3(1, 0, 0),
      -Math.PI / 2
    );
    groundBody.addShape(groundShape, new CANNON.Vec3(0, 0, 0), planeLocalRotation);

    // Position the physics plane at the correct height, centered based on shape bounds
    groundBody.position.set(0, this.surfaceHeight, 0);
    groundBody.quaternion.set(0, 0, 0, 1); // No world rotation for the body itself

    groundBody.userData = { type: 'green', holeIndex: this.config.index };
    this.world.addBody(groundBody);
    this.bodies.push(groundBody);
    physicsPlaneGeom.dispose();
  }

  createHoleRim() {
    // Use WORLD hole position
    const visualHoleRadius = 0.4;
    const rimGeometry = new THREE.RingGeometry(visualHoleRadius, visualHoleRadius + 0.04, 32);
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.3,
      metalness: 0.9
    });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.rotation.x = -Math.PI / 2;
    const rimY = this.visualGreenY + 0.002; // Local Y offset from green surface
    // Position mesh at WORLD hole position, adjusted for local Y offset
    rim.position.set(this.worldHolePosition.x, rimY, this.worldHolePosition.z);
    rim.receiveShadow = true;
    this.group.add(rim); // Add to group at (0,0,0)
    this.meshes.push(rim);
  }

  createHoleVisual() {
    // Use WORLD hole position
    const holeInteriorRadius = 0.4;
    const holeInteriorDepth = 0.25;
    const interiorGeometry = new THREE.CylinderGeometry(
      holeInteriorRadius,
      holeInteriorRadius,
      holeInteriorDepth,
      32,
      1,
      true
    );
    const interiorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const holeInteriorMesh = new THREE.Mesh(interiorGeometry, interiorMaterial);
    const topEdgeY = this.visualGreenY + 0.01; // Local Y target for top edge
    const cylinderCenterY = topEdgeY - holeInteriorDepth / 2; // Local Y for cylinder center
    // Position mesh at WORLD hole position, adjusted for local Y center
    holeInteriorMesh.position.set(
      this.worldHolePosition.x,
      cylinderCenterY,
      this.worldHolePosition.z
    );
    holeInteriorMesh.castShadow = false;
    holeInteriorMesh.receiveShadow = true;
    this.group.add(holeInteriorMesh); // Add to group at (0,0,0)
    this.meshes.push(holeInteriorMesh);
  }

  createWalls() {
    // Wall definitions use LOCAL offsets from the edges (relative to 0,0,0 group center)
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xa0522d,
      roughness: 0.7,
      metalness: 0.3
    });

    // For complex shapes, merge very short segments to avoid excessive wall pieces
    const minSegmentLength = 0.5; // Minimum wall segment length
    const mergedSegments = [];
    let currentStart = this.boundaryShape[0];
    let accumulatedLength = 0;

    // Iterate through the boundary shape segments
    for (let i = 0; i < this.boundaryShape.length - 1; i++) {
      const startPoint = this.boundaryShape[i]; // Vector2 (x, z)
      const endPoint = this.boundaryShape[i + 1]; // Vector2 (x, z)

      const segmentVector = new THREE.Vector2().subVectors(endPoint, startPoint);
      const length = segmentVector.length();
      if (length < 0.01) {
        continue;
      } // Skip zero-length segments

      // For complex shapes with many points, optimize wall generation
      if (this.boundaryShape.length > 50 && length < minSegmentLength) {
        accumulatedLength += length;
        if (accumulatedLength >= minSegmentLength || i === this.boundaryShape.length - 2) {
          mergedSegments.push({ start: currentStart, end: endPoint });
          currentStart = endPoint;
          accumulatedLength = 0;
        }
      } else {
        if (accumulatedLength > 0) {
          mergedSegments.push({ start: currentStart, end: startPoint });
          accumulatedLength = 0;
        }
        mergedSegments.push({ start: startPoint, end: endPoint });
        currentStart = endPoint;
      }
    }

    // Use merged segments for complex shapes, original segments for simple shapes
    const segmentsToUse = mergedSegments.length > 0 ? mergedSegments : 
      this.boundaryShape.slice(0, -1).map((p, i) => ({ 
        start: p, 
        end: this.boundaryShape[i + 1] 
      }));

    // Create walls for each segment
    segmentsToUse.forEach((segment, i) => {
      const startPoint = segment.start;
      const endPoint = segment.end;

      const segmentVector = new THREE.Vector2().subVectors(endPoint, startPoint);
      const length = segmentVector.length();
      if (length < 0.01) return; // Skip tiny segments

      const angle = Math.atan2(segmentVector.y, segmentVector.x); // Angle in XZ plane

      const midPoint = new THREE.Vector2().addVectors(startPoint, endPoint).multiplyScalar(0.5);
      const wallYPosition = this.surfaceHeight + this.wallHeight / 2;

      // Create visual mesh
      // Geometry is created along X-axis, then rotated
      const geometry = new THREE.BoxGeometry(length, this.wallHeight, this.wallThickness);
      const mesh = new THREE.Mesh(geometry, wallMaterial);

      // Position mesh at midpoint, adjusted for height
      mesh.position.set(midPoint.x, wallYPosition, midPoint.y); // Use Vector2's y for world z
      mesh.rotation.y = angle; // Rotate around Y-axis
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.meshes.push(mesh);

      // Create physics body
      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        material: this.world.bumperMaterial
      });
      // CANNON Box extents are half-sizes
      const halfExtents = new CANNON.Vec3(length / 2, this.wallHeight / 2, this.wallThickness / 2);
      body.addShape(new CANNON.Box(halfExtents));

      // Position body at the same world location as the mesh
      body.position.set(midPoint.x, wallYPosition, midPoint.y);

      // Set rotation using quaternion from angle around Y axis
      const wallQuaternion = new CANNON.Quaternion();
      wallQuaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
      body.quaternion.copy(wallQuaternion);

      body.userData = { type: `wall_segment_${i}`, holeIndex: this.config.index };
      this.world.addBody(body);
      this.bodies.push(body);
    });

    console.log(`[HoleEntity] Created ${segmentsToUse.length} wall segments for hole ${this.config.index + 1} (original points: ${this.boundaryShape.length})`);
    
    // Add special handling for self-intersecting shapes
    if (this.isSelfIntersectingShape()) {
      this.addInvisibleGuideWalls();
    }
  }

  /**
   * Add invisible physics walls for complex shapes to prevent ball from getting stuck
   * @private
   */
  addInvisibleGuideWalls() {
    // For figure-8, add small invisible walls at the crossing point
    if (this.config.shapeType === 'figure8') {
      const crossingY = this.surfaceHeight + this.wallHeight / 2;
      
      // Add small diagonal guide walls at center to prevent ball getting stuck
      const guideConfigs = [
        { pos: new THREE.Vector3(0.3, crossingY, 0.3), angle: Math.PI / 4, length: 0.5 },
        { pos: new THREE.Vector3(-0.3, crossingY, -0.3), angle: Math.PI / 4, length: 0.5 },
        { pos: new THREE.Vector3(0.3, crossingY, -0.3), angle: -Math.PI / 4, length: 0.5 },
        { pos: new THREE.Vector3(-0.3, crossingY, 0.3), angle: -Math.PI / 4, length: 0.5 }
      ];

      guideConfigs.forEach((config, idx) => {
        const body = new CANNON.Body({
          mass: 0,
          type: CANNON.Body.STATIC,
          material: this.world.bumperMaterial
        });
        
        const halfExtents = new CANNON.Vec3(config.length / 2, this.wallHeight / 2, this.wallThickness / 4);
        body.addShape(new CANNON.Box(halfExtents));
        body.position.copy(config.pos);
        
        const guideQuaternion = new CANNON.Quaternion();
        guideQuaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), config.angle);
        body.quaternion.copy(guideQuaternion);
        
        body.userData = { type: `guide_wall_${idx}`, holeIndex: this.config.index };
        this.world.addBody(body);
        this.bodies.push(body);
      });
      
      console.log(`[HoleEntity] Added invisible guide walls for figure-8 shape at hole ${this.config.index + 1}`);
    }
  }

  createHoleTrigger() {
    // Trigger body needs WORLD position.
    const triggerRadius = this.holeRadius + 0.05;
    const triggerHeight = 0.1;
    const holeTriggerBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      isTrigger: true,
      material: null
    });
    const triggerShape = new CANNON.Cylinder(triggerRadius, triggerRadius, triggerHeight, 16);
    holeTriggerBody.addShape(triggerShape);

    // Position trigger at WORLD hole position, adjusted for green surface height (which is relative to 0)
    holeTriggerBody.position.set(
      this.worldHolePosition.x,
      this.visualGreenY,
      this.worldHolePosition.z
    );
    // No body rotation needed for Y-up cylinder

    holeTriggerBody.userData = { type: 'holeTrigger', holeIndex: this.config.index };
    this.world.addBody(holeTriggerBody);
    this.bodies.push(holeTriggerBody);
  }

  createStartPosition() {
    // Use shape-specific geometry for tee markers
    let teeGeometry;
    let teeColor = 0x0077cc; // Default blue
    
    // Create shape-specific tee markers for visual interest
    switch(this.config.shapeType) {
      case 'circle':
        teeGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 32);
        teeColor = 0x0088ff; // Bright blue for launch pad
        break;
      case 'star':
        teeGeometry = new THREE.CylinderGeometry(0.5, 0.6, 0.05, 5); // 5-sided for star
        teeColor = 0xffaa00; // Gold for star
        break;
      case 'spiral':
        teeGeometry = new THREE.CylinderGeometry(0.4, 0.7, 0.05, 6); // Tapered hex
        teeColor = 0x9933ff; // Purple for wormhole
        break;
      case 'figure8':
        teeGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 8); // 8-sided
        teeColor = 0xff6600; // Orange for Saturn's rings
        break;
      case 'cross':
        teeGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 4); // Square base
        teeColor = 0x333333; // Dark for gravity well
        break;
      case 'diamond':
        teeGeometry = new THREE.CylinderGeometry(0.5, 0.6, 0.05, 4); // Diamond shape
        teeColor = 0xff00ff; // Magenta for galactic core
        break;
      default:
        teeGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 24);
        break;
    }
    
    const teeMaterial = new THREE.MeshStandardMaterial({
      color: teeColor,
      roughness: 0.5,
      metalness: 0.3,
      emissive: teeColor,
      emissiveIntensity: 0.1 // Slight glow
    });
    
    const teeMesh = new THREE.Mesh(teeGeometry, teeMaterial);
    // Position mesh at WORLD start position, adjusted for local Y offset
    teeMesh.position.copy(this.worldStartPosition);
    teeMesh.position.y = this.visualGreenY + 0.03; // Y offset relative to surface
    
    // Add rotation for visual interest on some shapes
    if (this.config.shapeType === 'diamond' || this.config.shapeType === 'cross') {
      teeMesh.rotation.y = Math.PI / 4; // 45 degree rotation
    }
    
    teeMesh.castShadow = true;
    teeMesh.receiveShadow = true;
    this.group.add(teeMesh); // Add to group at (0,0,0)
    this.meshes.push(teeMesh);
  }

  createHazards() {
    // Assumes HazardFactory positions elements LOCALLY within the provided group
    // We pass this.group (at 0,0,0) and hazard configs with WORLD positions
    // HazardFactory needs to handle this correctly or be updated.
    // FOR NOW: Assuming HazardFactory adds meshes/bodies directly to world using config coords.
    const hazardConfigs = this.config.hazards || [];
    if (hazardConfigs.length === 0) {
      return;
    }

    hazardConfigs.forEach(hazardConfig => {
      try {
        // Ensure position is WORLD Vector3
        const worldHazardPos =
          hazardConfig.position instanceof THREE.Vector3
            ? hazardConfig.position.clone()
            : new THREE.Vector3(
                hazardConfig.position?.x || 0,
                hazardConfig.position?.y || 0,
                hazardConfig.position?.z || 0
              );

        // Create config to pass, ensuring WORLD position is used
        const factoryConfig = {
          ...hazardConfig,
          position: worldHazardPos // Pass WORLD position
        };

        // Call factory - EXPECTS it to place things using WORLD coords now
        const { meshes, bodies } = createHazard(
          this.world,
          this.group, // Pass group (at 0,0,0) - Factory might ignore this for positioning now
          factoryConfig,
          this.visualGreenY // Pass surface height relative to 0
        );
        this.meshes.push(...meshes); // Track meshes created by factory
        this.bodies.push(...bodies); // Track bodies created by factory
      } catch (error) {
        console.error('[HoleEntity] Failed to create hazard:', error, hazardConfig);
      }
    });
  }

  createBumpers() {
    // Bumpers defined with WORLD coordinates relative to origin (0,0,0)
    const bumperConfigs = this.config.bumpers || [];
    if (bumperConfigs.length === 0) {
      return;
    }

    bumperConfigs.forEach((bumperConfig, index) => {
      try {
        // Ensure bumper position is WORLD Vector3
        const worldBumperPos =
          bumperConfig.position instanceof THREE.Vector3
            ? bumperConfig.position.clone()
            : new THREE.Vector3(
                bumperConfig.position?.x || 0,
                bumperConfig.position?.y || 0,
                bumperConfig.position?.z || 0
              );

        // Ensure bumper rotation is Euler
        const worldBumperRot =
          bumperConfig.rotation instanceof THREE.Euler
            ? bumperConfig.rotation.clone()
            : new THREE.Euler(
                bumperConfig.rotation?.x || 0,
                bumperConfig.rotation?.y || 0,
                bumperConfig.rotation?.z || 0
              );

        // Create visual mesh
        const bumperMaterial = new THREE.MeshStandardMaterial({
          color: bumperConfig.color || 0xff8c00,
          roughness: 0.7,
          metalness: 0.3
        });
        const bumperGeom = new THREE.BoxGeometry(
          bumperConfig.size.x,
          bumperConfig.size.y,
          bumperConfig.size.z
        );
        const bumperMesh = new THREE.Mesh(bumperGeom, bumperMaterial);
        // Position mesh at WORLD coordinates
        bumperMesh.position.copy(worldBumperPos);
        bumperMesh.rotation.copy(worldBumperRot);
        bumperMesh.castShadow = true;
        bumperMesh.receiveShadow = true;
        this.group.add(bumperMesh); // Add to group at (0,0,0)
        this.meshes.push(bumperMesh);

        // --- Physics Body --- (Also uses WORLD transform)
        const bumperBody = new CANNON.Body({
          type: CANNON.Body.STATIC,
          mass: 0,
          material: this.world.bumperMaterial
        });
        const halfExtents = new CANNON.Vec3(
          bumperConfig.size.x / 2,
          bumperConfig.size.y / 2,
          bumperConfig.size.z / 2
        );
        const bumperShape = new CANNON.Box(halfExtents);
        bumperBody.addShape(bumperShape);

        // Position body at WORLD coordinates
        bumperBody.position.copy(worldBumperPos);
        // Convert world Euler rotation to Cannon Quaternion
        const worldBumperQuatCANNON = new CANNON.Quaternion();
        worldBumperQuatCANNON.setFromEuler(
          worldBumperRot.x,
          worldBumperRot.y,
          worldBumperRot.z,
          worldBumperRot.order
        );
        bumperBody.quaternion.copy(worldBumperQuatCANNON);

        bumperBody.userData = { type: 'bumper', holeIndex: this.config.index };
        this.world.addBody(bumperBody);
        this.bodies.push(bumperBody);
      } catch (error) {
        console.error(`[HoleEntity] Failed to create bumper ${index}:`, error, bumperConfig);
      }
    });
  }

  /**
   * Destroy the HoleEntity's internal components (meshes, bodies)
   * but leaves the main container group (this.group or this.parentGroup) intact.
   */
  destroy() {
    console.log(`[HoleEntity] Destroying components for Hole ${this.config.index + 1}`);

    // Remove physics bodies
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const body = this.bodies[i];
      if (body && this.world) {
        this.world.removeBody(body);
      }
    }
    this.bodies = [];

    // Remove meshes from the hole's group (this.group or this.parentGroup)
    const containerGroup = this.parentGroup || this.group;
    for (let i = this.meshes.length - 1; i >= 0; i--) {
      const mesh = this.meshes[i];
      if (mesh) {
        // Meshes should be children of the containerGroup
        if (mesh.parent === containerGroup) {
          containerGroup.remove(mesh);
        } else if (mesh.parent) {
          // If parented elsewhere unexpectedly, still remove
          console.warn(`[HoleEntity] Mesh ${mesh.name} had unexpected parent during cleanup.`);
          mesh.parent.remove(mesh);
        }

        // Dispose geometry and material
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => mat?.dispose());
          } else if (mesh.material.dispose) {
            mesh.material.dispose();
          }
        }
      }
    }
    this.meshes = [];

    // DO NOT remove this.group or this.parentGroup from the scene here.
    // The NineHoleCourse manages those groups.
    console.log(`[HoleEntity] Component cleanup complete for Hole ${this.config.index + 1}`);
    // Setting group to null might cause issues if reused, let NineHoleCourse manage it.
    // this.group = null;
  }

}
