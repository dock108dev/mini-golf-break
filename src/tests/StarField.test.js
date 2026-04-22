import { StarField } from '../objects/StarField';
import * as THREE from 'three';

describe('StarField', () => {
  let mockScene;
  let starField;

  beforeEach(() => {
    mockScene = {
      add: jest.fn(),
      remove: jest.fn()
    };
    starField = new StarField(mockScene);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('stores scene reference and initialises null layers', () => {
      expect(starField.scene).toBe(mockScene);
      expect(starField._nearLayer).toBeNull();
      expect(starField._midLayer).toBeNull();
      expect(starField._farLayer).toBeNull();
    });

    test('initialises previous camera position to origin', () => {
      expect(starField._prevCamX).toBe(0);
      expect(starField._prevCamZ).toBe(0);
    });
  });

  describe('init', () => {
    test('adds exactly 3 layers to the scene', () => {
      starField.init();
      expect(mockScene.add).toHaveBeenCalledTimes(3);
    });

    test('near layer has opacity 0.7', () => {
      starField.init();
      expect(starField._nearLayer.material.opacity).toBe(0.7);
    });

    test('mid layer has opacity 0.5', () => {
      starField.init();
      expect(starField._midLayer.material.opacity).toBe(0.5);
    });

    test('far layer has opacity 0.3', () => {
      starField.init();
      expect(starField._farLayer.material.opacity).toBe(0.3);
    });

    test('all layers use sizeAttenuation: false', () => {
      starField.init();
      expect(starField._nearLayer.material.sizeAttenuation).toBe(false);
      expect(starField._midLayer.material.sizeAttenuation).toBe(false);
      expect(starField._farLayer.material.sizeAttenuation).toBe(false);
    });

    test('all layers are THREE.Points instances', () => {
      starField.init();
      expect(starField._nearLayer).toBeInstanceOf(THREE.Points);
      expect(starField._midLayer).toBeInstanceOf(THREE.Points);
      expect(starField._farLayer).toBeInstanceOf(THREE.Points);
    });

    test('all layers have userData.type starfield', () => {
      starField.init();
      expect(starField._nearLayer.userData.type).toBe('starfield');
      expect(starField._midLayer.userData.type).toBe('starfield');
      expect(starField._farLayer.userData.type).toBe('starfield');
    });
  });

  describe('update — parallax', () => {
    beforeEach(() => {
      starField.init();
      starField._prevCamX = 0;
      starField._prevCamZ = 0;
    });

    test('near layer shifts more than far layer on x-axis camera pan', () => {
      const camera = { position: { x: 10, y: 20, z: 0 } };
      starField.update(camera);
      expect(Math.abs(starField._nearLayer.position.x)).toBeGreaterThan(
        Math.abs(starField._farLayer.position.x)
      );
    });

    test('mid layer shifts more than far layer on camera pan', () => {
      const camera = { position: { x: 10, y: 20, z: 0 } };
      starField.update(camera);
      expect(Math.abs(starField._midLayer.position.x)).toBeGreaterThan(
        Math.abs(starField._farLayer.position.x)
      );
    });

    test('layers shift opposite to camera movement direction', () => {
      // Camera moves +x → layers should shift -x (parallax)
      const camera = { position: { x: 10, y: 20, z: 0 } };
      starField.update(camera);
      expect(starField._nearLayer.position.x).toBeLessThan(0);
      expect(starField._midLayer.position.x).toBeLessThan(0);
      expect(starField._farLayer.position.x).toBeLessThan(0);
    });

    test('records updated camera position for next frame delta', () => {
      const camera = { position: { x: 5, y: 0, z: 3 } };
      starField.update(camera);
      expect(starField._prevCamX).toBe(5);
      expect(starField._prevCamZ).toBe(3);
    });

    test('no shift when camera has not moved', () => {
      const camera = { position: { x: 0, y: 0, z: 0 } };
      starField.update(camera);
      expect(starField._nearLayer.position.x).toBe(0);
      expect(starField._nearLayer.position.z).toBe(0);
    });

    test('handles null camera without throwing', () => {
      expect(() => starField.update(null)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    test('removes all 3 layers from the scene', () => {
      starField.init();
      starField.cleanup();
      expect(mockScene.remove).toHaveBeenCalledTimes(3);
    });

    test('nulls out layer references after cleanup', () => {
      starField.init();
      starField.cleanup();
      expect(starField._nearLayer).toBeNull();
      expect(starField._midLayer).toBeNull();
      expect(starField._farLayer).toBeNull();
    });

    test('does not throw when called before init', () => {
      expect(() => starField.cleanup()).not.toThrow();
    });
  });
});
