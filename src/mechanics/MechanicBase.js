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
   */
  constructor(world, group, config, surfaceHeight) {
    this.world = world;
    this.group = group;
    this.config = config;
    this.surfaceHeight = surfaceHeight;
    this.meshes = [];
    this.bodies = [];
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
    return (dx * dx + dz * dz) <= (radius * radius);
  }
}
