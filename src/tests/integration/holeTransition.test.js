/**
 * Integration tests for hole transition flow — destroy, construct, reposition, play.
 * ISSUE-038
 *
 * Tests the full hole transition lifecycle through HoleTransitionManager:
 * destroying the current hole, constructing the next one, repositioning the ball,
 * and returning control to the player.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EventTypes } from '../../events/EventTypes';
import { GameState } from '../../states/GameState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePhysicsWorld() {
  const world = new CANNON.World();
  world.gravity = { x: 0, y: -9.82, z: 0, set: jest.fn() };
  return world;
}

function makeMockScene() {
  const children = [];
  return {
    children,
    add: jest.fn(function (obj) {
      if (obj && !children.includes(obj)) {
        children.push(obj);
      }
    }),
    remove: jest.fn(function (obj) {
      const idx = children.indexOf(obj);
      if (idx > -1) {
        children.splice(idx, 1);
      }
    }),
    traverse: jest.fn(function (cb) {
      children.forEach(child => cb(child));
    }),
    clear: jest.fn(function () {
      children.length = 0;
    })
  };
}

function makeHoleConfig(index, startX = 0, startZ = 0, holeX = 0, holeZ = 5) {
  return {
    index,
    description: `${index + 1}. Test Hole`,
    par: 3,
    startPosition: new THREE.Vector3(startX, 0.2, startZ),
    holePosition: new THREE.Vector3(holeX, 0.2, holeZ),
    boundaryShape: [
      new THREE.Vector3(-3, 0, -1),
      new THREE.Vector3(3, 0, -1),
      new THREE.Vector3(3, 0, 8),
      new THREE.Vector3(-3, 0, 8)
    ],
    hazards: [],
    bumpers: [],
    mechanics: [],
    heroProps: [],
    theme: {}
  };
}

function makeMockMechanic(type = 'test_mechanic') {
  return {
    type,
    timerElapsed: 0,
    isVisible: true,
    meshes: [],
    bodies: [],
    update: jest.fn(function (dt) {
      this.timerElapsed += dt;
    }),
    destroy: jest.fn(function () {
      this.meshes = [];
      this.bodies = [];
    }),
    onDtSpike: jest.fn()
  };
}

function makeMockHoleEntity(config, world, group) {
  const meshes = [];
  const bodies = [];

  for (let i = 0; i < 3; i++) {
    meshes.push({
      type: 'Mesh',
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    });
  }
  for (let i = 0; i < 2; i++) {
    const body = new CANNON.Body();
    body.userData = { type: `hole_${config.index}_body_${i}` };
    bodies.push(body);
    world.addBody(body);
  }

  const mechanics = [makeMockMechanic('timed_gate'), makeMockMechanic('moving_sweeper')];

  return {
    config,
    group,
    meshes,
    bodies,
    mechanics,
    audioManager: null,
    init: jest.fn(),
    update: jest.fn(function (dt, ballBody) {
      mechanics.forEach(m => m.update(dt, ballBody));
    }),
    destroy: jest.fn(function () {
      meshes.forEach(m => {
        if (group.remove) {
          group.remove(m);
        }
      });
      bodies.forEach(b => world.removeBody(b));
      mechanics.forEach(m => m.destroy());
      meshes.length = 0;
      bodies.length = 0;
    })
  };
}

function makeMockCourse(scene, world, holeConfigs) {
  const holeGroups = holeConfigs.map((cfg, i) => {
    const g = new THREE.Group();
    g.name = `OD_Hole_${i + 1}_Group`;
    g.userData = { holeIndex: i };
    g.visible = false;
    scene.add(g);
    return g;
  });

  const currentHoleIndex = -1;
  const currentHoleEntity = null;

  const course = {
    totalHoles: holeConfigs.length,
    holeConfigs,
    holeGroups,
    currentHoleIndex,
    currentHoleEntity,
    currentHole: null,
    startPosition: null,

    getTotalHoles: jest.fn(() => holeConfigs.length),
    getHolePar: jest.fn(() => holeConfigs[course.currentHoleIndex]?.par || 3),
    getHolePosition: jest.fn(() => holeConfigs[course.currentHoleIndex]?.holePosition || null),
    getHoleStartPosition: jest.fn(
      () => holeConfigs[course.currentHoleIndex]?.startPosition || null
    ),
    getCurrentHoleConfig: jest.fn(() => holeConfigs[course.currentHoleIndex] || null),
    getCurrentHoleMesh: jest.fn(() => null),
    hasNextHole: jest.fn(() => course.currentHoleIndex < holeConfigs.length - 1),

    clearCurrentHole: jest.fn(function () {
      if (course.currentHoleEntity) {
        course.currentHoleEntity.destroy();
        course.currentHoleEntity = null;
        course.currentHole = null;
      }
      if (course.currentHoleIndex >= 0 && course.currentHoleIndex < holeGroups.length) {
        holeGroups[course.currentHoleIndex].visible = false;
      }
      return Promise.resolve();
    }),

    createCourse: jest.fn(async function (targetHoleNumber) {
      if (targetHoleNumber < 1 || targetHoleNumber > holeConfigs.length) {
        return false;
      }
      await course.clearCurrentHole();
      const holeIndex = targetHoleNumber - 1;
      const holeGroup = holeGroups[holeIndex];
      const holeConfig = holeConfigs[holeIndex];

      course.currentHoleEntity = makeMockHoleEntity(holeConfig, world, holeGroup);
      course.currentHole = course.currentHoleEntity;
      course.currentHoleIndex = holeIndex;
      course.startPosition = holeConfig.startPosition.clone();
      holeGroup.visible = true;

      await course.currentHoleEntity.init();
      return true;
    }),

    cleanup: jest.fn()
  };

  return course;
}

function makeEventManager() {
  const subscribers = {};
  return {
    subscribe: jest.fn(function (eventType, callback, context) {
      if (!subscribers[eventType]) {
        subscribers[eventType] = [];
      }
      const bound = context ? callback.bind(context) : callback;
      subscribers[eventType].push(bound);
      return () => {
        const idx = subscribers[eventType].indexOf(bound);
        if (idx > -1) {
          subscribers[eventType].splice(idx, 1);
        }
      };
    }),
    publish: jest.fn(function (eventType, data) {
      const handlers = subscribers[eventType] || [];
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`Event handler error for ${eventType}:`, err);
        }
      });
    }),
    _subscribers: subscribers
  };
}

function makeMockBall(startPosition) {
  const body = new CANNON.Body();
  body.position.x = startPosition.x;
  body.position.y = startPosition.y + 0.15;
  body.position.z = startPosition.z;
  return {
    mesh: {
      position: {
        x: startPosition.x,
        y: startPosition.y + 0.15,
        z: startPosition.z,
        copy: jest.fn(function (other) {
          this.x = other.x;
          this.y = other.y;
          this.z = other.z;
        }),
        clone: jest.fn(function () {
          return { x: this.x, y: this.y, z: this.z };
        }),
        distanceTo: jest.fn(() => 5)
      },
      geometry: { dispose: jest.fn() },
      material: { dispose: jest.fn() }
    },
    body,
    ballLight: { position: { copy: jest.fn() } },
    setPosition: jest.fn(function (x, y, z) {
      this.mesh.position.x = x;
      this.mesh.position.y = y;
      this.mesh.position.z = z;
      this.body.position.set(x, y, z);
    }),
    resetVelocity: jest.fn(function () {
      this.body.velocity.set(0, 0, 0);
    }),
    currentHolePosition: null,
    handleHoleSuccess: jest.fn(),
    isMoving: false,
    cleanup: jest.fn(),
    update: jest.fn()
  };
}

function makeGame(scene, world, course) {
  const eventManager = makeEventManager();

  const game = {
    scene,
    eventManager,
    course,
    physicsManager: {
      world: { world },
      getWorld: jest.fn(() => ({ world, addBody: world.addBody, removeBody: world.removeBody })),
      resetWorld: jest.fn(async () => {
        world.bodies.forEach(b => world.removeBody(b));
        return { world };
      }),
      removeBody: jest.fn(body => world.removeBody(body)),
      defaultMaterial: {},
      ballMaterial: {},
      groundMaterial: {},
      wallMaterial: {},
      sandMaterial: {}
    },
    stateManager: {
      state: {
        currentHoleNumber: 1,
        holeCompleted: false,
        ballInMotion: false,
        debugMode: false
      },
      getCurrentHoleNumber: jest.fn(function () {
        return game.stateManager.state.currentHoleNumber;
      }),
      setGameState: jest.fn(),
      getGameState: jest.fn(() => GameState.PLAYING),
      isHoleCompleted: jest.fn(function () {
        return game.stateManager.state.holeCompleted;
      }),
      setHoleCompleted: jest.fn(function (val) {
        game.stateManager.state.holeCompleted = val;
      }),
      setBallInMotion: jest.fn(),
      isBallInMotion: jest.fn(() => false),
      resetForNextHole: jest.fn(function () {
        if (game.stateManager.state.currentHoleNumber < course.getTotalHoles()) {
          game.stateManager.state.currentHoleNumber++;
        }
        game.stateManager.state.holeCompleted = false;
        game.stateManager.state.ballInMotion = false;
        if (game.scoringSystem) {
          game.scoringSystem.completeHole();
          game.scoringSystem.resetCurrentStrokes();
        }
        game.eventManager.publish(EventTypes.HOLE_STARTED, {
          holeNumber: game.stateManager.state.currentHoleNumber
        });
      }),
      resetState: jest.fn()
    },
    ballManager: {
      ball: null,
      createBall: jest.fn(function (startPosition) {
        game.ballManager.ball = makeMockBall(startPosition);
        scene.add(game.ballManager.ball.mesh);
        world.addBody(game.ballManager.ball.body);
        return game.ballManager.ball;
      }),
      removeBall: jest.fn(function () {
        if (game.ballManager.ball) {
          scene.remove(game.ballManager.ball.mesh);
          world.removeBody(game.ballManager.ball.body);
          game.ballManager.ball = null;
        }
      }),
      resetBallPosition: jest.fn(),
      resetBall: jest.fn()
    },
    uiManager: {
      updateHoleInfo: jest.fn(),
      showMessage: jest.fn(),
      updateScore: jest.fn(),
      updateStrokes: jest.fn(),
      showTransitionOverlay: jest.fn(),
      hideTransitionOverlay: jest.fn()
    },
    audioManager: {
      playSound: jest.fn()
    },
    debugManager: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      enabled: false
    },
    cameraController: {
      positionCameraForHole: jest.fn(),
      setBall: jest.fn(),
      updateCameraForHole: jest.fn()
    },
    inputController: {
      enableInput: jest.fn(),
      disableInput: jest.fn()
    },
    holeCompletionManager: {
      resetGracePeriod: jest.fn()
    },
    scoringSystem: {
      getTotalStrokes: jest.fn(() => 0),
      addStroke: jest.fn(),
      completeHole: jest.fn(),
      resetCurrentStrokes: jest.fn()
    },
    createStarfield: jest.fn(),
    cannonDebugRenderer: null,
    updateLightingForTheme: jest.fn(),
    spaceDecorations: {
      setThemeVariant: jest.fn()
    }
  };

  return game;
}

// ---------------------------------------------------------------------------
// Inline HoleTransitionManager logic for integration testing
// We import the real class to test the actual transition pipeline.
// ---------------------------------------------------------------------------
import { HoleTransitionManager } from '../../managers/HoleTransitionManager';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Hole Transition Flow — Integration Tests', () => {
  let scene, world, holeConfigs, course, game, transitionManager;

  beforeEach(async () => {
    global.requestAnimationFrame = cb => setTimeout(cb, 0);
    scene = makeMockScene();
    world = makePhysicsWorld();
    holeConfigs = [];
    for (let i = 0; i < 18; i++) {
      holeConfigs.push(makeHoleConfig(i, i * 10, 0, i * 10, 5));
    }
    course = makeMockCourse(scene, world, holeConfigs);

    await course.createCourse(1);

    game = makeGame(scene, world, course);
    game.ballManager.createBall(holeConfigs[0].startPosition);

    transitionManager = new HoleTransitionManager(game);
    transitionManager.init();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Scenario 1: Normal advance (hole N → hole N+1)
  // =========================================================================
  describe('Normal advance (hole N → hole N+1)', () => {
    it('removes all Three.js objects from hole N after transition', async () => {
      const hole1Entity = course.currentHoleEntity;
      expect(hole1Entity).toBeTruthy();

      const result = await transitionManager.transitionToNextHole();

      expect(result).toBe(true);
      expect(hole1Entity.destroy).toHaveBeenCalled();
      expect(hole1Entity.meshes).toHaveLength(0);
    });

    it('removes all Cannon-es physics bodies from hole N after transition', async () => {
      const hole1Bodies = [...course.currentHoleEntity.bodies];
      expect(hole1Bodies.length).toBeGreaterThan(0);

      await transitionManager.transitionToNextHole();

      hole1Bodies.forEach(body => {
        expect(world.bodies).not.toContain(body);
      });
    });

    it('constructs hole N+1 and adds objects to scene', async () => {
      await transitionManager.transitionToNextHole();

      expect(course.createCourse).toHaveBeenCalledWith(2);
      expect(course.currentHoleEntity).toBeTruthy();
      expect(course.currentHoleEntity.init).toHaveBeenCalled();
      expect(course.currentHoleIndex).toBe(1);
    });

    it('ball spawn position matches hole N+1 startPosition', async () => {
      await transitionManager.transitionToNextHole();

      expect(game.ballManager.createBall).toHaveBeenCalled();
      const callArg =
        game.ballManager.createBall.mock.calls[
          game.ballManager.createBall.mock.calls.length - 1
        ][0];
      const expectedStart = holeConfigs[1].startPosition;
      expect(callArg.x).toBeCloseTo(expectedStart.x, 2);
      expect(callArg.z).toBeCloseTo(expectedStart.z, 2);
    });

    it('shot count resets to 0 for hole N+1', async () => {
      await transitionManager.transitionToNextHole();

      expect(game.stateManager.resetForNextHole).toHaveBeenCalled();
      expect(game.scoringSystem.completeHole).toHaveBeenCalled();
      expect(game.scoringSystem.resetCurrentStrokes).toHaveBeenCalled();
    });

    it('input is re-enabled after transition', async () => {
      await transitionManager.transitionToNextHole();

      expect(game.inputController.enableInput).toHaveBeenCalled();
    });

    it('grace period is reset for hole completion detection', async () => {
      await transitionManager.transitionToNextHole();

      expect(game.holeCompletionManager.resetGracePeriod).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Scenario 2: Final hole advance (hole 18 → course complete)
  // =========================================================================
  describe('Final hole advance (last hole → course complete)', () => {
    it('triggers course-complete event instead of loading next hole', async () => {
      game.stateManager.state.currentHoleNumber = 18;

      const result = await transitionManager.transitionToNextHole();

      expect(result).toBe(false);
      expect(game.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.GAME_COMPLETED,
        expect.objectContaining({ timestamp: expect.any(Number) }),
        transitionManager
      );
    });

    it('does not attempt to load hole 19', async () => {
      game.stateManager.state.currentHoleNumber = 18;
      course.createCourse.mockClear();

      await transitionManager.transitionToNextHole();

      expect(course.createCourse).not.toHaveBeenCalled();
    });

    it('does not throw errors when at last hole', async () => {
      game.stateManager.state.currentHoleNumber = 18;

      await expect(transitionManager.transitionToNextHole()).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // Scenario 3: Hole retry (same hole, ball reset)
  // =========================================================================
  describe('Hole retry (same hole reset)', () => {
    it('reconstructs hole with same config after clearCurrentHole + createCourse', async () => {
      const originalIndex = course.currentHoleIndex;
      const originalConfig = holeConfigs[originalIndex];

      await course.clearCurrentHole();
      await course.createCourse(originalIndex + 1);

      expect(course.currentHoleIndex).toBe(originalIndex);
      expect(course.currentHoleEntity).toBeTruthy();
      expect(course.currentHoleEntity.config).toBe(originalConfig);
    });

    it('ball repositions to startPosition on retry', async () => {
      const startPos = holeConfigs[0].startPosition;

      await course.clearCurrentHole();
      await course.createCourse(1);

      game.ballManager.createBall(startPos);
      const ball = game.ballManager.ball;

      expect(ball.mesh.position.x).toBeCloseTo(startPos.x, 2);
      expect(ball.mesh.position.z).toBeCloseTo(startPos.z, 2);
    });

    it('mechanics reset to initial state after retry', async () => {
      const holeEntity = course.currentHoleEntity;
      const mechanic = holeEntity.mechanics[0];

      mechanic.update(1.0);
      expect(mechanic.timerElapsed).toBeGreaterThan(0);

      await course.clearCurrentHole();
      await course.createCourse(1);

      const newMechanics = course.currentHoleEntity.mechanics;
      newMechanics.forEach(m => {
        expect(m.timerElapsed).toBe(0);
      });
    });

    it('mechanic visibility resets on retry', async () => {
      const holeEntity = course.currentHoleEntity;
      holeEntity.mechanics[1].isVisible = false;

      await course.clearCurrentHole();
      await course.createCourse(1);

      course.currentHoleEntity.mechanics.forEach(m => {
        expect(m.isVisible).toBe(true);
      });
    });
  });

  // =========================================================================
  // Scenario 4: Resource leak detection
  // =========================================================================
  describe('Resource leak detection', () => {
    it('scene.children count does not grow after 3 sequential transitions', async () => {
      await transitionManager.transitionToNextHole();
      const baselineSceneCount = scene.children.length;

      game.stateManager.state.currentHoleNumber = 2;
      await transitionManager.transitionToNextHole();
      game.stateManager.state.currentHoleNumber = 3;
      await transitionManager.transitionToNextHole();

      expect(scene.children.length).toBeLessThanOrEqual(baselineSceneCount);
    });

    it('physicsWorld.bodies count does not grow after 3 sequential transitions', async () => {
      await transitionManager.transitionToNextHole();
      const baselineBodyCount = world.bodies.length;

      game.stateManager.state.currentHoleNumber = 2;
      await transitionManager.transitionToNextHole();
      game.stateManager.state.currentHoleNumber = 3;
      await transitionManager.transitionToNextHole();

      expect(world.bodies.length).toBeLessThanOrEqual(baselineBodyCount);
    });

    it('old hole entities are properly destroyed across transitions', async () => {
      const destroyedEntities = [];

      for (let i = 0; i < 3; i++) {
        const entity = course.currentHoleEntity;
        if (entity) {
          destroyedEntities.push(entity);
        }
        game.stateManager.state.currentHoleNumber = i + 1;
        await transitionManager.transitionToNextHole();
      }

      destroyedEntities.forEach(entity => {
        expect(entity.destroy).toHaveBeenCalled();
        expect(entity.meshes).toHaveLength(0);
        expect(entity.bodies).toHaveLength(0);
      });
    });

    it('ball is removed and recreated each transition without accumulation', async () => {
      const ballBodiesSeen = new Set();

      for (let i = 0; i < 3; i++) {
        game.stateManager.state.currentHoleNumber = i + 1;
        await transitionManager.transitionToNextHole();

        if (game.ballManager.ball) {
          ballBodiesSeen.add(game.ballManager.ball.body);
        }
      }

      const ballBodiesInWorld = world.bodies.filter(b => ballBodiesSeen.has(b));
      expect(ballBodiesInWorld.length).toBeLessThanOrEqual(1);
    });
  });
});
