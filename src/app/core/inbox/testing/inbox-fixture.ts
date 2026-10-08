import { Observable, of } from 'rxjs';
import { InboxApi } from '../inbox-api';

/** Noon UTC on 8 October 2026: when the fixture inbox was read. */
export const INBOX_NOW = '2026-10-08T12:00:00Z';

/** One thread as the API sends it: a review asked of you on me/app's pull request 7. */
export function inboxItemBody(id: string, more: Record<string, unknown> = {}) {
  return {
    id,
    repo: 'me/app',
    reason: 'review_requested',
    subjectType: 'PullRequest',
    number: 7,
    title: `Thread ${id}`,
    updatedAt: '2026-10-08T09:00:00Z',
    url: 'https://github.com/me/app/pull/7',
    ...more,
  };
}

/** The API's answer listing `items`, read at INBOX_NOW. */
export function inboxBody(items: readonly object[], more: Record<string, unknown> = {}) {
  return { generatedAt: INBOX_NOW, status: 'read', note: null, items, isCapped: false, ...more };
}

/** An inbox API that answers `body` and records every mark. */
export function fakeInboxApi(body: () => Observable<unknown> = () => of(inboxBody([]))) {
  const marked: string[] = [];
  const api: InboxApi = {
    read: body,
    markRead: (threadId) => {
      marked.push(threadId);
      return of(undefined);
    },
    markAllRead: (before) => {
      marked.push(`all before ${new Date(before).toISOString()}`);
      return of(undefined);
    },
  };
  return { api, marked };
}
