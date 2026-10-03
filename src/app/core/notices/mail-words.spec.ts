import { NewMail } from '../mail/mail-memory';
import { MailAccount, MailMessage } from '../mail/mail.types';
import { mailAnnouncementOf, mailSayingOf } from './mail-words';

const message = (uid: number, changes: Partial<MailMessage> = {}): MailMessage => ({
  uid,
  from: 'Apple',
  fromAddress: 'no_reply@apple.example',
  subject: 'Your receipt',
  receivedAt: '2026-10-03T12:10:00.000Z',
  isUnread: true,
  ...changes,
});

const mail = (account: MailAccount, ...messages: MailMessage[]): NewMail => ({
  account,
  messages,
});

describe('mailSayingOf', () => {
  it('says only the count on a voice that sends its words away, even for one message', () => {
    expect(mailSayingOf([mail('gmail', message(1))], false)).toBe('1 new email in Gmail.');
  });

  it('counts each account, with no sender or subject, on a voice that sends its words away', () => {
    const line = mailSayingOf(
      [mail('gmail', message(1), message(2)), mail('icloud', message(3))],
      false,
    );

    expect(line).toBe('1 new email in iCloud, 2 in Gmail.');
    expect(line).not.toContain('Apple');
    expect(line).not.toContain('receipt');
  });

  it('names the sender and subject of a lone message on the voice in this browser', () => {
    expect(mailSayingOf([mail('icloud', message(1))], true)).toBe(
      'New email in iCloud from Apple: Your receipt.',
    );
  });

  it('counts several messages on the voice in this browser too', () => {
    expect(mailSayingOf([mail('gmail', message(1)), mail('gmail', message(2))], true)).toBe(
      '2 new emails in Gmail.',
    );
  });

  it('never leaves a gap for a blank sender or subject', () => {
    expect(mailSayingOf([mail('gmail', message(1, { from: '', subject: '' }))], true)).toBe(
      'New email in Gmail from (unknown sender): (no subject).',
    );
  });
});

describe('mailAnnouncementOf', () => {
  it('names each message for a screen reader, then how many more, then any refused sign-in', () => {
    const newMail = [mail('icloud', message(1), message(2)), mail('gmail', message(3), message(4))];

    expect(mailAnnouncementOf({ newMail, signInFailed: ['gmail'] })).toBe(
      'New email in iCloud from Apple: Your receipt; New email in iCloud from Apple: Your receipt; ' +
        "New email in Gmail from Apple: Your receipt; and 1 more; Couldn't sign in to Gmail.",
    );
  });

  it('ends a subject that is already a sentence with no second full stop', () => {
    const newMail = [mail('icloud', message(1, { subject: 'Done!' }))];

    expect(mailAnnouncementOf({ newMail, signInFailed: [] })).toBe(
      'New email in iCloud from Apple: Done!',
    );
  });
});
