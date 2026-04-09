/**
 * Default theme - matches the original hardcoded colors in the game.
 * Used as fallback when no theme is specified in hole configs.
 */
export const defaultTheme = {
  name: 'Default',
  green: { color: 0x2ecc71, roughness: 0.8, metalness: 0.1 },
  wall: { color: 0xa0522d, roughness: 0.7, metalness: 0.3 },
  bumper: { color: 0xff8c00, roughness: 0.7, metalness: 0.3 },
  sand: { color: 0xe6c388, roughness: 0.9, metalness: 0.1 },
  water: { color: 0x3399ff, opacity: 0.7, roughness: 0.2 },
  tee: { color: 0x0077cc, roughness: 0.5, metalness: 0.2 },
  rim: { color: 0xcccccc, roughness: 0.3, metalness: 0.9 },
  holeInterior: { color: 0x1a1a1a, roughness: 0.9, metalness: 0.1 },
  background: 0x000000,
  mechanics: {
    boostStrip: { color: 0x00ffaa },
    movingSweeper: { color: 0xff4444, postColor: 0x888888 },
    portalGate: { color: 0x8800ff },
    timedGate: { color: 0x4488cc },
    timedHazard: { waterColor: 0xff4400, sandColor: 0xffaa00 },
    bankWall: { color: 0x6666aa },
    suctionZone: { color: 0x6600cc },
    lowGravityZone: { color: 0x44aaff },
    bowlContour: { color: 0x887744 },
    elevatedGreen: { color: 0x2ecc71, sideColor: 0x1a8a4a },
    splitRoute: { color: 0x8888aa },
    ricochetBumpers: { color: 0xff6600 }
  }
};
