import { Injectable, inject } from '@angular/core';
import {
  Observable,
  distinctUntilChanged,
  exhaustMap,
  interval,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { AGENT_SPEECH_API } from './agent-speech-api';

/** How often Agent Speak is asked about while Jev waits on it: he speaks
 *  within about this long of it going quiet. */
export const AGENT_POLL_MS = 1_000;

/** Whether Agent Speak has gone quiet, asked only while someone waits on it. */
@Injectable({ providedIn: 'root' })
export class AgentQuiet {
  private readonly api = inject(AGENT_SPEECH_API);

  /** True once Agent Speak is known to be quiet, asked every AGENT_POLL_MS
   *  while `isWaiting` is true. False while nobody waits, and from the moment
   *  someone starts to until the first answer, so nothing is said over it. */
  whileWaiting(isWaiting: Observable<boolean>): Observable<boolean> {
    return isWaiting.pipe(
      distinctUntilChanged(),
      switchMap((waits) => (waits ? this.polled() : of(false))),
      distinctUntilChanged(),
    );
  }

  private polled(): Observable<boolean> {
    return interval(AGENT_POLL_MS).pipe(
      startWith(0),
      exhaustMap(() => this.api.isBusy()),
      map((isBusy) => !isBusy),
      startWith(false),
    );
  }
}
