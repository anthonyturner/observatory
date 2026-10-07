import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { OpenItem } from '../../../core/assistant/open-items';
import { CrewDispatch, NO_RUNNER_TEXT } from '../../../core/crew/crew-dispatch';
import { crewFor } from '../../../core/crew/crew-roster';
import { QueueState, readQueue } from '../../../core/queue/queue-feed';
import { CrewStanding, crewVerdictOf } from './crew-verdict';
import { OUT_OF_REACH, QueueReply } from './queue-reply';
import { pullNameOf } from './queue-top';
import { YesNoQuestion } from './yes-no-question';

const nameOf = (pull: OpenItem): string =>
  pullNameOf({ name: pull.label, repo: pull.repo }, pull.number, pull.title);

const sentWords = (name: string): string =>
  `Crew sent to ${name}. Its ship stays by the star while it works, and the task panel has its log.`;

/**
 * Sends a crew to the pull request a request named, through Send crew and by
 * its rules: where it stands is read afresh, and Jev asks yes or no before
 * any crew goes. Loaded only when a crew is first asked for, as Send crew
 * brings the task runner with it.
 */
@Injectable({ providedIn: 'root' })
export class CrewCheck {
  private readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);
  private readonly dispatch = inject(CrewDispatch);
  private readonly yesNo = inject(YesNoQuestion);
  private readonly replies = inject(QueueReply);

  /** Answers in reply `entryId` whether a crew can take `pull`, asking first when one can. */
  check(entryId: number, pull: OpenItem): void {
    this.dispatch
      .availability()
      .pipe(
        switchMap((isAvailable) => (isAvailable ? readQueue(this.http, pull.repo) : of(null))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) =>
        state ? this.decide(entryId, pull, state) : this.replies.say(entryId, NO_RUNNER_TEXT),
      );
  }

  private decide(entryId: number, pull: OpenItem, state: QueueState): void {
    if (state.status !== 'ready') return this.replies.say(entryId, OUT_OF_REACH);
    const name = nameOf(pull);
    const item = state.report.items.find((each) => each.number === pull.number);
    const verdict = crewVerdictOf(name, item, this.standingOf(pull));
    if (verdict.kind === 'say') return this.replies.say(entryId, verdict.text);
    const onYes =
      verdict.kind === 'send'
        ? (yesId: number) => this.send(yesId, pull)
        : (yesId: number) => this.replies.jump(yesId, pull.href, `Opening ${name}`);
    this.yesNo.ask({ entryId, question: verdict.question, onYes });
  }

  private standingOf({ repo, number }: OpenItem): CrewStanding {
    return {
      crew: crewFor(this.dispatch.crews(), repo, number),
      isSending: this.dispatch.isSending(repo, number),
      isRunnerBusy: this.dispatch.isRunnerBusy(),
      refusal: null,
    };
  }

  private send(entryId: number, pull: OpenItem): void {
    this.replies.show(entryId, 'Launching the crew…');
    this.dispatch
      .launch(pull.repo, pull.number)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((refusal) => this.replies.say(entryId, refusal ?? sentWords(nameOf(pull))));
  }
}
