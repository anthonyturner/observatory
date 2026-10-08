import { MilestonesState } from '../../core/milestones/milestones-feed';
import {
  DAY_MS,
  DueState,
  Milestone,
  MilestonesReport,
  dueStateOf,
} from '../../core/milestones/milestones-report';
import { plural } from '../../shared/text/plural';
import { PageMessage } from '../releases/releases-page/releases-words';
import { MAX_LANES } from './transit-sky/transit-lanes';

/* How the Milestones screen names a milestone, its progress and its date. */

/** The legend's name for each due state. */
export const DUE_WORDS: Readonly<Record<DueState, string>> = {
  later: 'on its way',
  soon: 'due this week',
  overdue: 'overdue',
  done: 'all done',
  'open-ended': 'no due date',
};

/** "12 Oct": a due date as GitHub keeps it, a day with no time, so read in UTC. */
export const dayWords = (at: number): string =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

const daysWords = (days: number): string => plural(Math.max(1, days), 'day');

/** "due 12 Oct, in 4 days", "due 1 Oct, 7 days overdue", "due 8 Oct, today", "no due date". */
export function dueWords(milestone: Milestone, now: number): string {
  const { dueOn } = milestone;
  if (dueOn === null) return 'no due date';
  const due = `due ${dayWords(dueOn)}`;
  if (now >= dueOn + DAY_MS)
    return `${due}, ${daysWords(Math.floor((now - dueOn) / DAY_MS))} overdue`;
  return dueOn > now
    ? `${due}, in ${daysWords(Math.ceil((dueOn - now) / DAY_MS))}`
    : `${due}, today`;
}

/** "7 of 12 done", or "nothing on it yet". */
export function progressWords(milestone: Milestone): string {
  const total = milestone.open + milestone.closed;
  return total ? `${milestone.closed} of ${total} done` : 'nothing on it yet';
}

/** "Launch: 9 of 10 done, due 12 Oct, in 4 days. Opens it on GitHub." */
export function milestoneSpoken(milestone: Milestone, now: number): string {
  const state: DueState = dueStateOf(milestone, now);
  const standing = state === 'done' ? 'all done' : dueWords(milestone, now);
  return `${milestone.title}: ${progressWords(milestone)}, ${standing}. Opens it on GitHub.`;
}

/** What to say while there is no report to draw, or null once there is one. */
export function stateMessage(state: MilestonesState): PageMessage | null {
  switch (state.status) {
    case 'reading':
      return { headline: 'Reading the milestones…' };
    case 'missing':
      return { headline: 'No such project', detail: 'It may be private, or the name is wrong.' };
    case 'unreachable':
      return {
        headline: 'Could not read the milestones',
        detail: 'GitHub or the API did not answer. Try again in a moment.',
      };
    case 'ready':
      return null;
  }
}

/** What to say over a sky with no open milestone in it, or null when it has one. */
export function emptyMessage(report: MilestonesReport): PageMessage | null {
  const { note, open, closed } = report.milestones;
  if (open.length) return null;
  if (note) return { headline: 'Could not read the milestones', detail: note };
  if (closed.length) {
    return {
      headline: 'No open milestones',
      detail: `${plural(closed.length, 'milestone')} closed lately: see List.`,
    };
  }
  return {
    headline: 'No milestones',
    detail: 'This project does not use milestones.',
  };
}

/** How to read the sky, and how many it leaves to the list; null with nothing in it. */
export function skyNote(report: MilestonesReport): string | null {
  const { open } = report.milestones;
  if (!open.length) return null;
  const reading =
    'Each planet is a milestone, as far along its lane as its work is done, toward its due date.';
  const hidden = open.length - MAX_LANES;
  return hidden > 0
    ? `${reading} The sky shows the first ${MAX_LANES} of ${open.length}; List shows them all.`
    : reading;
}

/** "me/app · 3 open milestones". */
export function milestonesStamp(repo: string, report: MilestonesReport | null): string {
  return report ? `${repo} · ${plural(report.milestones.open.length, 'open milestone')}` : repo;
}

/** What to say in place of the discussions, or null when there are some to list. */
export function discussionsNote(report: MilestonesReport): string | null {
  const { note, isEnabled, threads } = report.discussions;
  if (note) return note;
  if (!isEnabled) return 'Discussions are off for this project.';
  return threads.length ? null : 'No discussions yet.';
}
