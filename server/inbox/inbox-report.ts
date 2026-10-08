import {
  type GitHubNotification,
  NOTIFICATION_LIMIT,
  type NotificationReader,
} from '../github/notification-reader.ts';
import type { InboxItem, InboxReport, InboxStatus } from './inbox-types.ts';
import { subjectPageOf } from './subject-page.ts';

/** Both `gh api` and the REST client put GitHub's status in the error. */
const DENIED = /HTTP (?:401|403|404)\b/;

/** GitHub's REST docs: a classic token's scopes; fine-grained and app tokens get no notifications. */
const NO_ACCESS_NOTE =
  'The GitHub token cannot read notifications: a classic token needs the notifications or repo scope. Fine-grained tokens cannot read them at all.';
const FAILED_NOTE = 'GitHub did not answer for notifications. Try again in a moment.';

interface InboxFailure {
  readonly status: Exclude<InboxStatus, 'read'>;
  readonly note: string;
}

/** The plain note for notifications GitHub would not give. */
export function inboxFailureOf(error: unknown): InboxFailure {
  const message = error instanceof Error ? error.message : String(error);
  return DENIED.test(message)
    ? { status: 'no-access', note: NO_ACCESS_NOTE }
    : { status: 'failed', note: FAILED_NOTE };
}

export function inboxItemOf(thread: GitHubNotification): InboxItem {
  const { url, number } = subjectPageOf(thread.repo, thread.subjectType, thread.subjectUrl);
  return {
    id: thread.id,
    repo: thread.repo,
    reason: thread.reason,
    subjectType: thread.subjectType,
    number,
    title: thread.title,
    updatedAt: thread.updatedAt,
    url,
  };
}

const newestFirst = (a: InboxItem, b: InboxItem): number => b.updatedAt.localeCompare(a.updatedAt);

/** Every unread notification, newest first, or a plain note on why none could be read. */
export async function inboxReport(reader: NotificationReader, now: Date): Promise<InboxReport> {
  const generatedAt = now.toISOString();
  try {
    const threads = await reader.notifications();
    return {
      generatedAt,
      status: 'read',
      note: null,
      items: threads.map(inboxItemOf).sort(newestFirst),
      isCapped: threads.length >= NOTIFICATION_LIMIT,
    };
  } catch (error) {
    console.error('Could not read the notifications:', error);
    return { generatedAt, ...inboxFailureOf(error), items: [], isCapped: false };
  }
}
