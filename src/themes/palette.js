/**
 * Shared material palette for visual cohesion across all holes.
 * Centralizes material definitions so HoleEntity, GreenSurfaceBuilder,
 * and HazardFactory all draw from the same source of truth.
 */

export const MATERIAL_PALETTE = {
  floor: {
    color: 0x1a3a2a,
    roughness: 0.7,
    metalness: 0.2,
    emissive: 0x0a1a0a,
    emissiveIntensity: 0.1
  },
  wall: {
    color: 0x3a3a5a,
    roughness: 0.3,
    metalness: 0.7,
    emissive: 0x111133,
    emissiveIntensity: 0.05
  },
  hazard: {
    sand: {
      color: 0xc4a35a,
      roughness: 0.9,
      metalness: 0.1,
      emissive: 0xff6600,
      emissiveIntensity: 0.15
    },
    water: {
      color: 0x2266cc,
      roughness: 0.2,
      metalness: 0.1,
      opacity: 0.8,
      emissive: 0xff3300,
      emissiveIntensity: 0.2
    }
  },
  decoration: {
    roughness: 0.5,
    metalness: 0.4,
    emissive: 0x000000,
    emissiveIntensity: 0
  },
  rim: {
    color: 0xaaaacc,
    roughness: 0.3,
    metalness: 0.8
  },
  tee: {
    color: 0x00aaff,
    roughness: 0.3,
    metalness: 0.5
  },
  holeInterior: {
    color: 0x0a0a1a,
    roughness: 0.9,
    metalness: 0.1
  },
  bumper: {
    color: 0xff6600,
    roughness: 0.4,
    metalness: 0.5
  },
  neonTrim: {
    color: 0x00ffcc,
    emissive: 0x00ffcc,
    emissiveIntensity: 0.8,
    lineWidth: 2
  },
  background: {
    planet: {
      roughness: 0.7,
      metalness: 0.2,
      emissive: 0x000000,
      emissiveIntensity: 0
    },
    nebula: {
      opacity: 0.12,
      emissive: 0x000000,
      emissiveIntensity: 0
    },
    debris: {
      roughness: 0.6,
      metalness: 0.3,
      emissive: 0x000000,
      emissiveIntensity: 0
    }
  }
};
