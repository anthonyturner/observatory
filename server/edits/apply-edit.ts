import type { LivePull, PullWriter } from '../github/pull-writer.ts';
import type { EditRequest } from './edit-request.ts';
import { safeChangesOf } from './edit-rules.ts';

/** How an edit went, in pr-starmap's words for it. */
export type EditStatus = 'applied' | 'partial' | 'failed' | 'rejected' | 'skipped';

export interface EditOutcome {
  readonly status: EditStatus;
  /** What was done: the changed fields, `ready`, `merge`. */
  readonly applied: readonly string[];
  readonly errors: readonly string[];
}

const ERROR_LENGTH = 300;
const SHORT_OID_LENGTH = 7;

/** The first line of what went wrong: `gh` puts the reason on stderr. */
export function firstLine(error: unknown): string {
  const failure = error as { stderr?: string; message?: string } | null;
  return String(failure?.stderr || failure?.message || error)
    .trim()
    .split('\n')[0]
    .slice(0, ERROR_LENGTH);
}

/** What one edit did so far, step by step. */
interface Progress {
  readonly applied: string[];
  readonly errors: string[];
}

async function attempt(progress: Progress, what: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    progress.applied.push(what);
  } catch (error) {
    progress.errors.push(`${what} failed: ${firstLine(error)}`);
  }
}

const short = (oid: string): string => oid.slice(0, SHORT_OID_LENGTH);

/** Why a merge must not be tried, or null when it may. */
function mergeRefusal(headOid: string, live: LivePull): string | null {
  // GitHub would refuse this too; saying why is kinder than a hash mismatch.
  if (live.headRefOid !== headOid) {
    return `not merged: commits were pushed after you reviewed it (you saw ${short(headOid)}, it is now ${short(live.headRefOid)})`;
  }
  if (live.mergeable === 'CONFLICTING') return 'not merged: the branch conflicts with its base';
  return null;
}

function statusOf({ applied, errors }: Progress): EditStatus {
  if (errors.length && !applied.length) return 'failed';
  return errors.length ? 'partial' : 'applied';
}

/**
 * Applies a checked edit: the reversible changes first, then the two
 * decisions. Those run here because the owner asked for them on the page, a
 * merge only after typing the pull request's number, and it is pinned to the
 * commit they were looking at.
 */
export async function applyEdit(request: EditRequest, writer: PullWriter): Promise<EditOutcome> {
  const { repo, number, changes } = request;
  let live: LivePull;
  try {
    live = await writer.livePull(repo, number);
  } catch (error) {
    return {
      status: 'failed',
      applied: [],
      errors: [`could not read the pull request: ${firstLine(error)}`],
    };
  }
  // Asked for yesterday, merged by hand this morning: nothing is left to do.
  if (live.state !== 'OPEN') {
    return {
      status: 'skipped',
      applied: [],
      errors: [`pull request is ${live.state.toLowerCase()} now`],
    };
  }

  const progress: Progress = { applied: [], errors: [] };
  const safe = safeChangesOf(changes);
  const fields = Object.keys(safe);
  if (fields.length) {
    try {
      await writer.editPull(repo, number, safe);
      progress.applied.push(...fields);
    } catch (error) {
      progress.errors.push(`edit failed: ${firstLine(error)}`);
    }
  }
  if (changes.ready && !live.isDraft) progress.applied.push('ready (already ready)');
  else if (changes.ready) await attempt(progress, 'ready', () => writer.markReady(repo, number));

  if (changes.merge) {
    const merge = changes.merge;
    const refusal = mergeRefusal(merge.headOid, live);
    if (refusal) progress.errors.push(refusal);
    else await attempt(progress, 'merge', () => writer.mergePull(repo, number, merge));
  }
  return { status: statusOf(progress), ...progress };
}
