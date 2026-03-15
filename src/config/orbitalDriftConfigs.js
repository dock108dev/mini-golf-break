import * as THREE from 'three';

/**
 * Orbital Drift - 9-hole space-themed course with advanced mechanics.
 * Total par: 24
 */
export function createOrbitalDriftConfigs() {
  return [
    // H1: Launch Bay (par 2) — moving_sweeper
    {
      index: 0,
      description: '1. Launch Bay',
      par: 2,
      boundaryShape: [
        new THREE.Vector2(-4, -12), new THREE.Vector2(-4, 12),
        new THREE.Vector2(4, 12), new THREE.Vector2(4, -12),
        new THREE.Vector2(-4, -12)
      ],
      startPosition: new THREE.Vector3(0, 0, 10),
      holePosition: new THREE.Vector3(0, 0, -9),
      hazards: [],
      bumpers: [
        { position: new THREE.Vector3(-3.5, 0.25, 0), size: new THREE.Vector3(0.3, 0.5, 8), rotation: new THREE.Euler(0, 0, 0) },
        { position: new THREE.Vector3(3.5, 0.25, 0), size: new THREE.Vector3(0.3, 0.5, 8), rotation: new THREE.Euler(0, 0, 0) }
      ],
      mechanics: [
        { type: 'moving_sweeper', pivot: new THREE.Vector3(0, 0, 0), armLength: 4, speed: 1.2, size: { width: 4, height: 0.4, depth: 0.3 } }
      ],
      heroProps: [
        { type: 'rocket_stand', position: new THREE.Vector3(-6, 0, 8), scale: 1.5 }
      ]
    },
    // H2: Crater Rim (par 2) — bowl_contour
    {
      index: 1,
      description: '2. Crater Rim',
      par: 2,
      boundaryShape: [
        new THREE.Vector2(-8, -8), new THREE.Vector2(-8, 8),
        new THREE.Vector2(8, 8), new THREE.Vector2(8, -8),
        new THREE.Vector2(-8, -8)
      ],
      startPosition: new THREE.Vector3(-5, 0, 5),
      holePosition: new THREE.Vector3(4, 0, -4),
      hazards: [
        { type: 'sand', shape: 'circle', position: new THREE.Vector3(0, 0, 0), size: { radius: 3 }, depth: 0.1 }
      ],
      bumpers: [],
      mechanics: [
        { type: 'bowl_contour', position: new THREE.Vector3(0, 0, 0), radius: 6, force: 2.5 }
      ],
      heroProps: [
        { type: 'moon_rover', position: new THREE.Vector3(6, 0, 6), scale: 1.2 }
      ]
    },
    // H3: Satellite Slingshot (par 3) — split_route + moving_sweeper
    {
      index: 2,
      description: '3. Satellite Slingshot',
      par: 3,
      boundaryShape: [
        new THREE.Vector2(-6, -12), new THREE.Vector2(-6, 12),
        new THREE.Vector2(6, 12), new THREE.Vector2(6, -12),
        new THREE.Vector2(-6, -12)
      ],
      startPosition: new THREE.Vector3(0, 0, 10),
      holePosition: new THREE.Vector3(0, 0, -10),
      hazards: [],
      bumpers: [],
      mechanics: [
        { type: 'split_route', walls: [
          { start: new THREE.Vector3(0, 0, 6), end: new THREE.Vector3(0, 0, -2) }
        ], height: 0.8 },
        { type: 'moving_sweeper', pivot: new THREE.Vector3(3, 0, 2), armLength: 2.5, speed: -1.5, size: { width: 2.5, height: 0.4, depth: 0.3 }, phase: Math.PI / 4 }
      ],
      heroProps: [
        { type: 'satellite_dish', position: new THREE.Vector3(-7, 0, 0), scale: 1.5 }
      ]
    },
    // H4: Asteroid Belt Bounce (par 3) — ricochet_bumpers + elevated_green
    {
      index: 3,
      description: '4. Asteroid Belt Bounce',
      par: 3,
      boundaryShape: [
        new THREE.Vector2(-8, -10), new THREE.Vector2(-8, 10),
        new THREE.Vector2(8, 10), new THREE.Vector2(8, -10),
        new THREE.Vector2(-8, -10)
      ],
      startPosition: new THREE.Vector3(0, 0, 8),
      holePosition: new THREE.Vector3(0, 0.5, -7),
      hazards: [],
      bumpers: [],
      mechanics: [
        { type: 'ricochet_bumpers', bumpers: [
          { position: new THREE.Vector3(-2, 0, 2), geometry: 'cylinder', radius: 0.5 },
          { position: new THREE.Vector3(2, 0, 2), geometry: 'cylinder', radius: 0.5 },
          { position: new THREE.Vector3(0, 0, 0), geometry: 'cylinder', radius: 0.6 },
          { position: new THREE.Vector3(-3, 0, -3), geometry: 'sphere', radius: 0.4 },
          { position: new THREE.Vector3(3, 0, -3), geometry: 'sphere', radius: 0.4 }
        ] },
        { type: 'elevated_green',
          platform: { position: new THREE.Vector3(0, 0, -7), width: 5, length: 4 },
          elevation: 0.5,
          ramp: { start: new THREE.Vector3(5, 0, -6), end: new THREE.Vector3(3, 0, -7), width: 2 }
        }
      ],
      heroProps: [
        { type: 'asteroid_cluster', position: new THREE.Vector3(-7, 0, -5), scale: 2 },
        { type: 'asteroid_cluster', position: new THREE.Vector3(7, 0, 3), scale: 1.5 }
      ]
    },
    // H5: Wormhole Transfer (par 2) — portal_gate
    {
      index: 4,
      description: '5. Wormhole Transfer',
      par: 2,
      boundaryShape: [
        new THREE.Vector2(-5, -8), new THREE.Vector2(-5, 8),
        new THREE.Vector2(5, 8), new THREE.Vector2(5, -8),
        new THREE.Vector2(-5, -8)
      ],
      startPosition: new THREE.Vector3(0, 0, 6),
      holePosition: new THREE.Vector3(0, 0, -6),
      hazards: [],
      bumpers: [
        { position: new THREE.Vector3(-1.5, 0.25, -5), size: new THREE.Vector3(0.3, 0.5, 2), rotation: new THREE.Euler(0, 0.3, 0) },
        { position: new THREE.Vector3(1.5, 0.25, -5), size: new THREE.Vector3(0.3, 0.5, 2), rotation: new THREE.Euler(0, -0.3, 0) }
      ],
      mechanics: [
        { type: 'portal_gate', entryPosition: new THREE.Vector3(0, 0, 2), exitPosition: new THREE.Vector3(0, 0, -3), radius: 0.7 }
      ],
      heroProps: [
        { type: 'wormhole_ring', position: new THREE.Vector3(0, 0, 2), scale: 1 },
        { type: 'wormhole_ring', position: new THREE.Vector3(0, 0, -3), scale: 0.8 }
      ]
    },
    // H6: Solar Flare Run (par 3) — timed_hazard
    {
      index: 5,
      description: '6. Solar Flare Run',
      par: 3,
      boundaryShape: [
        new THREE.Vector2(-3, -14), new THREE.Vector2(-3, 14),
        new THREE.Vector2(3, 14), new THREE.Vector2(3, -14),
        new THREE.Vector2(-3, -14)
      ],
      startPosition: new THREE.Vector3(0, 0, 12),
      holePosition: new THREE.Vector3(0, 0, -12),
      hazards: [],
      bumpers: [],
      mechanics: [
        { type: 'timed_hazard', position: new THREE.Vector3(0, 0, 6), size: { width: 5, length: 1.5 }, onDuration: 1.5, offDuration: 2.5, hazardType: 'water', phase: 0 },
        { type: 'timed_hazard', position: new THREE.Vector3(0, 0, 0), size: { width: 5, length: 1.5 }, onDuration: 1.5, offDuration: 2.5, hazardType: 'water', phase: 1.5 },
        { type: 'timed_hazard', position: new THREE.Vector3(0, 0, -6), size: { width: 5, length: 1.5 }, onDuration: 1.5, offDuration: 2.5, hazardType: 'water', phase: 3.0 }
      ],
      heroProps: [
        { type: 'energy_collector', position: new THREE.Vector3(-5, 0, 0), scale: 1.5 }
      ]
    },
    // H7: Zero G Lab (par 2) — low_gravity_zone + bank_wall
    {
      index: 6,
      description: '7. Zero G Lab',
      par: 2,
      boundaryShape: [
        new THREE.Vector2(-5, -7), new THREE.Vector2(-5, 7),
        new THREE.Vector2(5, 7), new THREE.Vector2(5, -7),
        new THREE.Vector2(-5, -7)
      ],
      startPosition: new THREE.Vector3(0, 0, 5),
      holePosition: new THREE.Vector3(0, 0, -5),
      hazards: [],
      bumpers: [],
      mechanics: [
        { type: 'low_gravity_zone', position: new THREE.Vector3(0, 0, 0), radius: 3, gravityMultiplier: 0.25 },
        { type: 'bank_wall', segments: [
          { start: new THREE.Vector3(-3, 0, -2), end: new THREE.Vector3(-4, 0, 2) },
          { start: new THREE.Vector3(3, 0, -2), end: new THREE.Vector3(4, 0, 2) }
        ], restitution: 0.9 }
      ],
      heroProps: [
        { type: 'lab_equipment', position: new THREE.Vector3(-6, 0, 0), scale: 1.2 }
      ]
    },
    // H8: Event Horizon (par 3) — suction_zone + timed_gate
    {
      index: 7,
      description: '8. Event Horizon',
      par: 3,
      boundaryShape: [
        new THREE.Vector2(-8, -8), new THREE.Vector2(-8, 8),
        new THREE.Vector2(8, 8), new THREE.Vector2(8, -8),
        new THREE.Vector2(-8, -8)
      ],
      startPosition: new THREE.Vector3(-5, 0, 5),
      holePosition: new THREE.Vector3(5, 0, -5),
      hazards: [],
      bumpers: [],
      mechanics: [
        { type: 'suction_zone', position: new THREE.Vector3(0, 0, 0), radius: 4, force: 5 },
        { type: 'timed_gate', position: new THREE.Vector3(3, 0, -3), size: { width: 2, height: 0.8, depth: 0.2 }, openDuration: 2.5, closedDuration: 3 }
      ],
      heroProps: [
        { type: 'black_hole_core', position: new THREE.Vector3(0, 0, 0), scale: 1.5 }
      ]
    },
    // H9: Station Core Finale (par 4) — split_route + boost_strip + moving_sweeper + elevated_green
    {
      index: 8,
      description: '9. Station Core Finale',
      par: 4,
      boundaryShape: [
        new THREE.Vector2(-8, -14), new THREE.Vector2(-8, 14),
        new THREE.Vector2(8, 14), new THREE.Vector2(8, -14),
        new THREE.Vector2(-8, -14)
      ],
      startPosition: new THREE.Vector3(0, 0, 12),
      holePosition: new THREE.Vector3(0, 0.5, -11),
      hazards: [],
      bumpers: [],
      mechanics: [
        { type: 'split_route', walls: [
          { start: new THREE.Vector3(-1, 0, 10), end: new THREE.Vector3(-1, 0, 4) }
        ], height: 0.8 },
        { type: 'moving_sweeper', pivot: new THREE.Vector3(0, 0, 0), armLength: 3, speed: 1.0, size: { width: 3, height: 0.4, depth: 0.3 } },
        { type: 'boost_strip', position: new THREE.Vector3(4, 0, -4), direction: new THREE.Vector3(0, 0, -1), force: 10, size: { width: 1.5, length: 3 } },
        { type: 'elevated_green',
          platform: { position: new THREE.Vector3(0, 0, -11), width: 5, length: 4 },
          elevation: 0.5,
          ramp: { start: new THREE.Vector3(0, 0, -8), end: new THREE.Vector3(0, 0, -9.5), width: 3 }
        }
      ],
      heroProps: [
        { type: 'station_reactor', position: new THREE.Vector3(0, 0, -11), scale: 1.8 }
      ]
    }
  ];
}
