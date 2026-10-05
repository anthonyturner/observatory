import { EditRecord } from '../../../../core/edits/edit-record';
import { CheckLine, PullDetail, ReviewDecision } from '../../../../core/queue/pull-detail';
import { plural } from '../../../../shared/text/plural';
import { resultClass } from '../sheet-view';
import { METHOD_WORDS } from './merge-words';

export type Tone = 'ok' | 'bad' | 'meh';

/** One line of the merge box's checklist. */
export interface StatusRow {
  readonly key: 'draft' | 'conflicts' | 'checks' | 'review';
  readonly tone: Tone;
  readonly text: string;
}

/** What the box shows once nothing is left to merge. */
export interface MergeEnding {
  readonly state: 'merged' | 'closed';
  readonly text: string;
}

export interface MergeBoxView {
  /** Merged or closed: the controls give way to this. */
  readonly ending: MergeEnding | null;
  readonly isDraft: boolean;
  readonly rows: readonly StatusRow[];
  /** Why merging is not offered yet, or null when it is. */
  readonly blockedBy: string | null;
}

/** What GitHub says, and what this screen's own last edit did since it was read. */
export interface MergeSources {
  readonly detail: PullDetail;
  readonly record: EditRecord | null;
}

const CONFLICT_ROWS: Readonly<Record<string, StatusRow>> = {
  MERGEABLE: { key: 'conflicts', tone: 'ok', text: 'No conflicts with the base branch' },
  CONFLICTING: { key: 'conflicts', tone: 'bad', text: 'This branch has conflicts to resolve' },
};
const CONFLICTS_UNKNOWN: StatusRow = {
  key: 'conflicts',
  tone: 'meh',
  text: 'GitHub is still checking for conflicts',
};

const REVIEW_ROWS: Readonly<Record<ReviewDecision, StatusRow>> = {
  approved: { key: 'review', tone: 'ok', text: 'Approved' },
  'changes-requested': { key: 'review', tone: 'bad', text: 'Changes requested' },
  'review-required': { key: 'review', tone: 'meh', text: 'Review required' },
  none: { key: 'review', tone: 'ok', text: 'No review required' },
};

const DRAFT_ROW: StatusRow = { key: 'draft', tone: 'meh', text: 'Still a draft' };
const DRAFT_BLOCK = 'Mark it ready for review to merge.';
const CONFLICT_BLOCK = 'Resolve the conflicts to merge.';

export function checksRow(checks: readonly CheckLine[]): StatusRow {
  const total = plural(checks.length, 'check');
  const tones = checks.map((check) => resultClass(check.result));
  const failed = tones.filter((tone) => tone === 'bad').length;
  const running = tones.filter((tone) => tone === 'meh').length;
  if (!checks.length) return { key: 'checks', tone: 'meh', text: 'No checks ran' };
  if (failed) return { key: 'checks', tone: 'bad', text: `${failed} of ${total} failed` };
  if (running) return { key: 'checks', tone: 'meh', text: `${running} of ${total} still running` };
  return { key: 'checks', tone: 'ok', text: `${total} passed` };
}

function endingOf({ detail, record }: MergeSources): MergeEnding | null {
  const mergedWith = record?.mergedWith ?? null;
  if (mergedWith) return { state: 'merged', text: `Merged ✓ via ${METHOD_WORDS[mergedWith].via}` };
  if (detail.state === 'merged') return { state: 'merged', text: 'Merged ✓' };
  if (detail.state === 'closed') return { state: 'closed', text: 'Closed without merging' };
  return null;
}

/** A draft, unless this screen marked it ready after its details were read. */
function isDraftNow({ detail, record }: MergeSources): boolean {
  const readiedAt = record?.readiedAt;
  return detail.isDraft && !(readiedAt && Date.parse(readiedAt) > Date.parse(detail.fetchedAt));
}

function blockOf(isDraft: boolean, mergeable: string): string | null {
  if (isDraft) return DRAFT_BLOCK;
  return mergeable === 'CONFLICTING' ? CONFLICT_BLOCK : null;
}

/** The merge box as GitHub would draw it for this pull request. */
export function mergeBoxOf(sources: MergeSources): MergeBoxView {
  const { detail } = sources;
  const isDraft = isDraftNow(sources);
  const rows = [
    ...(isDraft ? [DRAFT_ROW] : []),
    CONFLICT_ROWS[detail.mergeable] ?? CONFLICTS_UNKNOWN,
    checksRow(detail.checks),
    REVIEW_ROWS[detail.reviewDecision],
  ];
  return {
    ending: endingOf(sources),
    isDraft,
    rows,
    blockedBy: blockOf(isDraft, detail.mergeable),
  };
}
