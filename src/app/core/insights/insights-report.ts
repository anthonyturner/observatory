import { timeOf } from '../actions/actions-report';
import { isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';
import { FinishedPull, parseFinished } from '../queue/ledger';

/**
 * Read, or why a part is empty: GitHub is still `counting` it, the token has
 * `no-access`, GitHub `failed` to answer, or it is `withheld` from a visitor.
 */
export type PartStatus = 'read' | 'counting' | 'no-access' | 'failed' | 'withheld';
const PART_STATUSES: readonly PartStatus[] = [
  'read',
  'counting',
  'no-access',
  'failed',
  'withheld',
];

export interface PartState {
  readonly status: PartStatus;
  /** Why nothing was read, in a line; null when it was. */
  readonly note: string | null;
}

/** One week of commits to the default branch. */
export interface CommitWeek {
  /** Milliseconds since the epoch: GitHub's weeks start on a Sunday. */
  readonly start: number;
  readonly total: number;
  /** Sunday first. */
  readonly days: readonly number[];
}

export interface Contributor {
  readonly login: string;
  readonly isBot: boolean;
  readonly commits: number;
  readonly additions: number;
  readonly deletions: number;
}

export interface TrafficDay {
  readonly day: number;
  readonly count: number;
  readonly uniques: number;
}

export interface TrafficSeries {
  readonly count: number;
  readonly uniques: number;
  readonly days: readonly TrafficDay[];
}

/** What `GET /api/insights` returns. */
export interface InsightsReport {
  readonly generatedAt: number;
  readonly repo: string;
  readonly weeks: number;
  readonly commits: PartState & { readonly weeks: readonly CommitWeek[] };
  readonly contributors: PartState & { readonly people: readonly Contributor[] };
  readonly pulls: PartState & { readonly finished: readonly FinishedPull[] };
  readonly traffic: PartState & {
    readonly views: TrafficSeries | null;
    readonly clones: TrafficSeries | null;
  };
}

const DAYS_A_WEEK = 7;
const isPartStatus = oneOf(PART_STATUSES);
const countOf = (value: unknown): number =>
  isNumber(value) && Number.isInteger(value) && value > 0 ? value : 0;
const partOf = (value: unknown): Record<string, unknown> => (isObject(value) ? value : {});

/** A part with no status it knows reads as one GitHub did not answer for. */
function stateOf(part: Record<string, unknown>): PartState {
  const status = isPartStatus(part['status']) ? part['status'] : 'failed';
  return { status, note: isText(part['note']) ? part['note'] : null };
}

function parseWeek(value: unknown): CommitWeek | null {
  if (!isObject(value)) return null;
  const start = timeOf(value['weekStart']);
  const days = Array.isArray(value['days']) ? value['days'].map(countOf) : [];
  if (start === null || days.length !== DAYS_A_WEEK) return null;
  return { start, total: countOf(value['total']), days };
}

function parseContributor(value: unknown): Contributor | null {
  if (!isObject(value) || !isText(value['login'])) return null;
  return {
    login: value['login'],
    isBot: value['isBot'] === true,
    commits: countOf(value['commits']),
    additions: countOf(value['additions']),
    deletions: countOf(value['deletions']),
  };
}

function parseDay(value: unknown): TrafficDay | null {
  if (!isObject(value)) return null;
  const day = timeOf(value['day']);
  return day === null
    ? null
    : { day, count: countOf(value['count']), uniques: countOf(value['uniques']) };
}

function parseSeries(value: unknown): TrafficSeries | null {
  if (!isObject(value)) return null;
  return {
    count: countOf(value['count']),
    uniques: countOf(value['uniques']),
    days: listOf(value['days'], parseDay),
  };
}

/** The report, checked field by field, or null when the answer is not one or spans no weeks. */
export function parseInsightsReport(body: unknown): InsightsReport | null {
  if (!isObject(body) || !isText(body['repo'])) return null;
  const generatedAt = timeOf(body['generatedAt']);
  const weeks = countOf(body['weeks']);
  if (generatedAt === null || !weeks) return null;
  const commits = partOf(body['commits']);
  const contributors = partOf(body['contributors']);
  const pulls = partOf(body['pulls']);
  const traffic = partOf(body['traffic']);
  return {
    generatedAt,
    repo: body['repo'],
    weeks,
    commits: { ...stateOf(commits), weeks: listOf(commits['weeks'], parseWeek) },
    contributors: {
      ...stateOf(contributors),
      people: listOf(contributors['people'], parseContributor),
    },
    pulls: { ...stateOf(pulls), finished: listOf(pulls['finished'], parseFinished) },
    traffic: {
      ...stateOf(traffic),
      views: parseSeries(traffic['views']),
      clones: parseSeries(traffic['clones']),
    },
  };
}

/** GitHub was still counting something, so asking again soon may fill it in. */
export const isCounting = (report: InsightsReport): boolean =>
  report.commits.status === 'counting' || report.contributors.status === 'counting';
