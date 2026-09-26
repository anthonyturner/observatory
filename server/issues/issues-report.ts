import type { ClosingPull, IssueReader, RawIssue } from '../github/issue-reader.ts';

const DAY_MS = 86_400_000;
/** How far back "closed recently" looks. */
export const CLOSED_WINDOW_DAYS = 30;

/** One open issue as the Issues tab lists it. */
export interface IssueItem {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  /** Open pull requests that say they close it; none means nobody is on it. */
  readonly pulls: readonly number[];
  readonly idleDays: number;
  readonly ageDays: number;
}

/** What `GET /api/issues` returns. */
export interface IssuesReport {
  readonly generatedAt: string;
  readonly repo: string;
  /** Nobody-on-it first, then in progress; the idlest first within each. */
  readonly items: readonly IssueItem[];
  readonly closedRecently: number;
  readonly closedWindowDays: number;
}

const daysSince = (iso: string, now: number): number =>
  Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS));

/** Issue number → the open pull requests that say they close it. */
export function pullsByIssue(pulls: readonly ClosingPull[]): Map<number, number[]> {
  const byIssue = new Map<number, number[]>();
  for (const pull of pulls) {
    for (const { number } of pull.closingIssuesReferences ?? []) {
      byIssue.set(number, [...(byIssue.get(number) ?? []), pull.number]);
    }
  }
  return byIssue;
}

export function issueItemOf(issue: RawIssue, pulls: readonly number[], now: number): IssueItem {
  return {
    number: issue.number,
    title: issue.title,
    url: issue.url,
    labels: (issue.labels ?? []).map((label) => label.name),
    assignees: (issue.assignees ?? []).map((assignee) => assignee.login),
    pulls: [...pulls].sort((a, b) => a - b),
    idleDays: daysSince(issue.updatedAt, now),
    ageDays: daysSince(issue.createdAt, now),
  };
}

/** Nobody-on-it first, the idlest first within each group, then by number. */
export function rankIssues(items: readonly IssueItem[]): IssueItem[] {
  return [...items].sort(
    (a, b) =>
      Number(a.pulls.length > 0) - Number(b.pulls.length > 0) ||
      b.idleDays - a.idleDays ||
      a.number - b.number,
  );
}

/** "2026-08-27": the day `days` before `now`, as GitHub's search takes it. */
export const dayBefore = (now: number, days: number): string =>
  new Date(now - days * DAY_MS).toISOString().slice(0, 10);

/** A repository's open issues and who, if anyone, is on each. */
export async function issuesReport(
  github: IssueReader,
  repo: string,
  now = Date.now(),
): Promise<IssuesReport> {
  const [issues, pulls, closedRecently] = await Promise.all([
    github.openIssues(repo),
    github.closingPulls(repo),
    github.closedSinceCount(repo, dayBefore(now, CLOSED_WINDOW_DAYS)),
  ]);
  const byIssue = pullsByIssue(pulls);
  return {
    generatedAt: new Date(now).toISOString(),
    repo,
    items: rankIssues(
      issues.map((issue) => issueItemOf(issue, byIssue.get(issue.number) ?? [], now)),
    ),
    closedRecently,
    closedWindowDays: CLOSED_WINDOW_DAYS,
  };
}
