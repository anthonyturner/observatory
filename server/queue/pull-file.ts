import type { FileRead } from '../github/docs-reader.ts';
import { BadRequest } from '../http/api-handler.ts';
import { commitShaFrom } from './commit-diff.ts';
import { pullNumberFrom } from './pull-detail.ts';
import { repoPathFrom } from './repo-path.ts';

/** Where the whole-file page reads a file of a pull request. */
export const PULL_FILE_PATH = '/api/pull-file';

/** The whole-file page shows nothing larger; GitHub's contents answer ends at the same size. */
export const PULL_FILE_MAX_BYTES = 1024 * 1024;

/** Git's own test for a binary file: a NUL byte in the first 8,000. */
const BINARY_PROBE_BYTES = 8000;

const FULL_SHA_LENGTH = 40;

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
  /** GitHub would not give the diff, so an empty `patch` does not mean the file has no changes. */
  readonly changesUnavailable: boolean;
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
  /** The file's section of the diff from `base` to `sha`: empty when the diff has none, null
   *  when GitHub would not give the diff. */
  patch(repo: string, base: string, sha: string, path: string): Promise<string | null>;
}

/** The request's pull request number, commit and file, or a BadRequest saying what is wrong. */
export function pullFileRequestFrom(repo: string, query: URLSearchParams): PullFileRequest {
  const sha = commitShaFrom(query.get('sha'));
  // A short hash never equals the head's, so the page would always offer a newer commit.
  if (sha.length !== FULL_SHA_LENGTH) throw new BadRequest('sha must be the full 40 characters');
  return {
    repo,
    number: pullNumberFrom(query.get('number')),
    sha,
    path: repoPathFrom(query.get('path')),
  };
}

const FILE_START = /^(?=diff --git )/m;

/** Whether a section of a diff is the file now at `path`: its header names that path on both
 *  sides, or it renames another file to it. Matched whole, so a file named `x b/y` is not
 *  taken for `y`. */
function isSectionOf(section: string, path: string): boolean {
  if (section.split('\n', 1)[0] === `diff --git a/${path} b/${path}`) return true;
  const firstHunk = section.indexOf('\n@@');
  const header = firstHunk < 0 ? section : section.slice(0, firstHunk);
  return `${header}\n`.includes(`\nrename to ${path}\n`);
}

/** The file's section of a diff, or empty when the diff has none, as for a path git quotes. */
export function patchOfFile(diff: string, path: string): string {
  return diff.split(FILE_START).find((part) => isSectionOf(part, path)) ?? '';
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
  const answer = {
    path,
    sha,
    headOid,
    text: '',
    bytes: 0,
    patch: '',
    changesUnavailable: false,
    fetchedAt,
  };
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
  const patch = await sources.patch(repo, base, sha, path);
  return {
    ...answer,
    state: 'shown',
    text: read.bytes.toString('utf8'),
    bytes,
    patch: patch ?? '',
    changesUnavailable: patch === null,
    githubUrl: onGitHub,
  };
}

/** What a visitor is told of a private repository's file, without reading it: the same whether the
 *  file exists or not, so not even that is given away. */
export const hiddenPullFile = (
  { repo, number, sha, path }: PullFileRequest,
  fetchedAt: string,
): PullFile => ({
  path,
  sha,
  headOid: sha,
  state: 'hidden',
  text: '',
  bytes: 0,
  patch: '',
  changesUnavailable: false,
  githubUrl: `https://github.com/${repo}/pull/${number}`,
  fetchedAt,
});
