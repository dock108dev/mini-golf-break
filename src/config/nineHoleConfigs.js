import * as THREE from 'three';

/**
 * Hole configuration data for the 9-hole space-themed course.
 * Each config defines boundary, start/hole positions, hazards, and bumpers.
 */
export function createNineHoleConfigs() {
  return [
    // 1. Launch Pad - Welcome to space golf!
    {
      index: 0,
      description: '1. Launch Pad',
      par: 2,
      boundaryShape: [
        new THREE.Vector2(-5, -10),
        new THREE.Vector2(-5, 10),
        new THREE.Vector2(5, 10),
        new THREE.Vector2(5, -10),
        new THREE.Vector2(-5, -10)
      ],
      startPosition: new THREE.Vector3(0, 0, 8), // World
      holePosition: new THREE.Vector3(0, 0, -7), // World
      hazards: [], // Clean launch!
      bumpers: [
        {
          position: new THREE.Vector3(-2, 0.25, 0),
          size: new THREE.Vector3(0.5, 0.5, 3),
          rotation: new THREE.Euler(0, Math.PI / 6, 0)
        },
        {
          position: new THREE.Vector3(2, 0.25, 0),
          size: new THREE.Vector3(0.5, 0.5, 3),
          rotation: new THREE.Euler(0, -Math.PI / 6, 0)
        }
      ]
    },
    // 2. Lunar Bend - Navigate the crater field
    {
      index: 1,
      description: '2. Lunar Bend',
      par: 3,
      boundaryShape: [
        new THREE.Vector2(-6, -12),
        new THREE.Vector2(-6, 12),
        new THREE.Vector2(6, 12),
        new THREE.Vector2(6, -12),
        new THREE.Vector2(-6, -12)
      ],
      startPosition: new THREE.Vector3(-3, 0, 10), // World
      holePosition: new THREE.Vector3(3, 0, -10), // World
      hazards: [
        {
          type: 'sand', // Lunar dust
          shape: 'circle',
          position: new THREE.Vector3(-2, 0, 5), // World
          size: { radius: 2 },
          depth: 0.1
        },
        {
          type: 'sand',
          shape: 'circle',
          position: new THREE.Vector3(2, 0, -5), // World
          size: { radius: 2 },
          depth: 0.1
        }
      ],
      bumpers: [
        {
          position: new THREE.Vector3(0, 0.25, 0),
          size: new THREE.Vector3(4, 0.5, 0.5),
          rotation: new THREE.Euler(0, Math.PI / 4, 0)
        }
      ]
    },
    // 3. Asteroid Belt - Two paths through the field
    {
      index: 2,
      description: '3. Asteroid Belt',
      par: 3,
      boundaryShape: [
        new THREE.Vector2(-7, -10),
        new THREE.Vector2(-7, 10),
        new THREE.Vector2(7, 10),
        new THREE.Vector2(7, -10),
        new THREE.Vector2(-7, -10)
      ],
      startPosition: new THREE.Vector3(0, 0, 9), // World
      holePosition: new THREE.Vector3(0, 0, -9), // World
      hazards: [
        {
          type: 'water', // Space void
          shape: 'rectangle',
          position: new THREE.Vector3(0, 0, 0), // World
          size: { width: 8, length: 4 },
          depth: 0.15
        }
      ],
      bumpers: [
        // Asteroid obstacles
        {
          position: new THREE.Vector3(-3, 0.25, 3),
          size: new THREE.Vector3(1, 0.5, 1),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(3, 0.25, -3),
          size: new THREE.Vector3(1, 0.5, 1),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(0, 0.25, 0),
          size: new THREE.Vector3(1.5, 0.5, 1.5),
          rotation: new THREE.Euler(0, Math.PI / 4, 0)
        }
      ]
    },
    // 4. Olympus Mons - Mars mountain challenge
    {
      index: 3,
      description: '4. Olympus Mons',
      par: 3,
      boundaryShape: [
        new THREE.Vector2(-6, -10),
        new THREE.Vector2(-6, 10),
        new THREE.Vector2(6, 10),
        new THREE.Vector2(6, -10),
        new THREE.Vector2(-6, -10)
      ],
      startPosition: new THREE.Vector3(0, 0, 9), // World
      holePosition: new THREE.Vector3(0, 0, -9), // World
      hazards: [
        {
          type: 'sand', // Martian dust
          shape: 'circle',
          position: new THREE.Vector3(-3, 0, 3), // World
          size: { radius: 1.5 },
          depth: 0.1
        },
        {
          type: 'sand',
          shape: 'circle',
          position: new THREE.Vector3(3, 0, -3), // World
          size: { radius: 1.5 },
          depth: 0.1
        }
      ],
      bumpers: [
        // Central mountain
        {
          position: new THREE.Vector3(0, 0.35, 0),
          size: new THREE.Vector3(3, 0.7, 3),
          rotation: new THREE.Euler(0, Math.PI / 4, 0)
        }
      ]
    },
    // 5. Saturn's Rings - Timing challenge
    {
      index: 4,
      description: "5. Saturn's Rings",
      par: 3,
      boundaryShape: [
        new THREE.Vector2(-5, -10),
        new THREE.Vector2(-5, 10),
        new THREE.Vector2(5, 10),
        new THREE.Vector2(5, -10),
        new THREE.Vector2(-5, -10)
      ],
      startPosition: new THREE.Vector3(0, 0, 9),
      holePosition: new THREE.Vector3(0, 0, -9),
      hazards: [],
      bumpers: [
        // Ring obstacles
        {
          position: new THREE.Vector3(-2, 0.25, 4),
          size: new THREE.Vector3(4, 0.5, 0.3),
          rotation: new THREE.Euler(0, Math.PI / 3, 0)
        },
        {
          position: new THREE.Vector3(2, 0.25, 0),
          size: new THREE.Vector3(4, 0.5, 0.3),
          rotation: new THREE.Euler(0, -Math.PI / 3, 0)
        },
        {
          position: new THREE.Vector3(-2, 0.25, -4),
          size: new THREE.Vector3(4, 0.5, 0.3),
          rotation: new THREE.Euler(0, Math.PI / 3, 0)
        }
      ]
    },

    // 6. Cosmic Rapids - Navigate the nebula
    {
      index: 5,
      description: '6. Cosmic Rapids',
      par: 4,
      boundaryShape: [
        new THREE.Vector2(-5, -12),
        new THREE.Vector2(-5, 12),
        new THREE.Vector2(5, 12),
        new THREE.Vector2(5, -12),
        new THREE.Vector2(-5, -12)
      ],
      startPosition: new THREE.Vector3(-3, 0, 11),
      holePosition: new THREE.Vector3(3, 0, -11),
      hazards: [
        {
          type: 'water', // Nebula gas
          shape: 'circle',
          position: new THREE.Vector3(-2, 0, 6),
          size: { radius: 2 },
          depth: 0.15
        },
        {
          type: 'water',
          shape: 'circle',
          position: new THREE.Vector3(2, 0, 0),
          size: { radius: 2 },
          depth: 0.15
        },
        {
          type: 'water',
          shape: 'circle',
          position: new THREE.Vector3(-2, 0, -6),
          size: { radius: 2 },
          depth: 0.15
        }
      ],
      bumpers: [
        {
          position: new THREE.Vector3(0, 0.25, 3),
          size: new THREE.Vector3(1, 0.5, 1),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(0, 0.25, -3),
          size: new THREE.Vector3(1, 0.5, 1),
          rotation: new THREE.Euler(0, 0, 0)
        }
      ]
    },

    // 7. Wormhole Tunnel - Space-time bending passage
    {
      index: 6,
      description: '7. Wormhole Tunnel',
      par: 4,
      boundaryShape: [
        new THREE.Vector2(-4, -12),
        new THREE.Vector2(-4, 12),
        new THREE.Vector2(4, 12),
        new THREE.Vector2(4, -12),
        new THREE.Vector2(-4, -12)
      ],
      startPosition: new THREE.Vector3(0, 0, 11),
      holePosition: new THREE.Vector3(0, 0, -11),
      hazards: [],
      bumpers: [
        // Narrowing tunnel walls
        {
          position: new THREE.Vector3(-2, 0.25, 6),
          size: new THREE.Vector3(0.3, 0.5, 4),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(2, 0.25, 6),
          size: new THREE.Vector3(0.3, 0.5, 4),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(-1.5, 0.25, 0),
          size: new THREE.Vector3(0.3, 0.5, 4),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(1.5, 0.25, 0),
          size: new THREE.Vector3(0.3, 0.5, 4),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(-1, 0.25, -6),
          size: new THREE.Vector3(0.3, 0.5, 4),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(1, 0.25, -6),
          size: new THREE.Vector3(0.3, 0.5, 4),
          rotation: new THREE.Euler(0, 0, 0)
        }
      ]
    },

    // 8. Gravity Well - Black hole spiral
    {
      index: 7,
      description: '8. Gravity Well',
      par: 3,
      boundaryShape: [
        new THREE.Vector2(-7, -7),
        new THREE.Vector2(-7, 7),
        new THREE.Vector2(7, 7),
        new THREE.Vector2(7, -7),
        new THREE.Vector2(-7, -7)
      ],
      startPosition: new THREE.Vector3(-5, 0, 5),
      holePosition: new THREE.Vector3(0, 0, 0),
      hazards: [
        {
          type: 'water', // Event horizon
          shape: 'circle',
          position: new THREE.Vector3(0, 0, 0),
          size: { radius: 3 },
          depth: 0.2
        }
      ],
      bumpers: [
        // Spiral path
        {
          position: new THREE.Vector3(-3, 0.25, 3),
          size: new THREE.Vector3(0.5, 0.5, 2),
          rotation: new THREE.Euler(0, Math.PI / 4, 0)
        },
        {
          position: new THREE.Vector3(3, 0.25, 3),
          size: new THREE.Vector3(0.5, 0.5, 2),
          rotation: new THREE.Euler(0, -Math.PI / 4, 0)
        },
        {
          position: new THREE.Vector3(3, 0.25, -3),
          size: new THREE.Vector3(0.5, 0.5, 2),
          rotation: new THREE.Euler(0, Math.PI / 4, 0)
        },
        {
          position: new THREE.Vector3(-3, 0.25, -3),
          size: new THREE.Vector3(0.5, 0.5, 2),
          rotation: new THREE.Euler(0, -Math.PI / 4, 0)
        }
      ]
    },

    // 9. Galactic Core - Epic finale at the center
    {
      index: 8,
      description: '9. Galactic Core',
      par: 5,
      boundaryShape: [
        new THREE.Vector2(-10, -10),
        new THREE.Vector2(-10, 10),
        new THREE.Vector2(10, 10),
        new THREE.Vector2(10, -10),
        new THREE.Vector2(-10, -10)
      ],
      startPosition: new THREE.Vector3(0, 0, 9),
      holePosition: new THREE.Vector3(0, 0, 0),
      hazards: [
        {
          type: 'sand', // Stardust ring 1
          shape: 'circle',
          position: new THREE.Vector3(0, 0, 0),
          size: { radius: 8 },
          depth: 0.1
        },
        {
          type: 'sand', // Stardust ring 2
          shape: 'circle',
          position: new THREE.Vector3(0, 0, 0),
          size: { radius: 5 },
          depth: 0.05
        }
      ],
      bumpers: [
        // Orbiting planets
        {
          position: new THREE.Vector3(-4, 0.25, 4),
          size: new THREE.Vector3(1.5, 0.5, 1.5),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(4, 0.25, 4),
          size: new THREE.Vector3(1.5, 0.5, 1.5),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(4, 0.25, -4),
          size: new THREE.Vector3(1.5, 0.5, 1.5),
          rotation: new THREE.Euler(0, 0, 0)
        },
        {
          position: new THREE.Vector3(-4, 0.25, -4),
          size: new THREE.Vector3(1.5, 0.5, 1.5),
          rotation: new THREE.Euler(0, 0, 0)
        }
      ]
    }
  ];
}
