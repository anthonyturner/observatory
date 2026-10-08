import { type Json, type JsonGet, isJson, isText, jsonList } from './rest-json.ts';

/** One unread GitHub notification thread, as the inbox needs it. */
export interface GitHubNotification {
  /** The thread's id, which marking it read takes. */
  readonly id: string;
  /** Why it came: `review_requested`, `mention`, `assign`, `author`, `ci_activity`, … */
  readonly reason: string;
  /** `owner/name`. */
  readonly repo: string;
  readonly title: string;
  /** GitHub's subject type: `PullRequest`, `Issue`, `CheckSuite`, `Release`, … */
  readonly subjectType: string;
  /** The subject's API URL; null for a CI run, which has none. */
  readonly subjectUrl: string | null;
  readonly updatedAt: string;
}

/** What the Inbox reads of the account's notifications, and nothing else. */
export interface NotificationReader {
  /** Unread notifications across every repository, up to NOTIFICATION_LIMIT. Rejects
   *  when the token may not read them. */
  notifications(): Promise<GitHubNotification[]>;
}

/** GitHub lists at most fifty notifications a page. */
const PAGE_SIZE = 50;
const PAGE_LIMIT = 4;
export const NOTIFICATION_LIMIT = PAGE_SIZE * PAGE_LIMIT;

const objectOf = (value: unknown): Json => (isJson(value) ? value : {});

function notificationOf(thread: Json): GitHubNotification | null {
  const { id, reason, updated_at: updatedAt } = thread;
  const subject = objectOf(thread['subject']);
  const repo = objectOf(thread['repository'])['full_name'];
  const { title, type, url } = subject;
  if (!isText(id) || !isText(repo) || !isText(updatedAt) || !isText(title)) return null;
  return {
    id,
    reason: isText(reason) ? reason : 'subscribed',
    repo,
    title,
    subjectType: isText(type) ? type : '',
    subjectUrl: isText(url) ? url : null,
    updatedAt,
  };
}

/** The threads in a `GET /notifications` answer. */
export const notificationsOf = (body: unknown): GitHubNotification[] =>
  jsonList(body)
    .map(notificationOf)
    .filter((thread) => thread !== null);

const pagePath = (page: number): string => `notifications?per_page=${PAGE_SIZE}&page=${page}`;

/** Unread notifications a page at a time, until a page comes back short or PAGE_LIMIT are read. */
export async function readNotifications(get: JsonGet): Promise<GitHubNotification[]> {
  const threads: GitHubNotification[] = [];
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const body = await get(pagePath(page));
    threads.push(...notificationsOf(body));
    if (jsonList(body).length < PAGE_SIZE) break;
  }
  return threads;
}

/** The reader over one way of reading GitHub's REST API. */
export const notificationReader = (get: JsonGet): NotificationReader => ({
  notifications: () => readNotifications(get),
});
