import { QueueBucket } from '../queue/queue-report';
import { RUN_WORDS, RunShownState } from '../runs/run-words';
import { RunSummary } from '../runs/runs.types';
import { crewKey, crewTargetOf } from './crew-tag';
import { Crew, CrewMark, CrewPhase, CrewTask } from './crew.types';

/** A run as the crew roster reads it, from the runner's list or the run followed. */
export interface CrewRun {
  readonly id: string;
  readonly prompt: string;
  readonly startedAt: number;
  readonly state: RunShownState;
  readonly endedAt: number | null;
}

/** What a pull request's crew controls show, from where things stand. */
export interface CrewContext {
  readonly task: CrewTask | null;
  readonly crew: Crew | null;
  readonly isSending: boolean;
  /** Any task is running on this machine: the runner takes one at a time. */
  readonly isRunnerBusy: boolean;
  readonly refusal: string | null;
}

export interface CrewSend {
  readonly label: string;
  readonly isDisabled: boolean;
  readonly hint: string;
}

export interface CrewStatus {
  readonly text: string;
  readonly tone: 'live' | 'ok' | 'bad';
}

/** A pull request's crew controls: the button, the crew's status, and why a send failed. */
export interface CrewView {
  readonly send: CrewSend | null;
  readonly status: CrewStatus | null;
  readonly refusal: string | null;
}

const TASKS: Readonly<Partial<Record<QueueBucket, CrewTask>>> = {
  conflicted: 'update-branch',
  failing: 'fix-checks',
};

const TASK_HINTS: Readonly<Record<CrewTask, string>> = {
  'update-branch':
    'A crew merges the base into this branch, resolves the conflicts and pushes. It never merges the pull request.',
  'fix-checks':
    'A crew reads the failed checks, fixes them and pushes to this branch. It never merges the pull request.',
};

const LIVE_STATES: ReadonlySet<RunShownState> = new Set<RunShownState>([
  'starting',
  'running',
  'stopping',
  'reconnecting',
  'lost',
]);

const CREW_OUT: CrewSend = {
  label: 'Crew out',
  isDisabled: true,
  hint: 'A crew is already working on this pull request: one crew at a time.',
};
const SENDING: CrewSend = { label: 'Sending crew…', isDisabled: true, hint: 'Launching the crew.' };
const RUNNER_BUSY: CrewSend = {
  label: 'Send crew',
  isDisabled: true,
  hint: 'Another task is running on this machine. A crew can launch once it ends.',
};

/** The crew's task for a pull request in `bucket`, or null when it needs none. */
export const crewTaskOf = (bucket: QueueBucket | null): CrewTask | null =>
  bucket ? (TASKS[bucket] ?? null) : null;

/** A run still going is at work; one that ended cleanly is back, done; any other ending failed. */
export function crewPhaseOf(state: RunShownState): CrewPhase {
  if (LIVE_STATES.has(state)) return 'working';
  return state === 'done' ? 'succeeded' : 'failed';
}

/** A runner's summary as the roster reads it: a clean exit with Claude Code's own error is no success. */
export const crewRunOf = (summary: RunSummary): CrewRun => ({
  id: summary.id,
  prompt: summary.prompt,
  startedAt: summary.startedAt,
  state: summary.state === 'done' && summary.result?.error ? 'errored' : summary.state,
  endedAt: summary.endedAt,
});

/** Each pull request's newest crew, from `runs`; where a run is listed twice, its first entry wins. */
export function crewsOf(runs: readonly CrewRun[]): Crew[] {
  const seen = new Set<string>();
  const newest = new Map<string, Crew>();
  for (const run of runs) {
    if (seen.has(run.id)) continue;
    seen.add(run.id);
    const target = crewTargetOf(run.prompt);
    if (!target) continue;
    const key = crewKey(target.repo, target.number);
    const known = newest.get(key);
    if (known && known.startedAt >= run.startedAt) continue;
    newest.set(key, {
      ...target,
      runId: run.id,
      phase: crewPhaseOf(run.state),
      state: run.state,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
    });
  }
  return [...newest.values()];
}

/** The crew sent to pull request `number` in `repo`, or null. */
export const crewFor = (crews: readonly Crew[], repo: string, number: number): Crew | null =>
  crews.find((crew) => crewKey(crew.repo, crew.number) === crewKey(repo, number)) ?? null;

/** The crews in `repo`, as the sky draws them. */
export const crewMarksOf = (crews: readonly Crew[], repo: string): CrewMark[] =>
  crews
    .filter((crew) => crew.repo.toLowerCase() === repo.toLowerCase())
    .map((crew) => ({ pr: crew.number, phase: crew.phase, endedAt: crew.endedAt }));

function sendOf(context: CrewContext): CrewSend | null {
  if (context.crew?.phase === 'working') return CREW_OUT;
  if (!context.task) return null;
  if (context.isSending) return SENDING;
  if (context.isRunnerBusy) return RUNNER_BUSY;
  return { label: 'Send crew', isDisabled: false, hint: TASK_HINTS[context.task] };
}

function statusOf(crew: Crew): CrewStatus {
  const words = RUN_WORDS[crew.state];
  if (crew.phase === 'working') return { text: `Crew at work · ${words}`, tone: 'live' };
  if (crew.phase === 'succeeded') return { text: 'Crew back: done', tone: 'ok' };
  return { text: `Crew back: ${words.toLowerCase()}`, tone: 'bad' };
}

/** What a pull request's crew controls show; null when it has no crew and needs none. */
export function crewViewOf(context: CrewContext): CrewView | null {
  if (!context.task && !context.crew) return null;
  return {
    send: sendOf(context),
    status: context.crew ? statusOf(context.crew) : null,
    refusal: context.refusal,
  };
}
