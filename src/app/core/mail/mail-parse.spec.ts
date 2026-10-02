import { parseMailboxReport } from './mail-parse';

const message = {
  uid: 7,
  from: 'Apple',
  fromAddress: 'no_reply@apple.example',
  subject: 'Your receipt',
  receivedAt: '2026-10-02T09:00:00.000Z',
  isUnread: true,
};
const listed = {
  account: 'icloud',
  state: 'listed',
  address: 'me@icloud.example',
  checkedAt: '2026-10-02T12:00:00.000Z',
  total: 1284,
  unread: 3,
  messages: [message],
};

describe('parseMailboxReport', () => {
  it('reads a listed inbox', () => {
    expect(parseMailboxReport(listed)).toEqual(listed);
  });

  it('keeps an empty subject or sender, and a message with no received time', () => {
    const bare = { ...message, from: '', subject: '', receivedAt: null };

    expect(parseMailboxReport({ ...listed, messages: [bare] })).toEqual({
      ...listed,
      messages: [bare],
    });
  });

  it('drops a message it cannot read rather than trusting it', () => {
    const report = parseMailboxReport({
      ...listed,
      messages: [message, { ...message, uid: 'seven' }, { ...message, isUnread: 'yes' }, null],
    });

    expect(report?.state === 'listed' && report.messages).toEqual([message]);
  });

  it('reads an account that is off, or failed, with the settings it names', () => {
    const off = {
      account: 'gmail',
      state: 'off',
      settings: ['GMAIL_ADDRESS', 'GMAIL_APP_PASSWORD'],
    };
    const failed = {
      account: 'gmail',
      state: 'failed',
      failure: 'sign-in',
      settings: ['GMAIL_ADDRESS', 'GMAIL_APP_PASSWORD'],
      checkedAt: '2026-10-02T12:00:00.000Z',
    };

    expect(parseMailboxReport(off)).toEqual(off);
    expect(parseMailboxReport(failed)).toEqual(failed);
  });

  it('is null for anything that is not a report', () => {
    expect(parseMailboxReport(null)).toBeNull();
    expect(parseMailboxReport({ ...listed, account: 'outlook' })).toBeNull();
    expect(parseMailboxReport({ ...listed, state: 'deleted' })).toBeNull();
    expect(parseMailboxReport({ ...listed, total: 'many' })).toBeNull();
    expect(parseMailboxReport({ account: 'icloud', state: 'failed', failure: 'odd' })).toBeNull();
  });
});
