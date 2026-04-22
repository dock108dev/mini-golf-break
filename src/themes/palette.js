/**
 * Shared material palette for visual cohesion across all holes.
 * Centralizes material definitions so HoleEntity, GreenSurfaceBuilder,
 * and HazardFactory all draw from the same source of truth.
 */

/**
 * Three-tier hazard color system.
 * - danger: punishes ball (timed_hazard, laser_grid, disappearing_platform) — red, pulsing 1.5 Hz
 * - blocker: redirects ball (bank_wall, ricochet_bumpers, moving_sweeper) — gray-blue, static
 * - reward: helps ball toward cup (boost_strip, suction_zone) — green-gold, pulsing 0.5 Hz
 */
export const HAZARD_COLORS = {
  danger: 0xff2200,
  blocker: 0x4466aa,
  reward: 0xaaff44
};

export const MATERIAL_PALETTE = {
  floor: {
    color: 0x0d1117,
    roughness: 0.9,
    metalness: 0.1,
    emissive: 0x0a0a14,
    emissiveIntensity: 0.05
  },
  wall: {
    color: 0x3a4050,
    roughness: 0.6,
    metalness: 0.4,
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
    color: 0x00ffcc,
    roughness: 0.3,
    metalness: 0.8,
    emissive: 0x00ffcc,
    emissiveIntensity: 1.2
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
