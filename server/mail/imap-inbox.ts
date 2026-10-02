import type { MailLogin } from './mail-settings.ts';
import type { InboxMessage, InboxPage, MailAccount, MailFailure } from './mail-types.ts';

/** Where an account's mail is read from. */
export interface ImapServer {
  readonly host: string;
  readonly port: number;
}

/** Fixed in code: the only servers these logins are ever sent to. */
export const IMAP_SERVERS: Readonly<Record<MailAccount, ImapServer>> = {
  icloud: { host: 'imap.mail.me.com', port: 993 },
  gmail: { host: 'imap.gmail.com', port: 993 },
};

/** How a client is made: TLS from the first byte, and no logger, which would
 *  otherwise write the session (sign-in included) to the console. */
export interface ImapClientOptions {
  readonly host: string;
  readonly port: number;
  readonly secure: true;
  readonly auth: { readonly user: string; readonly pass: string };
  readonly logger: false;
  readonly disableAutoIdle: true;
  readonly connectionTimeout: number;
  readonly greetingTimeout: number;
  readonly socketTimeout: number;
}

/** What one listed message carries: flags and headers, never a body. */
export interface ImapMessage {
  readonly seq: number;
  readonly uid: number;
  readonly flags?: ReadonlySet<string>;
  readonly envelope?: {
    readonly subject?: string;
    readonly from?: ReadonlyArray<{ readonly name?: string; readonly address?: string }>;
  };
  readonly internalDate?: Date | string;
}

const LIST_QUERY = { uid: true, flags: true, envelope: true, internalDate: true } as const;

/** The part of an IMAP client this reads with. It has no way to change a flag,
 *  move or delete a message: nothing here can mark mail read. */
export interface ImapClient {
  readonly mailbox: { readonly exists: number } | false;
  on(event: 'error', listener: (error: unknown) => void): unknown;
  connect(): Promise<void>;
  status(
    path: string,
    query: { readonly unseen: true },
  ): Promise<{ readonly unseen?: number } | false>;
  getMailboxLock(path: string, options: { readonly readOnly: true }): Promise<{ release(): void }>;
  fetchAll(range: string, query: typeof LIST_QUERY): Promise<readonly ImapMessage[]>;
  logout(): Promise<void>;
  close(): void;
}

/** One read of an inbox: whose, where, and until when it may take. */
export interface InboxRequest {
  readonly login: MailLogin;
  readonly server: ImapServer;
  readonly signal: AbortSignal;
}

/** Reads one inbox's newest messages, or throws a MailError saying why not. */
export type InboxFetcher = (request: InboxRequest) => Promise<InboxPage>;

/** Why an inbox could not be read; the library's own error is kept as the cause, for the log only. */
export class MailError extends Error {
  readonly failure: MailFailure;

  constructor(failure: MailFailure, options?: ErrorOptions) {
    super(`mail ${failure}`, options);
    this.failure = failure;
  }
}

const INBOX = 'INBOX';
export const LISTED_MESSAGES = 20;
const SEEN = '\\Seen';
/** The library's own limits sit under the reader's overall 15 s deadline. */
const STEP_TIMEOUT_MS = 10_000;

const TIMEOUT_CODES: ReadonlySet<string> = new Set([
  'CONNECT_TIMEOUT',
  'GREETING_TIMEOUT',
  'UPGRADE_TIMEOUT',
  'ETIMEOUT',
  'ETIMEDOUT',
]);
const UNREACHABLE_CODES: ReadonlySet<string> = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'NoConnection',
  'EConnectionClosed',
  'ClosedAfterConnectTLS',
  'ClosedAfterConnectText',
]);

const fieldOf = (error: unknown, name: string): unknown =>
  typeof error === 'object' && error !== null ? Reflect.get(error, name) : undefined;

/** What went wrong, from the library's error, in the page's fixed words. */
function failureOf(error: unknown): MailFailure {
  if (fieldOf(error, 'authenticationFailed') === true) return 'sign-in';
  if (fieldOf(error, 'serverResponseCode') === 'AUTHENTICATIONFAILED') return 'sign-in';
  const code = fieldOf(error, 'code');
  if (typeof code !== 'string') return 'unknown';
  if (TIMEOUT_CODES.has(code)) return 'timeout';
  return UNREACHABLE_CODES.has(code) ? 'unreachable' : 'unknown';
}

const clientOptions = (login: MailLogin, server: ImapServer): ImapClientOptions => ({
  host: server.host,
  port: server.port,
  secure: true,
  auth: { user: login.address, pass: login.password },
  logger: false,
  disableAutoIdle: true,
  connectionTimeout: STEP_TIMEOUT_MS,
  greetingTimeout: STEP_TIMEOUT_MS,
  socketTimeout: STEP_TIMEOUT_MS,
});

function isoOf(date: Date | string | undefined): string | null {
  if (date === undefined) return null;
  const time = new Date(date).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function inboxMessage(message: ImapMessage): InboxMessage {
  const sender = message.envelope?.from?.[0];
  const fromAddress = sender?.address ?? '';
  return {
    uid: message.uid,
    from: sender?.name || fromAddress,
    fromAddress,
    subject: message.envelope?.subject ?? '',
    receivedAt: isoOf(message.internalDate),
    isUnread: !message.flags?.has(SEEN),
  };
}

/** The sequence range of the newest messages: the inbox numbers them in the order they arrived. */
const newestRange = (total: number): string => `${Math.max(1, total - LISTED_MESSAGES + 1)}:*`;

async function readInbox(client: ImapClient): Promise<InboxPage> {
  const status = await client.status(INBOX, { unseen: true });
  // Read-only is EXAMINE: the server itself then refuses to set \Seen.
  const lock = await client.getMailboxLock(INBOX, { readOnly: true });
  try {
    const total = client.mailbox ? client.mailbox.exists : 0;
    const listed = total ? await client.fetchAll(newestRange(total), LIST_QUERY) : [];
    return {
      total,
      unread: status ? (status.unseen ?? 0) : 0,
      messages: [...listed].sort((a, b) => b.seq - a.seq).map(inboxMessage),
    };
  } finally {
    lock.release();
  }
}

async function signOut(client: ImapClient): Promise<void> {
  try {
    await client.logout();
  } catch {
    client.close();
  }
}

/** Reads inboxes over IMAP with clients from `createClient`. */
export function imapInbox(createClient: (options: ImapClientOptions) => ImapClient): InboxFetcher {
  return async ({ login, server, signal }) => {
    const client = createClient(clientOptions(login, server));
    // A connection that drops after sign-in reports it as an event; unheard, Node would crash the server.
    let dropped: unknown = null;
    client.on('error', (error) => {
      dropped = error;
    });
    const hangUp = (): void => client.close();
    signal.addEventListener('abort', hangUp, { once: true });
    try {
      await client.connect();
      return await readInbox(client);
    } catch (error) {
      const cause = dropped ?? error;
      throw new MailError(signal.aborted ? 'timeout' : failureOf(cause), { cause });
    } finally {
      signal.removeEventListener('abort', hangUp);
      await signOut(client);
    }
  };
}
