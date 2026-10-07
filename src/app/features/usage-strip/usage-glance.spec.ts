import { LimitWindow, UsageDocument } from '../../core/usage/usage-document';
import { UsageState } from '../../core/usage/usage-reader';
import { usageGlance } from './usage-glance';

const NOW = new Date(2026, 9, 7, 9, 0).getTime();
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const limit = (pct: number, resetsAt: number, expired?: boolean): LimitWindow => ({
  pct,
  resetsAt: iso(resetsAt),
  expired,
  points: [],
});

const readyWith = (five?: LimitWindow, week?: LimitWindow): UsageState => {
  const document: UsageDocument = {
    generatedAt: iso(NOW),
    limits: { at: iso(NOW), five, week, weeks: [] },
    tools: [],
    projects: [],
  };
  return { status: 'ready', document };
};

describe('usageGlance', () => {
  it('reads both limits with meters, and the reset of the one nearer its limit', () => {
    const glance = usageGlance(
      readyWith(limit(42, NOW + 2 * HOUR), limit(61, NOW + 50 * HOUR)),
      NOW,
      'en-US',
    );

    expect(glance?.limits).toEqual([
      { id: 'five', label: '5h', title: '5-hour window', text: '42%', fill: 42, isHot: false },
      { id: 'week', label: 'wk', title: 'Weekly limit', text: '61%', fill: 61, isHot: false },
    ]);
    expect(glance?.reset).toBe('wk resets Fri 11:00');
    expect(glance?.peak).toEqual({ text: '61%', isHot: false });
  });

  it('runs hot from 80%, and gives the five-hour reset as a time of day', () => {
    const glance = usageGlance(
      readyWith(limit(84, NOW + 2 * HOUR), limit(61, NOW + 50 * HOUR)),
      NOW,
    );

    expect(glance?.limits[0]).toMatchObject({ text: '84%', isHot: true });
    expect(glance?.reset).toBe('5h resets 11:00');
    expect(glance?.peak).toEqual({ text: '84%', isHot: true });
  });

  it('keeps a meter within its track past 100%', () => {
    const glance = usageGlance(readyWith(limit(104, NOW + HOUR)), NOW);

    expect(glance?.limits[0]).toMatchObject({ text: '104%', fill: 100 });
  });

  it('reads a window that has reset, or was marked expired, as unknown rather than its old number', () => {
    const glance = usageGlance(
      readyWith(limit(90, NOW - HOUR), limit(61, NOW + 50 * HOUR, true)),
      NOW,
    );

    expect(glance?.limits).toEqual([
      expect.objectContaining({ text: '—', fill: 0, isHot: false }),
      expect.objectContaining({ text: '—', fill: 0, isHot: false }),
    ]);
    expect(glance?.reset).toBeNull();
    expect(glance?.peak).toEqual({ text: '—', isHot: false });
  });

  it('takes the reset and peak from the one limit still current', () => {
    const glance = usageGlance(readyWith(limit(90, NOW - HOUR), limit(30, NOW + 2 * HOUR)), NOW);

    expect(glance?.reset).toMatch(/^wk resets \w{3} 11:00$/);
    expect(glance?.peak).toEqual({ text: '30%', isHot: false });
  });

  it('shows unknown limits when the document has no limit readings', () => {
    const glance = usageGlance(readyWith(), NOW);

    expect(glance?.limits.map((reading) => reading.text)).toEqual(['—', '—']);
    expect(glance?.reset).toBeNull();
  });

  it('shows nothing while usage is being read, out of reach or missing', () => {
    for (const status of ['reading', 'unreachable', 'missing'] as const) {
      expect(usageGlance({ status }, NOW)).toBeNull();
    }
  });
});
