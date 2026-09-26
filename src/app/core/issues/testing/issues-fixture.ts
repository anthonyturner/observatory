import { Issue, IssuesReport } from '../issues-report';

/** An issue for tests, open and nobody on it unless told otherwise. */
export const anIssue = (number: number, fields: Partial<Issue> = {}): Issue => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/me/a/issues/${number}`,
  labels: [],
  assignees: [],
  author: 'me',
  createdAt: '2026-09-01T12:00:00Z',
  updatedAt: '2026-09-20T12:00:00Z',
  closedAt: null,
  stateReason: null,
  comet: true,
  prs: [],
  ...fields,
});

/** A report of `open` and `closed`, with totals that count them. */
export const aReport = (open: Issue[], closed: Issue[] = []): IssuesReport => ({
  generatedAt: '2026-09-26T12:00:00Z',
  repo: 'me/a',
  days: 60,
  total: {
    open: open.length,
    closed: closed.length,
    comets: open.filter((issue) => issue.comet).length,
  },
  open,
  closed,
});
