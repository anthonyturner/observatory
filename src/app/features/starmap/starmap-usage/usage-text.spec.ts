import {
  agoText,
  clipLabel,
  dayText,
  percentText,
  usageStamp,
  weekdayText,
  whenText,
} from './usage-text';

const FRIDAY_3PM = new Date(2026, 9, 2, 15, 0).getTime();

describe('usage text', () => {
  it('writes percents as pr-starmap does', () => {
    expect(percentText(7)).toBe('7%');
    expect(percentText(4.5)).toBe('4.5%');
    expect(percentText(85.4)).toBe('85%');
  });

  it('writes moments, days and weekdays', () => {
    expect(whenText(FRIDAY_3PM, 'en-US')).toBe('Fri 3:00 PM');
    expect(dayText('2026-09-25', 'en-US')).toBe('Sep 25');
    expect(dayText(new Date(2026, 8, 25, 19).toISOString(), 'en-US')).toBe('Sep 25');
    expect(weekdayText(FRIDAY_3PM, 'en-US')).toBe('Fri');
  });

  it('says how long ago a reading was', () => {
    const now = Date.parse('2026-09-26T12:00:00Z');
    expect(agoText('2026-09-26T11:59:50Z', now)).toBe('just now');
    expect(agoText('2026-09-26T11:48:00Z', now)).toBe('12 min ago');
    expect(agoText('2026-09-26T02:00:00Z', now)).toBe('10 h ago');
    expect(agoText('2026-09-23T12:00:00Z', now)).toBe('3 days ago');
  });

  it('cuts a long label to fit', () => {
    expect(clipLabel('short')).toBe('short');
    expect(clipLabel('a-very-long-project-name-indeed')).toBe('a-very-long-project-nam…');
  });

  it('stamps the header with the week used, unless it has reset', () => {
    const generatedAt = '2026-09-26T08:46:24Z';
    const refreshed = new Date(generatedAt).toLocaleString('en-US');
    const week = { pct: 7, resetsAt: 'x', points: [] };

    expect(usageStamp(null)).toBe('no usage read yet');
    expect(
      usageStamp({ generatedAt, limits: { week, weeks: [] }, tools: [], projects: [] }, 'en-US'),
    ).toBe(`Claude Code · 7% of the week used · refreshed ${refreshed}`);
    expect(
      usageStamp(
        {
          generatedAt,
          limits: { week: { ...week, expired: true }, weeks: [] },
          tools: [],
          projects: [],
        },
        'en-US',
      ),
    ).toBe(`Claude Code · refreshed ${refreshed}`);
  });
});
