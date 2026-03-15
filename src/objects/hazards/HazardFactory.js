import { debug } from '../../utils/debug';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CSG } from 'three-csg-ts';

/**
 * Creates a hazard (visuals and physics trigger) based on configuration.
 * @param {CANNON.World} world - The physics world
 * @param {THREE.Group} group - The parent THREE.Group to add visuals to
 * @param {object} hazardConfig - Configuration for the hazard
 * @param {number} visualGreenY - The Y-level of the visual green surface
 * @param {object} courseBounds - Course boundaries for CSG {width, length}
 * @returns {{meshes: THREE.Mesh[], bodies: CANNON.Body[]}} Created meshes and bodies
 */
export function createHazard(world, group, hazardConfig, visualGreenY, courseBounds) {
  debug.log('[HazardFactory] Creating hazard:', hazardConfig);
  switch (hazardConfig.type) {
    case 'sand':
      return createSandHazard(world, group, hazardConfig, visualGreenY, courseBounds);
    case 'water':
      return createWaterHazard(world, group, hazardConfig, visualGreenY, courseBounds);
    default:
      console.warn('[HazardFactory] Unknown hazard type:', hazardConfig.type);
      return { meshes: [], bodies: [] };
  }
}

/**
 * Creates visuals and physics trigger for a sand hazard.
 * Handles simple shapes ('circle', 'rectangle') and 'compound' shapes.
 */
function createSandHazard(world, group, config, visualGreenY, courseBounds) {
  const allMeshes = [];
  const allBodies = [];

  const sandMaterial = new THREE.MeshStandardMaterial({
    color: 0xe6c388, // Sandy color
    roughness: 0.9,
    metalness: 0.1
  });

  const hazardDepth = config.depth || 0.2; // Default depth if not specified
  const visualY = visualGreenY - 0.01; // Place visuals slightly below green
  const triggerY = visualGreenY - hazardDepth / 2; // Center trigger vertically in depression

  // Check if we have course boundaries
  const useCourseBounds = courseBounds && courseBounds.width > 0 && courseBounds.length > 0;

  if (useCourseBounds) {
    debug.log(
      `[HazardFactory] Will constrain hazards to course boundaries: ${courseBounds.width}x${courseBounds.length}`
    );
  }

  if (config.shape === 'compound' && config.subShapes) {
    // Handle compound shapes (like snowman bunker)
    config.subShapes.forEach((subShape, index) => {
      const subPos = new THREE.Vector3(
        (config.position?.x || 0) + (subShape.position?.x || 0),
        0,
        (config.position?.z || 0) + (subShape.position?.z || 0)
      );

      const { meshes, bodies } = createSandHazardPart(
        {
          ...config,
          shape: 'circle',
          position: subPos,
          size: { radius: subShape.radius }
        },
        world,
        group,
        sandMaterial,
        visualY,
        triggerY,
        courseBounds
      );

      allMeshes.push(...meshes);
      allBodies.push(...bodies);
    });
  } else {
    // Handle single shape
    const { meshes, bodies } = createSandHazardPart(
      config,
      world,
      group,
      sandMaterial,
      visualY,
      triggerY,
      courseBounds
    );
    allMeshes.push(...meshes);
    allBodies.push(...bodies);
  }

  return { meshes: allMeshes, bodies: allBodies };
}

/**
 * Creates a single part of a sand hazard (one circle/rectangle).
 */
function createSandHazardPart(config, world, group, material, visualY, triggerY, courseBounds) {
  const meshes = [];
  const bodies = [];

  try {
    let visualGeometry, finalMesh;
    let triggerShape;
    const worldPos = new THREE.Vector3(config.position?.x || 0, 0, config.position?.z || 0);
    const localPos = worldPos.clone().sub(group.position);

    // Calculate course bounds
    const useCourseBounds = courseBounds && courseBounds.width > 0 && courseBounds.length > 0;
    const halfWidth = useCourseBounds ? courseBounds.width / 2 : Infinity;
    const halfLength = useCourseBounds ? courseBounds.length / 2 : Infinity;

    // Create appropriate geometries based on shape
    if (config.shape === 'circle') {
      const radius = config.size?.radius || 1;

      if (useCourseBounds) {
        // Use CSG to constrain the hazard to the course boundaries
        // First create the hazard circle
        const circleGeom = new THREE.CircleGeometry(radius, 32);
        circleGeom.rotateX(-Math.PI / 2); // Lay flat
        const circleMesh = new THREE.Mesh(circleGeom);
        circleMesh.position.set(localPos.x, visualY, localPos.z);
        circleMesh.updateMatrix();

        // Create a box that represents the course boundary
        const boundaryGeom = new THREE.BoxGeometry(courseBounds.width, 0.1, courseBounds.length);
        const boundaryMesh = new THREE.Mesh(boundaryGeom);
        boundaryMesh.position.set(0, visualY, 0); // Center of course
        boundaryMesh.updateMatrix();

        // Intersect the circle with the boundary box
        finalMesh = CSG.intersect(circleMesh, boundaryMesh);
        finalMesh.material = material;

        // Clean up temporary geometries
        circleGeom.dispose();
        boundaryGeom.dispose();

        debug.log(
          `[HazardFactory] Created sand hazard with CSG intersection at ${localPos.x.toFixed(2)},${localPos.z.toFixed(2)}`
        );
      } else {
        // No constraints, just use the circle directly
        visualGeometry = new THREE.CircleGeometry(radius, 32);
        visualGeometry.rotateX(-Math.PI / 2); // Lay flat
        finalMesh = new THREE.Mesh(visualGeometry, material);
        finalMesh.position.set(localPos.x, visualY, localPos.z);
      }

      // Physics is unchanged - use full radius for gameplay
      triggerShape = new CANNON.Cylinder(radius, radius, config.depth || 0.2, 16);
    } else if (config.shape === 'rectangle') {
      const width = config.size?.width || 2;
      const length = config.size?.length || 2;

      if (useCourseBounds) {
        // Use CSG to constrain the hazard to the course boundaries
        // First create the hazard rectangle
        const rectGeom = new THREE.PlaneGeometry(width, length);
        rectGeom.rotateX(-Math.PI / 2); // Lay flat
        const rectMesh = new THREE.Mesh(rectGeom);
        rectMesh.position.set(localPos.x, visualY, localPos.z);
        rectMesh.updateMatrix();

        // Create a box that represents the course boundary
        const boundaryGeom = new THREE.BoxGeometry(courseBounds.width, 0.1, courseBounds.length);
        const boundaryMesh = new THREE.Mesh(boundaryGeom);
        boundaryMesh.position.set(0, visualY, 0); // Center of course
        boundaryMesh.updateMatrix();

        // Intersect the rectangle with the boundary box
        finalMesh = CSG.intersect(rectMesh, boundaryMesh);
        finalMesh.material = material;

        // Clean up temporary geometries
        rectGeom.dispose();
        boundaryGeom.dispose();

        debug.log(
          `[HazardFactory] Created rectangle sand hazard with CSG intersection at ${localPos.x.toFixed(2)},${localPos.z.toFixed(2)}`
        );
      } else {
        // No constraints, just use the rectangle directly
        visualGeometry = new THREE.PlaneGeometry(width, length);
        visualGeometry.rotateX(-Math.PI / 2); // Lay flat
        finalMesh = new THREE.Mesh(visualGeometry, material);
        finalMesh.position.set(localPos.x, visualY, localPos.z);
      }

      // Physics is unchanged
      triggerShape = new CANNON.Box(
        new CANNON.Vec3(width / 2, (config.depth || 0.2) / 2, length / 2)
      );
    } else {
      console.warn(`[HazardFactory] Unsupported shape: ${config.shape}`);
      return { meshes: [], bodies: [] };
    }

    // Set common properties for the final mesh
    finalMesh.receiveShadow = true;
    group.add(finalMesh);
    meshes.push(finalMesh);

    // Create physics trigger (use full size regardless of visual constraints)
    const triggerBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      isTrigger: true,
      collisionFilterGroup: 8,
      collisionFilterMask: 4
    });
    triggerBody.addShape(triggerShape);
    triggerBody.position.set(worldPos.x, triggerY, worldPos.z);

    triggerBody.userData = { isBunkerZone: true };
    world.addBody(triggerBody);
    bodies.push(triggerBody);
  } catch (error) {
    console.error('[HazardFactory] Error creating hazard part:', error);
    return { meshes: [], bodies: [] };
  }

  return { meshes, bodies };
}

// ==================================
// Water Hazard Implementation
// ==================================

/**
 * Creates visuals and physics trigger for a water hazard.
 * Handles simple shapes ('circle', 'rectangle') and 'compound' shapes.
 */
function createWaterHazard(world, group, config, visualGreenY, courseBounds) {
  const allMeshes = [];
  const allBodies = [];

  // Define water material
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x3399ff, // Water blue
    transparent: true,
    opacity: 0.7,
    roughness: 0.2,
    metalness: 0.1
  });

  const hazardDepth = config.depth || 0.15; // Default depth for trigger height
  const visualY = visualGreenY - 0.02; // Place visuals slightly below green
  // Center trigger vertically in shallow depth
  const triggerY = visualGreenY - hazardDepth / 2;

  if (config.shape === 'compound' && config.subShapes) {
    // Handle compound shapes (like snowman)
    config.subShapes.forEach((subShape, index) => {
      const subPos = new THREE.Vector3(
        (config.position?.x || 0) + (subShape.position?.x || 0),
        0,
        (config.position?.z || 0) + (subShape.position?.z || 0)
      );

      const { meshes, bodies } = createSingleWaterHazardPart(
        {
          ...config, // Inherit type, depth etc.
          shape: 'circle', // Assuming compound parts are circles
          position: subPos, // Calculated world position
          size: { radius: subShape.radius } // Size from subShape
        },
        world,
        group,
        waterMaterial,
        visualY,
        triggerY,
        courseBounds
      );

      allMeshes.push(...meshes);
      allBodies.push(...bodies);
    });
  } else {
    // Handle single simple shape
    const { meshes, bodies } = createSingleWaterHazardPart(
      config,
      world,
      group,
      waterMaterial,
      visualY,
      triggerY,
      courseBounds
    );
    allMeshes.push(...meshes);
    allBodies.push(...bodies);
  }

  return { meshes: allMeshes, bodies: allBodies };
}

/**
 * Creates a single part of a water hazard (one circle/rectangle visual + trigger).
 */
function createSingleWaterHazardPart(
  config,
  world,
  group,
  material,
  visualY,
  triggerY,
  courseBounds
) {
  const meshes = [];
  const bodies = [];

  try {
    let visualGeometry, finalMesh;
    let triggerShape;
    const worldPos = new THREE.Vector3(config.position?.x || 0, 0, config.position?.z || 0);
    const localPos = worldPos.clone().sub(group.position);

    // Calculate course bounds
    const useCourseBounds = courseBounds && courseBounds.width > 0 && courseBounds.length > 0;
    const halfWidth = useCourseBounds ? courseBounds.width / 2 : Infinity;
    const halfLength = useCourseBounds ? courseBounds.length / 2 : Infinity;

    if (config.shape === 'circle') {
      const radius = config.size?.radius || 1;

      if (useCourseBounds) {
        // Use CSG to constrain the hazard to the course boundaries
        // First create the hazard circle
        const circleGeom = new THREE.CircleGeometry(radius, 32);
        circleGeom.rotateX(-Math.PI / 2); // Lay flat
        const circleMesh = new THREE.Mesh(circleGeom);
        circleMesh.position.set(localPos.x, visualY, localPos.z);
        circleMesh.updateMatrix();

        // Create a box that represents the course boundary
        const boundaryGeom = new THREE.BoxGeometry(courseBounds.width, 0.1, courseBounds.length);
        const boundaryMesh = new THREE.Mesh(boundaryGeom);
        boundaryMesh.position.set(0, visualY, 0); // Center of course
        boundaryMesh.updateMatrix();

        // Intersect the circle with the boundary box
        finalMesh = CSG.intersect(circleMesh, boundaryMesh);
        finalMesh.material = material;

        // Clean up temporary geometries
        circleGeom.dispose();
        boundaryGeom.dispose();

        debug.log(
          `[HazardFactory] Created water hazard with CSG intersection at ${localPos.x.toFixed(2)},${localPos.z.toFixed(2)}`
        );
      } else {
        // No constraints, just use the circle directly
        visualGeometry = new THREE.CircleGeometry(radius, 32);
        visualGeometry.rotateX(-Math.PI / 2); // Lay flat
        finalMesh = new THREE.Mesh(visualGeometry, material);
        finalMesh.position.set(localPos.x, visualY, localPos.z);
      }

      // Physics is unchanged - use full radius for gameplay
      triggerShape = new CANNON.Cylinder(radius, radius, config.depth || 0.2, 16);
    } else if (config.shape === 'rectangle') {
      const width = config.size?.width || 2;
      const length = config.size?.length || 2;

      if (useCourseBounds) {
        // Use CSG to constrain the hazard to the course boundaries
        // First create the hazard rectangle
        const rectGeom = new THREE.PlaneGeometry(width, length);
        rectGeom.rotateX(-Math.PI / 2); // Lay flat
        const rectMesh = new THREE.Mesh(rectGeom);
        rectMesh.position.set(localPos.x, visualY, localPos.z);
        rectMesh.updateMatrix();

        // Create a box that represents the course boundary
        const boundaryGeom = new THREE.BoxGeometry(courseBounds.width, 0.1, courseBounds.length);
        const boundaryMesh = new THREE.Mesh(boundaryGeom);
        boundaryMesh.position.set(0, visualY, 0); // Center of course
        boundaryMesh.updateMatrix();

        // Intersect the rectangle with the boundary box
        finalMesh = CSG.intersect(rectMesh, boundaryMesh);
        finalMesh.material = material;

        // Clean up temporary geometries
        rectGeom.dispose();
        boundaryGeom.dispose();

        debug.log(
          `[HazardFactory] Created rectangle water hazard with CSG intersection at ${localPos.x.toFixed(2)},${localPos.z.toFixed(2)}`
        );
      } else {
        // No constraints, just use the rectangle directly
        visualGeometry = new THREE.PlaneGeometry(width, length);
        visualGeometry.rotateX(-Math.PI / 2); // Lay flat
        finalMesh = new THREE.Mesh(visualGeometry, material);
        finalMesh.position.set(localPos.x, visualY, localPos.z);
      }

      triggerShape = new CANNON.Box(
        new CANNON.Vec3(width / 2, (config.depth || 0.2) / 2, length / 2)
      );
    } else {
      console.warn(`[HazardFactory] Unsupported water shape: ${config.shape}`);
      return { meshes: [], bodies: [] };
    }

    // Set common properties for the final mesh
    finalMesh.receiveShadow = true;
    group.add(finalMesh);
    meshes.push(finalMesh);

    // Create physics trigger (use full size regardless of visual constraints)
    const triggerBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      isTrigger: true,
      collisionFilterGroup: 8,
      collisionFilterMask: 4
    });
    triggerBody.addShape(triggerShape);
    triggerBody.position.set(worldPos.x, triggerY, worldPos.z);

    triggerBody.userData = { isWaterZone: true };
    world.addBody(triggerBody);
    bodies.push(triggerBody);
  } catch (error) {
    console.error('[HazardFactory] Error creating water hazard part:', error);
    return { meshes: [], bodies: [] };
  }

  return { meshes, bodies };
}
