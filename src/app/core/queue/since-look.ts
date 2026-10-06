import { isCount, isObject, isString } from './pull-detail-parts';

/** What happened to a pull request's head since it was last looked at. */
export interface SinceLook {
  /** Commits pushed on top of the head looked at; null when they cannot be counted,
   *  because the branch was rewritten, as by a force-push. */
  readonly newCommits: number | null;
}

/** What `GET /api/since-look` returns: the changes between the head looked at and the head now. */
export interface SinceLookDiff {
  readonly base: string;
  readonly head: string;
  readonly newCommits: number | null;
  /** Empty when the branch was rewritten, or the diff is too large to carry. */
  readonly diff: string;
  readonly diffBytes: number;
  readonly diffTruncated: boolean;
  /** The preview withholds a private repository's code. */
  readonly diffHidden: boolean;
}

const countOrNull = (value: unknown): number | null => (isCount(value) ? value : null);

/** Null for no change, or for anything that does not read as one. */
export function parseSinceLook(value: unknown): SinceLook | null {
  if (!isObject(value) || !('newCommits' in value)) return null;
  return { newCommits: countOrNull(value['newCommits']) };
}

/** Reads the answer defensively; one without both heads and a diff is no answer. */
export function parseSinceLookDiff(value: unknown): SinceLookDiff | null {
  if (!isObject(value)) return null;
  const { base, head, diff, diffBytes } = value;
  if (!isString(base) || !isString(head) || !isString(diff)) return null;
  return {
    base,
    head,
    newCommits: countOrNull(value['newCommits']),
    diff,
    diffBytes: isCount(diffBytes) ? diffBytes : 0,
    diffTruncated: value['diffTruncated'] === true,
    diffHidden: value['diffHidden'] === true,
  };
}

/** "3 new commits". */
export const newCommitsText = (count: number): string =>
  `${count} new commit${count === 1 ? '' : 's'}`;

/** "3 new commits since you looked", or that it changed when they cannot be counted. */
export function sinceLookLabel({ newCommits }: SinceLook): string {
  if (newCommits === null) return 'Changed since you looked';
  return `${newCommitsText(newCommits)} since you looked`;
}
