import { debug } from '../utils/debug';
import * as THREE from 'three';

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
    this.currentVolume = 1.0;
    this.isMuted = false;
    this.storageKey = 'miniGolfBreak_audioMuted';

    // Audio cooldown tracking
    this.lastPlayTime = {}; // soundName → timestamp (ms)
    this.cooldownInterval = 100; // minimum ms between replays of same sound
    this.maxConcurrentMechanicSounds = 3;
    this.activeMechanicSounds = 0;

    // Restore mute state from localStorage
    this.restoreMuteState();

    // Initialize audio system
    this.init();
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
    if (lastTime === undefined) return false;
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

    // For testing, just mark as playing and call play
    this.sounds.hit.isPlaying = true;
    this.sounds.hit.play();

    // In a real implementation, we would use the Web Audio API
    if (this.sounds.hit.context) {
      // Create new oscillator each time for hit sound
      const oscillator = this.sounds.hit.context.createOscillator();
      const gain = this.sounds.hit.context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(220, this.sounds.hit.context.currentTime);

      gain.gain.setValueAtTime(0, this.sounds.hit.context.currentTime);
      gain.gain.linearRampToValueAtTime(0.3 * volume, this.sounds.hit.context.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, this.sounds.hit.context.currentTime + 0.3);

      oscillator.connect(gain);
      gain.connect(this.sounds.hit.context.destination);

      oscillator.start();
      oscillator.stop(this.sounds.hit.context.currentTime + 0.3);
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

    // For testing, just mark as playing and call play
    this.sounds.success.isPlaying = true;
    this.sounds.success.play();

    // In a real implementation, we would use the Web Audio API
    if (this.sounds.success.context) {
      // Create new oscillator each time for success sound
      const oscillator = this.sounds.success.context.createOscillator();
      const gain = this.sounds.success.context.createGain();

      oscillator.type = 'sine';

      // Rising tone for success
      oscillator.frequency.setValueAtTime(440, this.sounds.success.context.currentTime);
      oscillator.frequency.linearRampToValueAtTime(
        880,
        this.sounds.success.context.currentTime + 0.3
      );

      gain.gain.setValueAtTime(0, this.sounds.success.context.currentTime);
      gain.gain.linearRampToValueAtTime(
        0.4 * volume,
        this.sounds.success.context.currentTime + 0.1
      );
      gain.gain.linearRampToValueAtTime(0, this.sounds.success.context.currentTime + 0.5);

      oscillator.connect(gain);
      gain.connect(this.sounds.success.context.destination);

      oscillator.start();
      oscillator.stop(this.sounds.success.context.currentTime + 0.5);
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Low thud with fast decay
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.4 * volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }

    setTimeout(() => {
      this.sounds.gateClose.isPlaying = false;
    }, 200);
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
   * Resume the audio context if it's suspended
   */
  resumeContext() {
    if (
      this.audioListener &&
      this.audioListener.context &&
      this.audioListener.context.state === 'suspended'
    ) {
      // In a real implementation, we would call context.resume()
      // For now, just log the action
      debug.log('[AudioManager] Would resume audio context');
    }
  }

  /**
   * Set volume for all sounds
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume) {
    // Clamp volume between 0 and 1
    volume = Math.max(0, Math.min(1, volume));
    this.currentVolume = volume;

    for (const sound of Object.values(this.sounds)) {
      if (sound) {
        sound.setVolume(volume);
      }
    }
  }

  /**
   * Mute all sounds
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
   * Unmute and restore volume
   */
  unmute() {
    this.isMuted = false;
    this.saveMuteState();
    const volume = this.currentVolume || 1.0;
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
}
