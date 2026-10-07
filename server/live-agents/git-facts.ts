import { resolve } from 'node:path';
import type { ChangesProblem } from './agent-changes-types.ts';
import type { Git } from './read-only-git.ts';

/** The remote branch a branch is compared with, and the commit it is at. */
export interface Base {
  /** As `origin/main`. */
  readonly name: string;
  readonly sha: string;
}

/** A working folder's checkout, as git reports it. */
export interface Checkout {
  readonly toplevel: string;
  /** The checkout itself rather than one of its linked worktrees. */
  readonly isPrimary: boolean;
}

/** A step that could not give its answer, and the problem the page names. */
export class ChangesFailure extends Error {
  readonly problem: ChangesProblem;

  constructor(problem: ChangesProblem) {
    super(problem);
    this.problem = problem;
  }
}

const REMOTE_HEAD = 'refs/remotes/origin/HEAD';
/** Tried in order when the remote's HEAD is not recorded, as after a plain `git init` and `remote add`. */
const FALLBACK_BASES = ['origin/main', 'origin/master'];
const NOT_A_REPO = /not a git repository/i;
/** A name git could read as an option or a range, or anything stranger than a ref. */
const REF_NAME = /^[\w][\w./-]*$/;

export const isRefName = (name: string): boolean => REF_NAME.test(name) && !name.includes('..');

const firstLine = (stdout: string): string => stdout.split('\n')[0]?.trim() ?? '';

/** `dir`'s checkout, or a failure saying it is not in one. */
export async function checkoutOf(git: Git, dir: string): Promise<Checkout> {
  const answer = await git(dir, [
    'rev-parse',
    '--path-format=absolute',
    '--show-toplevel',
    '--git-dir',
    '--git-common-dir',
  ]);
  if (answer.code !== 0) {
    throw new ChangesFailure(NOT_A_REPO.test(answer.stderr) ? 'not-a-repo' : 'git-failed');
  }
  const [toplevel, gitDir, commonDir] = answer.stdout.split('\n').map((line) => line.trim());
  if (!toplevel || !gitDir || !commonDir) throw new ChangesFailure('git-failed');
  return { toplevel, isPrimary: resolve(gitDir) === resolve(commonDir) };
}

/** The branch checked out in `top`, or null when HEAD is detached. */
export async function branchOf(git: Git, top: string): Promise<string | null> {
  const answer = await git(top, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  return answer.code === 0 ? firstLine(answer.stdout) || null : null;
}

/** The commit `ref` names, or null when it names none. */
export async function commitOf(git: Git, top: string, ref: string): Promise<string | null> {
  const answer = await git(top, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  return answer.code === 0 ? firstLine(answer.stdout) || null : null;
}

async function remoteHeadOf(git: Git, top: string): Promise<string | null> {
  const answer = await git(top, ['symbolic-ref', '--quiet', '--short', REMOTE_HEAD]);
  const name = answer.code === 0 ? firstLine(answer.stdout) : '';
  return isRefName(name) ? name : null;
}

/** The remote default branch, as of the last fetch: `origin/HEAD`, else
 *  `origin/main`, else `origin/master`. Null when the remote has none of them. */
export async function baseOf(git: Git, top: string): Promise<Base | null> {
  const remoteHead = await remoteHeadOf(git, top);
  for (const name of remoteHead ? [remoteHead, ...FALLBACK_BASES] : FALLBACK_BASES) {
    const sha = await commitOf(git, top, `refs/remotes/${name}`);
    if (sha) return { name, sha };
  }
  return null;
}

/** Where `head` left `base`; a failure when they share no history. */
export async function mergeBaseOf(
  git: Git,
  top: string,
  head: string,
  base: Base,
): Promise<string> {
  const answer = await git(top, ['merge-base', head, base.sha]);
  const sha = firstLine(answer.stdout);
  if (answer.code !== 0 || !sha) throw new ChangesFailure('git-failed');
  return sha;
}

/** The base's own branch name: `main` for `origin/main`. */
export const branchNameOf = (base: Base): string => base.name.slice(base.name.indexOf('/') + 1);
