import {
  agentsTable,
  commitsTable,
  contributorsTable,
  cycleTable,
  trafficTable,
} from './insights-tables';

const day = (iso: string): number => Date.parse(iso);

describe('insights tables', () => {
  it('lists each week’s commits and its busiest day', () => {
    const table = commitsTable(
      [
        { start: day('2026-09-27T00:00:00Z'), total: 0, days: [0, 0, 0, 0, 0, 0, 0] },
        { start: day('2026-10-04T00:00:00Z'), total: 5, days: [0, 0, 4, 1, 0, 0, 0] },
      ],
      'en-US',
    );

    expect(table.columns).toEqual(['Week of', 'Commits', 'Busiest day']);
    expect(table.rows.map((row) => row.cells)).toEqual([
      ['Sep 27', '0', '—'],
      ['Oct 4', '5', 'Tue, 4 commits'],
    ]);
  });

  it('lists each week’s merges, closes and median time to merge', () => {
    const end = day('2026-10-08T12:00:00Z');
    const table = cycleTable(
      [{ start: end - 7 * 86_400_000, end, merged: 2, closed: 1, medianCycleHours: 30 }],
      'en-US',
    );

    expect(table.rows[0].cells).toEqual(['Oct 8', '2', '1', '30.0 h']);
  });

  it('lists each contributor’s commits and lines', () => {
    const table = contributorsTable([
      { login: 'claude', isBot: true, commits: 4, additions: 40, deletions: 3 },
    ]);

    expect(table.rows).toEqual([{ key: 'claude', cells: ['claude (bot)', '4', '40', '3'] }]);
  });

  it('lists each agent’s merges and closes', () => {
    const table = agentsTable([{ agent: 'builder', merged: 3, closed: 0, medianCycleHours: null }]);

    expect(table.rows[0].cells).toEqual(['builder', '3', '0', '—']);
  });

  it('puts views and clones side by side a day, a day only one lists reading as none for the other', () => {
    const first = day('2026-09-28T00:00:00Z');
    const second = day('2026-09-29T00:00:00Z');
    const table = trafficTable(
      { count: 33, uniques: 1, days: [{ day: second, count: 33, uniques: 1 }] },
      {
        count: 9,
        uniques: 4,
        days: [
          { day: second, count: 7, uniques: 3 },
          { day: first, count: 2, uniques: 1 },
        ],
      },
      'en-US',
    );

    expect(table.rows.map((row) => row.cells)).toEqual([
      ['Sep 28', '0', '0', '2', '1'],
      ['Sep 29', '33', '1', '7', '3'],
    ]);
  });
});
