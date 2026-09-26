import { type Dirent, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { cached } from '../util/cached.ts';
import { githubRepoOf, originUrlOf } from './collision-pairs.ts';

/** Where this machine keeps a clone of a GitHub repository, if it does. */
export interface CloneFinder {
  cloneOf(repo: string): Promise<string | null>;
}

export const CLONES_FILE = join(homedir(), '.claude', 'observatory', 'clones.json');
/** By default, the folder that holds Observatory's own checkout. */
export const DEFAULT_CLONES_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const MAX_DEPTH = 4;
/** Clones rarely move; the scan is repeated at most this often. */
const SCAN_TTL_MS = 10 * 60_000;
const SKIPPED = new Set(['node_modules', 'dist', 'bin', 'obj']);

const isCheckout = (dir: string): boolean => {
  try {
    // A worktree's `.git` is a file; only a primary checkout's is a folder.
    return statSync(join(dir, '.git')).isDirectory();
  } catch {
    return false;
  }
};

const repoAt = (dir: string): string | null => {
  try {
    const url = originUrlOf(readFileSync(join(dir, '.git', 'config'), 'utf8'));
    return url ? githubRepoOf(url) : null;
  } catch {
    return null;
  }
};

const subfolders = (dir: string): Dirent[] => {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith('.') && !SKIPPED.has(entry.name),
    );
  } catch {
    return [];
  }
};

/** Every primary checkout under `root` whose origin is on GitHub, shallowest first. */
export function scanClones(root: string, maxDepth = MAX_DEPTH): Map<string, string> {
  const clones = new Map<string, string>();
  let level = [root];
  for (let depth = 0; depth <= maxDepth && level.length; depth++) {
    const next: string[] = [];
    for (const dir of level) {
      if (isCheckout(dir)) {
        const repo = repoAt(dir);
        if (repo && !clones.has(repo)) clones.set(repo, dir);
        continue;
      }
      next.push(...subfolders(dir).map((entry) => join(dir, entry.name)));
    }
    level = next;
  }
  return clones;
}

function readOverrides(file: string): Map<string, string> {
  try {
    const stored = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    return new Map(
      Object.entries(stored)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([repo, path]) => [repo.toLowerCase(), path]),
    );
  } catch {
    return new Map();
  }
}

/** Finds clones from `clones.json` first, then by scanning `root` for a checkout
 *  whose origin is the repository. A listed path that is not a checkout is ignored. */
export function fileCloneFinder(
  root = process.env['OBSERVATORY_CLONES_ROOT'] ?? DEFAULT_CLONES_ROOT,
  overridesFile = CLONES_FILE,
): CloneFinder {
  const scan = cached(async () => scanClones(root), SCAN_TTL_MS);
  return {
    async cloneOf(repo) {
      const key = repo.toLowerCase();
      const listed = readOverrides(overridesFile).get(key);
      if (listed && existsSync(join(listed, '.git'))) return listed;
      return (await scan()).get(key) ?? null;
    },
  };
}
