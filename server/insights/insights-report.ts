import type { ContributorStats, InsightsReader, TrafficSeries } from '../github/insights-reader.ts';
import { type FinishedPull, type LedgerReader, ledgerRows, localDay } from '../history/ledger.ts';
import type { Contributor, InsightsReport, PartState } from './insights-types.ts';
import {
  type InsightsPart,
  READ,
  WITHHELD_TRAFFIC,
  countingState,
  failureState,
} from './part-state.ts';

/** How far back the screen looks: about a quarter. */
export const INSIGHTS_WEEKS = 12;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const INSIGHTS_DAYS = INSIGHTS_WEEKS * 7;
/** The chart names this many; the rest are a long tail of a commit or two. */
const CONTRIBUTOR_LIMIT = 10;
/** GitHub works statistics out in the background after a 202; a few seconds is often enough. */
const STATS_ATTEMPTS = 3;
const STATS_RETRY_MS = 1_500;

/** The time, and a pause: both swapped in tests. */
export interface InsightsClock {
  now(): number;
  wait(ms: number): Promise<void>;
}

export const SYSTEM_CLOCK: InsightsClock = {
  now: () => Date.now(),
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Asks again, a little later, while GitHub is still counting; null if it still is. */
async function untilCounted<T>(
  read: () => Promise<T | null>,
  clock: InsightsClock,
): Promise<T | null> {
  for (let attempt = 1; ; attempt++) {
    const answer = await read();
    if (answer !== null || attempt === STATS_ATTEMPTS) return answer;
    await clock.wait(STATS_RETRY_MS);
  }
}

interface PartRead<T> {
  readonly state: PartState;
  /** Null when there is nothing to show: still counting, or not read. */
  readonly value: T | null;
}

/** One part, or a plain note on why GitHub would not give it: never an error for the page. */
async function readPart<T>(
  repo: string,
  part: InsightsPart,
  read: () => Promise<T | null>,
): Promise<PartRead<T>> {
  try {
    const value = await read();
    return { state: value === null ? countingState(part) : READ, value };
  } catch (error: unknown) {
    const state = failureState(part, error);
    if (state.status === 'failed') console.error(`Could not read ${repo}'s ${part}:`, error);
    return { state, value: null };
  }
}

const isSince = (since: number) => (week: { readonly weekStart: string }) =>
  Date.parse(week.weekStart) > since;

/** Each author's commits and lines since `since`, most commits first, those with none left out. */
export function topContributors(stats: readonly ContributorStats[], since: number): Contributor[] {
  return stats
    .map((person) => {
      const weeks = person.weeks.filter(isSince(since));
      const total = (pick: (week: (typeof weeks)[number]) => number): number =>
        weeks.reduce((sum, week) => sum + pick(week), 0);
      return {
        login: person.login,
        isBot: person.isBot,
        commits: total((week) => week.commits),
        additions: total((week) => week.additions),
        deletions: total((week) => week.deletions),
      };
    })
    .filter((person) => person.commits > 0)
    .sort((a, b) => b.commits - a.commits || a.login.localeCompare(b.login))
    .slice(0, CONTRIBUTOR_LIMIT);
}

/** The merges and closes in the window, read as the ledger reads its own. */
async function finishedPulls(
  github: LedgerReader,
  repo: string,
  now: number,
): Promise<FinishedPull[]> {
  const touched = await github.touchedPulls(repo, localDay(now - INSIGHTS_DAYS * DAY_MS));
  return ledgerRows(touched, now, INSIGHTS_DAYS).finished;
}

interface Traffic {
  readonly views: TrafficSeries;
  readonly clones: TrafficSeries;
}

async function readTraffic(github: InsightsReader, repo: string): Promise<Traffic> {
  const [views, clones] = await Promise.all([
    github.trafficViews(repo),
    github.trafficClones(repo),
  ]);
  return { views, clones };
}

/** The Insights screen's report: commits, contributors, finished pull requests and traffic. */
export async function insightsReport(
  github: InsightsReader & LedgerReader,
  repo: string,
  clock: InsightsClock = SYSTEM_CLOCK,
): Promise<InsightsReport> {
  const now = clock.now();
  const since = now - INSIGHTS_WEEKS * WEEK_MS;
  const [commits, contributors, pulls, traffic] = await Promise.all([
    readPart(repo, 'commits', () => untilCounted(() => github.commitActivity(repo), clock)),
    readPart(repo, 'contributors', () => untilCounted(() => github.contributorStats(repo), clock)),
    readPart(repo, 'pulls', () => finishedPulls(github, repo, now)),
    readPart(repo, 'traffic', () => readTraffic(github, repo)),
  ]);
  return {
    generatedAt: new Date(now).toISOString(),
    repo,
    weeks: INSIGHTS_WEEKS,
    commits: { ...commits.state, weeks: (commits.value ?? []).filter(isSince(since)) },
    contributors: {
      ...contributors.state,
      people: topContributors(contributors.value ?? [], since),
    },
    pulls: { ...pulls.state, finished: pulls.value ?? [] },
    traffic: {
      ...traffic.state,
      views: traffic.value?.views ?? null,
      clones: traffic.value?.clones ?? null,
    },
  };
}

/** GitHub was still counting a part, so the report is worth reading again soon. */
export const isCounting = (report: InsightsReport): boolean =>
  report.commits.status === 'counting' || report.contributors.status === 'counting';

/** The report without its traffic, for a preview visitor: GitHub shows it only to those who can push. */
export const withoutTraffic = (report: InsightsReport): InsightsReport => ({
  ...report,
  traffic: { ...WITHHELD_TRAFFIC, views: null, clones: null },
});
