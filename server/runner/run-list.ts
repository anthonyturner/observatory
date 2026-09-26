import type { ClaudeRun, RunSummary } from './claude-run.ts';

/** What `GET /api/runs` answers: the run going now, and the last few, newest first. */
export interface RunsReport {
  readonly current: RunSummary | null;
  readonly recent: readonly RunSummary[];
}

/** The run going now, if any, and the last `recent` that ended. */
export class RunList {
  private readonly runs = new Map<string, ClaudeRun>();
  private live: ClaudeRun | null = null;

  private readonly recent: number;

  constructor(recent: number) {
    this.recent = recent;
  }

  get current(): ClaudeRun | null {
    return this.live;
  }

  find(id: string): ClaudeRun | undefined {
    return this.runs.get(id);
  }

  /** `run` is the one going now. */
  add(run: ClaudeRun): void {
    this.runs.set(run.id, run);
    this.live = run;
  }

  /** `run` has ended; the oldest ended runs past `recent` are forgotten. */
  ended(run: ClaudeRun): void {
    if (this.live === run) this.live = null;
    const ended = [...this.runs.values()].filter((each) => each.isEnded);
    for (const old of ended.slice(0, Math.max(0, ended.length - this.recent))) {
      this.runs.delete(old.id);
    }
  }

  report(): RunsReport {
    return {
      current: this.live?.summary() ?? null,
      recent: [...this.runs.values()]
        .filter((run) => run !== this.live)
        .reverse()
        .map((run) => run.summary()),
    };
  }
}
