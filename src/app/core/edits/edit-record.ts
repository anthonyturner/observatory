export type MergeMethod = 'squash' | 'merge' | 'rebase';

export const MERGE_METHODS: readonly MergeMethod[] = ['squash', 'merge', 'rebase'];

/** What the Edit tab sends: the reversible changes, and the two decisions. */
export interface EditChanges {
  readonly title?: string;
  readonly body?: string;
  readonly addLabels?: readonly string[];
  readonly removeLabels?: readonly string[];
  readonly addAssignees?: readonly string[];
  readonly removeAssignees?: readonly string[];
  readonly addReviewers?: readonly string[];
  readonly removeReviewers?: readonly string[];
  readonly ready?: true;
  /** A merge pinned to the commit that was seen. */
  readonly merge?: { readonly method: MergeMethod; readonly headOid: string };
}

export type EditStatus = 'applied' | 'partial' | 'failed' | 'rejected' | 'skipped';

const STATUSES: readonly EditStatus[] = ['applied', 'partial', 'failed', 'rejected', 'skipped'];

/** The last edit sent for a pull request, and how it went. */
export interface EditRecord {
  readonly status: EditStatus;
  /** What went wrong, or what was applied. */
  readonly message: string;
}

/** A record from the API, or null when there is none or it does not parse. */
export function parseEditRecord(value: unknown): EditRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const { status, message } = value as Record<string, unknown>;
  if (!(STATUSES as readonly unknown[]).includes(status)) return null;
  return { status: status as EditStatus, message: typeof message === 'string' ? message : '' };
}
