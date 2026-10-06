import { AgentsReport } from '../agents/agents-report';
import { PULL_BUCKETS, PullBucket } from '../projects/projects-report';
import { median } from '../stats/median';
import { Frame } from './history-report';
import { FinishedPull } from './ledger';

const HOUR_MS = 3_600_000;
export const WEEK_MS = 7 * 24 * HOUR_MS;
/** Eight weeks fit inside the ledger's sixty days. */
export const RETRO_WEEKS = 8;
/** The row for finished pull requests no agent's handoff claims. */
export const NO_HANDOFF = 'no handoff recorded';

/** Seven days, from just after `start` up to and including `end`, in ms. */
export interface RetroWeek {
  readonly start: number;
  readonly end: number;
}

/** One week's merges and closes, and how long its merges took. */
export interface CycleWeek extends RetroWeek {
  readonly merged: number;
  readonly closed: number;
  /** Opened to merged, in hours, or null when nothing merged. */
  readonly medianCycleHours: number | null;
}

/** How long the finished pull requests sat in one of the queue's buckets. */
export interface BucketWait {
  readonly bucket: PullBucket;
  readonly hours: number;
  readonly pulls: number;
}

/** Where the week's finished pull requests waited, as far as the frames saw. */
export interface Waits {
  readonly buckets: readonly BucketWait[];
  /** How many of them any frame saw open. */
  readonly observed: number;
  readonly finished: number;
  /** When the oldest frame was recorded, or null with none. */
  readonly since: number | null;
}

/** One agent's finished pull requests in a week. */
export interface AgentWeek {
  readonly agent: string;
  readonly merged: number;
  readonly closed: number;
  readonly medianCycleHours: number | null;
}

/** The `count` weeks ending at `now`, oldest first. */
export function retroWeeks(now: number, count = RETRO_WEEKS): RetroWeek[] {
  return Array.from({ length: count }, (_, index) => {
    const end = now - (count - 1 - index) * WEEK_MS;
    return { start: end - WEEK_MS, end };
  });
}

export const finishedIn = (
  finished: readonly FinishedPull[],
  week: RetroWeek,
): readonly FinishedPull[] =>
  finished.filter((pull) => pull.finishedAt > week.start && pull.finishedAt <= week.end);

const cycleHours = (pull: FinishedPull): number => (pull.finishedAt - pull.openedAt) / HOUR_MS;

const merges = (pulls: readonly FinishedPull[]): readonly FinishedPull[] =>
  pulls.filter((pull) => pull.fate === 'merged');

/** Each week's merges and closes, with the median time from opened to merged. */
export function cycleWeeks(
  finished: readonly FinishedPull[],
  weeks: readonly RetroWeek[],
): CycleWeek[] {
  return weeks.map((week) => {
    const pulls = finishedIn(finished, week);
    const merged = merges(pulls);
    return {
      ...week,
      merged: merged.length,
      closed: pulls.length - merged.length,
      medianCycleHours: median(merged.map(cycleHours)),
    };
  });
}

/**
 * How long `finished` sat in each bucket, read from the queue's frames. GitHub
 * keeps no history of mergeability or of a failing check's span, so a bucket a
 * frame saw is taken to hold until the next frame, or until the pull request
 * finished if that came first. Time before the oldest frame is not counted.
 */
export function whereTheyWaited(
  frames: readonly Frame[],
  finished: readonly FinishedPull[],
): Waits {
  const byNumber = new Map(finished.map((pull) => [pull.number, pull]));
  const hours = new Map<PullBucket, number>();
  const seen = new Map<PullBucket, Set<number>>();
  frames.forEach((frame, index) => {
    const from = Date.parse(frame.at);
    const next = frames[index + 1];
    for (const item of frame.items) {
      const pull = byNumber.get(item.number);
      if (!pull) continue;
      const to = Math.min(next ? Date.parse(next.at) : pull.finishedAt, pull.finishedAt);
      const span = to - Math.max(from, pull.openedAt);
      if (span <= 0) continue;
      hours.set(item.bucket, (hours.get(item.bucket) ?? 0) + span / HOUR_MS);
      seen.set(item.bucket, (seen.get(item.bucket) ?? new Set()).add(item.number));
    }
  });
  const observed = new Set([...seen.values()].flatMap((numbers) => [...numbers]));
  return {
    buckets: PULL_BUCKETS.map((bucket) => ({
      bucket,
      hours: hours.get(bucket) ?? 0,
      pulls: seen.get(bucket)?.size ?? 0,
    })),
    observed: observed.size,
    finished: finished.length,
    since: frames.length ? Date.parse(frames[0].at) : null,
  };
}

/** Pull request number to the agent whose card claims it. */
const agentOf = (report: AgentsReport | null): ReadonlyMap<number, string> =>
  new Map(
    (report?.agents ?? []).flatMap((card) => card.prs.map((pr) => [pr, card.agent] as const)),
  );

/** Each agent's merges and closes among `finished`, busiest first; those no
 *  handoff claims share one row. */
export function agentWeeks(
  report: AgentsReport | null,
  finished: readonly FinishedPull[],
): AgentWeek[] {
  const who = agentOf(report);
  const byAgent = new Map<string, FinishedPull[]>();
  for (const pull of finished) {
    const agent = who.get(pull.number) ?? NO_HANDOFF;
    byAgent.set(agent, [...(byAgent.get(agent) ?? []), pull]);
  }
  return [...byAgent]
    .map(([agent, pulls]) => {
      const merged = merges(pulls);
      return {
        agent,
        merged: merged.length,
        closed: pulls.length - merged.length,
        medianCycleHours: median(merged.map(cycleHours)),
      };
    })
    .sort(
      (a, b) =>
        Number(a.agent === NO_HANDOFF) - Number(b.agent === NO_HANDOFF) ||
        b.merged - a.merged ||
        b.closed - a.closed ||
        a.agent.localeCompare(b.agent),
    );
}
