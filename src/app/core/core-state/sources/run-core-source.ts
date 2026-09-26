import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { CoreStateId } from '../../instrument/core-states';
import { RunShownState } from '../../runs/run-words';
import { RunsStore } from '../../runs/runs-store';
import { CORE_RUN_WRITER } from '../core-state-tokens';
import { CoreStateSource } from '../core-state.types';

/** How long the way a task ended stays on the core. */
export const RUN_END_HOLD_MS = 3000;

interface RunEnd {
  readonly state: CoreStateId;
  readonly holdMs: number;
}

const AT_REST: RunEnd = { state: 'idle', holdMs: 0 };
const FAILED: RunEnd = { state: 'error', holdMs: RUN_END_HOLD_MS };

/** What the core does as a task ends, by how it ended. A cancel is the
 *  owner's own doing, so the core simply rests. */
const RUN_ENDS: Partial<Readonly<Record<RunShownState, RunEnd>>> = {
  done: { state: 'answered-3', holdMs: RUN_END_HOLD_MS },
  errored: FAILED,
  failed: FAILED,
  'time-limit': FAILED,
  shutdown: FAILED,
  cancelled: AT_REST,
};

/** A running task on the core: running while it is live, then how it ended. */
@Injectable()
export class RunCoreSource implements CoreStateSource {
  private readonly runs = inject(RunsStore);
  private readonly writer = inject(CORE_RUN_WRITER);
  private readonly injector = inject(Injector);
  private wasLive = false;

  connect(): void {
    effect(
      () => {
        const isLive = this.runs.isLive();
        const ended = this.runs.followed()?.shownState() ?? null;
        untracked(() => this.follow(isLive, ended));
      },
      { injector: this.injector },
    );
  }

  private follow(isLive: boolean, ended: RunShownState | null): void {
    if (isLive === this.wasLive) return;
    this.wasLive = isLive;
    if (isLive) return this.writer.beginRun();
    const end = (ended && RUN_ENDS[ended]) || AT_REST;
    this.writer.endRun(end.state, end.holdMs);
  }
}
