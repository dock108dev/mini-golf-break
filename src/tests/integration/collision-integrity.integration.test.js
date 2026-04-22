/**
 * Collision integrity integration tests.
 * Uses real cannon-es (bypassing the jest mock) to verify physics-level guarantees:
 *   1. Ball velocity X sign flips after hitting a wall perpendicular to X.
 *   2. Ball never exits the course AABB after 200 physics steps.
 *
 * ISSUE-006
 */

// Obtain real cannon-es bypassing the mock that jest.setup.js installs.
// This is intentional: these tests validate actual physics simulation.
const C = jest.requireActual('cannon-es');

function makeWorld({ gravity = [0, 0, 0] } = {}) {
  const world = new C.World();
  world.gravity.set(...gravity);
  world.broadphase = new C.NaiveBroadphase();
  world.allowSleep = false;
  return world;
}

function makeBall(world, { pos = [0, 0, 0], vel = [0, 0, 0], radius = 0.2 } = {}) {
  const body = new C.Body({ mass: 1, linearDamping: 0, angularDamping: 0 });
  body.addShape(new C.Sphere(radius));
  body.position.set(...pos);
  body.velocity.set(...vel);
  body.allowSleep = false;
  world.addBody(body);
  return body;
}

function makeStaticBox(world, { pos = [0, 0, 0], half = [1, 1, 1] } = {}) {
  const body = new C.Body({ mass: 0 });
  body.addShape(new C.Box(new C.Vec3(...half)));
  body.position.set(...pos);
  world.addBody(body);
  return body;
}

// ─── Utility: step world for up to maxSteps or until predicate returns true ──
function stepUntil(world, predicate, { maxSteps = 300, dt = 1 / 60 } = {}) {
  for (let i = 0; i < maxSteps; i++) {
    world.step(dt);
    if (predicate(i)) {
      return true;
    }
  }
  return false;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Collision integrity — physics integration (real cannon-es)', () => {
  describe('ball-wall 45-degree reflection', () => {
    test('velocity X component flips sign after ball hits flat wall; reflected speed within 10%', () => {
      const world = makeWorld();

      // Perfectly elastic contact between ball and wall
      const ballMat = new C.Material('ball');
      const wallMat = new C.Material('wall');
      world.addContactMaterial(
        new C.ContactMaterial(ballMat, wallMat, { restitution: 1.0, friction: 0 })
      );

      // Ball at origin moving diagonally +X / -Z (45°)
      const speed = 5;
      const ball = makeBall(world, { pos: [0, 0, 0], vel: [speed, 0, -speed] });
      ball.material = ballMat;

      // Static wall: thin slab perpendicular to X, positioned at x = 4
      const wall = makeStaticBox(world, { pos: [4, 0, 0], half: [0.1, 5, 10] });
      wall.material = wallMat;

      const initialVxAbs = speed;

      // Run until X velocity flips negative (ball has bounced)
      const bounced = stepUntil(world, () => ball.velocity.x < -0.1);

      expect(bounced).toBe(true);

      // X velocity must be negative (flipped)
      expect(ball.velocity.x).toBeLessThan(0);

      // Reflected X speed must be within 10% of initial (elastic collision)
      expect(Math.abs(ball.velocity.x)).toBeGreaterThan(initialVxAbs * 0.9);
    });

    test('Z velocity component is unchanged (wall normal is X-axis)', () => {
      const world = makeWorld();

      const ballMat = new C.Material('ball');
      const wallMat = new C.Material('wall');
      world.addContactMaterial(
        new C.ContactMaterial(ballMat, wallMat, { restitution: 1.0, friction: 0 })
      );

      const ball = makeBall(world, { pos: [0, 0, 0], vel: [5, 0, -3] });
      ball.material = ballMat;
      const wall = makeStaticBox(world, { pos: [4, 0, 0], half: [0.1, 5, 10] });
      wall.material = wallMat;

      const initialVz = -3;

      stepUntil(world, () => ball.velocity.x < -0.1);

      // Z velocity should still be negative (same direction, not reflected by X-normal wall)
      expect(ball.velocity.z).toBeLessThan(0);
      // Z speed should be within 10% of initial
      expect(Math.abs(ball.velocity.z)).toBeGreaterThan(Math.abs(initialVz) * 0.9);
    });
  });

  describe('ball stays within course AABB after 200 physics steps', () => {
    test('ball with initial velocity never exits walled rectangular boundary', () => {
      const world = makeWorld({ gravity: [0, -9.8, 0] });

      const HALF = 5;

      // Ball starts at centre, moving in +X
      const ball = makeBall(world, {
        pos: [0, 1, 0],
        vel: [5, 0, 2],
        radius: 0.2
      });
      // Slight linear damping so ball slows realistically
      ball.linearDamping = 0.3;
      ball.angularDamping = 0.3;

      // Floor (Plane, rotated to face up)
      const floor = new C.Body({ mass: 0 });
      floor.addShape(new C.Plane());
      floor.quaternion.setFromAxisAngle(new C.Vec3(1, 0, 0), -Math.PI / 2);
      world.addBody(floor);

      // Four walls forming a closed boundary ±HALF units in X and Z
      const wallDefs = [
        { pos: [HALF, 1, 0], half: [0.1, 3, HALF + 0.5] }, // +X wall
        { pos: [-HALF, 1, 0], half: [0.1, 3, HALF + 0.5] }, // -X wall
        { pos: [0, 1, HALF], half: [HALF + 0.5, 3, 0.1] }, // +Z wall
        { pos: [0, 1, -HALF], half: [HALF + 0.5, 3, 0.1] } // -Z wall
      ];
      wallDefs.forEach(({ pos, half }) => makeStaticBox(world, { pos, half }));

      // Run 200 physics steps (≈ 3.3 s)
      const dt = 1 / 60;
      for (let i = 0; i < 200; i++) {
        world.step(dt);
      }

      const { x, y, z } = ball.position;

      // Ball must remain inside the AABB (allow 0.3 units physics-penetration tolerance)
      expect(Math.abs(x)).toBeLessThanOrEqual(HALF + 0.3);
      expect(Math.abs(z)).toBeLessThanOrEqual(HALF + 0.3);
      // Ball must not have fallen through the floor
      expect(y).toBeGreaterThanOrEqual(-0.5);
    });

    test('ball starting at AABB edge does not escape after 200 steps', () => {
      const world = makeWorld({ gravity: [0, 0, 0] });

      const HALF = 4;

      // Ball placed near the +X wall, pushed toward it
      const ball = makeBall(world, { pos: [HALF - 0.5, 0, 0], vel: [3, 0, 1] });

      // One-sided enclosure: only a +X wall
      makeStaticBox(world, { pos: [HALF, 0, 0], half: [0.1, 5, 10] });

      const dt = 1 / 60;
      for (let i = 0; i < 200; i++) {
        world.step(dt);
      }

      // Ball must not have passed through the wall
      expect(ball.position.x).toBeLessThanOrEqual(HALF + 0.3);
    });
  });
});
