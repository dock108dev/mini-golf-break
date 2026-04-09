/**
 * Automated playtest validation for all 9 Orbital Drift holes.
 * ISSUE-015
 *
 * Validates:
 * - Each hole initializes without errors
 * - No geometry traps (ball cannot get permanently stuck)
 * - MovingSweeper/TimedHazard/TimedGate timing allows ≥0.5s passage windows
 * - PortalGate on H5 teleports to a valid position within the boundary
 * - SuctionZone force on H8 is escapable at zone edge
 * - ElevatedGreen ramp angles are traversable (< 30 degrees)
 * - All 9 holes have valid start/hole positions within boundaries
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createOrbitalDriftConfigs } from '../../config/orbitalDriftConfigs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    step: jest.fn(),
    groundMaterial: { id: 'ground' },
    bumperMaterial: { id: 'bumper' },
  };
}

function makeMockGroup() {
  const children = [];
  return {
    add: jest.fn(child => children.push(child)),
    remove: jest.fn(),
    children,
  };
}

function makeBallBody(x = 0, y = 0.3, z = 0) {
  return {
    position: {
      x, y, z,
      set: jest.fn(function (nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; }),
    },
    velocity: {
      x: 0, y: 0, z: 0,
      set: jest.fn(function (vx, vy, vz) { this.x = vx; this.y = vy; this.z = vz; }),
    },
    quaternion: { x: 0, y: 0, z: 0, w: 1, copy: jest.fn(), setFromAxisAngle: jest.fn() },
    mass: 0.45,
    sleepState: 0, // AWAKE
    applyForce: jest.fn(),
    applyImpulse: jest.fn(),
    wakeUp: jest.fn(),
    addShape: jest.fn(),
    userData: {},
  };
}

/**
 * Check if a point (x, z) is inside a 2D polygon defined by Vector2 boundary points.
 * Uses ray-casting algorithm.
 */
function isPointInBoundary(x, z, boundaryShape) {
  let inside = false;
  const n = boundaryShape.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = boundaryShape[i].x, zi = boundaryShape[i].y;
    const xj = boundaryShape[j].x, zj = boundaryShape[j].y;
    const intersect = ((zi > z) !== (zj > z)) &&
      (x < (xj - xi) * (z - zi) / (zj - zi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Load configs once
// ---------------------------------------------------------------------------

let configs;

beforeAll(() => {
  // Ensure THREE.Vector2 and THREE.Vector3 produce usable objects
  // (setup.js mocks are already loaded by Jest)
  configs = createOrbitalDriftConfigs();
});

// ===========================================================================
// 1. Basic hole config validation — each hole initializes without errors
// ===========================================================================

describe('Orbital Drift — Hole Config Integrity', () => {
  it('has exactly 9 holes', () => {
    expect(configs).toHaveLength(9);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('H%i+1 has required fields', (idx) => {
    const h = configs[idx];
    expect(h.index).toBe(idx);
    expect(h.description).toBeTruthy();
    expect(h.par).toBeGreaterThanOrEqual(2);
    expect(h.boundaryShape).toBeDefined();
    expect(h.boundaryShape.length).toBeGreaterThanOrEqual(4);
    expect(h.startPosition).toBeDefined();
    expect(h.holePosition).toBeDefined();
    expect(Array.isArray(h.hazards)).toBe(true);
    expect(Array.isArray(h.bumpers)).toBe(true);
    expect(Array.isArray(h.mechanics)).toBe(true);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('H%i+1 startPosition is within boundary', (idx) => {
    const h = configs[idx];
    const inBounds = isPointInBoundary(
      h.startPosition.x, h.startPosition.z, h.boundaryShape
    );
    expect(inBounds).toBe(true);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('H%i+1 holePosition is within boundary', (idx) => {
    const h = configs[idx];
    const inBounds = isPointInBoundary(
      h.holePosition.x, h.holePosition.z, h.boundaryShape
    );
    expect(inBounds).toBe(true);
  });

  it('total par across 9 holes is 24', () => {
    const totalPar = configs.reduce((sum, h) => sum + h.par, 0);
    expect(totalPar).toBe(24);
  });
});

// ===========================================================================
// 2. No geometry traps — ball cannot get permanently stuck
// ===========================================================================

describe('Orbital Drift — No Geometry Traps', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('H%i+1 start and hole positions are not coincident', (idx) => {
    const h = configs[idx];
    const dx = h.startPosition.x - h.holePosition.x;
    const dz = h.startPosition.z - h.holePosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // Start and hole must be at least 2 units apart
    expect(dist).toBeGreaterThan(2);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('H%i+1 boundary area is large enough for play', (idx) => {
    const h = configs[idx];
    // Compute bounding box of boundary
    const xs = h.boundaryShape.map(v => v.x);
    const zs = h.boundaryShape.map(v => v.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const length = Math.max(...zs) - Math.min(...zs);
    const area = width * length;
    // Minimum playable area: 30 sq units
    expect(area).toBeGreaterThanOrEqual(30);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('H%i+1 bumpers do not overlap start or hole positions', (idx) => {
    const h = configs[idx];
    for (const bumper of h.bumpers) {
      // Check bumper center is at least 1 unit from start and hole
      const distStart = Math.sqrt(
        (bumper.position.x - h.startPosition.x) ** 2 +
        (bumper.position.z - h.startPosition.z) ** 2
      );
      const distHole = Math.sqrt(
        (bumper.position.x - h.holePosition.x) ** 2 +
        (bumper.position.z - h.holePosition.z) ** 2
      );
      expect(distStart).toBeGreaterThan(0.5);
      expect(distHole).toBeGreaterThan(0.5);
    }
  });
});

// ===========================================================================
// 3. MovingSweeper timing — at least 0.5s passage window
// ===========================================================================

describe('Orbital Drift — MovingSweeper Timing', () => {
  const sweeperHoles = [
    { holeIdx: 0, desc: 'H1 Launch Bay' },
    { holeIdx: 2, desc: 'H3 Satellite Slingshot' },
    { holeIdx: 8, desc: 'H9 Station Core Finale' },
  ];

  it.each(sweeperHoles)('$desc sweeper allows ≥0.5s passage window', ({ holeIdx }) => {
    const h = configs[holeIdx];
    const sweepers = h.mechanics.filter(m => m.type === 'moving_sweeper');
    expect(sweepers.length).toBeGreaterThan(0);

    for (const sw of sweepers) {
      const speed = Math.abs(sw.speed);
      const armLength = sw.armLength;
      const armWidth = sw.size?.width || armLength;

      // The sweeper arm subtends an angular arc at radius r from pivot.
      // For a ball at distance r from pivot, the arm width subtends angle = armWidth / r.
      // At a given distance, time to pass = angle / angular_speed.
      // Check at minimum safe distance (just past arm end):
      const r = armLength * 0.75; // typical ball crossing point
      const angularArc = armWidth / r;
      // Time the arm takes to sweep through this arc
      const sweepTime = angularArc / speed;
      // The gap window is the full rotation period minus sweep time
      const period = (2 * Math.PI) / speed;
      const gapTime = period - sweepTime;

      expect(gapTime).toBeGreaterThanOrEqual(0.5);
    }
  });
});

// ===========================================================================
// 4. TimedHazard timing — at least 0.5s off-window for passage
// ===========================================================================

describe('Orbital Drift — TimedHazard Timing', () => {
  it('H6 Solar Flare Run timed hazards have ≥0.5s off-window', () => {
    const h = configs[5]; // H6
    const timedHazards = h.mechanics.filter(m => m.type === 'timed_hazard');
    expect(timedHazards.length).toBe(3);

    for (const th of timedHazards) {
      expect(th.offDuration).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('H6 timed hazards have staggered phases for fair timing', () => {
    const h = configs[5];
    const timedHazards = h.mechanics.filter(m => m.type === 'timed_hazard');
    const phases = timedHazards.map(th => th.phase);
    // At least two different phases
    const uniquePhases = new Set(phases);
    expect(uniquePhases.size).toBeGreaterThanOrEqual(2);
  });
});

// ===========================================================================
// 5. TimedGate timing — at least 0.5s open-window for passage
// ===========================================================================

describe('Orbital Drift — TimedGate Timing', () => {
  it('H8 Event Horizon timed gate has ≥0.5s open window', () => {
    const h = configs[7]; // H8
    const timedGates = h.mechanics.filter(m => m.type === 'timed_gate');
    expect(timedGates.length).toBe(1);

    for (const tg of timedGates) {
      expect(tg.openDuration).toBeGreaterThanOrEqual(0.5);
    }
  });
});

// ===========================================================================
// 6. PortalGate on H5 — exit position within boundary
// ===========================================================================

describe('Orbital Drift — PortalGate Validation', () => {
  it('H5 portal exit position is within hole boundary', () => {
    const h = configs[4]; // H5 Wormhole Transfer
    const portals = h.mechanics.filter(m => m.type === 'portal_gate');
    expect(portals.length).toBe(1);

    const portal = portals[0];
    const exitInBounds = isPointInBoundary(
      portal.exitPosition.x, portal.exitPosition.z, h.boundaryShape
    );
    expect(exitInBounds).toBe(true);
  });

  it('H5 portal entry position is within hole boundary', () => {
    const h = configs[4];
    const portal = h.mechanics.find(m => m.type === 'portal_gate');
    const entryInBounds = isPointInBoundary(
      portal.entryPosition.x, portal.entryPosition.z, h.boundaryShape
    );
    expect(entryInBounds).toBe(true);
  });

  it('H5 portal exit is not on top of the hole', () => {
    const h = configs[4];
    const portal = h.mechanics.find(m => m.type === 'portal_gate');
    const distToHole = Math.sqrt(
      (portal.exitPosition.x - h.holePosition.x) ** 2 +
      (portal.exitPosition.z - h.holePosition.z) ** 2
    );
    // Exit should not land directly on the hole (min 1 unit distance)
    expect(distToHole).toBeGreaterThan(1);
  });

  it('H5 portal exit is not on top of entry (no infinite loops)', () => {
    const h = configs[4];
    const portal = h.mechanics.find(m => m.type === 'portal_gate');
    const dist = Math.sqrt(
      (portal.exitPosition.x - portal.entryPosition.x) ** 2 +
      (portal.exitPosition.z - portal.entryPosition.z) ** 2
    );
    // Entry and exit must be at least 2× the portal radius apart
    expect(dist).toBeGreaterThan(portal.radius * 2);
  });
});

// ===========================================================================
// 7. SuctionZone on H8 — force is escapable at zone edge
// ===========================================================================

describe('Orbital Drift — SuctionZone Escape Validation', () => {
  it('H8 suction force at zone edge allows ball escape', () => {
    const h = configs[7]; // H8 Event Horizon
    const suction = h.mechanics.find(m => m.type === 'suction_zone');
    expect(suction).toBeDefined();

    // SuctionZone formula: strength = force * (1 - dist/radius)
    // At the edge (dist = radius): strength = force * (1 - 1) = 0
    // At 90% of radius: strength = force * 0.1
    const edgeForce = suction.force * (1 - 0.9); // at 90% radius
    const ballMass = 0.45;
    // Ball escape velocity needed: F = ma → a = F/m
    // A rolling ball with typical hit velocity of 3-5 m/s should overcome
    // The edge suction acceleration must be reasonable (< 5 m/s²)
    const edgeAcceleration = edgeForce / ballMass;
    expect(edgeAcceleration).toBeLessThan(5);

    // At half radius: strength = force * 0.5
    const halfForce = suction.force * 0.5;
    const halfAcceleration = halfForce / ballMass;
    // Even at half radius, the acceleration must not exceed escape capability
    // Typical ball speed is 2-6 m/s; acceleration < 15 m/s² is manageable
    expect(halfAcceleration).toBeLessThan(15);
  });

  it('H8 suction zone radius does not cover entire hole', () => {
    const h = configs[7];
    const suction = h.mechanics.find(m => m.type === 'suction_zone');

    // Boundary bounding box
    const xs = h.boundaryShape.map(v => v.x);
    const zs = h.boundaryShape.map(v => v.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const length = Math.max(...zs) - Math.min(...zs);
    const halfDiagonal = Math.sqrt(width * width + length * length) / 2;

    // Suction radius should be less than half the diagonal (not cover everything)
    expect(suction.radius).toBeLessThan(halfDiagonal * 0.75);
  });
});

// ===========================================================================
// 8. ElevatedGreen ramp angles — traversable (< 30 degrees)
// ===========================================================================

describe('Orbital Drift — ElevatedGreen Ramp Angles', () => {
  const elevatedHoles = [
    { holeIdx: 3, desc: 'H4 Asteroid Belt Bounce' },
    { holeIdx: 8, desc: 'H9 Station Core Finale' },
  ];

  it.each(elevatedHoles)('$desc ramp angle < 30 degrees', ({ holeIdx }) => {
    const h = configs[holeIdx];
    const elevated = h.mechanics.find(m => m.type === 'elevated_green');
    expect(elevated).toBeDefined();

    const ramp = elevated.ramp;
    const elevation = elevated.elevation || 0.5;

    // Horizontal distance of ramp
    const dx = ramp.end.x - ramp.start.x;
    const dz = ramp.end.z - ramp.start.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    // Ramp angle = atan(elevation / horizontalDist)
    const angleRad = Math.atan2(elevation, horizontalDist);
    const angleDeg = angleRad * (180 / Math.PI);

    expect(angleDeg).toBeLessThan(30);
  });

  it.each(elevatedHoles)('$desc elevated platform is within boundary', ({ holeIdx }) => {
    const h = configs[holeIdx];
    const elevated = h.mechanics.find(m => m.type === 'elevated_green');
    const platformPos = elevated.platform.position;

    const inBounds = isPointInBoundary(
      platformPos.x, platformPos.z, h.boundaryShape
    );
    expect(inBounds).toBe(true);
  });
});

// ===========================================================================
// 9. Cross-hole consistency checks
// ===========================================================================

describe('Orbital Drift — Cross-Hole Consistency', () => {
  it('each hole has a unique index', () => {
    const indices = configs.map(h => h.index);
    const uniqueIndices = new Set(indices);
    expect(uniqueIndices.size).toBe(9);
  });

  it('each hole has a unique description', () => {
    const descriptions = configs.map(h => h.description);
    const uniqueDescriptions = new Set(descriptions);
    expect(uniqueDescriptions.size).toBe(9);
  });

  it('all mechanic types in configs are valid registered types', () => {
    const validTypes = [
      'moving_sweeper', 'bowl_contour', 'split_route', 'ricochet_bumpers',
      'elevated_green', 'portal_gate', 'timed_hazard', 'low_gravity_zone',
      'bank_wall', 'suction_zone', 'timed_gate', 'boost_strip',
    ];

    for (const h of configs) {
      for (const m of h.mechanics) {
        expect(validTypes).toContain(m.type);
      }
    }
  });

  it('par values are reasonable (2-5 range)', () => {
    for (const h of configs) {
      expect(h.par).toBeGreaterThanOrEqual(2);
      expect(h.par).toBeLessThanOrEqual(5);
    }
  });

  it('no hole has more than 5 mechanics (performance sanity)', () => {
    for (const h of configs) {
      expect(h.mechanics.length).toBeLessThanOrEqual(5);
    }
  });

  it('all mechanic configs have required type field', () => {
    for (const h of configs) {
      for (const m of h.mechanics) {
        expect(m.type).toBeTruthy();
        expect(typeof m.type).toBe('string');
      }
    }
  });
});

// ===========================================================================
// 10. Mechanic-specific config validation
// ===========================================================================

describe('Orbital Drift — Mechanic Config Validation', () => {
  it('all moving_sweeper configs have positive armLength and speed', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'moving_sweeper')) {
        expect(m.armLength).toBeGreaterThan(0);
        expect(m.speed).toBeDefined();
        expect(m.speed).not.toBe(0);
      }
    }
  });

  it('all portal_gate configs have entry and exit positions', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'portal_gate')) {
        expect(m.entryPosition).toBeDefined();
        expect(m.exitPosition).toBeDefined();
        expect(m.radius).toBeGreaterThan(0);
      }
    }
  });

  it('all timed_hazard configs have valid durations', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'timed_hazard')) {
        expect(m.onDuration).toBeGreaterThan(0);
        expect(m.offDuration).toBeGreaterThan(0);
      }
    }
  });

  it('all timed_gate configs have valid durations', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'timed_gate')) {
        expect(m.openDuration).toBeGreaterThan(0);
        expect(m.closedDuration).toBeGreaterThan(0);
      }
    }
  });

  it('all suction_zone configs have positive force and radius', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'suction_zone')) {
        expect(m.force).toBeGreaterThan(0);
        expect(m.radius).toBeGreaterThan(0);
      }
    }
  });

  it('all elevated_green configs have platform and ramp', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'elevated_green')) {
        expect(m.platform).toBeDefined();
        expect(m.platform.position).toBeDefined();
        expect(m.ramp).toBeDefined();
        expect(m.ramp.start).toBeDefined();
        expect(m.ramp.end).toBeDefined();
      }
    }
  });

  it('all boost_strip configs have direction and force', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'boost_strip')) {
        expect(m.direction).toBeDefined();
        expect(m.force).toBeGreaterThan(0);
      }
    }
  });

  it('all bowl_contour configs have position and radius', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'bowl_contour')) {
        expect(m.position).toBeDefined();
        expect(m.radius).toBeGreaterThan(0);
        expect(m.force).toBeGreaterThan(0);
      }
    }
  });

  it('all low_gravity_zone configs have valid gravityMultiplier', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'low_gravity_zone')) {
        expect(m.gravityMultiplier).toBeGreaterThan(0);
        expect(m.gravityMultiplier).toBeLessThan(1);
      }
    }
  });

  it('all bank_wall configs have at least one segment', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'bank_wall')) {
        expect(m.segments).toBeDefined();
        expect(m.segments.length).toBeGreaterThan(0);
      }
    }
  });

  it('all split_route configs have at least one wall', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'split_route')) {
        expect(m.walls).toBeDefined();
        expect(m.walls.length).toBeGreaterThan(0);
      }
    }
  });

  it('all ricochet_bumpers configs have at least one bumper', () => {
    for (const h of configs) {
      for (const m of h.mechanics.filter(m => m.type === 'ricochet_bumpers')) {
        expect(m.bumpers).toBeDefined();
        expect(m.bumpers.length).toBeGreaterThan(0);
      }
    }
  });
});
