import { Injectable, inject } from '@angular/core';
import { ReplyChip } from '../../../core/assistant/reply-chip';
import { AskedHow, noting, saying } from '../../../core/assistant/reply-entry';
import { ReplyLog } from '../../../core/assistant/reply-log';
import { ReplySpeech } from '../../../core/assistant/reply-speech';
import { TierOneActions } from '../../../core/assistant/tier-one-actions';

/** The chip on a reply the Review Queue's commands gave, which never went to the router. */
export const QUEUE_CHIP: ReplyChip = {
  pips: '●○○',
  text: 'Tier 1 · Review Queue · matched here',
  tone: 'tier',
};

export const NOT_READ_YET = 'The projects aren’t read yet. Try again in a moment.';
export const OUT_OF_REACH = 'The queues are out of reach. Is the API running?';

/** Queue commands are app actions. */
const ACTION_TIER = 1;

/** How the Review Queue's commands answer in Home's reply feed. */
@Injectable({ providedIn: 'root' })
export class QueueReply {
  private readonly log = inject(ReplyLog);
  private readonly speech = inject(ReplySpeech);
  private readonly actions = inject(TierOneActions);

  /** A reply of its own for `words`, under the queue's chip; its id. */
  open(words: string, how: AskedHow): number {
    const entryId = this.log.open(words, how);
    this.log.setChip(entryId, QUEUE_CHIP);
    return entryId;
  }

  /** Shows `text` as the reply, and reads it aloud. */
  say(entryId: number, text: string): void {
    this.log.say(entryId, saying(text));
    this.speech.speak(text, entryId, ACTION_TIER);
  }

  /** Shows what Jev is doing, unspoken: "Reading the queues…". */
  show(entryId: number, text: string): void {
    this.log.say(entryId, saying(text));
  }

  note(entryId: number, text: string): void {
    this.log.say(entryId, noting(text));
  }

  /** Opens `href` after the grace second, with Stay here, saying `says…` aloud. */
  jump(entryId: number, href: string, says: string): void {
    this.actions.jumpTo(entryId, href, says);
    this.speech.speak(this.log.find(entryId)?.said.text ?? '', entryId, ACTION_TIER);
  }
}
