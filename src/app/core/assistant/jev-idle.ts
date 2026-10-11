import { Injectable, Signal, computed, inject } from '@angular/core';
import { ANNOUNCEMENT_VOICE } from '../voice/announcement-voice';
import { TalkState } from '../voice/talk-state';
import { ASK_CHANNEL } from './ask-channel';
import { OpenQuestion } from './open-question';
import { ProposalSlot } from './proposal';

/** Whether Jev has nothing on: not reading a line, not hearing the mic, not on
 *  a request, not showing a task and not waiting on an answer. A line nobody
 *  asked for waits for this, or is dropped. */
@Injectable({ providedIn: 'root' })
export class JevIdle {
  private readonly voice = inject(ANNOUNCEMENT_VOICE);
  private readonly talking = inject(TalkState).isTalking;
  private readonly asking = inject(ASK_CHANNEL).busy;
  private readonly proposal = inject(ProposalSlot).proposal;
  private readonly question = inject(OpenQuestion);

  readonly isIdle: Signal<boolean> = computed(
    () =>
      !this.voice.isBusy() &&
      !this.talking() &&
      !this.asking() &&
      this.proposal() === null &&
      !this.question.isWaiting(),
  );
}
