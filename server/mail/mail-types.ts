/** The two inboxes Home lists, one tab each. */
export type MailAccount = 'icloud' | 'gmail';

export const MAIL_ACCOUNTS: readonly MailAccount[] = ['icloud', 'gmail'];

/** Why an inbox could not be read, in fixed words: no server text reaches the page. */
export type MailFailure = 'sign-in' | 'timeout' | 'unreachable' | 'unknown';

/** One message in an inbox list: who it is from, what it is about, and whether it is read. */
export interface InboxMessage {
  /** The message's IMAP UID: stable within the inbox, so the page can key a row on it. */
  readonly uid: number;
  /** The sender's name, or the address where the message gives no name. */
  readonly from: string;
  readonly fromAddress: string;
  readonly subject: string;
  /** ISO time the inbox received it; null where the server gave none. */
  readonly receivedAt: string | null;
  readonly isUnread: boolean;
}

/** What one read of an inbox found. */
export interface InboxPage {
  /** Every message in the inbox, not only the ones listed. */
  readonly total: number;
  readonly unread: number;
  /** The newest messages, newest first. */
  readonly messages: readonly InboxMessage[];
}

/**
 * One account's inbox, as `GET /api/mail?account=…` answers it: not set up,
 * failed, or listed. The first two name the account's settings, never their values.
 */
export type MailboxReport =
  | { readonly account: MailAccount; readonly state: 'off'; readonly settings: readonly string[] }
  | {
      readonly account: MailAccount;
      readonly state: 'failed';
      readonly failure: MailFailure;
      readonly settings: readonly string[];
      readonly checkedAt: string;
    }
  | ({
      readonly account: MailAccount;
      readonly state: 'listed';
      readonly address: string;
      readonly checkedAt: string;
    } & InboxPage);
