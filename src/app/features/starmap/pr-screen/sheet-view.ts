import { PullDetail } from '../../../core/queue/pull-detail';
import { QueueBucket } from '../../../core/queue/queue-report';
import { BUCKET_LOOK } from '../../queue/queue-view';

export const SHEET_TABS = ['overview', 'files', 'commits', 'checks', 'diff', 'edit'] as const;
export type SheetTab = (typeof SHEET_TABS)[number];
/** The tabs for a viewer who may not change the pull request: all but Edit. */
export const READ_TABS: readonly SheetTab[] = SHEET_TABS.filter((tab) => tab !== 'edit');

export const TAB_LABEL: Readonly<Record<SheetTab, string>> = {
  overview: 'Overview',
  files: 'Files',
  commits: 'Commits',
  checks: 'Checks',
  diff: 'Diff',
  edit: 'Edit',
};

/** The small number beside each tab's name; empty for none. */
export type TabCounts = Readonly<Record<SheetTab, string>>;

export const NO_COUNTS: TabCounts = {
  overview: '',
  files: '',
  commits: '',
  checks: '',
  diff: '',
  edit: '',
};

const FAILED = /FAIL|ERROR|TIMED_OUT/;
const PASSED = /SUCCESS|NEUTRAL|SKIPPED/;
const FAILED_MARK = '✕';

/** pr-starmap's colour for a check's result, read from GitHub's own word for it. */
export const resultClass = (result: string): 'ok' | 'bad' | 'meh' =>
  PASSED.test(result) ? 'ok' : FAILED.test(result) ? 'bad' : 'meh';

export function tabCounts(detail: PullDetail): TabCounts {
  const failed = detail.checks.filter((check) => FAILED.test(check.result)).length;
  const total = detail.checks.length;
  return {
    ...NO_COUNTS,
    files: String(detail.changedFiles),
    commits: String(detail.commitsTotal),
    checks: total ? `${failed ? `${failed}${FAILED_MARK} ` : ''}${total}` : '',
  };
}

/** The line under the title: where it merges, whether it can, how big, how fresh. */
export interface Route {
  readonly base: string;
  readonly head: string;
  readonly state: string;
  readonly mergeable: string;
  readonly mergeClass: 'ok' | 'bad' | 'meh';
  readonly additions: string;
  readonly deletions: string;
  readonly fetched: string;
}

/** Merged or closed says so; an open one says whether it is still a draft. */
const stateOf = (detail: PullDetail): string => {
  if (detail.state !== 'open') return detail.state;
  return detail.isDraft ? 'draft' : 'ready for review';
};

const MERGE_CLASS: Readonly<Record<string, 'ok' | 'bad'>> = { MERGEABLE: 'ok', CONFLICTING: 'bad' };

export function routeOf(detail: PullDetail, locale?: string): Route {
  return {
    base: detail.base,
    head: detail.head,
    state: stateOf(detail),
    mergeable: (detail.mergeable || 'unknown').toLowerCase(),
    mergeClass: MERGE_CLASS[detail.mergeable] ?? 'meh',
    additions: `+${detail.additions}`,
    deletions: `−${detail.deletions}`,
    fetched: `fetched ${new Date(detail.fetchedAt).toLocaleString(locale)}`,
  };
}

/** "Vagrans — no issue linked": the bucket's star name and what it means. */
export function kickerOf(bucket: QueueBucket): string {
  const look = BUCKET_LOOK[bucket];
  return `${look.name} — ${look.meaning.toLowerCase()}`;
}

const HEX_COLOUR = /^[0-9a-f]{6}$/i;
const LABEL_FALLBACK = 'var(--muted)';

/** A label's own colour, or grey when GitHub's is not six hex digits. */
export const labelColour = (color: string): string =>
  HEX_COLOUR.test(color) ? `#${color}` : LABEL_FALLBACK;
