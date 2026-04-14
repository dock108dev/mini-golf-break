jest.mock('cannon-es', () => {
  class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }

  class Cylinder {
    constructor(radiusTop, radiusBottom, height, numSegments) {
      this.radiusTop = radiusTop;
      this.radiusBottom = radiusBottom;
      this.height = height;
      this.numSegments = numSegments;
    }
  }

  class Box {
    constructor(halfExtents) {
      this.halfExtents = halfExtents;
    }
  }

  return {
    Vec3,
    Cylinder,
    Box,
    World: jest.fn(),
    Body: jest.fn(),
    Sphere: jest.fn(),
    Material: jest.fn(),
    ContactMaterial: jest.fn(),
    SAPBroadphase: jest.fn(),
    NaiveBroadphase: jest.fn(),
    Plane: jest.fn()
  };
});

import * as CANNON from 'cannon-es';
import {
  resetBodyVelocity,
  checkBunkerOverlap,
  checkWaterOverlap
} from '../../objects/BallPhysicsHelper';

function makeBody(pos = { x: 0, y: 0, z: 0 }) {
  return {
    position: pos,
    velocity: new CANNON.Vec3(0, 0, 0),
    angularVelocity: new CANNON.Vec3(0, 0, 0),
    force: new CANNON.Vec3(0, 0, 0),
    torque: new CANNON.Vec3(0, 0, 0),
    wakeUp: jest.fn()
  };
}

function makeCylinderTrigger(pos, radius) {
  return {
    position: pos,
    shapes: [new CANNON.Cylinder(radius, radius, 1, 8)]
  };
}

function makeBoxTrigger(pos, halfExtents) {
  return {
    position: pos,
    shapes: [new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z))]
  };
}

describe('BallPhysicsHelper', () => {
  describe('resetBodyVelocity', () => {
    it('zeros all vector properties and calls wakeUp', () => {
      const body = makeBody();
      body.velocity.set(5, 3, 1);
      body.angularVelocity.set(2, 2, 2);
      body.force.set(1, 1, 1);
      body.torque.set(3, 3, 3);

      resetBodyVelocity(body);

      expect(body.velocity.x).toBe(0);
      expect(body.velocity.y).toBe(0);
      expect(body.velocity.z).toBe(0);
      expect(body.angularVelocity.x).toBe(0);
      expect(body.angularVelocity.y).toBe(0);
      expect(body.angularVelocity.z).toBe(0);
      expect(body.force.x).toBe(0);
      expect(body.force.y).toBe(0);
      expect(body.force.z).toBe(0);
      expect(body.torque.x).toBe(0);
      expect(body.torque.y).toBe(0);
      expect(body.torque.z).toBe(0);
      expect(body.wakeUp).toHaveBeenCalled();
    });

    it('does not throw when body is null', () => {
      expect(() => resetBodyVelocity(null)).not.toThrow();
    });

    it('does not throw when body is undefined', () => {
      expect(() => resetBodyVelocity(undefined)).not.toThrow();
    });

    it('does not throw when body is missing some vector properties', () => {
      const partialBody = {
        velocity: new CANNON.Vec3(1, 2, 3),
        angularVelocity: new CANNON.Vec3(1, 2, 3)
      };

      expect(() => resetBodyVelocity(partialBody)).not.toThrow();
      expect(partialBody.velocity.x).toBe(0);
      expect(partialBody.angularVelocity.x).toBe(0);
    });
  });

  describe('checkBunkerOverlap', () => {
    it('returns true when ball is inside cylinder trigger radius', () => {
      const ballBody = makeBody({ x: 1, y: 0, z: 1 });
      const trigger = makeCylinderTrigger({ x: 1, y: 0, z: 1 }, 3);

      expect(checkBunkerOverlap(ballBody, [trigger], 0.05)).toBe(true);
    });

    it('returns false when ball is outside cylinder trigger radius', () => {
      const ballBody = makeBody({ x: 10, y: 0, z: 10 });
      const trigger = makeCylinderTrigger({ x: 0, y: 0, z: 0 }, 1);

      expect(checkBunkerOverlap(ballBody, [trigger], 0.05)).toBe(false);
    });

    it('returns true when ball is inside box trigger half-extents', () => {
      const ballBody = makeBody({ x: 1, y: 0, z: 1 });
      const trigger = makeBoxTrigger({ x: 0, y: 0, z: 0 }, { x: 3, y: 1, z: 3 });

      expect(checkBunkerOverlap(ballBody, [trigger], 0.05)).toBe(true);
    });

    it('returns false when ball is outside box trigger half-extents', () => {
      const ballBody = makeBody({ x: 10, y: 0, z: 10 });
      const trigger = makeBoxTrigger({ x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 2 });

      expect(checkBunkerOverlap(ballBody, [trigger], 0.05)).toBe(false);
    });

    it('skips triggers with empty shapes array without throwing', () => {
      const ballBody = makeBody({ x: 0, y: 0, z: 0 });
      const emptyTrigger = { position: { x: 0, y: 0, z: 0 }, shapes: [] };

      expect(() => checkBunkerOverlap(ballBody, [emptyTrigger], 0.05)).not.toThrow();
      expect(checkBunkerOverlap(ballBody, [emptyTrigger], 0.05)).toBe(false);
    });

    it('returns false for empty trigger array', () => {
      const ballBody = makeBody({ x: 0, y: 0, z: 0 });

      expect(checkBunkerOverlap(ballBody, [], 0.05)).toBe(false);
    });
  });

  describe('checkWaterOverlap', () => {
    it('returns trigger when ball overlap exceeds threshold for cylinder shape', () => {
      const ballBody = makeBody({ x: 0, y: 0, z: 0 });
      const trigger = makeCylinderTrigger({ x: 0, y: 0, z: 0 }, 5);

      const result = checkWaterOverlap(ballBody, [trigger], 0.05, 0.35);

      expect(result).toBe(trigger);
    });

    it('returns null when overlap is below threshold for cylinder shape', () => {
      const ballRadius = 0.05;
      const radius = 5;
      const distFromCenter = radius - ballRadius * 2 * 0.1;
      const ballBody = makeBody({ x: distFromCenter, y: 0, z: 0 });
      const trigger = makeCylinderTrigger({ x: 0, y: 0, z: 0 }, radius);

      const result = checkWaterOverlap(ballBody, [trigger], ballRadius, 0.99);

      expect(result).toBeNull();
    });

    it('returns trigger when ball is inside effective box half-extents', () => {
      const ballBody = makeBody({ x: 0, y: 0, z: 0 });
      const trigger = makeBoxTrigger({ x: 0, y: 0, z: 0 }, { x: 3, y: 1, z: 3 });

      const result = checkWaterOverlap(ballBody, [trigger], 0.05, 0.35);

      expect(result).toBe(trigger);
    });

    it('returns null when ball is outside effective box half-extents', () => {
      const ballBody = makeBody({ x: 20, y: 0, z: 20 });
      const trigger = makeBoxTrigger({ x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 2 });

      const result = checkWaterOverlap(ballBody, [trigger], 0.05, 0.35);

      expect(result).toBeNull();
    });

    it('applies default threshold of 0.35 when argument is omitted', () => {
      const ballBody = makeBody({ x: 0, y: 0, z: 0 });
      const trigger = makeCylinderTrigger({ x: 0, y: 0, z: 0 }, 5);

      const result = checkWaterOverlap(ballBody, [trigger], 0.05);

      expect(result).toBe(trigger);
    });

    it('returns null for empty waterTriggers array', () => {
      const ballBody = makeBody({ x: 0, y: 0, z: 0 });

      const result = checkWaterOverlap(ballBody, [], 0.05, 0.35);

      expect(result).toBeNull();
    });
  });
});
