import {
  Milestone,
  MilestoneItem,
  MilestoneItemState,
  dueStateOf,
  progressOf,
} from '../../../core/milestones/milestones-report';
import { plural } from '../../../shared/text/plural';
import { dueColour } from '../milestone-look';
import { DUE_WORDS, dayWords, dueWords, progressWords } from '../milestone-words';

/** A closed milestone is past its date either way, so it takes no due state's colour. */
const CLOSED_COLOUR = 'var(--muted)';

const ITEM_STATE_WORDS: Readonly<Record<MilestoneItemState, string>> = {
  open: 'open',
  closed: 'closed',
  merged: 'merged',
};

/** One issue or pull request on a milestone, as a row. */
export interface ItemRow {
  readonly key: string;
  /** "#12". */
  readonly number: string;
  readonly title: string;
  readonly url: string;
  readonly kind: 'Issue' | 'Pull request';
  readonly isPull: boolean;
  readonly state: string;
  readonly isDone: boolean;
}

/** One milestone as a section of the list. */
export interface MilestoneRow {
  readonly key: string;
  readonly title: string;
  readonly url: string;
  readonly description: string | null;
  /** "7 of 12 done". */
  readonly progress: string;
  /** 0 to 100, for the bar. */
  readonly percent: number;
  /** "due 12 Oct, in 4 days", or "closed 20 Sep". */
  readonly when: string;
  /** "overdue", "due this week": the legend's words for its colour. */
  readonly standing: string;
  readonly colour: string;
  /** "5 open · 7 closed". */
  readonly counts: string;
  /** "12 items", for the fold that lists them. */
  readonly itemCount: string;
  readonly items: readonly ItemRow[];
  /** Items on it past the ones listed, which GitHub shows. */
  readonly unlisted: number;
}

function itemRow(item: MilestoneItem): ItemRow {
  return {
    key: `${item.isPull ? 'pull' : 'issue'}-${item.number}`,
    number: `#${item.number}`,
    title: item.title,
    url: item.url,
    kind: item.isPull ? 'Pull request' : 'Issue',
    isPull: item.isPull,
    state: ITEM_STATE_WORDS[item.state],
    isDone: item.state !== 'open',
  };
}

function whenWords(milestone: Milestone, now: number): string {
  if (!milestone.isOpen) {
    return milestone.closedAt === null ? 'closed' : `closed ${dayWords(milestone.closedAt)}`;
  }
  return dueWords(milestone, now);
}

function milestoneRow(milestone: Milestone, now: number): MilestoneRow {
  const state = dueStateOf(milestone, now);
  const total = milestone.open + milestone.closed;
  return {
    key: String(milestone.number),
    title: milestone.title,
    url: milestone.url,
    description: milestone.description,
    progress: progressWords(milestone),
    percent: Math.round(progressOf(milestone) * 100),
    when: whenWords(milestone, now),
    standing: milestone.isOpen ? DUE_WORDS[state] : 'closed',
    colour: milestone.isOpen ? dueColour(state) : CLOSED_COLOUR,
    counts: `${milestone.open} open · ${milestone.closed} closed`,
    itemCount: plural(total, 'item'),
    items: milestone.items.map(itemRow),
    unlisted: Math.max(0, total - milestone.items.length),
  };
}

/** The milestones as the list shows them, `now` being when the report was made. */
export const milestoneRows = (milestones: readonly Milestone[], now: number): MilestoneRow[] =>
  milestones.map((milestone) => milestoneRow(milestone, now));
