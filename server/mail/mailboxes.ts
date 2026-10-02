import { type KeyedCache, keyedCache } from '../util/cached-by-key.ts';
import { keyScrubber } from '../util/key-scrub.ts';
import { IMAP_SERVERS, type InboxFetcher, MailError } from './imap-inbox.ts';
import { MAIL_ENV, type MailLogin } from './mail-settings.ts';
import type { InboxPage, MailAccount, MailboxReport } from './mail-types.ts';

/** Each account's inbox, read at most so often, and any one read again on demand. */
export type Mailboxes = KeyedCache<MailboxReport, MailAccount>;

export interface MailboxesOptions {
  /** Each account's login; null for one not set up. */
  readonly logins: Readonly<Record<MailAccount, MailLogin | null>>;
  readonly fetchInbox: InboxFetcher;
  readonly clock?: () => number;
  readonly warn?: (message: string) => void;
  readonly deadlineMs?: number;
}

/** New mail is worth a minute's wait; asking more often only costs sign-ins. */
const LIST_TTL_MS = 60_000;
/** A server that was slow or out of reach is worth asking again before long. */
const FAILURE_TTL_MS = 5 * 60_000;
/** Retrying a refused password unasked is how a provider locks an account, so
 *  only Refresh (which forgets it) or a restart asks again. */
const REFUSED_TTL_MS = Number.POSITIVE_INFINITY;
const DEADLINE_MS = 15_000;

function lifetimeOf(report: MailboxReport): number {
  if (report.state !== 'failed') return LIST_TTL_MS;
  return report.failure === 'sign-in' ? REFUSED_TTL_MS : FAILURE_TTL_MS;
}

const settingsOf = (account: MailAccount): readonly string[] => [
  MAIL_ENV[account].address,
  MAIL_ENV[account].password,
];

/** `read` with a signal that fires at the deadline, which it is also abandoned at. */
async function withDeadline<T>(read: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const deadline = new AbortController();
  const expired = new Promise<never>((_, reject) => {
    deadline.signal.addEventListener('abort', () => reject(new MailError('timeout')), {
      once: true,
    });
  });
  const timer = setTimeout(() => deadline.abort(), ms);
  try {
    return await Promise.race([read(deadline.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}

const detailOf = (error: unknown): unknown =>
  error instanceof MailError && error.cause !== undefined ? error.cause : error;

/** Every inbox Home lists, each read on its own, so a slow or failing one never holds up the other. */
export function mailboxes(options: MailboxesOptions): Mailboxes {
  const { logins, fetchInbox, clock = Date.now, warn = console.warn } = options;
  const deadlineMs = options.deadlineMs ?? DEADLINE_MS;

  const listed = async (account: MailAccount, login: MailLogin): Promise<InboxPage> =>
    withDeadline(
      (signal) => fetchInbox({ login, server: IMAP_SERVERS[account], signal }),
      deadlineMs,
    );

  const load = async (account: MailAccount): Promise<MailboxReport> => {
    const login = logins[account];
    if (!login) return { account, state: 'off', settings: settingsOf(account) };
    const checkedAt = new Date(clock()).toISOString();
    try {
      const page = await listed(account, login);
      return { account, state: 'listed', address: login.address, checkedAt, ...page };
    } catch (error) {
      const failure = error instanceof MailError ? error.failure : 'unknown';
      const scrub = keyScrubber(login.password);
      warn(`Mail: the ${account} inbox could not be read (${failure}): ${scrub(detailOf(error))}`);
      return { account, state: 'failed', failure, settings: settingsOf(account), checkedAt };
    }
  };

  return keyedCache(load, lifetimeOf, clock);
}
