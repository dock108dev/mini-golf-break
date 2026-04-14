import { debug } from '../utils/debug';
import * as THREE from 'three';

/**
 * BaseElement - Base class for all course elements
 * Provides common functionality for creation, physics setup, and destruction
 */
export class BaseElement {
  constructor(world, config, scene) {
    this.world = world; // CANNON.World instance
    this.config = config; // Element configuration
    this.scene = scene; // THREE.Scene instance

    // Check if scene is valid before proceeding
    if (!this.scene) {
      console.error('[BaseElement] No valid scene provided to constructor');
      throw new Error('BaseElement requires a valid scene');
    }

    this.meshes = []; // Visual objects
    this.bodies = []; // Physics bodies
    this.group = null; // Main group container

    // Common properties
    this.id = config.id || `element_${Math.floor(Math.random() * 10000)}`;
    this.name = config.name || 'Unnamed Element';
    this.elementType = config.type || 'generic';
    // Ensure position is a THREE.Vector3, defaulting to origin if not provided
    this.position =
      config.position instanceof THREE.Vector3
        ? config.position.clone()
        : new THREE.Vector3(0, 0, 0);

    debug.log(`[BaseElement] Initializing ${this.elementType} (${this.name}):`, {
      id: this.id,
      position: this.position
    });

    // Create main element group here so subclasses can use it
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // Check scene validity again before adding the group
    if (this.scene && typeof this.scene.add === 'function') {
      this.scene.add(this.group);
      debug.log(`[BaseElement] Added group to scene for ${this.elementType}`);
    } else {
      console.error(
        '[BaseElement] Cannot add group to scene - scene is invalid or lacks add() method'
      );
      throw new Error('Cannot add group to scene - invalid scene reference');
    }
    // We should track the group itself, maybe not add to meshes immediately
    // this.meshes.push(this.group); // Subclasses add their specific meshes
  }

  /**
   * Create the element - Placeholder, often better handled by an 'init' method
   * called after the constructor in subclasses.
   */
  create() {
    console.warn(
      `[BaseElement] Base create() called for ${this.elementType}. Consider using an init() pattern.`
    );
    // Subclasses might override this, but often init() after construction is safer
    return true;
  }

  /**
   * Update the element - for any animations or state changes
   * @param {number} dt - Delta time in seconds
   */
  update(_dt) {
    // Default implementation does nothing
    // Subclasses can override to implement animations or state changes
  }

  /**
   * Clean up all resources
   */
  destroy() {
    debug.log(`[BaseElement] Destroying ${this.elementType} (${this.name})`);

    // Remove meshes from scene and dispose resources
    // Start from end to avoid issues when removing from array being iterated
    for (let i = this.meshes.length - 1; i >= 0; i--) {
      const mesh = this.meshes[i];
      if (mesh) {
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
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

    // Remove physics bodies
    // Start from end to avoid issues
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const body = this.bodies[i];
      if (body && this.world) {
        this.world.removeBody(body);
      }
    }

    // Remove the main group from the scene if it exists
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }

    // Clear arrays
    this.meshes = [];
    this.bodies = [];
    this.group = null; // Nullify the group reference

    debug.log(`[BaseElement] Cleanup complete for ${this.elementType}`);
  }
}
