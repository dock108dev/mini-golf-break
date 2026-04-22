export const PhysicsConstants = {
  ball: {
    mass: 0.045,
    linearDamping: 0.4,
    angularDamping: 0.65,
    sleepSpeedLimit: 0.1,
    sleepTimeLimit: 1.0
  },
  world: {
    allowSleep: true,
    sleepSpeedLimit: 0.1,
    sleepTimeLimit: 1.0
  },
  contact: {
    floorFriction: 0.5,
    floorRestitution: 0.35,
    wallFriction: 0.35,
    wallRestitution: 0.58
  }
};
