/**
 * Integration test: aim input wall-reflection secondary line.
 * Verifies that InputController renders a reflected line segment when the aim
 * ray hits a wall body in the physics world.
 * ISSUE-010
 */

import { InputController } from '../../controls/InputController';

describe('Aim input wall reflection', () => {
  let inputController;
  let mockGame;
  let mockScene;
  let mockRaycastClosest;

  beforeEach(() => {
    // DOM stubs required by InputController constructor
    global.document.getElementById = jest.fn().mockReturnValue({
      style: { display: 'none', setProperty: jest.fn() }
    });

    mockScene = {
      add: jest.fn(),
      remove: jest.fn(),
      children: []
    };

    mockRaycastClosest = jest.fn((from, to, opts, result) => {
      result.hitPointWorld.x = 3;
      result.hitPointWorld.y = 0;
      result.hitPointWorld.z = 0;
      result.hitNormalWorld.x = -1;
      result.hitNormalWorld.y = 0;
      result.hitNormalWorld.z = 0;
      result.hasHit = true;
      return true;
    });

    mockGame = {
      debugManager: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      eventManager: {
        publish: jest.fn(),
        subscribe: jest.fn(() => () => {})
      },
      stateManager: {
        isBallInMotion: jest.fn(() => false),
        isHoleCompleted: jest.fn(() => false)
      },
      ballManager: {
        ball: {
          mesh: {
            position: { x: 0, y: 0, z: 0, clone: jest.fn(() => ({ x: 0, y: 0, z: 0 })) }
          },
          radius: 0.2,
          isStopped: jest.fn(() => true)
        },
        hitBall: jest.fn()
      },
      cameraController: { controls: { enabled: true }, panCameraOnEdge: jest.fn() },
      scene: mockScene,
      renderer: {
        domElement: {
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0, right: 800, bottom: 600 }))
        }
      },
      camera: { getWorldDirection: jest.fn() },
      physicsManager: {
        world: {
          raycastClosest: mockRaycastClosest
        }
      }
    };

    inputController = new InputController(mockGame);
  });

  afterEach(() => {
    if (inputController?.cleanup) {
      inputController.cleanup();
    }
  });

  test('renders a secondary line segment in scene when aim ray hits a wall', () => {
    const ballPos = { x: 0, y: 0, z: 0 };
    // Aim in +X direction where the mock wall is at x=3
    const dir = { x: 1, y: 0, z: 0 };

    inputController.updateAimLine(ballPos, dir, 0.7);

    expect(mockRaycastClosest).toHaveBeenCalled();
    expect(inputController._wallReflectionLine).not.toBeNull();
    expect(mockScene.add).toHaveBeenCalledWith(inputController._wallReflectionLine);
  });

  test('wall reflection line is removed when removeDirectionLine is called', () => {
    const ballPos = { x: 0, y: 0, z: 0 };
    const dir = { x: 1, y: 0, z: 0 };

    inputController.updateAimLine(ballPos, dir, 0.7);
    expect(inputController._wallReflectionLine).not.toBeNull();

    inputController.removeDirectionLine();

    expect(inputController._wallReflectionLine).toBeNull();
    expect(mockScene.remove).toHaveBeenCalled();
  });

  test('no secondary line when raycast misses (raycastClosest returns false)', () => {
    mockRaycastClosest.mockImplementation(() => false);

    const ballPos = { x: 0, y: 0, z: 0 };
    const dir = { x: 1, y: 0, z: 0 };

    inputController.updateAimLine(ballPos, dir, 0.7);

    expect(inputController._wallReflectionLine).toBeNull();
  });

  test('no secondary line when physicsManager.world is absent', () => {
    mockGame.physicsManager = null;

    const ballPos = { x: 0, y: 0, z: 0 };
    const dir = { x: 1, y: 0, z: 0 };

    expect(() => inputController.updateAimLine(ballPos, dir, 0.5)).not.toThrow();
    expect(inputController._wallReflectionLine).toBeNull();
  });

  test('trajectory dots created alongside the reflection line', () => {
    const ballPos = { x: 0, y: 0, z: 0 };
    const dir = { x: 1, y: 0, z: 0 };

    inputController.updateAimLine(ballPos, dir, 0.7);

    expect(inputController._trajectoryDots.length).toBe(12);
    expect(inputController._wallReflectionLine).not.toBeNull();
  });
});
