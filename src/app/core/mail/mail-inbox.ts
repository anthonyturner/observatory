import {
  Injectable,
  InjectionToken,
  Provider,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  defer,
  filter,
  finalize,
  forkJoin,
  map,
  repeat,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';
import { PageVisibility } from '../presence/page-visibility';
import { ViewerSession } from '../session/viewer-session';
import { MAIL_API } from './mail-api';
import { UNFETCHED_STATES, settled } from './mailbox-state';
import {
  MAIL_ACCOUNTS,
  MailAccount,
  MailAnswer,
  MailboxReport,
  MailboxState,
  MailboxStates,
} from './mail.types';

/** The server keeps a list for a minute and a failed sign-in for five, so this asks no server more often than that. */
export const REREAD_MS = 5 * 60_000;

/** Whether this site has mail: not known until the API answers a mail read. */
type Presence = 'unknown' | 'here' | 'absent';

type Read = (account: MailAccount) => Observable<MailAnswer>;

/**
 * Both inboxes, for every page: read once the API confirms this is the
 * owner's machine, then five minutes after each read, and on Refresh. A read
 * due while the tab is hidden waits for it to come back, and a site with no
 * mail is never asked again.
 */
@Injectable({ providedIn: 'root' })
export class MailInbox {
  private readonly api = inject(MAIL_API);
  private readonly current = signal<MailboxStates>(UNFETCHED_STATES);
  private readonly presence = signal<Presence>('unknown');
  private readonly finished = new Subject<readonly MailboxReport[]>();

  readonly states = this.current.asReadonly();
  /** Only once the local API has answered a mail read: the hosted site never does, so it never flashes there. */
  readonly isShown = computed(() => this.presence() === 'here');
  readonly isReading = computed(() =>
    MAIL_ACCOUNTS.some((account) => this.current()[account].isReading),
  );
  /** The reports each read of both inboxes brought, together, so news from both is told at once. */
  readonly rounds: Observable<readonly MailboxReport[]> = this.finished.asObservable();

  constructor() {
    const isVisible = toObservable(inject(PageVisibility).isHidden).pipe(
      filter((isHidden) => !isHidden),
      take(1),
    );
    toObservable(inject(ViewerSession).isConfirmedLocal)
      .pipe(
        filter(Boolean),
        take(1),
        switchMap(() => this.everyFiveMinutes(isVisible)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** Reads both inboxes again from their mail servers, not from the API's cache. */
  refresh(): Observable<void> {
    return this.readEach((account) => this.api.refresh(account));
  }

  private everyFiveMinutes(isVisible: Observable<boolean>): Observable<void> {
    return isVisible.pipe(
      switchMap(() => this.readEach((account) => this.api.read(account))),
      repeat({ delay: () => (this.presence() === 'absent' ? EMPTY : timer(REREAD_MS)) }),
    );
  }

  private readEach(read: Read): Observable<void> {
    return forkJoin(MAIL_ACCOUNTS.map((account) => this.readOne(account, read))).pipe(
      tap((answers) => this.finished.next(reportsIn(answers))),
      map(() => undefined),
    );
  }

  private readOne(account: MailAccount, read: Read): Observable<MailAnswer> {
    return defer(() => {
      this.update(account, (state) => ({ ...state, isReading: true }));
      return read(account);
    }).pipe(
      tap((answer) => {
        if (answer.kind !== 'unreachable')
          this.presence.set(answer.kind === 'absent' ? 'absent' : 'here');
        this.update(account, (state) => settled(state, answer));
      }),
      // A read given up before its answer, such as a Refresh on leaving Home,
      // must not leave the shared inbox reading for every page after.
      finalize(() => this.update(account, (state) => ({ ...state, isReading: false }))),
    );
  }

  private update(account: MailAccount, change: (state: MailboxState) => MailboxState): void {
    this.current.update((states) => ({ ...states, [account]: change(states[account]) }));
  }
}

const reportsIn = (answers: readonly MailAnswer[]): readonly MailboxReport[] =>
  answers.flatMap((answer) => (answer.kind === 'report' ? [answer.report] : []));

/** Whether Home has a Mail section, for the parts of the page that only follow it.
 *  Home provides it from MailInbox; anywhere else there is no mail. */
export const MAIL_SHOWN = new InjectionToken<Signal<boolean>>('MAIL_SHOWN', {
  providedIn: 'root',
  factory: () => signal(false).asReadonly(),
});

/** What Home provides for mail: whether to show its sections. */
export const MAIL_PROVIDERS: Provider[] = [
  { provide: MAIL_SHOWN, useFactory: () => inject(MailInbox).isShown },
];
