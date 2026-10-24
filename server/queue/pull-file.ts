import type { FileRead } from '../github/docs-reader.ts';
import { commitShaFrom } from './commit-diff.ts';
import { pullNumberFrom } from './pull-detail.ts';
import { repoPathFrom } from './repo-path.ts';

/** Where the whole-file page reads a file of a pull request. */
export const PULL_FILE_PATH = '/api/pull-file';

/** The whole-file page shows nothing larger; GitHub's contents answer ends at the same size. */
export const PULL_FILE_MAX_BYTES = 1024 * 1024;

/** Git's own test for a binary file: a NUL byte in the first 8,000. */
const BINARY_PROBE_BYTES = 8000;

export type PullFileState =
  /** The file's text, and the changes the pull request made to it. */
  | 'shown'
  /** The preview withholds a private repository's code. */
  | 'hidden'
  | 'too-large'
  /** No such file at that commit. */
  | 'missing'
  | 'binary';

/** What `GET /api/pull-file` returns: one file of a pull request at one commit. */
export interface PullFile {
  readonly path: string;
  /** The commit the text and the changes are both from. */
  readonly sha: string;
  /** The pull request's head now, which is later than `sha` once commits are pushed. */
  readonly headOid: string;
  readonly state: PullFileState;
  /** Empty unless the state is `shown`. */
  readonly text: string;
  /** The file's size at `sha`, whether or not its text is carried. */
  readonly bytes: number;
  /** The file's section of the pull request's diff up to `sha`; empty when it has no changes
   *  or GitHub would not give the diff. */
  readonly patch: string;
  /** The file at `sha` on GitHub, or the pull request where the file is missing. */
  readonly githubUrl: string;
  readonly fetchedAt: string;
}

/** Which file of which pull request, at which commit. */
export interface PullFileRequest {
  readonly repo: string;
  readonly number: number;
  readonly sha: string;
  readonly path: string;
}

/** Where a pull request stands, as far as reading one of its files needs. */
export interface PullFileSources {
  /** The branch the pull request merges into, and its head now. */
  heads(repo: string, number: number): Promise<{ base: string; headOid: string }>;
  file(repo: string, path: string, sha: string): Promise<FileRead>;
  /** The file's section of the diff from `base` to `sha`; empty when there is none. */
  patch(repo: string, base: string, sha: string, path: string): Promise<string>;
}

/** The request's pull request number, commit and file, or a BadRequest saying what is wrong. */
export function pullFileRequestFrom(repo: string, query: URLSearchParams): PullFileRequest {
  return {
    repo,
    number: pullNumberFrom(query.get('number')),
    sha: commitShaFrom(query.get('sha')),
    path: repoPathFrom(query.get('path')),
  };
}

const FILE_START = /^(?=diff --git )/m;

/** The `diff --git a/old b/new` section whose new path is `path`: a rename lists both, and
 *  only the new one is a file at the head. Empty when the diff has none, as for a path git quotes. */
export function patchOfFile(diff: string, path: string): string {
  const header = ` b/${path}`;
  return (
    diff
      .split(FILE_START)
      .find((part) => part.startsWith('diff --git ') && part.split('\n', 1)[0].endsWith(header)) ??
    ''
  );
}

const isBinary = (bytes: Buffer): boolean => bytes.subarray(0, BINARY_PROBE_BYTES).includes(0);

const encodedPath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

/** One file of a pull request at `request.sha`, with the changes the pull request made to it. */
export async function pullFileOf(
  sources: PullFileSources,
  { repo, number, sha, path }: PullFileRequest,
  fetchedAt: string,
): Promise<PullFile> {
  const [{ base, headOid }, read] = await Promise.all([
    sources.heads(repo, number),
    sources.file(repo, path, sha),
  ]);
  const onGitHub = `https://github.com/${repo}/blob/${sha}/${encodedPath(path)}`;
  const answer = { path, sha, headOid, text: '', bytes: 0, patch: '', fetchedAt };
  if (read.kind === 'missing') {
    return {
      ...answer,
      state: 'missing',
      githubUrl: `https://github.com/${repo}/pull/${number}`,
    };
  }
  if (read.kind === 'too-large') {
    return { ...answer, state: 'too-large', bytes: read.size, githubUrl: onGitHub };
  }
  const bytes = read.bytes.length;
  if (isBinary(read.bytes)) return { ...answer, state: 'binary', bytes, githubUrl: onGitHub };
  return {
    ...answer,
    state: 'shown',
    text: read.bytes.toString('utf8'),
    bytes,
    patch: await sources.patch(repo, base, sha, path),
    githubUrl: onGitHub,
  };
}

/** A file without its code, as the preview shows a private repository's. */
export const withoutFileCode = (file: PullFile): PullFile => ({
  ...file,
  state: 'hidden',
  text: '',
  bytes: 0,
  patch: '',
});
