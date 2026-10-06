import { HttpClient } from '@angular/common/http';
import { DestroyRef, ErrorHandler, Injectable, Provider, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, forkJoin, map, of, timer } from 'rxjs';
import { ASK_SHORTCUTS, AskShortcut, ShortcutAct } from '../../../core/assistant/ask-shortcut';
import { AssistantInfo } from '../../../core/assistant/assistant-info';
import { hrefOf } from '../../../core/assistant/open-items';
import { OpenQuestion, QUESTION_MS, TIMED_OUT_NOTE } from '../../../core/assistant/open-question';
import { ReplyChip } from '../../../core/assistant/reply-chip';
import { AskedHow, noting, saying } from '../../../core/assistant/reply-entry';
import { ReplyLog } from '../../../core/assistant/reply-log';
import { ReplySpeech } from '../../../core/assistant/reply-speech';
import { LEFT_IT } from '../../../core/assistant/spoken-answer';
import { TierOneActions } from '../../../core/assistant/tier-one-actions';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { readQueue } from '../../../core/queue/queue-feed';
import { MAX_SNOOZE_DAYS, TriageChoice, TriageClient } from '../../../core/queue/triage-client';
import { Clock } from '../../../core/time/clock';
import { plural } from '../../../shared/text/plural';
import { Confirmation, QueueCommand, confirmationOf, queueCommandOf } from './queue-command';
import {
  BLOCKING_COUNT,
  ProjectQueue,
  TopPull,
  blockingWords,
  nextStarWords,
  pullNameOf,
  topOfQueues,
} from './queue-top';

/** The chip on a reply the Review Queue's commands gave, which never went to the router. */
export const QUEUE_CHIP: ReplyChip = {
  pips: '●○○',
  text: 'Tier 1 · Review Queue · matched here',
  tone: 'tier',
};

/** Queue commands are app actions. */
const ACTION_TIER = 1;

export const NOT_READ_YET = 'The projects aren’t read yet. Try again in a moment.';
export const OUT_OF_REACH = 'The queues are out of reach. Is the API running?';
export const NOTHING_NEXT =
  'No pull request is ready to work: drafts, snoozed and dismissed ones aside.';

type ReadCommand = Extract<QueueCommand, { readonly kind: 'blocking' | 'next' }>;
type TriageCommand = Extract<QueueCommand, { readonly kind: 'snooze' | 'dismiss' }>;

/** A snooze or dismissal Jev has asked about, waiting on a yes. */
interface PendingTriage {
  readonly entryId: number;
  readonly repo: string;
  readonly pr: number;
  readonly choice: TriageChoice;
  /** "Snooze alpha pull request 12 till Monday?" */
  readonly question: string;
  /** "Snoozed alpha pull request 12 till Monday." */
  readonly done: string;
  readonly failed: string;
}

/** The queues read, and how many could not be. */
interface QueuesRead {
  readonly queues: readonly ProjectQueue[];
  readonly missed: number;
}

/**
 * The Review Queue by voice or typing on Home: "what's blocking?", "next
 * star", "snooze 412 till Monday" and "dismiss 412". Matched here with no
 * model, so typed and spoken words do exactly the same. A snooze or a
 * dismissal is asked about first, and is recorded only on a yes.
 */
@Injectable({ providedIn: 'root' })
export class QueueTriageVoice implements AskShortcut {
  private readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);
  private readonly projectsState = inject(PROJECTS_STATE);
  private readonly info = inject(AssistantInfo);
  private readonly triage = inject(TriageClient);
  private readonly log = inject(ReplyLog);
  private readonly speech = inject(ReplySpeech);
  private readonly actions = inject(TierOneActions);
  private readonly question = inject(OpenQuestion);
  private readonly clock = inject(Clock);
  private readonly errors = inject(ErrorHandler);
  private pending: PendingTriage | null = null;
  private expiry = Subscription.EMPTY;

  /** The projects GitHub could read, or null until they are read. */
  private readonly projects = computed((): readonly ProjectSnapshot[] | null => {
    const state = this.projectsState();
    return state.status === 'ready' ? state.report.projects.filter((each) => !each.error) : null;
  });

  actOf(words: string): ShortcutAct | null {
    if (this.info.isElsewhere()) return null;
    const answer = this.pending ? confirmationOf(words) : null;
    if (answer) return (how) => this.answer(words, how, answer);
    const command = queueCommandOf(words, this.projects() ?? [], this.clock.now());
    return command && ((how) => this.run(words, how, command));
  }

  passOver(): void {
    this.leavePending(LEFT_IT);
  }

  private run(words: string, how: AskedHow, command: QueueCommand): void {
    this.leavePending(LEFT_IT);
    this.question.close();
    this.actions.cancelJump();
    const entryId = this.open(words, how);
    if (command.kind === 'blocking' || command.kind === 'next') this.read(entryId, command);
    else this.ask(entryId, command);
  }

  private open(words: string, how: AskedHow): number {
    const entryId = this.log.open(words, how);
    this.log.setChip(entryId, QUEUE_CHIP);
    return entryId;
  }

  /** "What's blocking?" and "next star" read the queues first. */
  private read(entryId: number, command: ReadCommand): void {
    const projects = this.projects();
    if (!projects) return this.reply(entryId, NOT_READ_YET);
    const { project } = command;
    const wanted = project
      ? projects.filter((each) => each.repo === project.repo)
      : projects.filter((each) => each.open > 0);
    this.log.say(entryId, saying('Reading the queues…'));
    this.queuesOf(wanted)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((read) => this.answerRead(entryId, command, read));
  }

  private queuesOf(projects: readonly ProjectSnapshot[]): Observable<QueuesRead> {
    if (!projects.length) return of({ queues: [], missed: 0 });
    const reads = projects.map((project) =>
      readQueue(this.http, project.repo).pipe(
        map((state) => (state.status === 'ready' ? { project, items: state.report.items } : null)),
      ),
    );
    return forkJoin(reads).pipe(
      map((queues) => {
        const read = queues.filter((queue) => queue !== null);
        return { queues: read, missed: queues.length - read.length };
      }),
    );
  }

  private answerRead(entryId: number, command: ReadCommand, read: QueuesRead): void {
    if (read.missed && !read.queues.length) return this.reply(entryId, OUT_OF_REACH);
    const missed = read.missed ? ` ${plural(read.missed, 'queue')} out of reach.` : '';
    if (command.kind === 'next') return this.openNext(entryId, topOfQueues(read.queues, 1)[0]);
    const top = topOfQueues(read.queues, BLOCKING_COUNT);
    this.reply(entryId, blockingWords(top, command.project) + missed);
  }

  /** Opens Next star's pick after the grace second, with Stay here. */
  private openNext(entryId: number, pull: TopPull | undefined): void {
    if (!pull) return this.reply(entryId, NOTHING_NEXT);
    const href = hrefOf('pull', pull.project.repo, pull.item.pr);
    this.actions.jumpTo(entryId, href, nextStarWords(pull));
    this.speech.speak(this.log.find(entryId)?.said.text ?? '', entryId, ACTION_TIER);
  }

  /** A snooze or dismissal: which pull request, then a question with Yes and No. */
  private ask(entryId: number, command: TriageCommand): void {
    const projects = this.projects();
    if (!projects) return this.reply(entryId, NOT_READ_YET);
    const { pr, project } = command;
    const holding = projects.filter(
      (each) =>
        (!project || each.repo === project.repo) &&
        (each.openPulls ?? []).some((pull) => pull.number === pr),
    );
    if (!holding.length) {
      return this.reply(
        entryId,
        `Pull request ${pr} isn’t open in ${project?.name ?? 'any project'}.`,
      );
    }
    if (holding.length > 1) {
      const names = holding.map((each) => each.name).join(' and ');
      const example = `${command.kind} ${pr} in ${holding[0].name}`;
      return this.reply(
        entryId,
        `Pull request ${pr} is open in ${names}. Say which, as in “${example}”.`,
      );
    }
    if (command.kind === 'snooze' && command.until.days > MAX_SNOOZE_DAYS) {
      return this.reply(entryId, `I can snooze for ${MAX_SNOOZE_DAYS} days at most.`);
    }
    this.awaitYes(pendingOf(entryId, command, holding[0]));
  }

  private awaitYes(pending: PendingTriage): void {
    this.pending = pending;
    this.reply(pending.entryId, pending.question);
    this.log.setActions(pending.entryId, [
      { kind: 'say', label: 'Yes', words: 'yes' },
      { kind: 'say', label: 'No', words: 'no' },
    ]);
    this.expiry = timer(QUESTION_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.leavePending(TIMED_OUT_NOTE));
  }

  private answer(words: string, how: AskedHow, answer: Confirmation): void {
    const pending = this.pending;
    if (!pending) return;
    this.closePending(pending);
    const entryId = this.open(words, how);
    if (answer === 'no') return this.log.say(entryId, noting(LEFT_IT));
    this.log.say(entryId, saying('Recording it…'));
    this.triage
      .record(pending.repo, pending.pr, pending.choice)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.reply(entryId, pending.done),
        error: (error: unknown) => {
          this.errors.handleError(error);
          this.reply(entryId, pending.failed);
        },
      });
  }

  /** Drops the question waiting, saying why under it. */
  private leavePending(why: string): void {
    const pending = this.pending;
    if (!pending) return;
    this.closePending(pending);
    this.log.say(pending.entryId, noting(`${pending.question} ${why}`));
  }

  private closePending(pending: PendingTriage): void {
    this.expiry.unsubscribe();
    this.pending = null;
    this.log.setActions(pending.entryId, []);
  }

  /** Shows `text` as the reply, and reads it aloud. */
  private reply(entryId: number, text: string): void {
    this.log.say(entryId, saying(text));
    this.speech.speak(text, entryId, ACTION_TIER);
  }
}

/** What Jev asks before acting on `command`, and says after. */
function pendingOf(
  entryId: number,
  command: TriageCommand,
  project: ProjectSnapshot,
): PendingTriage {
  const title = project.openPulls?.find((pull) => pull.number === command.pr)?.title ?? null;
  const name = pullNameOf(project, command.pr, title);
  // A quoted title reads as an aside, so it is closed off before the time.
  const named = title ? `${name},` : name;
  const target = { entryId, repo: project.repo, pr: command.pr };
  if (command.kind === 'dismiss') {
    return {
      ...target,
      choice: { action: 'dismiss' },
      question: `Dismiss ${name}? It comes back if it changes.`,
      done: `Dismissed ${name}.`,
      failed: `Couldn’t dismiss ${name}: the API didn’t take it.`,
    };
  }
  const { days, words } = command.until;
  return {
    ...target,
    choice: { action: 'snooze', days },
    question: `Snooze ${named} ${words}?`,
    done: `Snoozed ${named} ${words}.`,
    failed: `Couldn’t snooze ${name}: the API didn’t take it.`,
  };
}

/** Lets the Ask feed hand the Review Queue's commands here before the router. */
export const QUEUE_TRIAGE_SHORTCUT: Provider = {
  provide: ASK_SHORTCUTS,
  useExisting: QueueTriageVoice,
  multi: true,
};
