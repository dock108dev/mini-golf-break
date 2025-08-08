import { debug } from './debug';

/**
 * iOSOptimizations - iOS-specific optimizations and native features
 * Handles haptic feedback, performance scaling, and iOS-specific adaptations
 */
export class IOSOptimizations {
  constructor() {
    this.isCapacitorApp = this.detectCapacitor();
    this.isIOSDevice = this.detectiOS();
    this.hapticFeedback = null;
    this.device = null;
    this.initialized = false;
  }

  /**
   * Initialize iOS optimizations
   */
  async init() {
    if (this.initialized) {
      return;
    }

    try {
      if (this.isCapacitorApp) {
        // Import Capacitor plugins dynamically
        await this.initializeCapacitorPlugins();
        debug.log('[iOSOptimizations] Capacitor plugins initialized');
      }

      // Apply iOS-specific optimizations
      this.applyiOSOptimizations();
      this.optimizeForMobile();

      this.initialized = true;
      debug.log('[iOSOptimizations] Initialized successfully');
    } catch (error) {
      debug.warn('[iOSOptimizations] Failed to initialize:', error);
      // Continue without Capacitor features
      this.applyiOSOptimizations();
      this.optimizeForMobile();
      this.initialized = true;
    }
  }

  /**
   * Initialize Capacitor plugins
   */
  async initializeCapacitorPlugins() {
    try {
      // Dynamically import Capacitor plugins
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      const { Device } = await import('@capacitor/device');

      this.hapticFeedback = { Haptics, ImpactStyle };
      this.device = Device;

      // Test haptic feedback
      await this.testHaptics();
    } catch (error) {
      debug.warn('[iOSOptimizations] Capacitor plugins not available:', error);
      this.isCapacitorApp = false;
    }
  }

  /**
   * Test haptic feedback capability
   */
  async testHaptics() {
    if (!this.hapticFeedback) {
      return false;
    }

    try {
      // Try a light haptic feedback to test
      await this.hapticFeedback.Haptics.impact({ style: this.hapticFeedback.ImpactStyle.Light });
      debug.log('[iOSOptimizations] Haptic feedback available');
      return true;
    } catch (error) {
      debug.warn('[iOSOptimizations] Haptic feedback not available:', error);
      return false;
    }
  }

  /**
   * Trigger haptic feedback
   * @param {string} type - Type of haptic feedback ('light', 'medium', 'heavy', 'selection', 'success', 'warning', 'error')
   */
  async triggerHaptic(type = 'light') {
    if (!this.isIOSDevice) {
      return;
    }

    // Try Capacitor haptics first
    if (this.hapticFeedback && this.isCapacitorApp) {
      try {
        switch (type) {
          case 'light':
            await this.hapticFeedback.Haptics.impact({
              style: this.hapticFeedback.ImpactStyle.Light
            });
            break;
          case 'medium':
            await this.hapticFeedback.Haptics.impact({
              style: this.hapticFeedback.ImpactStyle.Medium
            });
            break;
          case 'heavy':
            await this.hapticFeedback.Haptics.impact({
              style: this.hapticFeedback.ImpactStyle.Heavy
            });
            break;
          case 'selection':
            await this.hapticFeedback.Haptics.selectionStart();
            await this.hapticFeedback.Haptics.selectionChanged();
            await this.hapticFeedback.Haptics.selectionEnd();
            break;
          case 'success':
            await this.hapticFeedback.Haptics.notification({ type: 'SUCCESS' });
            break;
          case 'warning':
            await this.hapticFeedback.Haptics.notification({ type: 'WARNING' });
            break;
          case 'error':
            await this.hapticFeedback.Haptics.notification({ type: 'ERROR' });
            break;
        }
        return;
      } catch (error) {
        debug.warn('[iOSOptimizations] Capacitor haptic failed:', error);
      }
    }

    // Fallback to web vibration API
    this.fallbackVibration(type);
  }

  /**
   * Fallback vibration using web API
   */
  fallbackVibration(type) {
    if (!navigator.vibrate) {
      return;
    }

    const patterns = {
      light: [50],
      medium: [100],
      heavy: [200],
      selection: [25, 25, 25],
      success: [100, 50, 100],
      warning: [150, 50, 150, 50, 150],
      error: [200, 100, 200, 100, 200]
    };

    const pattern = patterns[type] || patterns.light;
    navigator.vibrate(pattern);
  }

  /**
   * Apply iOS-specific optimizations
   */
  applyiOSOptimizations() {
    if (!this.isIOSDevice) {
      return;
    }

    // Prevent default iOS gestures that might interfere
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
    document.addEventListener('gestureend', e => e.preventDefault(), { passive: false });

    // Optimize viewport for iOS
    this.optimizeViewport();

    // Handle iOS safe areas
    this.handleSafeAreas();

    // Optimize scrolling behavior
    document.body.style.overscrollBehavior = 'none';
    // Keep the main CSS touchAction: none setting - don't override it

    // Prevent iOS rubber band scrolling more selectively
    document.addEventListener(
      'touchmove',
      e => {
        // Only prevent default on body/document, not on canvas or UI elements
        const target = e.target;
        if (target === document.body || target === document.documentElement) {
          // Allow touches on canvas and UI elements to pass through
          const isCanvasOrUI =
            target.tagName === 'CANVAS' ||
            target.closest('#ui-overlay') ||
            target.closest('.camera-controls-container');
          if (!isCanvasOrUI) {
            e.preventDefault();
          }
        }
      },
      { passive: false }
    );

    debug.log('[iOSOptimizations] iOS-specific optimizations applied');
  }

  /**
   * Optimize viewport for iOS
   */
  optimizeViewport() {
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
      viewport.content =
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, shrink-to-fit=no';
    }
  }

  /**
   * Handle iOS safe areas
   */
  handleSafeAreas() {
    // Add CSS custom properties for safe areas
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --safe-area-inset-top: env(safe-area-inset-top, 0px);
        --safe-area-inset-right: env(safe-area-inset-right, 0px);
        --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
        --safe-area-inset-left: env(safe-area-inset-left, 0px);
      }
      
      /* Apply safe area to camera controls */
      .camera-controls-container {
        bottom: calc(20px + var(--safe-area-inset-bottom));
        left: calc(20px + var(--safe-area-inset-left));
      }
      
      /* Apply safe area to other UI elements */
      #ui-container {
        padding-top: var(--safe-area-inset-top);
        padding-left: var(--safe-area-inset-left);
        padding-right: var(--safe-area-inset-right);
        padding-bottom: var(--safe-area-inset-bottom);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Optimize for mobile performance
   */
  optimizeForMobile() {
    // Disable selection on mobile
    document.onselectstart = () => false;
    document.onmousedown = () => false;

    // Optimize touch events
    document.addEventListener('touchstart', () => {}, { passive: true });
    document.addEventListener('touchmove', () => {}, { passive: true });
    document.addEventListener('touchend', () => {}, { passive: true });

    // Prevent context menu on long press
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Optimize for 120Hz displays
    if (window.screen && window.screen.orientation) {
      // Request high refresh rate if available
      try {
        if ('requestAnimationFrame' in window) {
          // Already optimized by Three.js
        }
      } catch (error) {
        debug.warn('[iOSOptimizations] High refresh rate optimization failed:', error);
      }
    }

    debug.log('[iOSOptimizations] Mobile optimizations applied');
  }

  /**
   * Get device performance tier for optimization
   */
  async getPerformanceTier() {
    if (!this.device || !this.isCapacitorApp) {
      return this.estimatePerformanceTier();
    }

    try {
      const info = await this.device.getInfo();
      const model = info.model.toLowerCase();

      // iOS device performance tiers based on chip
      if (model.includes('iphone')) {
        // iPhone performance tiers
        if (model.includes('15') || model.includes('14') || model.includes('13')) {
          return 'high'; // A15-A17 chips
        } else if (model.includes('12') || model.includes('11')) {
          return 'medium'; // A14-A13 chips
        } else {
          return 'low'; // Older devices
        }
      } else if (model.includes('ipad')) {
        // iPad performance tiers
        if (model.includes('pro') || model.includes('air')) {
          return 'high'; // iPad Pro/Air with M1/M2 or A12Z+
        } else {
          return 'medium'; // Regular iPad
        }
      }

      return 'medium'; // Default
    } catch (error) {
      debug.warn('[iOSOptimizations] Failed to get device info:', error);
      return this.estimatePerformanceTier();
    }
  }

  /**
   * Estimate performance tier without device API
   */
  estimatePerformanceTier() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');

    if (!gl) {
      return 'low';
    }

    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;

    // Simple heuristic based on available information
    if (cores >= 6 && memory >= 6) {
      return 'high';
    } else if (cores >= 4 && memory >= 4) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Apply performance optimizations based on device tier
   */
  async applyPerformanceOptimizations(cameraController, renderer) {
    const tier = await this.getPerformanceTier();

    debug.log(`[iOSOptimizations] Device performance tier: ${tier}`);

    switch (tier) {
      case 'high':
        // High-end device optimizations
        if (cameraController) {
          cameraController.setCameraTransitionSettings({
            transitionSpeed: 1.2,
            enableSmoothing: true
          });
        }
        if (renderer) {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
        }
        break;

      case 'medium':
        // Mid-range device optimizations
        if (cameraController) {
          cameraController.setCameraTransitionSettings({
            transitionSpeed: 1.0,
            enableSmoothing: true
          });
        }
        if (renderer) {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }
        break;

      case 'low':
        // Low-end device optimizations
        if (cameraController) {
          cameraController.setCameraTransitionSettings({
            transitionSpeed: 0.8,
            enableSmoothing: false
          });
        }
        if (renderer) {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        }
        break;
    }

    return tier;
  }

  /**
   * Detect if running in Capacitor app
   */
  detectCapacitor() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform());
  }

  /**
   * Detect iOS device
   */
  detectiOS() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }

  /**
   * Get platform info
   */
  getPlatformInfo() {
    return {
      isCapacitor: this.isCapacitorApp,
      isIOS: this.isIOSDevice,
      hasHaptics: !!this.hapticFeedback,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints
    };
  }

  /**
   * Cleanup
   */
  dispose() {
    // Remove any event listeners or cleanup
    this.hapticFeedback = null;
    this.device = null;
    this.initialized = false;
  }
}

// Export singleton instance
export const iOSOptimizations = new IOSOptimizations();
