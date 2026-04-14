import { debug } from '../utils/debug';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BaseElement } from './BaseElement';
import { buildGreenSurface } from './GreenSurfaceBuilder';
import { createHazard } from './hazards/HazardFactory';
import { createMechanic } from '../mechanics/MechanicRegistry';
import { createHeroProp } from './HeroPropFactory';
import { defaultTheme } from '../themes/defaultTheme';
import { MATERIAL_PALETTE } from '../themes/palette';
// Trigger mechanic self-registration
import '../mechanics/index';

/**
 * HoleEntity - Encapsulates all resources and physics for a single hole
 * Now extends BaseElement
 * EXPECTS: All positions in config (startPosition, holePosition, hazards, bumpers) = WORLD coordinates relative to (0,0,0)
 */
export class HoleEntity extends BaseElement {
  constructor(world, config, scene) {
    // Scene can be a THREE.Group when used with course manager
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

    // Validate boundary shape
    this.boundaryShape =
      Array.isArray(config.boundaryShape) && config.boundaryShape.length >= 3
        ? config.boundaryShape.map(p => new THREE.Vector2(p.x, p.y)) // Ensure Vector2, use y for world z
        : [
            // Default rectangular shape if invalid
            new THREE.Vector2(-2, -10),
            new THREE.Vector2(-2, 10),
            new THREE.Vector2(2, 10),
            new THREE.Vector2(2, -10),
            new THREE.Vector2(-2, -10)
          ];

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

    // Resolve theme: use config.theme if provided, fall back to defaultTheme
    this.resolvedTheme = { ...defaultTheme, ...(config.theme || {}) };
    // Merge nested theme keys so partial overrides work
    for (const key of Object.keys(defaultTheme)) {
      if (typeof defaultTheme[key] === 'object' && defaultTheme[key] !== null) {
        this.resolvedTheme[key] = { ...defaultTheme[key], ...(config.theme?.[key] || {}) };
      }
    }
    // Store resolved theme on config for builders that read config.theme
    this.config = { ...this.config, theme: this.resolvedTheme };

    debug.log(`[HoleEntity] Created for hole index ${config.index + 1}. Group at (0,0,0).`);
    debug.log(
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
      this.createNeonTrim();
      this.createHazards();
      this.createBumpers();
      this.createMechanics();
      this.createHeroProps();
      debug.log(`[HoleEntity] Initialization complete for hole index ${this.config.index}.`);
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

  createGreenSurfaceAndPhysics() {
    const { meshes, bodies } = buildGreenSurface({
      config: this.config,
      world: this.world,
      group: this.group,
      worldHolePosition: this.worldHolePosition,
      surfaceHeight: this.surfaceHeight,
      boundaryShape: this.boundaryShape
    });
    this.meshes.push(...meshes);
    this.bodies.push(...bodies);
  }

  createHoleRim() {
    // Use WORLD hole position
    const visualHoleRadius = 0.4;
    const rimGeometry = new THREE.RingGeometry(visualHoleRadius, visualHoleRadius + 0.04, 32);
    const rimTheme = this.config.theme?.rim || {};
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: rimTheme.color || MATERIAL_PALETTE.rim.color,
      roughness: rimTheme.roughness ?? MATERIAL_PALETTE.rim.roughness,
      metalness: rimTheme.metalness ?? MATERIAL_PALETTE.rim.metalness,
      ...(rimTheme.emissive && { emissive: rimTheme.emissive }),
      ...(rimTheme.emissiveIntensity && { emissiveIntensity: rimTheme.emissiveIntensity })
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
    const holeInteriorTheme = this.config.theme?.holeInterior || {};
    const interiorMaterial = new THREE.MeshStandardMaterial({
      color: holeInteriorTheme.color || MATERIAL_PALETTE.holeInterior.color,
      roughness: holeInteriorTheme.roughness ?? MATERIAL_PALETTE.holeInterior.roughness,
      metalness: holeInteriorTheme.metalness ?? MATERIAL_PALETTE.holeInterior.metalness,
      side: THREE.DoubleSide,
      ...(holeInteriorTheme.emissive && { emissive: holeInteriorTheme.emissive }),
      ...(holeInteriorTheme.emissiveIntensity && {
        emissiveIntensity: holeInteriorTheme.emissiveIntensity
      })
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
    const wallTheme = this.config.theme?.wall || {};
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: wallTheme.color || MATERIAL_PALETTE.wall.color,
      roughness: wallTheme.roughness ?? MATERIAL_PALETTE.wall.roughness,
      metalness: wallTheme.metalness ?? MATERIAL_PALETTE.wall.metalness,
      ...(wallTheme.emissive && { emissive: wallTheme.emissive }),
      ...(wallTheme.emissiveIntensity && { emissiveIntensity: wallTheme.emissiveIntensity })
    });

    // Iterate through the boundary shape segments
    for (let i = 0; i < this.boundaryShape.length - 1; i++) {
      const startPoint = this.boundaryShape[i]; // Vector2 (x, z)
      const endPoint = this.boundaryShape[i + 1]; // Vector2 (x, z)

      const segmentVector = new THREE.Vector2().subVectors(endPoint, startPoint);
      const length = segmentVector.length();
      if (length < 0.01) {
        continue;
      } // Skip zero-length segments

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
    // Use WORLD start position for the visual mesh
    const teeGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 24);
    const teeTheme = this.config.theme?.tee || {};
    const teeMaterial = new THREE.MeshStandardMaterial({
      color: teeTheme.color || MATERIAL_PALETTE.tee.color,
      roughness: teeTheme.roughness ?? MATERIAL_PALETTE.tee.roughness,
      metalness: teeTheme.metalness ?? MATERIAL_PALETTE.tee.metalness,
      ...(teeTheme.emissive && { emissive: teeTheme.emissive }),
      ...(teeTheme.emissiveIntensity && { emissiveIntensity: teeTheme.emissiveIntensity })
    });
    const teeMesh = new THREE.Mesh(teeGeometry, teeMaterial);
    // Position mesh at WORLD start position, adjusted for local Y offset
    teeMesh.position.copy(this.worldStartPosition);
    teeMesh.position.y = this.visualGreenY + 0.03; // Y offset relative to surface
    this.group.add(teeMesh); // Add to group at (0,0,0)
    this.meshes.push(teeMesh);
  }

  createNeonTrim() {
    const trimTheme = this.config.theme?.neonTrim || MATERIAL_PALETTE.neonTrim;
    const points = [];
    for (const pt of this.boundaryShape) {
      points.push(new THREE.Vector3(pt.x, this.visualGreenY + 0.005, pt.y));
    }
    if (points.length < 2) {
      return;
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: trimTheme.color || MATERIAL_PALETTE.neonTrim.color
    });
    const line = new THREE.Line(geometry, material);
    this.group.add(line);
    this.meshes.push(line);

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: trimTheme.emissive || MATERIAL_PALETTE.neonTrim.emissive,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const trimHeight = 0.06;
    for (let i = 0; i < this.boundaryShape.length - 1; i++) {
      const start = this.boundaryShape[i];
      const end = this.boundaryShape[i + 1];
      const dx = end.x - start.x;
      const dz = end.y - start.y;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.01) {
        continue;
      }
      const angle = Math.atan2(dz, dx);
      const midX = (start.x + end.x) / 2;
      const midZ = (start.y + end.y) / 2;
      const stripGeom = new THREE.PlaneGeometry(len, trimHeight);
      const strip = new THREE.Mesh(stripGeom, glowMaterial);
      strip.position.set(midX, this.visualGreenY + trimHeight / 2 + 0.001, midZ);
      strip.rotation.y = -angle;
      this.group.add(strip);
      this.meshes.push(strip);
    }
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
          this.visualGreenY, // Pass surface height relative to 0
          undefined, // courseBounds
          this.resolvedTheme // Pass theme for hazard colors
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
          color:
            bumperConfig.color || this.config.theme?.bumper?.color || MATERIAL_PALETTE.bumper.color,
          roughness: this.config.theme?.bumper?.roughness ?? MATERIAL_PALETTE.bumper.roughness,
          metalness: this.config.theme?.bumper?.metalness ?? MATERIAL_PALETTE.bumper.metalness
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
   * Create mechanics from config.mechanics[] array.
   * Each mechanic is instantiated via the MechanicRegistry and tracked for update/destroy.
   */
  createMechanics() {
    this.mechanics = [];
    const mechanicConfigs = this.config.mechanics || [];
    if (mechanicConfigs.length === 0) {
      return;
    }

    for (const mechConfig of mechanicConfigs) {
      try {
        const mechanic = createMechanic(
          mechConfig.type,
          this.world,
          this.group,
          mechConfig,
          this.surfaceHeight,
          this.resolvedTheme
        );
        if (mechanic) {
          mechanic.audioManager = this.audioManager || null;
          this.mechanics.push(mechanic);
          // Track mechanic's resources for cleanup
          this.meshes.push(...(mechanic.getMeshes?.() || mechanic.meshes || []));
          this.bodies.push(...(mechanic.getBodies?.() || mechanic.bodies || []));
          debug.log(`[HoleEntity] Created mechanic: ${mechConfig.type}`);
        } else {
          console.error(
            `[HoleEntity] Hole ${this.config.index}: unknown mechanic type "${mechConfig.type}"`
          );
        }
      } catch (error) {
        console.error(
          `[HoleEntity] Hole ${this.config.index}: failed to create mechanic "${mechConfig.type}":`,
          error
        );
      }
    }
  }

  createHeroProps() {
    const heroProps = this.config.heroProps || [];
    if (heroProps.length === 0) {
      return;
    }
    for (const propConfig of heroProps) {
      try {
        const propMeshes = createHeroProp(this.group, propConfig);
        this.meshes.push(...propMeshes);
        debug.log(`[HoleEntity] Created hero prop: ${propConfig.type}`);
      } catch (error) {
        console.error(`[HoleEntity] Failed to create hero prop "${propConfig.type}":`, error);
      }
    }
  }

  /**
   * Update all mechanics each frame.
   * Failed mechanics are caught, logged, and disabled for the rest of the hole.
   * @param {number} dt - Delta time in seconds
   * @param {CANNON.Body|null} ballBody - The ball's physics body
   * @param {object} [options] - Optional flags
   * @param {boolean} [options.dtWasClamped] - True if dt was clamped due to a spike
   */
  update(dt, ballBody, options) {
    if (!this.mechanics) {
      return;
    }
    const dtWasClamped = options?.dtWasClamped || false;
    for (const mechanic of this.mechanics) {
      if (mechanic._failed) {
        continue;
      }
      try {
        if (dtWasClamped && typeof mechanic.onDtSpike === 'function') {
          mechanic.onDtSpike();
        }
        mechanic.update(dt, ballBody);
      } catch (error) {
        mechanic._failed = true;
        const mechanicType = mechanic.config?.type || 'unknown';
        console.error(
          `[HoleEntity] Hole ${this.config.index}: mechanic "${mechanicType}" update failed, disabling for this hole`,
          error
        );
        this._showFailedMechanicIndicator(mechanic);
      }
    }
  }

  /**
   * In debug mode, show a visual indicator for a failed mechanic.
   * @param {object} mechanic - The failed mechanic instance
   */
  _showFailedMechanicIndicator(mechanic) {
    try {
      // Determine position from mechanic's first mesh or config
      const pos = mechanic.meshes?.[0]?.position ||
        mechanic.config?.position ||
        mechanic.config?.pivot || { x: 0, y: this.surfaceHeight + 1, z: 0 };

      const geometry = new THREE.SphereGeometry(0.3, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.7,
        wireframe: true
      });
      const indicator = new THREE.Mesh(geometry, material);
      indicator.position.set(pos.x || 0, (pos.y || this.surfaceHeight) + 1.5, pos.z || 0);
      indicator.name = `failed_mechanic_${mechanic.config?.type || 'unknown'}`;
      indicator._isDebugIndicator = true;
      this.group.add(indicator);
      this.meshes.push(indicator);
      mechanic._failedIndicator = indicator;
    } catch (_e) {
      // Don't let indicator creation break anything
    }
  }

  /**
   * Destroy the HoleEntity's internal components (meshes, bodies)
   * but leaves the main container group (this.group or this.parentGroup) intact.
   */
  destroy() {
    // Destroy mechanics first (they manage their own mesh/body cleanup)
    if (this.mechanics) {
      for (const mechanic of this.mechanics) {
        mechanic.destroy();
      }
      this.mechanics = [];
    }

    debug.log(`[HoleEntity] Destroying components for Hole ${this.config.index + 1}`);

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
    // The course manager manages those groups.
    debug.log(`[HoleEntity] Component cleanup complete for Hole ${this.config.index + 1}`);
    // Setting group to null might cause issues if reused, let course manager manage it.
    // this.group = null;
  }
}
