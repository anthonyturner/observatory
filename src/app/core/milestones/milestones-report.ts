import { gitHubLinkOf, timeOf } from '../actions/actions-report';
import { isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';

/** How an issue or pull request on a milestone stands. */
export type MilestoneItemState = 'open' | 'closed' | 'merged';
const ITEM_STATES: readonly MilestoneItemState[] = ['open', 'closed', 'merged'];

/** One issue or pull request on a milestone. */
export interface MilestoneItem {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly isPull: boolean;
  readonly state: MilestoneItemState;
}

export interface Milestone {
  readonly number: number;
  readonly title: string;
  readonly description: string | null;
  readonly url: string;
  readonly isOpen: boolean;
  /** Milliseconds since the epoch: the start of the day it is due, as GitHub keeps it. */
  readonly dueOn: number | null;
  readonly closedAt: number | null;
  /** Its open issues and pull requests. */
  readonly open: number;
  /** Its closed issues, and merged or closed pull requests. */
  readonly closed: number;
  /** The open ones first; past a limit, only the most recent. */
  readonly items: readonly MilestoneItem[];
}

export interface DiscussionThread {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly category: string;
  /** Its category takes an answer, as Q&A does. */
  readonly isAnswerable: boolean;
  readonly isAnswered: boolean;
  readonly comments: number;
  readonly author: string | null;
  readonly updatedAt: number;
}

export interface MilestonesPart {
  /** Why GitHub gave none; null when it answered. */
  readonly note: string | null;
  /** Soonest due first; those with no due date last. Past a limit, only the first. */
  readonly open: readonly Milestone[];
  /** Every open milestone, past the ones listed. */
  readonly openCount: number;
  /** Most lately closed first. */
  readonly closed: readonly Milestone[];
}

export interface DiscussionsPart {
  /** Why GitHub gave none; null when it answered. */
  readonly note: string | null;
  readonly isEnabled: boolean;
  /** Every discussion the repository has, past the ones listed. */
  readonly total: number;
  /** Most recently active first. */
  readonly threads: readonly DiscussionThread[];
}

/** What `GET /api/milestones` returns. */
export interface MilestonesReport {
  readonly generatedAt: number;
  readonly repo: string;
  readonly milestones: MilestonesPart;
  readonly discussions: DiscussionsPart;
}

const isItemState = oneOf(ITEM_STATES);
const textOrNull = (value: unknown): string | null => (isText(value) ? value : null);
const countOf = (value: unknown): number => (isNumber(value) && value > 0 ? value : 0);

function parseItem(value: unknown): MilestoneItem | null {
  if (!isObject(value)) return null;
  const { number, title, state } = value;
  const url = gitHubLinkOf(value['url']);
  if (!isNumber(number) || !isText(title) || !isItemState(state) || !url) return null;
  return { number, title, url, isPull: value['isPull'] === true, state };
}

function parseMilestone(value: unknown): Milestone | null {
  if (!isObject(value)) return null;
  const { number, title } = value;
  const url = gitHubLinkOf(value['url']);
  if (!isNumber(number) || !isText(title) || !url) return null;
  return {
    number,
    title,
    description: textOrNull(value['description']),
    url,
    isOpen: value['isOpen'] === true,
    dueOn: timeOf(value['dueOn']),
    closedAt: timeOf(value['closedAt']),
    open: countOf(value['open']),
    closed: countOf(value['closed']),
    items: listOf(value['items'], parseItem),
  };
}

function parseThread(value: unknown): DiscussionThread | null {
  if (!isObject(value)) return null;
  const { number, title, category } = value;
  const url = gitHubLinkOf(value['url']);
  const updatedAt = timeOf(value['updatedAt']);
  if (!isNumber(number) || !isText(title) || !isText(category) || !url || updatedAt === null) {
    return null;
  }
  return {
    number,
    title,
    url,
    category,
    isAnswerable: value['isAnswerable'] === true,
    isAnswered: value['isAnswered'] === true,
    comments: countOf(value['comments']),
    author: textOrNull(value['author']),
    updatedAt,
  };
}

const UNREAD_MILESTONES: MilestonesPart = {
  note: 'The milestones could not be read.',
  open: [],
  openCount: 0,
  closed: [],
};

function parseMilestonesPart(value: unknown): MilestonesPart {
  if (!isObject(value)) return UNREAD_MILESTONES;
  const open = listOf(value['open'], parseMilestone);
  return {
    note: textOrNull(value['note']),
    open,
    openCount: Math.max(countOf(value['openCount']), open.length),
    closed: listOf(value['closed'], parseMilestone),
  };
}

const UNREAD_DISCUSSIONS: DiscussionsPart = {
  note: 'The discussions could not be read.',
  isEnabled: false,
  total: 0,
  threads: [],
};

function parseDiscussionsPart(value: unknown): DiscussionsPart {
  if (!isObject(value)) return UNREAD_DISCUSSIONS;
  const threads = listOf(value['threads'], parseThread);
  return {
    note: textOrNull(value['note']),
    isEnabled: value['isEnabled'] === true,
    total: Math.max(countOf(value['total']), threads.length),
    threads,
  };
}

/** The report, checked field by field, or null when the answer is not one. */
export function parseMilestonesReport(body: unknown): MilestonesReport | null {
  if (!isObject(body) || !isText(body['repo'])) return null;
  const generatedAt = timeOf(body['generatedAt']);
  if (generatedAt === null) return null;
  return {
    generatedAt,
    repo: body['repo'],
    milestones: parseMilestonesPart(body['milestones']),
    discussions: parseDiscussionsPart(body['discussions']),
  };
}

/** How far through a milestone is, 0 to 1: its done items over all of them. */
export function progressOf(milestone: Milestone): number {
  const total = milestone.open + milestone.closed;
  return total ? milestone.closed / total : 0;
}

/**
 * Where a milestone stands against its date: `done` (nothing left open),
 * `overdue` (past the end of its due day), `soon` (due within a week),
 * `later`, or `open-ended` (no due date).
 */
export type DueState = 'done' | 'overdue' | 'soon' | 'later' | 'open-ended';

export const DAY_MS = 86_400_000;
/** Due within this long reads as soon. */
const SOON_MS = 7 * DAY_MS;

export function dueStateOf(milestone: Milestone, now: number): DueState {
  if (milestone.open === 0 && milestone.closed > 0) return 'done';
  if (milestone.dueOn === null) return 'open-ended';
  const dueEnd = milestone.dueOn + DAY_MS;
  if (now >= dueEnd) return 'overdue';
  return dueEnd - now <= SOON_MS ? 'soon' : 'later';
}
