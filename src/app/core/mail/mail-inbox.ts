import {
  Injectable,
  InjectionToken,
  Provider,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { exhaustMap, filter, interval, startWith } from 'rxjs';
import { MAIL_API } from './mail-api';
import { UNFETCHED_STATES, settled } from './mailbox-state';
import { MAIL_ACCOUNTS, MailAccount, MailAnswer, MailboxState, MailboxStates } from './mail.types';

/** The server keeps a list for a minute and a failed sign-in for five, so this asks no server more often than that. */
const REREAD_MS = 5 * 60_000;

/** Whether this site has mail: not known until the API answers a mail read. */
type Presence = 'unknown' | 'here' | 'absent';

/**
 * Home's two inboxes, read now, every five minutes and on Refresh, each on its
 * own. Home provides it, so the reading stops when Home is left.
 */
@Injectable()
export class MailInbox {
  private readonly api = inject(MAIL_API);
  private readonly current = signal<MailboxStates>(UNFETCHED_STATES);
  private readonly presence = signal<Presence>('unknown');

  readonly states = this.current.asReadonly();
  /** Only once the local API has answered a mail read: the hosted site never does, so it never flashes there. */
  readonly isShown = computed(() => this.presence() === 'here');
  readonly isReading = computed(() =>
    MAIL_ACCOUNTS.some((account) => this.current()[account].isReading),
  );

  constructor() {
    interval(REREAD_MS)
      .pipe(
        startWith(0),
        filter(() => this.presence() !== 'absent'),
        exhaustMap(() => this.readEach((account) => this.api.read(account))),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** Reads both inboxes again from their mail servers, not from the API's cache. */
  refresh(): Promise<void> {
    return this.readEach((account) => this.api.refresh(account));
  }

  private async readEach(read: (account: MailAccount) => Promise<MailAnswer>): Promise<void> {
    await Promise.all(
      MAIL_ACCOUNTS.map(async (account) => {
        this.update(account, (state) => ({ ...state, isReading: true }));
        const answer = await read(account);
        if (answer.kind !== 'unreachable')
          this.presence.set(answer.kind === 'absent' ? 'absent' : 'here');
        this.update(account, (state) => settled(state, answer));
      }),
    );
  }

  private update(account: MailAccount, change: (state: MailboxState) => MailboxState): void {
    this.current.update((states) => ({ ...states, [account]: change(states[account]) }));
  }
}

/** Whether Home has a Mail section, for the parts of the page that only follow it.
 *  Home provides it from its MailInbox; anywhere else there is no mail. */
export const MAIL_SHOWN = new InjectionToken<Signal<boolean>>('MAIL_SHOWN', {
  providedIn: 'root',
  factory: () => signal(false).asReadonly(),
});

/** What Home provides for mail: one MailInbox for its sections, and whether to show them. */
export const MAIL_PROVIDERS: Provider[] = [
  MailInbox,
  { provide: MAIL_SHOWN, useFactory: () => inject(MailInbox).isShown },
];
