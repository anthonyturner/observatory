import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ContributorStats, InsightsReader } from '../github/insights-reader.ts';
import type { LedgerPull, LedgerReader } from '../history/ledger.ts';
import {
  type InsightsClock,
  insightsReport,
  isCounting,
  topContributors,
  withoutTraffic,
} from './insights-report.ts';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const DAY_MS = 86_400_000;
const iso = (daysAgo: number): string => new Date(NOW - daysAgo * DAY_MS).toISOString();

const SERIES = { count: 3, uniques: 1, days: [{ day: iso(1), count: 3, uniques: 1 }] };

const pull = (number: number, more: Partial<LedgerPull>): LedgerPull => ({
  number,
  title: `Pull ${number}`,
  createdAt: iso(3),
  closedAt: null,
  mergedAt: null,
  state: 'OPEN',
  headRefName: `feat/${number}`,
  baseRefName: 'main',
  isCrossRepository: false,
  ...more,
});

type Fake = InsightsReader & LedgerReader;

function reader(more: Partial<Fake> = {}): Fake {
  return {
    commitActivity: async () => [
      { weekStart: iso(100), total: 9, days: [9, 0, 0, 0, 0, 0, 0] },
      { weekStart: iso(4), total: 5, days: [1, 1, 1, 1, 1, 0, 0] },
    ],
    contributorStats: async () => [
      {
        login: 'me',
        isBot: false,
        weeks: [{ weekStart: iso(4), commits: 5, additions: 50, deletions: 5 }],
      },
    ],
    trafficViews: async () => SERIES,
    trafficClones: async () => SERIES,
    touchedPulls: async () => [
      pull(7, { state: 'MERGED', mergedAt: iso(1), closedAt: iso(1) }),
      pull(8, {}),
    ],
    ...more,
  };
}

/** A clock that never waits, and counts how often it was asked to. */
function clock(): InsightsClock & { readonly waits: number[] } {
  const waits: number[] = [];
  return { now: () => NOW, wait: async (ms) => void waits.push(ms), waits };
}

const fails = (message: string) => async (): Promise<never> => {
  throw new Error(message);
};

describe('insightsReport', () => {
  it('reads every part over the last twelve weeks', async () => {
    const report = await insightsReport(reader(), 'me/app', clock());

    assert.equal(report.generatedAt, new Date(NOW).toISOString());
    assert.equal(report.weeks, 12);
    assert.equal(report.commits.status, 'read');
    assert.deepEqual(
      report.commits.weeks.map((week) => week.total),
      [5],
    );
    assert.deepEqual(report.contributors.people, [
      { login: 'me', isBot: false, commits: 5, additions: 50, deletions: 5 },
    ]);
    assert.deepEqual(
      report.pulls.finished.map((each) => [each.number, each.fate]),
      [[7, 'merged']],
    );
    assert.deepEqual(report.traffic, { status: 'read', note: null, views: SERIES, clones: SERIES });
    assert.equal(isCounting(report), false);
  });

  it('asks again while GitHub is still counting, and says so if it still is', async () => {
    const time = clock();
    let asked = 0;
    const report = await insightsReport(
      reader({
        contributorStats: async () => {
          asked++;
          return null;
        },
      }),
      'me/app',
      time,
    );

    assert.equal(asked, 3);
    assert.equal(time.waits.length, 2);
    assert.equal(report.contributors.status, 'counting');
    assert.match(report.contributors.note ?? '', /still counting/);
    assert.deepEqual(report.contributors.people, []);
    assert.equal(report.commits.status, 'read');
    assert.equal(isCounting(report), true);
  });

  it('takes the answer as soon as GitHub has counted', async () => {
    const answers = [null, []];
    const time = clock();
    const report = await insightsReport(
      reader({ commitActivity: async () => answers.shift() ?? null }),
      'me/app',
      time,
    );

    assert.equal(report.commits.status, 'read');
    assert.equal(time.waits.length, 1);
  });

  it('notes traffic the token may not read, and leaves the rest', async () => {
    const report = await insightsReport(
      reader({ trafficViews: fails('gh: Must have push access to repository (HTTP 403)') }),
      'me/app',
      clock(),
    );

    assert.equal(report.traffic.status, 'no-access');
    assert.match(report.traffic.note ?? '', /push access/);
    assert.equal(report.traffic.views, null);
    assert.equal(report.commits.status, 'read');
  });

  it('notes a part GitHub did not answer for', async () => {
    const report = await insightsReport(
      reader({ touchedPulls: fails('socket hang up') }),
      'me/app',
      clock(),
    );

    assert.equal(report.pulls.status, 'failed');
    assert.match(report.pulls.note ?? '', /pull requests/);
    assert.deepEqual(report.pulls.finished, []);
  });
});

describe('topContributors', () => {
  const week = (daysAgo: number, commits: number) => ({
    weekStart: iso(daysAgo),
    commits,
    additions: commits * 10,
    deletions: commits,
  });
  const person = (login: string, weeks: ContributorStats['weeks']): ContributorStats => ({
    login,
    isBot: false,
    weeks,
  });

  it('counts only the window, most commits first, and leaves out those with none in it', () => {
    const since = NOW - 84 * DAY_MS;
    const people = topContributors(
      [
        person('old', [week(120, 40)]),
        person('b', [week(10, 2), week(3, 1)]),
        person('a', [week(5, 3)]),
        person('c', [week(5, 9), week(90, 100)]),
      ],
      since,
    );

    assert.deepEqual(
      people.map((each) => [each.login, each.commits, each.additions]),
      [
        ['c', 9, 90],
        ['a', 3, 30],
        ['b', 3, 30],
      ],
    );
  });
});

describe('withoutTraffic', () => {
  it('keeps the rest of the report and withholds the traffic', async () => {
    const report = withoutTraffic(await insightsReport(reader(), 'me/app', clock()));

    assert.equal(report.traffic.status, 'withheld');
    assert.equal(report.traffic.views, null);
    assert.equal(report.traffic.clones, null);
    assert.equal(report.commits.status, 'read');
  });
});
