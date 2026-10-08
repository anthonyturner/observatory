import type { InboxMarker } from '../github/inbox-marker.ts';
import { BadRequest, type RouteTable } from '../http/api-handler.ts';
import { fieldsOf } from '../http/body-fields.ts';
import { isFresh } from '../http/fresh-query.ts';
import type { InboxReport } from './inbox-types.ts';

export const INBOX_PATH = '/api/inbox';
export const INBOX_READ_PATH = '/api/inbox/read';
export const INBOX_READ_ALL_PATH = '/api/inbox/read-all';

/** What the inbox reads, through the API's cache. */
export interface InboxSources {
  inbox(): Promise<InboxReport>;
  /** The next read of the inbox goes to GitHub, not the cache. */
  forgetInbox(): void;
}

/** Thread ids are past twenty-six billion already; twenty digits leaves room and stays a path part. */
const THREAD_ID = /^\d{1,20}$/;
/** GitHub's own timestamp form, to the second. */
const WHOLE_SECONDS = /\.\d{3}Z$/;

export function threadIdFrom(value: unknown): string {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !THREAD_ID.test(text)) {
    throw new BadRequest('id must be a notification thread id');
  }
  return text;
}

/** An instant from a request, as GitHub writes one: `2026-10-08T12:00:00Z`. */
export function instantFrom(value: unknown): string {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms)) throw new BadRequest('before must be an ISO 8601 time');
  return new Date(ms).toISOString().replace(WHOLE_SECONDS, 'Z');
}

/** Runs a mark on GitHub, then drops the cached inbox even when GitHub refused, as it may be stale. */
async function marked<T>(sources: InboxSources, mark: Promise<void>, answer: T): Promise<T> {
  try {
    await mark;
  } finally {
    sources.forgetInbox();
  }
  return answer;
}

/**
 * `table` with the Inbox, the owner's own GitHub notifications:
 *
 *   GET  /api/inbox                       → InboxReport; `fresh=1` reads GitHub now
 *   POST /api/inbox/read { id }           → { id }: that thread marked read
 *   POST /api/inbox/read-all { before }   → { before }: every thread updated by then marked read
 */
export function withInboxRoutes(
  table: RouteTable,
  sources: InboxSources,
  marker: InboxMarker,
): RouteTable {
  return {
    ...table,
    get: {
      ...table.get,
      [INBOX_PATH]: (query) => {
        if (isFresh(query)) sources.forgetInbox();
        return sources.inbox();
      },
    },
    post: {
      ...table.post,
      [INBOX_READ_PATH]: (body) => {
        const id = threadIdFrom(fieldsOf(body)['id']);
        return marked(sources, marker.markThreadRead(id), { id });
      },
      [INBOX_READ_ALL_PATH]: (body) => {
        const before = instantFrom(fieldsOf(body)['before']);
        return marked(sources, marker.markAllRead(before), { before });
      },
    },
  };
}
