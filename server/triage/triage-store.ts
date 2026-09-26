import { repoKey, type Store } from '../store/store.ts';
import { EMPTY_TRIAGE, type TriageState } from './triage.ts';

/** Where each repository's triage is kept. */
export interface TriageStore {
  read(repo: string): Promise<TriageState>;
  write(repo: string, state: TriageState): Promise<void>;
}

const keyOf = (repo: string): string => `triage/${repoKey(repo)}`;

/** Only the string entries of a stored record: anything else was not written by triage. */
function stringsOf(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/** Stored triage as a TriageState; anything unreadable reads as no triage. */
export function triageStateFrom(value: unknown): TriageState {
  if (typeof value !== 'object' || value === null) return EMPTY_TRIAGE;
  const stored = value as Record<string, unknown>;
  return {
    seen: stringsOf(stored['seen']),
    dismissed: stringsOf(stored['dismissed']),
    snoozed: stringsOf(stored['snoozed']),
    changed: stringsOf(stored['changed']),
  };
}

/** Triage as one document per repository. On this machine, with `fileStore`,
 *  that is `~/.claude/observatory/triage/<owner>__<name>.json`. */
export function storeTriageStore(store: Store): TriageStore {
  return {
    read: async (repo) => triageStateFrom(await store.get(keyOf(repo))),
    write: (repo, state) => store.set(keyOf(repo), state),
  };
}
