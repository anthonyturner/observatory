/** The two inboxes Home lists, one tab each. */
export type MailAccount = 'icloud' | 'gmail';

export const MAIL_ACCOUNTS: readonly MailAccount[] = ['icloud', 'gmail'];

/** Why the server could not read an inbox. */
export type MailFailure = 'sign-in' | 'timeout' | 'unreachable' | 'unknown';

/** One message in an inbox list, as `GET /api/mail` gives it. */
export interface MailMessage {
  readonly uid: number;
  /** The sender's name, or the address where the message gives no name. */
  readonly from: string;
  readonly fromAddress: string;
  readonly subject: string;
  /** ISO time the inbox received it; null where the server gave none. */
  readonly receivedAt: string | null;
  readonly isUnread: boolean;
}

/** One account's inbox, as the server reports it. `settings` are names, never values. */
export type MailboxReport =
  | { readonly account: MailAccount; readonly state: 'off'; readonly settings: readonly string[] }
  | {
      readonly account: MailAccount;
      readonly state: 'failed';
      readonly failure: MailFailure;
      readonly settings: readonly string[];
      readonly checkedAt: string;
    }
  | {
      readonly account: MailAccount;
      readonly state: 'listed';
      readonly address: string;
      readonly checkedAt: string;
      /** Every message in the inbox, not only the ones listed. */
      readonly total: number;
      readonly unread: number;
      readonly messages: readonly MailMessage[];
    };

/** What one read from the page got: a report, no mail on this site at all, or no answer. */
export type MailAnswer =
  | { readonly kind: 'report'; readonly report: MailboxReport }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unreachable' };

/** Why the last read left the report shown in place: the server's failure, or no API. */
export type MailProblem = MailFailure | 'api';

/** Where one inbox stands on the page. */
export interface MailboxState {
  readonly account: MailAccount;
  /** The report shown; null before the first one arrives. */
  readonly report: MailboxReport | null;
  readonly isReading: boolean;
  /** Set when a later read failed and the list shown is from before it. */
  readonly problem: MailProblem | null;
}

export type MailboxStates = Readonly<Record<MailAccount, MailboxState>>;
