import { Json, fieldOf, isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';
import { MAIL_ACCOUNTS, MailFailure, MailMessage, MailboxReport } from './mail.types';

const FAILURES: readonly MailFailure[] = ['sign-in', 'timeout', 'unreachable', 'unknown'];

/** A subject or a sender may be empty; it is still text. */
const isString = (value: unknown): value is string => typeof value === 'string';

function parseMessage(value: unknown): MailMessage | null {
  if (!isObject(value)) return null;
  const { uid, from, fromAddress, subject, receivedAt, isUnread } = value;
  if (!isNumber(uid) || !isString(from) || !isString(fromAddress) || !isString(subject))
    return null;
  if (typeof isUnread !== 'boolean') return null;
  return {
    uid,
    from,
    fromAddress,
    subject,
    receivedAt: isText(receivedAt) ? receivedAt : null,
    isUnread,
  };
}

const settingsOf = (body: Json): readonly string[] =>
  listOf(body['settings'], (name) => (isText(name) ? name : null));

function parseListed(body: Json, account: MailboxReport['account']): MailboxReport | null {
  const address = fieldOf(body, 'address', isText);
  const checkedAt = fieldOf(body, 'checkedAt', isText);
  const total = fieldOf(body, 'total', isNumber);
  const unread = fieldOf(body, 'unread', isNumber);
  if (!address || !checkedAt || total === undefined || unread === undefined) return null;
  const messages = listOf(body['messages'], parseMessage);
  return { account, state: 'listed', address, checkedAt, total, unread, messages };
}

function parseFailed(body: Json, account: MailboxReport['account']): MailboxReport | null {
  const failure = fieldOf(body, 'failure', oneOf(FAILURES));
  const checkedAt = fieldOf(body, 'checkedAt', isText);
  if (!failure || !checkedAt) return null;
  return { account, state: 'failed', failure, settings: settingsOf(body), checkedAt };
}

/** One account's report from `GET /api/mail`, checked field by field; null when it is not one. */
export function parseMailboxReport(body: unknown): MailboxReport | null {
  if (!isObject(body)) return null;
  const account = fieldOf(body, 'account', oneOf(MAIL_ACCOUNTS));
  if (!account) return null;
  switch (body['state']) {
    case 'off':
      return { account, state: 'off', settings: settingsOf(body) };
    case 'failed':
      return parseFailed(body, account);
    case 'listed':
      return parseListed(body, account);
    default:
      return null;
  }
}
