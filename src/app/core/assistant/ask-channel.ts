import { InjectionToken, Signal, signal } from '@angular/core';

/** How a request reaches the assistant from outside the Ask box: the mic's
 *  transcript is sent exactly as typed words would be. */
export interface AskChannel {
  /** Sends `text` as a request. `spoken` marks one heard through the mic, so
   *  the reply can say what was heard and be read aloud. */
  submit(text: string, options?: { readonly spoken?: boolean }): void;
  /** True while a request is on its way, so the mic can wait for it. */
  readonly busy: Signal<boolean>;
}

/** Until the Ask feed provides one, nothing is sent. */
const NOWHERE: AskChannel = { submit: () => undefined, busy: signal(false).asReadonly() };

export const ASK_CHANNEL = new InjectionToken<AskChannel>('AskChannel', {
  providedIn: 'root',
  factory: () => NOWHERE,
});
