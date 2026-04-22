const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard Tab/Shift-Tab focus within `container`.
 * Attach to the container's keydown event.
 */
export function trapFocus(e, container) {
  if (e.key !== 'Tab') {
    return;
  }
  const focusableElements = container.querySelectorAll(FOCUSABLE_SELECTOR);
  if (focusableElements.length === 0) {
    return;
  }
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
    }
  } else {
    if (document.activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
    }
  }
}
