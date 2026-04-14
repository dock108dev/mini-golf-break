const webpackConfigFactory = require('../../webpack.config.js');

describe('Webpack Performance Budget', () => {
  test('production build sets performance hints to error', () => {
    const config = webpackConfigFactory({}, { mode: 'production' });
    expect(config.performance.hints).toBe('error');
  });

  test('production build sets maxEntrypointSize to 409600 (400KB)', () => {
    const config = webpackConfigFactory({}, { mode: 'production' });
    expect(config.performance.maxEntrypointSize).toBe(409600);
  });

  test('production build sets maxAssetSize to 800000', () => {
    const config = webpackConfigFactory({}, { mode: 'production' });
    expect(config.performance.maxAssetSize).toBe(800000);
  });

  test('production assetFilter excludes images and split vendor chunks', () => {
    const config = webpackConfigFactory({}, { mode: 'production' });
    const filter = config.performance.assetFilter;

    expect(filter('main.abc123.js')).toBe(true);
    expect(filter('runtime.abc123.js')).toBe(true);

    expect(filter('three.abc123.js')).toBe(false);
    expect(filter('cannon.abc123.js')).toBe(false);
    expect(filter('vendors.abc123.js')).toBe(false);
    expect(filter('logo.png')).toBe(false);
    expect(filter('background.jpg')).toBe(false);
  });

  test('development build sets performance hints to warning', () => {
    const config = webpackConfigFactory({}, { mode: 'development' });
    expect(config.performance.hints).toBe('warning');
  });

  test('development build sets maxEntrypointSize to 409600 (400KB)', () => {
    const config = webpackConfigFactory({}, { mode: 'development' });
    expect(config.performance.maxEntrypointSize).toBe(409600);
  });
});
