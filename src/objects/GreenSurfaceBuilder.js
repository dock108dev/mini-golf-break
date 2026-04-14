import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CSG } from 'three-csg-ts';
import { MATERIAL_PALETTE } from '../themes/palette';

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

function createGreenMaterialFromTheme(theme) {
  const greenTheme = theme.green || {};
  return new THREE.MeshStandardMaterial({
    color: greenTheme.color || MATERIAL_PALETTE.floor.color,
    roughness: greenTheme.roughness ?? MATERIAL_PALETTE.floor.roughness,
    metalness: greenTheme.metalness ?? MATERIAL_PALETTE.floor.metalness,
    ...(greenTheme.emissive && { emissive: greenTheme.emissive }),
    ...(greenTheme.emissiveIntensity && { emissiveIntensity: greenTheme.emissiveIntensity })
  });
}

function createShapeFromBoundaryConfig(config) {
  if (config.boundaryShapeDef && config.boundaryShapeDef.outer) {
    const shape = new THREE.Shape(config.boundaryShapeDef.outer);
    if (config.boundaryShapeDef.holes) {
      config.boundaryShapeDef.holes.forEach(holePoints => {
        shape.holes.push(new THREE.Path(holePoints));
      });
    }
    return shape;
  }
  if (config.boundaryShape) {
    return new THREE.Shape(config.boundaryShape);
  }
  console.error(
    `[GreenSurfaceBuilder] No valid boundaryShape or boundaryShapeDef found for hole ${config.index}`
  );
  return null;
}

function createMainHoleCutter(worldHolePosition, baseGreenMeshY, greenDepth) {
  const visualHoleRadius = 0.4;
  const mainHoleCutterHeight = greenDepth + 0.1;
  const mainHoleCutterGeometry = new THREE.CylinderGeometry(
    visualHoleRadius,
    visualHoleRadius,
    mainHoleCutterHeight,
    32
  );
  const mainHoleCutterMesh = new THREE.Mesh(mainHoleCutterGeometry);
  mainHoleCutterMesh.position.set(worldHolePosition.x, baseGreenMeshY, worldHolePosition.z);
  mainHoleCutterMesh.updateMatrix();
  return mainHoleCutterMesh;
}

function appendHazardCutters(config, baseGreenMeshY, greenDepth, cutters) {
  (config.hazards || []).forEach(hazardConfig => {
    if (hazardConfig.type !== 'sand' && hazardConfig.type !== 'water') {
      return;
    }
    const hazardCutterHeight = greenDepth + 0.1;
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
      cutterMesh.position.set(hazardWorldPos.x, baseGreenMeshY, hazardWorldPos.z);
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
      cutterMesh.position.set(hazardWorldPos.x, baseGreenMeshY, hazardWorldPos.z);
      if (hazardConfig.rotation) {
        cutterMesh.rotation.copy(hazardConfig.rotation);
      }
      cutterMesh.updateMatrix();
      cutters.push(cutterMesh);
    }
  });
}

function subtractCuttersFromMesh(baseGreenMesh, cutters) {
  let currentGreenMesh = baseGreenMesh;
  cutters.forEach(cutter => {
    currentGreenMesh = CSG.subtract(currentGreenMesh, cutter);
  });
  return currentGreenMesh;
}

function addPhysicsGroundPlane(world, config, boundaryShape, surfaceHeight, bodies) {
  const shapeBounds = getShapeBounds(boundaryShape);
  const physicsPlaneWidth = shapeBounds.size.x > 0 ? shapeBounds.size.x + 10 : 20;
  const physicsPlaneLength = shapeBounds.size.y > 0 ? shapeBounds.size.y + 10 : 40;

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

  const planeLocalRotation = new CANNON.Quaternion().setFromAxisAngle(
    new CANNON.Vec3(1, 0, 0),
    -Math.PI / 2
  );
  groundBody.addShape(groundShape, new CANNON.Vec3(0, 0, 0), planeLocalRotation);

  groundBody.position.set(0, surfaceHeight, 0);
  groundBody.quaternion.set(0, 0, 0, 1);

  groundBody.userData = { type: 'green', holeIndex: config.index };
  world.addBody(groundBody);
  bodies.push(groundBody);
  physicsPlaneGeom.dispose();
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
export function buildGreenSurface({
  config,
  world,
  group,
  worldHolePosition,
  surfaceHeight,
  boundaryShape
}) {
  const meshes = [];
  const bodies = [];
  const theme = config.theme || {};
  const greenMaterial = createGreenMaterialFromTheme(theme);
  const greenDepth = 0.01;

  const shape = createShapeFromBoundaryConfig(config);
  if (!shape) {
    return { meshes, bodies };
  }

  const extrudeSettings = { depth: greenDepth, bevelEnabled: false };
  const baseGreenGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  baseGreenGeometry.rotateX(-Math.PI / 2);

  const baseGreenMesh = new THREE.Mesh(baseGreenGeometry);
  baseGreenMesh.position.y = surfaceHeight - greenDepth / 2;
  baseGreenMesh.updateMatrix();

  const cutters = [createMainHoleCutter(worldHolePosition, baseGreenMesh.position.y, greenDepth)];
  appendHazardCutters(config, baseGreenMesh.position.y, greenDepth, cutters);

  const finalVisualGreenMesh = subtractCuttersFromMesh(baseGreenMesh, cutters);
  finalVisualGreenMesh.material = greenMaterial;
  finalVisualGreenMesh.castShadow = false;
  finalVisualGreenMesh.receiveShadow = true;
  group.add(finalVisualGreenMesh);
  meshes.push(finalVisualGreenMesh);

  addPhysicsGroundPlane(world, config, boundaryShape, surfaceHeight, bodies);

  return { meshes, bodies };
}
