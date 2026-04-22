/**
 * MechanicBase - Base class for all hole mechanics.
 *
 * Mechanics are composable gameplay systems that can be added to any hole
 * via the hole config's `mechanics[]` array. Each mechanic creates its own
 * meshes and physics bodies, updates per frame, and cleans up on destroy.
 *
 * Subclasses must implement:
 *   constructor(world, group, config, surfaceHeight) - create meshes + bodies
 *   update(dt, ballBody) - per-frame logic (move obstacles, apply forces, etc.)
 *
 * Lifecycle:
 *   1. HoleEntity.createMechanics() instantiates via MechanicRegistry
 *   2. HoleEntity.update(dt, ballBody) calls mechanic.update() each frame
 *   3. HoleEntity.destroy() calls mechanic.destroy() to clean up
 */
export class MechanicBase {
  /**
   * @param {object} world - Cannon-es physics world (with addBody/removeBody)
   * @param {THREE.Group} group - The hole's Three.js group to add meshes to
   * @param {object} config - Mechanic-specific configuration from hole config
   * @param {number} surfaceHeight - Y height of the green surface
   * @param {object} [theme] - Optional theme object for visual customization
   */
  constructor(world, group, config, surfaceHeight, theme) {
    this.world = world;
    this.group = group;
    this.config = config;
    this.surfaceHeight = surfaceHeight;
    this.theme = theme || null;
    this.meshes = [];
    this.bodies = [];
    this.isForceField = false;

    // Warn when obstacle linear speed could cause ball tunneling
    const depth = config?.size?.depth;
    if (config?.speed !== undefined && depth !== undefined) {
      const fixedDt = 1 / 60;
      const maxSafeSpeed = depth / fixedDt;
      if (config.speed > maxSafeSpeed) {
        console.warn(
          `[MechanicBase] speed ${config.speed} exceeds anti-tunneling limit ` +
            `${maxSafeSpeed.toFixed(2)} (size.depth=${depth} / fixedDt=${fixedDt.toFixed(4)}). ` +
            'Ball tunneling may occur.'
        );
      }
    }
  }

  /**
   * Called each frame to update the mechanic.
   * @param {number} dt - Delta time in seconds
   * @param {CANNON.Body|null} ballBody - The ball's physics body (null if no ball)
   */
  update(_dt, _ballBody) {
    // Override in subclass
  }

  /**
   * Called when a dt spike is detected (raw dt exceeded the clamp threshold).
   * Mechanics should reset internal timers/cooldowns to prevent jarring state
   * changes after a tab refocus or long pause.
   */
  onDtSpike() {
    // Override in subclass
  }

  /**
   * Remove all meshes from group and bodies from world.
   */
  destroy() {
    for (const mesh of this.meshes) {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m?.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
    this.meshes = [];

    for (const body of this.bodies) {
      if (this.world) {
        this.world.removeBody(body);
      }
    }
    this.bodies = [];
  }

  /**
   * Get all meshes created by this mechanic.
   * @returns {THREE.Mesh[]}
   */
  getMeshes() {
    return this.meshes;
  }

  /**
   * Get all physics bodies created by this mechanic.
   * @returns {CANNON.Body[]}
   */
  getBodies() {
    return this.bodies;
  }

  /**
   * Set visibility of all meshes owned by this mechanic.
   * @param {boolean} visible
   */
  setMeshVisibility(visible) {
    for (const mesh of this.meshes) {
      mesh.visible = visible;
    }
  }

  /**
   * Check if a ball body overlaps a trigger body (simple distance check).
   * @param {CANNON.Body} ballBody
   * @param {CANNON.Body} triggerBody
   * @param {number} radius - Trigger radius
   * @returns {boolean}
   */
  isBallInZone(ballBody, triggerBody, radius) {
    if (!ballBody || !triggerBody) {
      return false;
    }
    const dx = ballBody.position.x - triggerBody.position.x;
    const dz = ballBody.position.z - triggerBody.position.z;
    return dx * dx + dz * dz <= radius * radius;
  }
}
