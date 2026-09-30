import { Frame } from '../../../core/queue/history-report';
import { ProjectUsage, TokenReport } from '../../../core/usage/usage-document';
import { mergesSince, projectBars, projectNote, toolBars } from './bar-items';
import { limitTiles } from './limit-tiles';
import { familyLegend, modelRows, tokenTiles } from './token-views';
import { chartWidth } from './starmap-usage';

const FRIDAY_3PM = new Date(2026, 9, 2, 15, 0).toISOString();

describe('limitTiles', () => {
  const week = { pct: 7, resetsAt: FRIDAY_3PM, points: [] };

  it('reads the week, its pace and the five-hour window', () => {
    const tiles = limitTiles(
      {
        week: { ...week, projection: { atReset: 85.4, perHour: 0.54 } },
        five: { pct: 83, resetsAt: FRIDAY_3PM, points: [] },
        weeks: [],
      },
      'en-US',
    );

    expect(tiles.map((tile) => [tile.label, tile.value, tile.sub])).toEqual([
      ['This week', '7%', 'resets Fri 3:00 PM'],
      ['Pace', '85%', "at reset, if the last two days' pace holds (0.54% an hour)"],
      ['5-hour window', '83%', 'resets Fri 3:00 PM'],
    ]);
    expect(tiles[2]).toMatchObject({ isWarn: true, meter: 83 });
  });

  it('warns when the pace runs out before the reset', () => {
    const [, pace] = limitTiles(
      { week: { ...week, projection: { atReset: 140, fullAt: FRIDAY_3PM } }, weeks: [] },
      'en-US',
    );

    expect(pace).toMatchObject({ value: '▲ runs out', isWarn: true });
    expect(pace.sub).toBe('at this pace, Fri 3:00 PM, before the reset');
  });

  it('calls a window that has reset unknown, never 0%', () => {
    const tiles = limitTiles(
      { week: { ...week, expired: true }, five: { ...week, expired: true }, weeks: [] },
      'en-US',
    );

    expect(tiles.map((tile) => tile.value)).toEqual(['—', '—', '—']);
    expect(tiles[0].sub).toBe('reset Fri 3:00 PM; nothing read since');
    expect(tiles[1].sub).toBe('a new week starts with the next reading');
  });

  it('says the pace needs more readings', () => {
    expect(limitTiles({ week, weeks: [] })[1].sub).toBe('needs an hour of readings');
  });
});

const tokens: TokenReport = {
  days: 30,
  from: '2026-08-28',
  rows: [
    {
      day: '2026-09-26',
      families: { opus: 2_000_000, haiku: 5_000 },
      cacheRead: 0,
      messages: 0,
      sessions: 0,
      toolCalls: 0,
      subagents: 0,
    },
  ],
  totals: {
    tokens: 109_200_000,
    cacheRead: 3_900_000_000,
    messages: 23_056,
    sessions: 145,
    toolCalls: 26_593,
    subagents: 264,
  },
  models: [
    {
      model: 'claude-opus-5',
      family: 'opus',
      input: 28_000,
      output: 12_500_000,
      cacheRead: 2_300_000_000,
      cacheWrite: 50_200_000,
      messages: 13_971,
    },
    {
      model: 'claude-haiku-4-5',
      family: 'haiku',
      input: 382,
      output: 1,
      cacheRead: 1,
      cacheWrite: 1,
      messages: 45,
    },
  ],
};

describe('token views', () => {
  it('tiles the totals', () => {
    expect(tokenTiles(tokens).map((tile) => [tile.value, tile.sub])).toEqual([
      ['109.2M', 'input, output and cache writes'],
      ['3.9B', 'context read back from the cache'],
      ['145', '23,056 replies'],
      ['26,593', '264 subagents started'],
    ]);
  });

  it('keys each family a model belongs to, with its tokens', () => {
    expect(familyLegend(tokens)).toEqual([
      { id: 'opus', label: 'Opus', colour: 'var(--usage-opus)', total: '2.0M' },
      { id: 'haiku', label: 'Haiku', colour: 'var(--usage-haiku)', total: '5k' },
    ]);
  });

  it('writes a row per model', () => {
    expect(modelRows(tokens.models)[0]).toEqual({
      model: 'claude-opus-5',
      colour: 'var(--usage-opus)',
      replies: '13,971',
      input: '28k',
      output: '12.5M',
      cacheWrite: '50.2M',
      cacheRead: '2.3B',
    });
  });
});

const project = (name: string, tokenCount: number, repo: string | null = null): ProjectUsage => ({
  name,
  repo,
  tokens: tokenCount,
  cacheRead: 10,
  messages: 2,
  sessions: 1,
});

describe('project bars', () => {
  const projects = Array.from({ length: 10 }, (_, index) => project(`p${index}`, 100 - index));

  it('lights this page’s project, kept even past the busiest eight', () => {
    const mine = project('app', 1, 'Me/App');
    const bars = projectBars([...projects, mine], 'me/app');

    expect(bars.map((bar) => bar.label)).toEqual([
      'p0',
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'app',
      '2 more',
    ]);
    expect(bars.filter((bar) => bar.isStrong).map((bar) => bar.label)).toEqual(['app']);
    expect(bars[8].tip).toBe('Me/App\n1 tokens · 10 cache reads\n2 replies · 1 sessions');
    expect(bars[9]).toMatchObject({ value: 183, tip: 'p8 92\np9 91' });
  });

  it('lights every bar when this project ran nothing', () => {
    expect(projectBars(projects, 'me/other').every((bar) => bar.isStrong)).toBe(true);
  });

  it('writes tools as call counts', () => {
    expect(toolBars([{ name: 'Bash', count: 16_335 }])).toEqual([
      { label: 'Bash', value: 16_335, text: '16,335', isStrong: true, tip: 'Bash\n16,335 calls' },
    ]);
  });
});

describe('project note', () => {
  const projects = [project('rivals_pulse', 79_600_000, 'me/rivals_pulse')];

  it('sets tokens against the pull requests merged over the same days', () => {
    expect(projectNote({ projects, repo: 'me/rivals_pulse', days: 30, merges: 149 })).toBe(
      'rivals_pulse: 79.6M tokens over 30 days, and 149 pull requests merged, about 534k tokens a merge.',
    );
    expect(projectNote({ projects, repo: 'me/rivals_pulse', days: 30, merges: 0 })).toBe(
      'rivals_pulse: 79.6M tokens over 30 days, and 0 pull requests merged.',
    );
  });

  it('says nothing ran here, and nothing when merges cannot be counted', () => {
    expect(projectNote({ projects, repo: 'me/other', days: 30, merges: 1 })).toBe(
      'No sessions ran in me/other in these days.',
    );
    expect(projectNote({ projects, repo: 'me/rivals_pulse', days: 30, merges: null })).toBeNull();
  });

  it('counts the merges the star map saw since a day', () => {
    const frame = (at: string, fates: ('merged' | 'closed')[]): Frame => ({
      at,
      items: [],
      departed: fates.map((fate, index) => ({ number: index + 1, title: '', fate })),
    });
    const frames = [
      frame(new Date(2026, 7, 20, 12).toISOString(), ['merged']),
      frame(new Date(2026, 8, 1, 12).toISOString(), ['merged', 'closed', 'merged']),
    ];

    expect(mergesSince(frames, '2026-08-28')).toBe(2);
    expect(mergesSince(frames.slice(1), '2026-08-28')).toBeNull();
    expect(mergesSince([], '2026-08-28')).toBeNull();
  });
});

describe('chartWidth', () => {
  it('draws at the list’s width, within bounds', () => {
    expect(chartWidth(0)).toBe(880);
    expect(chartWidth(200)).toBe(280);
    expect(chartWidth(1200)).toBe(920);
    expect(chartWidth(358)).toBe(358);
  });
});
