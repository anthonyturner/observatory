import { NewMail, MailNews } from '../mail/mail-memory';
import { senderOf, subjectOf } from '../mail/mail-text';
import { MAIL_ACCOUNTS, MAIL_ACCOUNT_LABELS, MailAccount, MailMessage } from '../mail/mail.types';
import { sentenceOf } from './notice-words';

/** A screen reader hears this many messages, then how many more. */
const MESSAGES_TOLD = 3;

/** "1 new email", "2 new emails". */
export const newEmails = (count: number): string =>
  `${count} new ${count === 1 ? 'email' : 'emails'}`;

const namedMail = (account: MailAccount, message: MailMessage): string =>
  `New email in ${MAIL_ACCOUNT_LABELS[account]} from ${senderOf(message)}: ${subjectOf(message)}`;

/** How many messages each account brought, in the order the tabs show them. */
function countsOf(newMail: readonly NewMail[]): { account: MailAccount; count: number }[] {
  return MAIL_ACCOUNTS.map((account) => ({
    account,
    count: newMail
      .filter((mail) => mail.account === account)
      .reduce((sum, mail) => sum + mail.messages.length, 0),
  })).filter(({ count }) => count > 0);
}

/** "2 new emails in Gmail, 1 in iCloud." */
function countedMail(newMail: readonly NewMail[]): string {
  const [first, ...rest] = countsOf(newMail);
  if (!first) return '';
  const lead = `${newEmails(first.count)} in ${MAIL_ACCOUNT_LABELS[first.account]}`;
  const more = rest.map(({ account, count }) => `, ${count} in ${MAIL_ACCOUNT_LABELS[account]}`);
  return `${lead}${more.join('')}.`;
}

/**
 * New mail as Jev says it. A voice that sends its words off this machine says
 * only how many came; one that stays here names the sender and subject of a
 * lone message, and counts several.
 */
export function mailSayingOf(newMail: readonly NewMail[], mayName: boolean): string {
  const messages = newMail.flatMap((mail) =>
    mail.messages.map((message) => ({ account: mail.account, message })),
  );
  const [only] = messages;
  if (mayName && messages.length === 1 && only) {
    return sentenceOf(namedMail(only.account, only.message));
  }
  return countedMail(newMail);
}

/** One read's mail news as a single sentence, for the polite live region. */
export function mailAnnouncementOf({ newMail, signInFailed }: MailNews): string {
  const named = newMail.flatMap((mail) =>
    mail.messages.map((message) => namedMail(mail.account, message)),
  );
  const told = named.slice(0, MESSAGES_TOLD);
  const more = named.length - told.length;
  const refused = signInFailed.map(
    (account) => `Couldn't sign in to ${MAIL_ACCOUNT_LABELS[account]}`,
  );
  return sentenceOf([...told, ...(more > 0 ? [`and ${more} more`] : []), ...refused].join('; '));
}
