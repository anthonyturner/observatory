import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, switchMap } from 'rxjs';
import { RunDock } from '../runs/run-dock';
import { RUNNER_BUSY, messageOf, statusOf } from '../runs/runs-api';
import { RunsStore } from '../runs/runs-store';
import { CREW_API } from './crew-api';
import { CrewRun, crewRunOf, crewsOf } from './crew-roster';
import { crewKey } from './crew-tag';
import { Crew } from './crew.types';

/** Why the last send to one pull request failed. */
interface Refusal {
  readonly key: string;
  readonly text: string;
}

const BUSY_TEXT = 'Another task started first. Send the crew once it ends.';

/**
 * Crews sent to fix a conflicted or failing pull request. A crew is a run on
 * this machine's runner, the one Home's task panel shows, so the runner's list
 * says which crews are out; a crew's prompt names its pull request. Only the
 * local site, with a runner, can send one.
 */
@Injectable({ providedIn: 'root' })
export class CrewDispatch {
  private readonly api = inject(CREW_API);
  private readonly store = inject(RunsStore);
  private readonly dock = inject(RunDock);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hasRunner = signal(false);
  private readonly sendingKey = signal<string | null>(null);
  private readonly refusal = signal<Refusal | null>(null);
  private hasAsked = false;

  readonly isAvailable = computed(() => this.store.isAvailable() && this.hasRunner());
  readonly isRunnerBusy = this.store.isLive;
  readonly crews = computed((): readonly Crew[] => {
    const { current, recent } = this.store.list();
    const listed = [current, ...recent].filter((run) => run !== null).map(crewRunOf);
    const followed = this.store.followed();
    const live: CrewRun[] = followed
      ? [
          {
            id: followed.id,
            prompt: followed.prompt,
            startedAt: followed.startedAt,
            state: followed.shownState(),
            endedAt: followed.endedAt(),
          },
        ]
      : [];
    return crewsOf([...live, ...listed]);
  });

  constructor() {
    effect(() => {
      if (this.store.isAvailable()) untracked(() => this.askOnce());
    });
  }

  isSending(repo: string, number: number): boolean {
    return this.sendingKey() === crewKey(repo, number);
  }

  refusalFor(repo: string, number: number): string | null {
    const refusal = this.refusal();
    return refusal?.key === crewKey(repo, number) ? refusal.text : null;
  }

  /** Sends a crew to pull request `number`: the API writes its instructions,
   *  and the runner starts them as it starts any confirmed task. */
  send(repo: string, number: number): void {
    if (!this.isAvailable() || this.sendingKey() || this.store.isLive()) return;
    const key = crewKey(repo, number);
    this.sendingKey.set(key);
    this.refusal.set(null);
    this.api
      .propose(repo, number)
      .pipe(
        switchMap((request) => this.store.start(request)),
        finalize(() => this.sendingKey.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: (error: unknown) => this.refuse(key, error) });
  }

  /** Puts crew `crew`'s run in Home's task panel, for its log. */
  showLog(crew: Crew): void {
    if (crew.runId !== this.store.followed()?.id) this.dock.pick(crew.runId);
    this.dock.show();
  }

  private askOnce(): void {
    if (this.hasAsked) return;
    this.hasAsked = true;
    this.api
      .isAvailable()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isAvailable) => this.hasRunner.set(isAvailable));
    void this.store.refresh();
  }

  private refuse(key: string, error: unknown): void {
    const isBusy = statusOf(error) === RUNNER_BUSY;
    this.refusal.set({
      key,
      text: isBusy ? BUSY_TEXT : `The crew couldn’t launch: ${messageOf(error)}.`,
    });
    if (isBusy) void this.store.refresh();
  }
}
