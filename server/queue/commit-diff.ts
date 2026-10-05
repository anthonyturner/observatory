import { BadRequest } from '../http/api-handler.ts';
import type { PullExtras } from './pull-detail.ts';
import { fitDiff } from './pull-size.ts';

/** What `GET /api/commit` returns: one commit's diff, cut to fit like a pull request's. */
export interface CommitDiff {
  readonly sha: string;
  /** The unified diff; empty when the commit changes no file's content. */
  readonly diff: string;
  /** How long the diff was before it was cut to fit. */
  readonly diffBytes: number;
  readonly diffTruncated: boolean;
  /** The preview withholds a private repository's code. */
  readonly diffHidden: boolean;
  readonly fetchedAt: string;
}

/** A full hash or one GitHub can still resolve. Only hex, so nothing that looks
 *  like an option or a path reaches `gh` or the URL. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

/** A commit hash from a request, lower case, or a BadRequest saying what is wrong. */
export function commitShaFrom(value: string | null): string {
  if (!value) throw new BadRequest('sha is required');
  if (!COMMIT_SHA.test(value)) throw new BadRequest('sha must be 7 to 40 hex characters');
  return value.toLowerCase();
}

export function commitDiffOf(sha: string, extras: PullExtras): CommitDiff {
  return fitDiff({
    sha,
    diff: extras.diff,
    diffBytes: extras.diff.length,
    diffTruncated: false,
    diffHidden: false,
    fetchedAt: extras.fetchedAt,
  });
}
