import { CycleWeek, Waits } from '../../../core/queue/weekly-retro';
import {
  agentRows,
  cycleColumns,
  cycleScale,
  retroStamp,
  waitBars,
  waitNote,
} from './retro-charts';

const waits = (over: Partial<Waits> = {}): Waits => ({
  buckets: [
    { bucket: 'conflicted', hours: 3, pulls: 1 },
    { bucket: 'unreviewed', hours: 0, pulls: 0 },
  ],
  observed: 2,
  finished: 3,
  since: Date.parse('2026-10-02T12:00:00'),
  ...over,
});

const week = (end: string, medianCycleHours: number | null): CycleWeek => ({
  start: Date.parse(end) - 7 * 86_400_000,
  end: Date.parse(end),
  merged: medianCycleHours === null ? 0 : 2,
  closed: 1,
  medianCycleHours,
});

describe('waitBars', () => {
  it('names each bucket as the legend does, with a dash for one nobody sat in', () => {
    const bars = waitBars(waits());

    expect(bars.map((bar) => [bar.label, bar.text])).toEqual([
      ['Cannot merge', '3.0 h'],
      ['Waiting on you', '—'],
    ]);
    expect(bars[0].tip).toBe('Cannot merge\n3.0 h across 1 pull request');
  });
});

describe('waitNote', () => {
  it('says how many of the finished pull requests the refreshes saw, and since when', () => {
    expect(waitNote(waits(), 'en-US')).toMatch(
      /^2 of the 3 pull requests finished this week seen at refreshes since Oct 2\./,
    );
  });

  it('says when nothing finished, or nothing was recorded', () => {
    expect(waitNote(waits({ finished: 0 }))).toBe('Nothing merged or closed this week.');
    expect(waitNote(waits({ since: null }))).toMatch(/^No refreshes recorded yet/);
  });
});

describe('cycleColumns', () => {
  it('labels each week by its last day, with a dash where nothing merged', () => {
    const columns = cycleColumns(
      [week('2026-09-29T12:00:00', 6), week('2026-10-06T12:00:00', null)],
      'en-US',
    );

    expect(columns.map((column) => [column.label, column.text, column.value])).toEqual([
      ['Sep 29', '6.0 h', 6],
      ['Oct 6', '—', 0],
    ]);
    expect(columns[0].tip).toBe(
      'Week to Sep 29\n2 merged · 1 closed\nmedian 6.0 h from open to merge',
    );
    expect(columns[1].tip).toContain('nothing merged');
  });
});

describe('cycleScale', () => {
  it('runs from zero to the slowest week', () => {
    expect(cycleScale([week('2026-09-29T12:00:00', 6), week('2026-10-06T12:00:00', 30)])).toEqual({
      top: 30,
      bottomLabel: '0',
      topLabel: '30.0 h',
    });
  });
});

describe('agentRows', () => {
  it('bars each agent by its merges, with closes and the median in the tooltip', () => {
    const [row] = agentRows([{ agent: 'builder', merged: 2, closed: 1, medianCycleHours: 0.5 }]);

    expect(row).toEqual({
      label: 'builder',
      value: 2,
      text: '2',
      tip: 'builder\n2 merged · 1 closed\nmedian 30 min from open to merge',
      isStrong: true,
    });
  });
});

describe('retroStamp', () => {
  it('names the repository and the week the ledger was read for', () => {
    const ledger = { generatedAt: '2026-10-06T09:00:00', rows: [], titles: {}, finished: [] };

    expect(retroStamp('me/app', ledger, 'en-US')).toMatch(/^me\/app · week to Oct 6 · read /);
    expect(retroStamp('me/app', null)).toBe('no history read yet');
  });
});
