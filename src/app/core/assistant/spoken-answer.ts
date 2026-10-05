import { Injectable, inject } from '@angular/core';
import { AskDraft } from './ask-draft';
import { OpenItem, itemNameOf } from './open-items';
import { OpenQuestion } from './open-question';
import { quotedWords } from './proposal';
import { QuestionAnswer, UnclearWhy, answerTo } from './question-answer';
import { QUESTION_ANSWER_CHIP } from './reply-chip';
import { noting } from './reply-entry';
import { ReplyLog } from './reply-log';
import { ReplySpeech } from './reply-speech';
import { TierOneActions } from './tier-one-actions';

/** An answer opens an item, like any other app action. */
const ANSWER_TIER = 1;

export const WHICH_ONE = 'Which one? Say its number, or press Open.';
export const ONE_AT_A_TIME = 'I can open one at a time — say which, or press Open.';
export const LEFT_IT = 'Left it.';

const unclearLine = (words: string, why: UnclearWhy): string =>
  why === 'several'
    ? WHICH_ONE
    : `Heard “${quotedWords(words)}”, but I can’t tell which one that is. Say its number, or press Open.`;

/**
 * Carries out a spoken answer to Jev's open question. Each answer gets a
 * reply of its own, so opening an item waits the grace second with Stay
 * here, as any page Jev opens does.
 */
@Injectable({ providedIn: 'root' })
export class SpokenAnswer {
  private readonly question = inject(OpenQuestion);
  private readonly log = inject(ReplyLog);
  private readonly speech = inject(ReplySpeech);
  private readonly actions = inject(TierOneActions);
  private readonly draft = inject(AskDraft);

  /** What `words` answer to the question waiting, or null when none waits
   *  or the words are a request of their own. */
  answerOf(words: string): QuestionAnswer | null {
    const asked = this.question.question();
    return asked && this.question.isWaiting() ? answerTo(words, asked.items) : null;
  }

  carryOut(words: string, answer: QuestionAnswer): void {
    this.actions.cancelJump();
    const entryId = this.log.open(words, 'spoken');
    this.log.setChip(entryId, QUESTION_ANSWER_CHIP);
    if (answer.kind === 'open') this.open(entryId, answer.item);
    else if (answer.kind === 'unclear') this.askAgain(entryId, words, answer.why);
    else if (answer.kind === 'all') this.say(entryId, ONE_AT_A_TIME);
    else this.leave(entryId);
  }

  private open(entryId: number, item: OpenItem): void {
    this.question.close();
    this.actions.jumpTo(entryId, item.href, `Opening ${itemNameOf(item)}`);
    this.speech.speak(this.log.find(entryId)?.said.text ?? '', entryId, ANSWER_TIER);
  }

  /** The card stays. Words that named nothing also go into the box, in case
   *  they were a request after all. */
  private askAgain(entryId: number, words: string, why: UnclearWhy): void {
    if (why === 'unmatched') this.draft.add(words);
    const line = unclearLine(words, why);
    this.log.say(entryId, noting(line));
    if (this.question.hasSaidUnclear()) return;
    this.question.noteUnclearSaid();
    this.speech.speak(line, entryId, ANSWER_TIER);
  }

  private say(entryId: number, line: string): void {
    this.log.say(entryId, noting(line));
    this.speech.speak(line, entryId, ANSWER_TIER);
  }

  private leave(entryId: number): void {
    this.question.close();
    this.log.say(entryId, noting(LEFT_IT));
  }
}
