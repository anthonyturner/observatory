import type { RawLabel } from '../github/pull-reader.ts';
import type { PullWriter } from '../github/pull-writer.ts';
import { type EditOutcome, applyEdit } from './apply-edit.ts';
import type { EditRequest, EditTarget } from './edit-request.ts';
import { editProblems } from './edit-rules.ts';
import type { EditRecord, EditStore } from './edit-store.ts';

/** What the Edit tab's routes do. */
export interface PullEditor {
  /** Checks an edit, applies it to GitHub, and records how it went. */
  apply(request: EditRequest): Promise<EditRecord>;
  read(target: EditTarget): Promise<EditRecord | null>;
  clear(target: EditTarget): Promise<void>;
}

export interface EditorSources {
  readonly writer: PullWriter;
  readonly labels: (repo: string) => Promise<readonly RawLabel[]>;
  readonly store: EditStore;
  /** Told when a pull request has changed, so a cached copy of it is read again. */
  readonly changed: (target: EditTarget) => void;
  readonly now: () => number;
}

const messageOf = (outcome: EditOutcome): string =>
  outcome.errors.length ? outcome.errors.join('; ') : `applied: ${outcome.applied.join(', ')}`;

export function pullEditor(sources: EditorSources): PullEditor {
  const { writer, store } = sources;

  async function outcomeOf(request: EditRequest): Promise<EditOutcome> {
    const known = new Set((await sources.labels(request.repo)).map((label) => label.name));
    const problems = editProblems(request.changes, known);
    if (problems.length) return { status: 'rejected', applied: [], errors: problems };
    return applyEdit(request, writer);
  }

  return {
    async apply(request) {
      const requestedAt = new Date(sources.now()).toISOString();
      const outcome = await outcomeOf(request);
      if (outcome.applied.length) sources.changed(request);
      const record: EditRecord = {
        pr: request.number,
        status: outcome.status,
        changes: request.changes,
        requestedAt,
        applied: outcome.applied,
        message: messageOf(outcome),
        appliedAt: new Date(sources.now()).toISOString(),
      };
      await store.write(request, record);
      return record;
    },
    read: (target) => store.read(target),
    clear: (target) => store.write(target, null),
  };
}
