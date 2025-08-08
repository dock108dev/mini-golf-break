import { CourseElementRegistry } from './CourseElementRegistry';

/**
 * Course - Manages a collection of course elements
 * Uses the modular element system for flexibility
 */
export class Course {
  /**
   * Create a new course
   * @param {THREE.Scene} scene - Scene to add elements to
   * @param {CANNON.World} physicsWorld - Physics world
   * @param {Object} options - Course options
   */
  constructor(scene, physicsWorld, options = {}) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.options = {
      name: 'New Course',
      author: 'Anonymous',
      ...options
    };

    // Initialize course properties
    this.elements = [];
    this.elementById = {};
    this.registry = new CourseElementRegistry();
    this.currentHoleIndex = 0;
    this.totalHoles = 0;
    this.holes = [];
  }

  /**
   * Initialize a course from configuration data
   * @param {Object} courseData - Course configuration data
   * @returns {Promise<boolean>} Success status
   */
  async initialize(courseData) {
    try {
      // Update course metadata
      this.options.name = courseData.name || this.options.name;
      this.options.author = courseData.author || this.options.author;
      this.options.description = courseData.description || this.options.description;

      // Clear any existing elements
      await this.clear();

      // Create elements from configuration
      if (courseData.elements && Array.isArray(courseData.elements)) {
        this.elements = this.registry.createElementsFromConfig(
          courseData.elements,
          this.physicsWorld,
          this.scene
        );

        // Index elements by ID for quick lookup
        this.elements.forEach(element => {
          this.elementById[element.id] = element;

          // Identify hole elements
          if (element.elementType === 'hole') {
            this.holes.push(element);
          }
        });

        this.totalHoles = this.holes.length;

        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all course elements
   * @returns {Promise<void>}
   */
  async clear() {
    // Destroy each element
    this.elements.forEach(element => {
      element.destroy();
    });

    // Clear arrays and maps
    this.elements = [];
    this.elementById = {};
    this.holes = [];
    this.totalHoles = 0;

    // Allow time for physics world to settle
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Get current hole
   * @returns {BaseElement|null} Current hole element
   */
  getCurrentHole() {
    if (this.currentHoleIndex >= 0 && this.currentHoleIndex < this.holes.length) {
      return this.holes[this.currentHoleIndex];
    }
    return null;
  }

  /**
   * Get a course element by ID
   * @param {string} id - Element ID
   * @returns {BaseElement|null} Element with the given ID or null if not found
   */
  getElementById(id) {
    return this.elementById[id] || null;
  }

  /**
   * Get elements by type
   * @param {string} type - Element type
   * @returns {BaseElement[]} Elements with the given type
   */
  getElementsByType(type) {
    return this.elements.filter(element => element.elementType === type);
  }

  /**
   * Add a new element to the course
   * @param {string} elementType - Type of element to add
   * @param {Object} config - Element configuration
   * @returns {BaseElement} Created element
   */
  addElement(elementType, config) {
    const element = this.registry.createAndInitializeElement(
      elementType,
      config,
      this.physicsWorld,
      this.scene
    );

    this.elements.push(element);
    this.elementById[element.id] = element;

    // If this is a hole, add it to the holes array
    if (elementType === 'hole') {
      this.holes.push(element);
      this.totalHoles = this.holes.length;
    }

    return element;
  }

  /**
   * Remove an element from the course
   * @param {string} elementId - ID of element to remove
   * @returns {boolean} Success status
   */
  removeElement(elementId) {
    const element = this.getElementById(elementId);

    if (!element) {
      return false;
    }

    // Remove from holes array if it's a hole
    if (element.elementType === 'hole') {
      const holeIndex = this.holes.indexOf(element);
      if (holeIndex !== -1) {
        this.holes.splice(holeIndex, 1);
        this.totalHoles = this.holes.length;

        // Adjust current hole index if needed
        if (this.currentHoleIndex >= this.totalHoles) {
          this.currentHoleIndex = Math.max(0, this.totalHoles - 1);
        }
      }
    }

    // Destroy the element
    element.destroy();

    // Remove from arrays and maps
    const index = this.elements.indexOf(element);
    if (index !== -1) {
      this.elements.splice(index, 1);
    }
    delete this.elementById[elementId];

    return true;
  }

  /**
   * Advance to the next hole
   * @returns {BaseElement|null} Next hole element or null if there are no more holes
   */
  nextHole() {
    if (this.currentHoleIndex < this.totalHoles - 1) {
      this.currentHoleIndex++;
      return this.getCurrentHole();
    }
    return null;
  }

  /**
   * Get the start position of the current hole
   * @returns {THREE.Vector3|null} Start position or null if no current hole
   */
  getHoleStartPosition() {
    const hole = this.getCurrentHole();
    if (hole && hole.config.startPosition) {
      return hole.config.startPosition.clone();
    }
    return null;
  }

  /**
   * Get the hole position of the current hole
   * @returns {THREE.Vector3|null} Hole position or null if no current hole
   */
  getHolePosition() {
    const hole = this.getCurrentHole();
    if (hole && hole.config.holePosition) {
      return hole.config.holePosition.clone();
    }
    return null;
  }

  /**
   * Get the par for the current hole
   * @returns {number} Par value or 0 if no current hole
   */
  getHolePar() {
    const hole = this.getCurrentHole();
    if (hole && typeof hole.config.par === 'number') {
      return hole.config.par;
    }
    return 0;
  }

  /**
   * Export course to JSON format
   * @returns {Object} Course data in JSON format
   */
  toJSON() {
    return {
      name: this.options.name,
      author: this.options.author,
      description: this.options.description,
      elements: this.registry.serializeElements(this.elements)
    };
  }

  /**
   * Update loop for the course
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Update all elements
    this.elements.forEach(element => {
      if (typeof element.update === 'function') {
        element.update(dt);
      }
    });
  }

  /**
   * Create a new course from a JSON configuration
   * @param {Object} courseData - Course data in JSON format
   * @param {THREE.Scene} scene - Scene to add elements to
   * @param {CANNON.World} physicsWorld - Physics world
   * @returns {Promise<Course>} Created course
   */
  static async createFromJSON(courseData, scene, physicsWorld) {
    const course = new Course(scene, physicsWorld, {
      name: courseData.name,
      author: courseData.author,
      description: courseData.description
    });

    await course.initialize(courseData);

    return course;
  }
}
