import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  commitWeeksOf,
  contributorStatsOf,
  readCommitActivity,
  readTraffic,
  trafficSeriesOf,
} from './insights-reader.ts';

const SUNDAY = 1_791_072_000;
const SUNDAY_ISO = new Date(SUNDAY * 1000).toISOString();

describe('commitWeeksOf', () => {
  it('reads each week from its Sunday, and leaves out one with no start', () => {
    const weeks = commitWeeksOf([
      { week: SUNDAY, total: 129, days: [1, 71, 23, 19, 15, 0, 0] },
      { total: 3, days: [0, 0, 0, 3, 0, 0, 0] },
    ]);

    assert.deepEqual(weeks, [
      { weekStart: SUNDAY_ISO, total: 129, days: [1, 71, 23, 19, 15, 0, 0] },
    ]);
  });

  it('reads a week with odd days as seven empty ones', () => {
    assert.deepEqual(
      commitWeeksOf([{ week: SUNDAY, total: 2, days: [2] }])?.[0].days,
      [0, 0, 0, 0, 0, 0, 0],
    );
  });

  it('reads the empty object GitHub answers while it counts as still counting', () => {
    assert.equal(commitWeeksOf({}), null);
  });
});

describe('contributorStatsOf', () => {
  it('reads each author’s weeks, marks an app’s account, and leaves out an author with no login', () => {
    const people = contributorStatsOf([
      {
        total: 4,
        weeks: [{ w: SUNDAY, a: 30, d: 2, c: 4 }],
        author: { login: 'me', type: 'User' },
      },
      { total: 1, weeks: [{ w: SUNDAY, a: 1, d: 1, c: 1 }], author: { login: 'dependabot[bot]' } },
      { total: 9, weeks: [], author: null },
    ]);

    assert.deepEqual(people, [
      {
        login: 'me',
        isBot: false,
        weeks: [{ weekStart: SUNDAY_ISO, commits: 4, additions: 30, deletions: 2 }],
      },
      {
        login: 'dependabot[bot]',
        isBot: true,
        weeks: [{ weekStart: SUNDAY_ISO, commits: 1, additions: 1, deletions: 1 }],
      },
    ]);
  });

  it('reads anything but a list as still counting', () => {
    assert.equal(contributorStatsOf({}), null);
  });
});

describe('trafficSeriesOf', () => {
  it('reads the totals and each day under the key, dropping a day with no time', () => {
    const series = trafficSeriesOf(
      {
        count: 46,
        uniques: 1,
        views: [{ timestamp: '2026-09-29T00:00:00Z', count: 33, uniques: 1 }, { count: 2 }],
      },
      'views',
    );

    assert.deepEqual(series, {
      count: 46,
      uniques: 1,
      days: [{ day: '2026-09-29T00:00:00Z', count: 33, uniques: 1 }],
    });
  });
});

describe('readers', () => {
  it('ask for each path below the repository', async () => {
    const asked: string[] = [];
    const get = async (path: string): Promise<unknown> => {
      asked.push(path);
      return path.includes('traffic') ? { count: 0, uniques: 0, clones: [] } : [];
    };

    await readCommitActivity(get, 'me/app');
    await readTraffic(get, 'me/app', 'clones');

    assert.deepEqual(asked, ['repos/me/app/stats/commit_activity', 'repos/me/app/traffic/clones']);
  });
});
