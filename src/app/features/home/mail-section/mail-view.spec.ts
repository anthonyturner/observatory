import { UNFETCHED_STATES } from '../../../core/mail/mailbox-state';
import { MailMessage, MailboxReport, MailboxState } from '../../../core/mail/mail.types';
import { mailPanel, mailSummary, mailTab, shownAccount } from './mail-view';

const message = (uid: number, overrides: Partial<MailMessage> = {}): MailMessage => ({
  uid,
  from: 'Apple',
  fromAddress: 'no_reply@apple.example',
  subject: 'Your receipt',
  receivedAt: '2026-10-02T09:00:00.000Z',
  isUnread: false,
  ...overrides,
});
const listed = (overrides: Partial<Extract<MailboxReport, { state: 'listed' }>> = {}) =>
  ({
    account: 'icloud',
    state: 'listed',
    address: 'me@icloud.example',
    checkedAt: '2026-10-02T12:00:00.000Z',
    total: 1284,
    unread: 3,
    messages: [message(1, { isUnread: true }), message(2, { from: '', subject: '' })],
    ...overrides,
  }) as const;
const ICLOUD_SETTINGS = ['ICLOUD_MAIL_ADDRESS', 'ICLOUD_MAIL_APP_PASSWORD'];
const state = (report: MailboxReport | null, overrides: Partial<MailboxState> = {}) => ({
  ...UNFETCHED_STATES.icloud,
  report,
  ...overrides,
});

describe('mailPanel', () => {
  it('lists rows, naming a sender or subject that is missing, with the inbox’s size', () => {
    const panel = mailPanel(state(listed()));

    expect(panel.kind).toBe('list');
    if (panel.kind !== 'list') return;
    expect(panel.rows.map((row) => [row.from, row.subject, row.isUnread])).toEqual([
      ['Apple', 'Your receipt', true],
      ['(unknown sender)', '(no subject)', false],
    ]);
    expect(panel.rows[0].fullDate).not.toBe('');
    expect(panel.foot).toBe('Newest 2 of 1,284.');
    expect(panel.problem).toBeNull();
  });

  it('says nothing of the size when every message is listed', () => {
    const panel = mailPanel(state(listed({ total: 2 })));

    expect(panel.kind === 'list' && panel.foot).toBeNull();
  });

  it('keeps the list with the reason when a refresh failed', () => {
    const panel = mailPanel(state(listed(), { problem: 'sign-in' }));

    expect(panel.kind === 'list' && panel.problem).toBe(
      "Couldn't refresh: the sign-in was refused.",
    );
  });

  it('says an inbox is empty, reading, or out of reach', () => {
    expect(mailPanel(state(listed({ messages: [], total: 0 })))).toEqual({
      kind: 'empty',
      text: 'Your iCloud inbox is empty.',
      address: 'me@icloud.example',
    });
    expect(mailPanel(state(null, { isReading: true }))).toEqual({
      kind: 'loading',
      text: 'Reading your iCloud inbox…',
    });
    expect(mailPanel(state(null, { problem: 'api' })).kind).toBe('unreachable');
  });

  it('names the settings to add for an account that is off, and what kind of password', () => {
    expect(
      mailPanel(state({ account: 'icloud', state: 'off', settings: ICLOUD_SETTINGS })),
    ).toEqual({
      kind: 'off',
      label: 'iCloud',
      settings: ICLOUD_SETTINGS,
      password: 'an app-specific password from your Apple Account, not your Apple ID password',
    });
  });

  it('says a refused sign-in plainly, with the settings to check, and other failures without', () => {
    const failed = (failure: 'sign-in' | 'timeout'): MailboxReport => ({
      account: 'icloud',
      state: 'failed',
      failure,
      settings: ICLOUD_SETTINGS,
      checkedAt: '2026-10-02T12:00:00.000Z',
    });

    expect(mailPanel(state(failed('sign-in')))).toEqual({
      kind: 'failed',
      lead: "Couldn't sign in to iCloud: the address or app password was refused.",
      settings: ICLOUD_SETTINGS,
      retry: "It isn't tried again until you press Refresh or restart the site.",
    });
    expect(mailPanel(state(failed('timeout')))).toEqual(
      expect.objectContaining({
        kind: 'failed',
        settings: null,
        retry: 'It is tried again in 5 minutes, or when you press Refresh.',
      }),
    );
  });
});

describe('mailTab and mailSummary', () => {
  const gmailOff: MailboxReport = { account: 'gmail', state: 'off', settings: [] };

  it('gives each tab a short note and a spoken one', () => {
    expect(mailTab(state(listed()))).toEqual({
      id: 'icloud',
      label: 'iCloud',
      note: '3',
      spokenNote: ', 3 unread',
      isBad: false,
    });
    expect(mailTab({ ...UNFETCHED_STATES.gmail, report: gmailOff }).note).toBe('off');
  });

  it('sums both inboxes up for the head band', () => {
    expect(
      mailSummary({
        icloud: state(listed()),
        gmail: { ...UNFETCHED_STATES.gmail, report: gmailOff },
      }),
    ).toBe('iCloud 3 unread · Gmail not set up');
    expect(mailSummary(UNFETCHED_STATES)).toBe('');
  });
});

describe('shownAccount', () => {
  const states = {
    icloud: state({ account: 'icloud', state: 'off', settings: [] }),
    gmail: { ...UNFETCHED_STATES.gmail, report: listed({ account: 'gmail' }) },
  };

  it('shows the tab last picked, else the first account set up, else iCloud', () => {
    expect(shownAccount(states, 'icloud')).toBe('icloud');
    expect(shownAccount(states, null)).toBe('gmail');
    expect(shownAccount(UNFETCHED_STATES, null)).toBe('icloud');
  });
});
