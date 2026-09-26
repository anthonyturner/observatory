/**
 * JSON documents by key. A key is path-like, `collection/name`, in letters,
 * digits, `.`, `_` and `-`: `triage/owner__repo`. What comes back was written
 * by an earlier version or another process, so a reader checks its shape.
 */
export interface Store {
  /** The document at `key`, or null when there is none. */
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

const KEY = /^[\w.-]+(\/[\w.-]+)*$/;

/** `key`, or an error when it could reach outside the store. */
export function checkedKey(key: string): string {
  if (!KEY.test(key) || key.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error(`not a store key: ${key}`);
  }
  return key;
}

/** `owner/name` as one key segment, as the files on this machine have always been named. */
export const repoKey = (repo: string): string => repo.replace('/', '__');
