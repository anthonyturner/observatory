import { repoKey, type Store } from '../store/store.ts';
import { isLogTime } from './log-line.ts';

/** When each repository's Log Sky was last cleared. */
export interface LogClears {
  /** A log time, or null for a sky that is not cleared. */
  clearedAt(repo: string): Promise<string | null>;
  /** Hides every line logged up to `at`, a log time (see `localTimeOf`). */
  clear(repo: string, at: string): Promise<void>;
  /** Shows everything again. Resetting a sky that is not cleared succeeds. */
  reset(repo: string): Promise<void>;
}

const keyOf = (repo: string): string => `log-clears/${repoKey(repo)}`;

/** The stored clear as a log time; anything else was not written by a clear and reads as none. */
export function clearedAtFrom(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const { clearedAt } = value as Record<string, unknown>;
  return isLogTime(clearedAt) ? clearedAt : null;
}

/** One document per repository, kept apart from `logs.json`, whose reader drops anything but a
 *  folder. On this machine, with `fileStore`, that is
 *  `~/.claude/observatory/log-clears/<owner>__<name>.json`. */
export function storeLogClears(store: Store): LogClears {
  const write = (repo: string, clearedAt: string | null): Promise<void> =>
    store.set(keyOf(repo), { clearedAt });
  return {
    clearedAt: async (repo) => clearedAtFrom(await store.get(keyOf(repo))),
    clear: (repo, at) => write(repo, at),
    reset: (repo) => write(repo, null),
  };
}
