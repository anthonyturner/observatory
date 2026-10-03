import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, Observable, of } from 'rxjs';
import { PageVisibility } from '../presence/page-visibility';
import { ViewerSession } from '../session/viewer-session';
import { MAIL_API, MailApi } from './mail-api';
import { MAIL_PROVIDERS, MAIL_SHOWN, MailInbox, REREAD_MS } from './mail-inbox';
import { settled, UNFETCHED_STATES } from './mailbox-state';
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
  const answer = (account: MailAccount, call: string): Observable<MailAnswer> => {
    calls.push(`${call} ${account}`);
    return of(answers(account, call));
  };
  const api: MailApi = {
    read: (account) => answer(account, 'read'),
    refresh: (account) => answer(account, 'refresh'),
  };
  return { api, calls };
}

function start(api: MailApi, options: { readonly isLocal?: boolean } = {}) {
  const isConfirmedLocal = signal(options.isLocal ?? true);
  const isHidden = signal(false);
  TestBed.configureTestingModule({
    providers: [
      { provide: MAIL_API, useValue: api },
      { provide: ViewerSession, useValue: { isConfirmedLocal } },
      { provide: PageVisibility, useValue: { isHidden } },
    ],
  });
  const inbox = TestBed.inject(MailInbox);
  const rounds: (readonly MailboxReport[])[] = [];
  inbox.rounds.subscribe((round) => rounds.push(round));
  TestBed.tick();
  /** Moves the clock on, then lets the signals settle. */
  const wait = async (ms: number): Promise<void> => {
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
  };
  return { inbox, rounds, isHidden, isConfirmedLocal, wait };
}

describe('MailInbox', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads both inboxes once the API confirms this machine, and shows Mail once one answers', () => {
    const { api, calls } = fakeApi((account) => report(listed(account)));

    const { inbox } = start(api);

    expect(calls).toEqual(['read icloud', 'read gmail']);
    expect(inbox.isShown()).toBe(true);
    expect(inbox.isReading()).toBe(false);
    expect(inbox.states().gmail.report).toEqual(listed('gmail'));
  });

  it('reads no mail before the API confirms this machine, as on the hosted site', async () => {
    const { api, calls } = fakeApi((account) => report(listed(account)));

    const { inbox, wait } = start(api, { isLocal: false });
    await wait(3 * REREAD_MS);

    expect(calls).toEqual([]);
    expect(inbox.isShown()).toBe(false);
  });

  it('reads again five minutes after each read, from any page', async () => {
    const { api, calls } = fakeApi((account) => report(listed(account)));
    const { wait } = start(api);

    await wait(REREAD_MS - 1);
    expect(calls.length).toBe(2);
    await wait(1);
    expect(calls.length).toBe(4);
  });

  it('never shows Mail where the site has none, and never asks again', async () => {
    const { api, calls } = fakeApi(() => ({ kind: 'absent' }));

    const { inbox, wait } = start(api);
    await wait(3 * REREAD_MS);

    expect(inbox.isShown()).toBe(false);
    expect(calls.length).toBe(2);
  });

  it('does not show Mail while the API is not answering at all, and keeps trying', async () => {
    const { api, calls } = fakeApi(() => ({ kind: 'unreachable' }));

    const { inbox, wait } = start(api);
    await wait(REREAD_MS);

    expect(inbox.isShown()).toBe(false);
    expect(inbox.states().icloud.problem).toBe('api');
    expect(calls.length).toBe(4);
  });

  it('reads nothing while the tab is hidden, then once when it comes back', async () => {
    const { api, calls } = fakeApi((account) => report(listed(account)));
    const { isHidden, wait } = start(api);

    isHidden.set(true);
    await wait(3 * REREAD_MS);
    expect(calls.length).toBe(2);

    isHidden.set(false);
    await wait(0);
    expect(calls.length).toBe(4);
    await wait(REREAD_MS - 1);
    expect(calls.length).toBe(4);
  });

  it('waits for the tab before its first read', async () => {
    const { api, calls } = fakeApi((account) => report(listed(account)));
    const isHidden = signal(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: MAIL_API, useValue: api },
        { provide: ViewerSession, useValue: { isConfirmedLocal: signal(true) } },
        { provide: PageVisibility, useValue: { isHidden } },
      ],
    });
    TestBed.inject(MailInbox);
    TestBed.tick();
    expect(calls).toEqual([]);

    isHidden.set(false);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.length).toBe(2);
  });

  it('gives both inboxes’ reports from each read together', async () => {
    const { api } = fakeApi((account) =>
      account === 'icloud' ? report(listed('icloud')) : { kind: 'unreachable' },
    );
    const { inbox, rounds } = start(api);

    inbox.refresh().subscribe();

    expect(rounds).toEqual([[listed('icloud')], [listed('icloud')]]);
  });

  it('leaves no inbox reading when a Refresh is abandoned, as on leaving Home', () => {
    const { api } = fakeApi((account) => report(listed(account)));
    const { inbox } = start({ ...api, refresh: () => NEVER });

    inbox.refresh().subscribe().unsubscribe();

    expect(inbox.isReading()).toBe(false);
    expect(inbox.states().icloud.report).toEqual(listed('icloud'));
  });

  it('asks both mail servers again on Refresh, and keeps the list when one refuses', () => {
    const { api, calls } = fakeApi((account, call) =>
      call === 'refresh' && account === 'icloud'
        ? report(failed('icloud'))
        : report(listed(account, 2)),
    );
    const { inbox } = start(api);

    inbox.refresh().subscribe();

    expect(calls.slice(2)).toEqual(['refresh icloud', 'refresh gmail']);
    expect(inbox.states().icloud).toEqual({
      account: 'icloud',
      report: listed('icloud', 2),
      isReading: false,
      problem: 'sign-in',
    });
  });
});

describe('MAIL_SHOWN', () => {
  @Component({ template: '', providers: [MAIL_PROVIDERS] })
  class Home {
    readonly hasMail = inject(MAIL_SHOWN);
  }

  it('follows the shared inbox on Home', () => {
    const { api } = fakeApi((account) => report(listed(account)));
    TestBed.configureTestingModule({
      providers: [
        { provide: MAIL_API, useValue: api },
        { provide: ViewerSession, useValue: { isConfirmedLocal: signal(true) } },
        { provide: PageVisibility, useValue: { isHidden: signal(false) } },
      ],
    });
    const home = TestBed.createComponent(Home);
    TestBed.tick();

    expect(home.componentInstance.hasMail()).toBe(true);
  });

  it('has no mail anywhere but Home', () => {
    TestBed.configureTestingModule({});

    expect(TestBed.inject(MAIL_SHOWN)()).toBe(false);
  });
});

describe('settled', () => {
  const withList = { ...UNFETCHED_STATES.icloud, report: listed('icloud'), isReading: true };

  it('shows a failure in place when there was no list to keep', () => {
    expect(settled(UNFETCHED_STATES.icloud, report(failed('icloud'))).report).toEqual(
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
