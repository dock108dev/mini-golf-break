/**
 * Integration tests for OOB detection with position-altering mechanics.
 * ISSUE-111
 *
 * Verifies that HazardManager out-of-bounds detection works correctly when
 * mechanics alter ball position or velocity:
 *   - PortalGate teleporting to a valid position should NOT trigger OOB
 *   - PortalGate with misconfigured exit outside boundary should trigger OOB
 *   - BoostStrip pushing ball past boundary triggers normal OOB reset + penalty
 *   - Ball OOB reset after SuctionZone places ball at last valid hit position
 */

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { HazardManager } from '../../managers/HazardManager';
import { PortalGate } from '../../mechanics/PortalGate';
import { BoostStrip } from '../../mechanics/BoostStrip';
import { SuctionZone } from '../../mechanics/SuctionZone';
import { EventTypes } from '../../events/EventTypes';

// ---------------------------------------------------------------------------
// Mock enhancements
// ---------------------------------------------------------------------------

beforeAll(() => {
  CANNON.Vec3.mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    scale: s => ({ x: x * s, y: y * s, z: z * s })
  }));

  CANNON.Body.mockImplementation(() => ({
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      set: jest.fn(),
      setFromAxisAngle: jest.fn(),
      copy: jest.fn()
    },
    addShape: jest.fn(),
    addEventListener: jest.fn(),
    userData: {}
  }));

  CANNON.Body.SLEEPING = 2;
  CANNON.Body.KINEMATIC = 4;
  CANNON.Body.STATIC = 1;

  THREE.MeshStandardMaterial.mockImplementation(opts => {
    const mat = { color: 0xffffff, roughness: 0.3, metalness: 0.2, dispose: jest.fn() };
    if (opts) {
      Object.assign(mat, opts);
    }
    return mat;
  });

  const geomProto = { dispose: jest.fn() };
  if (typeof THREE.CircleGeometry.mockImplementation === 'function') {
    THREE.CircleGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.PlaneGeometry.mockImplementation === 'function') {
    THREE.PlaneGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.BoxGeometry.mockImplementation === 'function') {
    THREE.BoxGeometry.mockImplementation(() => ({ ...geomProto }));
  }
  if (typeof THREE.RingGeometry?.mockImplementation === 'function') {
    THREE.RingGeometry.mockImplementation(() => ({ ...geomProto }));
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SURFACE_HEIGHT = 0.2;
const DT = 1 / 60;

function makeMockWorld() {
  return {
    addBody: jest.fn(),
    removeBody: jest.fn(),
    step: jest.fn(),
    bumperMaterial: { name: 'bumper' }
  };
}

function makeMockGroup() {
  const children = [];
  return {
    add: jest.fn(child => children.push(child)),
    remove: jest.fn(child => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
      }
    }),
    children
  };
}

function makeMockBall(x = 0, z = 0) {
  return {
    position: {
      x,
      y: SURFACE_HEIGHT,
      z,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    velocity: {
      x: 0,
      y: 0,
      z: 0,
      set: jest.fn(function (nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;
      })
    },
    mass: 0.45,
    sleepState: 0,
    applyForce: jest.fn(),
    wakeUp: jest.fn()
  };
}

/**
 * Creates a HazardManager with mocked game dependencies.
 * The ball mesh position is linked to the provided ballBody so that
 * HazardManager.checkHazards() reads the same position that mechanics write.
 */
function makeHazardManager(ballBody, opts = {}) {
  const mockEventManager = {
    publish: jest.fn(),
    subscribe: jest.fn(() => jest.fn())
  };

  const mockGame = {
    eventManager: mockEventManager,
    ballManager: {
      ball: {
        mesh: {
          position: ballBody.position
        }
      }
    },
    debugManager: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    },
    uiManager: {
      showMessage: jest.fn()
    }
  };

  const hm = new HazardManager(mockGame);
  hm.init();

  if (opts.boundaryLimits) {
    Object.assign(hm.boundaryLimits, opts.boundaryLimits);
  }

  return { hazardManager: hm, mockEventManager, mockGame };
}

// ---------------------------------------------------------------------------
// PortalGate teleporting ball to a valid position does NOT trigger OOB
// ---------------------------------------------------------------------------

describe('PortalGate teleport to valid position does not trigger OOB', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('ball teleported to valid exit position is not detected as OOB', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(-5, 0, 0),
        exitPosition: new THREE.Vector3(5, 0, 0),
        radius: 1.0
      },
      SURFACE_HEIGHT
    );

    // Ball starts at the entry position
    const ball = makeMockBall(-5, 0);

    // Set up HazardManager with default boundaries (±50)
    const { hazardManager, mockEventManager } = makeHazardManager(ball);

    // Teleport the ball
    portal.update(DT, ball);

    // Confirm ball was teleported to exit position
    expect(ball.position.set).toHaveBeenCalledWith(5, SURFACE_HEIGHT + 0.3, 0);

    // After teleport, ball.position reflects exit coords (set mock updates them)
    // Now check OOB — exit position (5, 0) is within ±50 boundary
    const isOOB = hazardManager.checkHazards();

    expect(isOOB).toBe(false);
    expect(mockEventManager.publish).not.toHaveBeenCalledWith(
      EventTypes.HAZARD_DETECTED,
      expect.objectContaining({ hazardType: 'outOfBounds' }),
      expect.anything()
    );
  });

  it('ball position after teleport is within boundaries on the same frame', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(0, 0, 0),
        exitPosition: new THREE.Vector3(10, 0, -8),
        radius: 0.8
      },
      SURFACE_HEIGHT
    );

    const ball = makeMockBall(0, 0);
    const { hazardManager } = makeHazardManager(ball);

    // Teleport
    portal.update(DT, ball);

    // Verify exit position is within bounds
    expect(hazardManager.isPositionOutOfBounds(ball.position)).toBe(false);
  });

  it('multiple teleports within boundaries never trigger OOB', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(-10, 0, -10),
        exitPosition: new THREE.Vector3(10, 0, 10),
        radius: 1.0
      },
      SURFACE_HEIGHT
    );

    const ball = makeMockBall(-10, -10);
    const { hazardManager, mockEventManager } = makeHazardManager(ball);

    // First teleport
    portal.update(DT, ball);
    let isOOB = hazardManager.checkHazards();
    expect(isOOB).toBe(false);

    // Wait for cooldown, move ball back to entry
    portal.update(1.5, ball); // expire cooldown
    ball.position.x = -10;
    ball.position.z = -10;

    // Second teleport
    portal.update(DT, ball);
    isOOB = hazardManager.checkHazards();
    expect(isOOB).toBe(false);

    // No OOB events published at any point
    const oobCalls = mockEventManager.publish.mock.calls.filter(
      call => call[0] === EventTypes.HAZARD_DETECTED && call[1]?.hazardType === 'outOfBounds'
    );
    expect(oobCalls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PortalGate with misconfigured exit position outside boundary triggers OOB
// ---------------------------------------------------------------------------

describe('PortalGate with exit outside boundary triggers OOB', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('ball teleported to exit position outside boundary triggers OOB on next check', () => {
    // Misconfigured portal: exit is beyond the ±50 boundary
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(0, 0, 0),
        exitPosition: new THREE.Vector3(60, 0, 0), // x=60 is outside maxX=50
        radius: 1.0
      },
      SURFACE_HEIGHT
    );

    const ball = makeMockBall(0, 0);
    const { hazardManager, mockEventManager } = makeHazardManager(ball);

    // Set last safe position before teleport
    hazardManager.lastSafePosition.x = 0;
    hazardManager.lastSafePosition.y = SURFACE_HEIGHT;
    hazardManager.lastSafePosition.z = 0;

    // Teleport sends ball to x=60
    portal.update(DT, ball);

    // Verify ball is now at the exit position
    expect(ball.position.x).toBe(60);

    // HazardManager check should detect OOB
    const isOOB = hazardManager.checkHazards();
    expect(isOOB).toBe(true);

    // Should publish HAZARD_DETECTED with outOfBounds type and penalty
    expect(mockEventManager.publish).toHaveBeenCalledWith(
      EventTypes.HAZARD_DETECTED,
      expect.objectContaining({
        hazardType: 'outOfBounds',
        penalty: 1
      }),
      hazardManager
    );
  });

  it('exit beyond negative Z boundary triggers OOB', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(0, 0, 0),
        exitPosition: new THREE.Vector3(0, 0, -55), // z=-55 outside minZ=-50
        radius: 1.0
      },
      SURFACE_HEIGHT
    );

    const ball = makeMockBall(0, 0);
    const { hazardManager } = makeHazardManager(ball);

    portal.update(DT, ball);

    expect(hazardManager.isPositionOutOfBounds(ball.position)).toBe(true);

    const isOOB = hazardManager.checkHazards();
    expect(isOOB).toBe(true);
  });

  it('OOB event includes last safe position for ball reset', () => {
    const portal = new PortalGate(
      world,
      group,
      {
        entryPosition: new THREE.Vector3(0, 0, 0),
        exitPosition: new THREE.Vector3(100, 0, 100),
        radius: 1.0
      },
      SURFACE_HEIGHT
    );

    const ball = makeMockBall(0, 0);
    const { hazardManager, mockEventManager } = makeHazardManager(ball);

    // Set a known last safe position
    hazardManager.lastSafePosition.x = 3;
    hazardManager.lastSafePosition.y = SURFACE_HEIGHT;
    hazardManager.lastSafePosition.z = -2;

    portal.update(DT, ball);
    hazardManager.checkHazards();

    const oobCall = mockEventManager.publish.mock.calls.find(
      call => call[0] === EventTypes.HAZARD_DETECTED && call[1]?.hazardType === 'outOfBounds'
    );
    expect(oobCall).toBeDefined();

    const lastSafe = oobCall[1].lastSafePosition;
    expect(lastSafe.x).toBe(3);
    expect(lastSafe.z).toBe(-2);
  });
});

// ---------------------------------------------------------------------------
// BoostStrip pushing ball past boundary triggers normal OOB reset and penalty
// ---------------------------------------------------------------------------

describe('BoostStrip pushing ball past boundary triggers OOB', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('ball pushed past boundary by boost strip triggers OOB with penalty', () => {
    // Boost strip near the boundary edge, pushing toward +X
    const strip = new BoostStrip(
      world,
      group,
      {
        position: new THREE.Vector3(48, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        force: 20,
        size: { width: 4, length: 4 }
      },
      SURFACE_HEIGHT
    );

    // Ball starts at strip position (in the zone)
    const ball = makeMockBall(strip.triggerBody.position.x, strip.triggerBody.position.z);

    const { hazardManager, mockEventManager } = makeHazardManager(ball);

    // Record last safe position before the ball was boosted
    hazardManager.lastSafePosition.x = 45;
    hazardManager.lastSafePosition.y = SURFACE_HEIGHT;
    hazardManager.lastSafePosition.z = 0;

    // Boost strip applies force (doesn't move position directly)
    strip.update(DT, ball);
    expect(ball.applyForce).toHaveBeenCalled();

    // Simulate physics stepping: the applied force moved the ball past boundary
    // In real game, physics world would integrate the force into velocity then position.
    // We simulate the result: ball ends up past maxX=50
    ball.position.x = 52;

    // HazardManager detects OOB
    const isOOB = hazardManager.checkHazards();
    expect(isOOB).toBe(true);

    // Normal OOB handling: penalty + last safe position
    expect(mockEventManager.publish).toHaveBeenCalledWith(
      EventTypes.HAZARD_DETECTED,
      expect.objectContaining({
        hazardType: 'outOfBounds',
        penalty: 1
      }),
      hazardManager
    );

    // The published event includes last safe position for reset
    const oobCall = mockEventManager.publish.mock.calls.find(
      call => call[0] === EventTypes.HAZARD_DETECTED
    );
    expect(oobCall[1].lastSafePosition.x).toBe(45);
  });

  it('boost strip force is applied before OOB detection in same frame', () => {
    const strip = new BoostStrip(
      world,
      group,
      {
        position: new THREE.Vector3(49, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        force: 15,
        size: { width: 3, length: 3 }
      },
      SURFACE_HEIGHT
    );

    const ball = makeMockBall(strip.triggerBody.position.x, strip.triggerBody.position.z);
    const { hazardManager } = makeHazardManager(ball);

    // Step 1: Boost strip applies force
    strip.update(DT, ball);
    expect(ball.applyForce).toHaveBeenCalledTimes(1);

    // Step 2: Before physics steps, ball is still in bounds
    expect(hazardManager.isPositionOutOfBounds(ball.position)).toBe(false);

    // Step 3: Physics steps the world (simulated — ball moves past boundary)
    ball.position.x = 51;

    // Step 4: OOB check detects the out-of-bounds position
    expect(hazardManager.isPositionOutOfBounds(ball.position)).toBe(true);
  });

  it('ball boosted along Z axis past boundary also triggers OOB', () => {
    const strip = new BoostStrip(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 48),
        direction: new THREE.Vector3(0, 0, 1),
        force: 25,
        size: { width: 4, length: 4 }
      },
      SURFACE_HEIGHT
    );

    const ball = makeMockBall(strip.triggerBody.position.x, strip.triggerBody.position.z);
    const { hazardManager, mockEventManager } = makeHazardManager(ball);

    hazardManager.lastSafePosition.x = 0;
    hazardManager.lastSafePosition.y = SURFACE_HEIGHT;
    hazardManager.lastSafePosition.z = 45;

    // Boost applies force
    strip.update(DT, ball);

    // Simulate physics: ball pushed past maxZ=50
    ball.position.z = 53;

    const isOOB = hazardManager.checkHazards();
    expect(isOOB).toBe(true);

    expect(mockEventManager.publish).toHaveBeenCalledWith(
      EventTypes.HAZARD_DETECTED,
      expect.objectContaining({
        hazardType: 'outOfBounds',
        penalty: 1
      }),
      hazardManager
    );
  });
});

// ---------------------------------------------------------------------------
// Ball OOB reset after SuctionZone places ball at last valid hit position
// ---------------------------------------------------------------------------

describe('Ball OOB reset after SuctionZone uses last valid hit position', () => {
  let world, group;

  beforeEach(() => {
    world = makeMockWorld();
    group = makeMockGroup();
  });

  it('OOB reset position is last valid hit position, not inside the suction zone', () => {
    // Suction zone at (10, 10) pulls ball toward it
    const zone = new SuctionZone(
      world,
      group,
      {
        position: new THREE.Vector3(10, 0, 10),
        radius: 5,
        force: 12
      },
      SURFACE_HEIGHT
    );

    // Ball starts near the suction zone boundary (within radius)
    const ball = makeMockBall(12, 10);
    const { hazardManager, mockEventManager } = makeHazardManager(ball);

    // The last valid hit position is where the player last shot from —
    // well away from the suction zone
    const lastHitX = -5;
    const lastHitZ = 3;
    hazardManager.lastSafePosition.x = lastHitX;
    hazardManager.lastSafePosition.y = SURFACE_HEIGHT;
    hazardManager.lastSafePosition.z = lastHitZ;

    // Suction zone pulls ball for several frames
    for (let i = 0; i < 10; i++) {
      zone.update(DT, ball);
    }
    expect(ball.applyForce).toHaveBeenCalled();

    // Simulate: suction + physics pushed ball out of bounds
    ball.position.x = 55; // past maxX=50
    ball.position.z = 10;

    // OOB detected
    const isOOB = hazardManager.checkHazards();
    expect(isOOB).toBe(true);

    // The OOB event uses lastSafePosition (the last hit position),
    // NOT the suction zone center or any position inside the zone
    const oobCall = mockEventManager.publish.mock.calls.find(
      call => call[0] === EventTypes.HAZARD_DETECTED && call[1]?.hazardType === 'outOfBounds'
    );
    expect(oobCall).toBeDefined();

    const resetPos = oobCall[1].lastSafePosition;
    expect(resetPos.x).toBe(lastHitX);
    expect(resetPos.z).toBe(lastHitZ);

    // Confirm the reset position is NOT inside the suction zone
    const dxToZone = resetPos.x - 10;
    const dzToZone = resetPos.z - 10;
    const distToZone = Math.sqrt(dxToZone * dxToZone + dzToZone * dzToZone);
    expect(distToZone).toBeGreaterThan(5); // outside suction radius of 5
  });

  it('lastSafePosition is not updated while ball is in OOB territory', () => {
    const zone = new SuctionZone(
      world,
      group,
      {
        position: new THREE.Vector3(0, 0, 0),
        radius: 5,
        force: 10
      },
      SURFACE_HEIGHT
    );

    const ball = makeMockBall(2, 0);
    const { hazardManager } = makeHazardManager(ball);

    // Set last safe position
    hazardManager.lastSafePosition.x = -3;
    hazardManager.lastSafePosition.y = SURFACE_HEIGHT;
    hazardManager.lastSafePosition.z = 2;

    // Ball gets pushed OOB
    ball.position.x = 55;

    // The OOB position should NOT be saved as safe
    hazardManager.updateLastSafePosition(ball.position);

    // Last safe position should remain unchanged (OOB position is in hazard)
    expect(hazardManager.lastSafePosition.x).toBe(-3);
    expect(hazardManager.lastSafePosition.z).toBe(2);
  });

  it('suction zone force is independent of OOB reset — force only applied while ball is in zone', () => {
    const zoneCenter = new THREE.Vector3(0, 0, 0);
    const zone = new SuctionZone(
      world,
      group,
      {
        position: zoneCenter,
        radius: 4,
        force: 8
      },
      SURFACE_HEIGHT
    );

    // Ball starts inside zone
    const ball = makeMockBall(2, 0);
    const { hazardManager, mockEventManager } = makeHazardManager(ball);

    hazardManager.lastSafePosition.x = -8;
    hazardManager.lastSafePosition.y = SURFACE_HEIGHT;
    hazardManager.lastSafePosition.z = -8;

    // Suction pulls the ball
    zone.update(DT, ball);
    expect(ball.applyForce).toHaveBeenCalledTimes(1);

    // Simulate ball going OOB
    ball.position.x = -55;
    ball.applyForce.mockClear();

    // OOB detected
    hazardManager.checkHazards();

    // Simulate ball reset to last safe position (game would do this)
    ball.position.x = -8;
    ball.position.z = -8;

    // After reset, ball is outside suction zone radius — no force applied
    zone.update(DT, ball);
    expect(ball.applyForce).not.toHaveBeenCalled();
  });
});
