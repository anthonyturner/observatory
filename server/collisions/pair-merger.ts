import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mapWithLimit } from '../util/map-with-limit.ts';
import { conflictedFiles } from './collision-pairs.ts';

/** Merges pairs of pull requests in a clone, without touching its branches or files. */
export interface PairMerger {
  /** Fetches each pull request's head, ready to merge pairs of them. */
  open(clone: string, pulls: readonly number[]): Promise<MergeSession>;
}

export interface MergeSession {
  /** The files merging `a` and `b` would conflict on, `[]` if none, or null if it could not be tried. */
  conflicts(a: number, b: number): Promise<string[] | null>;
  /** Deletes every ref the session fetched. */
  close(): Promise<void>;
}

const run = promisify(execFile);
/** Pull request heads land here, apart from anything the clone's owner uses. */
const REF_ROOT = 'refs/observatory/pull';
const MERGE_CONFLICTED = 1;
const FETCH_CONCURRENCY = 4;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

const refOf = (pull: number): string => `${REF_ROOT}/${pull}`;
const refspecOf = (pull: number): string => `+refs/pull/${pull}/head:${refOf(pull)}`;

/** `git` with `input` on stdin, for `update-ref --stdin`. */
function gitWithInput(clone: string, args: readonly string[], input: string): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn('git', ['-C', clone, ...args], { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', fail);
    child.on('close', (code) =>
      code === 0 ? done() : fail(new Error(`git ${args[0]} exited ${code}`)),
    );
    child.stdin.end(input);
  });
}

/** Pairs merged with `git merge-tree --write-tree` (git 2.38 or newer). */
export function gitPairMerger(): PairMerger {
  const git = (clone: string, args: readonly string[]) =>
    run('git', ['-C', clone, ...args], { encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES });

  /** All heads in one fetch; if one is missing that fails, so then one at a time. */
  async function fetchHeads(clone: string, pulls: readonly number[]): Promise<Set<number>> {
    const fetch = (some: readonly number[]) =>
      git(clone, ['fetch', '--no-tags', '--quiet', 'origin', ...some.map(refspecOf)]);
    try {
      await fetch(pulls);
      return new Set(pulls);
    } catch {
      const fetched = await mapWithLimit(pulls, FETCH_CONCURRENCY, (pull) =>
        fetch([pull]).then(
          () => pull,
          () => null,
        ),
      );
      return new Set(fetched.filter((pull): pull is number => pull !== null));
    }
  }

  return {
    async open(clone, pulls) {
      const fetched = await fetchHeads(clone, pulls);
      if (!fetched.size) throw new Error('could not fetch any pull request');
      return {
        async conflicts(a, b) {
          if (!fetched.has(a) || !fetched.has(b)) return null;
          const args = ['merge-tree', '--write-tree', '--name-only', '--no-messages'];
          try {
            await git(clone, [...args, refOf(a), refOf(b)]);
            return [];
          } catch (error) {
            const failure = error as { code?: unknown; stdout?: string };
            return failure.code === MERGE_CONFLICTED ? conflictedFiles(failure.stdout ?? '') : null;
          }
        },
        async close() {
          const { stdout } = await git(clone, [
            'for-each-ref',
            '--format=delete %(refname)',
            REF_ROOT,
          ]);
          if (stdout.trim()) await gitWithInput(clone, ['update-ref', '--stdin'], stdout);
        },
      };
    },
  };
}
