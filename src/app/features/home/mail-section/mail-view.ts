import {
  MAIL_ACCOUNTS,
  MailAccount,
  MailFailure,
  MailMessage,
  MailProblem,
  MailboxReport,
  MailboxState,
  MailboxStates,
} from '../../../core/mail/mail.types';
import { TabStripTab } from '../../../shared/tab-strip/tab-strip';

export const ACCOUNT_LABEL: Readonly<Record<MailAccount, string>> = {
  icloud: 'iCloud',
  gmail: 'Gmail',
};

/** Where the settings go: outside the checkout, so no commit can carry them. */
export const MAIL_ENV_FILE = '~/.claude/observatory/.env';

const PASSWORD_KIND: Readonly<Record<MailAccount, string>> = {
  icloud: 'an app-specific password from your Apple Account, not your Apple ID password',
  gmail: 'a Google app password, not your account password',
};

const REFRESH_REASON: Readonly<Record<MailProblem, string>> = {
  'sign-in': 'the sign-in was refused',
  timeout: 'the mail server took too long',
  unreachable: 'the mail server could not be reached',
  unknown: 'the inbox could not be read',
  api: 'the API is not answering',
};

const RETRY_REFUSED = "It isn't tried again until you press Refresh or restart the site.";
const RETRY_LATER = 'It is tried again in 5 minutes, or when you press Refresh.';

const failedLead = (failure: MailFailure, label: string): string => {
  switch (failure) {
    case 'sign-in':
      return `Couldn't sign in to ${label}: the address or app password was refused.`;
    case 'timeout':
      return `${label}'s mail server took too long to answer.`;
    case 'unreachable':
      return `Couldn't reach ${label}'s mail server. Check this machine's internet connection.`;
    case 'unknown':
      return `Couldn't read your ${label} inbox. The API's console says why.`;
  }
};

/** One row of the list, ready to show; its age is kept apart, as it changes every minute. */
export interface MailRow {
  readonly uid: number;
  readonly from: string;
  readonly subject: string;
  readonly isUnread: boolean;
  readonly receivedAt: string | null;
  /** The received time in full, for the age's tooltip. */
  readonly fullDate: string;
}

/** What the panel shows for the selected inbox. */
export type MailPanel =
  | { readonly kind: 'loading' | 'unreachable'; readonly text: string }
  | {
      readonly kind: 'off';
      readonly label: string;
      readonly settings: readonly string[];
      readonly password: string;
    }
  | {
      readonly kind: 'failed';
      readonly lead: string;
      /** The settings to check, where the sign-in itself was refused. */
      readonly settings: readonly string[] | null;
      /** When it is asked again: a refused password only when the owner says so. */
      readonly retry: string;
    }
  | { readonly kind: 'empty'; readonly text: string; readonly address: string }
  | {
      readonly kind: 'list';
      readonly address: string;
      readonly rows: readonly MailRow[];
      readonly foot: string | null;
      /** Why a later read did not replace this list. */
      readonly problem: string | null;
    };

const FULL_DATE: Intl.DateTimeFormatOptions = { dateStyle: 'full', timeStyle: 'short' };

const rowOf = (message: MailMessage): MailRow => ({
  uid: message.uid,
  from: message.from || '(unknown sender)',
  subject: message.subject || '(no subject)',
  isUnread: message.isUnread,
  receivedAt: message.receivedAt,
  fullDate: message.receivedAt
    ? new Date(message.receivedAt).toLocaleString(undefined, FULL_DATE)
    : '',
});

function listPanel(
  report: Extract<MailboxReport, { state: 'listed' }>,
  problem: MailProblem | null,
): MailPanel {
  const label = ACCOUNT_LABEL[report.account];
  if (!report.messages.length)
    return { kind: 'empty', text: `Your ${label} inbox is empty.`, address: report.address };
  const rows = report.messages.map(rowOf);
  return {
    kind: 'list',
    address: report.address,
    rows,
    foot:
      report.total > rows.length
        ? `Newest ${rows.length} of ${report.total.toLocaleString('en')}.`
        : null,
    problem: problem ? `Couldn't refresh: ${REFRESH_REASON[problem]}.` : null,
  };
}

/** The panel for one inbox, from where it stands. */
export function mailPanel(state: MailboxState): MailPanel {
  const { report } = state;
  const label = ACCOUNT_LABEL[state.account];
  if (!report && state.problem === 'api')
    return { kind: 'unreachable', text: 'Mail out of reach: is the API running (npm start)?' };
  if (!report) return { kind: 'loading', text: `Reading your ${label} inbox…` };
  switch (report.state) {
    case 'off':
      return {
        kind: 'off',
        label,
        settings: report.settings,
        password: PASSWORD_KIND[report.account],
      };
    case 'failed':
      return {
        kind: 'failed',
        lead: failedLead(report.failure, label),
        settings: report.failure === 'sign-in' ? report.settings : null,
        retry: report.failure === 'sign-in' ? RETRY_REFUSED : RETRY_LATER,
      };
    case 'listed':
      return listPanel(report, state.problem);
  }
}

/** A tab's short state, shown and spoken. */
function tabNote(report: MailboxReport | null): Pick<TabStripTab, 'note' | 'spokenNote' | 'isBad'> {
  if (!report) return { note: '', spokenNote: '', isBad: false };
  switch (report.state) {
    case 'off':
      return { note: 'off', spokenNote: ', not set up', isBad: false };
    case 'failed':
      return { note: 'failed', spokenNote: ', could not be read', isBad: true };
    case 'listed':
      return report.unread
        ? { note: String(report.unread), spokenNote: `, ${report.unread} unread`, isBad: false }
        : { note: '', spokenNote: ', no unread mail', isBad: false };
  }
}

export const mailTab = (state: MailboxState): TabStripTab => ({
  id: state.account,
  label: ACCOUNT_LABEL[state.account],
  ...tabNote(state.report),
});

function accountSummary(report: MailboxReport): string {
  const label = ACCOUNT_LABEL[report.account];
  switch (report.state) {
    case 'off':
      return `${label} not set up`;
    case 'failed':
      return report.failure === 'sign-in' ? `${label} sign-in failed` : `${label} failed`;
    case 'listed':
      return `${label} ${report.unread ? `${report.unread} unread` : 'none'}`;
  }
}

/** "iCloud 3 unread · Gmail none", for the head band; empty before any report. */
export const mailSummary = (states: MailboxStates): string =>
  MAIL_ACCOUNTS.map((account) => states[account].report)
    .filter((report): report is MailboxReport => report !== null)
    .map(accountSummary)
    .join(' · ');

/** The tab to show: the one last picked, else the first account set up, else the first. */
export function shownAccount(states: MailboxStates, chosen: MailAccount | null): MailAccount {
  if (chosen) return chosen;
  const setUp = MAIL_ACCOUNTS.find((account) => {
    const report = states[account].report;
    return report !== null && report.state !== 'off';
  });
  return setUp ?? MAIL_ACCOUNTS[0];
}
