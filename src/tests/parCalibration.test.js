/**
 * Unit tests for parCalibration — URL param parsing, localStorage recording, report generation.
 */

const { setUrlSearch } = require('./helpers/setUrlSearch');

const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
  setUrlSearch('');
  localStorage.clear();
  if (global.document._elements) {
    for (const key of Object.keys(global.document._elements)) {
      delete global.document._elements[key];
    }
  }
});

beforeEach(() => {
  setUrlSearch('');
  localStorage.clear();
  if (global.document._elements) {
    for (const key of Object.keys(global.document._elements)) {
      delete global.document._elements[key];
    }
  }
});

function loadCalibration() {
  let mod;
  jest.isolateModules(() => {
    mod = require('../utils/parCalibration');
  });
  return mod;
}

describe('parCalibration', () => {
  describe('initCalibration + isCalibrationActive', () => {
    test('inactive in production mode', () => {
      process.env.NODE_ENV = 'production';
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      expect(cal.isCalibrationActive()).toBe(false);
    });

    test('inactive when URL param missing', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      expect(cal.isCalibrationActive()).toBe(false);
    });

    test('active when par_calibration=true in dev mode', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      expect(cal.isCalibrationActive()).toBe(true);
    });

    test('inactive when par_calibration=false', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=false');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      expect(cal.isCalibrationActive()).toBe(false);
    });
  });

  describe('getStorageKey', () => {
    test('generates correct key format', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('orbital_drift');
      expect(cal.getStorageKey(3)).toBe('par_cal_orbital_drift_h3');
    });
  });

  describe('recordHoleStrokes', () => {
    test('records strokes to localStorage when active', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      cal.recordHoleStrokes(1, 3);
      cal.recordHoleStrokes(1, 4);

      const stored = JSON.parse(localStorage.getItem('par_cal_test_course_h1'));
      expect(stored).toEqual([3, 4]);
    });

    test('does not record when inactive', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      cal.recordHoleStrokes(1, 3);
      expect(localStorage.getItem('par_cal_test_course_h1')).toBeNull();
    });

    test('rejects invalid hole number', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      cal.recordHoleStrokes(0, 3);
      cal.recordHoleStrokes(-1, 3);
      cal.recordHoleStrokes(1.5, 3);
      expect(localStorage.getItem('par_cal_test_course_h0')).toBeNull();
      expect(localStorage.getItem('par_cal_test_course_h-1')).toBeNull();
    });

    test('rejects invalid stroke count', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      cal.recordHoleStrokes(1, 0);
      cal.recordHoleStrokes(1, -1);
      expect(localStorage.getItem('par_cal_test_course_h1')).toBeNull();
    });

    test('appends to existing data', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      localStorage.setItem('par_cal_test_course_h5', JSON.stringify([2, 3]));
      cal.recordHoleStrokes(5, 4);

      const stored = JSON.parse(localStorage.getItem('par_cal_test_course_h5'));
      expect(stored).toEqual([2, 3, 4]);
    });

    test('handles corrupted localStorage data gracefully', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      localStorage.setItem('par_cal_test_course_h1', 'not-json');
      cal.recordHoleStrokes(1, 3);

      const stored = JSON.parse(localStorage.getItem('par_cal_test_course_h1'));
      expect(stored).toEqual([3]);
    });
  });

  describe('getHoleData', () => {
    test('returns empty array when no data', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      expect(cal.getHoleData(1)).toEqual([]);
    });

    test('returns stored data', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      localStorage.setItem('par_cal_test_course_h2', JSON.stringify([3, 4, 5]));
      expect(cal.getHoleData(2)).toEqual([3, 4, 5]);
    });

    test('returns empty array on corrupted data', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      localStorage.setItem('par_cal_test_course_h1', '{bad');
      expect(cal.getHoleData(1)).toEqual([]);
    });
  });

  describe('generateReport', () => {
    test('generates correct report for holes with data', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');

      localStorage.setItem('par_cal_test_course_h1', JSON.stringify([2, 3, 2]));
      localStorage.setItem('par_cal_test_course_h2', JSON.stringify([5, 6, 5]));

      const report = cal.generateReport([2, 3]);
      expect(report).toHaveLength(2);

      expect(report[0].hole).toBe(1);
      expect(report[0].currentPar).toBe(2);
      expect(report[0].strokes).toEqual([2, 3, 2]);
      expect(report[0].mean).toBeCloseTo(2.33, 1);
      expect(report[0].suggestedPar).toBe(3);
      expect(report[0].flagged).toBe(true);

      expect(report[1].hole).toBe(2);
      expect(report[1].currentPar).toBe(3);
      expect(report[1].strokes).toEqual([5, 6, 5]);
      expect(report[1].mean).toBeCloseTo(5.33, 1);
      expect(report[1].suggestedPar).toBe(6);
      expect(report[1].flagged).toBe(true);
    });

    test('uses currentPar as suggestedPar when no data', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');

      const report = cal.generateReport([3]);
      expect(report[0].mean).toBeNull();
      expect(report[0].suggestedPar).toBe(3);
      expect(report[0].flagged).toBe(false);
    });

    test('enforces minimum par of 2', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      localStorage.setItem('par_cal_test_course_h1', JSON.stringify([1, 1, 1]));

      const report = cal.generateReport([2]);
      expect(report[0].suggestedPar).toBe(2);
    });

    test('not flagged when par matches suggested', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');
      localStorage.setItem('par_cal_test_course_h1', JSON.stringify([3, 3, 3]));

      const report = cal.generateReport([3]);
      expect(report[0].suggestedPar).toBe(3);
      expect(report[0].flagged).toBe(false);
    });
  });

  describe('showCalibrationOverlay', () => {
    test('creates overlay DOM element when active', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');

      cal.showCalibrationOverlay([2, 3]);
      const overlay = document.getElementById('par-calibration-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay.getAttribute('role')).toBe('dialog');
    });

    test('does not create overlay when inactive', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('');
      const cal = loadCalibration();
      cal.initCalibration('test_course');

      cal.showCalibrationOverlay([2, 3]);
      const overlay = document.getElementById('par-calibration-overlay');
      expect(overlay).toBeNull();
    });

    test('overlay is appended to document body', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');

      cal.showCalibrationOverlay([2]);
      expect(document.body.appendChild).toHaveBeenCalled();
      const overlay = document.getElementById('par-calibration-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay.id).toBe('par-calibration-overlay');
    });

    test('overlay contains child elements for table and buttons', () => {
      process.env.NODE_ENV = 'development';
      setUrlSearch('?par_calibration=true');
      const cal = loadCalibration();
      cal.initCalibration('test_course');

      cal.showCalibrationOverlay([2, 3]);
      const overlay = document.getElementById('par-calibration-overlay');
      expect(overlay.children.length).toBeGreaterThanOrEqual(3);
    });
  });
});
