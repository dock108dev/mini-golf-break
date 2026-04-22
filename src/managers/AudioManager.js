import { debug } from '../utils/debug';
import * as THREE from 'three';
import { EventTypes } from '../events/EventTypes';

/**
 * AudioManager - Centralizes audio functionality for the entire game
 */
export class AudioManager {
  // Sound types that are considered mechanic sounds (subject to concurrent limit)
  static MECHANIC_SOUND_TYPES = ['teleport', 'boost', 'sweeperHit', 'gateOpen', 'gateClose'];

  constructor(game) {
    this.game = game;
    this.audioListener = null;
    this.sounds = {
      hit: null,
      success: null
    };
    this.currentVolume = 0.7;
    this.isMuted = false;
    this.storageKey = 'miniGolfBreak_audioMuted';
    this.volumeStorageKey = 'miniGolfBreak_audioVolume';

    // Audio cooldown tracking
    this.lastPlayTime = {}; // soundName → timestamp (ms)
    this.cooldownInterval = 100; // minimum ms between replays of same sound
    this.maxConcurrentMechanicSounds = 3;
    this.activeMechanicSounds = 0;

    // Active Web Audio nodes tracked for cleanup
    this._activeNodes = [];

    // Master gain node — all Web Audio oscillators route through this
    this._masterGain = null;

    // Ambient drone state
    this._droneOsc = null;
    this._droneGain = null;
    this._droneStarted = false;

    // Event handler references for unsubscription
    this._onBallWallImpact = null;
    this._onGameCompleted = null;

    // Restore persisted audio settings
    this.loadPersistedVolume();
    this.restoreMuteState();

    // Initialize audio system
    this.init();
  }

  /** Returns the Web Audio context from the THREE.AudioListener, if available. */
  get _ctx() {
    return this.audioListener?.context || null;
  }

  /**
   * Initialize the audio system
   */
  init() {
    // Create audio listener
    this.audioListener = new THREE.AudioListener();

    // Add listener to camera if available
    if (this.game && this.game.camera) {
      this.game.camera.add(this.audioListener);
    }

    // Create sounds
    this.createSounds();

    // Wire master gain node (0.7 default, controls all Web Audio oscillators)
    this._initMasterGain();

    // Subscribe to game events for automatic audio feedback
    this._subscribeToEvents();

    // Start ambient drone (no-op if context is suspended — resumes on first interaction)
    this.startAmbientDrone();
  }

  /**
   * Create and connect the master gain node to the audio destination.
   * All Web Audio oscillator chains connect through this node.
   */
  _initMasterGain() {
    const ctx = this._ctx;
    if (!ctx?.createGain) {
      return;
    }
    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = this.currentVolume;
    this._masterGain.connect(ctx.destination);
  }

  /**
   * Returns the master gain node if available, otherwise the raw context destination.
   * @param {AudioContext} ctx
   * @returns {AudioNode}
   */
  _getMasterDest(ctx) {
    return this._masterGain || ctx.destination;
  }

  /**
   * Create a positioned PannerNode for spatial L/R audio.
   * Spec: refDistance 2, maxDistance 30, rolloffFactor 1.5.
   * @param {AudioContext} ctx
   * @param {number} x - Ball world X position
   * @param {number} z - Ball world Z position
   * @returns {PannerNode|null}
   */
  _createPanner(ctx, x, z) {
    if (!ctx?.createPanner) {
      return null;
    }
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2;
    panner.maxDistance = 30;
    panner.rolloffFactor = 1.5;
    if (panner.positionX) {
      panner.positionX.value = x || 0;
      panner.positionY.value = 0;
      panner.positionZ.value = z || 0;
    }
    return panner;
  }

  _subscribeToEvents() {
    if (!this.game?.eventManager?.subscribe) {
      return;
    }
    this._onBallHit = data => {
      if (!this.isMuted) {
        const pos = data?.position || null;
        this.playStrikeSound(typeof data?.power === 'number' ? data.power : 1.0, pos);
      }
    };
    this._onBallInHole = () => {
      if (!this.isMuted) {
        this.playCupSinkSound();
        this.playHoleCompletionStinger();
      }
    };
    this._onBallWallImpact = data => {
      if (!this.isMuted) {
        const pos = this.game?.ballManager?.ball?.mesh?.position || null;
        this.playWallImpact(data?.impactSpeed ?? 0, pos);
      }
    };
    this._onGameCompleted = () => {
      this.stopAmbientDrone(3);
    };

    this.game.eventManager.subscribe(EventTypes.BALL_HIT, this._onBallHit);
    this.game.eventManager.subscribe(EventTypes.BALL_IN_HOLE, this._onBallInHole);
    this.game.eventManager.subscribe(EventTypes.BALL_WALL_IMPACT, this._onBallWallImpact);
    this.game.eventManager.subscribe(EventTypes.GAME_COMPLETED, this._onGameCompleted);
  }

  /**
   * Create sound objects
   */
  createSounds() {
    // Create hit sound
    this.sounds.hit = new THREE.Audio(this.audioListener);
    this.sounds.hit.setVolume(0.5);

    // Create success sound
    this.sounds.success = new THREE.Audio(this.audioListener);
    this.sounds.success.setVolume(0.7);

    // Mechanic sounds
    this.sounds.teleport = new THREE.Audio(this.audioListener);
    this.sounds.teleport.setVolume(0.6);

    this.sounds.boost = new THREE.Audio(this.audioListener);
    this.sounds.boost.setVolume(0.4);

    this.sounds.sweeperHit = new THREE.Audio(this.audioListener);
    this.sounds.sweeperHit.setVolume(0.5);

    this.sounds.gateOpen = new THREE.Audio(this.audioListener);
    this.sounds.gateOpen.setVolume(0.4);

    this.sounds.gateClose = new THREE.Audio(this.audioListener);
    this.sounds.gateClose.setVolume(0.4);
  }

  /**
   * Check if a sound is on cooldown (played too recently)
   * @param {string} soundName - Name of the sound
   * @returns {boolean} true if the sound is on cooldown
   */
  isSoundOnCooldown(soundName) {
    const lastTime = this.lastPlayTime[soundName];
    if (lastTime === undefined) {
      return false;
    }
    return Date.now() - lastTime < this.cooldownInterval;
  }

  /**
   * Check if a mechanic sound type
   * @param {string} soundName - Name of the sound
   * @returns {boolean} true if it's a mechanic sound
   */
  isMechanicSound(soundName) {
    return AudioManager.MECHANIC_SOUND_TYPES.includes(soundName);
  }

  /**
   * Record that a sound was played and track concurrent mechanic sounds
   * @param {string} soundName - Name of the sound
   * @param {number} duration - Duration in ms before the sound is considered finished
   */
  recordSoundPlay(soundName, duration) {
    this.lastPlayTime[soundName] = Date.now();

    if (this.isMechanicSound(soundName)) {
      this.activeMechanicSounds++;
      setTimeout(() => {
        this.activeMechanicSounds = Math.max(0, this.activeMechanicSounds - 1);
      }, duration);
    }
  }

  /**
   * Play a sound effect
   * @param {string} soundName - Name of the sound to play ('hit', 'roll', 'success')
   * @param {number} volume - Optional volume (0.0 to 1.0)
   */
  playSound(soundName, volume = 1.0) {
    if (!this.sounds || !this.sounds[soundName]) {
      console.warn(`Sound '${soundName}' not found`);
      return;
    }

    // Cooldown check: same sound type cannot replay within cooldownInterval
    if (this.isSoundOnCooldown(soundName)) {
      return;
    }

    // Concurrent mechanic sound limit (does not affect hit/success)
    if (
      this.isMechanicSound(soundName) &&
      this.activeMechanicSounds >= this.maxConcurrentMechanicSounds
    ) {
      return;
    }

    // Handle different sound types
    switch (soundName) {
      case 'hit':
        this.playHitSound(volume);
        break;

      case 'success':
        this.playSuccessSound(volume);
        break;

      case 'teleport':
        this.playTeleportSound(volume);
        break;

      case 'boost':
        this.playBoostSound(volume);
        break;

      case 'sweeperHit':
        this.playSweeperHitSound(volume);
        break;

      case 'gateOpen':
        this.playGateOpenSound(volume);
        break;

      case 'gateClose':
        this.playGateCloseSound(volume);
        break;
    }
  }

  /**
   * Play the hit sound
   */
  playHitSound(volume = 1.0) {
    if (!this.sounds.hit || this.sounds.hit.isPlaying) {
      return;
    }

    // THREE.Audio.play() resumes the AudioContext; the oscillator below adds the actual tone
    this.sounds.hit.isPlaying = true;
    this.sounds.hit.play();

    if (this.sounds.hit.context) {
      const ctx = this.sounds.hit.context;
      const dest = this._getMasterDest(ctx);
      // Create new oscillator each time for hit sound
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(220, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3 * volume, ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

      oscillator.connect(gain);
      gain.connect(dest);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    }

    // Reset playing state after a short delay
    setTimeout(() => {
      this.sounds.hit.isPlaying = false;
    }, 300);
  }

  /**
   * Play the success sound
   */
  playSuccessSound(volume = 1.0) {
    if (!this.sounds.success || this.sounds.success.isPlaying) {
      return;
    }

    // THREE.Audio.play() resumes the AudioContext; the oscillator below adds the actual tone
    this.sounds.success.isPlaying = true;
    this.sounds.success.play();

    if (this.sounds.success.context) {
      const ctx = this.sounds.success.context;
      const dest = this._getMasterDest(ctx);
      // Create new oscillator each time for success sound
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';

      // Rising tone for success
      oscillator.frequency.setValueAtTime(440, ctx.currentTime);
      oscillator.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4 * volume, ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

      oscillator.connect(gain);
      gain.connect(dest);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.5);
    }

    // Reset playing state after a short delay
    setTimeout(() => {
      this.sounds.success.isPlaying = false;
    }, 500);
  }

  /**
   * Play the teleport sound (sci-fi whoosh)
   */
  playTeleportSound(volume = 1.0) {
    if (this.isMuted || !this.sounds.teleport || this.sounds.teleport.isPlaying) {
      return;
    }

    this.sounds.teleport.isPlaying = true;
    this.sounds.teleport.play();
    this.recordSoundPlay('teleport', 400);

    if (this.sounds.teleport.context) {
      const ctx = this.sounds.teleport.context;
      const dest = this._getMasterDest(ctx);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Descending sweep for whoosh effect
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3 * volume, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }

    setTimeout(() => {
      this.sounds.teleport.isPlaying = false;
    }, 400);
  }

  /**
   * Play the boost sound (rising acceleration tone)
   */
  playBoostSound(volume = 1.0) {
    if (this.isMuted || !this.sounds.boost || this.sounds.boost.isPlaying) {
      return;
    }

    this.sounds.boost.isPlaying = true;
    this.sounds.boost.play();
    this.recordSoundPlay('boost', 250);

    if (this.sounds.boost.context) {
      const ctx = this.sounds.boost.context;
      const dest = this._getMasterDest(ctx);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Rising tone for acceleration feel
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15 * volume, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }

    setTimeout(() => {
      this.sounds.boost.isPlaying = false;
    }, 250);
  }

  /**
   * Play the sweeper collision sound (metallic thud)
   */
  playSweeperHitSound(volume = 1.0) {
    if (this.isMuted || !this.sounds.sweeperHit || this.sounds.sweeperHit.isPlaying) {
      return;
    }

    this.sounds.sweeperHit.isPlaying = true;
    this.sounds.sweeperHit.play();
    this.recordSoundPlay('sweeperHit', 200);

    if (this.sounds.sweeperHit.context) {
      const ctx = this.sounds.sweeperHit.context;
      const dest = this._getMasterDest(ctx);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Low thud with fast decay
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.4 * volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }

    setTimeout(() => {
      this.sounds.sweeperHit.isPlaying = false;
    }, 200);
  }

  /**
   * Play the gate open sound (mechanical slide up)
   */
  playGateOpenSound(volume = 1.0) {
    if (this.isMuted || !this.sounds.gateOpen || this.sounds.gateOpen.isPlaying) {
      return;
    }

    this.sounds.gateOpen.isPlaying = true;
    this.sounds.gateOpen.play();
    this.recordSoundPlay('gateOpen', 200);

    if (this.sounds.gateOpen.context) {
      const ctx = this.sounds.gateOpen.context;
      const dest = this._getMasterDest(ctx);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Rising mechanical tone
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(350, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12 * volume, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }

    setTimeout(() => {
      this.sounds.gateOpen.isPlaying = false;
    }, 200);
  }

  /**
   * Play the gate close sound (mechanical slide down)
   */
  playGateCloseSound(volume = 1.0) {
    if (this.isMuted || !this.sounds.gateClose || this.sounds.gateClose.isPlaying) {
      return;
    }

    this.sounds.gateClose.isPlaying = true;
    this.sounds.gateClose.play();
    this.recordSoundPlay('gateClose', 200);

    if (this.sounds.gateClose.context) {
      const ctx = this.sounds.gateClose.context;
      const dest = this._getMasterDest(ctx);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Descending mechanical tone
      osc.type = 'square';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12 * volume, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }

    setTimeout(() => {
      this.sounds.gateClose.isPlaying = false;
    }, 200);
  }

  /**
   * Play shot-strike audio: sine sweep 220→80 Hz + triangle click 900 Hz, scaled by power.
   * Routes through a spatial PannerNode when ball position is provided.
   * @param {number} power - Shot power 0–1
   * @param {THREE.Vector3|null} ballPosition - Ball world position for spatial panning
   */
  playStrikeSound(power = 1.0, ballPosition = null) {
    const ctx = this._ctx;
    if (!ctx?.createOscillator) {
      return;
    }

    const now = ctx.currentTime;
    const p = Math.max(0, Math.min(1, power));
    const dest = this._getMasterDest(ctx);

    const panner = ballPosition ? this._createPanner(ctx, ballPosition.x, ballPosition.z) : null;
    if (panner) {
      panner.connect(dest);
    }
    const finalDest = panner || dest;

    // Sine sweep 220 → 80 Hz over 0.15 s
    const sineOsc = ctx.createOscillator();
    const sineGain = ctx.createGain();
    sineOsc.type = 'sine';
    sineOsc.frequency.setValueAtTime(220, now);
    sineOsc.frequency.linearRampToValueAtTime(80, now + 0.15);
    sineGain.gain.setValueAtTime(0.4 * p, now);
    sineGain.gain.linearRampToValueAtTime(0, now + 0.15);
    sineOsc.connect(sineGain);
    sineGain.connect(finalDest);
    sineOsc.start(now);
    sineOsc.stop(now + 0.15);
    this._activeNodes.push(sineOsc, sineGain);

    // Triangle click 900 Hz for 0.02 s
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(900, now);
    clickGain.gain.setValueAtTime(0.3 * p, now);
    clickGain.gain.linearRampToValueAtTime(0, now + 0.02);
    clickOsc.connect(clickGain);
    clickGain.connect(finalDest);
    clickOsc.start(now);
    clickOsc.stop(now + 0.02);
    this._activeNodes.push(clickOsc, clickGain);
  }

  /**
   * Play wall-impact noise burst, pitch-mapped to impact speed (400–1200 Hz).
   * Routes through a spatial PannerNode when ball position is provided.
   * Fires only when speed > 0.3.
   * @param {number} speed - Impact speed (absolute value of impact velocity)
   * @param {THREE.Vector3|null} ballPosition - Ball world position for spatial panning
   */
  playWallImpact(speed, ballPosition = null) {
    if (speed <= 0.3) {
      return;
    }
    const ctx = this._ctx;
    if (!ctx?.createOscillator) {
      return;
    }

    // Map speed (0–10+) to 400–1200 Hz
    const freq = Math.min(1200, 400 + (speed / 10) * 800);
    const now = ctx.currentTime;
    const dest = this._getMasterDest(ctx);

    const panner = ballPosition ? this._createPanner(ctx, ballPosition.x, ballPosition.z) : null;
    if (panner) {
      panner.connect(dest);
    }
    const finalDest = panner || dest;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(finalDest);
    osc.start(now);
    osc.stop(now + 0.08);
    this._activeNodes.push(osc, gain);
  }

  /**
   * Play 3-phase cup-sink audio: thunk → rattle → ascending chime C5→E5.
   */
  playCupSinkSound() {
    const ctx = this._ctx;
    if (!ctx?.createOscillator) {
      return;
    }

    const now = ctx.currentTime;
    const dest = this._getMasterDest(ctx);

    // Phase 1: thunk — 100 Hz sine, 0.05 s
    const thunkOsc = ctx.createOscillator();
    const thunkGain = ctx.createGain();
    thunkOsc.type = 'sine';
    thunkOsc.frequency.setValueAtTime(100, now);
    thunkGain.gain.setValueAtTime(0.5, now);
    thunkGain.gain.linearRampToValueAtTime(0, now + 0.05);
    thunkOsc.connect(thunkGain);
    thunkGain.connect(dest);
    thunkOsc.start(now);
    thunkOsc.stop(now + 0.05);
    this._activeNodes.push(thunkOsc, thunkGain);

    // Phase 2: rattle — 80→120 Hz sawtooth, 0.2 s (starts after thunk)
    const rattleOsc = ctx.createOscillator();
    const rattleGain = ctx.createGain();
    rattleOsc.type = 'sawtooth';
    rattleOsc.frequency.setValueAtTime(80, now + 0.05);
    rattleOsc.frequency.linearRampToValueAtTime(120, now + 0.25);
    rattleGain.gain.setValueAtTime(0.15, now + 0.05);
    rattleGain.gain.linearRampToValueAtTime(0, now + 0.25);
    rattleOsc.connect(rattleGain);
    rattleGain.connect(dest);
    rattleOsc.start(now + 0.05);
    rattleOsc.stop(now + 0.25);
    this._activeNodes.push(rattleOsc, rattleGain);

    // Phase 3: ascending chime C5→E5 (523→659 Hz), 0.4 s
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime(523, now + 0.25);
    chimeOsc.frequency.linearRampToValueAtTime(659, now + 0.65);
    chimeGain.gain.setValueAtTime(0.4, now + 0.25);
    chimeGain.gain.linearRampToValueAtTime(0, now + 0.65);
    chimeOsc.connect(chimeGain);
    chimeGain.connect(dest);
    chimeOsc.start(now + 0.25);
    chimeOsc.stop(now + 0.65);
    this._activeNodes.push(chimeOsc, chimeGain);
  }

  /**
   * Play 3-note ascending stinger (C5–E5–G5) scheduled after the cup-sink sequence.
   * Called on BALL_IN_HOLE; stinger starts at now+0.7s so it follows the cup-sink (0.65s).
   */
  playHoleCompletionStinger() {
    const ctx = this._ctx;
    if (!ctx?.createOscillator) {
      return;
    }

    const dest = this._getMasterDest(ctx);
    // Offset past cup-sink end (0.65 s) with a small gap
    const base = ctx.currentTime + 0.7;
    const notes = [
      { freq: 523, offset: 0, dur: 0.25 }, // C5
      { freq: 659, offset: 0.28, dur: 0.25 }, // E5
      { freq: 784, offset: 0.56, dur: 0.35 } // G5
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = base + note.offset;
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.linearRampToValueAtTime(0, t + note.dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + note.dur);
      this._activeNodes.push(osc, gain);
    }
  }

  /**
   * Start the ambient drone: looping sawtooth at 60 Hz, gain 0.06.
   * No-op when muted, already started, or AudioContext is not available/running.
   */
  startAmbientDrone() {
    if (this._droneStarted || this.isMuted) {
      return;
    }
    const ctx = this._ctx;
    if (!ctx?.createOscillator || ctx.state === 'suspended') {
      return;
    }

    this._droneOsc = ctx.createOscillator();
    this._droneGain = ctx.createGain();
    const dest = this._getMasterDest(ctx);

    this._droneOsc.type = 'sawtooth';
    this._droneOsc.frequency.value = 60;

    // Fade in from silence to 0.06 over 2 s
    this._droneGain.gain.setValueAtTime(0, ctx.currentTime);
    this._droneGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2);

    this._droneOsc.connect(this._droneGain);
    this._droneGain.connect(dest);
    this._droneOsc.start();
    this._droneStarted = true;
    this._activeNodes.push(this._droneOsc, this._droneGain);
  }

  /**
   * Fade out and stop the ambient drone.
   * @param {number} fadeDuration - Seconds over which to fade to silence (default 2)
   */
  stopAmbientDrone(fadeDuration = 2) {
    if (!this._droneStarted || !this._droneGain) {
      return;
    }
    const ctx = this._ctx;
    if (!ctx) {
      return;
    }

    const now = ctx.currentTime;
    this._droneGain.gain.cancelScheduledValues(now);
    this._droneGain.gain.setValueAtTime(this._droneGain.gain.value, now);
    this._droneGain.gain.linearRampToValueAtTime(0, now + fadeDuration);

    if (this._droneOsc) {
      try {
        this._droneOsc.stop(now + fadeDuration);
      } catch {
        // Already stopped
      }
    }
    this._droneStarted = false;
  }

  /**
   * Get the current audio context state
   * @returns {string} The audio context state
   */
  getContextState() {
    if (this.audioListener && this.audioListener.context) {
      return this.audioListener.context.state;
    }
    return 'suspended';
  }

  /**
   * Resume a suspended AudioContext (required by browser autoplay policy).
   * Also starts the ambient drone if it hasn't started yet.
   */
  resumeContext() {
    const ctx = this._ctx;
    if (!ctx || ctx.state !== 'suspended') {
      return;
    }
    ctx
      .resume?.()
      .then(() => {
        this.startAmbientDrone();
      })
      .catch(err => {
        console.warn('[AudioManager] Failed to resume audio context:', err);
      });
  }

  /**
   * Set volume for all sounds
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume) {
    volume = Math.max(0, Math.min(1, volume));
    this.currentVolume = volume;

    for (const sound of Object.values(this.sounds)) {
      if (sound) {
        sound.setVolume(volume);
      }
    }

    try {
      localStorage.setItem(this.volumeStorageKey, String(volume));
    } catch {
      debug.log('[AudioManager] localStorage unavailable — volume not saved.');
    }
  }

  /**
   * Set master volume, apply to all gain nodes, and persist.
   * @param {number} level - Volume level (0.0 to 1.0)
   */
  setMasterVolume(level) {
    level = Math.max(0, Math.min(1, level));
    this.currentVolume = level;
    this.isMuted = level === 0;
    this.saveMuteState();

    // Update Web Audio master gain node
    if (this._masterGain) {
      this._masterGain.gain.value = level;
    }

    for (const sound of Object.values(this.sounds)) {
      if (sound) {
        sound.setVolume(level);
      }
    }

    try {
      localStorage.setItem(this.volumeStorageKey, String(level));
    } catch {
      debug.log('[AudioManager] localStorage unavailable — volume not saved.');
    }
  }

  /**
   * Get the current master volume level.
   * @returns {number} Current volume (0.0 to 1.0)
   */
  getMasterVolume() {
    return this.currentVolume;
  }

  /**
   * Load persisted volume from localStorage on init.
   */
  loadPersistedVolume() {
    try {
      const stored = localStorage.getItem(this.volumeStorageKey);
      if (stored !== null) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed)) {
          this.currentVolume = Math.max(0, Math.min(1, parsed));
        }
      }
    } catch {
      debug.log('[AudioManager] localStorage unavailable — volume not restored.');
    }
  }

  /**
   * Set muted state explicitly.
   * @param {boolean} muted - Whether to mute
   */
  setMuted(muted) {
    if (muted) {
      this.mute();
    } else {
      this.unmute();
    }
  }

  /**
   * Mute all sounds, preserving current volume for restore.
   */
  mute() {
    this.isMuted = true;
    this.saveMuteState();
    for (const sound of Object.values(this.sounds)) {
      if (sound) {
        sound.setVolume(0);
      }
    }
  }

  /**
   * Unmute and restore to persisted volume.
   */
  unmute() {
    this.isMuted = false;
    this.saveMuteState();
    const volume = this.currentVolume || 0.7;
    for (const sound of Object.values(this.sounds)) {
      if (sound) {
        sound.setVolume(volume);
      }
    }
  }

  /**
   * Toggle mute state
   * @returns {boolean} The new mute state
   */
  toggleMute() {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.isMuted;
  }

  /**
   * Save mute state to localStorage
   */
  saveMuteState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.isMuted));
    } catch {
      debug.log('[AudioManager] localStorage unavailable — mute state not saved.');
    }
  }

  /**
   * Restore mute state from localStorage
   */
  restoreMuteState() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored !== null) {
        this.isMuted = JSON.parse(stored) === true;
      }
    } catch {
      debug.log('[AudioManager] localStorage unavailable — mute state not restored.');
    }
  }

  /**
   * Clean up audio resources
   */
  cleanup() {
    // Stop and dispose of all sounds
    for (const soundName in this.sounds) {
      const sound = this.sounds[soundName];
      if (sound) {
        if (sound.isPlaying) {
          sound.stop();
        }
        // Note: disconnect() is not available in all environments/mocks
        if (sound.disconnect && typeof sound.disconnect === 'function') {
          sound.disconnect();
        }
      }
    }

    // Remove listener from camera
    if (this.audioListener && this.game && this.game.camera) {
      this.game.camera.remove(this.audioListener);
    }
  }

  /**
   * Disconnect all Web Audio nodes and unsubscribe events. Call instead of cleanup()
   * when tearing down the manager permanently.
   */
  destroy() {
    // Unsubscribe game events
    if (this.game?.eventManager?.unsubscribe) {
      if (this._onBallHit) {
        this.game.eventManager.unsubscribe(EventTypes.BALL_HIT, this._onBallHit);
      }
      if (this._onBallInHole) {
        this.game.eventManager.unsubscribe(EventTypes.BALL_IN_HOLE, this._onBallInHole);
      }
      if (this._onBallWallImpact) {
        this.game.eventManager.unsubscribe(EventTypes.BALL_WALL_IMPACT, this._onBallWallImpact);
      }
      if (this._onGameCompleted) {
        this.game.eventManager.unsubscribe(EventTypes.GAME_COMPLETED, this._onGameCompleted);
      }
    }
    this._onBallHit = null;
    this._onBallInHole = null;
    this._onBallWallImpact = null;
    this._onGameCompleted = null;

    // Stop ambient drone immediately
    this.stopAmbientDrone(0);

    // Disconnect master gain
    if (this._masterGain) {
      try {
        this._masterGain.disconnect?.();
      } catch {
        // Already disconnected
      }
      this._masterGain = null;
    }

    // Disconnect and release all tracked Web Audio nodes
    for (const node of this._activeNodes) {
      try {
        node.disconnect?.();
      } catch {
        // Already disconnected — safe to ignore
      }
    }
    this._activeNodes = [];

    this.cleanup();
  }
}
