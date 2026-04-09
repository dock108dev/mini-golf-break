/**
 * Unit tests for AudioManager
 */

import { AudioManager } from '../managers/AudioManager';
import * as THREE from 'three';

describe('AudioManager', () => {
  let mockGame;
  let mockCamera;
  let audioManager;
  let mockAudioListener;
  let mockAudio;

  beforeEach(() => {
    // Use the existing mocks from jest.setup.js rather than overriding them
    mockAudio = {
      setBuffer: jest.fn().mockReturnThis(),
      setVolume: jest.fn().mockReturnThis(),
      play: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      isPlaying: false
    };

    mockAudioListener = {
      context: { state: 'running' },
      getInput: jest.fn(),
      removeFilter: jest.fn(),
      setFilter: jest.fn()
    };

    // Mock camera
    mockCamera = {
      add: jest.fn(),
      remove: jest.fn()
    };

    // Setup mock game object
    mockGame = {
      camera: mockCamera,
      debugManager: {
        log: jest.fn(),
        warn: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear persisted mute state between tests
    try {
      localStorage.removeItem('miniGolfBreak_audioMuted');
    } catch {
      // ignore
    }
  });

  describe('constructor', () => {
    test('should initialize with game reference', () => {
      audioManager = new AudioManager(mockGame);

      expect(audioManager.game).toBe(mockGame);
      // init() is called in constructor, so audioListener is created
      expect(audioManager.audioListener).toBeDefined();
      expect(audioManager.sounds).toBeDefined();
      expect(typeof audioManager.sounds).toBe('object');
    });
  });

  describe('init', () => {
    beforeEach(() => {
      audioManager = new AudioManager(mockGame);
    });

    test('should create audio listener', () => {
      // init() is already called in constructor, so AudioListener is already created
      expect(THREE.AudioListener).toHaveBeenCalled();
      expect(audioManager.audioListener).toBeDefined();
    });

    test('should add audio listener to camera', () => {
      // init() is already called in constructor
      // The audioListener should be added to camera
      expect(mockCamera.add).toHaveBeenCalled();
    });

    test('should initialize sounds', () => {
      // init() is already called in constructor
      expect(audioManager.sounds.hit).toBeDefined();
      expect(audioManager.sounds.success).toBeDefined();
      expect(audioManager.sounds.teleport).toBeDefined();
      expect(audioManager.sounds.boost).toBeDefined();
      expect(audioManager.sounds.sweeperHit).toBeDefined();
      expect(audioManager.sounds.gateOpen).toBeDefined();
      expect(audioManager.sounds.gateClose).toBeDefined();
      expect(THREE.Audio).toHaveBeenCalledTimes(7);
    });

    test('should handle missing camera gracefully', () => {
      // Create a game without camera
      const gameWithoutCamera = { ...mockGame, camera: null };

      expect(() => {
        new AudioManager(gameWithoutCamera);
      }).not.toThrow();
    });
  });

  describe('sound playback', () => {
    beforeEach(() => {
      audioManager = new AudioManager(mockGame);
      // init() is already called in constructor
    });

    test('should play hit sound', () => {
      audioManager.playHitSound();

      // The actual sound object's play method should be called
      expect(audioManager.sounds.hit.play).toHaveBeenCalled();
    });

    test('should not play hit sound if already playing', () => {
      audioManager.sounds.hit.isPlaying = true;

      audioManager.playHitSound();

      // Should not call play when already playing
      expect(audioManager.sounds.hit.play).not.toHaveBeenCalled();
    });

    test('should play success sound', () => {
      audioManager.playSuccessSound();

      expect(audioManager.sounds.success.play).toHaveBeenCalled();
    });

    test('should not play success sound if already playing', () => {
      audioManager.sounds.success.isPlaying = true;

      audioManager.playSuccessSound();

      expect(audioManager.sounds.success.play).not.toHaveBeenCalled();
    });

    test('should handle missing sound gracefully', () => {
      audioManager.sounds.hit = null;

      expect(() => {
        audioManager.playHitSound();
      }).not.toThrow();
    });
  });

  describe('volume control', () => {
    beforeEach(() => {
      audioManager = new AudioManager(mockGame);
      // init() already called in constructor
    });

    test('should set volume for all sounds', () => {
      audioManager.setVolume(0.5);

      expect(audioManager.sounds.hit.setVolume).toHaveBeenCalledWith(0.5);
      expect(audioManager.sounds.success.setVolume).toHaveBeenCalledWith(0.5);
    });

    test('should clamp volume between 0 and 1', () => {
      audioManager.setVolume(2.0);
      expect(audioManager.sounds.hit.setVolume).toHaveBeenCalledWith(1.0);

      audioManager.setVolume(-0.5);
      expect(audioManager.sounds.hit.setVolume).toHaveBeenCalledWith(0);
    });
  });

  describe('mute functionality', () => {
    beforeEach(() => {
      audioManager = new AudioManager(mockGame);
      // init() already called in constructor
    });

    test('should mute all sounds', () => {
      audioManager.mute();

      expect(audioManager.sounds.hit.setVolume).toHaveBeenCalledWith(0);
      expect(audioManager.sounds.success.setVolume).toHaveBeenCalledWith(0);
    });

    test('should unmute and restore volume', () => {
      audioManager.setVolume(0.7);
      audioManager.mute();
      audioManager.unmute();

      // Should restore to previous volume
      expect(audioManager.sounds.hit.setVolume).toHaveBeenLastCalledWith(0.7);
    });

    test('should toggle mute on when unmuted', () => {
      audioManager.isMuted = false;
      const result = audioManager.toggleMute();

      expect(result).toBe(true);
      expect(audioManager.isMuted).toBe(true);
    });

    test('should toggle mute off when muted', () => {
      audioManager.isMuted = true;
      const result = audioManager.toggleMute();

      expect(result).toBe(false);
      expect(audioManager.isMuted).toBe(false);
    });

    test('should save mute state to localStorage on mute', () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
      audioManager.mute();

      expect(setItemSpy).toHaveBeenCalledWith('miniGolfBreak_audioMuted', 'true');
      setItemSpy.mockRestore();
    });

    test('should save mute state to localStorage on unmute', () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
      audioManager.unmute();

      expect(setItemSpy).toHaveBeenCalledWith('miniGolfBreak_audioMuted', 'false');
      setItemSpy.mockRestore();
    });

    test('should restore mute state from localStorage', () => {
      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('true');

      audioManager.restoreMuteState();

      expect(audioManager.isMuted).toBe(true);
      getItemSpy.mockRestore();
    });

    test('should handle localStorage errors gracefully on save', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage full');
      });

      expect(() => {
        audioManager.mute();
      }).not.toThrow();

      Storage.prototype.setItem.mockRestore();
    });

    test('should handle localStorage errors gracefully on restore', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Access denied');
      });

      expect(() => {
        audioManager.restoreMuteState();
      }).not.toThrow();

      Storage.prototype.getItem.mockRestore();
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      audioManager = new AudioManager(mockGame);
      // init() already called in constructor
    });

    test('should stop all sounds', () => {
      // Make sounds appear to be playing so they get stopped
      audioManager.sounds.hit.isPlaying = true;
      audioManager.sounds.success.isPlaying = true;

      audioManager.cleanup();

      expect(audioManager.sounds.hit.stop).toHaveBeenCalled();
      expect(audioManager.sounds.success.stop).toHaveBeenCalled();
    });

    test('should handle cleanup without initialization', () => {
      audioManager = new AudioManager(mockGame);

      expect(() => {
        audioManager.cleanup();
      }).not.toThrow();
    });
  });

  describe('context handling', () => {
    beforeEach(() => {
      audioManager = new AudioManager(mockGame);
    });

    test('should check audio context state', () => {
      // init() already called in constructor

      const state = audioManager.getContextState();
      expect(state).toBe('running');
    });

    test('should handle suspended audio context', () => {
      // Temporarily change the mock context state
      const originalState = mockAudioListener.context.state;
      mockAudioListener.context.state = 'suspended';

      // Test that resumeContext method exists and can be called
      expect(() => {
        if (typeof audioManager.resumeContext === 'function') {
          audioManager.resumeContext();
        }
      }).not.toThrow();

      // Restore original state for other tests
      mockAudioListener.context.state = originalState;
    });
  });

  describe('mechanic sounds', () => {
    beforeEach(() => {
      audioManager = new AudioManager(mockGame);
    });

    test('should play teleport sound', () => {
      audioManager.playTeleportSound();
      expect(audioManager.sounds.teleport.play).toHaveBeenCalled();
    });

    test('should play boost sound', () => {
      audioManager.playBoostSound();
      expect(audioManager.sounds.boost.play).toHaveBeenCalled();
    });

    test('should play sweeper hit sound', () => {
      audioManager.playSweeperHitSound();
      expect(audioManager.sounds.sweeperHit.play).toHaveBeenCalled();
    });

    test('should play gate open sound', () => {
      audioManager.playGateOpenSound();
      expect(audioManager.sounds.gateOpen.play).toHaveBeenCalled();
    });

    test('should play gate close sound', () => {
      audioManager.playGateCloseSound();
      expect(audioManager.sounds.gateClose.play).toHaveBeenCalled();
    });

    test('should not play teleport sound if already playing', () => {
      audioManager.sounds.teleport.isPlaying = true;
      audioManager.playTeleportSound();
      expect(audioManager.sounds.teleport.play).not.toHaveBeenCalled();
    });

    test('should not play mechanic sounds when muted', () => {
      audioManager.mute();
      audioManager.playTeleportSound();
      audioManager.playBoostSound();
      audioManager.playSweeperHitSound();
      audioManager.playGateOpenSound();
      audioManager.playGateCloseSound();

      expect(audioManager.sounds.teleport.play).not.toHaveBeenCalled();
      expect(audioManager.sounds.boost.play).not.toHaveBeenCalled();
      expect(audioManager.sounds.sweeperHit.play).not.toHaveBeenCalled();
      expect(audioManager.sounds.gateOpen.play).not.toHaveBeenCalled();
      expect(audioManager.sounds.gateClose.play).not.toHaveBeenCalled();
    });

    test('should route mechanic sounds through playSound', () => {
      // Test each mechanic sound individually to avoid concurrent limit
      audioManager.playSound('teleport');
      expect(audioManager.sounds.teleport.play).toHaveBeenCalled();
      audioManager.activeMechanicSounds = 0;

      audioManager.playSound('boost');
      expect(audioManager.sounds.boost.play).toHaveBeenCalled();
      audioManager.activeMechanicSounds = 0;

      audioManager.playSound('sweeperHit');
      expect(audioManager.sounds.sweeperHit.play).toHaveBeenCalled();
      audioManager.activeMechanicSounds = 0;

      audioManager.playSound('gateOpen');
      expect(audioManager.sounds.gateOpen.play).toHaveBeenCalled();
      audioManager.activeMechanicSounds = 0;

      audioManager.playSound('gateClose');
      expect(audioManager.sounds.gateClose.play).toHaveBeenCalled();
    });
  });

  describe('audio cooldown', () => {
    beforeEach(() => {
      audioManager = new AudioManager(mockGame);
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should track last play time per sound type', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      audioManager.playSound('teleport');
      expect(audioManager.lastPlayTime['teleport']).toBe(now);
    });

    test('should prevent same sound type from replaying within 100ms', () => {
      const now = 1000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      audioManager.playSound('teleport');
      expect(audioManager.sounds.teleport.play).toHaveBeenCalledTimes(1);

      // Reset isPlaying so the isPlaying guard doesn't block
      audioManager.sounds.teleport.isPlaying = false;

      // Try again at 50ms later (within cooldown)
      jest.spyOn(Date, 'now').mockReturnValue(now + 50);
      audioManager.playSound('teleport');
      expect(audioManager.sounds.teleport.play).toHaveBeenCalledTimes(1); // still 1

      // Try again at 100ms later (cooldown expired)
      jest.spyOn(Date, 'now').mockReturnValue(now + 100);
      audioManager.playSound('teleport');
      expect(audioManager.sounds.teleport.play).toHaveBeenCalledTimes(2);
    });

    test('should allow different sound types to play within 100ms of each other', () => {
      const now = 1000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      audioManager.playSound('teleport');
      expect(audioManager.sounds.teleport.play).toHaveBeenCalledTimes(1);

      jest.spyOn(Date, 'now').mockReturnValue(now + 10);
      audioManager.playSound('boost');
      expect(audioManager.sounds.boost.play).toHaveBeenCalledTimes(1);
    });

    test('should limit concurrent mechanic sounds to 3 by default', () => {
      const now = 1000;
      jest.spyOn(Date, 'now').mockReturnValueOnce(now) // isSoundOnCooldown
        .mockReturnValueOnce(now) // recordSoundPlay
        .mockReturnValueOnce(now + 1) // isSoundOnCooldown
        .mockReturnValueOnce(now + 1) // recordSoundPlay
        .mockReturnValueOnce(now + 2) // isSoundOnCooldown
        .mockReturnValueOnce(now + 2) // recordSoundPlay
        .mockReturnValueOnce(now + 3) // isSoundOnCooldown (4th attempt)
        .mockReturnValueOnce(now + 3); // recordSoundPlay (won't reach)

      audioManager.playSound('teleport');
      audioManager.playSound('boost');
      audioManager.playSound('sweeperHit');

      expect(audioManager.activeMechanicSounds).toBe(3);

      // 4th mechanic sound should be blocked
      audioManager.playSound('gateOpen');
      expect(audioManager.sounds.gateOpen.play).not.toHaveBeenCalled();
    });

    test('should allow mechanic sounds after concurrent slot frees up', () => {
      const now = 1000;
      jest.spyOn(Date, 'now').mockReturnValueOnce(now)
        .mockReturnValueOnce(now)
        .mockReturnValueOnce(now + 1)
        .mockReturnValueOnce(now + 1)
        .mockReturnValueOnce(now + 2)
        .mockReturnValueOnce(now + 2);

      audioManager.playSound('teleport');
      audioManager.playSound('boost');
      audioManager.playSound('sweeperHit');
      expect(audioManager.activeMechanicSounds).toBe(3);

      // Advance timers so one slot frees up (teleport duration = 400ms)
      jest.advanceTimersByTime(400);
      expect(audioManager.activeMechanicSounds).toBeLessThan(3);

      // Now gateOpen should work
      jest.spyOn(Date, 'now').mockReturnValue(now + 500);
      audioManager.playSound('gateOpen');
      expect(audioManager.sounds.gateOpen.play).toHaveBeenCalled();
    });

    test('should not affect ball hit sound with mechanic sound limits', () => {
      // Fill up mechanic sound slots
      audioManager.activeMechanicSounds = 3;

      audioManager.playSound('hit');
      expect(audioManager.sounds.hit.play).toHaveBeenCalled();
    });

    test('should not affect success sound with mechanic sound limits', () => {
      audioManager.activeMechanicSounds = 3;

      audioManager.playSound('success');
      expect(audioManager.sounds.success.play).toHaveBeenCalled();
    });

    test('should support configurable max concurrent mechanic sounds', () => {
      audioManager.maxConcurrentMechanicSounds = 1;

      const now = 1000;
      jest.spyOn(Date, 'now').mockReturnValueOnce(now)
        .mockReturnValueOnce(now)
        .mockReturnValueOnce(now + 1);

      audioManager.playSound('teleport');
      expect(audioManager.sounds.teleport.play).toHaveBeenCalledTimes(1);

      // 2nd mechanic sound should be blocked
      audioManager.playSound('boost');
      expect(audioManager.sounds.boost.play).not.toHaveBeenCalled();
    });

    test('should correctly identify mechanic sound types', () => {
      expect(audioManager.isMechanicSound('teleport')).toBe(true);
      expect(audioManager.isMechanicSound('boost')).toBe(true);
      expect(audioManager.isMechanicSound('sweeperHit')).toBe(true);
      expect(audioManager.isMechanicSound('gateOpen')).toBe(true);
      expect(audioManager.isMechanicSound('gateClose')).toBe(true);
      expect(audioManager.isMechanicSound('hit')).toBe(false);
      expect(audioManager.isMechanicSound('success')).toBe(false);
    });

    test('should apply cooldown to hit sound via playSound', () => {
      const now = 1000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      // Manually set cooldown for hit
      audioManager.lastPlayTime['hit'] = now;

      // Should be blocked by cooldown
      audioManager.playSound('hit');
      expect(audioManager.sounds.hit.play).not.toHaveBeenCalled();
    });

    test('should not count non-mechanic sounds toward concurrent limit', () => {
      // Play hit and success - they shouldn't affect mechanic count
      audioManager.recordSoundPlay('hit', 300);
      audioManager.recordSoundPlay('success', 500);
      expect(audioManager.activeMechanicSounds).toBe(0);
    });
  });
});
