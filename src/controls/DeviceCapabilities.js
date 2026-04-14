/**
 * Detects device capabilities for input optimization.
 */
export class DeviceCapabilities {
  constructor() {
    this.isMobile = this.detectMobile();
    this.supportsHaptics = this.detectHaptics();
    this.isHighPerformance = this.detectPerformance();
  }

  detectMobile() {
    if (typeof navigator !== 'undefined') {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    }
    return false;
  }

  detectHaptics() {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  detectPerformance() {
    if (typeof navigator !== 'undefined' && navigator.deviceMemory) {
      return navigator.deviceMemory >= 4;
    }
    return true;
  }

  triggerHapticFeedback(intensity = 'medium') {
    if (this.supportsHaptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      const durations = { light: 15, medium: 25, heavy: 50 };
      navigator.vibrate(durations[intensity] || 25);
    }
  }
}
