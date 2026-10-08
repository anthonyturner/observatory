import { type Json, type JsonGet, isJson, isText, jsonList } from './rest-json.ts';

/** One week of commits to the default branch, as GitHub counts them. */
export interface CommitWeek {
  /** When the week starts, as an ISO time: GitHub's weeks start on a Sunday. */
  readonly weekStart: string;
  readonly total: number;
  /** Each day's commits, Sunday first. */
  readonly days: readonly number[];
}

/** One week of one author's commits, and the lines they added and removed. */
export interface ContributorWeek {
  readonly weekStart: string;
  readonly commits: number;
  readonly additions: number;
  readonly deletions: number;
}

/** One author's commits to the default branch, week by week. */
export interface ContributorStats {
  readonly login: string;
  /** An app's account, such as Dependabot's, rather than a person's. */
  readonly isBot: boolean;
  readonly weeks: readonly ContributorWeek[];
}

/** One day's views or clones. */
export interface TrafficDay {
  readonly day: string;
  readonly count: number;
  readonly uniques: number;
}

/** A fortnight's views or clones: the totals, and each day's. */
export interface TrafficSeries {
  readonly count: number;
  readonly uniques: number;
  readonly days: readonly TrafficDay[];
}

/** What the Insights screen reads of a repository's activity, and nothing else. */
export interface InsightsReader {
  /** The last year's weeks, oldest first, or null while GitHub is still counting them. */
  commitActivity(repo: string): Promise<CommitWeek[] | null>;
  /** Every author's weeks, or null while GitHub is still counting them. */
  contributorStats(repo: string): Promise<ContributorStats[] | null>;
  /** The last fourteen days. Rejects when the token lacks push access to the repository. */
  trafficViews(repo: string): Promise<TrafficSeries>;
  trafficClones(repo: string): Promise<TrafficSeries>;
}

const SECOND_MS = 1000;
const DAYS_A_WEEK = 7;

const countOf = (value: unknown): number =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : 0;

/** GitHub gives a week as seconds since the epoch. */
const weekStartOf = (seconds: unknown): string | null =>
  countOf(seconds) ? new Date(countOf(seconds) * SECOND_MS).toISOString() : null;

/** GitHub answers 202 with an empty object while it works a repository's statistics out. */
const isStillCounting = (body: unknown): boolean => !Array.isArray(body);

function commitWeekOf(week: Json): CommitWeek | null {
  const weekStart = weekStartOf(week['week']);
  if (!weekStart) return null;
  const days = Array.isArray(week['days']) ? week['days'].map(countOf) : [];
  return {
    weekStart,
    total: countOf(week['total']),
    days: days.length === DAYS_A_WEEK ? days : new Array<number>(DAYS_A_WEEK).fill(0),
  };
}

function contributorWeekOf(week: Json): ContributorWeek | null {
  const weekStart = weekStartOf(week['w']);
  return weekStart
    ? {
        weekStart,
        commits: countOf(week['c']),
        additions: countOf(week['a']),
        deletions: countOf(week['d']),
      }
    : null;
}

const BOT_LOGIN = /\[bot\]$/;

/** An author GitHub could not match to an account has no login, so cannot be named. */
function contributorOf(entry: Json): ContributorStats | null {
  const author = isJson(entry['author']) ? entry['author'] : {};
  const login = author['login'];
  if (!isText(login)) return null;
  return {
    login,
    isBot: author['type'] === 'Bot' || BOT_LOGIN.test(login),
    weeks: jsonList(entry['weeks'])
      .map(contributorWeekOf)
      .filter((week) => week !== null),
  };
}

function trafficDayOf(day: Json): TrafficDay | null {
  return isText(day['timestamp'])
    ? { day: day['timestamp'], count: countOf(day['count']), uniques: countOf(day['uniques']) }
    : null;
}

/** The weeks in a `GET /stats/commit_activity` answer, or null while GitHub is still counting. */
export function commitWeeksOf(body: unknown): CommitWeek[] | null {
  if (isStillCounting(body)) return null;
  return jsonList(body)
    .map(commitWeekOf)
    .filter((week) => week !== null);
}

/** The authors in a `GET /stats/contributors` answer, or null while GitHub is still counting. */
export function contributorStatsOf(body: unknown): ContributorStats[] | null {
  if (isStillCounting(body)) return null;
  return jsonList(body)
    .map(contributorOf)
    .filter((person) => person !== null);
}

/** A `GET /traffic/views` or `/traffic/clones` answer, whose days sit under `key`. */
export function trafficSeriesOf(body: unknown, key: 'views' | 'clones'): TrafficSeries {
  const answer = isJson(body) ? body : {};
  return {
    count: countOf(answer['count']),
    uniques: countOf(answer['uniques']),
    days: jsonList(answer[key])
      .map(trafficDayOf)
      .filter((day) => day !== null),
  };
}

export async function readCommitActivity(get: JsonGet, repo: string): Promise<CommitWeek[] | null> {
  return commitWeeksOf(await get(`repos/${repo}/stats/commit_activity`));
}

export async function readContributorStats(
  get: JsonGet,
  repo: string,
): Promise<ContributorStats[] | null> {
  return contributorStatsOf(await get(`repos/${repo}/stats/contributors`));
}

export async function readTraffic(
  get: JsonGet,
  repo: string,
  key: 'views' | 'clones',
): Promise<TrafficSeries> {
  return trafficSeriesOf(await get(`repos/${repo}/traffic/${key}`), key);
}

/** The reader over one way of reading GitHub's REST API. */
export const insightsReader = (get: JsonGet): InsightsReader => ({
  commitActivity: (repo) => readCommitActivity(get, repo),
  contributorStats: (repo) => readContributorStats(get, repo),
  trafficViews: (repo) => readTraffic(get, repo, 'views'),
  trafficClones: (repo) => readTraffic(get, repo, 'clones'),
});
