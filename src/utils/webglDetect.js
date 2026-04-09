/**
 * WebGL availability detection and fallback UI.
 */

/**
 * Check if WebGL is available in the current browser.
 * @returns {boolean}
 */
export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/**
 * Show a user-friendly fallback message when WebGL is not supported.
 */
export function showWebGLFallback() {
  // Hide the menu screen so it doesn't overlap
  const menuScreen = document.getElementById('menu-screen');
  if (menuScreen) {
    menuScreen.style.display = 'none';
  }

  const container = document.getElementById('game-container');
  if (!container) {
    return;
  }

  const fallback = document.createElement('div');
  fallback.id = 'webgl-fallback';
  fallback.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;' +
    'display:flex;flex-direction:column;justify-content:center;align-items:center;' +
    'background:#000;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:20px;box-sizing:border-box;';

  const title = document.createElement('h1');
  title.textContent = 'WebGL Not Available';
  title.style.cssText = 'margin:0 0 16px;font-size:2em;color:#61dafb;';

  const message = document.createElement('p');
  message.textContent =
    'Mini Golf Break requires WebGL to run. Your browser or device does not appear to support it.';
  message.style.cssText = 'margin:0 0 24px;font-size:1.1em;max-width:500px;line-height:1.5;opacity:0.9;';

  const suggestions = document.createElement('ul');
  suggestions.style.cssText =
    'list-style:none;padding:0;margin:0;font-size:1em;max-width:500px;text-align:left;line-height:1.8;opacity:0.7;';
  const tips = [
    'Enable hardware acceleration in your browser settings',
    'Update your browser to the latest version',
    'Try a different browser (Chrome, Firefox, or Edge)',
    'Make sure your graphics drivers are up to date',
  ];
  tips.forEach((tip) => {
    const li = document.createElement('li');
    li.textContent = `\u2022 ${tip}`;
    suggestions.appendChild(li);
  });

  fallback.appendChild(title);
  fallback.appendChild(message);
  fallback.appendChild(suggestions);
  container.appendChild(fallback);
}
