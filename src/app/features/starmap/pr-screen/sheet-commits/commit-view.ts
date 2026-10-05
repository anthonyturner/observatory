import { CommitDiff } from '../../../../core/queue/commit-diff';
import { CommitDiffState } from '../../../../core/queue/commit-diff-feed';

/** What the open commit shows: still reading, unreadable, no changes, or its diff. */
export type CommitShows = 'reading' | 'unreachable' | 'empty' | 'diff';

export interface CommitView {
  readonly shows: CommitShows;
  /** Its short hash, for its label. */
  readonly oid: string;
  /** The commit on GitHub, within its pull request. */
  readonly url: string;
  /** Present once read. */
  readonly commit: CommitDiff | null;
}

const SHORT_OID_LENGTH = 7;

/** A commit that changes nothing has no diff, and is neither cut nor withheld. */
const isEmpty = (commit: CommitDiff): boolean =>
  !commit.diff && !commit.diffTruncated && !commit.diffHidden;

function showsOf(state: CommitDiffState): CommitShows {
  if (state.status !== 'ready') return state.status;
  return isEmpty(state.commit) ? 'empty' : 'diff';
}

/** Which commit is open: its full hash, in which pull request. */
export interface OpenCommit {
  readonly repo: string;
  readonly number: number;
  readonly sha: string;
}

export function commitViewOf(
  state: CommitDiffState,
  { repo, number, sha }: OpenCommit,
): CommitView {
  return {
    shows: showsOf(state),
    oid: sha.slice(0, SHORT_OID_LENGTH),
    url: `https://github.com/${repo}/pull/${number}/commits/${sha}`,
    commit: state.status === 'ready' ? state.commit : null,
  };
}
