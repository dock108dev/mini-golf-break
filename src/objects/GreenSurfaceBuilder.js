import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CSG } from 'three-csg-ts';

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
 * Builds the green surface mesh (with CSG cutouts) and physics body for a hole.
 * @param {object} params
 * @param {object} params.config - Hole configuration
 * @param {object} params.world - Physics world
 * @param {THREE.Group} params.group - Group to add meshes to
 * @param {THREE.Vector3} params.worldHolePosition - World position of the hole
 * @param {number} params.surfaceHeight - Y height of the green surface
 * @param {Array} params.boundaryShape - Boundary shape points (Vector2[])
 * @returns {{ meshes: THREE.Mesh[], bodies: CANNON.Body[] }}
 */
export function buildGreenSurface({ config, world, group, worldHolePosition, surfaceHeight, boundaryShape }) {
  const meshes = [];
  const bodies = [];

  const theme = config.theme || {};
  const greenTheme = theme.green || {};
  const greenMaterial = new THREE.MeshStandardMaterial({
    color: greenTheme.color || 0x2ecc71,
    roughness: greenTheme.roughness ?? 0.8,
    metalness: greenTheme.metalness ?? 0.1,
    ...(greenTheme.emissive && { emissive: greenTheme.emissive }),
    ...(greenTheme.emissiveIntensity && { emissiveIntensity: greenTheme.emissiveIntensity })
  });
  const greenDepth = 0.01; // Thickness for extrusion

  // Create shape from boundary points (using Vector2's y as world z)
  let shape;
  if (config.boundaryShapeDef && config.boundaryShapeDef.outer) {
    // New method: Use outer shape and holes
    shape = new THREE.Shape(config.boundaryShapeDef.outer);
    if (config.boundaryShapeDef.holes) {
      config.boundaryShapeDef.holes.forEach(holePoints => {
        const holePath = new THREE.Path(holePoints);
        shape.holes.push(holePath);
      });
    }
  } else if (config.boundaryShape) {
    // Original method: Use a single boundary path
    shape = new THREE.Shape(config.boundaryShape);
  } else {
    console.error(
      `[GreenSurfaceBuilder] No valid boundaryShape or boundaryShapeDef found for hole ${config.index}`
    );
    return { meshes, bodies }; // Cannot create green without shape definition
  }

  // Extrude the shape slightly to give it depth
  const extrudeSettings = { depth: greenDepth, bevelEnabled: false };
  const baseGreenGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  // ExtrudeGeometry creates in XY plane, rotate to XZ plane
  baseGreenGeometry.rotateX(-Math.PI / 2);

  const baseGreenMesh = new THREE.Mesh(baseGreenGeometry);
  // Position mesh LOCALLY relative to group (0,0,0)
  // Need to offset slightly because extrusion depth goes in +Y after rotation
  baseGreenMesh.position.y = surfaceHeight - greenDepth / 2;
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
    worldHolePosition.x,
    baseGreenMesh.position.y,
    worldHolePosition.z
  );
  mainHoleCutterMesh.updateMatrix();
  cutters.push(mainHoleCutterMesh);

  // Hazard Cutters
  (config.hazards || []).forEach(hazardConfig => {
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
  group.add(finalVisualGreenMesh);
  meshes.push(finalVisualGreenMesh);

  // --- Physics Body (Simple large plane for now, rely on walls for containment) ---
  // Get bounds of the shape to make a reasonable plane size
  const shapeBounds = getShapeBounds(boundaryShape);
  const physicsPlaneWidth = shapeBounds.size.x > 0 ? shapeBounds.size.x + 10 : 20; // Add padding
  const physicsPlaneLength = shapeBounds.size.y > 0 ? shapeBounds.size.y + 10 : 40; // Add padding

  const physicsPlaneGeom = new THREE.PlaneGeometry(physicsPlaneWidth, physicsPlaneLength, 1, 1);
  const physicsGroundMaterial = world.groundMaterial;
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
  groundBody.position.set(0, surfaceHeight, 0);
  groundBody.quaternion.set(0, 0, 0, 1); // No world rotation for the body itself

  groundBody.userData = { type: 'green', holeIndex: config.index };
  world.addBody(groundBody);
  bodies.push(groundBody);
  physicsPlaneGeom.dispose();

  return { meshes, bodies };
}
