import { DoneItem } from '../../../core/queue/done-work';
import { QueueItem } from '../../../core/queue/queue-report';
import { SkyItem, costOf } from '../engine/sky-model';
import { isWorkable, rankOf } from '../next-star';
import { skyItemOf } from '../sky-items';

/** The sprint lengths on offer, in minutes. */
export const SPRINT_LENGTHS = [15, 25, 45] as const;
export type SprintLength = (typeof SPRINT_LENGTHS)[number];

/** Reading the description, the checks and the linked issue before the diff. */
const SETUP_MINUTES = 2;
/** A careful review covers about 500 changed lines an hour; past that rate
 *  reviewers start missing defects (SmartBear's study of Cisco's reviews). */
const LINES_PER_HOUR = 500;
const MINUTES_PER_HOUR = 60;

/** A pull request the sprint takes on, and the time it is budgeted. */
export interface SprintPick {
  readonly pr: number;
  readonly title: string;
  /** Lines added plus lines deleted. */
  readonly lines: number;
  readonly minutes: number;
}

/** A sprint length and the pull requests that fill it. */
export interface SprintOption {
  readonly minutes: SprintLength;
  readonly picks: readonly SprintPick[];
}

/** Where a sprint's pull request stands; one still open when the sprint ends was skipped. */
export type SprintMark = 'merged' | 'reviewed' | 'open';

export interface SprintRow extends SprintPick {
  readonly mark: SprintMark;
}

export interface SprintSummary {
  readonly merged: readonly SprintRow[];
  readonly reviewed: readonly SprintRow[];
  readonly skipped: readonly SprintRow[];
}

/**
 * The minutes a review of `item` is budgeted: a fixed setup, then its lines
 * changed at a careful reading pace. Null when GitHub has not said its size.
 */
export function reviewMinutes(item: SkyItem): number | null {
  const lines = costOf(item);
  return lines === null ? null : SETUP_MINUTES + (lines * MINUTES_PER_HOUR) / LINES_PER_HOUR;
}

/**
 * The pull requests a sprint of `minutes` takes on: workable ones in queue
 * order, blocked first, with `first` (Next star's pick) leading. Each joins
 * when its review still fits the time left; a larger one is passed over for
 * smaller ones after it. One of unknown size is never taken.
 */
export function fillSprint(
  items: readonly QueueItem[],
  minutes: number,
  first: number | null,
): SprintPick[] {
  const picks: SprintPick[] = [];
  let left = minutes;
  for (const item of sprintOrder(items, first)) {
    const needs = reviewMinutes(item);
    if (needs === null || needs > left) continue;
    picks.push({ pr: item.pr, title: item.title, lines: costOf(item) ?? 0, minutes: needs });
    left -= needs;
  }
  return picks;
}

/** Every sprint length, each filled from the queue. */
export function sprintOptions(
  items: readonly QueueItem[],
  first: number | null,
): readonly SprintOption[] {
  return SPRINT_LENGTHS.map((minutes) => ({ minutes, picks: fillSprint(items, minutes, first) }));
}

function sprintOrder(items: readonly QueueItem[], first: number | null): SkyItem[] {
  const queue = items
    .filter(isWorkable)
    .map(skyItemOf)
    .sort((a, b) => rankOf(a) - rankOf(b));
  const lead = queue.find((item) => item.pr === first);
  return lead ? [lead, ...queue.filter((item) => item !== lead)] : queue;
}

/** The pull requests the ledger has seen merged. */
export const mergedOf = (done: readonly DoneItem[]): ReadonlySet<number> =>
  new Set(done.filter((item) => item.kind === 'merged').map((item) => item.number));

/** Each pick with where it stands: merged beats reviewed. */
export function sprintRows(
  picks: readonly SprintPick[],
  reviewed: ReadonlySet<number>,
  merged: ReadonlySet<number>,
): SprintRow[] {
  return picks.map((pick) => ({
    ...pick,
    mark: merged.has(pick.pr) ? 'merged' : reviewed.has(pick.pr) ? 'reviewed' : 'open',
  }));
}

/** What a finished sprint cleared, in sprint order within each group. */
export function sprintSummary(rows: readonly SprintRow[]): SprintSummary {
  return {
    merged: rows.filter((row) => row.mark === 'merged'),
    reviewed: rows.filter((row) => row.mark === 'reviewed'),
    skipped: rows.filter((row) => row.mark === 'open'),
  };
}
