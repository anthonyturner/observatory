import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { githubRepoOf, originUrlOf } from '../collisions/collision-pairs.ts';
import type { ProjectOf, ProjectRef } from './project-usage.ts';

/** A worktree beside its checkout is named `<checkout>-wt-<topic>`. */
const WORKTREE_SUFFIX = /-wt-.*$/;
const HOME_NAME = 'home';

/** A checkout found on disk: its folder and the git folder holding its config. */
interface Checkout {
  readonly dir: string;
  readonly gitDir: string;
}

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** A worktree's `.git` is a file naming its own git folder, whose `commondir`
 *  leads back to the primary checkout's. */
function commonGitDir(gitFile: string): string | null {
  try {
    const own = /^gitdir:\s*(.+)$/m.exec(readFileSync(gitFile, 'utf8'))?.[1]?.trim();
    if (!own) return null;
    const ownDir = resolve(dirname(gitFile), own);
    const common = readFileSync(join(ownDir, 'commondir'), 'utf8').trim();
    return isAbsolute(common) ? common : resolve(ownDir, common);
  } catch {
    return null;
  }
}

/** The primary checkout `dir` is in, or null when it is in none. */
function checkoutOf(dir: string): Checkout | null {
  for (let at = resolve(dir); ; at = dirname(at)) {
    const git = join(at, '.git');
    if (isDirectory(git)) return { dir: at, gitDir: git };
    if (existsSync(git)) {
      const common = commonGitDir(git);
      return common ? { dir: dirname(common), gitDir: common } : null;
    }
    if (dirname(at) === at) return null;
  }
}

/** The top of the working tree `path` is in, a checkout or one of its worktrees, or null for none. */
export function worktreeRootOf(path: string): string | null {
  if (!isAbsolute(path)) return null;
  for (let at = resolve(path); ; at = dirname(at)) {
    if (existsSync(join(at, '.git'))) return at;
    if (dirname(at) === at) return null;
  }
}

function repoOf(checkout: Checkout): string | null {
  try {
    const url = originUrlOf(readFileSync(join(checkout.gitDir, 'config'), 'utf8'));
    return url ? githubRepoOf(url) : null;
  } catch {
    return null;
  }
}

const folderName = (dir: string): string => basename(dir).replace(WORKTREE_SUFFIX, '');

/** The nearest folder at or above `dir` that still exists. */
function nearestExisting(dir: string): string {
  let at = dir;
  while (!existsSync(at) && dirname(at) !== at) at = dirname(at);
  return at;
}

/** A folder that is gone was a worktree: one beside its checkout is known by
 *  its name, one kept inside it (`.claude/worktrees/`) by where it was. */
function formerWorktreeOf(cwd: string): Checkout | null {
  const sibling = join(dirname(cwd), folderName(cwd));
  if (sibling !== cwd && existsSync(join(sibling, '.git'))) return checkoutOf(sibling);
  return checkoutOf(nearestExisting(cwd));
}

/** The primary checkout `cwd` is in, or was in once it is a removed worktree; null for none. */
export function checkoutFolderOf(cwd: string): string | null {
  if (!isAbsolute(cwd)) return null;
  return (existsSync(cwd) ? checkoutOf(cwd) : formerWorktreeOf(cwd))?.dir ?? null;
}

/** "owner/name" is named by its name, as the star map names it. */
const nameOf = (repo: string): string => repo.slice(repo.indexOf('/') + 1);

/** The project a session's folder belongs to: a GitHub checkout or one of its
 *  worktrees, gone or not; else just the folder. */
export function resolveProject(cwd: string): ProjectRef {
  if (!isAbsolute(cwd)) return { name: HOME_NAME, repo: null };
  const checkout = existsSync(cwd) ? checkoutOf(cwd) : formerWorktreeOf(cwd);
  const repo = checkout && repoOf(checkout);
  if (repo) return { name: nameOf(repo), repo };
  return { name: folderName(cwd) || HOME_NAME, repo: null };
}

/** `resolveOne`, remembered per folder for one report: a month of logs names
 *  the same few folders thousands of times. */
export function rememberProjects(resolveOne: ProjectOf): ProjectOf {
  const known = new Map<string, ProjectRef>();
  return (cwd) => {
    const had = known.get(cwd);
    if (had) return had;
    const project = resolveOne(cwd);
    known.set(cwd, project);
    return project;
  };
}
