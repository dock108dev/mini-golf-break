import { STATION_SIDE, DEEP_VOID } from '../themes/themeVariants';

/**
 * Orbital Drift - 18-hole space-themed course with advanced mechanics.
 * Total par: 57 (front nine: 24, back nine: 33)
 *
 * All coordinates are plain arrays: [x, y, z] for 3D positions, [x, y] for 2D boundary points.
 * Use hydrateHoleConfig() to convert to Three.js Vector3/Vector2/Euler before passing to HoleEntity.
 */
export function createOrbitalDriftConfigs() {
  return [
    // H1: Docking Lane (par 2) — tutorial opener with moving_sweeper
    {
      index: 0,
      description: '1. Docking Lane',
      par: 2,
      theme: STATION_SIDE,
      boundaryShape: [
        [-2, -6],
        [-2, 6],
        [2, 6],
        [2, -6],
        [-2, -6]
      ],
      startPosition: [0, 0, 5],
      holePosition: [0, 0, -5],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'moving_sweeper',
          pivot: [0, 0, 0],
          armLength: 3,
          speed: 0.7,
          size: { width: 3, height: 0.4, depth: 0.3 }
        }
      ],
      outOfBounds: { minX: -7, maxX: 7, minZ: -11, maxZ: 11, minY: -10 },
      heroProps: [
        { type: 'docking_clamp', position: [-3, 0, 5], scale: 1.2 },
        { type: 'docking_clamp', position: [3, 0, 5], scale: 1.2 }
      ]
    },
    // H2: Crater Rim (par 2) — bowl_contour speed-control teacher
    {
      index: 1,
      description: '2. Crater Rim',
      par: 2,
      theme: STATION_SIDE,
      boundaryShape: [
        [-7, -7],
        [-7, 7],
        [7, 7],
        [7, -7],
        [-7, -7]
      ],
      startPosition: [0, 0, 6],
      holePosition: [0, 0, 0],
      hazards: [],
      bumpers: [],
      mechanics: [{ type: 'bowl_contour', position: [0, 0, 0], radius: 6, force: 3.0 }],
      outOfBounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12, minY: -10 },
      heroProps: [
        { type: 'asteroid_cluster', position: [-7, 0, 0], scale: 1.8 },
        { type: 'asteroid_cluster', position: [7, 0, 0], scale: 1.6 },
        { type: 'asteroid_cluster', position: [0, 0, -7], scale: 1.5 },
        { type: 'asteroid_cluster', position: [0, 0, 7], scale: 1.4 }
      ]
    },
    // H3: Satellite Slingshot (par 3) — split_route risk/reward with moving_sweeper
    {
      index: 2,
      description: '3. Satellite Slingshot',
      par: 3,
      theme: STATION_SIDE,
      boundaryShape: [
        [-5, -9],
        [-7, -3],
        [-7, 5],
        [-5, 9],
        [5, 9],
        [5, -9],
        [-5, -9]
      ],
      startPosition: [0, 0, 8],
      holePosition: [0, 0, -8],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'split_route',
          walls: [{ start: [0, 0, 5], end: [0, 0, -3] }],
          height: 0.8
        },
        {
          type: 'moving_sweeper',
          pivot: [2.5, 0, 1],
          armLength: 2,
          speed: 1.0,
          size: { width: 2, height: 0.4, depth: 0.3 },
          phase: 0
        }
      ],
      outOfBounds: { minX: -12, maxX: 10, minZ: -14, maxZ: 14, minY: -10 },
      heroProps: [{ type: 'satellite_dish', position: [0, 0, 6], scale: 1.5 }]
    },
    // H4: Asteroid Belt Bounce (par 3) — ricochet_bumpers + elevated_green
    {
      index: 3,
      description: '4. Asteroid Belt Bounce',
      par: 3,
      theme: STATION_SIDE,
      boundaryShape: [
        [-9, -5],
        [-9, 5],
        [9, 5],
        [9, -5],
        [-9, -5]
      ],
      startPosition: [0, 0, 4],
      holePosition: [0, 0.5, -3.5],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'ricochet_bumpers',
          bumpers: [
            { position: [-3, 0, 2.5], geometry: 'cylinder', radius: 0.5 },
            { position: [3, 0, 2.5], geometry: 'cylinder', radius: 0.5 },
            { position: [0, 0, 1], geometry: 'cylinder', radius: 0.6 },
            { position: [-2, 0, -0.5], geometry: 'sphere', radius: 0.4 },
            { position: [2, 0, -0.5], geometry: 'sphere', radius: 0.4 }
          ]
        },
        {
          type: 'elevated_green',
          platform: { position: [0, 0, -3.5], width: 6, length: 3 },
          elevation: 0.5,
          ramp: { start: [0, 0, -1], end: [0, 0, -2], width: 2.5 }
        }
      ],
      outOfBounds: { minX: -14, maxX: 14, minZ: -10, maxZ: 10, minY: -10 },
      heroProps: [
        { type: 'asteroid_cluster', position: [-7, 0, 0], scale: 2 },
        { type: 'asteroid_cluster', position: [7, 0, 2], scale: 1.5 }
      ]
    },
    // H5: Wormhole Transfer (par 2) — portal_gate introduction, L-shape blocks direct path
    {
      index: 4,
      description: '5. Wormhole Transfer',
      par: 2,
      theme: STATION_SIDE,
      boundaryShape: [
        [-3, -7],
        [-3, 1],
        [-7, 1],
        [-7, 7],
        [3, 7],
        [3, -7],
        [-3, -7]
      ],
      startPosition: [0, 0, -5],
      holePosition: [-5, 0, 5],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'portal_gate',
          entryPosition: [0, 0, -1],
          exitPosition: [-5, 0, 3],
          radius: 0.7
        }
      ],
      outOfBounds: { minX: -12, maxX: 8, minZ: -12, maxZ: 12, minY: -10 },
      heroProps: [
        { type: 'wormhole_ring', position: [0, 0, -1], scale: 1.0 },
        { type: 'wormhole_ring', position: [-5, 0, 3], scale: 1.0 }
      ]
    },
    // H6: Solar Flare Run (par 3) — timed_hazard ×3 staggered
    {
      index: 5,
      description: '6. Solar Flare Run',
      par: 3,
      theme: STATION_SIDE,
      boundaryShape: [
        [-2, -10],
        [-2, 10],
        [2, 10],
        [2, -10],
        [-2, -10]
      ],
      startPosition: [0, 0, 8],
      holePosition: [0, 0, -8],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'timed_hazard',
          position: [0, 0, 4],
          size: { width: 3.5, length: 1.5 },
          onDuration: 1.5,
          offDuration: 3.0,
          hazardType: 'water',
          phase: 0
        },
        {
          type: 'timed_hazard',
          position: [0, 0, 0],
          size: { width: 3.5, length: 1.5 },
          onDuration: 1.5,
          offDuration: 3.0,
          hazardType: 'water',
          phase: 0.75
        },
        {
          type: 'timed_hazard',
          position: [0, 0, -4],
          size: { width: 3.5, length: 1.5 },
          onDuration: 1.5,
          offDuration: 3.0,
          hazardType: 'water',
          phase: 1.5
        }
      ],
      outOfBounds: { minX: -7, maxX: 7, minZ: -15, maxZ: 15, minY: -10 },
      heroProps: [{ type: 'energy_collector', position: [-4, 0, 0], scale: 1.5 }]
    },
    // H7: Zero G Lab (par 2) — low_gravity_zone + bank_wall
    // Reduced-gravity zone in mid-fairway alters ball arc/deceleration.
    // Angled bank walls enable intentional rebounds toward cup.
    {
      index: 6,
      description: '7. Zero G Lab',
      par: 2,
      theme: STATION_SIDE,
      boundaryShape: [
        [-4, -7],
        [-4, 7],
        [4, 7],
        [4, -7],
        [-4, -7]
      ],
      startPosition: [0, 0, 6],
      holePosition: [0, 0, -6],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'low_gravity_zone',
          position: [0, 0, 0],
          radius: 3.5,
          gravityMultiplier: 0.2
        },
        {
          type: 'bank_wall',
          segments: [
            { start: [-3.8, 0, 2], end: [-3, 0, -2] },
            { start: [3.8, 0, 2], end: [3, 0, -2] }
          ],
          restitution: 0.85
        }
      ],
      outOfBounds: { minX: -9, maxX: 9, minZ: -12, maxZ: 12, minY: -10 },
      heroProps: [
        { type: 'gravity_vortex', position: [0, 0.5, 0], scale: 0.7 },
        { type: 'gravity_vortex', position: [-1.5, 0.3, 1], scale: 0.4 },
        { type: 'gravity_vortex', position: [1.5, 0.3, -1], scale: 0.4 },
        { type: 'lab_equipment', position: [-5, 0, -4], scale: 1.0 },
        { type: 'lab_equipment', position: [5, 0, 4], scale: 1.0 },
        { type: 'energy_collector', position: [-5, 0, 4], scale: 1.2 }
      ]
    },
    // H8: Event Horizon (par 3) — suction_zone + timed_gate
    {
      index: 7,
      description: '8. Event Horizon',
      par: 3,
      theme: STATION_SIDE,
      boundaryShape: [
        [-8, -8],
        [-8, 8],
        [8, 8],
        [8, -8],
        [-8, -8]
      ],
      startPosition: [-5, 0, 5],
      holePosition: [5, 0, -5],
      hazards: [],
      bumpers: [],
      mechanics: [
        { type: 'suction_zone', position: [0, 0, 0], radius: 4, force: 5 },
        {
          type: 'timed_gate',
          position: [3, 0, -3],
          size: { width: 2, height: 0.8, depth: 0.2 },
          openDuration: 2.5,
          closedDuration: 3
        }
      ],
      outOfBounds: { minX: -13, maxX: 13, minZ: -13, maxZ: 13, minY: -10 },
      heroProps: [{ type: 'black_hole_core', position: [0, 0, 0], scale: 1.5 }]
    },
    // H9: Station Core Finale (par 4) — split_route + moving_sweeper + boost_strip + elevated_green
    // Multi-stage synthesis: fork → sweeper on direct branch → boost → elevated green
    // Direct route: 3 strokes (thread sweeper). Safe route: 4 strokes (arc left).
    {
      index: 8,
      description: '9. Station Core Finale',
      par: 4,
      theme: STATION_SIDE,
      boundaryShape: [
        [-5, -11],
        [-5, 11],
        [5, 11],
        [5, -11],
        [-5, -11]
      ],
      startPosition: [0, 0, 10],
      holePosition: [0, 0.5, -9],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'split_route',
          walls: [{ start: [0, 0, 9], end: [0, 0, 2] }],
          height: 0.8
        },
        {
          type: 'moving_sweeper',
          pivot: [2.5, 0, 5.5],
          armLength: 2,
          speed: 1.2,
          size: { width: 2, height: 0.4, depth: 0.3 }
        },
        {
          type: 'boost_strip',
          position: [0, 0, -2],
          direction: [0, 0, -1],
          force: 12,
          size: { width: 2, length: 3 }
        },
        {
          type: 'elevated_green',
          platform: { position: [0, 0, -9], width: 5, length: 4 },
          elevation: 0.5,
          ramp: { start: [0, 0, -6], end: [0, 0, -7.5], width: 3 }
        }
      ],
      outOfBounds: { minX: -10, maxX: 10, minZ: -16, maxZ: 16, minY: -10 },
      heroProps: [{ type: 'station_reactor', position: [0, 0, 0], scale: 1.8 }]
    },
    // H10: Laser Grid (par 3) — back-nine opener, timed laser beam threading
    // Straight narrow corridor with 2 staggered laser beams on alternating timers.
    // Time your shot through the gaps to reach the cup.
    {
      index: 9,
      description: '10. Laser Grid',
      par: 3,
      theme: {
        ...DEEP_VOID,
        wall: {
          ...DEEP_VOID.wall,
          color: 0x5a5a7a,
          metalness: 0.8,
          emissive: 0x221133,
          emissiveIntensity: 0.1
        },
        green: {
          ...DEEP_VOID.green,
          emissive: 0x0a0a1a,
          emissiveIntensity: 0.15
        }
      },
      boundaryShape: [
        [-2, -9],
        [-2, 9],
        [2, 9],
        [2, -9],
        [-2, -9]
      ],
      startPosition: [0, 0.5, 8],
      holePosition: [0, 0, -8],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'laser_grid',
          beams: [{ start: [-2, 0.3, -3], end: [2, 0.3, -3] }],
          onDuration: 1.2,
          offDuration: 1.0,
          offset: 0,
          color: 0xff2222
        },
        {
          type: 'laser_grid',
          beams: [{ start: [-2, 0.3, -6], end: [2, 0.3, -6] }],
          onDuration: 1.2,
          offDuration: 1.0,
          offset: 0.5,
          color: 0xff2222
        }
      ],
      outOfBounds: { minX: -7, maxX: 7, minZ: -14, maxZ: 14, minY: -10 },
      heroProps: [
        { type: 'laser_emitter', position: [-2.5, 0, -3], scale: 0.8 },
        { type: 'laser_emitter', position: [2.5, 0, -3], scale: 0.8 },
        { type: 'laser_emitter', position: [-2.5, 0, -6], scale: 0.8 },
        { type: 'laser_emitter', position: [2.5, 0, -6], scale: 0.8 }
      ]
    },
    // H11: Blackout Corridor (par 3) — disappearing_platform + bank_wall timing hole
    // S-curve corridor with two disappearing platforms on offset cycles.
    // Time your shots to cross while platforms are solid. Bank walls guide the S-curve bends.
    {
      index: 10,
      description: '11. Blackout Corridor',
      par: 3,
      theme: {
        ...DEEP_VOID,
        green: {
          ...DEEP_VOID.green,
          emissive: 0x050510,
          emissiveIntensity: 0.1
        },
        wall: {
          ...DEEP_VOID.wall,
          color: 0x1a1a3a,
          metalness: 0.8,
          emissive: 0x0a0a22,
          emissiveIntensity: 0.15
        }
      },
      boundaryShape: [
        // S-curve: corridor shifts right (x+1.5) between z=3..z=-3, then back
        [-2, 11],
        [-2, 3],
        [-0.5, 0],
        [-0.5, -3],
        [-2, -6],
        [-2, -11],
        [2, -11],
        [2, -6],
        [3.5, -3],
        [3.5, 0],
        [2, 3],
        [2, 11],
        [-2, 11]
      ],
      startPosition: [0, 0.5, 9],
      holePosition: [0, 0, -9],
      hazards: [],
      bumpers: [],
      mechanics: [
        // Platform 1: ~8u from spawn (z = 9 - 8 = 1)
        {
          type: 'disappearing_platform',
          platforms: [
            {
              position: [1, 0, 1],
              size: { width: 4, height: 0.15, depth: 2.5 },
              onDuration: 1.5,
              offDuration: 1.0,
              offset: 0
            }
          ]
        },
        // Platform 2: ~14u from spawn (z = 9 - 14 = -5)
        {
          type: 'disappearing_platform',
          platforms: [
            {
              position: [1, 0, -5],
              size: { width: 4, height: 0.15, depth: 2.5 },
              onDuration: 1.5,
              offDuration: 1.0,
              offset: 0.3
            }
          ]
        },
        // Bank wall at upper S-bend (z ~ 3, guiding ball into rightward curve)
        {
          type: 'bank_wall',
          segments: [{ start: [-1, 0, 4], end: [1, 0, 1] }],
          height: 0.6,
          restitution: 0.85
        },
        // Bank wall at lower S-bend (z ~ -4, guiding ball back leftward)
        {
          type: 'bank_wall',
          segments: [{ start: [3, 0, -3], end: [1, 0, -6] }],
          height: 0.6,
          restitution: 0.85
        }
      ],
      outOfBounds: { minX: -7, maxX: 8, minZ: -16, maxZ: 16, minY: -10 },
      heroProps: [
        { type: 'energy_collector', position: [-3.5, 0, 2], scale: 0.9 },
        { type: 'energy_collector', position: [5, 0, -4], scale: 0.9 }
      ]
    },
    // H12: Gravity Well (par 4) — signature terrain hole with central gravity funnel
    // Wide near-circular arena with a large gravity funnel at center.
    // Route A (risky): Use funnel curve to arc toward cup in 2–3 shots.
    // Route B (safe): Wide arc along perimeter walls, 3–4 shots.
    {
      index: 11,
      description: '12. Gravity Well',
      par: 4,
      theme: {
        ...DEEP_VOID,
        green: {
          ...DEEP_VOID.green,
          emissive: 0x081020,
          emissiveIntensity: 0.15
        }
      },
      boundaryShape: [
        [11, -10],
        [8, -2],
        [0, 1],
        [-8, -2],
        [-11, -10],
        [-8, -18],
        [0, -21],
        [8, -18],
        [11, -10]
      ],
      startPosition: [0, 0, 0],
      holePosition: [7, 0, -17],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'gravity_funnel',
          position: [0, 0, -10],
          radius: 6,
          force: 5.0,
          exitPoint: [7, 0, -17],
          color: 0x4488ff
        }
      ],
      outOfBounds: { minX: -16, maxX: 16, minZ: -26, maxZ: 6, minY: -10 },
      heroProps: [
        { type: 'gravity_vortex', position: [0, 0, -10], scale: 1.5 },
        { type: 'asteroid_cluster', position: [-10, 0, -3], scale: 1.8 },
        { type: 'asteroid_cluster', position: [10, 0, -17], scale: 1.6 }
      ]
    },
    // H13: Debris Field (par 4) — dense ricochet_bumpers + timed_hazard
    // Controlled chaos: asymmetric asteroid bumper field with staggered timed danger zones near cup.
    {
      index: 12,
      description: '13. Debris Field',
      par: 4,
      theme: {
        ...DEEP_VOID,
        green: {
          ...DEEP_VOID.green,
          emissive: 0x0a0810,
          emissiveIntensity: 0.15
        }
      },
      boundaryShape: [
        [-11, -8],
        [-11, 8],
        [11, 8],
        [11, -8],
        [-11, -8]
      ],
      startPosition: [0, 0, 7],
      holePosition: [1, 0, -7],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'ricochet_bumpers',
          bumpers: [
            { position: [-4, 0, 4], geometry: 'cylinder', radius: 0.6 },
            { position: [3, 0, 3], geometry: 'cylinder', radius: 0.5 },
            { position: [-1, 0, 1], geometry: 'sphere', radius: 0.45 },
            { position: [5, 0, 0], geometry: 'cylinder', radius: 0.55 },
            { position: [-6, 0, -1], geometry: 'sphere', radius: 0.4 },
            { position: [2, 0, -2], geometry: 'cylinder', radius: 0.65 },
            { position: [-3, 0, -4], geometry: 'cylinder', radius: 0.5 },
            { position: [0, 0, -3], geometry: 'sphere', radius: 0.45 }
          ]
        },
        {
          type: 'timed_hazard',
          position: [-2, 0, -5.5],
          size: { width: 3, length: 2 },
          onDuration: 1.8,
          offDuration: 1.2,
          hazardType: 'water',
          phase: 0
        },
        {
          type: 'timed_hazard',
          position: [3, 0, -6],
          size: { width: 2.5, length: 2 },
          onDuration: 1.8,
          offDuration: 1.2,
          hazardType: 'water',
          phase: 0.9
        }
      ],
      outOfBounds: { minX: -16, maxX: 16, minZ: -13, maxZ: 13, minY: -10 },
      heroProps: [
        { type: 'asteroid_cluster', position: [-12, 0, 3], scale: 2.0 },
        { type: 'asteroid_cluster', position: [12, 0, -2], scale: 1.8 },
        { type: 'asteroid_cluster', position: [-12, 0, -5], scale: 1.5 }
      ]
    },
    // H14: Reactor Bypass (par 3) — timed_hazard + boost_strip risk/reward
    // Reactor core hazard blocks main corridor. Bank around it (safe, 2–3 shots) or
    // thread the narrow side passage with boost strip (risky, 1-shot if timed right).
    {
      index: 13,
      description: '14. Reactor Bypass',
      par: 3,
      theme: {
        ...DEEP_VOID,
        green: {
          ...DEEP_VOID.green,
          emissive: 0x180808,
          emissiveIntensity: 0.2
        },
        wall: {
          ...DEEP_VOID.wall,
          color: 0x7a4a3a,
          metalness: 0.8,
          emissive: 0x220808,
          emissiveIntensity: 0.15
        }
      },
      boundaryShape: [
        [-4, -9],
        [-4, 8.5],
        [3, 8.5],
        [3, 5],
        [6, 5],
        [6, -1],
        [3, -1],
        [3, -9],
        [-4, -9]
      ],
      startPosition: [0, 0, 7],
      holePosition: [0, 0, -7],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'timed_hazard',
          position: [0, 0, 2],
          size: { width: 6, length: 4 },
          onDuration: 2.0,
          offDuration: 1.0,
          hazardType: 'water',
          phase: 0
        },
        {
          type: 'boost_strip',
          position: [4.5, 0, 2],
          direction: [0, 0, -1],
          force: 14,
          size: { width: 2, length: 3 }
        }
      ],
      outOfBounds: { minX: -9, maxX: 11, minZ: -14, maxZ: 13, minY: -10 },
      heroProps: [
        { type: 'station_reactor', position: [0, 0, 2], scale: 1.8 },
        { type: 'energy_collector', position: [-6, 0, 2], scale: 1.2 },
        { type: 'energy_collector', position: [8, 0, 2], scale: 1.0 }
      ]
    },
    // H15: Wormhole Relay (par 4) — dual portal chain with timed gate
    // Three-chamber relay: Portal A→B (C1→C2), timed gate in C2, Portal C→D (C2→C3), cup in C3.
    // Stroke plan: (1) hit into Portal A, (2) time the gate in C2, (3) enter Portal C, (4) putt in C3.
    {
      index: 14,
      description: '15. Wormhole Relay',
      par: 4,
      theme: {
        ...DEEP_VOID,
        green: {
          ...DEEP_VOID.green,
          emissive: 0x0a0818,
          emissiveIntensity: 0.15
        },
        wall: {
          ...DEEP_VOID.wall,
          color: 0x6a5a7a,
          metalness: 0.7,
          emissive: 0x110822,
          emissiveIntensity: 0.1
        }
      },
      boundaryShape: [
        [-5, -15],
        [-5, 15],
        [5, 15],
        [5, -15],
        [-5, -15]
      ],
      startPosition: [0, 0, 13],
      holePosition: [0, 0, -13],
      hazards: [],
      bumpers: [],
      mechanics: [
        // Portal pair 1: Chamber 1 → Chamber 2
        {
          type: 'portal_gate',
          entryPosition: [0, 0, 7],
          exitPosition: [0, 0, 3],
          radius: 0.7
        },
        // Timed gate separating C2 zones — blocks path to Portal C entry
        {
          type: 'timed_gate',
          position: [0, 0, -1],
          size: { width: 10, height: 0.8, depth: 0.2 },
          openDuration: 1.5,
          closedDuration: 1.5
        },
        // Portal pair 2: Chamber 2 → Chamber 3
        {
          type: 'portal_gate',
          entryPosition: [0, 0, -4],
          exitPosition: [0, 0, -8],
          radius: 0.7
        }
      ],
      outOfBounds: { minX: -10, maxX: 10, minZ: -20, maxZ: 20, minY: -10 },
      heroProps: [
        // Chamber 1: Station interior, warm metal
        { type: 'docking_clamp', position: [-6, 0, 12], scale: 1.0 },
        { type: 'docking_clamp', position: [6, 0, 12], scale: 1.0 },
        // Wormhole rings at Portal A (entry) and Portal B (exit)
        { type: 'wormhole_ring', position: [0, 0, 7], scale: 1.0 },
        { type: 'wormhole_ring', position: [0, 0, 3], scale: 0.9 },
        // Chamber 2: Tunnel void, deep blue
        { type: 'energy_collector', position: [-6, 0, -1], scale: 1.0 },
        // Wormhole rings at Portal C (entry) and Portal D (exit)
        { type: 'wormhole_ring', position: [0, 0, -4], scale: 1.0 },
        { type: 'wormhole_ring', position: [0, 0, -8], scale: 0.9 },
        // Chamber 3: Open space, starfield visible
        { type: 'asteroid_cluster', position: [-6, 0, -11], scale: 1.5 },
        { type: 'asteroid_cluster', position: [6, 0, -11], scale: 1.3 }
      ]
    },
    // H16: Eclipse Steps (par 4) — multi_level_ramp tiers + timed_gate
    // Three ascending platforms connected by ramps. Must progress step by step.
    {
      index: 15,
      description: '16. Eclipse Steps',
      par: 4,
      theme: {
        ...DEEP_VOID,
        green: {
          ...DEEP_VOID.green,
          emissive: 0x080810,
          emissiveIntensity: 0.15
        }
      },
      boundaryShape: [
        [-5, -21],
        [-5, 2],
        [5, 2],
        [5, -21],
        [-5, -21]
      ],
      startPosition: [0, 0, 0],
      holePosition: [0, 4, -18],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'multi_level_ramp',
          startPosition: [0, 0, -1],
          endPosition: [0, 2, -5],
          width: 3
        },
        {
          type: 'multi_level_ramp',
          startPosition: [0, 2, -5],
          endPosition: [0, 2, -10],
          width: 8,
          sideWalls: false
        },
        {
          type: 'timed_gate',
          position: [0, 0, -10],
          size: { width: 6, height: 1.0, depth: 0.2 },
          openDuration: 1.5,
          closedDuration: 2.0,
          baseElevation: 2
        },
        {
          type: 'multi_level_ramp',
          startPosition: [0, 2, -11],
          endPosition: [0, 4, -15],
          width: 2.5
        },
        {
          type: 'multi_level_ramp',
          startPosition: [0, 4, -15],
          endPosition: [0, 4, -20],
          width: 6,
          sideWalls: false
        }
      ],
      outOfBounds: { minX: -10, maxX: 10, minZ: -25, maxZ: 6, minY: -10 },
      heroProps: [
        { type: 'asteroid_cluster', position: [-7, 0, -5], scale: 1.5 },
        { type: 'energy_collector', position: [7, 0, -14], scale: 1.2 }
      ]
    },
    // H17: Comet Run (par 3) — boost_strip + fast moving_sweeper speed hole
    // Long straight lane with two boost strips and two fast sweepers. One clean timed line.
    {
      index: 16,
      description: '17. Comet Run',
      par: 3,
      theme: {
        ...DEEP_VOID,
        green: {
          ...DEEP_VOID.green,
          emissive: 0x081018,
          emissiveIntensity: 0.15
        }
      },
      boundaryShape: [
        [-2, -12],
        [-2, 12],
        [2, 12],
        [2, -12],
        [-2, -12]
      ],
      startPosition: [0, 0, 11],
      holePosition: [0, 0, -11],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'moving_sweeper',
          pivot: [0, 0, 6],
          armLength: 2,
          speed: 2.0,
          size: { width: 2, height: 0.4, depth: 0.3 },
          phase: 0
        },
        {
          type: 'boost_strip',
          position: [0, 0, 3],
          direction: [0, 0, -1],
          force: 12,
          size: { width: 3.5, length: 3 },
          color: 0x00ddff
        },
        {
          type: 'moving_sweeper',
          pivot: [0, 0, -4],
          armLength: 2,
          speed: 2.0,
          size: { width: 2, height: 0.4, depth: 0.3 },
          phase: Math.PI / 2
        },
        {
          type: 'boost_strip',
          position: [0, 0, -7],
          direction: [0, 0, -1],
          force: 12,
          size: { width: 3.5, length: 3 },
          color: 0x00ddff
        }
      ],
      outOfBounds: { minX: -7, maxX: 7, minZ: -17, maxZ: 17, minY: -10 },
      heroProps: [
        { type: 'energy_collector', position: [-3, 0, 11], scale: 1.2 },
        { type: 'energy_collector', position: [3, 0, 3], scale: 0.8 },
        { type: 'energy_collector', position: [-3, 0, -7], scale: 0.8 }
      ]
    },
    // H18: Starforge Finale (par 5) — multi-stage epic course closer
    // Three stages: split_route fork → gravity_funnel corridor → elevated_green finish
    // Route A (right): boost_strip compensates for longer path
    // Route B (left): shorter, tighter, no boost
    {
      index: 17,
      description: '18. Starforge Finale',
      par: 5,
      theme: {
        ...DEEP_VOID,
        green: {
          ...DEEP_VOID.green,
          emissive: 0x100818,
          emissiveIntensity: 0.2
        },
        wall: {
          ...DEEP_VOID.wall,
          color: 0x7a5a3a,
          metalness: 0.9,
          emissive: 0x221108,
          emissiveIntensity: 0.15
        }
      },
      boundaryShape: [
        [-10, 4],
        [10, 4],
        [10, -6],
        [8, -8],
        [8, -18],
        [6, -20],
        [6, -28],
        [-6, -28],
        [-6, -20],
        [-8, -18],
        [-8, -8],
        [-10, -6],
        [-10, 4]
      ],
      startPosition: [0, 0, 2],
      holePosition: [0, 3, -26],
      hazards: [],
      bumpers: [],
      mechanics: [
        {
          type: 'split_route',
          walls: [{ start: [0, 0, -1], end: [0, 0, -6] }],
          height: 0.8
        },
        {
          type: 'boost_strip',
          position: [5, 0, -3],
          direction: [0, 0, -1],
          force: 12,
          size: { width: 3, length: 3 }
        },
        {
          type: 'gravity_funnel',
          position: [0, 0, -13],
          radius: 5,
          force: 4.0,
          exitPoint: [0, 0, -20],
          color: 0x4488ff
        },
        {
          type: 'elevated_green',
          platform: { position: [0, 0, -26], width: 8, length: 6 },
          elevation: 3,
          ramp: { start: [0, 0, -19], end: [0, 0, -24], width: 4 }
        }
      ],
      outOfBounds: { minX: -15, maxX: 15, minZ: -33, maxZ: 9, minY: -10 },
      cameraHint: {
        offset: [0, 35, -12],
        lookAt: [0, 0, -13]
      },
      heroProps: [
        { type: 'station_reactor', position: [0, 0, -26], scale: 2.0 },
        { type: 'asteroid_cluster', position: [-11, 0, -1], scale: 2.0 },
        { type: 'asteroid_cluster', position: [11, 0, -1], scale: 1.8 },
        { type: 'docking_clamp', position: [-3, 0, 3], scale: 1.0 },
        { type: 'docking_clamp', position: [3, 0, 3], scale: 1.0 },
        { type: 'energy_collector', position: [-9, 0, -13], scale: 1.5 },
        { type: 'energy_collector', position: [9, 0, -13], scale: 1.5 },
        { type: 'gravity_vortex', position: [0, 0, -13], scale: 1.5 }
      ]
    }
  ];
}
