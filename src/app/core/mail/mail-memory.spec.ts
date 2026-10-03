import { EMPTY_MAIL_MEMORY, MailMemory, compareMail, hasNews } from './mail-memory';
import { MailAccount, MailMessage, MailboxReport } from './mail.types';

const message = (uid: number, changes: Partial<MailMessage> = {}): MailMessage => ({
  uid,
  from: `Sender ${uid}`,
  fromAddress: `s${uid}@example.com`,
  subject: `Subject ${uid}`,
  receivedAt: '2026-10-03T12:10:00.000Z',
  isUnread: true,
  ...changes,
});

const listed = (
  account: MailAccount,
  messages: MailMessage[],
  checkedAt = '2026-10-03T12:05:00.000Z',
): MailboxReport => ({
  account,
  state: 'listed',
  address: `me@${account}.example`,
  checkedAt,
  total: messages.length,
  unread: messages.filter((each) => each.isUnread).length,
  messages,
});

const signInRefused = (account: MailAccount): MailboxReport => ({
  account,
  state: 'failed',
  failure: 'sign-in',
  settings: [],
  checkedAt: '2026-10-03T12:05:00.000Z',
});

/** Compares each read in turn, and gives every read's news. */
function readInTurn(...reads: MailboxReport[][]) {
  let memory: MailMemory = EMPTY_MAIL_MEMORY;
  return reads.map((reports) => {
    const comparison = compareMail(memory, reports);
    memory = comparison.memory;
    return comparison.news;
  });
}

const uidsOf = (news: ReturnType<typeof readInTurn>[number]): number[][] =>
  news.newMail.map((mail) => mail.messages.map((each) => each.uid));

const OLD = message(5, { receivedAt: '2026-10-03T11:00:00.000Z' });

describe('compareMail', () => {
  it('tells nothing on an account’s first good read, however much is unread', () => {
    const [first] = readInTurn([listed('icloud', [message(9), message(8)])]);

    expect(hasNews(first)).toBe(false);
  });

  it('tells each new unread message once, by account', () => {
    const [, second, third] = readInTurn(
      [listed('icloud', [OLD]), listed('gmail', [])],
      [listed('icloud', [message(7), message(6), OLD]), listed('gmail', [message(3)])],
      [listed('icloud', [message(7), message(6), OLD]), listed('gmail', [message(3)])],
    );

    expect(second.newMail.map((mail) => mail.account)).toEqual(['icloud', 'gmail']);
    expect(uidsOf(second)).toEqual([[7, 6], [3]]);
    expect(hasNews(third)).toBe(false);
  });

  it('never tells a message that was already read when found, even later', () => {
    const [, second, third] = readInTurn(
      [listed('gmail', [OLD])],
      [listed('gmail', [message(6, { isUnread: false }), OLD])],
      [listed('gmail', [message(6), OLD])],
    );

    expect(hasNews(second)).toBe(false);
    expect(hasNews(third)).toBe(false);
  });

  it('never tells a message received before the first read, whatever its UID', () => {
    const before = message(40, { receivedAt: '2026-10-03T12:04:59.000Z' });
    const undated = message(41, { receivedAt: null });

    const [, second] = readInTurn([listed('gmail', [OLD])], [listed('gmail', [undated, before])]);

    expect(uidsOf(second)).toEqual([[41]]);
  });

  it('starts again quietly when the newest UID drops, and tells what comes after', () => {
    const [, renumbered, after] = readInTurn(
      [listed('icloud', [message(900), OLD])],
      [listed('icloud', [message(12), message(11)])],
      [listed('icloud', [message(13), message(12), message(11)])],
    );

    expect(hasNews(renumbered)).toBe(false);
    expect(uidsOf(after)).toEqual([[13]]);
  });

  it('counts mail into an inbox that was empty at the first read', () => {
    const [, second] = readInTurn([listed('gmail', [])], [listed('gmail', [message(1)])]);

    expect(uidsOf(second)).toEqual([[1]]);
  });

  it('tells a refused sign-in once a tab, and nothing for an account that is off', () => {
    const off: MailboxReport = { account: 'icloud', state: 'off', settings: [] };

    const [first, again, later] = readInTurn(
      [signInRefused('gmail'), off],
      [signInRefused('gmail'), off],
      [listed('gmail', [OLD]), signInRefused('gmail')],
    );

    expect(first).toEqual({ newMail: [], signInFailed: ['gmail'] });
    expect(hasNews(again)).toBe(false);
    expect(hasNews(later)).toBe(false);
  });

  it('keeps an account’s baseline through a failed read', () => {
    const timedOut: MailboxReport = {
      account: 'icloud',
      state: 'failed',
      failure: 'timeout',
      settings: [],
      checkedAt: '2026-10-03T12:10:00.000Z',
    };

    const [, failed, back] = readInTurn(
      [listed('icloud', [OLD])],
      [timedOut],
      [listed('icloud', [message(6), OLD])],
    );

    expect(hasNews(failed)).toBe(false);
    expect(uidsOf(back)).toEqual([[6]]);
  });
});
