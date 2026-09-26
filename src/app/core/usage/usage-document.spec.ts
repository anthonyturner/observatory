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

  it('reads what the Usage screen shows', () => {
    const doc = parseUsageDocument({
      generatedAt: '2026-09-26T07:00:00Z',
      limits: {
        week: {
          pct: 7,
          resetsAt: '2026-10-02T19:00:00Z',
          startsAt: '2026-09-25T19:00:00Z',
          points: [],
          projection: { atReset: 85.4, perHour: 0.54, fullAt: null },
        },
        weeks: [{ resetsAt: '2026-09-25T19:00:00Z', peak: 53 }, { peak: 'x' }],
      },
      tokens: {
        days: 30,
        from: '2026-08-28',
        rows: [],
        totals: { tokens: 9, sessions: 2 },
        models: [{ model: 'claude-opus-5', family: 'opus', input: 1, messages: 2 }, {}],
      },
      tools: [{ name: 'Bash', count: 3 }, { name: 'Read' }],
      projects: [{ name: 'app', repo: 'me/app', tokens: 5 }, { repo: 'x' }],
    });

    expect(doc?.limits?.week?.startsAt).toBe('2026-09-25T19:00:00Z');
    expect(doc?.limits?.week?.projection).toEqual({ atReset: 85.4, perHour: 0.54 });
    expect(doc?.limits?.weeks).toEqual([{ resetsAt: '2026-09-25T19:00:00Z', peak: 53 }]);
    expect(doc?.tokens?.days).toBe(30);
    expect(doc?.tokens?.from).toBe('2026-08-28');
    expect(doc?.tokens?.totals).toEqual({
      tokens: 9,
      cacheRead: 0,
      messages: 0,
      sessions: 2,
      toolCalls: 0,
      subagents: 0,
    });
    expect(doc?.tokens?.models.map((model) => model.model)).toEqual(['claude-opus-5']);
    expect(doc?.tools).toEqual([{ name: 'Bash', count: 3 }]);
    expect(doc?.projects).toEqual([
      { name: 'app', repo: 'me/app', tokens: 5, cacheRead: 0, messages: 0, sessions: 0 },
    ]);
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
    expect(doc?.tokens?.rows).toEqual([
      {
        day: 'd',
        families: { haiku: 3 },
        cacheRead: 0,
        messages: 0,
        sessions: 0,
        toolCalls: 0,
        subagents: 0,
      },
    ]);
  });
});
