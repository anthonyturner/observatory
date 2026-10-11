import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FateReader, PullState } from '../github/fate-reader.ts';
import type { MergeMethod } from '../github/pull-writer.ts';
import { appMergeMethod, fateWithAppMerges } from './app-merges.ts';
import type { EditRecord, EditStore } from './edit-store.ts';

const recordOf = (applied: string[], method: MergeMethod | null): EditRecord => ({
  pr: 7,
  status: 'applied',
  changes: method ? { merge: { method, headOid: 'a'.repeat(40) } } : { title: 'T' },
  requestedAt: '2026-10-11T10:00:00.000Z',
  applied,
  message: 'applied',
  appliedAt: '2026-10-11T10:00:01.000Z',
});

const stateOf = (state: PullState['state'], how: 'merge' | 'squash' | 'closed'): PullState => ({
  state,
  title: 't',
  ending: { how, threads: { resolved: 0, unresolved: 0 }, closes: [] },
});

const edits = (record: EditRecord | null): EditStore => ({
  read: async () => record,
  write: async () => undefined,
});

const reader = (state: PullState): FateReader => ({ pullState: async () => state });

describe('appMergeMethod', () => {
  it('is the method of an edit that merged, and nothing for one that did not', () => {
    assert.equal(appMergeMethod(recordOf(['merge'], 'rebase')), 'rebase');
    assert.equal(appMergeMethod(recordOf(['title'], null)), null);
    assert.equal(appMergeMethod(recordOf(['title'], 'merge')), null);
    assert.equal(appMergeMethod(null), null);
  });
});

describe('fateWithAppMerges', () => {
  it('lets the method the app merged with win over the commit shape', async () => {
    const fates = fateWithAppMerges(
      reader(stateOf('MERGED', 'squash')),
      edits(recordOf(['merge'], 'merge')),
    );

    assert.equal((await fates.pullState('me/app', 7)).ending?.how, 'merge');
  });

  it('counts an app rebase as a squash', async () => {
    const fates = fateWithAppMerges(
      reader(stateOf('MERGED', 'merge')),
      edits(recordOf(['merge'], 'rebase')),
    );

    assert.equal((await fates.pullState('me/app', 7)).ending?.how, 'squash');
  });

  it('keeps what the commit suggests when the app did not merge it', async () => {
    const fates = fateWithAppMerges(reader(stateOf('MERGED', 'merge')), edits(null));

    assert.equal((await fates.pullState('me/app', 7)).ending?.how, 'merge');
  });

  it('leaves a closed pull request alone, and never reads the edits for it', async () => {
    const unread: EditStore = {
      read: async () => assert.fail('a closed pull request has no merge to check'),
      write: async () => undefined,
    };

    const state = await fateWithAppMerges(reader(stateOf('CLOSED', 'closed')), unread).pullState(
      'me/app',
      7,
    );

    assert.equal(state.ending?.how, 'closed');
  });
});
