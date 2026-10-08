import { timeOf } from '../actions/actions-report';
import { isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';

/** `read`, or why not: the token has `no-access` to notifications, or GitHub `failed` to answer. */
export type InboxStatus = 'read' | 'no-access' | 'failed';
const INBOX_STATUSES: readonly InboxStatus[] = ['read', 'no-access', 'failed'];

/** One unread GitHub notification. */
export interface InboxItem {
  /** The thread's id, which Mark as read takes. */
  readonly id: string;
  /** `owner/name`. */
  readonly repo: string;
  /** GitHub's reason: `review_requested`, `mention`, `assign`, `author`, `ci_activity`, … */
  readonly reason: string;
  /** GitHub's subject type: `PullRequest`, `Issue`, `CheckSuite`, `Release`, … */
  readonly subjectType: string;
  /** The pull request's or issue's number; null for any other subject. */
  readonly number: number | null;
  readonly title: string;
  /** Milliseconds since the epoch. */
  readonly updatedAt: number;
  /** The subject's page on GitHub. */
  readonly url: string;
}

/** What `GET /api/inbox` returns. */
export interface InboxReport {
  /** Milliseconds since the epoch: when GitHub was read. */
  readonly generatedAt: number;
  readonly status: InboxStatus;
  /** Why nothing was read, in a line; null when it was. */
  readonly note: string | null;
  /** Newest first. */
  readonly items: readonly InboxItem[];
  /** More were unread than the inbox reads at once. */
  readonly isCapped: boolean;
}

const isInboxStatus = oneOf(INBOX_STATUSES);
/** Only a link to GitHub's own site is drawn as one. */
const GITHUB_PAGE = /^https:\/\/github\.com\//;

function parseItem(value: unknown): InboxItem | null {
  if (!isObject(value)) return null;
  const { id, repo, reason, subjectType, number, title, url } = value;
  const updatedAt = timeOf(value['updatedAt']);
  if (!isText(id) || !isText(repo) || !isText(title) || updatedAt === null) return null;
  if (!isText(url) || !GITHUB_PAGE.test(url)) return null;
  return {
    id,
    repo,
    reason: isText(reason) ? reason : '',
    subjectType: isText(subjectType) ? subjectType : '',
    number: isNumber(number) && Number.isInteger(number) && number > 0 ? number : null,
    title,
    updatedAt,
    url,
  };
}

/** The API's answer, checked; null when it is not an inbox report. */
export function parseInboxReport(body: unknown): InboxReport | null {
  if (!isObject(body) || !isInboxStatus(body['status'])) return null;
  const generatedAt = timeOf(body['generatedAt']);
  if (generatedAt === null) return null;
  return {
    generatedAt,
    status: body['status'],
    note: isText(body['note']) ? body['note'] : null,
    items: listOf(body['items'], parseItem),
    isCapped: body['isCapped'] === true,
  };
}
