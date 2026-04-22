import * as THREE from 'three';
import { EventTypes } from '../events/EventTypes';
import { GameState } from '../states/GameState';
import { debug } from '../utils/debug';

const FLYOVER_DURATION = 3.0; // seconds
const BALL_FADE_DURATION = 0.3; // seconds

/**
 * HoleFlyoverManager — intro camera flyover on each hole load plus hole-level state machine.
 *
 * Flow: FLYOVER → AIM → FOLLOW → HOLE_IN
 * Each transition publishes HOLE_STATE_CHANGED { from, to } via EventManager.
 *
 * The flyover is skippable with any keydown or pointerdown event.
 */
export class HoleFlyoverManager {
  constructor(game) {
    this.game = game;

    // Flyover animation state
    this._active = false;
    this._fading = false;
    this._curve = null;
    this._elapsed = 0;
    this._duration = FLYOVER_DURATION;

    // Ball fade-in state
    this._fadeElapsed = 0;

    // Skip handler references (for removal)
    this._skipHandler = null;

    // Hole indicator overlay DOM element
    this._indicatorEl = null;
    this._indicatorTimer = null;

    // Hole-level flow state machine
    this._holeFlowState = 'IDLE';

    // EventManager subscription tokens
    this._eventSubs = [];
  }

  /**
   * Subscribe to ball events for AIM→FOLLOW and FOLLOW→HOLE_IN transitions.
   */
  init() {
    const em = this.game.eventManager;
    if (em) {
      this._eventSubs.push(
        em.subscribe(EventTypes.BALL_HIT, this._onBallHit, this),
        em.subscribe(EventTypes.BALL_IN_HOLE, this._onBallInHole, this)
      );
    }
    return this;
  }

  /** True while the camera is actively flying along the curve. */
  get isActive() {
    return this._active;
  }

  // ---------------------------------------------------------------------------
  // Curve construction
  // ---------------------------------------------------------------------------

  /**
   * Build a CatmullRomCurve3 with 4 control points:
   *   P0 — above tee
   *   P1 — cup/hole view
   *   P2 — midpoint obstacle view
   *   P3 — behind tee (final aim-framing position)
   *
   * @param {{ x: number, y: number, z: number }} startPos  Tee / ball spawn position
   * @param {{ x: number, y: number, z: number }} holePos   Cup position
   * @returns {THREE.CatmullRomCurve3}
   */
  _buildCurve(startPos, holePos) {
    const midX = (startPos.x + holePos.x) / 2;
    const midZ = (startPos.z + holePos.z) / 2;

    const p0 = new THREE.Vector3(startPos.x, startPos.y + 12, startPos.z + 8);
    const p1 = new THREE.Vector3(holePos.x + 2, startPos.y + 8, holePos.z + 6);
    const p2 = new THREE.Vector3(midX, startPos.y + 5, midZ);
    const p3 = new THREE.Vector3(startPos.x, startPos.y + 5, startPos.z + 6);

    return new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
  }

  // ---------------------------------------------------------------------------
  // Flyover lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start the hole intro flyover.
   * @param {{ x: number, y: number, z: number }} startPos
   * @param {{ x: number, y: number, z: number }} holePos
   * @param {object|null} holeConfig  Current hole config (for description text)
   */
  startFlyover(startPos, holePos, holeConfig) {
    this._curve = this._buildCurve(startPos, holePos);
    this._elapsed = 0;
    this._duration = FLYOVER_DURATION;
    this._active = true;
    this._fading = false;
    this._fadeElapsed = 0;
    this._holeFlowState = 'FLYOVER';

    // Hide ball during flyover
    const ball = this.game.ballManager?.ball;
    if (ball?.mesh) {
      ball.mesh.visible = false;
    }

    // Show hole indicator overlay
    const holeNumber = this.game.stateManager?.getCurrentHoleNumber?.() ?? '';
    const rawName = (holeConfig?.description || '').replace(/^\d+\.\s*/, '').trim();
    const indicatorText = holeNumber ? `Hole ${holeNumber} — ${rawName}` : rawName;
    this._showIndicator(indicatorText);

    // Switch to FLYOVER game state
    this.game.stateManager?.setGameState(GameState.FLYOVER);

    // Register skip handlers — once attached they stay until _endFlyover removes them
    this._skipHandler = () => this._skip();
    window.addEventListener('keydown', this._skipHandler);
    window.addEventListener('pointerdown', this._skipHandler);

    this.game.eventManager?.publish(
      EventTypes.HOLE_FLYOVER_START,
      { holeNumber: this.game.stateManager?.getCurrentHoleNumber?.() },
      this
    );

    debug.log('[HoleFlyoverManager] Flyover started');
  }

  _skip() {
    if (!this._active) {
      return;
    }
    this._endFlyover();
  }

  /**
   * Per-frame update. Called by GameLoopManager.
   * @param {number} dt  Delta time in seconds (already clamped)
   */
  update(dt) {
    if (this._fading) {
      this._advanceFade(dt);
      return;
    }
    if (!this._active) {
      return;
    }

    this._elapsed += dt;
    const t = Math.min(this._elapsed / this._duration, 1);

    // Move camera along arc-length-parameterised curve
    const camera = this.game.cameraController?.camera;
    if (camera && this._curve) {
      const pos = this._curve.getPointAt(t);
      const lookAheadT = Math.min(t + 0.05, 1);
      const lookAt = this._curve.getPointAt(lookAheadT);
      camera.position.copy(pos);
      camera.lookAt(lookAt);
    }

    if (t >= 1) {
      this._endFlyover();
    }
  }

  _endFlyover() {
    if (!this._active) {
      return;
    }
    this._active = false;

    // Detach skip handlers
    if (this._skipHandler) {
      window.removeEventListener('keydown', this._skipHandler);
      window.removeEventListener('pointerdown', this._skipHandler);
      this._skipHandler = null;
    }

    this._hideIndicator();

    this.game.eventManager?.publish(
      EventTypes.HOLE_FLYOVER_END,
      { holeNumber: this.game.stateManager?.getCurrentHoleNumber?.() },
      this
    );

    // Tween camera back to aim framing — CameraController's hint tween runs during fade
    this.game.cameraController?.positionCameraForHole();

    // Reveal ball and start opacity fade-in
    const ball = this.game.ballManager?.ball;
    if (ball?.mesh) {
      ball.mesh.visible = true;
    }
    this._fading = true;
    this._fadeElapsed = 0;
  }

  _advanceFade(dt) {
    this._fadeElapsed += dt;
    const opacity = Math.min(this._fadeElapsed / BALL_FADE_DURATION, 1);

    const ball = this.game.ballManager?.ball;
    if (ball?.mesh) {
      ball.mesh.traverse(child => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(mat => {
            mat.transparent = true;
            mat.opacity = opacity;
            mat.needsUpdate = true;
          });
        }
      });
    }

    if (opacity >= 1) {
      // Restore normal material state after fade completes
      if (ball?.mesh) {
        ball.mesh.traverse(child => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
              mat.transparent = false;
              mat.opacity = 1;
              mat.needsUpdate = true;
            });
          }
        });
      }
      this._fading = false;
      this._completeFlyover();
    }
  }

  _completeFlyover() {
    this._holeFlowState = 'AIM';

    // Restore AIM game state
    this.game.stateManager?.setGameState(GameState.AIMING);

    // Emit FLYOVER→AIM transition event
    this.game.eventManager?.publish(
      EventTypes.HOLE_STATE_CHANGED,
      { from: 'FLYOVER', to: 'AIM' },
      this
    );

    // Hand control back to the player
    this.game.inputController?.enableInput?.();

    debug.log('[HoleFlyoverManager] Flyover complete — entering AIM state');
  }

  // ---------------------------------------------------------------------------
  // Hole-level state machine: AIM→FOLLOW and FOLLOW→HOLE_IN
  // ---------------------------------------------------------------------------

  _onBallHit(_event) {
    if (this._holeFlowState !== 'AIM') {
      return;
    }
    this._holeFlowState = 'FOLLOW';
    this.game.eventManager?.publish(
      EventTypes.HOLE_STATE_CHANGED,
      { from: 'AIM', to: 'FOLLOW' },
      this
    );
  }

  _onBallInHole(_event) {
    if (this._holeFlowState !== 'FOLLOW') {
      return;
    }
    this._holeFlowState = 'HOLE_IN';
    this.game.eventManager?.publish(
      EventTypes.HOLE_STATE_CHANGED,
      { from: 'FOLLOW', to: 'HOLE_IN' },
      this
    );
  }

  // ---------------------------------------------------------------------------
  // Hole indicator overlay
  // ---------------------------------------------------------------------------

  _showIndicator(text) {
    if (!document?.body) {
      return;
    }

    let el = document.getElementById('hole-flyover-indicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hole-flyover-indicator';
      Object.assign(el.style, {
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#fff',
        fontSize: '2rem',
        fontWeight: 'bold',
        textAlign: 'center',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.5s ease',
        textShadow: '0 0 20px rgba(100,200,255,0.8)',
        zIndex: '100',
        whiteSpace: 'nowrap'
      });
      document.body.appendChild(el);
    }

    el.textContent = text;
    this._indicatorEl = el;

    // Animate in on next paint
    requestAnimationFrame(() => {
      if (this._indicatorEl) {
        this._indicatorEl.style.opacity = '1';
      }
    });

    // Auto-dismiss after 3 s
    this._indicatorTimer = setTimeout(() => this._hideIndicator(), 3000);
  }

  _hideIndicator() {
    if (this._indicatorTimer) {
      clearTimeout(this._indicatorTimer);
      this._indicatorTimer = null;
    }
    if (this._indicatorEl) {
      this._indicatorEl.style.opacity = '0';
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy() {
    if (this._skipHandler) {
      window.removeEventListener('keydown', this._skipHandler);
      window.removeEventListener('pointerdown', this._skipHandler);
      this._skipHandler = null;
    }
    this._hideIndicator();
    if (this._indicatorEl) {
      this._indicatorEl.remove?.();
      this._indicatorEl = null;
    }
    this._eventSubs.forEach(unsub => unsub?.());
    this._eventSubs = [];
    this._curve = null;
    this._active = false;
    this._fading = false;
  }
}
