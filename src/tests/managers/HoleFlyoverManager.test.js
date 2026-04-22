/**
 * Unit tests for HoleFlyoverManager
 *
 * Acceptance criteria covered:
 *  - CatmullRomCurve3 has 4 control points; getPoint(0) / points[0] is near tee position
 *  - State machine emits HOLE_STATE_CHANGED for FLYOVER→AIM, AIM→FOLLOW, FOLLOW→HOLE_IN
 *  - Ball is hidden on flyover start
 *  - Skip handler advances to AIM immediately
 */

import { HoleFlyoverManager } from '../../managers/HoleFlyoverManager';
import { EventTypes } from '../../events/EventTypes';
import { GameState } from '../../states/GameState';

// EventTypes and GameState are light, no special mock needed for them.
// THREE is globally mocked via jest.setup.js which keeps the actual CatmullRomCurve3.

describe('HoleFlyoverManager', () => {
  let manager;
  let mockGame;
  let ballHitSub;
  let ballInHoleSub;

  beforeEach(() => {
    // Capture the event handlers registered in init()
    ballHitSub = null;
    ballInHoleSub = null;

    mockGame = {
      eventManager: {
        subscribe: jest.fn((event, handler, ctx) => {
          const bound = handler.bind(ctx);
          if (event === EventTypes.BALL_HIT) {
            ballHitSub = bound;
          }
          if (event === EventTypes.BALL_IN_HOLE) {
            ballInHoleSub = bound;
          }
          return jest.fn(); // unsubscribe no-op
        }),
        publish: jest.fn()
      },
      stateManager: {
        setGameState: jest.fn(),
        getCurrentHoleNumber: jest.fn(() => 3),
        state: {}
      },
      ballManager: {
        ball: {
          mesh: {
            visible: true,
            traverse: jest.fn()
          }
        }
      },
      cameraController: {
        camera: {
          position: { copy: jest.fn() },
          lookAt: jest.fn()
        },
        positionCameraForHole: jest.fn()
      },
      inputController: {
        enableInput: jest.fn()
      },
      course: {
        getHolePosition: jest.fn(() => ({ x: 0, y: 0, z: -5 })),
        getCurrentHoleConfig: jest.fn(() => ({ description: '3. Satellite Slingshot' }))
      }
    };

    // Minimal window / DOM stubs (real jsdom is available via Jest env)
    jest.spyOn(window, 'addEventListener').mockImplementation(() => {});
    jest.spyOn(window, 'removeEventListener').mockImplementation(() => {});

    global.requestAnimationFrame = jest.fn(cb => {
      cb();
      return 1;
    });
    global.setTimeout = jest.fn(() => 1);
    global.clearTimeout = jest.fn();

    manager = new HoleFlyoverManager(mockGame);
    manager.init();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // init / subscriptions
  // ---------------------------------------------------------------------------

  describe('init', () => {
    test('subscribes to BALL_HIT and BALL_IN_HOLE events', () => {
      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_HIT,
        expect.any(Function),
        manager
      );
      expect(mockGame.eventManager.subscribe).toHaveBeenCalledWith(
        EventTypes.BALL_IN_HOLE,
        expect.any(Function),
        manager
      );
    });

    test('returns self for chaining', () => {
      const m = new HoleFlyoverManager(mockGame);
      expect(m.init()).toBe(m);
    });
  });

  // ---------------------------------------------------------------------------
  // _buildCurve — AC: 4 control points, getPoint(0) near tee
  // ---------------------------------------------------------------------------

  describe('_buildCurve', () => {
    test('returns a curve with exactly 4 control points', () => {
      const curve = manager._buildCurve({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -5 });
      expect(curve.points).toHaveLength(4);
    });

    test('first control point (= getPoint(0)) has the same x-coordinate as tee', () => {
      const tee = { x: 3, y: 1, z: 6 };
      const curve = manager._buildCurve(tee, { x: 0, y: 0, z: -4 });
      expect(curve.points[0].x).toBe(tee.x);
    });

    test('first control point is elevated above the tee', () => {
      const tee = { x: 0, y: 0, z: 5 };
      const curve = manager._buildCurve(tee, { x: 0, y: 0, z: -5 });
      expect(curve.points[0].y).toBeGreaterThan(tee.y + 5);
    });

    test('first control point z is within 15 units of tee z', () => {
      const tee = { x: 0, y: 0, z: 5 };
      const curve = manager._buildCurve(tee, { x: 0, y: 0, z: -5 });
      expect(Math.abs(curve.points[0].z - tee.z)).toBeLessThan(15);
    });

    test('all 4 points are distinct THREE.Vector3 instances', () => {
      const curve = manager._buildCurve({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: -8 });
      const [p0, p1, p2, p3] = curve.points;
      expect(p0).not.toBe(p1);
      expect(p1).not.toBe(p2);
      expect(p2).not.toBe(p3);
    });
  });

  // ---------------------------------------------------------------------------
  // startFlyover
  // ---------------------------------------------------------------------------

  describe('startFlyover', () => {
    const tee = { x: 0, y: 0, z: 5 };
    const cup = { x: 0, y: 0, z: -5 };

    test('sets _active to true', () => {
      manager.startFlyover(tee, cup, null);
      expect(manager._active).toBe(true);
    });

    test('hides ball mesh during flyover', () => {
      manager.startFlyover(tee, cup, null);
      expect(mockGame.ballManager.ball.mesh.visible).toBe(false);
    });

    test('sets game state to FLYOVER', () => {
      manager.startFlyover(tee, cup, null);
      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.FLYOVER);
    });

    test('publishes HOLE_FLYOVER_START with hole number', () => {
      manager.startFlyover(tee, cup, null);
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_FLYOVER_START,
        { holeNumber: 3 },
        manager
      );
    });

    test('registers keydown and pointerdown skip handlers', () => {
      manager.startFlyover(tee, cup, null);
      expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    });

    test('sets _holeFlowState to FLYOVER', () => {
      manager.startFlyover(tee, cup, null);
      expect(manager._holeFlowState).toBe('FLYOVER');
    });
  });

  // ---------------------------------------------------------------------------
  // isActive getter
  // ---------------------------------------------------------------------------

  describe('isActive', () => {
    test('returns true while _active', () => {
      manager._active = true;
      expect(manager.isActive).toBe(true);
    });

    test('returns false when not active', () => {
      manager._active = false;
      expect(manager.isActive).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Skip — AC: pressing Escape (keydown) advances to AIM immediately
  // ---------------------------------------------------------------------------

  describe('_skip', () => {
    test('calls _endFlyover when _active is true', () => {
      manager._active = true;
      const spy = jest.spyOn(manager, '_endFlyover').mockImplementation(() => {});
      manager._skip();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('does nothing when _active is false', () => {
      manager._active = false;
      const spy = jest.spyOn(manager, '_endFlyover').mockImplementation(() => {});
      manager._skip();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // _endFlyover
  // ---------------------------------------------------------------------------

  describe('_endFlyover', () => {
    beforeEach(() => {
      manager._active = true;
      manager._skipHandler = jest.fn();
    });

    test('sets _active to false', () => {
      manager._endFlyover();
      expect(manager._active).toBe(false);
    });

    test('removes window event listeners', () => {
      manager._endFlyover();
      expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    });

    test('publishes HOLE_FLYOVER_END', () => {
      manager._endFlyover();
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_FLYOVER_END,
        { holeNumber: 3 },
        manager
      );
    });

    test('calls positionCameraForHole to tween back to aim framing', () => {
      manager._endFlyover();
      expect(mockGame.cameraController.positionCameraForHole).toHaveBeenCalledTimes(1);
    });

    test('reveals ball mesh', () => {
      mockGame.ballManager.ball.mesh.visible = false;
      manager._endFlyover();
      expect(mockGame.ballManager.ball.mesh.visible).toBe(true);
    });

    test('starts fade phase', () => {
      manager._endFlyover();
      expect(manager._fading).toBe(true);
    });

    test('is idempotent — second call is a no-op', () => {
      manager._endFlyover();
      manager._endFlyover();
      // positionCameraForHole should only be called once
      expect(mockGame.cameraController.positionCameraForHole).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // _completeFlyover — AC: FLYOVER→AIM event emitted
  // ---------------------------------------------------------------------------

  describe('_completeFlyover', () => {
    test('sets _holeFlowState to AIM', () => {
      manager._completeFlyover();
      expect(manager._holeFlowState).toBe('AIM');
    });

    test('sets game state to AIMING', () => {
      manager._completeFlyover();
      expect(mockGame.stateManager.setGameState).toHaveBeenCalledWith(GameState.AIMING);
    });

    test('emits HOLE_STATE_CHANGED { from: FLYOVER, to: AIM }', () => {
      manager._completeFlyover();
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_STATE_CHANGED,
        { from: 'FLYOVER', to: 'AIM' },
        manager
      );
    });

    test('enables input controller', () => {
      manager._completeFlyover();
      expect(mockGame.inputController.enableInput).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // State machine — AC: AIM→FOLLOW and FOLLOW→HOLE_IN events emitted
  // ---------------------------------------------------------------------------

  describe('state machine transitions', () => {
    test('emits HOLE_STATE_CHANGED AIM→FOLLOW when ball is hit in AIM state', () => {
      manager._holeFlowState = 'AIM';
      ballHitSub({});
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_STATE_CHANGED,
        { from: 'AIM', to: 'FOLLOW' },
        manager
      );
      expect(manager._holeFlowState).toBe('FOLLOW');
    });

    test('does NOT emit AIM→FOLLOW when ball is hit outside AIM state', () => {
      manager._holeFlowState = 'FLYOVER';
      ballHitSub({});
      const stateCalls = mockGame.eventManager.publish.mock.calls.filter(
        ([type]) => type === EventTypes.HOLE_STATE_CHANGED
      );
      expect(stateCalls).toHaveLength(0);
    });

    test('emits HOLE_STATE_CHANGED FOLLOW→HOLE_IN when ball enters hole in FOLLOW state', () => {
      manager._holeFlowState = 'FOLLOW';
      ballInHoleSub({});
      expect(mockGame.eventManager.publish).toHaveBeenCalledWith(
        EventTypes.HOLE_STATE_CHANGED,
        { from: 'FOLLOW', to: 'HOLE_IN' },
        manager
      );
      expect(manager._holeFlowState).toBe('HOLE_IN');
    });

    test('does NOT emit FOLLOW→HOLE_IN when ball enters hole outside FOLLOW state', () => {
      manager._holeFlowState = 'AIM';
      ballInHoleSub({});
      const stateCalls = mockGame.eventManager.publish.mock.calls.filter(
        ([type]) => type === EventTypes.HOLE_STATE_CHANGED
      );
      expect(stateCalls).toHaveLength(0);
    });

    test('full sequence: FLYOVER→AIM, AIM→FOLLOW, FOLLOW→HOLE_IN', () => {
      // Step 1: flyover ends
      manager._completeFlyover();
      expect(manager._holeFlowState).toBe('AIM');

      // Step 2: player hits ball
      ballHitSub({});
      expect(manager._holeFlowState).toBe('FOLLOW');

      // Step 3: ball in hole
      ballInHoleSub({});
      expect(manager._holeFlowState).toBe('HOLE_IN');

      const stateCalls = mockGame.eventManager.publish.mock.calls.filter(
        ([type]) => type === EventTypes.HOLE_STATE_CHANGED
      );
      expect(stateCalls).toHaveLength(3);
      expect(stateCalls[0][1]).toEqual({ from: 'FLYOVER', to: 'AIM' });
      expect(stateCalls[1][1]).toEqual({ from: 'AIM', to: 'FOLLOW' });
      expect(stateCalls[2][1]).toEqual({ from: 'FOLLOW', to: 'HOLE_IN' });
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    test('advances elapsed time when active', () => {
      manager._active = true;
      manager._elapsed = 0;
      manager._duration = 3;
      manager._curve = { getPointAt: jest.fn(() => ({ x: 0, y: 0, z: 0 })) };
      jest.spyOn(manager, '_endFlyover').mockImplementation(() => {});

      manager.update(0.5);

      expect(manager._elapsed).toBeCloseTo(0.5);
    });

    test('moves camera along curve', () => {
      const mockPos = { x: 1, y: 5, z: 2 };
      const mockLookAt = { x: 2, y: 4, z: 1 };
      manager._active = true;
      manager._elapsed = 0;
      manager._duration = 3;
      manager._curve = {
        getPointAt: jest.fn().mockReturnValueOnce(mockPos).mockReturnValueOnce(mockLookAt)
      };

      manager.update(0.1);

      expect(mockGame.cameraController.camera.position.copy).toHaveBeenCalledWith(mockPos);
      expect(mockGame.cameraController.camera.lookAt).toHaveBeenCalledWith(mockLookAt);
    });

    test('calls _endFlyover when t reaches 1', () => {
      manager._active = true;
      manager._elapsed = 2.95;
      manager._duration = 3;
      manager._curve = { getPointAt: jest.fn(() => ({ x: 0, y: 0, z: 0 })) };
      const spy = jest.spyOn(manager, '_endFlyover').mockImplementation(() => {});

      manager.update(0.1); // pushes elapsed past duration

      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('does nothing when neither active nor fading', () => {
      manager._active = false;
      manager._fading = false;
      manager._curve = { getPointAt: jest.fn() };

      manager.update(0.1);

      expect(manager._curve.getPointAt).not.toHaveBeenCalled();
    });

    test('advances fade when _fading is true', () => {
      manager._fading = true;
      manager._active = false;
      manager._fadeElapsed = 0;
      const spy = jest.spyOn(manager, '_advanceFade').mockImplementation(() => {});

      manager.update(0.1);

      expect(spy).toHaveBeenCalledWith(0.1);
    });
  });

  // ---------------------------------------------------------------------------
  // destroy
  // ---------------------------------------------------------------------------

  describe('destroy', () => {
    test('removes event listeners', () => {
      const capturedHandler = jest.fn();
      manager._skipHandler = capturedHandler;
      manager.destroy();
      // _skipHandler is nulled by destroy(); use the captured reference
      expect(window.removeEventListener).toHaveBeenCalledWith('keydown', capturedHandler);
      expect(window.removeEventListener).toHaveBeenCalledWith('pointerdown', capturedHandler);
    });

    test('clears curve and resets active flags', () => {
      manager._active = true;
      manager._fading = true;
      manager._curve = {};
      manager.destroy();
      expect(manager._active).toBe(false);
      expect(manager._fading).toBe(false);
      expect(manager._curve).toBeNull();
    });

    test('unsubscribes from event manager', () => {
      const unsub1 = jest.fn();
      const unsub2 = jest.fn();
      manager._eventSubs = [unsub1, unsub2];
      manager.destroy();
      expect(unsub1).toHaveBeenCalledTimes(1);
      expect(unsub2).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // graceful handling of missing dependencies
  // ---------------------------------------------------------------------------

  describe('missing dependencies', () => {
    test('startFlyover handles missing ball manager', () => {
      mockGame.ballManager = null;
      expect(() =>
        manager.startFlyover({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -5 }, null)
      ).not.toThrow();
    });

    test('startFlyover handles missing state manager', () => {
      mockGame.stateManager = null;
      expect(() =>
        manager.startFlyover({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -5 }, null)
      ).not.toThrow();
    });

    test('_completeFlyover handles missing input controller', () => {
      mockGame.inputController = null;
      expect(() => manager._completeFlyover()).not.toThrow();
    });

    test('_endFlyover handles missing camera controller', () => {
      manager._active = true;
      mockGame.cameraController = null;
      expect(() => manager._endFlyover()).not.toThrow();
    });
  });
});
