import { type FateReader, howMerged } from '../github/fate-reader.ts';
import type { MergeMethod } from '../github/pull-writer.ts';
import type { EditRecord, EditStore } from './edit-store.ts';

/** The method this app merged with, or null when its last edit did not merge. */
export function appMergeMethod(record: EditRecord | null): MergeMethod | null {
  return record?.applied.includes('merge') ? (record.changes.merge?.method ?? null) : null;
}

/** A fate reader that believes what this app did over what the commit looks like:
 *  a rebase merge leaves a single commit, indistinguishable from a squash, but
 *  the edit record knows which button was pressed. */
export const fateWithAppMerges = (fates: FateReader, edits: EditStore): FateReader => ({
  async pullState(repo, pull) {
    const state = await fates.pullState(repo, pull);
    if (state.state !== 'MERGED' || !state.ending) return state;
    const method = appMergeMethod(await edits.read({ repo, number: pull }));
    return method ? { ...state, ending: { ...state.ending, how: howMerged(method) } } : state;
  },
});
