/**
 * Unit tests for high score history overlay rendering.
 * Tests the HTML generation from mocked HighScoreManager data.
 */
import { HighScoreManager } from '../../game/HighScoreManager';

const COURSE_NAME = 'Orbital Drift';
const COURSE_PAR = 24;

function buildScoresHTML(scores) {
  if (scores.length === 0) {
    return '<p class="scores-empty">No rounds played yet</p>';
  }

  const rows = scores
    .map((score, i) => {
      const diff = score.totalStrokes - COURSE_PAR;
      let parText;
      let parClass;
      if (diff < 0) {
        parText = `${diff}`;
        parClass = 'score-under-par';
      } else if (diff > 0) {
        parText = `+${diff}`;
        parClass = 'score-over-par';
      } else {
        parText = 'E';
        parClass = 'score-even-par';
      }
      const date = new Date(score.timestamp).toLocaleDateString();
      return (
        '<tr>' +
        `<td>${i + 1}</td>` +
        `<td>${score.totalStrokes}</td>` +
        `<td class="${parClass}">${parText}</td>` +
        `<td>${date}</td>` +
        '</tr>'
      );
    })
    .join('');

  return (
    '<table class="scores-table">' +
    '<thead><tr><th>#</th><th>Strokes</th><th>+/- Par</th><th>Date</th></tr></thead>' +
    `<tbody>${rows}</tbody>` +
    '</table>'
  );
}

describe('ScoresOverlay', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(key => {
      return mockStorage[key] || null;
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(key => {
      delete mockStorage[key];
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should show empty-state message when no scores exist', () => {
    const scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    expect(html).toContain('scores-empty');
    expect(html).toContain('No rounds played yet');
  });

  test('should render correct number of rows from mocked data', () => {
    mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
      { totalStrokes: 28, courseName: COURSE_NAME, timestamp: 1700000000000 },
      { totalStrokes: 22, courseName: COURSE_NAME, timestamp: 1700100000000 },
      { totalStrokes: 30, courseName: COURSE_NAME, timestamp: 1700200000000 }
    ]);

    const scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    const rowCount = (html.match(/<tr>/g) || []).length;
    // 1 header row + 3 data rows
    expect(rowCount).toBe(4);
  });

  test('should sort rows best-first (ascending strokes)', () => {
    mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
      { totalStrokes: 30, courseName: COURSE_NAME, timestamp: 1700000000000 },
      { totalStrokes: 22, courseName: COURSE_NAME, timestamp: 1700100000000 },
      { totalStrokes: 28, courseName: COURSE_NAME, timestamp: 1700200000000 }
    ]);

    const scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    const strokesPattern = /<td>(\d+)<\/td><td class="/g;
    const strokeValues = [];
    let match;
    while ((match = strokesPattern.exec(html)) !== null) {
      strokeValues.push(parseInt(match[1], 10));
    }
    expect(strokeValues).toEqual([22, 28, 30]);
  });

  test('should display rank numbers starting at 1', () => {
    mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
      { totalStrokes: 28, courseName: COURSE_NAME, timestamp: 1700000000000 },
      { totalStrokes: 22, courseName: COURSE_NAME, timestamp: 1700100000000 }
    ]);

    const scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<td>2</td>');
  });

  test('should show under-par with negative number and correct class', () => {
    mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
      { totalStrokes: 20, courseName: COURSE_NAME, timestamp: 1700000000000 }
    ]);

    const scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    expect(html).toContain('score-under-par');
    expect(html).toContain('-4');
  });

  test('should show over-par with plus sign and correct class', () => {
    mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
      { totalStrokes: 30, courseName: COURSE_NAME, timestamp: 1700000000000 }
    ]);

    const scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    expect(html).toContain('score-over-par');
    expect(html).toContain('+6');
  });

  test('should show even-par as E with correct class', () => {
    mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
      { totalStrokes: 24, courseName: COURSE_NAME, timestamp: 1700000000000 }
    ]);

    const scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    expect(html).toContain('score-even-par');
    expect(html).toContain('>E<');
  });

  test('should include table headers for rank, strokes, par, and date', () => {
    mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
      { totalStrokes: 24, courseName: COURSE_NAME, timestamp: 1700000000000 }
    ]);

    const scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    expect(html).toContain('<th>#</th>');
    expect(html).toContain('<th>Strokes</th>');
    expect(html).toContain('<th>+/- Par</th>');
    expect(html).toContain('<th>Date</th>');
  });

  test('should exclude scores from other courses', () => {
    mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
      { totalStrokes: 24, courseName: COURSE_NAME, timestamp: 1700000000000 },
      { totalStrokes: 18, courseName: 'Other Course', timestamp: 1700100000000 },
      { totalStrokes: 28, courseName: COURSE_NAME, timestamp: 1700200000000 }
    ]);

    const scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    // 1 header row + 2 data rows (Other Course excluded)
    const rowCount = (html.match(/<tr>/g) || []).length;
    expect(rowCount).toBe(3);
    expect(html).not.toContain('>18<');
  });

  test('should show empty state after clearing scores', () => {
    mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
      { totalStrokes: 24, courseName: COURSE_NAME, timestamp: 1700000000000 }
    ]);

    let scores = HighScoreManager.getScores(COURSE_NAME);
    expect(scores).toHaveLength(1);

    HighScoreManager.clearScores(COURSE_NAME);

    scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    expect(html).toContain('scores-empty');
    expect(html).toContain('No rounds played yet');
  });

  test('should render a table when scores exist', () => {
    mockStorage['miniGolfBreak_highScores'] = JSON.stringify([
      { totalStrokes: 24, courseName: COURSE_NAME, timestamp: 1700000000000 }
    ]);

    const scores = HighScoreManager.getScores(COURSE_NAME);
    const html = buildScoresHTML(scores);

    expect(html).toContain('scores-table');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
  });
});
