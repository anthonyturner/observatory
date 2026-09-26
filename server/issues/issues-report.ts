import type { ClosingPull, IssueReader, RawIssue } from '../github/issue-reader.ts';

const DAY_MS = 86_400_000;
/** How far back the closed list reaches, as pr-starmap's memory ledger does. */
export const ISSUE_DAYS = 60;
const TITLE_MAX = 200;

export interface IssueLabel {
  readonly name: string;
  readonly color: string;
}

/** One issue as pr-starmap's `issues/current` lists it. */
export interface IssueRow {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly labels: readonly IssueLabel[];
  readonly assignees: readonly string[];
  /** Null for a deleted account. */
  readonly author: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
  /** Closed issues only: `COMPLETED`, `NOT_PLANNED`, `DUPLICATE`, or null. */
  readonly stateReason?: string | null;
  /** Open issues only: no open pull request closes it. */
  readonly comet?: boolean;
  /** This repository's pull requests linked to it, open or not. */
  readonly prs: readonly number[];
}

/** What `GET /api/issues` returns: pr-starmap's `issues/current`, and the repository. */
export interface IssuesReport {
  readonly generatedAt: string;
  readonly repo: string;
  /** How far back `closed` reaches. */
  readonly days: number;
  readonly total: { readonly open: number; readonly closed: number; readonly comets: number };
  /** Most recently touched first. */
  readonly open: readonly IssueRow[];
  /** Most recently closed first. */
  readonly closed: readonly IssueRow[];
}

const clip = (title: string): string =>
  title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;

/** `https://github.com/o/r/issues/1` and `…/o/r/pull/2` are the same repository. */
const repoOf = (url: string): string => url.split('/').slice(0, 5).join('/').toLowerCase();

/** Issue URL → the open pull requests that close it. By URL, not number: a pull
 *  request closing `other/repo#12` must not claim this repository's #12. */
export function openedBy(pulls: readonly ClosingPull[]): Map<string, number[]> {
  const opened = new Map<string, number[]>();
  for (const pull of pulls) {
    for (const { url } of pull.closingIssuesReferences ?? []) {
      opened.set(url, [...(opened.get(url) ?? []), pull.number]);
    }
  }
  return opened;
}

/** One issue as the list shows it, with every pull request linked to it. */
export function issueRowOf(issue: RawIssue, opened: ReadonlyMap<string, number[]>): IssueRow {
  const mine = opened.get(issue.url) ?? [];
  // Only this repository's pull requests: the page can open those.
  const linked = (issue.closedByPullRequestsReferences ?? [])
    .filter((pull) => repoOf(pull.url) === repoOf(issue.url))
    .map((pull) => pull.number);
  return {
    number: issue.number,
    title: clip(issue.title),
    url: issue.url,
    labels: (issue.labels ?? []).map((label) => ({ name: label.name, color: label.color })),
    assignees: (issue.assignees ?? []).map((assignee) => assignee.login),
    author: issue.author?.login ?? null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    closedAt: issue.closedAt || null,
    ...(issue.closedAt ? { stateReason: issue.stateReason || null } : { comet: !mine.length }),
    prs: [...new Set([...mine, ...linked])].sort((a, b) => a - b),
  };
}

/** "2026-07-28": the day `days` before `now`, as GitHub's search takes it. */
export const dayBefore = (now: number, days: number): string =>
  new Date(now - days * DAY_MS).toISOString().slice(0, 10);

const byTouched = (a: IssueRow, b: IssueRow): number =>
  b.updatedAt.localeCompare(a.updatedAt) || b.number - a.number;
const byClosed = (a: IssueRow, b: IssueRow): number =>
  (b.closedAt ?? '').localeCompare(a.closedAt ?? '') || b.number - a.number;

/** A repository's open issues and those closed within `ISSUE_DAYS`, each with
 *  the pull requests linked to it, as pr-starmap's `bin/issues.mjs` reads them. */
export async function issuesReport(
  github: IssueReader,
  repo: string,
  now = Date.now(),
): Promise<IssuesReport> {
  const closedSince = new Date(now - ISSUE_DAYS * DAY_MS).toISOString();
  const [openIssues, closedIssues, pulls] = await Promise.all([
    github.openIssues(repo),
    github.closedIssues(repo, dayBefore(now, ISSUE_DAYS)),
    github.closingPulls(repo),
  ]);
  const opened = openedBy(pulls);
  const open = openIssues.map((issue) => issueRowOf(issue, opened)).sort(byTouched);
  // GitHub's search window is whole days; the report's is exact.
  const closed = closedIssues
    .filter((issue) => issue.closedAt && issue.closedAt >= closedSince)
    .map((issue) => issueRowOf(issue, opened))
    .sort(byClosed);
  return {
    generatedAt: new Date(now).toISOString(),
    repo,
    days: ISSUE_DAYS,
    total: {
      open: open.length,
      closed: closed.length,
      comets: open.filter((issue) => issue.comet).length,
    },
    open,
    closed,
  };
}
