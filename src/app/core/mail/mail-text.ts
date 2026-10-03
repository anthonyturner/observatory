import { MailMessage } from './mail.types';

const UNKNOWN_SENDER = '(unknown sender)';
const NO_SUBJECT = '(no subject)';

/** The sender as the page shows it and Jev says it, never blank. */
export const senderOf = (message: MailMessage): string => message.from || UNKNOWN_SENDER;

/** The subject as the page shows it and Jev says it, never blank. */
export const subjectOf = (message: MailMessage): string => message.subject || NO_SUBJECT;
