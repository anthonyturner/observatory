import { Issue, parseIssue } from './issues-report';

/** Observatory's own API for one issue, given `repo` and `number`. */
export const ISSUE_URL = '/api/issue';

/** What `GET /api/issue` returns: the list's row, the full title and the description. */
export interface IssueDetail extends Issue {
  readonly body: string;
  /** The description was cut to fit. */
  readonly bodyTruncated: boolean;
  readonly fetchedAt: string;
}

/** Reads one issue defensively; null when it is not one. */
export function parseIssueDetail(value: unknown): IssueDetail | null {
  const issue = parseIssue(value);
  if (!issue || typeof value !== 'object' || value === null) return null;
  const { body, bodyTruncated, fetchedAt } = value as Record<string, unknown>;
  return {
    ...issue,
    body: typeof body === 'string' ? body : '',
    bodyTruncated: bodyTruncated === true,
    fetchedAt: typeof fetchedAt === 'string' ? fetchedAt : '',
  };
}
