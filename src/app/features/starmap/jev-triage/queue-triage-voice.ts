import { ErrorHandler, Injectable, Injector, Provider, computed, inject } from '@angular/core';
import { ASK_SHORTCUTS, AskShortcut, ShortcutAct } from '../../../core/assistant/ask-shortcut';
import { AssistantInfo } from '../../../core/assistant/assistant-info';
import { OpenQuestion } from '../../../core/assistant/open-question';
import { AskedHow } from '../../../core/assistant/reply-entry';
import { LEFT_IT } from '../../../core/assistant/spoken-answer';
import { TierOneActions } from '../../../core/assistant/tier-one-actions';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { Clock } from '../../../core/time/clock';
import { closestCommandTo, heardWords } from './closest-command';
import { readProjectsOf } from './project-pulls';
import { QueueCommand, queueCommandOf } from './queue-command';
import { QueueReply } from './queue-reply';
import { YesNoQuestion } from './yes-no-question';

const TRIAGE_NOT_LOADED = 'The Review Queue commands didn’t load. Try again in a moment.';

/**
 * The Review Queue by voice or typing on Home: "what's blocking?", "next
 * star", "snooze 412 till Monday" and "dismiss 412". Matched here with no
 * model, so typed and spoken words do exactly the same, then handed to
 * QueueTriage to carry out. A snooze or dismissal it cannot make out gets
 * what Jev heard and the command it can do, rather than a chat.
 */
@Injectable({ providedIn: 'root' })
export class QueueTriageVoice implements AskShortcut {
  private readonly injector = inject(Injector);
  private readonly errors = inject(ErrorHandler);
  private readonly projectsState = inject(PROJECTS_STATE);
  private readonly info = inject(AssistantInfo);
  private readonly replies = inject(QueueReply);
  private readonly yesNo = inject(YesNoQuestion);
  private readonly actions = inject(TierOneActions);
  private readonly question = inject(OpenQuestion);
  private readonly clock = inject(Clock);

  private readonly projects = computed(() => readProjectsOf(this.projectsState()));

  actOf(words: string): ShortcutAct | null {
    if (this.info.isElsewhere()) return null;
    const command = queueCommandOf(words, this.projects() ?? [], this.clock.now());
    if (command) return (how) => this.carryOut(this.openReply(words, how), command);
    const closest = closestCommandTo(words);
    if (closest === null) return null;
    return (how) => this.replies.say(this.openReply(words, how), heardWords(words, closest));
  }

  /** Leaves whatever was waiting on an answer, and opens the reply; its id. */
  private openReply(words: string, how: AskedHow): number {
    this.yesNo.leave(LEFT_IT);
    this.question.close();
    this.actions.cancelJump();
    return this.replies.open(words, how);
  }

  /** Reading and recording load only when a command is first heard. */
  private carryOut(entryId: number, command: QueueCommand): void {
    import('./queue-triage')
      .then(({ QueueTriage }) => this.injector.get(QueueTriage).run(entryId, command))
      .catch((error: unknown) => {
        this.errors.handleError(error);
        this.replies.say(entryId, TRIAGE_NOT_LOADED);
      });
  }
}

/** Lets the Ask feed hand the Review Queue's commands here before the router. */
export const QUEUE_TRIAGE_SHORTCUT: Provider = {
  provide: ASK_SHORTCUTS,
  useExisting: QueueTriageVoice,
  multi: true,
};
