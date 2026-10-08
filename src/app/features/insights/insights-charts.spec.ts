import {
  VIEW_NOUNS,
  busiestDay,
  commitColumns,
  contributorBars,
  countScale,
  gitHubDayText,
  trafficColumns,
} from './insights-charts';

/** Sunday, Oct 4 2026, as GitHub starts its week. */
const SUNDAY = Date.parse('2026-10-04T00:00:00Z');
const week = (total: number, days: number[]) => ({ start: SUNDAY, total, days });

describe('gitHubDayText', () => {
  it('names the day GitHub means, wherever the viewer is', () => {
    expect(gitHubDayText(SUNDAY, 'en-US')).toBe('Oct 4');
    expect(gitHubDayText(Date.parse('2025-11-09T01:00:00Z'), 'en-US')).toBe('Nov 9');
  });
});

describe('busiestDay', () => {
  it('names the week’s busiest day, or none in an empty week', () => {
    expect(busiestDay(week(129, [1, 71, 23, 19, 15, 0, 0]), 'en-US')).toBe('Mon, 71 commits');
    expect(busiestDay(week(0, [0, 0, 0, 0, 0, 0, 0]), 'en-US')).toBeNull();
  });
});

describe('commitColumns', () => {
  it('makes a column a week, named by its first day, with the busiest day in the tooltip', () => {
    const [column] = commitColumns([week(129, [1, 71, 23, 19, 15, 0, 0])], 'en-US');

    expect(column).toEqual({
      label: 'Oct 4',
      value: 129,
      text: '129',
      tip: 'Week of Oct 4\n129 commits\nBusiest: Mon, 71 commits',
    });
  });

  it('leaves the busiest day out of an empty week’s tooltip', () => {
    expect(commitColumns([week(0, [0, 0, 0, 0, 0, 0, 0])], 'en-US')[0].tip).toBe(
      'Week of Oct 4\n0 commits',
    );
  });
});

describe('countScale', () => {
  it('runs from zero to the largest count', () => {
    expect(countScale([3, 9, 4])).toEqual({ top: 9, bottomLabel: '0', topLabel: '9' });
    expect(countScale([])).toEqual({ top: 0, bottomLabel: '0', topLabel: '' });
  });
});

describe('trafficColumns', () => {
  it('makes a column a day, with its unique visitors in the tooltip', () => {
    const columns = trafficColumns(
      {
        count: 33,
        uniques: 1,
        days: [{ day: Date.parse('2026-09-29T00:00:00Z'), count: 33, uniques: 1 }],
      },
      VIEW_NOUNS,
      'en-US',
    );

    expect(columns).toEqual([
      { label: 'Sep 29', value: 33, text: '33', tip: 'Sep 29\n33 views\n1 unique visitor' },
    ]);
  });
});

describe('contributorBars', () => {
  it('makes a bar a contributor, marking an app’s account, with their lines in the tooltip', () => {
    const bars = contributorBars([
      { login: 'me', isBot: false, commits: 9, additions: 90, deletions: 4 },
      { login: 'dependabot[bot]', isBot: true, commits: 1, additions: 2, deletions: 2 },
    ]);

    expect(bars.map((bar) => [bar.label, bar.value])).toEqual([
      ['me', 9],
      ['dependabot[bot] (bot)', 1],
    ]);
    expect(bars[0].tip).toBe('me\n9 commits\n+90 −4 lines');
  });
});
