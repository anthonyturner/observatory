import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
import { OpenItem } from '../../../core/assistant/open-items';
import { CrewDispatch, NO_RUNNER_TEXT } from '../../../core/crew/crew-dispatch';
import { crewFor } from '../../../core/crew/crew-roster';
import { Ledger } from '../../../core/queue/ledger';
import { readLedger } from '../../../core/queue/ledger-feed';
import { QueueState, readQueue } from '../../../core/queue/queue-feed';
import { QueueReport } from '../../../core/queue/queue-report';
import { landedBaseOf } from '../../../core/queue/stacks';
import { CrewStanding, CrewTarget, crewVerdictOf } from './crew-verdict';
import { OUT_OF_REACH, QueueReply } from './queue-reply';
import { pullNameOf } from './queue-top';
import { YesNoQuestion } from './yes-no-question';

const nameOf = (pull: OpenItem): string =>
  pullNameOf({ name: pull.label, repo: pull.repo }, pull.number, pull.title);

/** The queue, and the ledger that says which stacked bases have merged. */
interface CrewReads {
  readonly queue: QueueState;
  readonly ledger: Ledger | null;
}

const sentWords = (name: string): string =>
  `Crew sent to ${name}. Its ship stays by the star while it works, and the task panel has its log.`;

/** Pull request `number` in `report`, with the merge of its stacked base, as the star card reads it. */
function targetOf(
  number: number,
  report: QueueReport,
  ledger: Ledger | null,
): CrewTarget | undefined {
  const item = report.items.find((each) => each.number === number);
  if (!item) return undefined;
  return { item, landed: landedBaseOf(item, report.items, ledger?.mergedBranches ?? []) };
}

/**
 * Sends a crew to the pull request a request named, through Send crew and by
 * its rules: where it stands, and whether the base it was stacked on has
 * merged, are read afresh, and Jev asks yes or no before any crew goes.
 * Loaded only when a crew is first asked for, as Send crew brings the task
 * runner with it.
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
        switchMap((isAvailable) => (isAvailable ? this.read(pull.repo) : of(null))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((reads) =>
        reads ? this.decide(entryId, pull, reads) : this.replies.say(entryId, NO_RUNNER_TEXT),
      );
  }

  private read(repo: string): Observable<CrewReads> {
    return forkJoin({ queue: readQueue(this.http, repo), ledger: readLedger(this.http, repo) });
  }

  private decide(entryId: number, pull: OpenItem, { queue, ledger }: CrewReads): void {
    if (queue.status !== 'ready') return this.replies.say(entryId, OUT_OF_REACH);
    const name = nameOf(pull);
    const target = targetOf(pull.number, queue.report, ledger);
    const verdict = crewVerdictOf(name, target, this.standingOf(pull));
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
