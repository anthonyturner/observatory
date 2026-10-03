import { MailAccount, MailMessage, MailboxReport } from './mail.types';

/** New unread messages one account brought in one read, newest first. */
export interface NewMail {
  readonly account: MailAccount;
  readonly messages: readonly MailMessage[];
}

/** What one read of both inboxes is worth telling. */
export interface MailNews {
  readonly newMail: readonly NewMail[];
  /** Accounts whose sign-in was refused, each told once a tab. */
  readonly signInFailed: readonly MailAccount[];
}

/** Where new mail starts for one account: above this UID, and not received
 *  before this time. */
interface Baseline {
  readonly newestUid: number;
  readonly since: string;
}

interface AccountMemory {
  /** Null until the account's first good read. */
  readonly baseline: Baseline | null;
  readonly hasToldSignIn: boolean;
}

export type MailMemory = Readonly<Partial<Record<MailAccount, AccountMemory>>>;

export const EMPTY_MAIL_MEMORY: MailMemory = {};

const FORGOTTEN: AccountMemory = { baseline: null, hasToldSignIn: false };

/** One read's news, and the memory to compare the next read with. */
export interface MailComparison {
  readonly memory: MailMemory;
  readonly news: MailNews;
}

const NO_NEWS: MailNews = { newMail: [], signInFailed: [] };

export const hasNews = (news: MailNews): boolean =>
  news.newMail.length > 0 || news.signInFailed.length > 0;

type Listed = Extract<MailboxReport, { state: 'listed' }>;

interface AccountComparison {
  readonly memory: AccountMemory;
  readonly newMail: NewMail | null;
  readonly signInFailed: boolean;
}

const newestUidOf = (report: Listed): number | null =>
  report.messages.length ? Math.max(...report.messages.map((message) => message.uid)) : null;

/** A message with no received time is judged by its UID alone. */
const isReceivedBefore = (message: MailMessage, since: string): boolean =>
  message.receivedAt !== null && Date.parse(message.receivedAt) < Date.parse(since);

/**
 * The first good read sets the baseline and tells nothing. A newest UID below
 * the baseline means the mailbox was renumbered or its newest message went, so
 * the baseline moves down to it and nothing is told. Otherwise each message
 * above the baseline that is still unread, and was not received before the
 * first read, is new; the baseline then rises to the newest, so none is told
 * twice.
 */
function compareListed(memory: AccountMemory, report: Listed): AccountComparison {
  const newest = newestUidOf(report);
  const { baseline } = memory;
  if (baseline === null) {
    const first = { newestUid: newest ?? 0, since: report.checkedAt };
    return { memory: { ...memory, baseline: first }, newMail: null, signInFailed: false };
  }
  if (newest !== null && newest < baseline.newestUid) {
    const lowered = { ...baseline, newestUid: newest };
    return { memory: { ...memory, baseline: lowered }, newMail: null, signInFailed: false };
  }
  const messages = report.messages.filter(
    (message) =>
      message.uid > baseline.newestUid &&
      message.isUnread &&
      !isReceivedBefore(message, baseline.since),
  );
  const raised = { ...baseline, newestUid: Math.max(baseline.newestUid, newest ?? 0) };
  return {
    memory: { ...memory, baseline: raised },
    newMail: messages.length ? { account: report.account, messages } : null,
    signInFailed: false,
  };
}

function compareAccount(memory: AccountMemory, report: MailboxReport): AccountComparison {
  switch (report.state) {
    case 'listed':
      return compareListed(memory, report);
    case 'failed': {
      const isNews = report.failure === 'sign-in' && !memory.hasToldSignIn;
      const told = { ...memory, hasToldSignIn: memory.hasToldSignIn || isNews };
      return { memory: told, newMail: null, signInFailed: isNews };
    }
    case 'off':
      return { memory, newMail: null, signInFailed: false };
  }
}

/** Compares one read of both inboxes with what this tab already knows. */
export function compareMail(memory: MailMemory, reports: readonly MailboxReport[]): MailComparison {
  return reports.reduce<MailComparison>(
    (last, report) => {
      const account = compareAccount(last.memory[report.account] ?? FORGOTTEN, report);
      return {
        memory: { ...last.memory, [report.account]: account.memory },
        news: {
          newMail: account.newMail ? [...last.news.newMail, account.newMail] : last.news.newMail,
          signInFailed: account.signInFailed
            ? [...last.news.signInFailed, report.account]
            : last.news.signInFailed,
        },
      };
    },
    { memory, news: NO_NEWS },
  );
}
