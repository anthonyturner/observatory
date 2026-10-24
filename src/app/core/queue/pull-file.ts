import { DiffFile } from './diff-files';
import { isCount, isObject, isString } from './pull-detail-parts';

export type PullFileState = 'shown' | 'hidden' | 'too-large' | 'missing' | 'binary';

const STATES: ReadonlySet<unknown> = new Set<PullFileState>([
  'shown',
  'hidden',
  'too-large',
  'missing',
  'binary',
]);

const isState = (value: unknown): value is PullFileState => STATES.has(value);

/** What `GET /api/pull-file` returns: one file of a pull request at one commit. */
export interface PullFile {
  readonly path: string;
  /** The commit the text and the changes are both from. */
  readonly sha: string;
  /** The pull request's head now, later than `sha` once commits are pushed. */
  readonly headOid: string;
  readonly state: PullFileState;
  /** Empty unless the state is `shown`. */
  readonly text: string;
  /** The file's size at `sha`, whether or not its text is carried. */
  readonly bytes: number;
  /** The file's section of the pull request's diff up to `sha`; empty when it has none. */
  readonly patch: string;
  /** GitHub would not give the diff, so an empty `patch` does not mean the file has no changes. */
  readonly changesUnavailable: boolean;
  /** The file at `sha` on GitHub, or the pull request where the file is missing. */
  readonly githubUrl: string;
}

/** Reads the answer defensively; one without a commit, a state and its text is no answer. */
export function parsePullFile(value: unknown): PullFile | null {
  if (!isObject(value)) return null;
  const { path, sha, headOid, state, text, bytes, patch, githubUrl } = value;
  if (!isString(path) || !isString(sha) || !isString(text) || !isState(state)) return null;
  return {
    path,
    sha,
    headOid: isString(headOid) ? headOid : sha,
    state,
    text,
    bytes: isCount(bytes) ? bytes : 0,
    patch: isString(patch) ? patch : '',
    changesUnavailable: value['changesUnavailable'] === true,
    githubUrl: isString(githubUrl) ? githubUrl : '',
  };
}

/** Which pull request's files a diff links to, and the commit its diff is of. */
export interface PullFileTarget {
  /** `owner/name`. */
  readonly repo: string;
  readonly number: number;
  readonly sha: string;
}

/**
 * The address of the whole-file page for a file of a diff, or null when it has none: there is
 * no target, the file is binary or deleted, or git did not give its path in plain text.
 */
export function pullFileLinkOf(target: PullFileTarget | null, file: DiffFile): string | null {
  if (!target || file.newPath === null || file.isBinary || file.isDeleted) return null;
  const query = new URLSearchParams({ sha: target.sha, path: file.newPath });
  return `/p/${target.repo}/pull/${target.number}/file?${query}`;
}
