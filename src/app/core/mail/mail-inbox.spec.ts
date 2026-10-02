import { TestBed } from '@angular/core/testing';
import { MAIL_API, MailApi } from './mail-api';
import { MailInbox } from './mail-inbox';
import { settled, UNREAD_STATES } from './mailbox-state';
import { MailAccount, MailAnswer, MailboxReport } from './mail.types';

const listed = (account: MailAccount, unread = 1): MailboxReport => ({
  account,
  state: 'listed',
  address: `me@${account}.example`,
  checkedAt: '2026-10-02T12:00:00.000Z',
  total: 1,
  unread,
  messages: [],
});
const failed = (account: MailAccount): MailboxReport => ({
  account,
  state: 'failed',
  failure: 'sign-in',
  settings: [],
  checkedAt: '2026-10-02T12:05:00.000Z',
});
const report = (value: MailboxReport): MailAnswer => ({ kind: 'report', report: value });

/** An API that answers each account from `answers`, recording each call. */
function fakeApi(answers: (account: MailAccount, call: string) => MailAnswer) {
  const calls: string[] = [];
  const api: MailApi = {
    read: async (account) => {
      calls.push(`read ${account}`);
      return answers(account, 'read');
    },
    refresh: async (account) => {
      calls.push(`refresh ${account}`);
      return answers(account, 'refresh');
    },
  };
  return { api, calls };
}

async function start(api: MailApi): Promise<MailInbox> {
  TestBed.configureTestingModule({ providers: [{ provide: MAIL_API, useValue: api }] });
  const inbox = TestBed.inject(MailInbox);
  await vi.waitFor(() => expect(inbox.isReading()).toBe(false));
  return inbox;
}

describe('MailInbox', () => {
  it('reads both inboxes on its own, and shows Mail once one answers', async () => {
    const { api, calls } = fakeApi((account) => report(listed(account)));

    const inbox = await start(api);

    expect(calls).toEqual(['read icloud', 'read gmail']);
    expect(inbox.isShown()).toBe(true);
    expect(inbox.states().gmail.report).toEqual(listed('gmail'));
  });

  it('never shows Mail where the site has none, as on the hosted site', async () => {
    const inbox = await start(fakeApi(() => ({ kind: 'absent' })).api);

    expect(inbox.isShown()).toBe(false);
  });

  it('does not show Mail while the API is not answering at all', async () => {
    const inbox = await start(fakeApi(() => ({ kind: 'unreachable' })).api);

    expect(inbox.isShown()).toBe(false);
    expect(inbox.states().icloud.problem).toBe('api');
  });

  it('asks both mail servers again on Refresh, and keeps the list when one refuses', async () => {
    const { api, calls } = fakeApi((account, call) =>
      call === 'refresh' && account === 'icloud'
        ? report(failed('icloud'))
        : report(listed(account, 2)),
    );
    const inbox = await start(api);

    await inbox.refresh();

    expect(calls.slice(2)).toEqual(['refresh icloud', 'refresh gmail']);
    expect(inbox.states().icloud).toEqual({
      account: 'icloud',
      report: listed('icloud', 2),
      isReading: false,
      problem: 'sign-in',
    });
  });
});

describe('settled', () => {
  const withList = { ...UNREAD_STATES.icloud, report: listed('icloud'), isReading: true };

  it('shows a failure in place when there was no list to keep', () => {
    expect(settled(UNREAD_STATES.icloud, report(failed('icloud'))).report).toEqual(
      failed('icloud'),
    );
  });

  it('keeps a list when the API stops answering, saying so', () => {
    expect(settled(withList, { kind: 'unreachable' })).toEqual({
      ...withList,
      isReading: false,
      problem: 'api',
    });
  });

  it('clears the reason once a read works again', () => {
    const fresh = listed('icloud', 5);

    expect(settled({ ...withList, problem: 'api' }, report(fresh))).toEqual({
      ...withList,
      report: fresh,
      isReading: false,
      problem: null,
    });
  });
});
