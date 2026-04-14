/**
 * Unit tests for devHoleHarness — URL param parsing, isolation mode, dev harness flags.
 */

// We need to control process.env.NODE_ENV per test, so we use jest.isolateModules
// to get fresh module state for each test.

const { setUrlSearch } = require('./helpers/setUrlSearch');

const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
  setUrlSearch('');
});

beforeEach(() => {
  setUrlSearch('');
});

function loadHarness() {
  let mod;
  jest.isolateModules(() => {
    mod = require('../utils/devHoleHarness');
  });
  return mod;
}

describe('devHoleHarness', () => {
  describe('parseDevParams', () => {
    test('returns null holeNumber and false isolate in production', () => {
      process.env.NODE_ENV = 'production';
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result).toEqual({ holeNumber: null, isolate: false });
    });

    test('returns null holeNumber when no ?hole param', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('');
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result).toEqual({ holeNumber: null, isolate: false });
    });

    test('parses valid ?hole=5', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=5');
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.holeNumber).toBe(5);
      expect(result.isolate).toBe(false);
    });

    test('parses ?hole=1 (lower boundary)', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=1');
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.holeNumber).toBe(1);
    });

    test('parses ?hole=18 (upper boundary)', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=18');
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.holeNumber).toBe(18);
    });

    test('falls back to 1 for ?hole=0 (below range)', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=0');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.holeNumber).toBe(1);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('falls back to 1 for ?hole=19 (above range)', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=19');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.holeNumber).toBe(1);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('falls back to 1 for ?hole=abc (non-integer)', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=abc');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.holeNumber).toBe(1);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('falls back to 1 for ?hole=3.5 (non-integer float)', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=3.5');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.holeNumber).toBe(1);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('falls back to 1 for ?hole=-1 (negative)', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=-1');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.holeNumber).toBe(1);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('parses ?isolate=true', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=10&isolate=true');
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.holeNumber).toBe(10);
      expect(result.isolate).toBe(true);
    });

    test('isolate is false for ?isolate=false', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=5&isolate=false');
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.isolate).toBe(false);
    });

    test('isolate is false for ?isolate=1', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=5&isolate=1');
      const harness = loadHarness();
      const result = harness.parseDevParams(18);
      expect(result.isolate).toBe(false);
    });
  });

  describe('isIsolationMode', () => {
    test('returns false in production', () => {
      process.env.NODE_ENV = 'production';
      const harness = loadHarness();
      expect(harness.isIsolationMode()).toBe(false);
    });

    test('returns false when no isolation param', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=5');
      const harness = loadHarness();
      harness.parseDevParams(18);
      expect(harness.isIsolationMode()).toBe(false);
    });

    test('returns true after parsing ?isolate=true', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=5&isolate=true');
      const harness = loadHarness();
      harness.parseDevParams(18);
      expect(harness.isIsolationMode()).toBe(true);
    });
  });

  describe('setIsolationMode', () => {
    test('can enable isolation mode programmatically', () => {
      process.env.NODE_ENV = 'development';
      const harness = loadHarness();
      harness.setIsolationMode(true);
      expect(harness.isIsolationMode()).toBe(true);
    });

    test('can disable isolation mode programmatically', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?isolate=true');
      const harness = loadHarness();
      harness.parseDevParams(18);
      harness.setIsolationMode(false);
      expect(harness.isIsolationMode()).toBe(false);
    });

    test('no-ops in production', () => {
      process.env.NODE_ENV = 'production';
      const harness = loadHarness();
      harness.setIsolationMode(true);
      expect(harness.isIsolationMode()).toBe(false);
    });
  });

  describe('getInitialHoleNumber', () => {
    test('returns null in production', () => {
      process.env.NODE_ENV = 'production';
      const harness = loadHarness();
      expect(harness.getInitialHoleNumber()).toBe(null);
    });

    test('returns null when no hole param', () => {
      process.env.NODE_ENV = 'development';
      const harness = loadHarness();
      harness.parseDevParams(18);
      expect(harness.getInitialHoleNumber()).toBe(null);
    });

    test('returns parsed hole number', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?hole=12');
      const harness = loadHarness();
      harness.parseDevParams(18);
      expect(harness.getInitialHoleNumber()).toBe(12);
    });
  });

  describe('isDevHarnessActive', () => {
    test('returns true in development', () => {
      process.env.NODE_ENV = 'development';
      const harness = loadHarness();
      expect(harness.isDevHarnessActive()).toBe(true);
    });

    test('returns false in production', () => {
      process.env.NODE_ENV = 'production';
      const harness = loadHarness();
      expect(harness.isDevHarnessActive()).toBe(false);
    });
  });
});
