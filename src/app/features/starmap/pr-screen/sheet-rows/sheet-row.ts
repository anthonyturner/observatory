import { PullDetail } from '../../../../core/queue/pull-detail';
import { resultClass } from '../sheet-view';

/** One piece of a row, with pr-starmap's classes for how it looks. */
export interface RowCell {
  readonly text: string;
  readonly classes: string;
}

export interface SheetRow {
  readonly key: string;
  readonly cells: readonly RowCell[];
}

export function fileRows(detail: PullDetail): SheetRow[] {
  return detail.files.map((file) => ({
    key: file.path,
    cells: [
      { text: file.path, classes: 'grow mono' },
      { text: file.change.toLowerCase(), classes: 'dim' },
      { text: `+${file.additions}`, classes: 'plus' },
      { text: `−${file.deletions}`, classes: 'minus' },
    ],
  }));
}

/** Newest first, each with its short hash and the day it was committed. */
export function commitRows(detail: PullDetail, locale?: string): SheetRow[] {
  return detail.commits
    .slice()
    .reverse()
    .map((commit) => ({
      key: commit.sha,
      cells: [
        { text: commit.oid, classes: 'mono dim' },
        { text: commit.headline, classes: 'grow' },
        { text: new Date(commit.date).toLocaleDateString(locale), classes: 'dim' },
      ],
    }));
}

const FLAKY_CELL: RowCell = { text: 'flaky', classes: 'flaky' };

/** Each check and its result, a failure known to be flaky marked so. */
export function checkRows(detail: PullDetail, flaky: readonly string[] = []): SheetRow[] {
  return detail.checks.map((check, index) => {
    const tone = resultClass(check.result);
    const result = { text: check.result.toLowerCase(), classes: `mono ${tone}` };
    const isFlaky = tone === 'bad' && flaky.includes(check.run);
    return {
      key: `${index}:${check.run}`,
      cells: [{ text: check.run, classes: 'grow' }, ...(isFlaky ? [FLAKY_CELL] : []), result],
    };
  });
}

/** Said above the commits when only the latest are listed. */
export function commitsNote(detail: PullDetail): string | null {
  return detail.commitsTotal > detail.commits.length
    ? `Showing the latest ${detail.commits.length} of ${detail.commitsTotal}.`
    : null;
}
