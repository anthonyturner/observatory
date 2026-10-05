import { CommitDiff } from '../../../../core/queue/commit-diff';
import { CommitDiffState } from '../../../../core/queue/commit-diff-feed';
import { CommitLine } from '../../../../core/queue/pull-detail';

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

/** A commit that changes nothing has no diff, and is neither cut nor withheld. */
const isEmpty = (commit: CommitDiff): boolean =>
  !commit.diff && !commit.diffTruncated && !commit.diffHidden;

function showsOf(state: CommitDiffState): CommitShows {
  if (state.status !== 'ready') return state.status;
  return isEmpty(state.commit) ? 'empty' : 'diff';
}

/** Which commit is open, in which pull request. */
export interface OpenCommit {
  readonly repo: string;
  readonly number: number;
  readonly commit: CommitLine;
}

export function commitViewOf(
  state: CommitDiffState,
  { repo, number, commit }: OpenCommit,
): CommitView {
  return {
    shows: showsOf(state),
    oid: commit.oid,
    url: `https://github.com/${repo}/pull/${number}/commits/${commit.sha}`,
    commit: state.status === 'ready' ? state.commit : null,
  };
}
