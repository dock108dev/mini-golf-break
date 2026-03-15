import * as CANNON from 'cannon-es';
import { debug } from '../utils/debug';

export class PhysicsWorld {
  constructor() {
    // Create the Cannon.js world with more iterations for stability
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.81, 0); // Earth gravity

    // Initialize materials array for tracking
    this.materials = [];

    // Set solver iterations to match documentation
    this.world.solver.iterations = 30; // Increased from 20 for better contact resolution
    this.world.solver.tolerance = 0.0001;

    // Use SAPBroadphase for better performance with many objects
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // Allow sleeping bodies for better performance
    this.world.allowSleep = true;

    // Set default sleep parameters to match documentation
    this.world.defaultSleepSpeedLimit = 0.15; // Updated to match documentation
    this.world.defaultSleepTimeLimit = 0.2; // Updated to match documentation

    // Set default material properties
    this.defaultMaterial = new CANNON.Material('default');
    this.groundMaterial = new CANNON.Material('ground');
    this.ballMaterial = new CANNON.Material('ball');
    this.bumperMaterial = new CANNON.Material('bumper'); // New material for obstacles
    this.holeCupMaterial = new CANNON.Material('holeCup'); // Material for the physical hole cup
    this.holeRimMaterial = new CANNON.Material('holeRim'); // New material for the hole edge/funnel

    // Store all materials in the materials array
    this.materials.push(
      this.defaultMaterial,
      this.groundMaterial,
      this.ballMaterial,
      this.bumperMaterial,
      this.holeCupMaterial,
      this.holeRimMaterial
    );

    // Create contact materials
    this.createContactMaterials();

    // Set the timestep (fixed at 60fps)
    this.fixedTimeStep = 1.0 / 60.0;
    this.maxSubSteps = 8; // Increased from 3 for better handling of fast-moving objects

    // Last time used for calculating elapsed time
    this.lastCallTime = performance.now() / 1000;

    // Track when physics world was created to prevent immediate collisions
    this.creationTime = Date.now();
    this.collisionGracePeriod = 2000; // ms - increased from 500ms

    // Add collide event listener for hole detection
    this.setupCollideListener();

    debug.log('Physics world initialized');
  }

  createContactMaterials() {
    // Set up contact between ball and ground (normal green)
    const ballGroundContact = new CANNON.ContactMaterial(this.ballMaterial, this.groundMaterial, {
      friction: 0.8, // Increased friction for faster deceleration
      restitution: 0.1, // Keep low bounce
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3,
      frictionEquationStiffness: 1e7,
      frictionEquationRelaxation: 1 // Reduced relaxation for better friction response
    });
    this.world.addContactMaterial(ballGroundContact);

    // Set up contact between ball and bumpers (obstacles)
    debug.log(
      `[PhysicsWorld] Defining ballBumperContact with ballMat ID: ${this.ballMaterial?.id}, bumperMat ID: ${this.bumperMaterial?.id}`
    ); // Log IDs before definition
    const ballBumperContact = new CANNON.ContactMaterial(this.ballMaterial, this.bumperMaterial, {
      friction: 0.2, // Restored original value
      restitution: 0.7, // Increased from 0.4 for better bounce off walls
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3, // Increased for more elastic collisions
      frictionEquationStiffness: 1e7,
      frictionEquationRelaxation: 1 // Reduced from 2 for firmer friction response
    });
    this.world.addContactMaterial(ballBumperContact);
    debug.log(
      '[PhysicsWorld] World contact materials after adding ballBumper:',
      this.world.contactmaterials.map(
        cm =>
          `${cm.materials[0]?.name}(${cm.materials[0]?.id}) <-> ${cm.materials[1]?.name}(${cm.materials[1]?.id})`
      )
    ); // Log world's contact materials

    // Set up contact between ball and hole cup
    const ballHoleCupContact = new CANNON.ContactMaterial(this.ballMaterial, this.holeCupMaterial, {
      friction: 0.3, // Moderate friction
      restitution: 0.0, // ZERO bounce (was 0.1)
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3,
      frictionEquationStiffness: 1e7,
      frictionEquationRelaxation: 3
    });
    this.world.addContactMaterial(ballHoleCupContact);
    debug.log('[PhysicsWorld] Added ballHoleCupContact.');

    // Set up contact between ball and hole rim/funnel - low bounce
    const ballRimContact = new CANNON.ContactMaterial(this.ballMaterial, this.holeRimMaterial, {
      friction: 0.6, // Similar to ground friction
      restitution: 0.01, // VERY low bounce
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3,
      frictionEquationStiffness: 1e7,
      frictionEquationRelaxation: 1
    });
    this.world.addContactMaterial(ballRimContact);
    debug.log('[PhysicsWorld] Added ballRimContact.');

    // Default contact material for everything else
    if (this.world.defaultContactMaterial) {
      this.world.defaultContactMaterial.friction = 0.8; // Increased default friction
      this.world.defaultContactMaterial.restitution = 0.1; // Restored original value
    } else {
      // In testing environment, defaultContactMaterial might be null
      debug.log(
        '[PhysicsWorld] defaultContactMaterial is null, skipping default material configuration'
      );
    }
  }

  update() {
    const time = performance.now() / 1000;
    let dt = time - this.lastCallTime;

    // Cap the delta time to prevent large jumps
    if (dt > 0.1) {
      dt = 0.1;
    }

    this.lastCallTime = time;

    // Debug log much less frequently (approximately once every minute)
    const debugRate = 0.0005;
    if (Math.random() < debugRate) {
      const bodyCount = this.world ? this.world.bodies.length : 0;
      debug.log(
        `DEBUG PhysicsWorld.update: Physics update dt=${dt.toFixed(4)}, bodyCount=${bodyCount}`
      );

      // Check if there's a ball in the physics world
      const ballBody = this.world.bodies.find(
        body => body.shapes && body.shapes[0] && body.shapes[0].type === CANNON.Shape.types.SPHERE
      );

      if (ballBody) {
        debug.log(
          'DEBUG PhysicsWorld.update: Ball found in physics world. ' +
            `Position: (${ballBody.position.x.toFixed(2)}, ${ballBody.position.y.toFixed(2)}, ${ballBody.position.z.toFixed(2)}), ` +
            `Velocity: (${ballBody.velocity.x.toFixed(2)}, ${ballBody.velocity.y.toFixed(2)}, ${ballBody.velocity.z.toFixed(2)}), ` +
            `Sleeping: ${ballBody.sleepState}`
        );
      }
    }

    // Step the physics world with safety checks
    if (this.world) {
      try {
        // Wake up all bodies before stepping to ensure they're in a valid state
        this.world.bodies.forEach(body => {
          if (body && typeof body.wakeUp === 'function') {
            body.wakeUp();
          }
        });

        // Temporarily remove collision callback if it exists
        let tempCallback = null;
        if (this._collisionCallback) {
          tempCallback = this._collisionCallback;
          this.world.removeEventListener('beginContact', this._collisionCallback);
        }

        // Step the world
        this.world.step(this.fixedTimeStep, dt, this.maxSubSteps);

        // Re-add collision callback if it was removed
        if (
          tempCallback &&
          this.world.addEventListener &&
          typeof this.world.addEventListener === 'function'
        ) {
          this.world.addEventListener('beginContact', tempCallback);
        }
      } catch (error) {
        console.error('Error in physics update:', error);
        // If we get an error, try to recover by resetting all bodies
        this.world.bodies.forEach(body => {
          if (body) {
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.force.set(0, 0, 0);
            body.torque.set(0, 0, 0);
            if (typeof body.wakeUp === 'function') {
              body.wakeUp();
            }
          }
        });
      }
    }
  }

  /**
   * Set up the collide event listener
   */
  setupCollideListener() {
    // Remove any existing listeners first to avoid duplicates
    if (this.world.removeEventListener && typeof this.world.removeEventListener === 'function') {
      this.world.removeEventListener('collide', this._collideCallback);
    }

    // Create a new collide callback
    this._collideCallback = _event => {
      // Check if we're still in the grace period
      const timeSinceCreation = Date.now() - this.creationTime;
      if (timeSinceCreation < this.collisionGracePeriod) {
        debug.log(
          `[PhysicsWorld] Ignoring collide event during grace period (${timeSinceCreation}ms < ${this.collisionGracePeriod}ms)`
        );
        return;
      }

      // Get the bodies involved in the collision
      // const _bodyA = event.bodyA;
      // const _bodyB = event.bodyB;

      // REMOVED specific ball/hole check here - handled in Ball.js now
      // let ball = null;
      // let hole = null;
      //
      // if (bodyA.userData && bodyA.userData.type === 'ball') {
      //     ball = bodyA;
      //     if (bodyB.userData && bodyB.userData.type === 'hole') {
      //         hole = bodyB;
      //     }
      // } else if (bodyB.userData && bodyB.userData.type === 'ball') {
      //     ball = bodyB;
      //     if (bodyA.userData && bodyA.userData.type === 'hole') {
      //         hole = bodyA;
      //     }
      // }
      //
      // // If we found a ball and hole collision
      // if (ball && hole) {
      //     debug.log(`[PhysicsWorld] Ball entered hole ${hole.userData.holeIndex + 1}`);
      //
      //     // Check if we have a game object with onBallInHole method
      //     if (this.game && typeof this.game.onBallInHole === 'function') {
      //         this.game.onBallInHole(hole.userData.holeIndex);
      //     }
      // }
    };

    // Add the callback to the world
    if (this.world.addEventListener && typeof this.world.addEventListener === 'function') {
      this.world.addEventListener('collide', this._collideCallback);
    }
  }

  // Store collision callback for re-adding after reset
  setCollisionCallback(callback) {
    // Wrap the callback with our own that includes grace period check
    const wrappedCallback = event => {
      // Check if we're still in the grace period
      const timeSinceCreation = Date.now() - this.creationTime;
      if (timeSinceCreation < this.collisionGracePeriod) {
        debug.log(
          `[PhysicsWorld] Ignoring collision during grace period (${timeSinceCreation}ms < ${this.collisionGracePeriod}ms)`
        );
        return;
      }
      // Call the original callback if grace period passed
      if (callback) {
        callback(event);
      }
    };

    // Remove existing listener if it exists
    if (this._collisionCallback) {
      this.world.removeEventListener('beginContact', this._collisionCallback);
    }

    // Store the wrapped callback internally
    this._collisionCallback = wrappedCallback;

    // Add the new wrapped listener
    if (this.world.addEventListener && typeof this.world.addEventListener === 'function') {
      this.world.addEventListener('beginContact', this._collisionCallback);
    }
  }

  /**
   * Clean up resources used by the PhysicsWorld.
   * Currently just logs, but could be used to remove listeners or objects.
   */
  cleanup() {
    debug.log('[PhysicsWorld] Cleanup called.');
    // Remove collide listener if it exists
    if (this._collideCallback) {
      this.world?.removeEventListener('collide', this._collideCallback);
      this._collideCallback = null;
    }
    // Add any other necessary cleanup for PhysicsWorld itself
  }

  addBody(body) {
    if (this.world && body) {
      // Log body details before adding with defensive checks
      const shapes = body.shapes || [];
      const userData = body.userData || {};
      debug.log(
        '[PhysicsWorld] Adding body: ' +
          `ID=${body.id || 'unknown'}, Type=${body.type || 'unknown'}, Mass=${body.mass || 0}, ` +
          `ShapeType=${shapes[0]?.type || 'none'}, MaterialID=${body.material?.id || 'none'}, ` +
          `UserData=${JSON.stringify(userData)}`
      );
      this.world.addBody(body);
    }
  }

  removeBody(body) {
    if (this.world && body) {
      // Wake up the body before removal
      if (typeof body.wakeUp === 'function') {
        body.wakeUp();
      }

      // Reset all physics properties with defensive checks
      if (body.velocity && typeof body.velocity.set === 'function') {
        body.velocity.set(0, 0, 0);
      }
      if (body.angularVelocity && typeof body.angularVelocity.set === 'function') {
        body.angularVelocity.set(0, 0, 0);
      }
      if (body.force && typeof body.force.set === 'function') {
        body.force.set(0, 0, 0);
      }
      if (body.torque && typeof body.torque.set === 'function') {
        body.torque.set(0, 0, 0);
      }

      // Remove all constraints involving this body first
      const constraintsToRemove = this.world.constraints.filter(
        c => c.bodyA === body || c.bodyB === body
      );
      constraintsToRemove.forEach(c => this.world.removeConstraint(c));

      // Finally remove the body
      this.world.removeBody(body);

      // Log body removal
      debug.log(
        `[PhysicsWorld] Removed body of type: ${body.userData ? body.userData.type : 'unknown'}`
      );
    }
  }

  // Helper to create a plane body for ground
  createGroundBody(material = this.groundMaterial) {
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material
    });

    // Add a plane shape - this is infinite in size
    const planeShape = new CANNON.Plane();
    groundBody.addShape(planeShape);

    // Rotate to be flat on XZ plane
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);

    return groundBody;
  }

  // Helper to create a box body
  createBoxBody(size, position, material = this.defaultMaterial, mass = 0) {
    const boxBody = new CANNON.Body({
      mass,
      material,
      position: new CANNON.Vec3(position.x, position.y, position.z)
    });

    // Add a box shape
    const boxShape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    boxBody.addShape(boxShape);

    return boxBody;
  }

  // Helper to create a sphere body
  createSphereBody(radius, position, material = this.ballMaterial, mass = 1) {
    const sphereBody = new CANNON.Body({
      mass,
      material,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.6,
      angularDamping: 0.6,
      allowSleep: true, // Let body sleep when stopped
      sleepSpeedLimit: 0.15, // Updated to match documentation (was 0.03)
      sleepTimeLimit: 0.2 // Updated to match documentation (was 0.5)
    });

    // Add a sphere shape
    const sphereShape = new CANNON.Sphere(radius);
    sphereBody.addShape(sphereShape);

    // Set initial velocity to zero
    sphereBody.velocity.set(0, 0, 0);
    sphereBody.angularVelocity.set(0, 0, 0);

    // Make sure the body is awake to start with
    sphereBody.wakeUp();

    return sphereBody;
  }

  // Helper to create a cylinder body (for holes)
  createCylinderBody(radius, height, position, material = this.defaultMaterial, mass = 0) {
    // Fix the cylinder orientation to match our hole geometry
    const cylinderBody = new CANNON.Body({
      mass,
      shape: new CANNON.Cylinder(radius, radius, height, 16),
      material,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      collisionResponse: false // Doesn't physically interact but can detect collisions
    });
    // No rotation needed as the cylinder should be vertical
    return cylinderBody;
  }

  /**
   * Reset the physics world to its initial state
   */
  reset() {
    debug.log('[PhysicsWorld] Resetting physics world');

    // Remove all bodies
    const bodies = [...this.world.bodies];
    bodies.forEach(body => {
      if (body) {
        // Wake up the body before removal
        if (typeof body.wakeUp === 'function') {
          body.wakeUp();
        }

        // Reset all physics properties
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.force.set(0, 0, 0);
        body.torque.set(0, 0, 0);

        // Remove all shapes from the body first
        body.shapes.forEach(shape => {
          body.removeShape(shape);
        });

        // Remove the body
        this.world.removeBody(body);
      }
    });

    // Reset the world's state
    this.world.gravity.set(0, -9.81, 0);
    this.world.solver.iterations = 30;
    this.world.solver.tolerance = 0.0001;
    this.world.allowSleep = true;
    this.world.defaultSleepSpeedLimit = 0.15;
    this.world.defaultSleepTimeLimit = 0.2;

    // Recreate contact materials
    this.createContactMaterials();

    // Reset grace period
    this.creationTime = Date.now();
    debug.log(`[PhysicsWorld] Reset collision grace period at ${this.creationTime}`);

    // Reset collision listeners
    this.setupCollideListener();

    debug.log('[PhysicsWorld] Physics world reset complete');
  }

  /**
   * Step the physics world (wrapper for world.step)
   */
  step(timeStep, deltaTime, maxSubSteps) {
    if (this.world && typeof this.world.step === 'function') {
      // Use fixed timestep if not provided, with fallback values
      const fixedTimeStep = this.fixedTimeStep || 1.0 / 60.0;
      const maxSteps = maxSubSteps || this.maxSubSteps || 3;

      // Update last call time for tracking
      const currentTime = performance.now() / 1000;
      if (this.lastCallTime !== undefined) {
        this.lastCallTime = currentTime;
      }

      this.world.step(fixedTimeStep, timeStep, maxSteps);
    }
  }

  /**
   * Get the underlying Cannon.js world instance
   */
  getWorld() {
    return this.world;
  }

  /**
   * Get all materials
   */
  getMaterials() {
    return this.materials || [];
  }

  /**
   * Get a material by name
   */
  getMaterial(name) {
    if (!this.materials) {
      return null;
    }
    const material = this.materials.find(material => material.name === name);
    return material || null;
  }

  /**
   * Set gravity for the physics world
   */
  setGravity(x, y, z) {
    if (this.world && this.world.gravity && typeof this.world.gravity.set === 'function') {
      // Handle Vec3 parameter (first argument is a Vec3 object)
      if (typeof x === 'object' && x !== null && 'x' in x && 'y' in x && 'z' in x) {
        this.world.gravity.set(x.x, x.y, x.z);
      } else {
        // Handle individual x, y, z parameters
        this.world.gravity.set(x, y, z);
      }
    }
  }
}
