import { repoKey, type Store } from '../store/store.ts';
import type { EditStatus } from './apply-edit.ts';
import type { EditChanges, EditTarget } from './edit-request.ts';

/** The last edit sent for one pull request and how it went, for the badge that reports it. */
export interface EditRecord {
  readonly pr: number;
  readonly status: EditStatus;
  readonly changes: EditChanges;
  readonly requestedAt: string;
  readonly applied: readonly string[];
  /** What went wrong, or what was applied. */
  readonly message: string;
  readonly appliedAt: string;
}

/** Where each pull request's last edit is kept. */
export interface EditStore {
  read(target: EditTarget): Promise<EditRecord | null>;
  /** Null clears it. */
  write(target: EditTarget, record: EditRecord | null): Promise<void>;
}

const STATUSES: readonly EditStatus[] = ['applied', 'partial', 'failed', 'rejected', 'skipped'];

const keyOf = ({ repo, number }: EditTarget): string => `edits/${repoKey(repo)}/${number}`;

/** A stored record, or null when there is none or it was not written by this code. */
export function editRecordFrom(value: unknown): EditRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Partial<Record<keyof EditRecord, unknown>>;
  const isStatus = (STATUSES as readonly unknown[]).includes(record.status);
  if (!isStatus || typeof record.pr !== 'number' || typeof record.message !== 'string') return null;
  return value as EditRecord;
}

/** One document per pull request. On this machine, with `fileStore`, that is
 *  `~/.claude/observatory/edits/<owner>__<name>/<number>.json`. */
export function storeEditStore(store: Store): EditStore {
  return {
    read: async (target) => editRecordFrom(await store.get(keyOf(target))),
    write: (target, record) => store.set(keyOf(target), record),
  };
}
