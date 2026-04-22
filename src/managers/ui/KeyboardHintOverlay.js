import { EventTypes } from '../../events/EventTypes';

const HINT_NAMES = {
  AIM: 'aim',
  CAMERA: 'camera',
  PAUSE: 'pause'
};

const HINTS = [
  { key: HINT_NAMES.AIM, text: 'Drag near ball to aim & shoot' },
  { key: HINT_NAMES.CAMERA, text: 'Two-finger drag to rotate view' },
  { key: HINT_NAMES.PAUSE, text: 'ESC or two-finger tap to pause' }
];

/** Shows contextual input hints on holes 1 and 2 only; each dismissed on first use. */
export class KeyboardHintOverlay {
  constructor(game, container) {
    this.game = game;
    this.container = container;
    this.overlay = null;
    this._hintElements = {};
    this._dismissed = { aim: false, camera: false, pause: false };
    this._currentHole = 0;
    this._subscriptions = [];
    this._boundOnTouchForCamera = this._onTouchForCamera.bind(this);
  }

  init() {
    this._createOverlay();
    this._setupEvents();
  }

  _createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.classList.add('keyboard-hint-overlay');
    this.overlay.setAttribute('aria-hidden', 'true');

    HINTS.forEach(({ key, text }) => {
      const badge = document.createElement('div');
      badge.classList.add('keyboard-hint-badge');
      badge.setAttribute('data-hint', key);
      badge.textContent = text;
      this._hintElements[key] = badge;
      this.overlay.appendChild(badge);
    });

    this.overlay.style.display = 'none';
    this.container.appendChild(this.overlay);
  }

  _setupEvents() {
    if (!this.game.eventManager) {
      return;
    }

    this._subscriptions.push(
      this.game.eventManager.subscribe(
        EventTypes.HOLE_STARTED,
        event => {
          const holeNumber = event.get ? event.get('holeNumber') : event.holeNumber;
          this._currentHole = holeNumber ?? 0;
          if (this._currentHole <= 2) {
            this._showVisible();
          } else {
            this._hideOverlay();
          }
        },
        this
      )
    );

    this._subscriptions.push(
      this.game.eventManager.subscribe(
        EventTypes.BALL_HIT,
        () => {
          this._dismissHint(HINT_NAMES.AIM);
        },
        this
      )
    );

    this._subscriptions.push(
      this.game.eventManager.subscribe(
        EventTypes.GAME_PAUSED,
        () => {
          this._dismissHint(HINT_NAMES.PAUSE);
        },
        this
      )
    );

    window.addEventListener('touchstart', this._boundOnTouchForCamera, { passive: true });
  }

  _onTouchForCamera(event) {
    if (
      !this._dismissed[HINT_NAMES.CAMERA] &&
      event.touches.length >= 2 &&
      this._currentHole <= 2
    ) {
      this._dismissHint(HINT_NAMES.CAMERA);
    }
  }

  _showVisible() {
    this.overlay.style.display = 'flex';
    Object.keys(this._dismissed).forEach(key => {
      const el = this._hintElements[key];
      if (el) {
        el.style.display = this._dismissed[key] ? 'none' : '';
      }
    });
    this._checkAllDismissed();
  }

  _hideOverlay() {
    this.overlay.style.display = 'none';
  }

  _dismissHint(name) {
    if (this._dismissed[name]) {
      return;
    }
    this._dismissed[name] = true;
    const el = this._hintElements[name];
    if (el) {
      el.style.display = 'none';
    }
    this._checkAllDismissed();
  }

  _checkAllDismissed() {
    const allDone = Object.values(this._dismissed).every(Boolean);
    if (allDone) {
      this._hideOverlay();
    }
  }

  cleanup() {
    this._subscriptions.forEach(unsub => {
      try {
        unsub();
      } catch (_e) {
        // ignore
      }
    });
    this._subscriptions = [];
    window.removeEventListener('touchstart', this._boundOnTouchForCamera);
    this.overlay?.remove();
    this.overlay = null;
    this._hintElements = {};
  }
}
