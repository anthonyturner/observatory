import { DestroyRef, Injectable, Provider, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, timer } from 'rxjs';
import { ASK_SHORTCUTS, AskShortcut, ShortcutAct } from '../../../core/assistant/ask-shortcut';
import { QUESTION_MS, TIMED_OUT_NOTE } from '../../../core/assistant/open-question';
import { AskedHow, EntryAction } from '../../../core/assistant/reply-entry';
import { ReplyLog } from '../../../core/assistant/reply-log';
import { LEFT_IT } from '../../../core/assistant/spoken-answer';
import { Confirmation, confirmationOf } from './queue-command';
import { QueueReply } from './queue-reply';

/** Something Jev will do only on a yes. */
export interface YesNo {
  /** The reply that asks. */
  readonly entryId: number;
  /** "Dismiss alpha pull request 12?" */
  readonly question: string;
  /** Does it, answering in `entryId`, the yes's own reply. */
  readonly onYes: (entryId: number) => void;
}

const BUTTONS: readonly EntryAction[] = [
  { kind: 'say', label: 'Yes', words: 'yes' },
  { kind: 'say', label: 'No', words: 'no' },
];

/**
 * The one yes-or-no question the Review Queue's commands have waiting, asked
 * aloud and with Yes and No buttons. A yes or a no, typed or spoken, answers
 * it; anything else asked leaves it, and it lapses after a while.
 */
@Injectable({ providedIn: 'root' })
export class YesNoQuestion implements AskShortcut {
  private readonly destroyRef = inject(DestroyRef);
  private readonly log = inject(ReplyLog);
  private readonly replies = inject(QueueReply);
  private asked: YesNo | null = null;
  private expiry = Subscription.EMPTY;

  /** Asks `asked` in place of any question still waiting. */
  ask(asked: YesNo): void {
    this.leave(LEFT_IT);
    this.asked = asked;
    this.replies.say(asked.entryId, asked.question);
    this.log.setActions(asked.entryId, BUTTONS);
    this.expiry = timer(QUESTION_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.leave(TIMED_OUT_NOTE));
  }

  actOf(words: string): ShortcutAct | null {
    const answer = this.asked ? confirmationOf(words) : null;
    return answer && ((how) => this.answer(words, how, answer));
  }

  passOver(): void {
    this.leave(LEFT_IT);
  }

  /** Drops the question waiting, saying why under it. */
  leave(why: string): void {
    const asked = this.asked;
    if (!asked) return;
    this.close(asked);
    this.replies.note(asked.entryId, `${asked.question} ${why}`);
  }

  private answer(words: string, how: AskedHow, answer: Confirmation): void {
    const asked = this.asked;
    if (!asked) return;
    this.close(asked);
    const entryId = this.replies.open(words, how);
    if (answer === 'no') this.replies.note(entryId, LEFT_IT);
    else asked.onYes(entryId);
  }

  private close(asked: YesNo): void {
    this.expiry.unsubscribe();
    this.asked = null;
    this.log.setActions(asked.entryId, []);
  }
}

export const YES_NO_SHORTCUT: Provider = {
  provide: ASK_SHORTCUTS,
  useExisting: YesNoQuestion,
  multi: true,
};
