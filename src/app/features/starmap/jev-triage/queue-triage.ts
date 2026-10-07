import { HttpClient } from '@angular/common/http';
import { DestroyRef, ErrorHandler, Injectable, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, map, of } from 'rxjs';
import { hrefOf } from '../../../core/assistant/open-items';
import { OpenQuestion } from '../../../core/assistant/open-question';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { readQueue } from '../../../core/queue/queue-feed';
import { MAX_SNOOZE_DAYS, TriageChoice, TriageClient } from '../../../core/queue/triage-client';
import { plural } from '../../../shared/text/plural';
import { pullItemOf, readProjectsOf } from './project-pulls';
import { QueueCommand } from './queue-command';
import { NOT_READ_YET, OUT_OF_REACH, QueueReply, notOpenWords } from './queue-reply';
import {
  BLOCKING_COUNT,
  ProjectQueue,
  TopPull,
  blockingWords,
  nextStarWords,
  offerOf,
  pullNameOf,
  topOfQueues,
} from './queue-top';
import { YesNoQuestion } from './yes-no-question';

export const NOTHING_NEXT =
  'No pull request is ready to work: drafts, snoozed and dismissed ones aside.';

type ReadCommand = Extract<QueueCommand, { readonly kind: 'blocking' | 'next' }>;
type TriageCommand = Extract<QueueCommand, { readonly kind: 'snooze' | 'dismiss' }>;

/** A snooze or dismissal, as Jev asks about it and reports it. */
interface Triage {
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
 * Carries out a Review Queue command QueueTriageVoice heard: reads the queues
 * for "what's blocking?" and "next star", and asks before a snooze or a
 * dismissal, recording it only on a yes. The blocking list ends by offering
 * to open one or send a crew to it. Loaded only when a command is first
 * heard, so Home's first load does not carry it.
 */
@Injectable({ providedIn: 'root' })
export class QueueTriage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);
  private readonly projectsState = inject(PROJECTS_STATE);
  private readonly triage = inject(TriageClient);
  private readonly replies = inject(QueueReply);
  private readonly yesNo = inject(YesNoQuestion);
  private readonly question = inject(OpenQuestion);
  private readonly errors = inject(ErrorHandler);

  private readonly projects = computed(() => readProjectsOf(this.projectsState()));

  /** Answers `command` in reply `entryId`. */
  run(entryId: number, command: QueueCommand): void {
    if (command.kind === 'blocking' || command.kind === 'next') this.read(entryId, command);
    else this.ask(entryId, command);
  }

  /** "What's blocking?" and "next star" read the queues first. */
  private read(entryId: number, command: ReadCommand): void {
    const projects = this.projects();
    if (!projects) return this.replies.say(entryId, NOT_READ_YET);
    const { project } = command;
    const wanted = project
      ? projects.filter((each) => each.repo === project.repo)
      : projects.filter((each) => each.open > 0);
    this.replies.show(entryId, 'Reading the queues…');
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
    if (read.missed && !read.queues.length) return this.replies.say(entryId, OUT_OF_REACH);
    const missed = read.missed ? ` ${plural(read.missed, 'queue')} out of reach.` : '';
    if (command.kind === 'next') return this.openNext(entryId, topOfQueues(read.queues, 1)[0]);
    const top = topOfQueues(read.queues, BLOCKING_COUNT);
    const blocking = blockingWords(top, command.project) + missed;
    if (!top.length || !this.question.canAsk()) return this.replies.say(entryId, blocking);
    this.offer(entryId, blocking, top);
  }

  /** Ends the list by asking what to do with one, keeping the list as the
   *  question's items, so a reply can name one by number, place, project or title. */
  private offer(entryId: number, blocking: string, top: readonly TopPull[]): void {
    const items = top.map(({ project, item }) => pullItemOf(project, item.pr, item.title));
    const offer = offerOf(items);
    this.replies.say(entryId, `${blocking} ${offer}`);
    this.question.ask(offer, items);
  }

  /** Opens Next star's pick after the grace second, with Stay here. */
  private openNext(entryId: number, pull: TopPull | undefined): void {
    if (!pull) return this.replies.say(entryId, NOTHING_NEXT);
    this.replies.jump(
      entryId,
      hrefOf('pull', pull.project.repo, pull.item.pr),
      nextStarWords(pull),
    );
  }

  /** A snooze or dismissal: which pull request, then a question with Yes and No. */
  private ask(entryId: number, command: TriageCommand): void {
    const projects = this.projects();
    if (!projects) return this.replies.say(entryId, NOT_READ_YET);
    const { pr, project } = command;
    const holding = projects.filter(
      (each) =>
        (!project || each.repo === project.repo) &&
        (each.openPulls ?? []).some((pull) => pull.number === pr),
    );
    if (!holding.length) {
      return this.replies.say(entryId, notOpenWords(pr, project?.name ?? 'any project'));
    }
    if (holding.length > 1) {
      const names = holding.map((each) => each.name).join(' and ');
      const example = `${command.kind} ${pr} in ${holding[0].name}`;
      return this.replies.say(
        entryId,
        `Pull request ${pr} is open in ${names}. Say which, as in “${example}”.`,
      );
    }
    if (command.kind === 'snooze' && command.until.days > MAX_SNOOZE_DAYS) {
      return this.replies.say(entryId, `I can snooze for ${MAX_SNOOZE_DAYS} days at most.`);
    }
    const triage = triageOf(command, holding[0]);
    this.yesNo.ask({
      entryId,
      question: triage.question,
      onYes: (yesId) => this.record(yesId, triage),
    });
  }

  private record(entryId: number, triage: Triage): void {
    this.replies.show(entryId, 'Recording it…');
    this.triage
      .record(triage.repo, triage.pr, triage.choice)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.replies.say(entryId, triage.done),
        error: (error: unknown) => {
          this.errors.handleError(error);
          this.replies.say(entryId, triage.failed);
        },
      });
  }
}

/** What Jev asks before acting on `command`, and says after. */
function triageOf(command: TriageCommand, project: ProjectSnapshot): Triage {
  const title = project.openPulls?.find((pull) => pull.number === command.pr)?.title ?? null;
  const name = pullNameOf(project, command.pr, title);
  // A quoted title reads as an aside, so it is closed off before the time.
  const named = title ? `${name},` : name;
  const target = { repo: project.repo, pr: command.pr };
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
