/**
 * Jest setup file to configure test environment
 */

// Silence console output during tests

// Store original console methods before mocking
const originalConsoleError = console.error;

// Mock console methods to reduce noise during tests
console.log = jest.fn();
console.warn = jest.fn();

// Keep critical errors visible by restoring console.error for specific patterns
console.error = jest.fn((message, ...args) => {
  // Only show critical errors that aren't test-related
  if (
    typeof message === 'string' &&
    (message.includes('CRITICAL') ||
      message.includes('FATAL') ||
      message.includes('TypeError') ||
      message.includes('ReferenceError'))
  ) {
    originalConsoleError(message, ...args);
  }
});

// Note: Console methods will be restored when the test process ends

// Set environment variable to disable debug logging
process.env.NODE_ENV = 'test';
process.env.DISABLE_DEBUG_LOGGING = 'true';

// Mock CANNON-ES SAPBroadphase
jest.mock('cannon-es', () => {
  const originalCannon = jest.requireActual('cannon-es');
  return {
    ...originalCannon,
    World: jest.fn(() => ({
      add: jest.fn(),
      remove: jest.fn(),
      step: jest.fn(),
      contactmaterials: [],
      addContactMaterial: jest.fn(),
      removeContactMaterial: jest.fn(),
      addBody: jest.fn(),
      removeBody: jest.fn(),
      gravity: { set: jest.fn() },
      solver: {
        iterations: 30,
        tolerance: 0.0001,
        type: 1,
        equations: [],
        equationSorter: null
      },
      broadphase: null,
      allowSleep: true,
      defaultSleepSpeedLimit: 0.15,
      defaultSleepTimeLimit: 0.2,
      defaultContactMaterial: {
        friction: 0.8,
        restitution: 0.1,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 4,
        frictionEquationStiffness: 1e8,
        frictionEquationRelaxation: 3
      },
      bodies: [],
      constraints: [],
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    })),
    SAPBroadphase: jest.fn(() => ({})),
    NaiveBroadphase: jest.fn(() => ({})),
    Material: jest.fn(() => ({})),
    ContactMaterial: jest.fn(() => ({})),
    Body: jest.fn(() => ({
      position: { x: 0, y: 0, z: 0 },
      velocity: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn(),
        copy: jest.fn(),
        scale: jest.fn(),
        normalize: jest.fn()
      },
      angularVelocity: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn(),
        copy: jest.fn()
      },
      force: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn()
      },
      torque: {
        x: 0,
        y: 0,
        z: 0,
        set: jest.fn()
      },
      material: null,
      mass: 1,
      type: 0,
      shapes: [],
      id: Math.random(),
      sleepState: 0,
      allowSleep: true,
      sleepSpeedLimit: 0.15,
      sleepTimeLimit: 0.2,
      linearDamping: 0.01,
      angularDamping: 0.01,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      wakeUp: jest.fn(),
      sleep: jest.fn(),
      quaternion: {
        setFromAxisAngle: jest.fn(),
        setFromEuler: jest.fn(),
        x: 0,
        y: 0,
        z: 0,
        w: 1,
        set: jest.fn(),
        copy: jest.fn(),
        normalize: jest.fn()
      },
      addShape: jest.fn(),
      removeShape: jest.fn(),
      userData: {}
    })),
    Vec3: jest.fn((x, y, z) => ({ x, y, z })),
    Sphere: jest.fn(radius => ({ radius })),
    Box: jest.fn(() => ({})),
    Plane: jest.fn(() => ({})),
    Cylinder: jest.fn(() => ({}))
  };
});

// Mock Three.js post-processing to avoid ES module import issues
jest.mock('three/examples/jsm/postprocessing/EffectComposer', () => ({
  EffectComposer: jest.fn(() => ({
    addPass: jest.fn(),
    render: jest.fn(),
    setSize: jest.fn(),
    dispose: jest.fn()
  }))
}));

jest.mock('three/examples/jsm/postprocessing/RenderPass', () => ({
  RenderPass: jest.fn()
}));

jest.mock('three/examples/jsm/postprocessing/UnrealBloomPass', () => ({
  UnrealBloomPass: jest.fn()
}));

// Mock Three.js OrbitControls to avoid ES module import issues
jest.mock('three/examples/jsm/controls/OrbitControls', () => ({
  OrbitControls: jest.fn(() => ({
    enableDamping: true,
    dampingFactor: 0.1,
    enableZoom: true,
    enablePan: true,
    maxPolarAngle: Math.PI / 2,
    minDistance: 2,
    maxDistance: 50,
    target: { set: jest.fn() },
    update: jest.fn(),
    dispose: jest.fn()
  }))
}));

// Mock additional Three.js classes needed by tests
jest.mock(
  'three',
  () => {
    const originalThree = jest.requireActual('three');
    return {
      ...originalThree,
      AudioListener: jest.fn(() => ({
        context: { state: 'running' },
        getInput: jest.fn(),
        removeFilter: jest.fn(),
        setFilter: jest.fn()
      })),
      Audio: jest.fn(() => ({
        setVolume: jest.fn().mockReturnThis(),
        play: jest.fn(),
        stop: jest.fn(),
        pause: jest.fn(),
        setBuffer: jest.fn().mockReturnThis(),
        isPlaying: false
      })),
      Group: jest.fn(() => ({
        add: jest.fn(),
        remove: jest.fn(),
        children: [],
        name: '',
        userData: {},
        position: { x: 0, y: 0, z: 0, set: jest.fn() },
        rotation: { x: 0, y: 0, z: 0, set: jest.fn() },
        scale: { x: 1, y: 1, z: 1, set: jest.fn() }
      })),
      WebGLRenderer: jest.fn(() => ({
        setSize: jest.fn(),
        setClearColor: jest.fn(),
        setPixelRatio: jest.fn(),
        render: jest.fn(),
        dispose: jest.fn(),
        domElement: { nodeName: 'CANVAS' },
        capabilities: {},
        shadowMap: { enabled: false }
      })),
      PerspectiveCamera: jest.fn(() => ({
        position: { set: jest.fn(), copy: jest.fn() },
        lookAt: jest.fn(),
        add: jest.fn(),
        remove: jest.fn(),
        updateProjectionMatrix: jest.fn()
      })),
      // Geometry constructors
      CircleGeometry: jest.fn(),
      TorusGeometry: jest.fn(() => ({ dispose: jest.fn() })),
      CylinderGeometry: jest.fn(),
      SphereGeometry: jest.fn(),
      PlaneGeometry: jest.fn(() => ({
        attributes: {
          position: {
            array: new Float32Array([-1, 1, 0, 1, 1, 0, -1, -1, 0, 1, -1, 0])
          }
        }
      })),
      BoxGeometry: jest.fn(),
      // Vector3 class with prototype methods
      Vector3: (() => {
        const Vector3Mock = jest.fn(function (x = 0, y = 0, z = 0) {
          this.x = x;
          this.y = y;
          this.z = z;
          this.copy = jest.fn().mockReturnThis();
          this.clone = jest.fn(() => new Vector3Mock(this.x, this.y, this.z));
          this.toArray = jest.fn(() => [this.x, this.y, this.z]);
          this.addVectors = jest.fn().mockReturnThis();
          this.add = jest.fn().mockReturnThis();
          this.multiplyScalar = jest.fn().mockReturnThis();
          this.subVectors = jest.fn().mockReturnThis();
          this.normalize = jest.fn().mockReturnThis();
          return this;
        });
        Vector3Mock.prototype = {
          addVectors: jest.fn().mockReturnThis(),
          add: jest.fn().mockReturnThis(),
          multiplyScalar: jest.fn().mockReturnThis(),
          subVectors: jest.fn().mockReturnThis(),
          normalize: jest.fn().mockReturnThis(),
          copy: jest.fn().mockReturnThis(),
          clone: jest.fn()
        };
        return Vector3Mock;
      })(),
      // Material classes
      MeshStandardMaterial: jest.fn(() => ({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.2
      })),
      MeshBasicMaterial: jest.fn(opts => ({
        color: opts?.color || 0xffffff,
        opacity: opts?.opacity !== undefined ? opts.opacity : 1,
        transparent: opts?.transparent || false,
        dispose: jest.fn()
      })),
      // Mesh class
      Mesh: jest.fn(function (geometry, material) {
        this.geometry = geometry;
        this.material = material;
        this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
        this.rotation = { x: 0, y: 0, z: 0, set: jest.fn() };
        this.scale = { x: 1, y: 1, z: 1, set: jest.fn(), setScalar: jest.fn() };
        this.castShadow = false;
        this.receiveShadow = false;
        this.name = '';
        this.userData = {};
        this.add = jest.fn();
        this.remove = jest.fn();
        this.children = [];
        return this;
      })
    };
  },
  { virtual: true }
);
