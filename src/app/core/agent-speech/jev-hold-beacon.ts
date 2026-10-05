import { Injectable, InjectionToken, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  defer,
  distinctUntilChanged,
  exhaustMap,
  finalize,
  interval,
  startWith,
  switchMap,
} from 'rxjs';
import { SpokenReplies } from '../voice/spoken-replies';
import { JEV_HOLD_API } from './agent-speech-api';

/** Names one hold, fresh for each line, so a renewal still on its way when
 *  the line ended cannot revive it. */
export const NEW_HOLD_TOKEN = new InjectionToken<() => string>('NewHoldToken', {
  providedIn: 'root',
  factory: () => () => crypto.randomUUID(),
});

/** Renewed this often while Jev speaks; the server keeps each renewal 6 s,
 *  so two may go missing before Agent Speak lets go. */
export const HOLD_RENEW_MS = 2_000;

/**
 * Holds Agent Speak while any line of Jev's is under way, from the moment it
 * is taken until it ends, is cut off or fails, whichever voice speaks it. The
 * hold is released as the line ends; a tab that closes first lets it lapse.
 * Made only on this machine: see provideJevHold.
 */
@Injectable({ providedIn: 'root' })
export class JevHoldBeacon {
  private readonly api = inject(JEV_HOLD_API);
  private readonly newToken = inject(NEW_HOLD_TOKEN);

  constructor() {
    toObservable(inject(SpokenReplies).isBusy)
      .pipe(
        distinctUntilChanged(),
        switchMap((isBusy) => (isBusy ? this.held() : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** Renews one hold until unsubscribed, then releases it. The release is
   *  sent on its own, untied to this service, since it must go out even as
   *  the service is destroyed; it is one request, which ends by itself. */
  private held(): Observable<void> {
    return defer(() => {
      const token = this.newToken();
      return interval(HOLD_RENEW_MS).pipe(
        startWith(0),
        exhaustMap(() => this.api.renew(token)),
        finalize(() => this.api.release(token).subscribe()),
      );
    });
  }
}
