import { BadRequest, type RouteTable } from '../http/api-handler.ts';
import type { Mailboxes } from './mailboxes.ts';
import { MAIL_ACCOUNTS, type MailAccount } from './mail-types.ts';

export const MAIL_PATH = '/api/mail';

/** Every mail path, for main.ts to put behind the loopback guard: it matches exact paths. */
export const MAIL_PATHS: ReadonlySet<string> = new Set([MAIL_PATH]);

const REFRESH = '1';

function accountOf(query: URLSearchParams): MailAccount {
  const said = query.get('account');
  const account = MAIL_ACCOUNTS.find((each) => each === said);
  if (!account) throw new BadRequest(`bad request: account must be ${MAIL_ACCOUNTS.join(' or ')}`);
  return account;
}

/**
 * `table` with Home's inboxes, read-only:
 *
 *   GET /api/mail?account=icloud|gmail[&refresh=1]   one MailboxReport
 *
 * Guarded by the write header, and by the loopback guard in main.ts: it signs
 * in to the owner's mail. The hosted site never adds it (ADR-0006).
 */
export function withMailRoutes(table: RouteTable, mail: Mailboxes): RouteTable {
  const read = async (query: URLSearchParams): Promise<unknown> => {
    const account = accountOf(query);
    if (query.get('refresh') === REFRESH) mail.forget(account);
    return mail.read(account);
  };
  return { ...table, guardedGet: { ...table.guardedGet, [MAIL_PATH]: read } };
}
