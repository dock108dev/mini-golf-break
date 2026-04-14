/**
 * Space theme for the Orbital Drift course.
 * Darker, more metallic aesthetic with emissive accents.
 * Material values are aligned with MATERIAL_PALETTE for visual cohesion.
 */
import { MATERIAL_PALETTE } from './palette';

export const spaceTheme = {
  name: 'Orbital Drift',
  green: { ...MATERIAL_PALETTE.floor },
  wall: { ...MATERIAL_PALETTE.wall },
  bumper: { ...MATERIAL_PALETTE.bumper },
  sand: {
    color: MATERIAL_PALETTE.hazard.sand.color,
    roughness: MATERIAL_PALETTE.hazard.sand.roughness,
    metalness: MATERIAL_PALETTE.hazard.sand.metalness,
    emissive: MATERIAL_PALETTE.hazard.sand.emissive,
    emissiveIntensity: MATERIAL_PALETTE.hazard.sand.emissiveIntensity
  },
  water: {
    color: MATERIAL_PALETTE.hazard.water.color,
    opacity: MATERIAL_PALETTE.hazard.water.opacity,
    roughness: MATERIAL_PALETTE.hazard.water.roughness,
    emissive: MATERIAL_PALETTE.hazard.water.emissive,
    emissiveIntensity: MATERIAL_PALETTE.hazard.water.emissiveIntensity
  },
  tee: { ...MATERIAL_PALETTE.tee },
  rim: { ...MATERIAL_PALETTE.rim },
  holeInterior: { ...MATERIAL_PALETTE.holeInterior },
  neonTrim: { ...MATERIAL_PALETTE.neonTrim },
  background: 0x000008,
  mechanics: {
    boostStrip: { color: 0x00ff88 },
    movingSweeper: { color: 0xff2222, postColor: 0x666688 },
    portalGate: { color: 0xaa00ff },
    timedGate: { color: 0x3366aa },
    timedHazard: { waterColor: 0xff3300, sandColor: 0xdd8800 },
    bankWall: { color: 0x5555aa },
    suctionZone: { color: 0x7700dd },
    lowGravityZone: { color: 0x3388ff },
    bowlContour: { color: 0x776633 },
    elevatedGreen: { color: 0x1a3a2a, sideColor: 0x0d2d1d },
    splitRoute: { color: 0x6666aa },
    ricochetBumpers: { color: 0xff5500 },
    laserGrid: { color: 0xff2222 }
  }
};
