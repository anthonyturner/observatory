/** `read`, or why not: the token has `no-access` to notifications, or GitHub `failed` to answer. */
export type InboxStatus = 'read' | 'no-access' | 'failed';

/** One unread notification, ready to list. */
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
  readonly updatedAt: string;
  /** The subject's page on GitHub. */
  readonly url: string;
}

/** What `GET /api/inbox` returns. */
export interface InboxReport {
  readonly generatedAt: string;
  readonly status: InboxStatus;
  /** One plain line on why nothing was read; null when it was. */
  readonly note: string | null;
  /** Newest first. */
  readonly items: readonly InboxItem[];
  /** More were unread than the inbox reads at once. */
  readonly isCapped: boolean;
}
