import { PhysicsConstants } from '../../physics/PhysicsConstants';

describe('PhysicsConstants', () => {
  describe('ball', () => {
    test('mass is 0.045 kg (golf ball spec)', () => {
      expect(PhysicsConstants.ball.mass).toBe(0.045);
    });

    test('linearDamping is 0.4', () => {
      expect(PhysicsConstants.ball.linearDamping).toBe(0.4);
    });

    test('angularDamping is 0.65', () => {
      expect(PhysicsConstants.ball.angularDamping).toBe(0.65);
    });

    test('sleepSpeedLimit is 0.1', () => {
      expect(PhysicsConstants.ball.sleepSpeedLimit).toBe(0.1);
    });

    test('sleepTimeLimit is 1.0', () => {
      expect(PhysicsConstants.ball.sleepTimeLimit).toBe(1.0);
    });
  });

  describe('world', () => {
    test('allowSleep is true', () => {
      expect(PhysicsConstants.world.allowSleep).toBe(true);
    });

    test('sleepSpeedLimit is 0.1', () => {
      expect(PhysicsConstants.world.sleepSpeedLimit).toBe(0.1);
    });

    test('sleepTimeLimit is 1.0', () => {
      expect(PhysicsConstants.world.sleepTimeLimit).toBe(1.0);
    });
  });

  describe('contact', () => {
    test('floorFriction is 0.5', () => {
      expect(PhysicsConstants.contact.floorFriction).toBe(0.5);
    });

    test('floorRestitution is 0.35', () => {
      expect(PhysicsConstants.contact.floorRestitution).toBe(0.35);
    });

    test('wallFriction is 0.35', () => {
      expect(PhysicsConstants.contact.wallFriction).toBe(0.35);
    });

    test('wallRestitution is 0.58', () => {
      expect(PhysicsConstants.contact.wallRestitution).toBe(0.58);
    });
  });
});
