/**
 * Unit tests for HeroPropFactory
 */

import { createHeroProp } from '../../objects/HeroPropFactory';
import * as THREE from 'three';

jest.mock('three', () => {
  const createMockMesh = () => ({
    position: { set: jest.fn(), x: 0, y: 0, z: 0 },
    rotation: { set: jest.fn(), x: 0, y: 0, z: 0 },
    castShadow: false,
    receiveShadow: false,
    clone: jest.fn(() => createMockMesh())
  });

  return {
    Group: jest.fn(() => ({
      position: { copy: jest.fn(), set: jest.fn(), x: 0, y: 0, z: 0 },
      scale: { setScalar: jest.fn() },
      rotation: { copy: jest.fn(), set: jest.fn(), x: 0, y: 0, z: 0 },
      add: jest.fn()
    })),
    Mesh: jest.fn(() => createMockMesh()),
    MeshStandardMaterial: jest.fn(() => ({
      type: 'MeshStandardMaterial',
      dispose: jest.fn()
    })),
    Vector3: jest.fn((x = 0, y = 0, z = 0) => ({
      x, y, z,
      copy: jest.fn(),
      set: jest.fn()
    })),
    CylinderGeometry: jest.fn(() => ({ type: 'CylinderGeometry' })),
    BoxGeometry: jest.fn(() => ({ type: 'BoxGeometry' })),
    SphereGeometry: jest.fn(() => ({ type: 'SphereGeometry' })),
    ConeGeometry: jest.fn(() => ({ type: 'ConeGeometry' })),
    OctahedronGeometry: jest.fn(() => ({ type: 'OctahedronGeometry' })),
    TorusGeometry: jest.fn(() => ({ type: 'TorusGeometry' })),
    CircleGeometry: jest.fn(() => ({ type: 'CircleGeometry' })),
    PlaneGeometry: jest.fn(() => ({ type: 'PlaneGeometry' })),
    DoubleSide: 2
  };
});

describe('HeroPropFactory', () => {
  let mockGroup;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGroup = {
      add: jest.fn(),
      children: []
    };
  });

  const PROP_TYPES = [
    'rocket_stand',
    'moon_rover',
    'satellite_dish',
    'asteroid_cluster',
    'wormhole_ring',
    'energy_collector',
    'lab_equipment',
    'black_hole_core',
    'station_reactor'
  ];

  describe('createHeroProp', () => {
    test.each(PROP_TYPES)('creates meshes for %s without throwing', (type) => {
      const config = {
        type,
        position: new THREE.Vector3(1, 0, 2),
        scale: 1.5
      };

      const meshes = createHeroProp(mockGroup, config);

      expect(meshes).toBeInstanceOf(Array);
      expect(meshes.length).toBeGreaterThan(0);
      expect(mockGroup.add).toHaveBeenCalledTimes(1);
    });

    test('applies position from config', () => {
      const position = new THREE.Vector3(5, 0, -3);
      const config = { type: 'rocket_stand', position };

      createHeroProp(mockGroup, config);

      const propGroup = mockGroup.add.mock.calls[0][0];
      expect(propGroup.position.copy).toHaveBeenCalledWith(position);
    });

    test('applies scale from config', () => {
      const config = { type: 'rocket_stand', scale: 2.5 };

      createHeroProp(mockGroup, config);

      const propGroup = mockGroup.add.mock.calls[0][0];
      expect(propGroup.scale.setScalar).toHaveBeenCalledWith(2.5);
    });

    test('applies rotation from config', () => {
      const rotation = { x: 0.5, y: 1.0, z: 0 };
      const config = { type: 'rocket_stand', rotation };

      createHeroProp(mockGroup, config);

      const propGroup = mockGroup.add.mock.calls[0][0];
      expect(propGroup.rotation.copy).toHaveBeenCalledWith(rotation);
    });

    test('does not apply rotation when not provided', () => {
      const config = { type: 'rocket_stand' };

      createHeroProp(mockGroup, config);

      const propGroup = mockGroup.add.mock.calls[0][0];
      expect(propGroup.rotation.copy).not.toHaveBeenCalled();
    });

    test('defaults to scale 1 when not provided', () => {
      const config = { type: 'rocket_stand' };

      createHeroProp(mockGroup, config);

      const propGroup = mockGroup.add.mock.calls[0][0];
      expect(propGroup.scale.setScalar).toHaveBeenCalledWith(1);
    });

    test('defaults position to (0,0,0) when not provided', () => {
      const config = { type: 'rocket_stand' };

      createHeroProp(mockGroup, config);

      const propGroup = mockGroup.add.mock.calls[0][0];
      expect(propGroup.position.copy).toHaveBeenCalled();
    });

    test('unknown type falls back to generic prop and logs warning', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const config = { type: 'unknown_type' };

      const meshes = createHeroProp(mockGroup, config);

      expect(meshes).toBeInstanceOf(Array);
      expect(meshes.length).toBeGreaterThan(0);
      expect(mockGroup.add).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown prop type "unknown_type"')
      );
      warnSpy.mockRestore();
    });

    test('props are purely visual — no CANNON bodies created', () => {
      for (const type of PROP_TYPES) {
        jest.clearAllMocks();
        const config = { type };
        const meshes = createHeroProp(mockGroup, config);

        meshes.forEach(mesh => {
          expect(mesh).toBeDefined();
          expect(mesh).toHaveProperty('position');
        });
      }
    });
  });

  describe('individual prop types', () => {
    test('rocket_stand creates base, body, nose, and engine', () => {
      const meshes = createHeroProp(mockGroup, { type: 'rocket_stand' });
      expect(meshes.length).toBe(4);
    });

    test('moon_rover creates body, 4 wheels, and antenna', () => {
      const meshes = createHeroProp(mockGroup, { type: 'moon_rover' });
      expect(meshes.length).toBe(6);
    });

    test('satellite_dish creates pole and dish', () => {
      const meshes = createHeroProp(mockGroup, { type: 'satellite_dish' });
      expect(meshes.length).toBe(2);
    });

    test('asteroid_cluster creates 4 asteroids', () => {
      const meshes = createHeroProp(mockGroup, { type: 'asteroid_cluster' });
      expect(meshes.length).toBe(4);
    });

    test('wormhole_ring creates ring and inner disc', () => {
      const meshes = createHeroProp(mockGroup, { type: 'wormhole_ring' });
      expect(meshes.length).toBe(2);
    });

    test('energy_collector creates tower and 3 panels', () => {
      const meshes = createHeroProp(mockGroup, { type: 'energy_collector' });
      expect(meshes.length).toBe(4);
    });

    test('lab_equipment creates console, screen, and drone', () => {
      const meshes = createHeroProp(mockGroup, { type: 'lab_equipment' });
      expect(meshes.length).toBe(3);
    });

    test('black_hole_core creates core and accretion disc', () => {
      const meshes = createHeroProp(mockGroup, { type: 'black_hole_core' });
      expect(meshes.length).toBe(2);
    });

    test('station_reactor creates core, 2 rings, and glow', () => {
      const meshes = createHeroProp(mockGroup, { type: 'station_reactor' });
      expect(meshes.length).toBe(4);
    });

    test('generic fallback creates single cylinder', () => {
      const meshes = createHeroProp(mockGroup, { type: 'nonexistent' });
      expect(meshes.length).toBe(1);
    });
  });
});
