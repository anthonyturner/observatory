import { parseUsageDocument } from './usage-document';

describe('parseUsageDocument', () => {
  it('keeps the fields the meters read', () => {
    const doc = parseUsageDocument({
      generatedAt: '2026-09-26T07:00:00Z',
      limits: {
        at: '2026-09-26T06:59:00Z',
        five: {
          pct: 12,
          resetsAt: '2026-09-26T09:50:00Z',
          points: [
            [1, 0],
            [2, 12],
          ],
        },
        week: {
          pct: 5,
          resetsAt: '2026-10-02T19:00:00Z',
          points: [],
          projection: { atReset: 53.8 },
        },
      },
      tokens: { rows: [{ day: '2026-09-26', families: { opus: 100, sonnet: 50 } }] },
    });

    expect(doc?.limits?.five?.points).toEqual([
      [1, 0],
      [2, 12],
    ]);
    expect(doc?.limits?.week?.projection).toEqual({ atReset: 53.8 });
    expect(doc?.tokens?.rows[0].families).toEqual({ opus: 100, sonnet: 50 });
  });

  it('refuses something that is not a usage document', () => {
    expect(parseUsageDocument(null)).toBeNull();
    expect(parseUsageDocument({ limits: {} })).toBeNull();
  });

  it('drops malformed parts instead of guessing', () => {
    const doc = parseUsageDocument({
      generatedAt: 'x',
      limits: {
        five: { pct: 'high', resetsAt: 'soon' },
        week: { pct: 5, resetsAt: 'y', points: [['a', 1]] },
      },
      tokens: { rows: [{ families: {} }, { day: 'd', families: { opus: 'many', haiku: 3 } }] },
    });

    expect(doc?.limits?.five).toBeUndefined();
    expect(doc?.limits?.week?.points).toEqual([]);
    expect(doc?.tokens?.rows).toEqual([{ day: 'd', families: { haiku: 3 } }]);
  });
});
