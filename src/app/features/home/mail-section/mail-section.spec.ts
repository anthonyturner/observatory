import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MailInbox } from '../../../core/mail/mail-inbox';
import { UNFETCHED_STATES } from '../../../core/mail/mailbox-state';
import { MailboxReport, MailboxStates } from '../../../core/mail/mail.types';
import { Clock } from '../../../core/time/clock';
import { MailSection } from './mail-section';

const NOW = new Date('2026-10-02T12:02:00Z');
const ICLOUD: MailboxReport = {
  account: 'icloud',
  state: 'listed',
  address: 'me@icloud.example',
  checkedAt: '2026-10-02T12:00:00.000Z',
  total: 1284,
  unread: 1,
  messages: [
    {
      uid: 7,
      from: 'Apple',
      fromAddress: 'no_reply@apple.example',
      subject: 'Your receipt from Apple.',
      receivedAt: '2026-10-02T09:02:00.000Z',
      isUnread: true,
    },
    {
      uid: 6,
      from: 'Simon Willison',
      fromAddress: 'simon@example.com',
      subject: 'Weeknotes',
      receivedAt: '2026-09-30T12:02:00.000Z',
      isUnread: false,
    },
  ],
};
const GMAIL_OFF: MailboxReport = {
  account: 'gmail',
  state: 'off',
  settings: ['GMAIL_ADDRESS', 'GMAIL_APP_PASSWORD'],
};
const BOTH: MailboxStates = {
  icloud: { ...UNFETCHED_STATES.icloud, report: ICLOUD },
  gmail: { ...UNFETCHED_STATES.gmail, report: GMAIL_OFF },
};

function render(initial: MailboxStates = BOTH) {
  const states = signal(initial);
  const inbox = {
    states,
    isReading: computed(() => Object.values(states()).some((state) => state.isReading)),
    refresh: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: MailInbox, useValue: inbox },
      { provide: Clock, useValue: { now: signal(NOW) } },
    ],
  });
  const fixture = TestBed.createComponent(MailSection);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return { fixture, element, inbox, states, text };
}

describe('MailSection', () => {
  beforeEach(() => localStorage.clear());

  it('lists the first set-up inbox: sender, subject, age and a visible New on unread mail', () => {
    const { element, text } = render();

    const rows = Array.from(element.querySelectorAll('.row'));
    expect(rows.length).toBe(2);
    expect(rows[0].classList).toContain('unread');
    expect(rows[0].querySelector('.marker')?.textContent?.trim()).toBe('New');
    expect(rows[0].querySelector('.from')?.textContent).toBe('Apple');
    expect(rows[0].querySelector('.subject')?.textContent).toBe('Your receipt from Apple.');
    expect(rows[0].querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-10-02T09:02:00.000Z',
    );
    expect(text('.row time')).toBe('3h ago');
    expect(rows[1].querySelector('.marker')?.textContent?.trim()).toBe('');
    expect(text('.meta')).toBe('me@icloud.example · checked 2m ago');
    expect(text('.foot')).toBe('Newest 2 of 1,284.');
    expect(text('.note')).toBe('iCloud 1 unread · Gmail not set up');
  });

  it('labels the panel with the selected tab', () => {
    const { element } = render();

    const panel = element.querySelector('[role="tabpanel"]');
    expect(panel?.getAttribute('aria-labelledby')).toBe('mail-tab-icloud');
    expect(element.querySelector('#mail-tab-icloud')?.getAttribute('aria-selected')).toBe('true');
  });

  it('names the settings for an account that is off, and remembers the tab picked', () => {
    const { fixture, element, text } = render();

    element.querySelector<HTMLButtonElement>('#mail-tab-gmail')?.click();
    fixture.detectChanges();

    expect(text('[role="tabpanel"]')).toContain(
      "Gmail isn't set up yet. Add GMAIL_ADDRESS and GMAIL_APP_PASSWORD to ~/.claude/observatory/.env, then restart the site.",
    );
    expect(Array.from(element.querySelectorAll('code')).map((code) => code.textContent)).toEqual([
      'GMAIL_ADDRESS',
      'GMAIL_APP_PASSWORD',
      '~/.claude/observatory/.env',
    ]);
    expect(element.querySelector('.meta')).toBeNull();
    expect(localStorage.getItem('observatory.mail-tab')).toBe('gmail');
  });

  it('says a sign-in failed without the password, and when it is tried again', () => {
    const { text } = render({
      ...BOTH,
      icloud: {
        ...UNFETCHED_STATES.icloud,
        report: {
          account: 'icloud',
          state: 'failed',
          failure: 'sign-in',
          settings: ['ICLOUD_MAIL_ADDRESS', 'ICLOUD_MAIL_APP_PASSWORD'],
          checkedAt: '2026-10-02T12:00:00.000Z',
        },
      },
    });

    expect(text('.state.bad')).toBe(
      "Couldn't sign in to iCloud: the address or app password was refused.",
    );
    expect(text('[role="tabpanel"]')).toContain(
      "It isn't tried again until you press Refresh or restart the site.",
    );
    expect(text('#mail-tab-icloud')).toContain('failed');
  });

  it('keeps the list when a refresh fails, saying so', () => {
    const { text } = render({ ...BOTH, icloud: { ...BOTH.icloud, problem: 'api' } });

    expect(text('.problem')).toBe(
      "Couldn't refresh: the API is not answering. Showing what was read 2m ago.",
    );
    expect(text('.row .from')).toBe('Apple');
  });

  it('reads both inboxes again on Refresh, says Reading… meanwhile, and announces the counts', async () => {
    const { fixture, element, inbox, states } = render();
    const button = () => element.querySelector<HTMLButtonElement>('.refresh');

    button()?.click();
    await fixture.whenStable();

    expect(inbox.refresh).toHaveBeenCalledTimes(1);
    expect(element.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Mail read again: iCloud 1 unread · Gmail not set up.',
    );
    states.set({ ...BOTH, icloud: { ...BOTH.icloud, isReading: true } });
    fixture.detectChanges();
    expect(button()?.textContent?.trim()).toBe('Reading…');
    expect(button()?.getAttribute('aria-disabled')).toBe('true');
    expect(element.querySelector('section')?.getAttribute('aria-busy')).toBe('false');
  });

  it('keeps focus on Refresh while it reads, and ignores presses until it is done', () => {
    const { fixture, element, inbox, states } = render();
    document.body.append(element);
    const button = element.querySelector<HTMLButtonElement>('.refresh');
    button?.focus();

    states.set({ ...BOTH, icloud: { ...BOTH.icloud, isReading: true } });
    fixture.detectChanges();
    button?.click();

    expect(button?.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(inbox.refresh).not.toHaveBeenCalled();
    element.remove();
  });

  it('is busy, saying it is reading, only before the first answer', () => {
    const { element } = render({
      icloud: { ...UNFETCHED_STATES.icloud, isReading: true },
      gmail: { ...UNFETCHED_STATES.gmail, isReading: true },
    });

    expect(element.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('[role="status"]')?.textContent).toBe(
      'Reading your iCloud inbox…',
    );
  });

  it('offers no Refresh with neither account set up', () => {
    const { element } = render({
      icloud: {
        ...UNFETCHED_STATES.icloud,
        report: { account: 'icloud', state: 'off', settings: [] },
      },
      gmail: { ...UNFETCHED_STATES.gmail, report: GMAIL_OFF },
    });

    expect(element.querySelector('.refresh')).toBeNull();
  });
});
