/**
 * Par Calibration Harness — dev-mode stroke logger and calibration report.
 * Gated behind process.env.NODE_ENV === 'development' and ?par_calibration=true URL param.
 */

const DEV_MODE = process.env.NODE_ENV === 'development';
const STORAGE_PREFIX = 'par_cal_';
const MIN_PAR = 2;

let calibrationActive = false;
let courseId = null;

/**
 * Initialize the calibration harness. Reads the URL param and sets up state.
 * @param {string} id - Course identifier (e.g. 'orbital_drift')
 */
export function initCalibration(id) {
  if (!DEV_MODE) {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  calibrationActive = params.get('par_calibration') === 'true';
  courseId = id;
}

/**
 * Whether calibration mode is currently active.
 * @returns {boolean}
 */
export function isCalibrationActive() {
  return DEV_MODE && calibrationActive;
}

/**
 * Build the localStorage key for a given hole number (1-based).
 * @param {number} holeNumber
 * @returns {string}
 */
export function getStorageKey(holeNumber) {
  return `${STORAGE_PREFIX}${courseId}_h${holeNumber}`;
}

/**
 * Record a stroke count for a completed hole.
 * Appends to the existing array in localStorage.
 * @param {number} holeNumber - 1-based hole number
 * @param {number} strokes - Number of strokes taken on this hole
 */
export function recordHoleStrokes(holeNumber, strokes) {
  if (!isCalibrationActive()) {
    return;
  }
  if (!Number.isInteger(holeNumber) || holeNumber < 1) {
    console.warn('[ParCalibration] Invalid hole number:', holeNumber);
    return;
  }
  if (!Number.isInteger(strokes) || strokes < 1) {
    console.warn('[ParCalibration] Invalid stroke count:', strokes);
    return;
  }

  const key = getStorageKey(holeNumber);
  let existing = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      existing = JSON.parse(raw);
      if (!Array.isArray(existing)) {
        existing = [];
      }
    }
  } catch (_e) {
    existing = [];
  }
  existing.push(strokes);
  localStorage.setItem(key, JSON.stringify(existing));
}

/**
 * Retrieve recorded stroke counts for a hole.
 * @param {number} holeNumber - 1-based hole number
 * @returns {number[]}
 */
export function getHoleData(holeNumber) {
  const key = getStorageKey(holeNumber);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (_e) {
    // corrupted data
  }
  return [];
}

/**
 * Generate the calibration report data for all holes.
 * @param {number[]} parValues - Array of par values indexed by hole (0-based)
 * @returns {object[]} Array of per-hole report entries
 */
export function generateReport(parValues) {
  const totalHoles = parValues.length;
  const report = [];

  for (let i = 0; i < totalHoles; i++) {
    const holeNumber = i + 1;
    const strokes = getHoleData(holeNumber);
    const currentPar = parValues[i];
    const mean = strokes.length > 0 ? strokes.reduce((a, b) => a + b, 0) / strokes.length : null;
    const suggestedPar = mean !== null ? Math.max(MIN_PAR, Math.ceil(mean)) : currentPar;
    const diff = Math.abs(currentPar - suggestedPar);

    report.push({
      hole: holeNumber,
      currentPar,
      strokes,
      mean: mean !== null ? Math.round(mean * 100) / 100 : null,
      suggestedPar,
      flagged: diff >= 1
    });
  }

  return report;
}

function buildReportTable(report) {
  const table = document.createElement('table');
  Object.assign(table.style, {
    width: '100%',
    maxWidth: '900px',
    margin: '20px auto',
    borderCollapse: 'collapse'
  });

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Hole', 'Current Par', 'Strokes', 'Mean', 'Suggested Par', 'Status'];
  for (const text of headers) {
    const th = document.createElement('th');
    th.textContent = text;
    Object.assign(th.style, {
      padding: '8px 12px',
      borderBottom: '2px solid #555',
      textAlign: 'left'
    });
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const entry of report) {
    const tr = document.createElement('tr');
    if (entry.flagged) {
      tr.style.backgroundColor = 'rgba(255, 100, 100, 0.2)';
    }

    const cells = [
      entry.hole,
      entry.currentPar,
      entry.strokes.length > 0 ? entry.strokes.join(', ') : '\u2014',
      entry.mean !== null ? entry.mean.toFixed(2) : '\u2014',
      entry.suggestedPar,
      entry.flagged ? 'ADJUST' : 'OK'
    ];

    for (const value of cells) {
      const td = document.createElement('td');
      td.textContent = value;
      Object.assign(td.style, {
        padding: '6px 12px',
        borderBottom: '1px solid #333'
      });
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function buildButtonBar(report, overlay) {
  const container = document.createElement('div');
  container.style.textAlign = 'center';
  container.style.marginTop = '16px';

  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy Report';
  Object.assign(copyButton.style, {
    padding: '10px 24px',
    fontSize: '16px',
    cursor: 'pointer',
    marginRight: '12px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '4px'
  });
  copyButton.addEventListener('click', () => {
    const json = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy Report';
      }, 2000);
    });
  });
  container.appendChild(copyButton);

  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  Object.assign(closeButton.style, {
    padding: '10px 24px',
    fontSize: '16px',
    cursor: 'pointer',
    backgroundColor: '#666',
    color: '#fff',
    border: 'none',
    borderRadius: '4px'
  });
  closeButton.addEventListener('click', () => {
    overlay.remove();
  });
  container.appendChild(closeButton);

  return container;
}

/**
 * Show the calibration report as a DOM overlay.
 * @param {number[]} parValues - Array of par values indexed by hole (0-based)
 */
export function showCalibrationOverlay(parValues) {
  if (!isCalibrationActive()) {
    return;
  }

  const existing = document.getElementById('par-calibration-overlay');
  if (existing) {
    existing.remove();
  }

  const report = generateReport(parValues);
  const overlay = document.createElement('div');
  overlay.id = 'par-calibration-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Par Calibration Report');
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: '#fff',
    zIndex: '10000',
    overflow: 'auto',
    fontFamily: 'monospace',
    padding: '20px',
    boxSizing: 'border-box'
  });

  const title = document.createElement('h2');
  title.textContent = 'Par Calibration Report';
  title.style.textAlign = 'center';
  overlay.appendChild(title);

  overlay.appendChild(buildReportTable(report));

  const totalsDiv = document.createElement('div');
  totalsDiv.style.textAlign = 'center';
  totalsDiv.style.margin = '16px 0';
  const frontNine = report.slice(0, 9).reduce((sum, e) => sum + e.currentPar, 0);
  const backNine = report.slice(9).reduce((sum, e) => sum + e.currentPar, 0);
  totalsDiv.textContent = `Front 9 par: ${frontNine} | Back 9 par: ${backNine} | Total: ${frontNine + backNine}`;
  overlay.appendChild(totalsDiv);

  overlay.appendChild(buildButtonBar(report, overlay));
  document.body.appendChild(overlay);
}
