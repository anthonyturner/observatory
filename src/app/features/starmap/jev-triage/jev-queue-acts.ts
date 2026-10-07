import { ErrorHandler, Injectable, Injector, Provider, inject } from '@angular/core';
import { QueueAct } from '../../../core/assistant/assistant.types';
import { QUEUE_ACTS, QueueActs } from '../../../core/assistant/queue-acts';
import { QueueReply } from './queue-reply';
import { TRIAGE_NOT_LOADED } from './queue-triage-voice';

/** Hands a Review Queue command Jev chose to QueueActRunner, which loads only
 *  when Jev first chooses one, so Home's first load does not carry it. */
@Injectable({ providedIn: 'root' })
export class JevQueueActs implements QueueActs {
  private readonly injector = inject(Injector);
  private readonly errors = inject(ErrorHandler);
  private readonly replies = inject(QueueReply);

  carryOut(entryId: number, act: QueueAct): void {
    import('./queue-act-runner')
      .then(({ QueueActRunner }) => this.injector.get(QueueActRunner).carryOut(entryId, act))
      .catch((error: unknown) => {
        this.errors.handleError(error);
        this.replies.say(entryId, TRIAGE_NOT_LOADED);
      });
  }
}

export const JEV_QUEUE_ACTS: Provider = { provide: QUEUE_ACTS, useExisting: JevQueueActs };
