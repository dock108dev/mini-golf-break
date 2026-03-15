import { debug } from '../utils/debug';
import * as THREE from 'three';
import { HoleEntity } from './HoleEntity';
import { BaseElement } from './BaseElement';
import { BunkerElement } from './BunkerElement';
import { WallElement } from './WallElement';

/**
 * CourseElementRegistry - Registry for all course elements
 * Manages element factories and creation
 */
export class CourseElementRegistry {
  constructor() {
    this.elementTypes = {};
    this.registerBuiltInTypes();
  }

  /**
   * Register built-in element types
   */
  registerBuiltInTypes() {
    // Register all standard element types
    this.register('hole', HoleEntity);
    this.register('bunker', BunkerElement);
    this.register('wall', WallElement);

    debug.log(
      '[CourseElementRegistry] Registered built-in element types:',
      Object.keys(this.elementTypes)
    );
  }

  /**
   * Register a new element type
   * @param {string} elementType - Type identifier for the element
   * @param {class} ElementClass - Class to instantiate for this element type (must extend BaseElement)
   */
  register(elementType, ElementClass) {
    // Validate that the class extends BaseElement
    if ((!ElementClass.prototype) instanceof BaseElement) {
      console.warn(
        `[CourseElementRegistry] Element class for "${elementType}" may not be a BaseElement subclass.`
      );
    }

    this.elementTypes[elementType] = ElementClass;
    return this; // For chaining
  }

  /**
   * Check if an element type is registered
   * @param {string} elementType - Type to check
   * @returns {boolean} Whether the type is registered
   */
  hasElementType(elementType) {
    return this.elementTypes.hasOwnProperty(elementType);
  }

  /**
   * Get all registered element types
   * @returns {string[]} Array of registered element type identifiers
   */
  getRegisteredTypes() {
    return Object.keys(this.elementTypes);
  }

  /**
   * Create an element instance
   * @param {string} elementType - Type of element to create
   * @param {object} config - Configuration for the element
   * @param {CANNON.World} world - Physics world
   * @param {THREE.Scene} scene - Scene to add the element to
   * @returns {BaseElement} The created element instance
   */
  createElement(elementType, config, world, scene) {
    // Ensure the element type is registered
    if (!this.hasElementType(elementType)) {
      throw new Error(`Unknown element type: ${elementType}`);
    }

    // Get the element class
    const ElementClass = this.elementTypes[elementType];

    // Create and return the element
    const element = new ElementClass(world, config, scene);

    debug.log(
      `[CourseElementRegistry] Created element of type "${elementType}": ${element.name} (${element.id})`
    );

    return element;
  }

  /**
   * Create an element and call its create() method
   * @param {string} elementType - Type of element to create
   * @param {object} config - Configuration for the element
   * @param {CANNON.World} world - Physics world
   * @param {THREE.Scene} scene - Scene to add the element to
   * @returns {BaseElement} The created and initialized element instance
   */
  createAndInitializeElement(elementType, config, world, scene) {
    const element = this.createElement(elementType, config, world, scene);

    // Initialize the element
    const success = element.create();

    if (!success) {
      console.error(
        `[CourseElementRegistry] Failed to initialize element of type "${elementType}": ${element.name} (${element.id})`
      );
    }

    return element;
  }

  /**
   * Create multiple elements from a configuration array
   * @param {Array} elementsConfig - Array of element configurations
   * @param {CANNON.World} world - Physics world
   * @param {THREE.Scene} scene - Scene to add elements to
   * @returns {Array} Array of created elements
   */
  createElementsFromConfig(elementsConfig, world, scene) {
    const elements = [];

    for (const config of elementsConfig) {
      try {
        // Ensure each config has a type
        if (!config.type) {
          console.error(
            `[CourseElementRegistry] Element config missing 'type': ${JSON.stringify(config)}`
          );
          continue;
        }

        // Create and initialize the element
        const element = this.createAndInitializeElement(config.type, config, world, scene);
        elements.push(element);
      } catch (error) {
        console.error('[CourseElementRegistry] Failed to create element:', error, config);
      }
    }

    debug.log(`[CourseElementRegistry] Created ${elements.length} elements from config`);
    return elements;
  }

  /**
   * Serialize elements to JSON-compatible format
   * @param {Array} elements - Array of elements to serialize
   * @returns {Array} Array of serialized element configurations
   */
  serializeElements(elements) {
    return elements.map(element => {
      return {
        type: element.elementType,
        id: element.id,
        name: element.name,
        position: element.position.toArray(),
        ...element.config
      };
    });
  }
}
