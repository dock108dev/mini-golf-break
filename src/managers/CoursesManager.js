/**
 * CoursesManager - Base class for managing multiple holes in a mini golf course
 */
export class CoursesManager {
  /**
   * Create a new CoursesManager instance
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {CANNON.World} physicsWorld - The physics world
   * @param {Object} options - Additional options
   */
  constructor(scene, physicsWorld, options = {}) {
    // Store references
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.game = options.game;

    // Initialize state
    this.currentHoleIndex = 0;
    this.totalHoles = 0;
    this.holes = [];
    this.courseObjects = [];
    this.physicsBodies = [];

    // Create course if autoCreate is true
    if (options.autoCreate !== false) {
      this.createCourse();
    }
  }

  /**
   * Create the course
   * @abstract
   */
  createCourse() {
    throw new Error('createCourse must be implemented by subclass');
  }

  /**
   * Get the current hole mesh
   * @returns {THREE.Mesh} The current hole's mesh
   */
  getCurrentHoleMesh() {
    if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holes.length) {
      return null;
    }
    return this.holes[this.currentHoleIndex].mesh;
  }

  /**
   * Get the current hole position
   * @returns {THREE.Vector3} The current hole's position or null if unavailable
   */
  getHolePosition() {
    if (this.holes.length === 0) {
      return null;
    }
    if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holes.length) {
      return null;
    }
    // Ensure the hole object itself and the position exist
    const holeData = this.holes[this.currentHoleIndex];
    if (!holeData || !holeData.holePosition) {
      return null;
    }
    return holeData.holePosition;
  }

  /**
   * Get the current hole's start position
   * @returns {THREE.Vector3} The current hole's start position or null if unavailable
   */
  getHoleStartPosition() {
    if (this.holes.length === 0) {
      return null;
    }
    if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holes.length) {
      return null;
    }
    // Ensure the hole object itself and the position exist
    const holeData = this.holes[this.currentHoleIndex];
    if (!holeData || !holeData.startPosition) {
      return null;
    }
    return holeData.startPosition;
  }

  /**
   * Get the current hole's par
   * @returns {number} The current hole's par or 0 if unavailable
   */
  getHolePar() {
    if (this.holes.length === 0) {
      return 0;
    }
    if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holes.length) {
      return 0;
    }
    // Ensure the hole object itself and par exist
    const holeData = this.holes[this.currentHoleIndex];
    if (!holeData || typeof holeData.par !== 'number') {
      return 0;
    }
    return holeData.par;
  }

  /**
   * Get the total number of holes
   * @returns {number} The total number of holes
   */
  getTotalHoles() {
    return this.totalHoles;
  }

  /**
   * Check if there is a next hole available
   * @returns {boolean} True if there is a next hole, false otherwise
   */
  hasNextHole() {
    return this.currentHoleIndex < this.totalHoles - 1;
  }

  /**
   * Load the next hole
   * @returns {boolean} True if successful, false if no next hole
   */
  loadNextHole() {
    if (!this.hasNextHole()) {
      return false;
    }

    try {
      // Clear current hole
      this.clearCurrentHole();

      // Increment hole index
      this.currentHoleIndex++;

      // Create new hole
      this.createCourse();

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear the current hole and its resources
   */
  clearCurrentHole() {
    // Remove existing hole meshes and dispose of resources
    this.courseObjects.forEach(obj => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
      this.scene.remove(obj);
    });

    // Clear physics bodies
    this.physicsBodies.forEach(body => {
      if (this.physicsWorld) {
        this.physicsWorld.removeBody(body);
      }
    });

    // Clear core arrays managed by the base class
    this.courseObjects = [];
    this.physicsBodies = [];
    this.holes = [];
  }

  /**
   * Update loop for the course
   * @param {number} dt - Delta time in seconds
   */
  update(_dt) {
    // Any per-frame updates for the course can go here
  }

  /**
   * Get the current hole configuration
   * @returns {Object} The current hole configuration object
   */
  getCurrentHole() {
    if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holeConfigs.length) {
      return null;
    }
    return {
      ...this.holeConfigs[this.currentHoleIndex],
      mesh: this.holes[0]?.mesh || null
    };
  }

  /**
   * Get the next hole configuration
   * @returns {Object} The next hole configuration object or null if no next hole
   */
  getNextHole() {
    if (!this.hasNextHole()) {
      return null;
    }
    return {
      ...this.holeConfigs[this.currentHoleIndex + 1],
      mesh: null // Next hole isn't loaded yet
    };
  }

  /**
   * Create a hazard on the course
   * @param {Object} hazardConfig - Configuration for the hazard
   */
  createHazard(_hazardConfig) {
    // Base implementation - to be overridden by specific courses
  }

  /**
   * Get the current hole configuration
   * @returns {Object} The current hole configuration
   */
  getCurrentHoleConfig() {
    // To be implemented by specific courses
    return null;
  }
}
