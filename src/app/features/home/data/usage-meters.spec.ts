import { TokenDay, UsageDocument } from '../../../core/usage/usage-document';
import { localDayKey } from '../../../core/usage/usage-format';
import { usageMeters } from './usage-meters';

const NOW = new Date(2026, 8, 26, 8, 0).getTime();
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const day = (at: number, families: Record<string, number>): TokenDay => ({
  day: localDayKey(at),
  families,
  cacheRead: 0,
  messages: 0,
  sessions: 0,
  toolCalls: 0,
  subagents: 0,
});
const NO_TOTALS = { tokens: 0, cacheRead: 0, messages: 0, sessions: 0, toolCalls: 0, subagents: 0 };

const document: UsageDocument = {
  generatedAt: iso(NOW - 4 * 60_000),
  limits: {
    at: iso(NOW - 60_000),
    five: {
      pct: 84,
      resetsAt: iso(NOW + 2 * HOUR),
      points: [
        [NOW - 2 * HOUR, 40],
        [NOW - HOUR, 84],
      ],
    },
    week: { pct: 62, resetsAt: iso(NOW + 72 * HOUR), points: [], projection: { atReset: 88 } },
    weeks: [],
  },
  tokens: {
    days: 2,
    from: localDayKey(NOW - 24 * HOUR),
    rows: [day(NOW - 24 * HOUR, { opus: 800_000 }), day(NOW, { opus: 1_000_000, sonnet: 200_000 })],
    totals: NO_TOTALS,
    models: [],
  },
  tools: [],
  projects: [],
};
const ready = { status: 'ready', document } as const;

describe('usageMeters', () => {
  it('reads today’s tokens with the daily average and age', () => {
    const { tokens } = usageMeters(ready, NOW);

    expect(tokens.value).toBe('1.2M');
    expect(tokens.note).toBe('avg 1.0M /day');
    expect(tokens.age).toBe('4m');
    expect(tokens.series).toEqual([800_000, 1_200_000]);
  });

  it('reads the five-hour window as a percent, hot from 80%', () => {
    const { fiveHour } = usageMeters(ready, NOW);

    expect(fiveHour.value).toBe('84');
    expect(fiveHour.unit).toBe('%');
    expect(fiveHour.isHot).toBe(true);
    expect(fiveHour.max).toBe(100);
    expect(fiveHour.series).toEqual([40, 84]);
    expect(fiveHour.note).toMatch(/^resets \d\d:\d\d$/);
  });

  it('reads the weekly limit with its pace', () => {
    const { weekly } = usageMeters(ready, NOW, 'en-US');

    expect(weekly.percentUsed).toBe(62);
    expect(weekly.note).toMatch(/^resets \w{3} \d\d:\d\d · on pace for 88%$/);
  });

  it('calls a window that has reset unknown, and says when it was last read', () => {
    const lapsed = {
      status: 'ready',
      document: {
        ...document,
        limits: {
          ...document.limits!,
          five: { ...document.limits!.five!, resetsAt: iso(NOW - HOUR) },
        },
      },
    } as const;

    const { fiveHour } = usageMeters(lapsed, NOW, 'en-US');

    expect(fiveHour.value).toBeNull();
    expect(fiveHour.note).toMatch(/^reset \d\d:\d\d · last read \w{3} \d\d:\d\d$/);
    expect(fiveHour.how).toBe('read while the local site runs');
  });

  it('says today has not been read rather than showing zero', () => {
    const stale = {
      status: 'ready',
      document: {
        ...document,
        tokens: { ...document.tokens!, rows: document.tokens!.rows.slice(0, 1) },
      },
    } as const;

    expect(usageMeters(stale, NOW).tokens).toMatchObject({ value: null, note: 'not read today' });
  });

  it('gives every meter the same reason when there is no document to read', () => {
    for (const [status, reason] of [
      ['reading', 'reading'],
      ['unreachable', 'store out of reach'],
      ['missing', 'no usage recorded'],
    ] as const) {
      const meters = usageMeters({ status }, NOW);
      expect(meters.tokens).toMatchObject({ value: null, note: reason });
      expect(meters.fiveHour).toMatchObject({ value: null, note: reason });
      expect(meters.weekly).toEqual({ percentUsed: null, note: reason });
    }
  });
});
