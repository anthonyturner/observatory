import { isCount, isObject, isString } from './pull-detail-parts';

/** What `GET /api/commit` returns: one commit's diff, cut to fit. */
export interface CommitDiff {
  readonly sha: string;
  /** The unified diff; empty when the commit changes no file's content. */
  readonly diff: string;
  /** How long the diff was before it was cut to fit. */
  readonly diffBytes: number;
  readonly diffTruncated: boolean;
  /** The preview withholds a private repository's code. */
  readonly diffHidden: boolean;
}

/** Reads the answer defensively; one without a hash and a diff is no answer. */
export function parseCommitDiff(value: unknown): CommitDiff | null {
  if (!isObject(value) || !isString(value['sha']) || !isString(value['diff'])) return null;
  const { diffBytes } = value;
  return {
    sha: value['sha'],
    diff: value['diff'],
    diffBytes: isCount(diffBytes) ? diffBytes : 0,
    diffTruncated: value['diffTruncated'] === true,
    diffHidden: value['diffHidden'] === true,
  };
}
