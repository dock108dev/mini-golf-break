import { MATERIAL_PALETTE } from './palette';

const BACK_NINE_START = 9;

export function isBackNine(holeIndex) {
  return holeIndex >= BACK_NINE_START;
}

export const STATION_SIDE = {
  name: 'Station Side',
  green: {
    ...MATERIAL_PALETTE.floor,
    color: 0x2a3a3a,
    metalness: 0.3
  },
  wall: {
    ...MATERIAL_PALETTE.wall,
    color: 0x3a3a5a,
    emissive: 0x332200,
    emissiveIntensity: 0.08
  },
  bumper: { ...MATERIAL_PALETTE.bumper },
  sand: {
    color: MATERIAL_PALETTE.hazard.sand.color,
    roughness: MATERIAL_PALETTE.hazard.sand.roughness,
    metalness: MATERIAL_PALETTE.hazard.sand.metalness,
    emissive: 0xff6600,
    emissiveIntensity: 0.15
  },
  water: {
    color: MATERIAL_PALETTE.hazard.water.color,
    roughness: MATERIAL_PALETTE.hazard.water.roughness,
    metalness: MATERIAL_PALETTE.hazard.water.metalness,
    opacity: MATERIAL_PALETTE.hazard.water.opacity,
    emissive: 0xff3300,
    emissiveIntensity: 0.2
  },
  tee: { ...MATERIAL_PALETTE.tee },
  rim: { ...MATERIAL_PALETTE.rim },
  holeInterior: { ...MATERIAL_PALETTE.holeInterior },
  neonTrim: {
    ...MATERIAL_PALETTE.neonTrim,
    color: 0xffaa44,
    emissive: 0xffaa44
  },
  background: 0x000008,
  lighting: {
    ambientColor: 0xfff5e6,
    ambientIntensity: 0.6,
    keyLightColor: 0xffeecc
  },
  nebula: {
    color1: 0x332266,
    color2: 0x662233
  },
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

export const DEEP_VOID = {
  name: 'Deep Void',
  green: {
    ...MATERIAL_PALETTE.floor,
    color: 0x0a0a12,
    roughness: 0.5,
    metalness: 0.4,
    emissive: 0x050508,
    emissiveIntensity: 0.05
  },
  wall: {
    ...MATERIAL_PALETTE.wall,
    color: 0x1a1a3a,
    emissive: 0x002244,
    emissiveIntensity: 0.1
  },
  bumper: {
    ...MATERIAL_PALETTE.bumper,
    color: 0x0088cc
  },
  sand: {
    color: 0x8a6a3a,
    roughness: MATERIAL_PALETTE.hazard.sand.roughness,
    metalness: MATERIAL_PALETTE.hazard.sand.metalness,
    emissive: 0x6622aa,
    emissiveIntensity: 0.2
  },
  water: {
    color: MATERIAL_PALETTE.hazard.water.color,
    roughness: MATERIAL_PALETTE.hazard.water.roughness,
    metalness: MATERIAL_PALETTE.hazard.water.metalness,
    opacity: MATERIAL_PALETTE.hazard.water.opacity,
    emissive: 0x660022,
    emissiveIntensity: 0.25
  },
  tee: {
    ...MATERIAL_PALETTE.tee,
    color: 0x0066dd
  },
  rim: {
    ...MATERIAL_PALETTE.rim,
    color: 0x8888cc
  },
  holeInterior: { ...MATERIAL_PALETTE.holeInterior },
  neonTrim: {
    ...MATERIAL_PALETTE.neonTrim,
    color: 0x00ccff,
    emissive: 0x00ccff
  },
  background: 0x000004,
  lighting: {
    ambientColor: 0xccddff,
    ambientIntensity: 0.4,
    keyLightColor: 0xaaccff
  },
  nebula: {
    color1: 0x112244,
    color2: 0x0a1a33
  },
  mechanics: {
    boostStrip: { color: 0x00ccff },
    movingSweeper: { color: 0xff2222, postColor: 0x444466 },
    portalGate: { color: 0x6600cc },
    timedGate: { color: 0x224488 },
    timedHazard: { waterColor: 0xcc0022, sandColor: 0xaa6600 },
    bankWall: { color: 0x3344aa },
    suctionZone: { color: 0x5500bb },
    lowGravityZone: { color: 0x2266cc },
    bowlContour: { color: 0x554422 },
    elevatedGreen: { color: 0x0a1a12, sideColor: 0x060f0a },
    splitRoute: { color: 0x4444aa },
    ricochetBumpers: { color: 0x0088ff },
    laserGrid: { color: 0xff0044 },
    disappearingPlatform: { color: 0x3366aa },
    gravityFunnel: { color: 0x7700cc },
    multiLevelRamp: { color: 0x2244aa }
  }
};

export function getThemeForHole(holeIndex) {
  return isBackNine(holeIndex) ? DEEP_VOID : STATION_SIDE;
}
