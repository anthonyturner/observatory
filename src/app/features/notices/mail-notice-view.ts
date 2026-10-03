import { senderOf, subjectOf } from '../../core/mail/mail-text';
import { MAIL_ACCOUNT_LABELS } from '../../core/mail/mail.types';
import { newEmails } from '../../core/notices/mail-words';
import { MailNotice, MailSignInNotice } from '../../core/notices/notice.types';
import type { NoticeRoute, NoticeRowView, NoticeView } from './notice-view';

/** Home's Mail section, where every mail notice leads. */
export const HOME_MAIL: NoticeRoute = { kind: 'route', path: ['/'], query: {}, fragment: 'mail' };

const SIGN_IN_REFUSED = "Couldn't sign in: check the address and app password";

/** New mail in one account: a row per message, naming its sender and subject. */
export function mailNoticeView({ id, kind, account, messages }: MailNotice): NoticeView {
  const label = MAIL_ACCOUNT_LABELS[account];
  const isGroup = messages.length > 1;
  const heading = isGroup ? `${newEmails(messages.length)} in ${label}` : null;
  const rows = messages.map((message): NoticeRowView => ({
    key: `${account}#${message.uid}`,
    label: senderOf(message),
    badge: isGroup ? null : label,
    title: subjectOf(message),
    link: HOME_MAIL,
    closing: [],
  }));
  const subject = heading ?? `new email in ${label} from ${rows[0]?.label ?? ''}`;
  return { id, kind, tag: 'New mail', heading, rows, dismissLabel: `Dismiss: ${subject}` };
}

/** An account whose address or app password was refused. */
export function signInNoticeView({ id, kind, account }: MailSignInNotice): NoticeView {
  const label = MAIL_ACCOUNT_LABELS[account];
  const row: NoticeRowView = {
    key: `${account}#sign-in`,
    label,
    badge: null,
    title: SIGN_IN_REFUSED,
    link: HOME_MAIL,
    closing: [],
  };
  return {
    id,
    kind,
    tag: 'Mail',
    heading: null,
    rows: [row],
    dismissLabel: `Dismiss: ${label} sign-in refused`,
  };
}
