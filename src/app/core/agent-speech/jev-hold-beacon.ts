import { Injectable, InjectionToken, computed, inject } from '@angular/core';
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
import { ASK_CHANNEL } from '../assistant/ask-channel';
import { SpokenReplies } from '../voice/spoken-replies';
import { TalkState } from '../voice/talk-state';
import { JEV_HOLD_API } from './agent-speech-api';

/** Names one hold, fresh for each turn, so a renewal still on its way when
 *  the turn ended cannot revive it. */
export const NEW_HOLD_TOKEN = new InjectionToken<() => string>('NewHoldToken', {
  providedIn: 'root',
  factory: () => () => crypto.randomUUID(),
});

/** Renewed this often while Jev has the turn; the server keeps each renewal 6 s,
 *  so two may go missing before Agent Speak lets go. */
export const HOLD_RENEW_MS = 2_000;

/**
 * Holds Agent Speak while Jev has the turn: while the mic is held, while a
 * question is on its way, and while any line of Jev's is under way, whichever
 * voice speaks it. The mic's turn lasts until its question is sent, and the
 * reply starts before the question clears, so a question and its answer are
 * one hold. It is released as the turn ends; a tab that closes first lets it
 * lapse.
 * Made only on this machine: see provideJevHold.
 */
@Injectable({ providedIn: 'root' })
export class JevHoldBeacon {
  private readonly api = inject(JEV_HOLD_API);
  private readonly newToken = inject(NEW_HOLD_TOKEN);
  private readonly isTalking = inject(TalkState).isTalking;
  private readonly isAsking = inject(ASK_CHANNEL).busy;
  private readonly isSpeaking = inject(SpokenReplies).isBusy;
  private readonly hasTurn = computed(
    () => this.isTalking() || this.isAsking() || this.isSpeaking(),
  );

  constructor() {
    toObservable(this.hasTurn)
      .pipe(
        distinctUntilChanged(),
        switchMap((hasTurn) => (hasTurn ? this.held() : EMPTY)),
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
