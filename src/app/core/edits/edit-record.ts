export type MergeMethod = 'squash' | 'merge' | 'rebase';

export const MERGE_METHODS: readonly MergeMethod[] = ['squash', 'merge', 'rebase'];

/** What the PR screen sends: the Edit tab's reversible changes, and the merge box's two decisions. */
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
  /** How GitHub merged the pull request, when this edit merged it. */
  readonly mergedWith: MergeMethod | null;
  /** When this edit marked the pull request ready for review, or null. */
  readonly readiedAt: string | null;
}

type Json = Record<string, unknown>;

const isJson = (value: unknown): value is Json => typeof value === 'object' && value !== null;

function appliedOf(record: Json): readonly unknown[] {
  const applied = record['applied'];
  return Array.isArray(applied) ? applied : [];
}

function mergedWithOf(record: Json): MergeMethod | null {
  if (!appliedOf(record).includes('merge')) return null;
  const changes = record['changes'];
  const merge = isJson(changes) ? changes['merge'] : null;
  const method = isJson(merge) ? merge['method'] : null;
  return MERGE_METHODS.find((each) => each === method) ?? null;
}

/** `ready (already ready)` counts too: either way it is ready now. */
const isReadyStep = (step: unknown): boolean =>
  typeof step === 'string' && step.startsWith('ready');

function readiedAtOf(record: Json): string | null {
  const appliedAt = record['appliedAt'];
  const readied = appliedOf(record).some(isReadyStep);
  return readied && typeof appliedAt === 'string' ? appliedAt : null;
}

/** A record from the API, or null when there is none or it does not parse. */
export function parseEditRecord(value: unknown): EditRecord | null {
  if (!isJson(value)) return null;
  const { status, message } = value;
  if (!(STATUSES as readonly unknown[]).includes(status)) return null;
  return {
    status: status as EditStatus,
    message: typeof message === 'string' ? message : '',
    mergedWith: mergedWithOf(value),
    readiedAt: readiedAtOf(value),
  };
}
