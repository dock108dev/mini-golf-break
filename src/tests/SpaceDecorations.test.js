// Mock Three.js before importing anything
jest.mock('three', () => ({
  SphereGeometry: jest.fn(),
  MeshPhongMaterial: jest.fn(() => ({
    dispose: jest.fn()
  })),
  MeshBasicMaterial: jest.fn(() => ({
    dispose: jest.fn()
  })),
  Mesh: jest.fn(() => ({
    position: { set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0, set: jest.fn() },
    add: jest.fn(),
    userData: {},
    geometry: { dispose: jest.fn(), type: 'SphereGeometry' },
    material: { dispose: jest.fn() }
  })),
  RingGeometry: jest.fn(),
  PlaneGeometry: jest.fn(),
  OctahedronGeometry: jest.fn(),
  ConeGeometry: jest.fn(),
  Group: jest.fn(() => ({
    add: jest.fn(),
    userData: {},
    children: []
  })),
  Color: jest.fn(),
  MathUtils: {
    randFloat: jest.fn((min, max) => (min + max) / 2),
    randInt: jest.fn((min, max) => Math.floor((min + max) / 2))
  }
}));

import { SpaceDecorations } from '../objects/SpaceDecorations';
import * as THREE from 'three';

describe('SpaceDecorations', () => {
  let scene;
  let spaceDecorations;

  beforeEach(() => {
    // Mock scene
    scene = {
      add: jest.fn(object => {
        // Simulate Three.js behavior of setting parent when adding to scene
        object.parent = scene;
      }),
      remove: jest.fn()
    };

    // Clear mock calls
    jest.clearAllMocks();

    spaceDecorations = new SpaceDecorations(scene);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize without errors', () => {
    expect(() => spaceDecorations.init()).not.toThrow();
  });

  test('should add floating planets', () => {
    spaceDecorations.addFloatingPlanets();

    // Should create 3 planets (Earth, Mars, Saturn)
    expect(THREE.SphereGeometry).toHaveBeenCalledTimes(3);
    expect(THREE.MeshPhongMaterial).toHaveBeenCalledTimes(3);
    expect(scene.add).toHaveBeenCalledTimes(3);
  });

  test('should add Saturn with rings', () => {
    spaceDecorations.addFloatingPlanets();

    // Saturn's rings
    expect(THREE.RingGeometry).toHaveBeenCalled();
    expect(THREE.MeshBasicMaterial).toHaveBeenCalled();
  });

  test('should add distant nebula', () => {
    spaceDecorations.addDistantNebula();

    // Should create 2 nebula clouds (geometry is reused)
    expect(THREE.PlaneGeometry).toHaveBeenCalledTimes(1);
    expect(THREE.MeshBasicMaterial).toHaveBeenCalledTimes(2);
    expect(scene.add).toHaveBeenCalledTimes(2);
  });

  test('should add space debris', () => {
    spaceDecorations.addSpaceDebris();

    // Should create debris group
    expect(THREE.Group).toHaveBeenCalled();
    expect(THREE.OctahedronGeometry).toHaveBeenCalled();
    expect(scene.add).toHaveBeenCalled();
  });

  test('should add shooting stars', () => {
    spaceDecorations.addShootingStars();

    // Should create 3 shooting stars (geometry is reused)
    expect(THREE.ConeGeometry).toHaveBeenCalledTimes(1);
    expect(scene.add).toHaveBeenCalledTimes(3);
  });

  test('should update decorations on animation frame', () => {
    spaceDecorations.init();

    // Add a mock decoration with rotation
    const mockDecoration = {
      userData: { type: 'decoration' },
      geometry: { type: 'SphereGeometry' },
      rotation: { y: 0 }
    };
    spaceDecorations.decorations.push(mockDecoration);

    const deltaTime = 0.016; // ~60fps
    spaceDecorations.update(deltaTime);

    // Should rotate planets
    expect(mockDecoration.rotation.y).toBeCloseTo(0.0016);
  });

  test('should animate shooting stars during update', () => {
    const shootingStar = {
      userData: { type: 'shootingStar' },
      visible: true,
      position: { x: 0, y: 30, z: -50, set: jest.fn() }
    };
    spaceDecorations.decorations.push(shootingStar);

    spaceDecorations.update(0.016);

    // Shooting star should move right and down
    expect(shootingStar.position.x).toBeCloseTo(0.64, 1);
    expect(shootingStar.position.y).toBeCloseTo(29.84, 1);
  });

  test('should hide shooting star when it moves off screen', () => {
    const shootingStar = {
      userData: { type: 'shootingStar' },
      visible: true,
      position: { x: 79, y: 30, z: -50, set: jest.fn() }
    };
    spaceDecorations.decorations.push(shootingStar);

    spaceDecorations.update(0.1); // enough to push past 80

    expect(shootingStar.visible).toBe(false);
  });

  test('should cleanup all decorations', () => {
    spaceDecorations.init();

    const decorationCount = spaceDecorations.decorations.length;
    expect(decorationCount).toBeGreaterThan(0);

    spaceDecorations.cleanup();

    // Should remove all decorations
    expect(spaceDecorations.decorations.length).toBe(0);
    expect(scene.remove).toHaveBeenCalled();
  });

  test('should dispose of geometries and materials on cleanup', () => {
    const mockDecoration = {
      parent: scene,
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    };

    spaceDecorations.decorations.push(mockDecoration);
    spaceDecorations.cleanup();

    expect(mockDecoration.geometry.dispose).toHaveBeenCalled();
    expect(mockDecoration.material.dispose).toHaveBeenCalled();
  });
});
