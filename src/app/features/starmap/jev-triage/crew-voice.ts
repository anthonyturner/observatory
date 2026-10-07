import { ErrorHandler, Injectable, Injector, Provider, computed, inject } from '@angular/core';
import { ASK_SHORTCUTS, AskShortcut, ShortcutAct } from '../../../core/assistant/ask-shortcut';
import { AssistantInfo } from '../../../core/assistant/assistant-info';
import { OpenItem } from '../../../core/assistant/open-items';
import { OpenQuestion } from '../../../core/assistant/open-question';
import { itemsMeantBy } from '../../../core/assistant/question-answer';
import { AskedHow } from '../../../core/assistant/reply-entry';
import { LEFT_IT } from '../../../core/assistant/spoken-answer';
import { TierOneActions } from '../../../core/assistant/tier-one-actions';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { CrewPick, crewPickOf, crewReferenceOf, whichWords } from './crew-request';
import { QueueReply } from './queue-reply';
import { pullItemOf, readProjectsOf } from './queue-top';
import { YesNoQuestion } from './yes-no-question';

/** The card's question while Jev waits to hear which pull request a crew takes. */
export const CREW_WHICH = 'Which one should the crew take?';
const CREW_NOT_LOADED = 'Send crew didn’t load. Try again in a moment.';

/**
 * Hears a crew asked for on Home, typed or spoken: "send a crew to 412", or,
 * after the blocking list, "the observatory one about the playlist, assign it
 * to a crew member". It settles which pull request is meant, asking which
 * when the words fit several, then hands it to CrewCheck to send.
 */
@Injectable({ providedIn: 'root' })
export class CrewVoice implements AskShortcut {
  private readonly injector = inject(Injector);
  private readonly errors = inject(ErrorHandler);
  private readonly projectsState = inject(PROJECTS_STATE);
  private readonly info = inject(AssistantInfo);
  private readonly question = inject(OpenQuestion);
  private readonly yesNo = inject(YesNoQuestion);
  private readonly replies = inject(QueueReply);
  private readonly actions = inject(TierOneActions);
  /** The question Jev put up to ask which pull request the crew takes. */
  private choosingId: number | null = null;

  /** Every open pull request, for a crew asked for with no list to pick from. */
  private readonly openPulls = computed((): readonly OpenItem[] =>
    (readProjectsOf(this.projectsState()) ?? []).flatMap((project) =>
      (project.openPulls ?? []).map((pull) => pullItemOf(project, pull.number, pull.title)),
    ),
  );

  actOf(words: string): ShortcutAct | null {
    if (this.info.isElsewhere()) return null;
    const pick = this.pickOf(words);
    return pick && ((how) => this.run(words, how, pick));
  }

  /** A request for a crew, or, while Jev asks which one, words that name one. */
  private pickOf(words: string): CrewPick | null {
    const reference = crewReferenceOf(words);
    if (reference !== null) return crewPickOf(reference, this.listed(), this.openPulls());
    if (!this.isChoosing()) return null;
    const named = itemsMeantBy(words, this.listed());
    return named?.length === 1 ? { kind: 'one', pull: named[0] } : null;
  }

  /** The pull requests on the question waiting: the blocking list, or Jev's "which one?". */
  private listed(): readonly OpenItem[] {
    const asked = this.question.question();
    if (!asked || !this.question.isWaiting()) return [];
    return asked.items.filter((item) => item.kind === 'pull');
  }

  private isChoosing(): boolean {
    return this.question.isWaiting() && this.question.question()?.id === this.choosingId;
  }

  private run(words: string, how: AskedHow, pick: CrewPick): void {
    this.yesNo.leave(LEFT_IT);
    this.actions.cancelJump();
    const entryId = this.replies.open(words, how);
    if (pick.kind !== 'one') return this.askWhich(entryId, pick);
    this.question.close();
    this.replies.show(entryId, 'Checking it…');
    this.check(entryId, pick.pull);
  }

  /** Asks which, listing the ones it could be on the card, so a reply can name one. */
  private askWhich(entryId: number, pick: Exclude<CrewPick, { readonly kind: 'one' }>): void {
    this.replies.say(entryId, whichWords(pick));
    const pulls = pick.kind === 'which' ? pick.pulls : pick.kind === 'unmatched' ? pick.listed : [];
    if (!pulls.length || !this.question.canAsk()) return;
    this.question.ask(CREW_WHICH, pulls);
    this.choosingId = this.question.question()?.id ?? null;
  }

  /** Send crew brings the task runner with it, so it loads only when a crew is asked for. */
  private check(entryId: number, pull: OpenItem): void {
    import('./crew-check')
      .then(({ CrewCheck }) => this.injector.get(CrewCheck).check(entryId, pull))
      .catch((error: unknown) => {
        this.errors.handleError(error);
        this.replies.say(entryId, CREW_NOT_LOADED);
      });
  }
}

/** Lets the Ask feed hand requests for a crew here before the router. */
export const CREW_VOICE_SHORTCUT: Provider = {
  provide: ASK_SHORTCUTS,
  useExisting: CrewVoice,
  multi: true,
};
